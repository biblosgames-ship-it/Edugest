-- 1. Asegurar que las columnas existan en la tabla parents
ALTER TABLE public.parents ADD COLUMN IF NOT EXISTS center_id uuid REFERENCES public.centers(id) ON DELETE CASCADE;
ALTER TABLE public.parents ADD COLUMN IF NOT EXISTS id_card text;
ALTER TABLE public.parents ADD COLUMN IF NOT EXISTS address text;

-- 2. Backfill: Copiar el center_id del alumno a todos los registros de padres/tutores existentes que no lo tengan
UPDATE public.parents p
SET center_id = s.center_id
FROM public.students s
WHERE p.student_id = s.id
  AND (p.center_id IS NULL OR p.center_id != s.center_id);

-- 3. Crear índice para optimizar consultas de tutores por centro y estudiante
CREATE INDEX IF NOT EXISTS idx_parents_center_id ON public.parents(center_id);
CREATE INDEX IF NOT EXISTS idx_parents_student_id ON public.parents(student_id);

-- 4. Asegurar políticas RLS permisivas para administración del centro
DROP POLICY IF EXISTS "Admins can manage parents" ON public.parents;
DROP POLICY IF EXISTS "Center members can access parents" ON public.parents;

CREATE POLICY "Center members can access parents" ON public.parents
  FOR ALL
  USING (
    center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid())
    OR student_id IN (SELECT id FROM public.students WHERE center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid()))
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'superadmin')
  );
