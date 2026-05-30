-- =========================================================================
-- SCRIPT PARA ELIMINAR LAS RESTRICCIONES DE CLAVE FORÁNEA EN ASSIGNEE_ID
-- =========================================================================
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.
--
-- Esto permite asignar personal (desde la tabla staff o teachers) que no
-- posea un registro de usuario en auth.users(id).

ALTER TABLE public.facility_areas 
  DROP CONSTRAINT IF EXISTS facility_areas_assignee_id_fkey;

ALTER TABLE public.facility_tasks 
  DROP CONSTRAINT IF EXISTS facility_tasks_assignee_id_fkey;

ALTER TABLE public.facility_incidents 
  DROP CONSTRAINT IF EXISTS facility_incidents_assignee_id_fkey;
