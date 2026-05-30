import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabase, useApp } from '../context/AppContext';

export function usePreferences() {
  const { profile } = useSupabase();
  const { state, refreshData } = useApp();
  const centerId = profile?.center_id;

  console.log('[DEBUG usePreferences] Hook run using context state. profile:', profile, 'centerId:', centerId);

  // Mutations
  const addTeacherPreference = useMutation({
    mutationFn: async (pref: any) => {
      const { error } = await supabase.from('teacher_preferences').upsert({
        id: pref.id || undefined,
        teacher_id: pref.teacherId,
        working_days: pref.workingDays,
        morning_start: pref.morningStart,
        morning_end: pref.morningEnd,
        afternoon_start: pref.afternoonStart,
        afternoon_end: pref.afternoonEnd,
        daily_config: pref.dailyConfig,
        center_id: centerId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  const deleteTeacherPreference = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teacher_preferences').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  const addBreakPreference = useMutation({
    mutationFn: async (b: any) => {
      const { error } = await supabase.from('break_preferences').upsert({
        id: b.id || undefined,
        start_time: b.startTime,
        duration_minutes: b.durationMinutes,
        level: b.level,
        cycle: b.cycle,
        center_id: centerId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  const deleteBreakPreference = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('break_preferences').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  const setWinterSchedulePreference = useMutation({
    mutationFn: async (w: any) => {
      if (!w) {
        await supabase.from('winter_schedule_preferences').delete().eq('center_id', centerId);
      } else {
        await supabase.from('winter_schedule_preferences').upsert({
          center_id: centerId,
          reduction_factor: w.reductionFactor,
          start_date: w.startDate,
          end_date: w.endDate
        });
      }
    },
    onSuccess: () => {
      refreshData(centerId, true);
    }
  });

  // Mapear el formato esperado por PreferencesForm
  const mappedTeacherPrefs = (state.teacherPreferences || []).map((p: any) => ({
    id: p.id,
    teacherId: p.teacherId,
    workingDays: p.workingDays,
    morningStart: (p.morningStart || '').slice(0, 5),
    morningEnd: (p.morningEnd || '').slice(0, 5),
    afternoonStart: (p.afternoonStart || '').slice(0, 5),
    afternoonEnd: (p.afternoonEnd || '').slice(0, 5),
    dailyConfig: p.dailyConfig
  }));

  const mappedBreakPrefs = (state.breakPreferences || []).map((b: any) => ({
    id: b.id,
    startTime: b.startTime,
    durationMinutes: b.durationMinutes,
    level: b.level,
    cycle: b.cycle
  }));

  const mappedWinterPref = state.winterSchedulePreference
    ? {
        id: state.winterSchedulePreference.id,
        reductionFactor: state.winterSchedulePreference.reduction_factor,
        startDate: state.winterSchedulePreference.start_date,
        endDate: state.winterSchedulePreference.end_date
      }
    : null;

  return {
    teacherPreferences: mappedTeacherPrefs,
    breakPreferences: mappedBreakPrefs,
    winterPreference: mappedWinterPref,
    isLoading: state.loading && (!state.teacherPreferences || state.teacherPreferences.length === 0),
    addTeacherPreference: addTeacherPreference.mutateAsync,
    deleteTeacherPreference: deleteTeacherPreference.mutateAsync,
    addBreakPreference: addBreakPreference.mutateAsync,
    deleteBreakPreference: deleteBreakPreference.mutateAsync,
    setWinterSchedulePreference: setWinterSchedulePreference.mutateAsync
  };
}
