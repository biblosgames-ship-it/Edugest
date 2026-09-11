-- =========================================================
-- MIGRACIÓN: EFEMÉRIDES ESCOLARES GLOBALES PARA TODOS LOS CENTROS
-- =========================================================

-- 1. Agregar columna is_global a la tabla activities si no existe
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false;

-- 2. Permitir que center_id pueda ser nulo para eventos 100% globales
ALTER TABLE public.activities 
ALTER COLUMN center_id DROP NOT NULL;

-- 3. Crear índice para optimizar consultas de actividades por centro y globales
CREATE INDEX IF NOT EXISTS idx_activities_center_global 
ON public.activities (center_id, is_global, date);

-- 4. Actualizar políticas RLS de lectura y escritura
DROP POLICY IF EXISTS "saas_isolation" ON public.activities;
DROP POLICY IF EXISTS "activities_select_policy" ON public.activities;
DROP POLICY IF EXISTS "activities_insert_policy" ON public.activities;
DROP POLICY IF EXISTS "activities_update_policy" ON public.activities;
DROP POLICY IF EXISTS "activities_delete_policy" ON public.activities;

-- Política de lectura: los usuarios autenticados pueden ver las actividades de su centro O las que sean globales
CREATE POLICY "activities_select_policy" ON public.activities 
FOR SELECT TO authenticated 
USING (
  center_id = public.get_my_center_id() 
  OR is_global = true 
  OR center_id IS NULL
);

-- Política de inserción: los usuarios pueden insertar para su propio centro, o superadmins/admins para global
CREATE POLICY "activities_insert_policy" ON public.activities 
FOR INSERT TO authenticated 
WITH CHECK (
  center_id = public.get_my_center_id() 
  OR is_global = true
);

-- Política de actualización:
CREATE POLICY "activities_update_policy" ON public.activities 
FOR UPDATE TO authenticated 
USING (
  center_id = public.get_my_center_id() 
  OR is_global = true
)
WITH CHECK (
  center_id = public.get_my_center_id() 
  OR is_global = true
);

-- Política de eliminación:
CREATE POLICY "activities_delete_policy" ON public.activities 
FOR DELETE TO authenticated 
USING (
  center_id = public.get_my_center_id() 
  OR is_global = true
);
