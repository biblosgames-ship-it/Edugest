-- Migración: Soporte para liberación de calificaciones en el portal de padres y alumnos
-- Fecha: 2026-10-20
-- Permite al módulo de finanzas controlar de forma masiva o individual si los padres pueden ver las notas de sus hijos.

-- 1. Agregar columna grades_released a la tabla students
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS grades_released boolean DEFAULT false;

-- 2. Tabla específica para registrar liberaciones por ciclo escolar y centro
CREATE TABLE IF NOT EXISTS public.student_portal_releases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  center_id uuid REFERENCES public.centers(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  school_year text DEFAULT '2026-2027',
  is_released boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, school_year)
);

-- 3. Habilitar RLS
ALTER TABLE public.student_portal_releases ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'student_portal_releases' AND policyname = 'Allow authenticated read portal releases'
  ) THEN
    CREATE POLICY "Allow authenticated read portal releases"
      ON public.student_portal_releases FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'student_portal_releases' AND policyname = 'Allow authenticated manage portal releases'
  ) THEN
    CREATE POLICY "Allow authenticated manage portal releases"
      ON public.student_portal_releases FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 5. Preferencia persistente de modelo de timbre en perfil de usuario
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bell_sound text DEFAULT 'traditional';

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bell_settings jsonb DEFAULT '{}'::jsonb;

