-- ============================================================================
-- MIGRACIÓN MAESTRA: CORRECCIÓN DE ERRORES POSTGREST / SUPABASE
-- Fecha: 2026-09-19
-- Ejecutar este script completo en el SQL Editor de Supabase (Dashboard del proyecto)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CORRECCIÓN EN TABLA ACTIVITIES (Resuelve 485 errores: columna is_global)
-- ----------------------------------------------------------------------------
ALTER TABLE public.activities 
  ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false;

-- Permitir que center_id sea opcional para eventos globales (ej. efemérides patrias)
ALTER TABLE public.activities 
  ALTER COLUMN center_id DROP NOT NULL;

-- Índice para acelerar consultas por centro y efemérides globales
CREATE INDEX IF NOT EXISTS idx_activities_center_global 
  ON public.activities (center_id, is_global, date);

-- Actualizar políticas RLS de activities
DROP POLICY IF EXISTS "saas_isolation" ON public.activities;
DROP POLICY IF EXISTS "activities_select_policy" ON public.activities;
DROP POLICY IF EXISTS "activities_insert_policy" ON public.activities;
DROP POLICY IF EXISTS "activities_update_policy" ON public.activities;
DROP POLICY IF EXISTS "activities_delete_policy" ON public.activities;

CREATE POLICY "activities_select_policy" ON public.activities 
  FOR SELECT TO authenticated 
  USING (
    center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid()) 
    OR is_global = true 
    OR center_id IS NULL
  );

CREATE POLICY "activities_insert_policy" ON public.activities 
  FOR INSERT TO authenticated 
  WITH CHECK (
    center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid()) 
    OR is_global = true
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'superadmin')
  );

CREATE POLICY "activities_update_policy" ON public.activities 
  FOR UPDATE TO authenticated 
  USING (
    center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid()) 
    OR is_global = true
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'superadmin')
  )
  WITH CHECK (
    center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid()) 
    OR is_global = true
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'superadmin')
  );

CREATE POLICY "activities_delete_policy" ON public.activities 
  FOR DELETE TO authenticated 
  USING (
    center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid()) 
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'superadmin')
  );

-- ----------------------------------------------------------------------------
-- 2. ASEGURAR COLUMNAS EN PROFILES Y DOCENTES
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS teacher_id uuid,
  ADD COLUMN IF NOT EXISTS course_id uuid,
  ADD COLUMN IF NOT EXISTS parent_course_ids uuid[];

-- Asegurar columna name en teachers
ALTER TABLE public.teachers 
  ADD COLUMN IF NOT EXISTS name text;

-- ----------------------------------------------------------------------------
-- 3. CORRECCIÓN RLS EN TABLA PARENTS (Permite vinculación de padres/hijos)
-- ----------------------------------------------------------------------------
ALTER TABLE public.parents 
  ADD COLUMN IF NOT EXISTS center_id uuid REFERENCES public.centers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS id_card text,
  ADD COLUMN IF NOT EXISTS address text;

DROP POLICY IF EXISTS "Admins can manage parents" ON public.parents;
DROP POLICY IF EXISTS "Center members can access parents" ON public.parents;

CREATE POLICY "Center members can access parents" ON public.parents
  FOR ALL TO authenticated
  USING (
    profile_id = auth.uid()
    OR center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid())
    OR student_id IN (SELECT id FROM public.students WHERE center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid()))
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'superadmin')
  )
  WITH CHECK (
    profile_id = auth.uid()
    OR center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid())
    OR student_id IN (SELECT id FROM public.students WHERE center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid()))
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'superadmin')
  );

-- ----------------------------------------------------------------------------
-- 4. CORRECCIÓN RPC register_member_with_code (Casteo text / uuid y límites)
-- ----------------------------------------------------------------------------
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
    -- Marcar como utilizado si NO es para padres/alumnos
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
    -- 2. Si no es código administrativo, buscar en cursos activos
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

  -- -------------------------------------------------------------------------
  -- VALIDACIÓN DE LÍMITES CON TIPOS COMPATIBLES (text = text o uuid = uuid)
  -- -------------------------------------------------------------------------
  IF v_role IN ('student', 'parent') AND v_course_id IS NOT NULL THEN
    SELECT count(*) INTO v_student_count 
    FROM public.students 
    WHERE course_id = v_course_id;
    
    -- Comparar con casteo explícito para evitar error text = uuid
    SELECT count(*) INTO v_profile_count 
    FROM public.profiles 
    WHERE (course_id = v_course_id OR course_code = v_course_id::text)
      AND role IN ('student', 'parent')
      AND id <> auth.uid();
      
    IF v_student_count > 0 AND v_profile_count >= (3 * coalesce(v_student_count, 0)) THEN
      RAISE EXCEPTION 'Límite de registros alcanzado. El límite es de 3 cuentas (padres/alumnos) por cada alumno registrado en la lista oficial del curso. Actualmente hay % alumnos en la lista del curso.', coalesce(v_student_count, 0);
    END IF;
  END IF;

  -- Validar límites del plan SaaS
  IF v_center_id IS NOT NULL THEN
    SELECT p.max_users INTO v_max_users
    FROM public.saas_licenses l
    JOIN public.saas_plans p ON l.plan_id = p.id
    WHERE l.used_by_center = v_center_id
    LIMIT 1;

    IF v_max_users IS NOT NULL THEN
      SELECT count(*) INTO v_current_users 
      FROM public.profiles 
      WHERE center_id = v_center_id 
        AND id <> auth.uid();
        
      IF v_current_users >= v_max_users THEN
        RAISE EXCEPTION 'Se ha alcanzado el límite de usuarios creado permitido por el plan SaaS de este centro (% de % permitidos).', v_current_users, v_max_users;
      END IF;
    END IF;
  END IF;

  -- -------------------------------------------------------------------------
  -- ACTUALIZAR O INSERTAR EN PROFILES
  -- -------------------------------------------------------------------------
  INSERT INTO public.profiles (
    id, email, center_id, role, full_name, phone, allowed_panels, course_id, course_code, teacher_id, is_active, parent_course_ids
  )
  VALUES (
    auth.uid(),
    v_user_email,
    v_center_id,
    v_role,
    trim(p_full_name),
    trim(p_phone),
    v_allowed_panels,
    v_course_id,
    CASE WHEN v_course_id IS NOT NULL THEN v_course_id::text ELSE NULL END,
    v_teacher_id,
    true,
    CASE WHEN v_role = 'parent' AND v_course_id IS NOT NULL THEN ARRAY[v_course_id] ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    center_id = EXCLUDED.center_id,
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    allowed_panels = EXCLUDED.allowed_panels,
    course_id = COALESCE(EXCLUDED.course_id, public.profiles.course_id),
    course_code = COALESCE(EXCLUDED.course_code, public.profiles.course_code),
    teacher_id = COALESCE(EXCLUDED.teacher_id, public.profiles.teacher_id),
    parent_course_ids = CASE 
      WHEN EXCLUDED.role = 'parent' AND EXCLUDED.course_id IS NOT NULL 
      THEN array_cat(COALESCE(public.profiles.parent_course_ids, ARRAY[]::uuid[]), ARRAY[EXCLUDED.course_id])
      ELSE public.profiles.parent_course_ids 
    END,
    is_active = EXCLUDED.is_active;

  -- Vincular docente/personal si aplica
  IF v_teacher_id IS NOT NULL THEN
    UPDATE public.staff 
    SET email = v_user_email, user_id = auth.uid()
    WHERE id = v_teacher_id;

    UPDATE public.teachers 
    SET user_id = auth.uid()
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

-- ----------------------------------------------------------------------------
-- 5. RESTRICCIÓN DE UNICIDAD EN CATEGORÍAS CONTABLES
-- ----------------------------------------------------------------------------
ALTER TABLE public.finance_ledger_categories 
  DROP CONSTRAINT IF EXISTS unique_center_category_name;

ALTER TABLE public.finance_ledger_categories 
  ADD CONSTRAINT unique_center_category_name UNIQUE (center_id, name, type);

-- ----------------------------------------------------------------------------
-- 6. FUNCIÓN RPC: OBTENER ALUMNOS DEL CURSO PARA PADRES Y ESTUDIANTES
-- Permite listar los alumnos del curso de manera segura (SECURITY DEFINER)
-- cuando los padres ingresan el código del curso.
-- ----------------------------------------------------------------------------
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

  -- 3. Obtener alumnos activos del curso ordenados por número y apellido
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT id, first_name, last_name, names, first_surname, second_surname, course_id, center_id, order_number, status
    FROM public.students
    WHERE course_id = v_course_id
      AND lower(COALESCE(status, 'activo')) NOT IN ('retirado', 'inactivo', 'expulsado')
    ORDER BY COALESCE(order_number, 999) ASC, COALESCE(first_surname, last_name) ASC
  ) t;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_students_for_invitation(text) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. TABLA DE CONTRATOS DIGITALES SAAS (EDUGENS)
-- Permite generar, firmar digitalmente y auditar acuerdos con centros educativos
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saas_contracts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  center_name TEXT NOT NULL,
  director_name TEXT,
  director_id_card TEXT,
  director_email TEXT NOT NULL,
  plan_name TEXT NOT NULL DEFAULT 'Estándar',
  max_students INTEGER DEFAULT 500,
  max_teachers INTEGER DEFAULT 50,
  price NUMERIC NOT NULL DEFAULT 0,
  billing_cycle TEXT DEFAULT 'Mensual',
  currency TEXT DEFAULT 'USD',
  has_support_24_7 BOOLEAN DEFAULT false,
  has_payment_filter BOOLEAN DEFAULT false,
  ad_mode TEXT DEFAULT 'ad_free',
  inflation_clause_rate NUMERIC DEFAULT 25.0,
  status TEXT DEFAULT 'pending',
  contract_terms_json JSONB DEFAULT '{}'::jsonb,
  signed_at TIMESTAMPTZ,
  signer_ip TEXT,
  signer_user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saas_contracts_token ON public.saas_contracts(token);
CREATE INDEX IF NOT EXISTS idx_saas_contracts_center ON public.saas_contracts(center_id);

ALTER TABLE public.saas_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saas_contracts_select_policy" ON public.saas_contracts;
DROP POLICY IF EXISTS "saas_contracts_insert_policy" ON public.saas_contracts;
DROP POLICY IF EXISTS "saas_contracts_update_policy" ON public.saas_contracts;
DROP POLICY IF EXISTS "saas_contracts_delete_policy" ON public.saas_contracts;

CREATE POLICY "saas_contracts_select_policy" ON public.saas_contracts
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "saas_contracts_insert_policy" ON public.saas_contracts
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "saas_contracts_update_policy" ON public.saas_contracts
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "saas_contracts_delete_policy" ON public.saas_contracts
  FOR DELETE TO authenticated
  USING (
    COALESCE((SELECT is_superadmin FROM public.profiles WHERE id = auth.uid()), false) = true
  );
