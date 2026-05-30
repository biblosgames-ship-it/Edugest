import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabase } from '../context/AppContext';

export const useStats = () => {
  const { profile } = useSupabase();
  const centerId = profile?.center_id;

  return useQuery({
    queryKey: ['center-stats', centerId],
    queryFn: async () => {
      if (!centerId) return { studentCount: 0, totalUserCount: 0 };

      const [studentsRes, profilesRes] = await Promise.all([
        supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('center_id', centerId),
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
    staleTime: 1000 * 60 * 2 // 2 minutos antes de considerar los datos "viejos"
  });
};
