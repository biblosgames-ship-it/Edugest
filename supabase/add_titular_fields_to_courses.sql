-- Migración para agregar soporte de Docente Titular / Maestro Guía y apertura de semana los Lunes
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS titular_teacher_id UUID,
ADD COLUMN IF NOT EXISTS titular_subject_id UUID,
ADD COLUMN IF NOT EXISTS titular_monday_first_hour BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_courses_titular_teacher ON public.courses(titular_teacher_id);
