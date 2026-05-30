-- ==========================================
-- SCRIPT DE SEGURIDAD SAAS PRO - EDUGENS
-- ==========================================
-- Este script implementa el aislamiento total de datos por centro educativo (Multi-tenancy).
-- Cada usuario solo puede acceder a la información que pertenezca a su center_id.

-- 1. FUNCIÓN DE IDENTIDAD DINÁMICA
-- Esta función obtiene el center_id del usuario logueado de forma segura y eficiente.
CREATE OR REPLACE FUNCTION public.get_my_center_id()
RETURNS uuid AS $$
BEGIN
  RETURN (SELECT center_id FROM public.profiles WHERE id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. HABILITAR RLS EN TODAS LAS TABLAS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.break_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winter_schedule_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS DE AISLAMIENTO SAAS
-- Creamos una política que filtra por center_id en cada tabla.

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
      'announcements', 'tasks', 'activities'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "saas_isolation" ON public.%I', t);
    EXECUTE format('CREATE POLICY "saas_isolation" ON public.%I FOR ALL TO authenticated USING (center_id = public.get_my_center_id()) WITH CHECK (center_id = public.get_my_center_id())', t);
  END LOOP;
END $$;

-- 4. POLÍTICA ESPECIAL PARA LA TABLA DE PERFILES
-- Permite que un usuario vea su propio perfil y el de otros miembros de su mismo centro.
DROP POLICY IF EXISTS "profiles_isolation" ON public.profiles;
CREATE POLICY "profiles_isolation" ON public.profiles
FOR ALL TO authenticated
USING (id = auth.uid() OR center_id = public.get_my_center_id());

-- 5. SEGURIDAD DE ACCESO ANÓNIMO
-- Revocamos permisos de escritura a usuarios no logueados (anon).
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT ON public.centers TO anon; -- Permitir ver centros públicos (opcional)

-- ==========================================
-- FIN DEL SCRIPT
-- ==========================================
