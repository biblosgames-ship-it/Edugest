import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabase, useApp } from '../context/AppContext';

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
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('center_id', centerId)
        .or(`school_year.eq.${schoolYear},school_year.is.null,school_year.eq.""`)
        .order('order_number', { ascending: true })
        .order('last_name', { ascending: true });

      if (error) throw error;
      const raw = data || [];
      const yearSpecific = raw.filter((s: any) => s.school_year === schoolYear);
      return yearSpecific.length > 0 ? yearSpecific : (raw.every((s: any) => !s.school_year) ? raw : []);
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
