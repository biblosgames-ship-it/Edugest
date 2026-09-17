-- Limpieza de duplicados previos en student_partial_activities manteniendo el más reciente
DELETE FROM public.student_partial_activities a
USING public.student_partial_activities b
WHERE a.id < b.id
  AND a.center_id IS NOT DISTINCT FROM b.center_id
  AND a.course_id = b.course_id
  AND a.subject_id = b.subject_id
  AND a.period = b.period
  AND a.school_year = b.school_year;

-- Crear índice único para permitir UPSERT nativo sin error 42P10
CREATE UNIQUE INDEX IF NOT EXISTS idx_partial_act_course_subj_unique 
  ON public.student_partial_activities(center_id, course_id, subject_id, period, school_year);

-- Asegurar permisos y RLS
ALTER TABLE public.student_partial_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on student_partial_activities" ON public.student_partial_activities;
CREATE POLICY "Allow all on student_partial_activities" 
  ON public.student_partial_activities FOR ALL 
  USING (true) 
  WITH CHECK (true);

GRANT ALL ON public.student_partial_activities TO anon, authenticated, service_role;
