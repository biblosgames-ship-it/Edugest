import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabase, useApp } from '../context/AppContext';
import {
  saveCachedGrades,
  getCachedGrades,
  enqueueSyncAction
} from '../utils/offlineSync';

export const useGrades = (courseId: string, subjectId: string) => {
  const { profile } = useSupabase();
  const { selectedYear } = useApp();
  const queryClient = useQueryClient();
  const centerId = profile?.center_id;
  const effectiveYear = selectedYear || '2026-2027';
  const cacheKey = `grades_${centerId || 'nocid'}_${effectiveYear}_${courseId}_${subjectId}`;

  const query = useQuery({
    queryKey: ['grades', centerId, effectiveYear, courseId, subjectId],
    queryFn: async () => {
      if (!courseId || !subjectId) return {};

      // 0. Si no hay internet, retornar de inmediato la copia local de IndexedDB
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await getCachedGrades(cacheKey);
        if (cached) return cached;
      }

      try {
        const { data, error } = await supabase
          .from('student_grades')
          .select('*')
          .eq('course_id', courseId)
          .eq('subject_id', subjectId)
          .eq('school_year', effectiveYear);

        if (error) throw error;

        const loaded: Record<string, any> = {};
        data?.forEach((g: any) => {
          const pL = (g.period || '').toLowerCase();
          if (g.grade !== null && g.grade !== undefined) loaded[`${g.student_id}_${g.competency_id}_${pL}`] = g.grade;
          if (g.rp1 !== null && g.rp1 !== undefined) loaded[`${g.student_id}_${g.competency_id}_rp1`] = g.rp1;
          if (g.rp2 !== null && g.rp2 !== undefined) loaded[`${g.student_id}_${g.competency_id}_rp2`] = g.rp2;
          if (g.rp3 !== null && g.rp3 !== undefined) loaded[`${g.student_id}_${g.competency_id}_rp3`] = g.rp3;
          if (g.rp4 !== null && g.rp4 !== undefined) loaded[`${g.student_id}_${g.competency_id}_rp4`] = g.rp4;
          if (g.recovery_grade !== null && g.recovery_grade !== undefined) loaded[`${g.student_id}_final_rec`] = g.recovery_grade;
        });

        // Guardar snapshot de notas en IndexedDB para disponibilidad offline
        saveCachedGrades(cacheKey, loaded).catch(() => {});

        return loaded;
      } catch (error: any) {
        console.warn('[useGrades] Error al cargar notas en línea, intentando caché local:', error);
        const cached = await getCachedGrades(cacheKey);
        if (cached) return cached;
        throw error;
      }
    },
    enabled: !!courseId && !!subjectId,
    staleTime: 1000 * 60 * 5, // 5 minutos de cache
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });

  const saveGradesMutation = useMutation({
    mutationFn: async (updates: any[]) => {
      if (updates.length === 0) return { success: true, offline: false };

      // 1. Guardado local optimista: actualizar IndexedDB y la caché de React Query al instante
      const currentLoaded = (await getCachedGrades(cacheKey)) || { ...(query.data || {}) };
      updates.forEach((u: any) => {
        const pL = (u.period || '').toLowerCase();
        if (u.grade !== undefined && u.grade !== null) currentLoaded[`${u.student_id}_${u.competency_id}_${pL}`] = u.grade;
        if (u.rp1 !== undefined && u.rp1 !== null) currentLoaded[`${u.student_id}_${u.competency_id}_rp1`] = u.rp1;
        if (u.rp2 !== undefined && u.rp2 !== null) currentLoaded[`${u.student_id}_${u.competency_id}_rp2`] = u.rp2;
        if (u.rp3 !== undefined && u.rp3 !== null) currentLoaded[`${u.student_id}_${u.competency_id}_rp3`] = u.rp3;
        if (u.rp4 !== undefined && u.rp4 !== null) currentLoaded[`${u.student_id}_${u.competency_id}_rp4`] = u.rp4;
        if (u.recovery_grade !== undefined && u.recovery_grade !== null) currentLoaded[`${u.student_id}_final_rec`] = u.recovery_grade;
      });

      await saveCachedGrades(cacheKey, currentLoaded);
      queryClient.setQueryData(['grades', centerId, effectiveYear, courseId, subjectId], currentLoaded);

      // 2. Si el dispositivo está sin conexión, encolar acción de sincronización
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (isOffline) {
        await enqueueSyncAction({
          type: 'grades',
          payload: updates,
          centerId,
          description: `Calificaciones (${updates.length} registros)`
        });
        return { success: true, offline: true };
      }

      // 3. Si hay conexión, intentar guardar directamente en Supabase
      try {
        const { error } = await supabase
          .from('student_grades')
          .upsert(updates, { onConflict: 'student_id,course_id,subject_id,period,competency_id' });
        if (error) throw error;
        return { success: true, offline: false };
      } catch (error: any) {
        console.warn('[useGrades] Falla de red al guardar en Supabase. Encolando para sincronización automática:', error);
        await enqueueSyncAction({
          type: 'grades',
          payload: updates,
          centerId,
          description: `Calificaciones (${updates.length} registros)`
        });
        return { success: true, offline: true };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['grades', centerId, effectiveYear, courseId, subjectId]
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
