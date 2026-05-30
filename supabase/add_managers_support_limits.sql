-- =========================================================================
-- PARCHE: AÑADIR LÍMITES DE GESTORES Y PERSONAL DE APOYO A LOS PLANES SAAS
-- =========================================================================
-- Ejecutar este script en el editor SQL de Supabase.

ALTER TABLE public.saas_plans ADD COLUMN IF NOT EXISTS max_managers integer default 5;
ALTER TABLE public.saas_plans ADD COLUMN IF NOT EXISTS max_support integer default 5;

-- Actualizar planes existentes con valores por defecto razonables
UPDATE public.saas_plans SET max_managers = 3, max_support = 3 WHERE name = 'Básico';
UPDATE public.saas_plans SET max_managers = 10, max_support = 10 WHERE name = 'Pro';
UPDATE public.saas_plans SET max_managers = 30, max_support = 30 WHERE name = 'Premium';
UPDATE public.saas_plans SET max_managers = 9999, max_support = 9999 WHERE name = 'Ilimitado';
