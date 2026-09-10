-- ==============================================================================
-- MIGRACIÓN: SOPORTE DE PERIODOS Y ENLACES FIJOS DE PLATAFORMA PARA TAREAS
-- ==============================================================================

-- 1. Agregar columna de periodo escolar ('P1', 'P2', 'P3', 'P4') a la tabla de tareas
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS period text DEFAULT 'P1';

-- 2. Tabla opcional para enlaces fijos de plataformas (Google Classroom, Meet, etc.)
CREATE TABLE IF NOT EXISTS public.course_platform_links (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    center_id uuid REFERENCES public.centers(id) ON DELETE CASCADE,
    course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
    teacher_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    classroom_url text,
    meet_url text,
    other_url text,
    other_label text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.course_platform_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_platform_links_isolation" ON public.course_platform_links;
CREATE POLICY "course_platform_links_isolation" ON public.course_platform_links 
FOR ALL TO authenticated 
USING (center_id = public.get_my_center_id())
WITH CHECK (center_id = public.get_my_center_id());
