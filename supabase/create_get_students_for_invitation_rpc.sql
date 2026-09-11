-- =========================================================================
-- FUNCIÓN RPC: OBTENER ALUMNOS DE UN CURSO PARA VINCULACIÓN (PADRES Y ALUMNOS)
-- =========================================================================
-- Al registrarse o vincularse por primera vez, el usuario no tiene center_id
-- asignado en profiles, por lo que las políticas de RLS bloquean la lectura
-- de la tabla 'students'. Esta función SECURITY DEFINER permite obtener de
-- forma segura los alumnos activos de una sección ingresando el código del curso.

CREATE OR REPLACE FUNCTION public.get_students_for_invitation(
  p_code text
)
RETURNS TABLE (
  id uuid,
  center_id uuid,
  course_id uuid,
  names text,
  first_name text,
  last_name text,
  first_surname text,
  second_surname text,
  name text,
  student_id text,
  order_number integer,
  status text
) AS $$
DECLARE
  v_course_id uuid;
  v_center_id uuid;
BEGIN
  -- 1. Buscar en courses directamente por código amigable (ej: GEN-5A)
  SELECT c.id, c.center_id INTO v_course_id, v_center_id
  FROM public.courses c
  WHERE upper(trim(c.code)) = upper(trim(p_code))
  LIMIT 1;

  -- 2. Si no es un código de curso directo, buscar en invitation_codes
  IF v_course_id IS NULL THEN
    SELECT ic.course_id, ic.center_id INTO v_course_id, v_center_id
    FROM public.invitation_codes ic
    WHERE upper(trim(ic.code)) = upper(trim(p_code))
    LIMIT 1;
  END IF;

  IF v_course_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      s.id,
      s.center_id,
      s.course_id,
      s.names,
      s.first_name,
      s.last_name,
      s.first_surname,
      s.second_surname,
      s.name,
      COALESCE(s.student_id::text, s.order_number::text, '')::text AS student_id,
      s.order_number,
      s.status
    FROM public.students s
    WHERE s.course_id = v_course_id
      AND lower(COALESCE(s.status, 'activo')) NOT IN ('retirado', 'inactivo', 'expulsado')
    ORDER BY 
      COALESCE(s.order_number, 999) ASC,
      COALESCE(s.first_surname, s.last_name, s.names, s.first_name, '') ASC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función alternativa directa por ID de curso
CREATE OR REPLACE FUNCTION public.get_students_by_course_id(
  p_course_id uuid
)
RETURNS TABLE (
  id uuid,
  center_id uuid,
  course_id uuid,
  names text,
  first_name text,
  last_name text,
  first_surname text,
  second_surname text,
  name text,
  student_id text,
  order_number integer,
  status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.center_id,
    s.course_id,
    s.names,
    s.first_name,
    s.last_name,
    s.first_surname,
    s.second_surname,
    s.name,
    COALESCE(s.student_id::text, s.order_number::text, '')::text AS student_id,
    s.order_number,
    s.status
  FROM public.students s
  WHERE s.course_id = p_course_id
    AND lower(COALESCE(s.status, 'activo')) NOT IN ('retirado', 'inactivo', 'expulsado')
  ORDER BY 
    COALESCE(s.order_number, 999) ASC,
    COALESCE(s.first_surname, s.last_name, s.names, s.first_name, '') ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Otorgar permisos de ejecución para usuarios anónimos y autenticados
GRANT EXECUTE ON FUNCTION public.get_students_for_invitation(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_students_by_course_id(uuid) TO anon, authenticated, service_role;
