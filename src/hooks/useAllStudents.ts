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

      let query = supabase
        .from('students')
        .select('*')
        .eq('center_id', centerId);

      const targetYear = selectedYear || '2026-2027';
      if (targetYear) {
        query = query.or(`school_year.eq.${targetYear},school_year.is.null,school_year.eq.""`);
      }

      const { data, error } = await query.order('first_surname', { ascending: true });

      if (error) {
        console.error('Error fetching all students:', error);
        return [];
      }

      const raw = data || [];
      const yearSpecific = raw.filter((s: any) => s.school_year === targetYear);
      return yearSpecific.length > 0 ? yearSpecific : (raw.every((s: any) => !s.school_year) ? raw : []);
    },
    staleTime: 1000 * 60 * 10 // 10 minutos de cache
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
