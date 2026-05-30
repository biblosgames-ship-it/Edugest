-- ==========================================
-- PARCHE: VINCULACIÓN DE HERMANOS (FAMILIAS)
-- ==========================================

-- 1. Agregar family_id a la tabla de estudiantes
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS family_id uuid;

-- 2. Crear un índice para búsquedas rápidas por familia
CREATE INDEX IF NOT EXISTS idx_students_family_id ON public.students(family_id);

-- 3. (Opcional) Poblar family_id inicial con un nuevo UUID para cada alumno existente
-- que no tenga uno, para que cada uno empiece siendo su propia familia.
UPDATE public.students 
SET family_id = uuid_generate_v4() 
WHERE family_id IS NULL;

-- ==========================================
-- FIN DEL PARCHE
-- ==========================================
