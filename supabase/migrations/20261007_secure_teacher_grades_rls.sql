-- ============================================================================
-- MIGRACIÓN DE SEGURIDAD RLS: CONTROL DE ACCESO A CALIFICACIONES Y PARCIALES
-- Fecha: 2026-10-07
-- Descripción:
-- 1. Impide que un docente edite notas de materias o cursos que no le corresponden.
-- 2. Impide que docentes sin vincular o sin asignaciones modifiquen calificaciones.
-- 3. Aísla la lectura de calificaciones exclusivamente a miembros del mismo centro.
-- ============================================================================

-- 1. Función de comprobación de permisos para editar calificaciones
CREATE OR REPLACE FUNCTION public.can_edit_student_grades(
  p_center_id uuid,
  p_course_id uuid,
  p_subject_id uuid
)
RETURNS boolean AS $$
DECLARE
  v_role text;
  v_user_center_id uuid;
  v_teacher_id uuid;
  v_is_superadmin boolean;
  v_grades_editable boolean;
BEGIN
  -- Si no está autenticado, denegar acceso
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT role, center_id, teacher_id, is_superadmin 
  INTO v_role, v_user_center_id, v_teacher_id, v_is_superadmin 
  FROM public.profiles 
  WHERE id = auth.uid();

  -- Superadministrador global tiene acceso total
  IF COALESCE(v_is_superadmin, false) IS TRUE THEN
    RETURN true;
  END IF;

  -- Aislamiento de inquilino (Centro Educativo)
  IF v_user_center_id IS NULL OR v_user_center_id <> p_center_id THEN
    RETURN false;
  END IF;

  -- Equipo Directivo y de Gestión del centro
  IF lower(COALESCE(v_role, '')) IN (
    'admin', 'administrator', 'coordinator', 'coordinador', 
    'director', 'directora', 'creator', 'management_teacher', 'subdirector'
  ) THEN
    RETURN true;
  END IF;

  -- Validación para Docentes:
  -- Debe tener un teacher_id vinculado en su perfil
  IF lower(COALESCE(v_role, '')) = 'teacher' AND v_teacher_id IS NOT NULL THEN
    -- Comprobar si la administración le revocó el permiso de editar notas (grades_editable = false)
    SELECT COALESCE(grades_editable, true) INTO v_grades_editable 
    FROM public.staff 
    WHERE (id = v_teacher_id OR user_id = auth.uid()) AND center_id = p_center_id
    LIMIT 1;

    IF v_grades_editable IS FALSE THEN
      RETURN false;
    END IF;

    -- Verificar que el docente esté asignado a esta materia y curso
    IF EXISTS (
      SELECT 1 FROM public.assignments 
      WHERE (teacher_id = v_teacher_id OR teacher_id = auth.uid())
        AND course_id = p_course_id 
        AND (subject_id = p_subject_id OR p_subject_id IS NULL)
        AND center_id = p_center_id
    ) THEN
      RETURN true;
    END IF;

    -- Verificar si es el docente titular del curso
    IF EXISTS (
      SELECT 1 FROM public.courses 
      WHERE id = p_course_id 
        AND (titular_teacher_id = v_teacher_id OR titular_teacher_id = auth.uid())
        AND center_id = p_center_id
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.can_edit_student_grades(uuid, uuid, uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. REESTRUCTURAR POLÍTICAS RLS EN public.student_grades
-- ----------------------------------------------------------------------------
ALTER TABLE public.student_grades ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas anteriores (incluyendo las permisivas USING (true))
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en student_grades" ON public.student_grades;
DROP POLICY IF EXISTS "Allow all on student_grades" ON public.student_grades;
DROP POLICY IF EXISTS "Public Full Access" ON public.student_grades;
DROP POLICY IF EXISTS "saas_read_isolation" ON public.student_grades;
DROP POLICY IF EXISTS "saas_write_isolation" ON public.student_grades;
DROP POLICY IF EXISTS "student_grades_select_policy" ON public.student_grades;
DROP POLICY IF EXISTS "student_grades_modify_policy" ON public.student_grades;
DROP POLICY IF EXISTS "student_grades_delete_policy" ON public.student_grades;

-- Política de lectura: Solo miembros activos del mismo centro o superadmins
CREATE POLICY "student_grades_select_policy" ON public.student_grades
  FOR SELECT TO authenticated
  USING (
    center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid())
    OR COALESCE((SELECT is_superadmin FROM public.profiles WHERE id = auth.uid()), false) = true
  );

-- Política de inserción y modificación: Solo personal autorizado para esa materia y curso
CREATE POLICY "student_grades_modify_policy" ON public.student_grades
  FOR ALL TO authenticated
  USING (public.can_edit_student_grades(center_id, course_id, subject_id))
  WITH CHECK (public.can_edit_student_grades(center_id, course_id, subject_id));

-- ----------------------------------------------------------------------------
-- 3. REESTRUCTURAR POLÍTICAS RLS EN public.student_partial_activities
-- ----------------------------------------------------------------------------
ALTER TABLE public.student_partial_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on student_partial_activities" ON public.student_partial_activities;
DROP POLICY IF EXISTS "student_partial_activities_select_policy" ON public.student_partial_activities;
DROP POLICY IF EXISTS "student_partial_activities_modify_policy" ON public.student_partial_activities;

-- Política de lectura: Miembros del centro educativo
CREATE POLICY "student_partial_activities_select_policy" ON public.student_partial_activities
  FOR SELECT TO authenticated
  USING (
    center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid())
    OR COALESCE((SELECT is_superadmin FROM public.profiles WHERE id = auth.uid()), false) = true
  );

-- Política de modificación: Solo personal asignado a la materia
CREATE POLICY "student_partial_activities_modify_policy" ON public.student_partial_activities
  FOR ALL TO authenticated
  USING (public.can_edit_student_grades(center_id, course_id, subject_id))
  WITH CHECK (public.can_edit_student_grades(center_id, course_id, subject_id));

-- Revocar permisos excesivos a roles anónimos en tablas de calificaciones
REVOKE ALL ON public.student_grades FROM anon;
REVOKE ALL ON public.student_partial_activities FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_grades TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_partial_activities TO authenticated, service_role;
