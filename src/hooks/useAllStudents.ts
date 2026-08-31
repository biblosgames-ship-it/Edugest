import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabase, useApp } from '../context/AppContext';

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
          .select('id, school_year')
          .eq('center_id', centerId)
          .range(0, 9999)
      ]);

      if (studRes.error) {
        console.error('Error fetching all students:', studRes.error);
        return [];
      }

      const raw = studRes.data || [];
      const rawCourses = coursesRes.data || [];

      const activeCourseIds = new Set(
        rawCourses
          .filter((c: any) => !c.school_year || c.school_year === targetYear || c.school_year === 'undefined' || c.school_year === 'null')
          .map((c: any) => String(c.id))
      );

      return raw.filter((s: any) => {
        const st = (s.status || '').toLowerCase().trim();
        if (st === 'retirado' || st === 'inactivo' || st === 'graduado' || st === 'egresado' || st === 'expulsado') {
          return false;
        }
        if (s.course_id && activeCourseIds.has(String(s.course_id))) return true;
        if (!s.course_id && (s.school_year === targetYear || !s.school_year || s.school_year === 'undefined' || s.school_year === 'null')) {
          return true;
        }
        return false;
      });
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
