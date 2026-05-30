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
      // 1. Obtener los IDs de los cursos del año actual
      const yearCourseIds = (state.courses || []).map((c: any) => c.id);

      // Si no hay cursos cargados aún, no podemos buscar alumnos de forma segura por curso
      // pero podemos intentar traer los del centro y año directamente.
      let query = supabase.from('students').select('*');

      if (centerId) {
        query = query.eq('center_id', centerId);
      }

      // Intentamos filtrar por año si está disponible en la tabla
      // Si no, confiamos en el filtrado posterior por IDs de curso
      const { data, error } = await query.order('first_surname', { ascending: true });

      if (error) {
        console.error('Error fetching all students:', error);
        return [];
      }

      return data || [];
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
