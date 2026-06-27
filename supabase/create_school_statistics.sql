-- ========================================================
-- TABLA DE ESTADÍSTICAS DEL CENTRO PARA EL DASHBOARD
-- ========================================================

CREATE TABLE IF NOT EXISTS public.school_statistics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  center_id uuid REFERENCES public.centers(id) ON DELETE CASCADE,
  school_year text NOT NULL,
  period text NOT NULL, -- 'P1', 'P2', 'P3', 'P4', 'FINAL'
  stats jsonb NOT NULL,  -- Contiene toda la analítica calculada (distribución, competencias, etc.)
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (center_id, school_year, period)
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.school_statistics ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad SaaS
DROP POLICY IF EXISTS "school_statistics_isolation" ON public.school_statistics;
CREATE POLICY "school_statistics_isolation" ON public.school_statistics
FOR ALL TO authenticated
USING (center_id = public.get_my_center_id())
WITH CHECK (center_id = public.get_my_center_id());
