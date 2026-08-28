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
      const [studRes, coursesRes] = await Promise.all([
        supabase
          .from('students')
          .select('*')
          .eq('center_id', centerId)
          .range(0, 9999)
          .order('order_number', { ascending: true })
          .order('last_name', { ascending: true }),
        supabase
          .from('courses')
          .select('id, school_year')
          .eq('center_id', centerId)
          .range(0, 9999)
      ]);

      if (studRes.error) throw studRes.error;
      const raw = studRes.data || [];
      const rawCourses = coursesRes.data || [];

      const activeCourseIds = new Set(
        rawCourses
          .filter((c: any) => !c.school_year || c.school_year === schoolYear || c.school_year === 'undefined' || c.school_year === 'null')
          .map((c: any) => String(c.id))
      );

      return raw.filter((s: any) => {
        // A. Alumno asignado a un curso activo de la institución
        if (s.course_id && activeCourseIds.has(String(s.course_id))) return true;

        // B. Alumno sin curso registrado para este ciclo
        if (!s.course_id && (s.school_year === schoolYear || !s.school_year || s.school_year === 'undefined' || s.school_year === 'null')) {
          const st = (s.status || '').toLowerCase().trim();
          return st !== 'retirado' && st !== 'inactivo' && st !== 'graduado' && st !== 'egresado';
        }

        return false;
      });
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
