import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabase, useApp } from '../context/AppContext';

export const useCourses = () => {
  const { profile } = useSupabase();
  const { state, refreshData, selectedYear } = useApp();
  const centerId = profile?.center_id;

  console.log(
    '[DEBUG useCourses] Hook run using context state. profile:',
    profile,
    'centerId:',
    centerId
  );

  const addCourseMutation = useMutation({
    mutationFn: async (newCourse: any) => {
      const { studentCount, ...rest } = newCourse;
      const { error } = await supabase.from('courses').insert([
        {
          ...rest,
          student_count: studentCount, // Mapeo de camelCase a snake_case
          center_id: centerId,
          school_year: selectedYear
        }
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  const updateCourseMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { studentCount, ...rest } = updates;
      const finalUpdates = { ...rest };
      if (studentCount !== undefined) {
        finalUpdates.student_count = studentCount;
      }

      const { error } = await supabase.from('courses').update(finalUpdates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  const deleteCourseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  return {
    courses: state.courses || [],
    isLoading: state.loading && (!state.courses || state.courses.length === 0),
    addCourse: addCourseMutation.mutateAsync,
    updateCourse: updateCourseMutation.mutateAsync,
    deleteCourse: deleteCourseMutation.mutateAsync
  };
};
