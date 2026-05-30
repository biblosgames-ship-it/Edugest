-- =========================================================================
-- PARCHE: AÑADIR CONTROL DE PERMISO DE EDICIÓN DE NOTAS A LA TABLA STAFF
-- =========================================================================
-- Ejecutar este script en el editor SQL de Supabase.

-- 1. Añadir la columna grades_editable a la tabla staff
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS grades_editable boolean default true;

-- 2. Asegurarse de que todos los registros de personal existentes tengan el valor en true por defecto
UPDATE public.staff SET grades_editable = true WHERE grades_editable IS NULL;
