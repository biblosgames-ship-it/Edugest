import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabase, useApp } from '../context/AppContext';

export const useAssignments = () => {
  const { profile } = useSupabase();
  const { state, refreshData } = useApp();
  const centerId = profile?.center_id;

  console.log(
    '[DEBUG useAssignments] Hook run using context state. profile:',
    profile,
    'centerId:',
    centerId
  );

  const saveAssignmentsMutation = useMutation({
    mutationFn: async ({ teacherId, assignments }: { teacherId: string; assignments: any[] }) => {
      // 1. Borrar anteriores
      await supabase.from('assignments').delete().eq('teacher_id', teacherId);

      // 2. Insertar nuevas
      if (assignments.length > 0) {
        const { error } = await supabase.from('assignments').insert(
          assignments.map((a) => ({
            ...a,
            teacher_id: teacherId,
            center_id: centerId
          }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  const addAssignmentMutation = useMutation({
    mutationFn: async (a: {
      courseId: string;
      subjectId: string;
      teacherId: string;
      hoursPerWeek: number;
    }) => {
      if (!centerId) throw new Error('No center ID found');
      const { error } = await supabase.from('assignments').insert([
        {
          course_id: a.courseId,
          subject_id: a.subjectId,
          teacher_id: a.teacherId,
          hours_per_week: a.hoursPerWeek,
          center_id: centerId
        }
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: async ({
      id,
      updates
    }: {
      id: string;
      updates: { courseId: string; subjectId: string; teacherId: string; hoursPerWeek: number };
    }) => {
      if (!centerId) throw new Error('No center ID found');
      const { error } = await supabase
        .from('assignments')
        .update({
          course_id: updates.courseId,
          subject_id: updates.subjectId,
          teacher_id: updates.teacherId,
          hours_per_week: updates.hoursPerWeek,
          center_id: centerId
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  return {
    assignments: state.assignments || [],
    isLoading: state.loading && (!state.assignments || state.assignments.length === 0),
    saveAssignments: saveAssignmentsMutation.mutateAsync,
    addAssignment: addAssignmentMutation.mutateAsync,
    updateAssignment: updateAssignmentMutation.mutateAsync,
    deleteAssignment: deleteAssignmentMutation.mutateAsync
  };
};
