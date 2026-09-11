-- =========================================================================
-- FUNCIÓN RPC: OBTENER ALUMNOS DE UN CURSO PARA VINCULACIÓN DE PADRES Y ALUMNOS
-- =========================================================================
-- Ejecuta este script en el editor SQL de Supabase (SQL Editor -> New Query).
-- Esta función SECURITY DEFINER permite listar los alumnos de una sección
-- mediante el código del curso sin ser bloqueado por RLS.

CREATE OR REPLACE FUNCTION public.get_students_for_invitation(p_code text)
RETURNS jsonb AS $$
DECLARE
  v_course_id uuid;
  v_result jsonb;
BEGIN
  -- 1. Buscar en courses por código (ej: GEN-5A)
  SELECT id INTO v_course_id
  FROM public.courses
  WHERE upper(trim(code)) = upper(trim(p_code))
  LIMIT 1;

  -- 2. Si no está en courses, buscar en invitation_codes
  IF v_course_id IS NULL THEN
    SELECT course_id INTO v_course_id
    FROM public.invitation_codes
    WHERE upper(trim(code)) = upper(trim(p_code))
    LIMIT 1;
  END IF;

  IF v_course_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- 3. Obtener alumnos activos del curso
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT *
    FROM public.students
    WHERE course_id = v_course_id
      AND lower(COALESCE(status, 'activo')) NOT IN ('retirado', 'inactivo', 'expulsado')
  ) t;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_students_for_invitation(text) TO anon, authenticated, service_role;
