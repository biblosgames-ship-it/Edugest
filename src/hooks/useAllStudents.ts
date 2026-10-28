import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabase, useApp } from '../context/AppContext';

export const useAllStudents = () => {
  const { state } = useApp();

  return {
    data: state.students || [],
    isLoading: state.loading && (!state.students || state.students.length === 0),
    isError: false,
    error: null
  };
};

export const useStudentMutations = () => {
  const queryClient = useQueryClient();
  const { profile } = useSupabase();
  const { refreshData, setAppState, center } = useApp();
  const centerId = center?.id || profile?.center_id;

  const updateOrder = useMutation({
    mutationFn: async ({ id, order_number }: { id: string; order_number: number | null }) => {
      setAppState((prev: any) => ({
        ...prev,
        students: (prev.students || []).map((s: any) =>
          s.id === id ? { ...s, order_number } : s
        )
      }));
      const { error } = await supabase.from('students').update({ order_number }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  const deleteStudent = useMutation({
    mutationFn: async (id: string) => {
      setAppState((prev: any) => ({
        ...prev,
        students: (prev.students || []).filter((s: any) => s.id !== id)
      }));
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['center-stats'] });
      refreshData(centerId, true);
    }
  });

  return { updateOrder, deleteStudent };
};
