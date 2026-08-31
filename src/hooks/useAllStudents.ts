import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabase, useApp } from '../context/AppContext';
import officialRosterData from '../data/official_2026_students.json';

export const useAllStudents = () => {
  const { profile } = useSupabase();
  const { selectedYear, state } = useApp();
  const queryClient = useQueryClient();
  const centerId = profile?.center_id;

  return useQuery({
    queryKey: ['all-students', centerId, selectedYear, state.courses?.length],
    queryFn: async () => {
      if (!centerId) return [];

      const targetYear = selectedYear || '2026-2027';
      const [studRes, coursesRes] = await Promise.all([
        supabase
          .from('students')
          .select('*')
          .eq('center_id', centerId)
          .range(0, 9999)
          .order('first_surname', { ascending: true }),
        supabase
          .from('courses')
          .select('id, school_year, level, grade, section')
          .eq('center_id', centerId)
          .range(0, 9999)
      ]);

      if (studRes.error) {
        console.error('Error fetching all students:', studRes.error);
        return [];
      }

      const raw = studRes.data || [];
      const rawCourses = coursesRes.data || [];

      const activeCourses = rawCourses.filter((c: any) => c.school_year === targetYear);
      const finalActiveCourses = activeCourses.length > 0 ? activeCourses : rawCourses.filter((c: any) => c.school_year === targetYear);
      const activeCourseIds = new Set(finalActiveCourses.map((c: any) => String(c.id)));

      const normStr = (str: string) => (str || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const canonicalCourseMap = new Map<string, string>();
      rawCourses.forEach((c: any) => {
        const key = `${normStr(c.level)}_${normStr(c.grade)}_${normStr(c.section)}`.replace(/primaria|secundaria|inicial/g, '').trim();
        const activeMatch = finalActiveCourses.find((ac: any) => {
          const acKey = `${normStr(ac.level)}_${normStr(ac.grade)}_${normStr(ac.section)}`.replace(/primaria|secundaria|inicial/g, '').trim();
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
        return (
          officialSet.has(key) ||
          (officialRosterData as string[]).some(
            (item) =>
              key === item ||
              (key.length > 8 && item.includes(key)) ||
              (item.length > 8 && key.includes(item))
          )
        );
      };

      const seenIdentities = new Set<string>();
      const unified: any[] = [];

      if (targetYear === '2026-2027') {
        raw.forEach((s: any) => {
          const st = (s.status || '').toLowerCase().trim();
          if (st === 'retirado' || st === 'inactivo' || st === 'graduado' || st === 'egresado' || st === 'expulsado') return;

          const key = normIdentity(s);
          if (isOfficial2026Student(s)) {
            if (key && !seenIdentities.has(key)) {
              seenIdentities.add(key);
              const targetCid = s.course_id && canonicalCourseMap.has(String(s.course_id))
                ? canonicalCourseMap.get(String(s.course_id))!
                : s.course_id;

              s.course_id = targetCid;
              s.school_year = targetYear;
              unified.push(s);
            }
          }
        });
      } else {
        raw.forEach((s: any) => {
          const st = (s.status || '').toLowerCase().trim();
          if (st === 'retirado' || st === 'inactivo' || st === 'graduado' || st === 'egresado' || st === 'expulsado') return;

          const key = normIdentity(s);
          if (!isOfficial2026Student(s) || s.school_year === targetYear) {
            if (key && !seenIdentities.has(key)) {
              seenIdentities.add(key);
              unified.push(s);
            }
          }
        });
      }

      return unified;
    },
    staleTime: 1000 * 60 * 5 // 5 minutos de cache
  });
};

export const useStudentMutations = () => {
  const queryClient = useQueryClient();

  const updateOrder = useMutation({
    mutationFn: async ({ id, order_number }: { id: string; order_number: number | null }) => {
      const { error } = await supabase.from('students').update({ order_number }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-students'] });
    }
  });

  const deleteStudent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-students'] });
      queryClient.invalidateQueries({ queryKey: ['center-stats'] });
    }
  });

  return { updateOrder, deleteStudent };
};
