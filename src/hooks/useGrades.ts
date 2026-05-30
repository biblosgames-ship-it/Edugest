import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabase, useApp } from '../context/AppContext';

export const useGrades = (courseId: string, subjectId: string) => {
  const { profile } = useSupabase();
  const { selectedYear } = useApp();
  const queryClient = useQueryClient();
  const centerId = profile?.center_id;

  const query = useQuery({
    queryKey: ['grades', centerId, selectedYear, courseId, subjectId],
    queryFn: async () => {
      if (!courseId || !subjectId) return {};

      const { data, error } = await supabase
        .from('student_grades')
        .select('*')
        .eq('course_id', courseId)
        .eq('subject_id', subjectId)
        .eq('school_year', selectedYear || '2025-2026');

      if (error) throw error;

      const loaded: Record<string, any> = {};
      data?.forEach((g: any) => {
        const pL = g.period.toLowerCase();
        if (g.grade !== null) loaded[`${g.student_id}_${g.competency_id}_${pL}`] = g.grade;
        if (g.rp1 !== null) loaded[`${g.student_id}_${g.competency_id}_rp1`] = g.rp1;
        if (g.rp2 !== null) loaded[`${g.student_id}_${g.competency_id}_rp2`] = g.rp2;
        if (g.rp3 !== null) loaded[`${g.student_id}_${g.competency_id}_rp3`] = g.rp3;
        if (g.rp4 !== null) loaded[`${g.student_id}_${g.competency_id}_rp4`] = g.rp4;
        if (g.recovery_grade !== null) loaded[`${g.student_id}_final_rec`] = g.recovery_grade;
      });

      return loaded;
    },
    enabled: !!courseId && !!subjectId,
    staleTime: 1000 * 60 * 5 // 5 minutos de cache
  });

  const saveGradesMutation = useMutation({
    mutationFn: async (updates: any[]) => {
      if (updates.length === 0) return;
      const { error } = await supabase
        .from('student_grades')
        .upsert(updates, { onConflict: 'student_id,course_id,subject_id,period,competency_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['grades', centerId, selectedYear, courseId, subjectId]
      });
    }
  });

  return {
    grades: query.data || {},
    isLoading: query.isLoading,
    isSaving: saveGradesMutation.isPending,
    saveGrades: saveGradesMutation.mutateAsync,
    saveStatus: saveGradesMutation.status
  };
};
