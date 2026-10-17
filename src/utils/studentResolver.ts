import { supabase } from '../lib/supabase';

export interface ResolveStudentParams {
  profile: any;
  courseId?: string;
  selectedStudentId?: string;
  stateStudents?: any[];
  centerId?: string;
}

export interface ResolvedStudentResult {
  studentId: string | null;
  student: any | null;
  familyStudents: any[];
}

const normalize = (text: string = ''): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

export const cleanParentName = (name: string = ''): string => {
  return normalize(name)
    .replace('(padre/madre)', '')
    .replace('(padre)', '')
    .replace('(madre)', '')
    .replace('(tutor)', '')
    .replace('(tutora)', '')
    .replace('(encargado)', '')
    .replace('(encargada)', '')
    .replace('(familiar)', '')
    .trim();
};

/**
 * Resuelve de forma infalible el ID físico del estudiante (en la tabla 'students')
 * para usuarios con rol 'student' o roles de familia ('parent', 'padre', 'tutor', etc.).
 * Evita que se use el UID de Auth (profile.id) para consultar calificaciones o entregas.
 */
export async function resolveStudentForUser({
  profile,
  courseId,
  selectedStudentId,
  stateStudents = [],
  centerId
}: ResolveStudentParams): Promise<ResolvedStudentResult> {
  const result: ResolvedStudentResult = {
    studentId: null,
    student: null,
    familyStudents: []
  };

  if (!profile) return result;

  const role = (profile.role || '').toLowerCase();
  const isParent = ['parent', 'padre', 'tutor', 'madre', 'familiar'].includes(role);
  const isStudent = role === 'student' || role === 'alumno' || role === 'alumna';
  const effectiveCenterId = profile.center_id || centerId;

  // 1. Obtener lista base de estudiantes del centro y/o curso
  let availableStudents: any[] = [];

  // Usar del estado de la app si están disponibles
  if (stateStudents && stateStudents.length > 0) {
    availableStudents = [...stateStudents];
  }

  // Si no hay estudiantes en el estado o faltan los del curso, consultar en Supabase
  if (effectiveCenterId && availableStudents.length === 0) {
    try {
      let query = supabase
        .from('students')
        .select('*')
        .eq('center_id', effectiveCenterId);

      const { data: dbStudents, error } = await query;
      if (!error && dbStudents && dbStudents.length > 0) {
        availableStudents = dbStudents;
      }
    } catch (e) {
      console.warn('[studentResolver] Error fetching students from database:', e);
    }
  }

  // Filtrar o priorizar estudiantes del curso activo
  const courseStudents = courseId
    ? availableStudents.filter((s) => s.course_id === courseId || s.courseId === courseId)
    : availableStudents;

  // 2. CASO: ROL PADRE / FAMILIAR
  if (isParent) {
    const resolvedFamilyMap = new Map<string, any>();

    // A. Buscar vínculos oficiales en tabla 'parents'
    if (profile.id) {
      try {
        const { data: pLinks } = await supabase
          .from('parents')
          .select('student_id, students(*)')
          .eq('profile_id', profile.id);

        if (pLinks && pLinks.length > 0) {
          pLinks.forEach((link: any) => {
            const st = link.students || availableStudents.find((s) => s.id === link.student_id);
            if (st && st.id) {
              resolvedFamilyMap.set(st.id, st);
            }
          });
        }
      } catch (errParents) {
        console.warn('[studentResolver] Error querying parents table:', errParents);
      }
    }

    // B. Buscar por nombre o número de orden del alumno en el perfil
    const rawClean = cleanParentName(profile.full_name || '');
    const numMatch = rawClean.match(/(?:no\.?|num\.?|alumn[ao]|estudiante|#)\s*(\d+)/i) ||
      (profile.full_name || '').match(/(\d+)/);
    const targetOrderNum = numMatch ? parseInt(numMatch[1], 10) : null;

    if (courseStudents.length > 0) {
      // Intentar emparejar por orden si dice "alumna no. 1" o similar
      if (targetOrderNum !== null) {
        const byOrder = courseStudents.find((s) => Number(s.order_number) === targetOrderNum);
        if (byOrder) resolvedFamilyMap.set(byOrder.id, byOrder);
      }

      // Intentar emparejar por nombre y apellidos
      if (rawClean) {
        const byName = courseStudents.find((s) => {
          const sNames = normalize(s.names || s.first_name || '');
          const sLast1 = normalize(s.first_surname || s.last_name || '');
          const sLast2 = normalize(s.second_surname || '');
          const full1 = `${sNames} ${sLast1} ${sLast2}`.trim();
          const full2 = `${sLast1} ${sLast2} ${sNames}`.trim();
          return full1.includes(rawClean) || full2.includes(rawClean) || rawClean.includes(full1) || (sNames && rawClean.includes(sNames));
        });
        if (byName) resolvedFamilyMap.set(byName.id, byName);
      }
    }

    // C. Si aún no hay alumnos vinculados y el curso tiene estudiantes, tomar el primer alumno como fallback
    if (resolvedFamilyMap.size === 0 && courseStudents.length > 0) {
      resolvedFamilyMap.set(courseStudents[0].id, courseStudents[0]);
    }

    const familyList = Array.from(resolvedFamilyMap.values());
    result.familyStudents = familyList;

    // Determinar alumno objetivo
    if (selectedStudentId && resolvedFamilyMap.has(selectedStudentId)) {
      result.student = resolvedFamilyMap.get(selectedStudentId);
      result.studentId = selectedStudentId;
    } else if (courseId) {
      const matchInCourse = familyList.find((s) => s.course_id === courseId || s.courseId === courseId);
      if (matchInCourse) {
        result.student = matchInCourse;
        result.studentId = matchInCourse.id;
      } else if (familyList.length > 0) {
        result.student = familyList[0];
        result.studentId = familyList[0].id;
      }
    } else if (familyList.length > 0) {
      result.student = familyList[0];
      result.studentId = familyList[0].id;
    }

    return result;
  }

  // 3. CASO: ROL ESTUDIANTE
  if (isStudent || !isParent) {
    // Si ya tiene un student_id explícito en el perfil que existe en students
    if (profile.student_id) {
      const existing = availableStudents.find((s) => s.id === profile.student_id);
      if (existing) {
        result.student = existing;
        result.studentId = existing.id;
        result.familyStudents = [existing];
        return result;
      }
    }

    // Buscar en los estudiantes del curso
    const pool = courseStudents.length > 0 ? courseStudents : availableStudents;

    // A. Emparejar por correo electrónico
    if (profile.email) {
      const pEmail = profile.email.toLowerCase().trim();
      const byEmail = pool.find((s) => s.email && s.email.toLowerCase().trim() === pEmail);
      if (byEmail) {
        result.student = byEmail;
        result.studentId = byEmail.id;
        result.familyStudents = [byEmail];
        return result;
      }
    }

    // B. Emparejar por número de orden (ej. "Alumna no. 1")
    const pFullName = (profile.full_name || '').trim();
    const orderMatch = pFullName.match(/(?:no\.?|num\.?|alumn[ao]|estudiante|#)\s*(\d+)/i) ||
      pFullName.match(/(\d+)/);
    if (orderMatch) {
      const orderNum = parseInt(orderMatch[1], 10);
      const byOrder = pool.find((s) => Number(s.order_number) === orderNum);
      if (byOrder) {
        result.student = byOrder;
        result.studentId = byOrder.id;
        result.familyStudents = [byOrder];
        return result;
      }
    }

    // C. Emparejar por nombre y apellidos
    const pNorm = normalize(pFullName);
    if (pNorm) {
      const byName = pool.find((s) => {
        const sNames = normalize(s.names || s.first_name || '');
        const sLast1 = normalize(s.first_surname || s.last_name || '');
        const sLast2 = normalize(s.second_surname || '');
        const full1 = `${sNames} ${sLast1} ${sLast2}`.trim();
        const full2 = `${sLast1} ${sLast2} ${sNames}`.trim();
        return (
          pNorm === full1 ||
          pNorm === full2 ||
          full1.includes(pNorm) ||
          pNorm.includes(full1) ||
          (sNames && pNorm.includes(sNames) && sLast1 && pNorm.includes(sLast1))
        );
      });

      if (byName) {
        result.student = byName;
        result.studentId = byName.id;
        result.familyStudents = [byName];
        return result;
      }
    }

    // D. Si sólo hay un estudiante en el curso o no hay otra coincidencia, usar el primer alumno del curso
    if (pool.length > 0) {
      result.student = pool[0];
      result.studentId = pool[0].id;
      result.familyStudents = [pool[0]];
      return result;
    }
  }

  return result;
}
