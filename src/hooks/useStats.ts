import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabase, useApp } from '../context/AppContext';

export const useStats = () => {
  const { profile } = useSupabase();
  const { selectedYear, state } = useApp();
  const centerId = profile?.center_id;
  const currentYear = selectedYear || '2026-2027';

  return useQuery({
    queryKey: ['center-stats', centerId, currentYear, state.students?.length],
    queryFn: async () => {
      if (!centerId) return { studentCount: 0, totalUserCount: 0 };

      // Si el estado de la aplicación ya tiene la nómina filtrada del año activo, usarla directamente
      if (state.students && state.students.length > 0) {
        const { count: profilesCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('center_id', centerId);

        return {
          studentCount: state.students.length,
          totalUserCount: profilesCount || 0
        };
      }

      const [studentsRes, profilesRes] = await Promise.all([
        supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('center_id', centerId)
          .eq('school_year', currentYear),
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('center_id', centerId)
      ]);

      return {
        studentCount: studentsRes.count || 0,
        totalUserCount: profilesRes.count || 0
      };
    },
    enabled: !!centerId,
    staleTime: 1000 * 30
  });
};
