import { supabase } from '../lib/supabase';

const normalizeGrade = (grade: string) => {
  if (!grade) return '';
  let g = String(grade).toLowerCase()
    .replace(/pre-primario/g, 'preprimario')
    .replace(/pre-kinder/g, 'prekinder')
    .replace(/pre-kínder/g, 'prekinder')
    .replace(/kínder/g, 'kinder')
    .replace(/\s+/g, ' ')
    .trim();
    
  g = g.replace(/\s+primaria/g, '')
       .replace(/\s+primario/g, '')
       .replace(/\s+secundaria/g, '')
       .replace(/\s+secundario/g, '')
       .replace(/\s+inicial/g, '');

  if (g.startsWith('1ro') || g.startsWith('1ero')) return '1ero';
  if (g.startsWith('2do') || g.startsWith('2ndo')) return '2do';
  if (g.startsWith('3ro') || g.startsWith('3ero')) return '3ero';
  if (g.startsWith('4to')) return '4to';
  if (g.startsWith('5to')) return '5to';
  if (g.startsWith('6to')) return '6to';

  return g;
};

export const dataService = {
  // CENTROS
  async getCenter(id: string) {
    const { data, error } = await supabase.from('centers').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async updateCenter(id: string, updates: any) {
    const { error } = await supabase.from('centers').update(updates).eq('id', id);
    if (error) throw error;
  },

  async uploadLogo(centerId: string, file: File) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${centerId}-${Math.random()}.${fileExt}`;
    const filePath = `logos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('center-logos')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('center-logos').getPublicUrl(filePath);
    return data.publicUrl;
  },

  // CURSOS
  async getCourses(centerId: string, schoolYear: string) {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('center_id', centerId)
      .eq('school_year', schoolYear);
    if (error) return [];
    return data;
  },

  // ESTUDIANTES
  async getStudents(courseId: string, centerId: string, schoolYear: string) {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('course_id', courseId)
      .eq('center_id', centerId)
      .eq('school_year', schoolYear)
      .order('first_surname', { ascending: true });
    if (error) return [];
    return data;
  },

  async searchStudents(centerId: string, query: string) {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const { data, error } = await supabase
      .from('students')
      .select(
        'id, names, first_surname, second_surname, first_name, last_name, course_id, family_id, address_sector, address_street, address_number'
      )
      .eq('center_id', centerId)
      .or(
        `names.ilike.%${cleanQuery}%,first_surname.ilike.%${cleanQuery}%,second_surname.ilike.%${cleanQuery}%,last_name.ilike.%${cleanQuery}%,first_name.ilike.%${cleanQuery}%`
      )
      .limit(10);
    if (error) {
      console.error('Search error:', error);
      return [];
    }
    return data;
  },

  async getFullStudent(id: string) {
    const { data: student, error: sErr } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .single();
    if (sErr) throw sErr;

    // Cargar familia, salud, etc.
    const { data: family } = await supabase.from('parents').select('*').eq('student_id', id);
    const { data: medical } = await supabase
      .from('student_medical')
      .select('*')
      .eq('student_id', id)
      .single();
    const { data: history } = await supabase
      .from('student_history')
      .select('*')
      .eq('student_id', id)
      .single();
    const { data: documents } = await supabase
      .from('student_documents')
      .select('*')
      .eq('student_id', id)
      .single();

    return { ...student, family, medical, history, documents };
  },

  async addStudent(data: any, extra: any, schoolYear: string) {
    const centerId = data.center_id;
    if (centerId) {
      const { data: license, error: licErr } = await supabase
        .from('saas_licenses')
        .select('*, plan:saas_plans(*)')
        .eq('used_by_center', centerId)
        .maybeSingle();

      if (licErr) console.error('Error fetching license in addStudent:', licErr);

      const maxStudents = license?.plan?.max_students;
      if (maxStudents !== undefined && maxStudents !== null) {
        const { count, error: countError } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('center_id', centerId)
          .eq('school_year', schoolYear);

        if (countError) throw countError;

        if (count !== null && count >= maxStudents) {
          throw new Error(
            `Límite de alumnos alcanzado (${maxStudents}). Por favor, actualiza tu plan SaaS.`
          );
        }
      }
    }

    const { data: student, error } = await supabase
      .from('students')
      .insert([{ ...data, school_year: schoolYear, family_id: data.family_id || undefined }])
      .select()
      .single();
    if (error) throw error;

    // Guardar extras
    if (extra?.family?.length > 0) {
      const { error: fErr } = await supabase.from('parents').insert(
        extra.family.map((f: any) => ({
          name: f.name,
          relation: f.role,
          phone: f.phone,
          secondary_phone: f.id_card, // Mapped to avoid DB crash
          occupation: f.occupation,
          student_id: student.id
        }))
      );
      if (fErr) console.error('Error saving parents:', fErr);
    }

    // Attempt to save extra data if tables exist
    try {
      if (extra?.medical)
        await supabase.from('student_medical').upsert({ ...extra.medical, student_id: student.id });
    } catch (e) {}
    try {
      if (extra?.history)
        await supabase.from('student_history').upsert({ ...extra.history, student_id: student.id });
    } catch (e) {}
    try {
      if (extra?.documents)
        await supabase
          .from('student_documents')
          .upsert({ ...extra.documents, student_id: student.id });
    } catch (e) {}

    return student;
  },

  async updateStudent(id: string, data: any, extra: any, schoolYear: string) {
    const { error } = await supabase
      .from('students')
      .update({ ...data, school_year: schoolYear, family_id: data.family_id || undefined })
      .eq('id', id);
    if (error) throw error;

    // Actualizar extras
    if (extra?.family?.length > 0) {
      await supabase.from('parents').delete().eq('student_id', id);
      const { error: fErr } = await supabase.from('parents').insert(
        extra.family.map((f: any) => ({
          name: f.name,
          relation: f.role,
          phone: f.phone,
          secondary_phone: f.id_card, // Mapped to avoid DB crash
          occupation: f.occupation,
          student_id: id
        }))
      );
      if (fErr) console.error('Error updating parents:', fErr);
    }

    try {
      if (extra?.medical)
        await supabase.from('student_medical').upsert({ ...extra.medical, student_id: id });
    } catch (e) {}
    try {
      if (extra?.history)
        await supabase.from('student_history').upsert({ ...extra.history, student_id: id });
    } catch (e) {}
    try {
      if (extra?.documents)
        await supabase.from('student_documents').upsert({ ...extra.documents, student_id: id });
    } catch (e) {}
  },

  async deleteStudent(id: string) {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw error;
  },

  // TAREAS Y COMUNICADOS
  async addTask(data: any) {
    const { error } = await supabase.from('tasks').insert([data]);
    if (error) throw error;
  },

  async addAnnouncement(data: any) {
    const { error } = await supabase.from('announcements').insert([data]);
    if (error) throw error;
  },

  async saveCommunication(data: any) {
    try {
      const { error } = await supabase.from('communications').insert([data]);
      if (error) throw error;
    } catch (err: any) {
      const isMissingTable =
        err.code === '42P01' ||
        err.code === 'PGRST205' ||
        (err.message &&
          err.message.includes('communications') &&
          err.message.includes('schema cache')) ||
        (err.message && err.message.includes('relation "communications" does not exist'));
      if (isMissingTable) {
        console.warn(
          '[dataService] La tabla "communications" no existe. Usando fallback en "announcements".'
        );

        let senderRole = 'admin';
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.sender_id)
            .single();
          if (prof?.role) senderRole = prof.role;
        } catch (e) {}

        const fallbackData = {
          center_id: data.center_id,
          sender_id: data.sender_id,
          sender_role: senderRole,
          title: data.motive || 'Comunicación',
          content: `__COM_DATA__:${JSON.stringify({
            sender_name: data.sender_name,
            motive: data.motive,
            message: data.message,
            target_roles: data.target_roles,
            target_courses: data.target_courses,
            target_teachers: data.target_teachers
          })}`
        };
        const { error: fallbackError } = await supabase
          .from('announcements')
          .insert([fallbackData]);
        if (fallbackError) throw fallbackError;
      } else {
        throw err;
      }
    }
  },

  async getCommunications(userId: string, role: string) {
    let rawComms: any[] = [];
    try {
      const { data, error } = await supabase
        .from('communications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      rawComms = data || [];
    } catch (err: any) {
      const isMissingTable =
        err.code === '42P01' ||
        err.code === 'PGRST205' ||
        (err.message &&
          err.message.includes('communications') &&
          err.message.includes('schema cache')) ||
        (err.message && err.message.includes('relation "communications" does not exist'));
      if (isMissingTable) {
        console.warn(
          '[dataService] La tabla "communications" no existe. Cargando fallback de "announcements".'
        );
        const { data, error: announcementsError } = await supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false });

        if (announcementsError) {
          console.error('[dataService] Error al cargar fallback de anuncios:', announcementsError);
          return [];
        }

        const reconstructed: any[] = [];
        (data || []).forEach((ann: any) => {
          if (ann.content && ann.content.startsWith('__COM_DATA__:')) {
            try {
              const rawJson = ann.content.substring('__COM_DATA__:'.length);
              const payload = JSON.parse(rawJson);
              reconstructed.push({
                id: ann.id,
                center_id: ann.center_id,
                sender_id: ann.sender_id,
                sender_name: payload.sender_name,
                motive: payload.motive,
                message: payload.message,
                target_roles: payload.target_roles,
                target_courses: payload.target_courses,
                target_teachers: payload.target_teachers,
                created_at: ann.created_at
              });
            } catch (jsonErr) {
              console.error('[dataService] Error al parsear anuncio de fallback:', jsonErr);
            }
          }
        });
        rawComms = reconstructed;
      } else {
        console.error('[dataService] Error cargando comunicaciones:', err);
        return [];
      }
    }

    if (role === 'admin' || role === 'coordinator') {
      return rawComms;
    }

    if (role === 'teacher') {
      let teacherCourseIds: string[] = [];
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('teacher_id')
          .eq('id', userId)
          .single();

        const tId = prof?.teacher_id || userId;

        const [assigns, scheds] = await Promise.all([
          supabase.from('assignments').select('course_id').eq('teacher_id', tId),
          supabase.from('schedule_entries').select('course_id').eq('teacher_id', tId)
        ]);

        const ids = new Set<string>();
        (assigns.data || []).forEach((a) => { if (a.course_id) ids.add(a.course_id); });
        (scheds.data || []).forEach((s) => { if (s.course_id) ids.add(s.course_id); });
        teacherCourseIds = Array.from(ids);
      } catch (err) {
        console.error('Error fetching teacher courses for communications:', err);
      }

      return rawComms.filter(
        (c: any) =>
          c.sender_id === userId ||
          (c.target_roles || []).includes('Docentes') ||
          (c.target_teachers || []).includes(userId) ||
          (c.target_roles || []).includes('Toda la comunidad') ||
          (c.target_courses || []).some((courseId: string) => teacherCourseIds.includes(courseId))
      );
    }

    return rawComms.filter(
      (c: any) =>
        (c.target_roles || []).includes('Alumnos') ||
        (c.target_roles || []).includes('Padres') ||
        (c.target_roles || []).includes('Toda la comunidad')
    );
  },

  async deleteCommunication(id: string) {
    try {
      const { error } = await supabase.from('communications').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      const isMissingTable =
        err.code === '42P01' ||
        err.code === 'PGRST205' ||
        (err.message &&
          err.message.includes('communications') &&
          err.message.includes('schema cache')) ||
        (err.message && err.message.includes('relation "communications" does not exist'));
      if (isMissingTable) {
        // Fallback: delete from announcements
        const { error: fallbackError } = await supabase.from('announcements').delete().eq('id', id);
        if (fallbackError) throw fallbackError;
      } else {
        throw err;
      }
    }
  },

  async getTasks(courseId: string) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('course_id', courseId)
      .order('due_date', { ascending: true });
    if (error) {
      console.error('Error getting tasks:', error);
      return [];
    }
    return data || [];
  },

  async getAnnouncements(courseId: string) {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .or(`course_id.eq.${courseId},course_id.eq.all`)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error getting announcements:', error);
      return [];
    }
    return (data || []).filter((ann: any) => !ann.content?.startsWith('__COM_DATA__:'));
  },

  async getAttendance() {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async saveAttendance(record: any) {
    const { data, error } = await supabase
      .from('attendance_records')
      .insert([record])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async registerSchoolSaas(name: string, licenseKey: string, district?: string, regional?: string) {
    const { data, error } = await supabase.rpc('register_school_saas', {
      p_name: name,
      p_license_key: licenseKey,
      p_district: district || null,
      p_regional: regional || null
    });
    if (error) throw error;
    return data;
  },

  async importCompleteCenter(
    centerId: string,
    schoolYear: string,
    data: {
      center?: any;
      courses: any[];
      subjects: any[];
      staff: any[];
      students: any[];
      assignments: any[];
    }
  ) {
    // 1. Centro (Si viene en el Excel)
    if (data.center) {
      const { error } = await supabase.from('centers').update(data.center).eq('id', centerId);
      if (error) throw error;
    }

    // 2. Cursos
    const { data: existingCourses } = await supabase
      .from('courses')
      .select('*')
      .eq('center_id', centerId)
      .eq('school_year', schoolYear);

    const courseMap = new Map<string, string>(); // 'nivel_grado_seccion_tanda' -> UUID
    const courseMapFallback = new Map<string, string>(); // 'nivel_grado_seccion' -> UUID

    for (const c of data.courses) {
      const normGrade = normalizeGrade(c.grade);
      const key = `${c.level}_${normGrade}_${c.section}_${c.shift || 'Matutina'}`.toLowerCase().trim();
      const fallbackKey = `${c.level}_${normGrade}_${c.section}`.toLowerCase().trim();
      let match = (existingCourses || []).find(
        (ec: any) => `${ec.level}_${normalizeGrade(ec.grade)}_${ec.section}_${ec.tanda || 'Matutina'}`.toLowerCase().trim() === key
      );

      // Fallback: Si no hay coincidencia exacta con tanda, verificar si existe exactamente un curso en la BD con ese nivel, grado y sección
      if (!match) {
        const baseMatches = (existingCourses || []).filter(
          (ec: any) => `${ec.level}_${normalizeGrade(ec.grade)}_${ec.section}`.toLowerCase().trim() === fallbackKey
        );
        if (baseMatches.length === 1) {
          match = baseMatches[0];
        }
      }

      let courseId = '';
      if (match) {
        courseId = match.id;
        const { error } = await supabase
          .from('courses')
          .update({
            tanda: c.shift || match.tanda
          })
          .eq('id', courseId);
        if (error) throw error;
      } else {
        const { data: newCourse, error } = await supabase
          .from('courses')
          .insert({
            center_id: centerId,
            school_year: schoolYear,
            level: c.level,
            grade: c.grade,
            section: c.section,
            tanda: c.shift || 'Matutina'
          })
          .select()
          .single();
        if (error) throw error;
        courseId = newCourse.id;
      }
      courseMap.set(key, courseId);
      courseMapFallback.set(fallbackKey, courseId);
    }

    // 3. Materias
    const { data: existingSubjects } = await supabase
      .from('subjects')
      .select('*')
      .eq('center_id', centerId);

    const subjectMap = new Map<string, string>(); // 'nombre_nivel' -> UUID

    for (const s of data.subjects) {
      const key = `${s.name}_${s.level}`.toLowerCase().trim();
      const match = (existingSubjects || []).find(
        (es: any) => `${es.name}_${es.level}`.toLowerCase().trim() === key
      );

      let subjectId = '';
      if (match) {
        subjectId = match.id;
        const { error } = await supabase
          .from('subjects')
          .update({
            area: s.area || match.area,
            hours_per_week: s.weekly_hours || match.hours_per_week
          })
          .eq('id', subjectId);
        if (error) throw error;
      } else {
        const { data: newSubject, error } = await supabase
          .from('subjects')
          .insert({
            center_id: centerId,
            name: s.name,
            level: s.level,
            area: s.area || 'General',
            hours_per_week: s.weekly_hours || 4
          })
          .select()
          .single();
        if (error) throw error;
        subjectId = newSubject.id;
      }
      subjectMap.set(key, subjectId);
    }

    // 4. Personal (Staff y Teachers)
    const { data: existingStaff } = await supabase
      .from('staff')
      .select('*')
      .eq('center_id', centerId);

    const staffMap = new Map<string, string>(); // 'nombre_completo' -> UUID

    for (const p of data.staff) {
      if (!p.name || !p.name.trim()) continue;
      const nameKey = p.name.toLowerCase().trim();
      const match = (existingStaff || []).find(
        (es: any) =>
          (es.full_name || es.name || '').toLowerCase().trim() === nameKey ||
          (p.email && es.email && es.email.toLowerCase().trim() === p.email.toLowerCase().trim())
      );

      let staffId = '';
      const teamVal = p.team || 'teacher';
      const staffPayload = {
        center_id: centerId,
        name: p.name,
        full_name: p.name,
        team: teamVal,
        position: p.position || (teamVal === 'teacher' ? 'Docente' : 'Personal'),
        sex: p.sex || 'M',
        phone: p.phone || null,
        email: p.email || null,
        grades_editable: true
      };

      if (match) {
        staffId = match.id;
        const { error } = await supabase.from('staff').update(staffPayload).eq('id', staffId);
        if (error) throw error;
      } else {
        const { data: newStaff, error } = await supabase
          .from('staff')
          .insert(staffPayload)
          .select()
          .single();
        if (error) throw error;
        staffId = newStaff.id;
      }
      staffMap.set(nameKey, staffId);

      // Si es rol de docente, asegurar también su registro en la tabla 'teachers' para planificación de horarios
      if (teamVal === 'teacher' || teamVal === 'management_teacher') {
        const { error: tErr } = await supabase.from('teachers').upsert({
          id: staffId,
          center_id: centerId,
          name: p.name,
          hours_available: 40,
          area: p.position || 'General'
        });
        if (tErr) console.error('Error insertando en tabla teachers:', tErr);
      }
    }

    // 5. Alumnos y Tutores
    const { data: existingStudents } = await supabase
      .from('students')
      .select('*')
      .eq('center_id', centerId);

    for (const s of data.students) {
      const normGrade = normalizeGrade(s.grade_course);
      const courseKey = `${s.level_course || ''}_${normGrade}_${s.seccion_course || ''}_${s.tanda_course || 'Matutina'}`
        .toLowerCase()
        .trim();
      const fallbackKey = `${s.level_course || ''}_${normGrade}_${s.seccion_course || ''}`
        .toLowerCase()
        .trim();
      const courseId = courseMap.get(courseKey) || courseMapFallback.get(fallbackKey) || null;

      const studentNameKey = `${s.first_surname || ''} ${s.second_surname || ''} ${s.names || ''}`
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
      const match = (existingStudents || []).find((es: any) => {
        const dbName =
          `${es.first_surname || es.last_name || ''} ${es.second_surname || ''} ${es.names || es.first_name || ''}`
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
        return dbName === studentNameKey || (s.sigerd_code && es.sigerd_code === s.sigerd_code);
      });

      const studentPayload = {
        center_id: centerId,
        school_year: schoolYear,
        names: s.names,
        first_name: s.names,
        first_surname: s.first_surname,
        last_name: s.first_surname,
        second_surname: s.second_surname || null,
        sex: s.sex || 'M',
        birth_date: s.birth_date || null,
        address: s.address_street ? `${s.address_street}, ${s.address_sector || ''}` : null,
        address_street: s.address_street || null,
        address_sector: s.address_sector || null,
        sigerd_code: s.sigerd_code || null,
        course_id: courseId,
        status: 'Active'
      };

      let studentId = '';
      if (match) {
        studentId = match.id;
        const { error } = await supabase
          .from('students')
          .update(studentPayload)
          .eq('id', studentId);
        if (error) throw error;
      } else {
        const { data: newStudent, error } = await supabase
          .from('students')
          .insert(studentPayload)
          .select()
          .single();
        if (error) throw error;
        studentId = newStudent.id;
      }

      // Si viene información de tutor, upsert en la tabla 'parents'
      if (s.tutor_name) {
        const tutorPayload = {
          center_id: centerId,
          student_id: studentId,
          name: s.tutor_name,
          relation: s.tutor_parentesco || 'Tutor',
          phone: s.tutor_telefono || null
        };

        // Buscar tutor existente para este estudiante
        const { data: existingTutors } = await supabase
          .from('parents')
          .select('id')
          .eq('student_id', studentId);
        if (existingTutors && existingTutors.length > 0) {
          const { error: pErr } = await supabase
            .from('parents')
            .update(tutorPayload)
            .eq('id', existingTutors[0].id);
          if (pErr) console.error('Error actualizando tutor:', pErr);
        } else {
          const { error: pErr } = await supabase.from('parents').insert(tutorPayload);
          if (pErr) console.error('Error guardando tutor:', pErr);
        }
      }
    }

    // 6. Asignaciones (Limpieza e Inserción)
    // Borrar asignaciones existentes para evitar duplicados al re-subir
    await supabase.from('assignments').delete().eq('center_id', centerId);

    for (const a of data.assignments) {
      if (!a.docente || !a.materia) continue;
      const docKey = a.docente.toLowerCase().trim();
      const subKey = `${a.materia}_${a.nivel || ''}`.toLowerCase().trim();
      const normGrade = normalizeGrade(a.grade);
      const courseKey = `${a.nivel || ''}_${normGrade}_${a.section || ''}_${a.tanda || 'Matutina'}`.toLowerCase().trim();
      const fallbackKey = `${a.nivel || ''}_${normGrade}_${a.section || ''}`.toLowerCase().trim();

      const teacherId = staffMap.get(docKey);
      const subjectId = subjectMap.get(subKey);
      const courseId = courseMap.get(courseKey) || courseMapFallback.get(fallbackKey);

      // Si alguno no se encuentra, se omite de forma flexible de acuerdo con la decisión de diseño
      if (!teacherId || !subjectId || !courseId) {
        console.warn(
          `Omitiendo asignación inválida: docente=${a.docente}, materia=${a.materia}, curso=${a.grade} ${a.section}`
        );
        continue;
      }

      const { error: aErr } = await supabase.from('assignments').insert({
        center_id: centerId,
        course_id: courseId,
        subject_id: subjectId,
        teacher_id: teacherId,
        hours_per_week: a.hours_per_week || 4
      });
      if (aErr) console.error('Error insertando asignación:', aErr);
    }
  },

  async cloneSchoolYear(
    centerId: string,
    sourceYear: string,
    targetYear: string,
    courseIds: string[],
    cloneAssignments: boolean
  ) {
    const { data: sourceCourses, error: cErr } = await supabase
      .from('courses')
      .select('*')
      .eq('center_id', centerId)
      .eq('school_year', sourceYear)
      .in('id', courseIds);

    if (cErr) throw cErr;
    if (!sourceCourses || sourceCourses.length === 0) {
      throw new Error('No se encontraron cursos de origen seleccionados.');
    }

    const { data: targetCourses, error: tcErr } = await supabase
      .from('courses')
      .select('*')
      .eq('center_id', centerId)
      .eq('school_year', targetYear);

    if (tcErr) throw tcErr;

    const courseMap = new Map<string, string>();

    for (const sc of sourceCourses) {
      const match = (targetCourses || []).find(
        (tc: any) =>
          tc.level?.toLowerCase().trim() === sc.level?.toLowerCase().trim() &&
          tc.grade?.toLowerCase().trim() === sc.grade?.toLowerCase().trim() &&
          tc.section?.toLowerCase().trim() === sc.section?.toLowerCase().trim()
      );

      if (match) {
        courseMap.set(sc.id, match.id);
      } else {
        const { data: newCourse, error: insErr } = await supabase
          .from('courses')
          .insert({
            center_id: centerId,
            school_year: targetYear,
            level: sc.level,
            grade: sc.grade,
            section: sc.section,
            tanda: sc.tanda || 'Matutina'
          })
          .select()
          .single();

        if (insErr) throw insErr;
        courseMap.set(sc.id, newCourse.id);
      }
    }

    if (cloneAssignments) {
      const { data: sourceAssignments, error: aErr } = await supabase
        .from('assignments')
        .select('*')
        .eq('center_id', centerId)
        .in('course_id', courseIds);

      if (aErr) throw aErr;

      const targetCourseIds = Array.from(courseMap.values());
      const { data: targetAssignments, error: taErr } = await supabase
        .from('assignments')
        .select('*')
        .eq('center_id', centerId)
        .in('course_id', targetCourseIds);

      if (taErr) throw taErr;

      for (const sa of sourceAssignments || []) {
        const newCourseId = courseMap.get(sa.course_id);
        if (!newCourseId) continue;

        const exists = (targetAssignments || []).some(
          (ta: any) =>
            ta.course_id === newCourseId &&
            ta.subject_id === sa.subject_id &&
            ta.teacher_id === sa.teacher_id
        );

        if (!exists) {
          const { error: insAErr } = await supabase.from('assignments').insert({
            center_id: centerId,
            course_id: newCourseId,
            subject_id: sa.subject_id,
            teacher_id: sa.teacher_id,
            hours_per_week: sa.hours_per_week
          });
          if (insAErr) console.error('Error clonando asignación:', insAErr);
        }
      }
    }
  },

  async promoteStudent(studentId: string, targetYear: string, targetCourseId: string) {
    // 1. Obtener la ficha del estudiante origen
    const { data: sourceStudent, error: sErr } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single();
    if (sErr) throw sErr;

    // 2. Verificar si ya existe inscripción para este estudiante en el año destino
    let existingEnrollment: any = null;

    if (sourceStudent.student_code && sourceStudent.student_code.trim() !== '') {
      const { data } = await supabase
        .from('students')
        .select('id')
        .eq('student_code', sourceStudent.student_code)
        .eq('school_year', targetYear)
        .maybeSingle();
      existingEnrollment = data;
    }

    if (!existingEnrollment) {
      // Fallback: buscar por nombres, primer apellido y año destino
      const { data } = await supabase
        .from('students')
        .select('id')
        .eq('names', sourceStudent.names)
        .eq('first_surname', sourceStudent.first_surname)
        .eq('school_year', targetYear)
        .maybeSingle();
      existingEnrollment = data;
    }

    if (existingEnrollment) {
      // Si ya está registrado en el nuevo ciclo, solo actualizamos el curso destino
      const { error: updErr } = await supabase
        .from('students')
        .update({
          course_id: targetCourseId,
          status: 'Active'
        })
        .eq('id', existingEnrollment.id);
      if (updErr) throw updErr;
      return existingEnrollment.id;
    }

    // 3. Crear una nueva inscripción duplicando los datos demográficos
    const { id, created_at, ...studentData } = sourceStudent;
    const { data: newStudent, error: insErr } = await supabase
      .from('students')
      .insert({
        ...studentData,
        school_year: targetYear,
        course_id: targetCourseId,
        status: 'Active'
      })
      .select()
      .single();

    if (insErr) throw insErr;
    const newStudentId = newStudent.id;

    // 4. Duplicar Tutores / Padres asociados
    const { data: sourceParents } = await supabase
      .from('parents')
      .select('*')
      .eq('student_id', studentId);

    if (sourceParents && sourceParents.length > 0) {
      const parentsInsert = sourceParents.map((p: any) => {
        const { id: _, created_at: __, ...pData } = p;
        return {
          ...pData,
          student_id: newStudentId
        };
      });
      const { error: pInsErr } = await supabase.from('parents').insert(parentsInsert);
      if (pInsErr) console.error('Error duplicando tutores:', pInsErr);
    }

    // 5. Duplicar Ficha Médica
    try {
      const { data: sourceMedical } = await supabase
        .from('student_medical')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();

      if (sourceMedical) {
        const { id: _, created_at: __, ...mData } = sourceMedical;
        await supabase.from('student_medical').insert({
          ...mData,
          student_id: newStudentId
        });
      }
    } catch (e) {
      console.error('Error al duplicar ficha médica:', e);
    }

    // 6. Duplicar Historial
    try {
      const { data: sourceHistory } = await supabase
        .from('student_history')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();

      if (sourceHistory) {
        const { id: _, created_at: __, ...hData } = sourceHistory;
        await supabase.from('student_history').insert({
          ...hData,
          student_id: newStudentId
        });
      }
    } catch (e) {
      console.error('Error al duplicar historial:', e);
    }

    // 7. Duplicar Documentos
    try {
      const { data: sourceDocs } = await supabase
        .from('student_documents')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();

      if (sourceDocs) {
        const { id: _, created_at: __, ...dData } = sourceDocs;
        await supabase.from('student_documents').insert({
          ...dData,
          student_id: newStudentId
        });
      }
    } catch (e) {
      console.error('Error al duplicar documentos:', e);
    }

    return newStudentId;
  }
};
