-- ============================================================================
-- MIGRACIÓN DE RENDIMIENTO Y ESCALABILIDAD MULTI-CENTRO (EDUGENS)
-- Fecha: 2026-09-25
-- Descripción:
--   Crea índices B-Tree en la columna 'center_id' y columnas de alta frecuencia
--   en todas las tablas multi-tenant.
--
-- SEGURIDAD:
--   - No elimina ni modifica ningún dato existente.
--   - No altera permisos, usuarios ni configuraciones de centros.
--   - Es 100% idempotente (usa IF NOT EXISTS).
-- ============================================================================

-- 0. OPTIMIZACIÓN DE FUNCIÓN RLS (Cálculo único por consulta en vez de por fila)
CREATE OR REPLACE FUNCTION public.get_my_center_id()
RETURNS uuid AS $$
BEGIN
  RETURN (SELECT center_id FROM public.profiles WHERE id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 1. IDENTIDAD Y PERFILES
CREATE INDEX IF NOT EXISTS idx_profiles_center_id 
  ON public.profiles(center_id);

CREATE INDEX IF NOT EXISTS idx_profiles_role 
  ON public.profiles(center_id, role);

CREATE INDEX IF NOT EXISTS idx_invitation_codes_center_id 
  ON public.invitation_codes(center_id);

-- 2. ESTUDIANTES Y FAMILIAS
CREATE INDEX IF NOT EXISTS idx_students_center_id 
  ON public.students(center_id);

CREATE INDEX IF NOT EXISTS idx_students_center_course 
  ON public.students(center_id, course_id);

CREATE INDEX IF NOT EXISTS idx_students_school_year 
  ON public.students(center_id, school_year);

CREATE INDEX IF NOT EXISTS idx_parents_center_id 
  ON public.parents(center_id);

CREATE INDEX IF NOT EXISTS idx_parents_student_id 
  ON public.parents(student_id);

CREATE INDEX IF NOT EXISTS idx_student_medical_student_id 
  ON public.student_medical(student_id);

CREATE INDEX IF NOT EXISTS idx_student_history_student_id 
  ON public.student_history(student_id);

CREATE INDEX IF NOT EXISTS idx_student_documents_student_id 
  ON public.student_documents(student_id);

-- 3. CALIFICACIONES Y SEGUIMIENTO ACADÉMICO (TABLAS DE ALTO VOLUMEN)
CREATE INDEX IF NOT EXISTS idx_student_grades_center_id 
  ON public.student_grades(center_id);

CREATE INDEX IF NOT EXISTS idx_student_grades_composite 
  ON public.student_grades(center_id, student_id, course_id);

CREATE INDEX IF NOT EXISTS idx_student_anecdotal_center_id 
  ON public.student_anecdotal_notes(center_id);

CREATE INDEX IF NOT EXISTS idx_student_partial_act_center_id 
  ON public.student_partial_activities(center_id);

CREATE INDEX IF NOT EXISTS idx_performance_alerts_center_id 
  ON public.performance_alerts(center_id);

-- 4. ESTRUCTURA ACADÉMICA (CURSOS, ASIGNATURAS, ASIGNACIONES)
CREATE INDEX IF NOT EXISTS idx_courses_center_id 
  ON public.courses(center_id);

CREATE INDEX IF NOT EXISTS idx_subjects_center_id 
  ON public.subjects(center_id);

CREATE INDEX IF NOT EXISTS idx_school_years_center_id 
  ON public.school_years(center_id);

CREATE INDEX IF NOT EXISTS idx_assignments_center_id 
  ON public.assignments(center_id);

CREATE INDEX IF NOT EXISTS idx_assignments_center_teacher 
  ON public.assignments(center_id, teacher_id);

CREATE INDEX IF NOT EXISTS idx_assignments_center_course 
  ON public.assignments(center_id, course_id);

CREATE INDEX IF NOT EXISTS idx_academic_requirements_center_id 
  ON public.academic_requirements(center_id);

-- 5. PERSONAL DOCENTE Y ADMINISTRATIVO
CREATE INDEX IF NOT EXISTS idx_teachers_center_id 
  ON public.teachers(center_id);

CREATE INDEX IF NOT EXISTS idx_staff_center_id 
  ON public.staff(center_id);

-- 6. HORARIOS Y AULAS
CREATE INDEX IF NOT EXISTS idx_schedule_entries_center_id 
  ON public.schedule_entries(center_id);

CREATE INDEX IF NOT EXISTS idx_schedule_entries_lookup 
  ON public.schedule_entries(center_id, school_year, shift);

CREATE INDEX IF NOT EXISTS idx_rooms_center_id 
  ON public.rooms(center_id);

CREATE INDEX IF NOT EXISTS idx_time_blocks_center_id 
  ON public.time_blocks(center_id);

CREATE INDEX IF NOT EXISTS idx_level_schedules_center_id 
  ON public.level_schedules(center_id);

CREATE INDEX IF NOT EXISTS idx_fixed_events_center_id 
  ON public.fixed_events(center_id);

CREATE INDEX IF NOT EXISTS idx_teacher_preferences_center_id 
  ON public.teacher_preferences(center_id);

CREATE INDEX IF NOT EXISTS idx_break_preferences_center_id 
  ON public.break_preferences(center_id);

CREATE INDEX IF NOT EXISTS idx_winter_preferences_center_id 
  ON public.winter_schedule_preferences(center_id);

-- 7. TAREAS, ANUNCIOS Y COMUNICACIONES
CREATE INDEX IF NOT EXISTS idx_tasks_center_id 
  ON public.tasks(center_id);

CREATE INDEX IF NOT EXISTS idx_tasks_center_course 
  ON public.tasks(center_id, course_id);

CREATE INDEX IF NOT EXISTS idx_announcements_center_id 
  ON public.announcements(center_id);

CREATE INDEX IF NOT EXISTS idx_announcements_center_course 
  ON public.announcements(center_id, course_id);

CREATE INDEX IF NOT EXISTS idx_communications_center_id 
  ON public.communications(center_id);

CREATE INDEX IF NOT EXISTS idx_activities_center_id 
  ON public.activities(center_id);
