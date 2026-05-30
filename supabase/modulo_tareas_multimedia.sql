-- ==========================================
-- TABLAS PARA TAREAS Y COMUNICADOS MULTIMEDIA
-- ==========================================

-- 1. Tabla de Tareas
CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    center_id uuid REFERENCES public.centers(id) ON DELETE CASCADE,
    course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
    teacher_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    due_date timestamp with time zone,
    media_url text, -- Para Imágenes o YouTube
    link_url text,  -- Enlaces externos
    classroom_url text, -- Link directo a Classroom
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Tabla de Comunicados (Anuncios)
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    center_id uuid REFERENCES public.centers(id) ON DELETE CASCADE,
    course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
    sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_role text,
    title text NOT NULL,
    content text,
    media_url text,
    link_url text,
    created_at timestamp with time zone DEFAULT now()
);

-- 3. Habilitar Seguridad (RLS)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Aislamiento (SaaS)
DROP POLICY IF EXISTS "tasks_isolation" ON public.tasks;
CREATE POLICY "tasks_isolation" ON public.tasks 
FOR ALL TO authenticated 
USING (center_id = public.get_my_center_id())
WITH CHECK (center_id = public.get_my_center_id());

DROP POLICY IF EXISTS "announcements_isolation" ON public.announcements;
CREATE POLICY "announcements_isolation" ON public.announcements 
FOR ALL TO authenticated 
USING (center_id = public.get_my_center_id())
WITH CHECK (center_id = public.get_my_center_id());
