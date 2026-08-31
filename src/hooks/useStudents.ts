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
        const k1 = normIdentity(s);
        if (officialSet.has(k1)) return true;
        const k2 = normIdentity({
          first_surname: s.names || s.first_name,
          second_surname: '',
          names: `${s.first_surname || s.last_name || ''} ${s.second_surname || ''}`
        });
        if (officialSet.has(k2)) return true;

        return (officialRosterData as string[]).some(
          (item: string) =>
            item === k1 ||
            item === k2 ||
            (item.length > 10 && k1.length > 10 && (item.includes(k1) || k1.includes(item)))
        );
      };

      const seenIdentities = new Set<string>();
      const unified: any[] = [];

      if (schoolYear === '2026-2027') {
        raw.forEach((s: any) => {
          const st = (s.status || '').toLowerCase().trim();
          if (st === 'retirado' || st === 'inactivo' || st === 'graduado' || st === 'egresado' || st === 'expulsado') return;

          const key = normIdentity(s);
          if (isOfficial2026Student(s) || s.school_year === '2026-2027' || (s.course_id && activeCourseIds.has(String(s.course_id)))) {
            if (key && !seenIdentities.has(key)) {
              seenIdentities.add(key);
              
              let targetCid = s.course_id;

              const isVespShift = (s.shift || '').toLowerCase().includes('vesp') || (s.shift || '').toLowerCase().includes('tard');
              if (s.course_id === '8400e2af-1124-421c-8ad3-f35e96c49525' || (isVespShift && (s.course_id === '73f8f202-f31f-465b-b1ef-6028b89ae271' || s.course_id === '7291214b-2cf8-4064-b232-42ad86c8c570' || s.course_id === 'beff5a14-a3d7-4249-bff4-5b3b843adc36'))) {
                targetCid = '8400e2af-1124-421c-8ad3-f35e96c49525';
              } else if (s.course_id && activeCourseIds.has(String(s.course_id))) {
                targetCid = s.course_id;
              } else if (s.course_id && canonicalCourseMap.has(String(s.course_id))) {
                targetCid = canonicalCourseMap.get(String(s.course_id))!;
              }

              s.course_id = targetCid;
              s.school_year = schoolYear;
              unified.push(s);
            }
          }
        });
      } else {
        // Ciclo 2025-2026: mostrar los 540+ alumnos históricos reales
        raw.forEach((s: any) => {
          const st = (s.status || '').toLowerCase().trim();
          if (st === 'retirado' || st === 'inactivo' || st === 'graduado' || st === 'egresado' || st === 'expulsado') return;

          const key = normIdentity(s);
          if (key && !seenIdentities.has(key)) {
            seenIdentities.add(key);
            unified.push(s);
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
