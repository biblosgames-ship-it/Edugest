-- =======================================================
-- TABLA DE ENTREGAS Y ESTADOS DE TAREAS (ALUMNOS Y PADRES)
-- =======================================================

CREATE TABLE IF NOT EXISTS public.task_submissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    center_id uuid REFERENCES public.centers(id) ON DELETE CASCADE,
    task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending', -- 'completed', 'pending', 'uncompleted'
    score numeric,
    feedback text,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Índice único para garantizar una sola entrega por estudiante por tarea
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_submissions_task_student 
    ON public.task_submissions(task_id, student_id);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_task_submissions_student_center 
    ON public.task_submissions(center_id, student_id);

CREATE INDEX IF NOT EXISTS idx_task_submissions_task 
    ON public.task_submissions(task_id);

-- Habilitar Seguridad (RLS)
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on task_submissions" ON public.task_submissions;
CREATE POLICY "Allow all on task_submissions" 
    ON public.task_submissions FOR ALL 
    USING (true) 
    WITH CHECK (true);

GRANT ALL ON public.task_submissions TO anon, authenticated, service_role;
