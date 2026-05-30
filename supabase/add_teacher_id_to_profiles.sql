-- MIGRACIÓN: Vincular perfiles digitales con docentes, cursos de estudiantes y cursos de padres
-- Añade las columnas teacher_id, course_id y parent_course_ids a la tabla de perfiles para persistencia en Supabase

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS teacher_id uuid,
ADD COLUMN IF NOT EXISTS course_id uuid,
ADD COLUMN IF NOT EXISTS parent_course_ids uuid[];

-- Políticas de seguridad para permitir a los usuarios actualizar sus propias vinculaciones
DROP POLICY IF EXISTS "Users can update their own teacher_id" ON public.profiles;
CREATE POLICY "Users can update their own teacher_id" 
ON public.profiles 
FOR UPDATE 
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own course_id" ON public.profiles;
CREATE POLICY "Users can update their own course_id" 
ON public.profiles 
FOR UPDATE 
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own parent_course_ids" ON public.profiles;
CREATE POLICY "Users can update their own parent_course_ids" 
ON public.profiles 
FOR UPDATE 
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
