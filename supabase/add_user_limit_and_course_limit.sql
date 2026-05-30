-- =========================================================================
-- PARCHE: AÑADIR LÍMITE DE USUARIOS A PLANES SAAS Y CONTROL 3X POR CURSO
-- =========================================================================
-- Ejecutar este script en el editor SQL de Supabase.

-- 1. Añadir columna max_users a la tabla saas_plans
ALTER TABLE public.saas_plans ADD COLUMN IF NOT EXISTS max_users integer default 500;

-- 2. Actualizar planes existentes con valores por defecto razonables
UPDATE public.saas_plans SET max_users = 350 WHERE name = 'Básico';
UPDATE public.saas_plans SET max_users = 1500 WHERE name = 'Pro';
UPDATE public.saas_plans SET max_users = 5000 WHERE name = 'Premium';
UPDATE public.saas_plans SET max_users = 999999 WHERE name = 'Ilimitado';

-- 3. Re-crear la función de registro para validar límites
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
  WHERE upper(code) = upper(trim(p_code)) AND is_used = false
  FOR UPDATE;

  IF v_code_record IS NOT NULL THEN
    -- Marcar el código de invitación como utilizado
    UPDATE public.invitation_codes 
    SET is_used = true 
    WHERE code = v_code_record.code;

    v_role := v_code_record.role;
    v_center_id := v_code_record.center_id;
    v_allowed_panels := v_code_record.allowed_panels;
    v_course_id := v_code_record.course_id;
  ELSE
    -- 2. Si no es código administrativo, buscar en cursos activos
    SELECT id, center_id INTO v_course_id, v_center_id
    FROM public.courses
    WHERE upper(code) = upper(trim(p_code))
    LIMIT 1;

    IF v_course_id IS NULL THEN
      RAISE EXCEPTION 'El código ingresado no corresponde a ninguna invitación o curso activo.';
    END IF;

    -- Validar rol para cursos
    v_role := lower(trim(p_role));
    IF v_role NOT IN ('student', 'parent') THEN
      v_role := 'student';
    END IF;

    -- Configurar paneles por defecto del rol
    IF v_role = 'student' THEN
      v_allowed_panels := ARRAY['student_dashboard'];
    ELSIF v_role = 'parent' THEN
      v_allowed_panels := ARRAY['parent_dashboard'];
    ELSE
      v_allowed_panels := ARRAY[]::text[];
    END IF;
  END IF;

  -- =========================================================================
  -- VALIDACIÓN DE LÍMITES
  -- =========================================================================
  
  -- A. Límite de 3 cuentas por cada alumno registrado para este curso (solo alumnos/padres)
  IF v_role IN ('student', 'parent') AND v_course_id IS NOT NULL THEN
    -- Contar alumnos registrados en la lista oficial de este curso
    SELECT count(*) INTO v_student_count 
    FROM public.students 
    WHERE course_id = v_course_id;
    
    -- Contar perfiles ya registrados para este curso (roles student y parent), excluyendo al usuario actual si ya estaba vinculado a este curso
    SELECT count(*) INTO v_profile_count 
    FROM public.profiles 
    WHERE course_code = v_course_id 
      AND role IN ('student', 'parent')
      AND id <> auth.uid();
      
    IF v_profile_count >= (3 * coalesce(v_student_count, 0)) THEN
      RAISE EXCEPTION 'Límite de registros alcanzado. El límite es de 3 cuentas (padres/alumnos) por cada alumno registrado en la lista oficial del curso. Actualmente hay % alumnos en la lista del curso.', coalesce(v_student_count, 0);
    END IF;
  END IF;

  -- B. Límite total de usuarios (perfiles) según el plan SaaS del centro
  IF v_center_id IS NOT NULL THEN
    -- Obtener el límite de usuarios del plan del centro
    SELECT p.max_users INTO v_max_users
    FROM public.saas_licenses l
    JOIN public.saas_plans p ON l.plan_id = p.id
    WHERE l.used_by_center = v_center_id
    LIMIT 1;

    IF v_max_users IS NOT NULL THEN
      -- Contar perfiles activos en este centro (excluyendo al usuario actual para evitar contarse a sí mismo en re-registros)
      SELECT count(*) INTO v_current_users 
      FROM public.profiles 
      WHERE center_id = v_center_id 
        AND id <> auth.uid();
        
      IF v_current_users >= v_max_users THEN
        RAISE EXCEPTION 'Se ha alcanzado el límite de usuarios creados permitido por el plan SaaS de este centro (% de % permitidos).', v_current_users, v_max_users;
      END IF;
    END IF;
  END IF;
  -- =========================================================================

  -- Actualizar el perfil del usuario de manera segura en el servidor
  UPDATE public.profiles 
  SET center_id = v_center_id,
      role = v_role,
      full_name = trim(p_full_name),
      phone = trim(p_phone),
      allowed_panels = v_allowed_panels,
      course_code = v_course_id,
      is_active = true
  WHERE id = auth.uid();

  -- Vincular/Crear registro en personal (staff) si no es estudiante o padre
  IF v_role NOT IN ('student', 'parent') THEN
    IF p_staff_id IS NOT NULL THEN
      -- Vincular email al registro de personal existente
      UPDATE public.staff 
      SET email = v_user_email
      WHERE id = p_staff_id AND center_id = v_center_id;
    ELSE
      -- Insertar nuevo registro de personal si no está ya registrado con este email
      IF NOT EXISTS (SELECT 1 FROM public.staff WHERE email = v_user_email AND center_id = v_center_id) THEN
        INSERT INTO public.staff (center_id, name, team, "position", email)
        VALUES (
          v_center_id,
          trim(p_full_name),
          CASE 
            WHEN lower(v_role) LIKE '%teacher%' OR lower(v_role) LIKE '%docente%' THEN 'teacher'
            WHEN lower(v_role) LIKE '%admin%' OR lower(v_role) LIKE '%coord%' OR lower(v_role) LIKE '%finance%' THEN 'management'
            ELSE 'support'
          END,
          CASE WHEN lower(v_role) = 'conserje' THEN 'Conserje' ELSE v_role END,
          v_user_email
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'role', v_role,
    'center_id', v_center_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
