-- =========================================================================
-- SISTEMA DE BACKUP Y MIGRACIÓN DE DATOS DE CENTROS (EDUGENS)
-- =========================================================================
-- Ejecuta este script en el editor SQL de Supabase.
-- Crea dos funciones remotas de base de datos para exportar e importar datos.

-- 1. FUNCIÓN DE EXPORTACIÓN
CREATE OR REPLACE FUNCTION public.export_center_data(p_center_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
  v_courses jsonb;
  v_subjects jsonb;
  v_teachers jsonb;
  v_staff jsonb;
  v_students jsonb;
  v_student_medical jsonb;
  v_student_history jsonb;
  v_student_documents jsonb;
  v_assignments jsonb;
  v_student_grades jsonb;
  v_teacher_preferences jsonb;
  v_break_preferences jsonb;
  v_winter_schedule_preferences jsonb;
  v_rooms jsonb;
  v_time_blocks jsonb;
  v_schedule_entries jsonb;
  v_announcements jsonb;
  v_tasks jsonb;
  v_activities jsonb;
  v_excuses jsonb;
  v_performance_alerts jsonb;
BEGIN
  -- Verificar que el usuario que ejecuta sea superadmin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superadmin = true) THEN
    RAISE EXCEPTION 'Acceso denegado: Se requiere rol de superadmin';
  END IF;

  -- 1. Obtener datos de tablas con center_id
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_courses FROM (SELECT * FROM public.courses WHERE center_id = p_center_id) t;
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_subjects FROM (SELECT * FROM public.subjects WHERE center_id = p_center_id) t;
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_teachers FROM (SELECT * FROM public.teachers WHERE center_id = p_center_id) t;
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_staff FROM (SELECT * FROM public.staff WHERE center_id = p_center_id) t;
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_students FROM (SELECT * FROM public.students WHERE center_id = p_center_id) t;
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_rooms FROM (SELECT * FROM public.rooms WHERE center_id = p_center_id) t;
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_time_blocks FROM (SELECT * FROM public.time_blocks WHERE center_id = p_center_id) t;
  
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_assignments FROM (SELECT * FROM public.assignments WHERE center_id = p_center_id) t;
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_student_grades FROM (SELECT * FROM public.student_grades WHERE center_id = p_center_id) t;
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_teacher_preferences FROM (SELECT * FROM public.teacher_preferences WHERE center_id = p_center_id) t;
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_break_preferences FROM (SELECT * FROM public.break_preferences WHERE center_id = p_center_id) t;
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_winter_schedule_preferences FROM (SELECT * FROM public.winter_schedule_preferences WHERE center_id = p_center_id) t;
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_schedule_entries FROM (SELECT * FROM public.schedule_entries WHERE center_id = p_center_id) t;
  
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_announcements FROM (SELECT * FROM public.announcements WHERE center_id = p_center_id) t;
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_tasks FROM (SELECT * FROM public.tasks WHERE center_id = p_center_id) t;
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_activities FROM (SELECT * FROM public.activities WHERE center_id = p_center_id) t;
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_excuses FROM (SELECT * FROM public.excuses WHERE center_id = p_center_id) t;
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_performance_alerts FROM (SELECT * FROM public.performance_alerts WHERE center_id = p_center_id) t;

  -- 2. Obtener datos de tablas dependientes del estudiante (sin center_id directo)
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_student_medical FROM (
    SELECT * FROM public.student_medical WHERE student_id IN (SELECT id FROM public.students WHERE center_id = p_center_id)
  ) t;
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_student_history FROM (
    SELECT * FROM public.student_history WHERE student_id IN (SELECT id FROM public.students WHERE center_id = p_center_id)
  ) t;
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_student_documents FROM (
    SELECT * FROM public.student_documents WHERE student_id IN (SELECT id FROM public.students WHERE center_id = p_center_id)
  ) t;

  -- 3. Construir el JSON final
  v_result := jsonb_build_object(
    'version', '1.0',
    'center_id', p_center_id,
    'exported_at', now(),
    'courses', v_courses,
    'subjects', v_subjects,
    'teachers', v_teachers,
    'staff', v_staff,
    'students', v_students,
    'rooms', v_rooms,
    'time_blocks', v_time_blocks,
    'assignments', v_assignments,
    'student_grades', v_student_grades,
    'teacher_preferences', v_teacher_preferences,
    'break_preferences', v_break_preferences,
    'winter_schedule_preferences', v_winter_schedule_preferences,
    'schedule_entries', v_schedule_entries,
    'announcements', v_announcements,
    'tasks', v_tasks,
    'activities', v_activities,
    'excuses', v_excuses,
    'performance_alerts', v_performance_alerts,
    'student_medical', v_student_medical,
    'student_history', v_student_history,
    'student_documents', v_student_documents
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. FUNCIÓN DE IMPORTACIÓN
CREATE OR REPLACE FUNCTION public.import_center_data(p_target_center_id uuid, p_backup_data jsonb)
RETURNS void AS $$
DECLARE
  v_source_center_id uuid;
BEGIN
  -- Verificar que el usuario que ejecuta sea superadmin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superadmin = true) THEN
    RAISE EXCEPTION 'Acceso denegado: Se requiere rol de superadmin';
  END IF;

  -- Obtener el center_id original desde el backup
  v_source_center_id := (p_backup_data->>'center_id')::uuid;
  IF v_source_center_id IS NULL THEN
    RAISE EXCEPTION 'Respaldo inválido: No se encontró el center_id original';
  END IF;

  -- 1. Eliminar datos existentes en el centro destino (de tablas dependientes a base)
  -- Esto evita claves duplicadas y limpia residuos operacionales previos.
  DELETE FROM public.student_medical WHERE student_id IN (SELECT id FROM public.students WHERE center_id = p_target_center_id);
  DELETE FROM public.student_history WHERE student_id IN (SELECT id FROM public.students WHERE center_id = p_target_center_id);
  DELETE FROM public.student_documents WHERE student_id IN (SELECT id FROM public.students WHERE center_id = p_target_center_id);
  
  DELETE FROM public.student_grades WHERE center_id = p_target_center_id;
  DELETE FROM public.schedule_entries WHERE center_id = p_target_center_id;
  DELETE FROM public.assignments WHERE center_id = p_target_center_id;
  DELETE FROM public.tasks WHERE center_id = p_target_center_id;
  DELETE FROM public.excuses WHERE center_id = p_target_center_id;
  DELETE FROM public.performance_alerts WHERE center_id = p_target_center_id;
  DELETE FROM public.activities WHERE center_id = p_target_center_id;
  DELETE FROM public.announcements WHERE center_id = p_target_center_id;
  DELETE FROM public.teacher_preferences WHERE center_id = p_target_center_id;
  DELETE FROM public.break_preferences WHERE center_id = p_target_center_id;
  DELETE FROM public.winter_schedule_preferences WHERE center_id = p_target_center_id;
  DELETE FROM public.students WHERE center_id = p_target_center_id;
  DELETE FROM public.subjects WHERE center_id = p_target_center_id;
  DELETE FROM public.courses WHERE center_id = p_target_center_id;
  DELETE FROM public.teachers WHERE center_id = p_target_center_id;
  DELETE FROM public.staff WHERE center_id = p_target_center_id;
  DELETE FROM public.rooms WHERE center_id = p_target_center_id;
  DELETE FROM public.time_blocks WHERE center_id = p_target_center_id;

  -- 2. Insertar los datos mapeando center_id al nuevo ID
  -- El orden debe respetar la jerarquía de claves foráneas.

  -- staff
  IF p_backup_data->'staff' IS NOT NULL AND jsonb_array_length(p_backup_data->'staff') > 0 THEN
    INSERT INTO public.staff
    SELECT * FROM jsonb_populate_recordset(null::public.staff, p_backup_data->'staff')
    ON CONFLICT (id) DO UPDATE SET center_id = p_target_center_id;
  END IF;

  -- teachers
  IF p_backup_data->'teachers' IS NOT NULL AND jsonb_array_length(p_backup_data->'teachers') > 0 THEN
    INSERT INTO public.teachers
    SELECT * FROM jsonb_populate_recordset(null::public.teachers, p_backup_data->'teachers')
    ON CONFLICT (id) DO UPDATE SET center_id = p_target_center_id;
  END IF;

  -- courses
  IF p_backup_data->'courses' IS NOT NULL AND jsonb_array_length(p_backup_data->'courses') > 0 THEN
    INSERT INTO public.courses
    SELECT * FROM jsonb_populate_recordset(null::public.courses, p_backup_data->'courses')
    ON CONFLICT (id) DO UPDATE SET center_id = p_target_center_id;
  END IF;

  -- subjects
  IF p_backup_data->'subjects' IS NOT NULL AND jsonb_array_length(p_backup_data->'subjects') > 0 THEN
    INSERT INTO public.subjects
    SELECT * FROM jsonb_populate_recordset(null::public.subjects, p_backup_data->'subjects')
    ON CONFLICT (id) DO UPDATE SET center_id = p_target_center_id;
  END IF;

  -- students
  IF p_backup_data->'students' IS NOT NULL AND jsonb_array_length(p_backup_data->'students') > 0 THEN
    INSERT INTO public.students
    SELECT * FROM jsonb_populate_recordset(null::public.students, p_backup_data->'students')
    ON CONFLICT (id) DO UPDATE SET center_id = p_target_center_id;
  END IF;

  -- rooms
  IF p_backup_data->'rooms' IS NOT NULL AND jsonb_array_length(p_backup_data->'rooms') > 0 THEN
    INSERT INTO public.rooms
    SELECT * FROM jsonb_populate_recordset(null::public.rooms, p_backup_data->'rooms')
    ON CONFLICT (id) DO UPDATE SET center_id = p_target_center_id;
  END IF;

  -- time_blocks
  IF p_backup_data->'time_blocks' IS NOT NULL AND jsonb_array_length(p_backup_data->'time_blocks') > 0 THEN
    INSERT INTO public.time_blocks
    SELECT * FROM jsonb_populate_recordset(null::public.time_blocks, p_backup_data->'time_blocks')
    ON CONFLICT (id) DO UPDATE SET center_id = p_target_center_id;
  END IF;

  -- assignments
  IF p_backup_data->'assignments' IS NOT NULL AND jsonb_array_length(p_backup_data->'assignments') > 0 THEN
    INSERT INTO public.assignments
    SELECT * FROM jsonb_populate_recordset(null::public.assignments, p_backup_data->'assignments')
    ON CONFLICT (id) DO UPDATE SET center_id = p_target_center_id;
  END IF;

  -- student_grades
  IF p_backup_data->'student_grades' IS NOT NULL AND jsonb_array_length(p_backup_data->'student_grades') > 0 THEN
    INSERT INTO public.student_grades
    SELECT * FROM jsonb_populate_recordset(null::public.student_grades, p_backup_data->'student_grades')
    ON CONFLICT (id) DO UPDATE SET center_id = p_target_center_id;
  END IF;

  -- teacher_preferences
  IF p_backup_data->'teacher_preferences' IS NOT NULL AND jsonb_array_length(p_backup_data->'teacher_preferences') > 0 THEN
    INSERT INTO public.teacher_preferences
    SELECT * FROM jsonb_populate_recordset(null::public.teacher_preferences, p_backup_data->'teacher_preferences')
    ON CONFLICT (id) DO UPDATE SET center_id = p_target_center_id;
  END IF;

  -- break_preferences
  IF p_backup_data->'break_preferences' IS NOT NULL AND jsonb_array_length(p_backup_data->'break_preferences') > 0 THEN
    INSERT INTO public.break_preferences
    SELECT * FROM jsonb_populate_recordset(null::public.break_preferences, p_backup_data->'break_preferences')
    ON CONFLICT (id) DO UPDATE SET center_id = p_target_center_id;
  END IF;

  -- winter_schedule_preferences
  IF p_backup_data->'winter_schedule_preferences' IS NOT NULL AND jsonb_array_length(p_backup_data->'winter_schedule_preferences') > 0 THEN
    INSERT INTO public.winter_schedule_preferences
    SELECT * FROM jsonb_populate_recordset(null::public.winter_schedule_preferences, p_backup_data->'winter_schedule_preferences')
    ON CONFLICT (id) DO UPDATE SET center_id = p_target_center_id;
  END IF;

  -- schedule_entries
  IF p_backup_data->'schedule_entries' IS NOT NULL AND jsonb_array_length(p_backup_data->'schedule_entries') > 0 THEN
    INSERT INTO public.schedule_entries
    SELECT * FROM jsonb_populate_recordset(null::public.schedule_entries, p_backup_data->'schedule_entries')
    ON CONFLICT (id) DO UPDATE SET center_id = p_target_center_id;
  END IF;

  -- announcements
  IF p_backup_data->'announcements' IS NOT NULL AND jsonb_array_length(p_backup_data->'announcements') > 0 THEN
    INSERT INTO public.announcements
    SELECT * FROM jsonb_populate_recordset(null::public.announcements, p_backup_data->'announcements')
    ON CONFLICT (id) DO UPDATE SET center_id = p_target_center_id;
  END IF;

  -- tasks
  IF p_backup_data->'tasks' IS NOT NULL AND jsonb_array_length(p_backup_data->'tasks') > 0 THEN
    INSERT INTO public.tasks
    SELECT * FROM jsonb_populate_recordset(null::public.tasks, p_backup_data->'tasks')
    ON CONFLICT (id) DO UPDATE SET center_id = p_target_center_id;
  END IF;

  -- activities
  IF p_backup_data->'activities' IS NOT NULL AND jsonb_array_length(p_backup_data->'activities') > 0 THEN
    INSERT INTO public.activities
    SELECT * FROM jsonb_populate_recordset(null::public.activities, p_backup_data->'activities')
    ON CONFLICT (id) DO UPDATE SET center_id = p_target_center_id;
  END IF;

  -- excuses
  IF p_backup_data->'excuses' IS NOT NULL AND jsonb_array_length(p_backup_data->'excuses') > 0 THEN
    INSERT INTO public.excuses
    SELECT * FROM jsonb_populate_recordset(null::public.excuses, p_backup_data->'excuses')
    ON CONFLICT (id) DO UPDATE SET center_id = p_target_center_id;
  END IF;

  -- performance_alerts
  IF p_backup_data->'performance_alerts' IS NOT NULL AND jsonb_array_length(p_backup_data->'performance_alerts') > 0 THEN
    INSERT INTO public.performance_alerts
    SELECT * FROM jsonb_populate_recordset(null::public.performance_alerts, p_backup_data->'performance_alerts')
    ON CONFLICT (id) DO UPDATE SET center_id = p_target_center_id;
  END IF;

  -- 3. Insertar las tablas dependientes del estudiante
  -- student_medical
  IF p_backup_data->'student_medical' IS NOT NULL AND jsonb_array_length(p_backup_data->'student_medical') > 0 THEN
    INSERT INTO public.student_medical
    SELECT * FROM jsonb_populate_recordset(null::public.student_medical, p_backup_data->'student_medical')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- student_history
  IF p_backup_data->'student_history' IS NOT NULL AND jsonb_array_length(p_backup_data->'student_history') > 0 THEN
    INSERT INTO public.student_history
    SELECT * FROM jsonb_populate_recordset(null::public.student_history, p_backup_data->'student_history')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- student_documents
  IF p_backup_data->'student_documents' IS NOT NULL AND jsonb_array_length(p_backup_data->'student_documents') > 0 THEN
    INSERT INTO public.student_documents
    SELECT * FROM jsonb_populate_recordset(null::public.student_documents, p_backup_data->'student_documents')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- 4. Actualizar todos los campos center_id al nuevo ID
  -- Esto garantiza que las filas importadas queden mapeadas al nuevo inquilino.
  UPDATE public.staff SET center_id = p_target_center_id WHERE center_id = v_source_center_id;
  UPDATE public.teachers SET center_id = p_target_center_id WHERE center_id = v_source_center_id;
  UPDATE public.courses SET center_id = p_target_center_id WHERE center_id = v_source_center_id;
  UPDATE public.subjects SET center_id = p_target_center_id WHERE center_id = v_source_center_id;
  UPDATE public.students SET center_id = p_target_center_id WHERE center_id = v_source_center_id;
  UPDATE public.rooms SET center_id = p_target_center_id WHERE center_id = v_source_center_id;
  UPDATE public.time_blocks SET center_id = p_target_center_id WHERE center_id = v_source_center_id;
  UPDATE public.assignments SET center_id = p_target_center_id WHERE center_id = v_source_center_id;
  UPDATE public.student_grades SET center_id = p_target_center_id WHERE center_id = v_source_center_id;
  UPDATE public.teacher_preferences SET center_id = p_target_center_id WHERE center_id = v_source_center_id;
  UPDATE public.break_preferences SET center_id = p_target_center_id WHERE center_id = v_source_center_id;
  UPDATE public.winter_schedule_preferences SET center_id = p_target_center_id WHERE center_id = v_source_center_id;
  UPDATE public.schedule_entries SET center_id = p_target_center_id WHERE center_id = v_source_center_id;
  UPDATE public.announcements SET center_id = p_target_center_id WHERE center_id = v_source_center_id;
  UPDATE public.tasks SET center_id = p_target_center_id WHERE center_id = v_source_center_id;
  UPDATE public.activities SET center_id = p_target_center_id WHERE center_id = v_source_center_id;
  UPDATE public.excuses SET center_id = p_target_center_id WHERE center_id = v_source_center_id;
  UPDATE public.performance_alerts SET center_id = p_target_center_id WHERE center_id = v_source_center_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
