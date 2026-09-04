-- ==============================================================================
-- MIGRACIÓN DE TABLAS DE MI AULA: ASISTENCIA, ANECDOTARIO Y CALIFICACIONES
-- ==============================================================================

-- 1. Actualizar tabla attendance_records para soportar asistencia de estudiantes
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Permitir que teacher_id sea opcional (ya que para estudiantes no es obligatorio)
ALTER TABLE public.attendance_records ALTER COLUMN teacher_id DROP NOT NULL;

-- Eliminar restricción de check antigua de status si existe
DO $$
BEGIN
  ALTER TABLE public.attendance_records DROP CONSTRAINT IF EXISTS attendance_records_status_check;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Añadir nueva restricción flexible para status
DO $$
BEGIN
  ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_status_check 
    CHECK (status IN ('presente', 'tardanza', 'excusa', 'ausente', 'asistencia', 'ausencia', 'calificaciones', 'planificacion', 'acompanamiento'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Índice único para evitar duplicados en la asistencia del mismo estudiante en el mismo curso y fecha
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_records_student_date 
  ON public.attendance_records (center_id, student_id, course_id, date) 
  WHERE student_id IS NOT NULL;

-- Asegurar RLS en attendance_records
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on attendance_records" ON public.attendance_records;
CREATE POLICY "Allow all on attendance_records" ON public.attendance_records FOR ALL USING (true) WITH CHECK (true);


-- 2. Crear tabla de Apuntes y Anecdotario de Estudiantes en la nube
CREATE TABLE IF NOT EXISTS public.student_anecdotal_notes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  center_id uuid REFERENCES public.centers(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  teacher_name text,
  category text DEFAULT 'Conducta',
  content text NOT NULL,
  date text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_anecdotal_student ON public.student_anecdotal_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_student_anecdotal_course ON public.student_anecdotal_notes(course_id);

ALTER TABLE public.student_anecdotal_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on student_anecdotal_notes" ON public.student_anecdotal_notes;
CREATE POLICY "Allow all on student_anecdotal_notes" ON public.student_anecdotal_notes FOR ALL USING (true) WITH CHECK (true);


-- 3. Crear tabla para Calificaciones Parciales y Actividades de Mi Aula
CREATE TABLE IF NOT EXISTS public.student_partial_activities (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  center_id uuid REFERENCES public.centers(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  period text NOT NULL,
  school_year text NOT NULL,
  competency_id text NOT NULL,
  activity_name text NOT NULL,
  max_score numeric DEFAULT 100,
  scores jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partial_act_course_subj ON public.student_partial_activities(center_id, course_id, subject_id, period, school_year);

ALTER TABLE public.student_partial_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on student_partial_activities" ON public.student_partial_activities;
CREATE POLICY "Allow all on student_partial_activities" ON public.student_partial_activities FOR ALL USING (true) WITH CHECK (true);


-- 4. Asegurar tabla student_grades para Registro Digital
CREATE TABLE IF NOT EXISTS public.student_grades (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  center_id uuid REFERENCES public.centers(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  school_year text NOT NULL,
  p1 numeric,
  p2 numeric,
  p3 numeric,
  p4 numeric,
  rp1 numeric,
  rp2 numeric,
  rp3 numeric,
  rp4 numeric,
  cf numeric,
  literal text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_grades_unique 
  ON public.student_grades(center_id, student_id, course_id, subject_id, school_year);

ALTER TABLE public.student_grades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on student_grades" ON public.student_grades;
CREATE POLICY "Allow all on student_grades" ON public.student_grades FOR ALL USING (true) WITH CHECK (true);
