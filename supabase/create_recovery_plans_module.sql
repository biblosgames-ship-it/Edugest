-- =========================================================================
-- MIGRACIÓN: PLAN DE RECUPERACIÓN PEDAGÓGICA Y ENCUESTAS/EVALUACIÓN DOCENTE
-- =========================================================================

-- 1. TABLA: recovery_plans (Planes de Recuperación Pedagógica)
CREATE TABLE IF NOT EXISTS public.recovery_plans (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    center_id uuid REFERENCES public.centers(id) ON DELETE CASCADE,
    course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
    school_year text NOT NULL,
    period text NOT NULL DEFAULT 'P1', -- 'P1', 'P2', 'P3', 'P4' o 'FINAL'
    title text NOT NULL,
    description text,
    start_date date,
    end_date date,
    schedule_weeks jsonb DEFAULT '[]'::jsonb, -- Array de semanas con materias y fechas
    status text NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'completed'
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. TABLA: recovery_plan_students (Estudiantes y Materias asignadas al Plan)
CREATE TABLE IF NOT EXISTS public.recovery_plan_students (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    plan_id uuid REFERENCES public.recovery_plans(id) ON DELETE CASCADE,
    center_id uuid REFERENCES public.centers(id) ON DELETE CASCADE,
    course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
    original_score numeric(5,2),
    recovery_score numeric(5,2),
    status text NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'approved', 'failed'
    week_number integer DEFAULT 1,
    start_date date,
    end_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT recovery_plan_student_unique UNIQUE (plan_id, student_id, subject_id)
);

-- 3. CAMPO EN TAREAS: is_recovery y recovery_student_ids
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_recovery boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS recovery_subject_id uuid,
ADD COLUMN IF NOT EXISTS recovery_student_ids jsonb DEFAULT '[]'::jsonb;

-- 4. ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_recovery_plans_center_course ON public.recovery_plans(center_id, course_id, school_year);
CREATE INDEX IF NOT EXISTS idx_recovery_plan_students_plan ON public.recovery_plan_students(plan_id);
CREATE INDEX IF NOT EXISTS idx_recovery_plan_students_student ON public.recovery_plan_students(student_id);
CREATE INDEX IF NOT EXISTS idx_tasks_is_recovery ON public.tasks(course_id, is_recovery);

-- 5. POLÍTICAS DE AISLAMIENTO RLS (SaaS por Centro)
ALTER TABLE public.recovery_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_plan_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recovery_plans_isolation" ON public.recovery_plans;
CREATE POLICY "recovery_plans_isolation" ON public.recovery_plans
FOR ALL TO authenticated
USING (center_id = public.get_my_center_id())
WITH CHECK (center_id = public.get_my_center_id());

DROP POLICY IF EXISTS "recovery_plan_students_isolation" ON public.recovery_plan_students;
CREATE POLICY "recovery_plan_students_isolation" ON public.recovery_plan_students
FOR ALL TO authenticated
USING (center_id = public.get_my_center_id())
WITH CHECK (center_id = public.get_my_center_id());
