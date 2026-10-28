import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabase, useApp } from '../context/AppContext';

export const useStudents = () => {
  const { profile } = useSupabase();
  const { state, refreshData, setAppState, selectedYear, center } = useApp();
  const queryClient = useQueryClient();
  const centerId = center?.id || profile?.center_id;
  const schoolYear = selectedYear || '2026-2027';

  const addStudentMutation = useMutation({
    mutationFn: async (newStudent: any) => {
      const { data, error } = await supabase
        .from('students')
        .insert([
          {
            ...newStudent,
            center_id: centerId,
            school_year: schoolYear
          }
        ])
        .select();
      if (error) throw error;
      if (data?.[0]) {
        setAppState((prev: any) => ({
          ...prev,
          students: [data[0], ...(prev.students || [])]
        }));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['center-stats', centerId] });
      refreshData(centerId, true);
    }
  });

  const updateStudentMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      // Actualización optimista inmediata en memoria para respuesta en 0ms
      setAppState((prev: any) => ({
        ...prev,
        students: (prev.students || []).map((s: any) =>
          s.id === id ? { ...s, ...updates } : s
        )
      }));

      const { error } = await supabase.from('students').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  const deleteStudentMutation = useMutation({
    mutationFn: async (id: string) => {
      // Eliminación optimista inmediata en memoria
      setAppState((prev: any) => ({
        ...prev,
        students: (prev.students || []).filter((s: any) => s.id !== id)
      }));

      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['center-stats', centerId] });
      refreshData(centerId, true);
    }
  });

  return {
    students: state.students || [],
    isLoading: state.loading && (!state.students || state.students.length === 0),
    addStudent: addStudentMutation.mutateAsync,
    updateStudent: updateStudentMutation.mutateAsync,
    deleteStudent: deleteStudentMutation.mutateAsync
  };
};
