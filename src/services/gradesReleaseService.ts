import { supabase } from '../lib/supabase';

export interface GradesReleaseStatus {
  student_id: string;
  is_released: boolean;
  school_year: string;
}

const LOCAL_STORAGE_PREFIX = 'portal_grades_released_';

export const gradesReleaseService = {
  /**
   * Obtiene el mapa de alumnos liberados { [studentId]: true/false }
   */
  async getReleasedMap(
    centerId: string,
    schoolYear: string = '2026-2027'
  ): Promise<Record<string, boolean>> {
    const map: Record<string, boolean> = {};

    // 1. Cargar desde localStorage para disponibilidad inmediata/offline
    try {
      const local = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${centerId}_${schoolYear}`);
      if (local) {
        const parsed = JSON.parse(local);
        Object.assign(map, parsed);
      }
    } catch (e) {
      console.warn('[gradesReleaseService] Error leyendo localStorage:', e);
    }

    if (!centerId) return map;

    // 2. Cargar desde la tabla student_portal_releases
    try {
      const { data: releases, error: relErr } = await supabase
        .from('student_portal_releases')
        .select('student_id, is_released')
        .eq('center_id', centerId)
        .eq('school_year', schoolYear);

      if (!relErr && releases) {
        releases.forEach((r: any) => {
          if (r.student_id) {
            map[r.student_id] = !!r.is_released;
          }
        });
      }
    } catch (err) {
      console.warn('[gradesReleaseService] student_portal_releases no disponible aún en BD:', err);
    }

    // 3. Consultar columna grades_released en students como alternativa directa
    try {
      const { data: students, error: studErr } = await supabase
        .from('students')
        .select('id, grades_released')
        .eq('center_id', centerId);

      if (!studErr && students) {
        students.forEach((s: any) => {
          if (s.grades_released !== undefined && s.grades_released !== null) {
            // Si ya estaba explícitamente en student_portal_releases, se respeta ese
            if (map[s.id] === undefined) {
              map[s.id] = !!s.grades_released;
            }
          }
        });
      }
    } catch (err) {
      // Ignorar si la columna no existe todavía
    }

    // Guardar copia local sincronizada
    try {
      localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${centerId}_${schoolYear}`, JSON.stringify(map));
    } catch {}

    return map;
  },

  /**
   * Guarda o actualiza masivamente el estado de liberación de calificaciones
   */
  async saveReleasedMap(
    centerId: string,
    schoolYear: string = '2026-2027',
    releasedMap: Record<string, boolean>
  ): Promise<{ success: boolean; count: number }> {
    // 1. Guardar de inmediato en localStorage para respuesta instantánea en UI
    try {
      localStorage.setItem(
        `${LOCAL_STORAGE_PREFIX}${centerId}_${schoolYear}`,
        JSON.stringify(releasedMap)
      );
    } catch (e) {
      console.warn('[gradesReleaseService] Error guardando en localStorage:', e);
    }

    // Notificar a todos los componentes que las liberaciones cambiaron
    window.dispatchEvent(
      new CustomEvent('gradesReleaseChanged', {
        detail: { centerId, schoolYear, releasedMap }
      })
    );

    let count = 0;
    const entries = Object.entries(releasedMap);

    // 2. Intentar guardar en student_portal_releases
    try {
      const upsertRows = entries.map(([studentId, isReleased]) => ({
        center_id: centerId,
        student_id: studentId,
        school_year: schoolYear,
        is_released: isReleased,
        updated_at: new Date().toISOString()
      }));

      if (upsertRows.length > 0) {
        const { error: upsertErr } = await supabase
          .from('student_portal_releases')
          .upsert(upsertRows, { onConflict: 'student_id,school_year' });

        if (!upsertErr) {
          count = upsertRows.length;
        }
      }
    } catch (err) {
      console.warn('[gradesReleaseService] student_portal_releases upsert falló, intentando actualizar students:', err);
    }

    // 3. Actualizar también la columna grades_released en students
    try {
      const trueIds = entries.filter(([_, isRel]) => isRel).map(([id]) => id);
      const falseIds = entries.filter(([_, isRel]) => !isRel).map(([id]) => id);

      if (trueIds.length > 0) {
        await supabase
          .from('students')
          .update({ grades_released: true })
          .in('id', trueIds);
      }
      if (falseIds.length > 0) {
        await supabase
          .from('students')
          .update({ grades_released: false })
          .in('id', falseIds);
      }
      if (count === 0) {
        count = trueIds.length + falseIds.length;
      }
    } catch (err) {
      // Ignorar si la columna aún no está en Supabase
    }

    return { success: true, count };
  },

  /**
   * Verifica si un alumno específico tiene las calificaciones liberadas
   */
  async isStudentGradesReleased(
    studentId: string,
    centerId: string,
    schoolYear: string = '2026-2027'
  ): Promise<boolean> {
    if (!studentId) return false;

    // 1. Revisar caché local primero
    try {
      const local = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${centerId}_${schoolYear}`);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed[studentId] !== undefined) {
          return !!parsed[studentId];
        }
      }
    } catch {}

    // 2. Consultar student_portal_releases
    try {
      const { data, error } = await supabase
        .from('student_portal_releases')
        .select('is_released')
        .eq('student_id', studentId)
        .eq('school_year', schoolYear)
        .maybeSingle();

      if (!error && data) {
        return !!data.is_released;
      }
    } catch {}

    // 3. Consultar columna grades_released en students
    try {
      const { data, error } = await supabase
        .from('students')
        .select('grades_released')
        .eq('id', studentId)
        .maybeSingle();

      if (!error && data && data.grades_released !== undefined) {
        return !!data.grades_released;
      }
    } catch {}

    return false;
  }
};
