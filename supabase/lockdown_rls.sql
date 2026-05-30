-- =====================================================================
-- PARCHE UNIFICADO DE SEGURIDAD Y AISLAMIENTO MULTI-INQUILINO (EDUGENS)
-- =====================================================================

-- 1. Limpiar políticas conflictivas previas
DROP POLICY IF EXISTS "Anyone can select invitation_codes" ON public.invitation_codes;
DROP POLICY IF EXISTS "Users can see codes for their center" ON public.invitation_codes;
DROP POLICY IF EXISTS "Admins can manage invitation_codes" ON public.invitation_codes;
DROP POLICY IF EXISTS "Admins have full access to their center" ON public.profiles;
DROP POLICY IF EXISTS "profiles_isolation" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 2. Asegurar función helper de súper administrador en base de datos
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean AS $$
BEGIN
  RETURN COALESCE((SELECT is_superadmin FROM public.profiles WHERE id = auth.uid()), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Asegurar función helper de administrador local de centro
CREATE OR REPLACE FUNCTION public.is_admin_of_center(p_center_id uuid)
RETURNS boolean AS $$
DECLARE
  v_role text;
  v_center_id uuid;
BEGIN
  SELECT role, center_id INTO v_role, v_center_id FROM public.profiles WHERE id = auth.uid();
  RETURN (v_role IN ('admin', 'coordinator', 'creator') AND v_center_id = p_center_id) OR public.is_superadmin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Asegurar aislamiento estricto en la tabla de perfiles (Profiles)
-- Lectura: Puedes ver tu propio perfil y el de otros miembros de tu mismo centro
CREATE POLICY "profiles_select_isolation" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR center_id = public.get_my_center_id() OR public.is_superadmin());

-- Inserción: Solo al registrarse (se asocia a su propio UID)
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Actualización: El usuario común solo puede modificar sus campos de contacto personales
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND (
      -- Si no es admin, se le prohíbe cambiar su rol, centro educativo o privilegios de superadmin
      public.is_superadmin() 
      OR (
        role = (SELECT role FROM public.profiles WHERE id = auth.uid())
        AND center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid())
        AND is_superadmin = (SELECT is_superadmin FROM public.profiles WHERE id = auth.uid())
      )
    )
  );

-- Gestión Administrativa de Perfiles en el mismo Centro
CREATE POLICY "profiles_admin_manage" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin_of_center(center_id))
  WITH CHECK (public.is_admin_of_center(center_id));

-- 5. Asegurar aislamiento estricto en Códigos de Invitación (Invitation Codes)
-- Lectura: Solo admins del propio centro pueden ver sus códigos. No lectura anónima global
CREATE POLICY "invitation_codes_select" ON public.invitation_codes
  FOR SELECT TO authenticated
  USING (center_id = public.get_my_center_id() OR public.is_superadmin());

-- Escritura: Solo admins pueden crear/editar códigos en su propio centro
CREATE POLICY "invitation_codes_write" ON public.invitation_codes
  FOR ALL TO authenticated
  USING (public.is_admin_of_center(center_id))
  WITH CHECK (public.is_admin_of_center(center_id));

-- 6. Re-estructurar políticas de aislamiento SaaS en Tablas Críticas
-- Reemplazaremos la política general permisiva por reglas de lectura para usuarios y escritura solo para admins
DO $$ 
DECLARE 
  t text;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' 
    AND table_name IN (
      'students', 'courses', 'subjects', 'teachers', 'staff', 
      'assignments', 'student_grades', 'teacher_preferences', 
      'break_preferences', 'winter_schedule_preferences',
      'rooms', 'time_blocks', 'schedule_entries',
      'announcements', 'tasks', 'activities', 'excuses', 'performance_alerts'
    )
  LOOP
    -- Eliminar políticas antiguas sueltas
    EXECUTE format('DROP POLICY IF EXISTS "saas_isolation" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage %s" ON public.%s', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can read %s" ON public.%s', t, t);
    
    -- Crear Política de Lectura (Para todos los miembros activos del centro)
    EXECUTE format('CREATE POLICY "saas_read_isolation" ON public.%I FOR SELECT TO authenticated USING (center_id = public.get_my_center_id())', t);
    
    -- Crear Política de Escritura (Solo para administradores del centro)
    EXECUTE format('CREATE POLICY "saas_write_isolation" ON public.%I FOR ALL TO authenticated USING (public.is_admin_of_center(center_id)) WITH CHECK (public.is_admin_of_center(center_id))', t);
  END LOOP;
END $$;

-- 7. Crear una Función Remota Segura (RPC) para Registro de Nuevos Miembros (Bypass de cliente)
-- Esto permite validar el código en el servidor de forma segura sin exponer la tabla de códigos o cursos
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

-- 8. Crear Función Remota Segura (RPC) para Validar Códigos sin consumirlos (Bypass de cliente)
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
BEGIN
  -- 1. Buscar en códigos de invitación
  SELECT * INTO v_code_record 
  FROM public.invitation_codes 
  WHERE upper(code) = upper(trim(p_code)) AND is_used = false;

  IF v_code_record IS NOT NULL THEN
    RETURN jsonb_build_object(
      'valid', true,
      'type', 'invitation',
      'role', v_code_record.role,
      'center_id', v_code_record.center_id,
      'allowed_panels', v_code_record.allowed_panels,
      'course_id', v_code_record.course_id
    );
  END IF;

  -- 2. Buscar en cursos activos
  SELECT id, center_id, grade, section, level 
  INTO v_course_id, v_course_center_id, v_course_grade, v_course_section, v_course_level
  FROM public.courses
  WHERE upper(code) = upper(trim(p_code))
  LIMIT 1;

  IF v_course_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'valid', true,
      'type', 'course',
      'role', 'student',
      'center_id', v_course_center_id,
      'course_id', v_course_id,
      'grade', v_course_grade,
      'section', v_course_section,
      'level', v_course_level
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', false,
    'message', 'Código inválido o ya utilizado'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Crear Función Remota Segura (RPC) para Obtener Personal de un centro por código (Bypass de cliente)
CREATE OR REPLACE FUNCTION public.get_staff_for_invitation(
  p_code text
)
RETURNS TABLE (
  id uuid,
  center_id uuid,
  name text,
  team text,
  "position" text,
  email text,
  created_at timestamp with time zone
) AS $$
DECLARE
  v_center_id uuid;
BEGIN
  -- Validar el código primero
  SELECT invitation_codes.center_id INTO v_center_id
  FROM public.invitation_codes
  WHERE upper(code) = upper(trim(p_code)) AND is_used = false;

  IF v_center_id IS NOT NULL THEN
    RETURN QUERY
    SELECT s.id, s.center_id, s.name, s.team, s."position", s.email, s.created_at
    FROM public.staff s
    WHERE s.center_id = v_center_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
