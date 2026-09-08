-- =========================================================================
-- MIGRACIÓN: Vincular Códigos de Invitación directamente con Docentes
-- =========================================================================
-- Permite que al generar un código para un docente (masivo o individual),
-- se guarde su teacher_id para que al registrarse se vincule inmediatamente
-- con su horario, materias y perfil docente.

-- 1. Añadir columna teacher_id a la tabla invitation_codes
ALTER TABLE public.invitation_codes 
ADD COLUMN IF NOT EXISTS teacher_id uuid;

-- 2. Actualizar función validate_invitation_code para retornar teacher_id
CREATE OR REPLACE FUNCTION public.validate_invitation_code(
  p_code text
)
RETURNS jsonb AS $$
DECLARE
  v_code_record record;
  v_course_id uuid;
  v_course_center_id uuid;
  v_course_grade text;
  v_course_section text;
  v_course_level text;
  v_course_tanda text;
BEGIN
  -- 1. Buscar primero en cursos activos (código de curso para padres y alumnos)
  SELECT id, center_id, grade, section, level, tanda 
  INTO v_course_id, v_course_center_id, v_course_grade, v_course_section, v_course_level, v_course_tanda
  FROM public.courses
  WHERE upper(trim(code)) = upper(trim(p_code))
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'valid', true,
      'type', 'course',
      'role', 'student',
      'center_id', v_course_center_id,
      'course_id', v_course_id,
      'grade', v_course_grade,
      'section', v_course_section,
      'level', v_course_level,
      'tanda', v_course_tanda
    );
  END IF;

  -- 2. Buscar en códigos de invitación
  SELECT * INTO v_code_record 
  FROM public.invitation_codes 
  WHERE upper(trim(code)) = upper(trim(p_code))
  LIMIT 1;

  IF FOUND THEN
    -- Si es para padres, alumnos o está vinculado a un curso, es SIEMPRE reutilizable
    IF v_code_record.role IN ('parent', 'student') OR v_code_record.course_id IS NOT NULL THEN
      IF v_code_record.course_id IS NOT NULL THEN
        SELECT grade, section, level, tanda INTO v_course_grade, v_course_section, v_course_level, v_course_tanda
        FROM public.courses WHERE id = v_code_record.course_id;
      END IF;

      RETURN jsonb_build_object(
        'valid', true,
        'type', CASE WHEN v_code_record.course_id IS NOT NULL THEN 'course' ELSE 'invitation' END,
        'role', COALESCE(v_code_record.role, 'parent'),
        'center_id', v_code_record.center_id,
        'allowed_panels', v_code_record.allowed_panels,
        'course_id', v_code_record.course_id,
        'teacher_id', v_code_record.teacher_id,
        'grade', v_course_grade,
        'section', v_course_section,
        'level', v_course_level,
        'tanda', v_course_tanda
      );
    ELSIF v_code_record.is_used = false THEN
      -- Invitación administrativa/docente no utilizada
      RETURN jsonb_build_object(
        'valid', true,
        'type', 'invitation',
        'role', v_code_record.role,
        'center_id', v_code_record.center_id,
        'allowed_panels', v_code_record.allowed_panels,
        'course_id', v_code_record.course_id,
        'teacher_id', v_code_record.teacher_id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'valid', false,
    'message', 'Código inválido o ya utilizado'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Actualizar función register_member_with_code para persistir teacher_id
CREATE OR REPLACE FUNCTION public.register_member_with_code(
  p_code text,
  p_full_name text,
  p_phone text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_staff_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_code_record record;
  v_role text;
  v_center_id uuid;
  v_course_id uuid;
  v_teacher_id uuid;
  v_allowed_panels text[];
  v_user_email text;
  v_student_count integer;
  v_profile_count integer;
  v_max_users integer;
  v_current_users integer;
BEGIN
  -- Verificar autenticación
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Obtener email del usuario autenticado
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  -- 1. Intentar buscar en códigos de invitación administrativa
  SELECT * INTO v_code_record 
  FROM public.invitation_codes 
  WHERE upper(trim(code)) = upper(trim(p_code))
  LIMIT 1;

  IF FOUND THEN
    -- Solo marcar como utilizado si NO es para padres/alumnos/cursos
    IF v_code_record.role NOT IN ('parent', 'student') AND v_code_record.course_id IS NULL THEN
      UPDATE public.invitation_codes 
      SET is_used = true 
      WHERE code = v_code_record.code;
    END IF;

    v_role := COALESCE(p_role, v_code_record.role);
    v_center_id := v_code_record.center_id;
    v_allowed_panels := v_code_record.allowed_panels;
    v_course_id := v_code_record.course_id;
    v_teacher_id := COALESCE(p_staff_id, v_code_record.teacher_id);
  ELSE
    -- 2. Si no es código en invitation_codes, buscar en cursos activos
    SELECT id, center_id INTO v_course_id, v_center_id
    FROM public.courses
    WHERE upper(trim(code)) = upper(trim(p_code))
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El código ingresado no corresponde a ninguna invitación o curso activo.';
    END IF;

    v_role := lower(trim(p_role));
    IF v_role NOT IN ('student', 'parent') THEN
      v_role := 'student';
    END IF;

    IF v_role = 'student' THEN
      v_allowed_panels := ARRAY['student_dashboard'];
    ELSIF v_role = 'parent' THEN
      v_allowed_panels := ARRAY['parent_dashboard'];
    ELSE
      v_allowed_panels := ARRAY[]::text[];
    END IF;
  END IF;

  -- Actualizar o crear el perfil del usuario vinculando teacher_id
  INSERT INTO public.profiles (
    id, email, center_id, role, full_name, phone, allowed_panels, course_code, teacher_id, is_active
  )
  VALUES (
    auth.uid(), v_user_email, v_center_id, v_role, trim(p_full_name), trim(p_phone), v_allowed_panels, v_course_id, v_teacher_id, true
  )
  ON CONFLICT (id) DO UPDATE SET
    center_id = EXCLUDED.center_id,
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    allowed_panels = EXCLUDED.allowed_panels,
    course_code = EXCLUDED.course_code,
    teacher_id = COALESCE(EXCLUDED.teacher_id, public.profiles.teacher_id),
    is_active = EXCLUDED.is_active;

  -- Actualizar registro en personal y docentes si se vinculó un ID
  IF v_teacher_id IS NOT NULL THEN
    UPDATE public.staff 
    SET email = v_user_email, user_id = auth.uid()
    WHERE id = v_teacher_id;

    UPDATE public.teachers 
    SET email = v_user_email, user_id = auth.uid()
    WHERE id = v_teacher_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'role', v_role,
    'center_id', v_center_id,
    'teacher_id', v_teacher_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
