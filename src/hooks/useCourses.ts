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
      const finalCourse: any = {
        ...rest,
        student_count: studentCount,
        center_id: centerId,
        school_year: selectedYear
      };
      if (finalCourse.titular_teacher_id === '') finalCourse.titular_teacher_id = null;
      if (finalCourse.titular_subject_id === '') finalCourse.titular_subject_id = null;

      const { data, error } = await supabase.from('courses').insert([finalCourse]).select();
      if (error) {
        if (
          error.message?.includes('column') ||
          error.code === '42703' ||
          error.message?.includes('schema') ||
          error.message?.includes('titular')
        ) {
          const {
            titular_teacher_id,
            titular_subject_id,
            titular_monday_first_hour,
            ...baseFields
          } = finalCourse;
          const { data: fbData, error: fallbackErr } = await supabase
            .from('courses')
            .insert([baseFields])
            .select();
          if (fallbackErr) throw fallbackErr;
          if (fbData?.[0]?.id) {
            try {
              const localMap = JSON.parse(
                localStorage.getItem('edugens_course_titular_map') || '{}'
              );
              localMap[fbData[0].id] = {
                titular_teacher_id: finalCourse.titular_teacher_id,
                titular_subject_id: finalCourse.titular_subject_id,
                titular_monday_first_hour: finalCourse.titular_monday_first_hour
              };
              localStorage.setItem('edugens_course_titular_map', JSON.stringify(localMap));
            } catch {}
          }
        } else {
          throw error;
        }
      } else if (data?.[0]?.id) {
        try {
          const localMap = JSON.parse(localStorage.getItem('edugens_course_titular_map') || '{}');
          localMap[data[0].id] = {
            titular_teacher_id: finalCourse.titular_teacher_id,
            titular_subject_id: finalCourse.titular_subject_id,
            titular_monday_first_hour: finalCourse.titular_monday_first_hour
          };
          localStorage.setItem('edugens_course_titular_map', JSON.stringify(localMap));
        } catch {}
      }
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  const updateCourseMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { studentCount, ...rest } = updates;
      const finalUpdates: any = { ...rest };
      if (studentCount !== undefined) {
        finalUpdates.student_count = studentCount;
      }

      if (finalUpdates.titular_teacher_id === '') finalUpdates.titular_teacher_id = null;
      if (finalUpdates.titular_subject_id === '') finalUpdates.titular_subject_id = null;

      try {
        const localMap = JSON.parse(localStorage.getItem('edugens_course_titular_map') || '{}');
        localMap[id] = {
          titular_teacher_id: finalUpdates.titular_teacher_id,
          titular_subject_id: finalUpdates.titular_subject_id,
          titular_monday_first_hour: finalUpdates.titular_monday_first_hour
        };
        localStorage.setItem('edugens_course_titular_map', JSON.stringify(localMap));
      } catch {}

      const { error } = await supabase.from('courses').update(finalUpdates).eq('id', id);
      if (error) {
        if (
          error.message?.includes('column') ||
          error.code === '42703' ||
          error.message?.includes('schema') ||
          error.message?.includes('titular')
        ) {
          const {
            titular_teacher_id,
            titular_subject_id,
            titular_monday_first_hour,
            ...baseFields
          } = finalUpdates;
          const { error: fallbackErr } = await supabase
            .from('courses')
            .update(baseFields)
            .eq('id', id);
          if (fallbackErr) throw fallbackErr;
        } else {
          throw error;
        }
      }
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
