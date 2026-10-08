-- ============================================================================
-- EDUGENS: DESBLOQUEO INMEDIATO DE CALIFICACIONES (RESTAURACIÓN DE ACCESO)
-- Fecha: 2026-10-08
-- Descripción:
-- Elimina las políticas restrictivas que ocultaban las notas de los docentes
-- y restaura el acceso completo para que todas las calificaciones aparezcan.
-- ============================================================================

-- 1. Eliminar las políticas restrictivas de student_grades
DROP POLICY IF EXISTS "student_grades_select_policy" ON public.student_grades;
DROP POLICY IF EXISTS "student_grades_modify_policy" ON public.student_grades;
DROP POLICY IF EXISTS "student_grades_delete_policy" ON public.student_grades;
DROP POLICY IF EXISTS "saas_read_isolation" ON public.student_grades;
DROP POLICY IF EXISTS "saas_write_isolation" ON public.student_grades;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en student_grades" ON public.student_grades;
DROP POLICY IF EXISTS "Public Full Access" ON public.student_grades;
DROP POLICY IF EXISTS "Allow all on student_grades" ON public.student_grades;

-- 2. Eliminar las políticas restrictivas de student_partial_activities
DROP POLICY IF EXISTS "student_partial_activities_select_policy" ON public.student_partial_activities;
DROP POLICY IF EXISTS "student_partial_activities_modify_policy" ON public.student_partial_activities;
DROP POLICY IF EXISTS "Allow all on student_partial_activities" ON public.student_partial_activities;

-- 3. Habilitar RLS con acceso completo para usuarios autenticados
ALTER TABLE public.student_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_partial_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on student_grades" ON public.student_grades
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on student_partial_activities" ON public.student_partial_activities
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Asegurar permisos completos de actualización, inserción y lectura en courses
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read courses" ON public.courses;
DROP POLICY IF EXISTS "Admins can manage courses" ON public.courses;
DROP POLICY IF EXISTS "Allow all on courses" ON public.courses;
DROP POLICY IF EXISTS "saas_write_isolation" ON public.courses;
DROP POLICY IF EXISTS "courses_policy" ON public.courses;

CREATE POLICY "Allow all on courses" ON public.courses
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Permisos de consulta y guardado
GRANT ALL ON public.student_grades TO authenticated, service_role, anon;
GRANT ALL ON public.student_partial_activities TO authenticated, service_role, anon;
GRANT ALL ON public.courses TO authenticated, service_role, anon;
