import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabase, useApp } from '../context/AppContext';

export const useSubjects = () => {
  const { profile } = useSupabase();
  const { state, refreshData } = useApp();
  const centerId = profile?.center_id;

  console.log('[DEBUG useSubjects] Hook run using context state. profile:', profile, 'centerId:', centerId);

  const addSubjectMutation = useMutation({
    mutationFn: async (newSubject: any) => {
      const dataToInsert = {
        name: newSubject.name,
        level: newSubject.level,
        hours_per_week: newSubject.hoursPerWeek,
        is_pedagogical_block: newSubject.isPedagogicalBlock,
        distribution_type: newSubject.distributionType,
        center_id: centerId
      };
      const { error } = await supabase.from('subjects').insert([dataToInsert]);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  const updateSubjectMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const dataToUpdate = {
        name: updates.name,
        level: updates.level,
        hours_per_week: updates.hoursPerWeek,
        is_pedagogical_block: updates.isPedagogicalBlock,
        distribution_type: updates.distributionType
      };
      const { error } = await supabase.from('subjects').update(dataToUpdate).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  return {
    subjects: state.subjects || [],
    isLoading: state.loading && (!state.subjects || state.subjects.length === 0),
    addSubject: addSubjectMutation.mutateAsync,
    updateSubject: updateSubjectMutation.mutateAsync,
    deleteSubject: deleteSubjectMutation.mutateAsync
  };
};
