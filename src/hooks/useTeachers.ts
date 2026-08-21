import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabase, useApp, normalizeNameString } from '../context/AppContext';

export const useTeachers = () => {
  const { profile } = useSupabase();
  const { state, refreshData, license, center } = useApp();
  const centerId = center?.id || profile?.center_id;

  console.log(
    '[DEBUG useTeachers] Hook run using context state. profile:',
    profile,
    'centerId:',
    centerId
  );

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

      const isSupport =
        rawRole.includes('apoy') ||
        rawRole.includes('cons') ||
        rawRole.includes('support') ||
        rawRole.includes('limpieza') ||
        rawRole.includes('mantenimiento');

      const isManagerOrAdmin =
        isManagement ||
        rawRole.includes('admin') ||
        rawRole.includes('secret') ||
        rawRole.includes('administrative') ||
        rawRole.includes('caja') ||
        rawRole.includes('cashier') ||
        rawRole.includes('finan') ||
        rawRole.includes('contab');

      let category: 'teacher' | 'manager' | 'support' = 'teacher';
      let limit: number | null | undefined = maxTeachers;
      let categoryLabel = 'docentes';

      if (rawRole.includes('management_teacher') || (isManagement && isTeacher)) {
        category = 'teacher';
        limit = maxTeachers;
        categoryLabel = 'docentes';
      } else if (isManagerOrAdmin) {
        category = 'manager';
        limit = maxManagers;
        categoryLabel = 'personal directivo/administrativo';
      } else if (isSupport) {
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

        // Contar únicamente personas ÚNICAS (por nombre normalizado) para evitar falsos positivos por duplicados
        const seenNames = new Set<string>();
        let currentCount = 0;
        (currentStaff || []).forEach((member: any) => {
          const rawName = member.full_name || member.name || '';
          const normName = normalizeNameString(rawName);
          if (normName && seenNames.has(normName)) {
            return; // Omitir duplicados de la misma persona
          }
          if (normName) seenNames.add(normName);

          const mRole = (
            member.team ||
            member.role ||
            member.cargo ||
            member.position ||
            ''
          ).toLowerCase();
          const mIsManagement =
            mRole.includes('gest') ||
            mRole.includes('direc') ||
            mRole.includes('coord') ||
            mRole.includes('management');
          const mIsTeacher =
            mRole.includes('docente') ||
            mRole.includes('teach') ||
            mRole.includes('maestr') ||
            mRole.includes('prof') ||
            mRole.includes('educ') ||
            mRole.includes('fisic') ||
            mRole.includes('deport') ||
            mRole.includes('teacher');
          const mIsSupport =
            mRole.includes('apoy') ||
            mRole.includes('cons') ||
            mRole.includes('support') ||
            mRole.includes('limpieza') ||
            mRole.includes('mantenimiento');
          const mIsManagerOrAdmin =
            mIsManagement ||
            mRole.includes('admin') ||
            mRole.includes('secret') ||
            mRole.includes('administrative') ||
            mRole.includes('caja') ||
            mRole.includes('cashier') ||
            mRole.includes('finan') ||
            mRole.includes('contab');

          let mCategory = 'teacher';
          if (mRole.includes('management_teacher') || (mIsManagement && mIsTeacher)) {
            mCategory = 'teacher';
          } else if (mIsManagerOrAdmin) {
            mCategory = 'manager';
          } else if (mIsSupport) {
            mCategory = 'support';
          } else if (mIsTeacher) {
            mCategory = 'teacher';
          }

          if (mCategory === category) {
            currentCount++;
          }
        });

        if (currentCount >= limit) {
          throw new Error(
            `Límite de ${categoryLabel} alcanzado (${limit}). Por favor, actualiza tu plan SaaS.`
          );
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
      // 1. Obtener el docente desde el estado para conocer su nombre objetivo
      const targetTeacher = (state.teachers || []).find((t: any) => t.id === id);
      const targetName = targetTeacher
        ? normalizeNameString(targetTeacher.full_name || targetTeacher.name || '')
        : '';

      // 2. Obtener registros existentes en el centro para buscar duplicados
      const [staffRes, teachersRes] = await Promise.all([
        supabase.from('staff').select('id, full_name, name').eq('center_id', centerId),
        supabase.from('teachers').select('id, name, full_name').eq('center_id', centerId)
      ]);

      const idsToDelete = new Set<string>();
      idsToDelete.add(id);

      if (targetName) {
        (staffRes.data || []).forEach((s: any) => {
          if (normalizeNameString(s.full_name || s.name || '') === targetName) {
            idsToDelete.add(s.id);
          }
        });
        (teachersRes.data || []).forEach((t: any) => {
          if (normalizeNameString(t.name || t.full_name || '') === targetName) {
            idsToDelete.add(t.id);
          }
        });
      }

      const idArray = Array.from(idsToDelete);

      // 3. Eliminar todas las filas asociadas en staff, teachers, asignaciones y preferencias
      await Promise.all([
        supabase.from('staff').delete().in('id', idArray),
        supabase.from('teachers').delete().in('id', idArray),
        supabase.from('assignments').delete().in('teacher_id', idArray),
        supabase.from('teacher_preferences').delete().in('teacher_id', idArray)
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
