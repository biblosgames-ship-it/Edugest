import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabase, useApp } from '../context/AppContext';
import officialRosterData from '../data/official_2026_students.json';

export const useStudents = () => {
  const { profile } = useSupabase();
  const { selectedYear } = useApp();
  const queryClient = useQueryClient();
  const centerId = profile?.center_id;
  const schoolYear = selectedYear || '2026-2027';

  const query = useQuery({
    queryKey: ['students', centerId, schoolYear],
    queryFn: async () => {
      if (!centerId) return [];
      const [studRes, coursesRes] = await Promise.all([
        supabase
          .from('students')
          .select('*')
          .eq('center_id', centerId)
          .range(0, 9999)
          .order('order_number', { ascending: true })
          .order('last_name', { ascending: true }),
        supabase
          .from('courses')
          .select('id, school_year, level, grade, section')
          .eq('center_id', centerId)
          .range(0, 9999)
      ]);

      if (studRes.error) throw studRes.error;
      const raw = studRes.data || [];
      const rawCourses = coursesRes.data || [];

      const activeCourses = rawCourses.filter((c: any) => c.school_year === schoolYear);
      const finalActiveCourses = activeCourses.length > 0 ? activeCourses : rawCourses.filter((c: any) => c.school_year === schoolYear);
      const activeCourseIds = new Set(finalActiveCourses.map((c: any) => String(c.id)));

      const normStr = (str: string) => (str || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const canonicalCourseMap = new Map<string, string>();
      rawCourses.forEach((c: any) => {
        const tandaStr = normStr(c.tanda || 'matutina');
        const key = `${normStr(c.level)}_${normStr(c.grade)}_${normStr(c.section)}_${tandaStr}`.replace(/primaria|secundaria|inicial/g, '').trim();
        const activeMatch = finalActiveCourses.find((ac: any) => {
          const acTanda = normStr(ac.tanda || 'matutina');
          const acKey = `${normStr(ac.level)}_${normStr(ac.grade)}_${normStr(ac.section)}_${acTanda}`.replace(/primaria|secundaria|inicial/g, '').trim();
          return acKey === key;
        });
        if (activeMatch) {
          canonicalCourseMap.set(String(c.id), String(activeMatch.id));
        }
      });

      const normIdentity = (s: any) =>
        `${s.first_surname || s.last_name || ''} ${s.second_surname || ''} ${s.names || s.first_name || ''}`
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Z0-9]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      const officialSet = new Set(officialRosterData as string[]);
      const isOfficial2026Student = (s: any) => {
        const key = normIdentity(s);
        if (officialSet.has(key)) return true;
        return (officialRosterData as string[]).some(
          (item: string) =>
            item === key ||
            (item.length > 12 && key.length > 12 && (item.includes(key) || key.includes(item)))
        );
      };

      const isNewlyEnrolled2026 = (s: any) => {
        return s.school_year === '2026-2027' && s.course_id && activeCourseIds.has(String(s.course_id));
      };

      const seenIdentities = new Set<string>();
      const unified: any[] = [];

      if (schoolYear === '2026-2027') {
        raw.forEach((s: any) => {
          const st = (s.status || '').toLowerCase().trim();
          if (st === 'retirado' || st === 'inactivo' || st === 'graduado' || st === 'egresado' || st === 'expulsado') return;

          const key = normIdentity(s);
          if (isOfficial2026Student(s) || isNewlyEnrolled2026(s)) {
            if (key && !seenIdentities.has(key)) {
              seenIdentities.add(key);
              const targetCid = s.course_id && canonicalCourseMap.has(String(s.course_id))
                ? canonicalCourseMap.get(String(s.course_id))!
                : s.course_id;

              s.course_id = targetCid;
              s.school_year = schoolYear;
              unified.push(s);
            }
          }
        });
      } else {
        // Ciclo 2025-2026: mostrar los más de 540 alumnos históricos reales
        raw.forEach((s: any) => {
          const st = (s.status || '').toLowerCase().trim();
          if (st === 'retirado' || st === 'inactivo' || st === 'graduado' || st === 'egresado' || st === 'expulsado') return;

          const key = normIdentity(s);
          if (s.school_year === '2025-2026' || !s.school_year || s.school_year === '' || !isNewlyEnrolled2026(s)) {
            if (key && !seenIdentities.has(key)) {
              seenIdentities.add(key);
              unified.push(s);
            }
          }
        });
      }

      return unified;
    },
    staleTime: 1000 * 5 // 5 segundos de caché para reflejar cambios de inmediato
  });

  const addStudentMutation = useMutation({
    mutationFn: async (newStudent: any) => {
      const { error } = await supabase.from('students').insert([
        {
          ...newStudent,
          center_id: centerId,
          school_year: schoolYear
        }
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', centerId, schoolYear] });
      queryClient.invalidateQueries({ queryKey: ['center-stats', centerId] });
    }
  });

  const updateStudentMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase.from('students').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', centerId, schoolYear] });
    }
  });

  const deleteStudentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', centerId, schoolYear] });
      queryClient.invalidateQueries({ queryKey: ['center-stats', centerId] });
    }
  });

  return {
    students: query.data || [],
    isLoading: query.isLoading,
    addStudent: addStudentMutation.mutateAsync,
    updateStudent: updateStudentMutation.mutateAsync,
    deleteStudent: deleteStudentMutation.mutateAsync
  };
};
