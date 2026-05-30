-- =========================================================================
-- PARCHE: PERMITIR A LOS CENTROS LEER SU PROPIA LICENCIA DE SUSCRIPCIÓN
-- =========================================================================
-- Ejecutar este script en el editor SQL de Supabase para habilitar que el
-- frontend verifique las fechas de vencimiento de la suscripción del centro.

-- 1. Asegurar la política de lectura para usuarios del mismo centro
DROP POLICY IF EXISTS "Users can read their own center license" ON public.saas_licenses;
CREATE POLICY "Users can read their own center license"
  ON public.saas_licenses FOR SELECT
  USING (used_by_center = (SELECT center_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));
