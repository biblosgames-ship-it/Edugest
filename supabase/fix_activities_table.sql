-- ==========================================
-- PARCHE: AGREGAR COLUMNA 'TYPE' Y RLS A ACTIVITIES
-- ==========================================

-- 1. Agregar la columna 'type' si no existe
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS type text DEFAULT 'event';

-- 2. Asegurar que las actividades antiguas tengan el tipo 'event'
UPDATE public.activities SET type = 'event' WHERE type IS NULL;

-- 3. Habilitar RLS (Seguridad de Fila)
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- 4. Aplicar Política de Aislamiento Multi-tenancy
-- Esto asegura que cada centro educativo solo vea sus propias actividades.
DROP POLICY IF EXISTS "saas_isolation" ON public.activities;
CREATE POLICY "saas_isolation" ON public.activities 
FOR ALL TO authenticated 
USING (center_id = public.get_my_center_id()) 
WITH CHECK (center_id = public.get_my_center_id());

-- ==========================================
-- FIN DEL PARCHE
-- ==========================================
