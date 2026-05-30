import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabase, useApp } from '../context/AppContext';

export const useTeachers = () => {
  const { profile } = useSupabase();
  const { state, refreshData, license } = useApp();
  const centerId = profile?.center_id;

  console.log('[DEBUG useTeachers] Hook run using context state. profile:', profile, 'centerId:', centerId);

  const addTeacherMutation = useMutation({
    mutationFn: async (newTeacher: any) => {
      // 1. Obtener límites del plan
      const maxTeachers = license?.plan?.max_teachers;
      const maxManagers = license?.plan?.max_managers;
      const maxSupport = license?.plan?.max_support;

      // 2. Determinar la categoría y límite del nuevo colaborador
      const rawRole = (newTeacher.role || newTeacher.team || '').toLowerCase();
      
      const isManagement = 
        rawRole.includes('gest') ||
        rawRole.includes('direc') ||
        rawRole.includes('coord') ||
        rawRole.includes('management');
      
      const isTeacher =
        rawRole.includes('docente') ||
        rawRole.includes('teach') ||
        rawRole.includes('maestr') ||
        rawRole.includes('prof') ||
        rawRole.includes('educ') ||
        rawRole.includes('fisic') ||
        rawRole.includes('deport') ||
        rawRole.includes('teacher');

      let category: 'teacher' | 'manager' | 'support' = 'teacher';
      let limit: number | null | undefined = maxTeachers;
      let categoryLabel = 'docentes';

      if (rawRole.includes('management_teacher') || (isManagement && isTeacher)) {
        category = 'teacher';
        limit = maxTeachers;
        categoryLabel = 'docentes';
      } else if (isManagement || rawRole.includes('admin') || rawRole.includes('secret') || rawRole.includes('administrative')) {
        category = 'manager';
        limit = maxManagers;
        categoryLabel = 'personal directivo/gestión';
      } else if (rawRole.includes('apoy') || rawRole.includes('cons') || rawRole.includes('support')) {
        category = 'support';
        limit = maxSupport;
        categoryLabel = 'personal de apoyo';
      } else if (isTeacher) {
        category = 'teacher';
        limit = maxTeachers;
        categoryLabel = 'docentes';
      }

      if (limit !== undefined && limit !== null) {
        // Consultar la base de datos de staff para contar cuántos de la misma categoría ya existen
        const { data: currentStaff, error: fetchError } = await supabase
          .from('staff')
          .select('*')
          .eq('center_id', centerId);

        if (fetchError) throw fetchError;

        // Contar cuántos pertenecen a la categoría detectada
        let currentCount = 0;
        (currentStaff || []).forEach((member: any) => {
          const mRole = (member.team || member.role || member.cargo || member.position || '').toLowerCase();
          const mIsManagement = mRole.includes('gest') || mRole.includes('direc') || mRole.includes('coord') || mRole.includes('management');
          const mIsTeacher = mRole.includes('docente') || mRole.includes('teach') || mRole.includes('maestr') || mRole.includes('prof') || mRole.includes('educ') || mRole.includes('fisic') || mRole.includes('deport') || mRole.includes('teacher');

          let mCategory = 'teacher';
          if (mRole.includes('management_teacher') || (mIsManagement && mIsTeacher)) {
            mCategory = 'teacher';
          } else if (mIsManagement || mRole.includes('admin') || mRole.includes('secret') || mRole.includes('administrative')) {
            mCategory = 'manager';
          } else if (mRole.includes('apoy') || mRole.includes('cons') || mRole.includes('support')) {
            mCategory = 'support';
          } else if (mIsTeacher) {
            mCategory = 'teacher';
          }

          if (mCategory === category) {
            currentCount++;
          }
        });

        if (currentCount >= limit) {
          throw new Error(`Límite de ${categoryLabel} alcanzado (${limit}). Por favor, actualiza tu plan SaaS.`);
        }
      }

      const { data, error } = await supabase
        .from('staff')
        .insert([{ ...newTeacher, center_id: centerId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  const updateTeacherMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const updatedData = { ...updates };
      if (updates.sex) {
        updatedData.gender = updates.sex === 'F' ? 'Femenino' : 'Masculino';
      }
      const { error } = await supabase
        .from('staff')
        .upsert({ id, center_id: centerId, ...updatedData });
      if (error) throw error;
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  const deleteTeacherMutation = useMutation({
    mutationFn: async (id: string) => {
      await Promise.all([
        supabase.from('staff').delete().eq('id', id),
        supabase.from('teachers').delete().eq('id', id)
      ]);
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  return {
    teachers: state.teachers || [],
    isLoading: state.loading && (!state.teachers || state.teachers.length === 0),
    addTeacher: addTeacherMutation.mutateAsync,
    updateTeacher: updateTeacherMutation.mutateAsync,
    deleteTeacher: deleteTeacherMutation.mutateAsync
  };
};
