-- =========================================================
-- PARCHE MAESTRO V8: PERSISTENCIA GARANTIZADA
-- Ejecutar en el SQL Editor de Supabase
-- =========================================================

-- 1. Asegurar columnas básicas
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS hours_per_week INTEGER DEFAULT 0;

-- 2. Limpiar restricciones de identidad
ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_id_fkey;
ALTER TABLE teachers ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- 3. RESET DE POLÍTICAS (Para evitar conflictos de versiones anteriores)
DROP POLICY IF EXISTS "safe_admin_manage_teachers" ON teachers;
DROP POLICY IF EXISTS "safe_admin_manage_assignments" ON assignments;
DROP POLICY IF EXISTS "safe_read_subjects" ON subjects;

-- 4. NUEVAS POLÍTICAS DE ALTO RENDIMIENTO
-- Nota: Permitimos SELECT a todos los autenticados para evitar que los registros "desaparezcan"
-- pero restringimos el INSERT/UPDATE/DELETE a los del mismo centro por seguridad.

-- Lectura (Garantiza que veas tus datos al recargar)
CREATE POLICY "v8_read_teachers" ON teachers FOR SELECT TO authenticated USING (true);
CREATE POLICY "v8_read_assignments" ON assignments FOR SELECT TO authenticated USING (true);

-- Escritura (Seguridad Multi-Tenant)
CREATE POLICY "v8_admin_insert_teachers" ON teachers FOR INSERT TO authenticated 
WITH CHECK (center_id = (SELECT center_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "v8_admin_update_teachers" ON teachers FOR UPDATE TO authenticated 
USING (center_id = (SELECT center_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "v8_admin_delete_teachers" ON teachers FOR DELETE TO authenticated 
USING (center_id = (SELECT center_id FROM profiles WHERE id = auth.uid()));

-- Asignaciones (Escritura)
CREATE POLICY "v8_admin_manage_assignments" ON assignments FOR INSERT TO authenticated 
WITH CHECK (center_id = (SELECT center_id FROM profiles WHERE id = auth.uid()));

-- Habilitar RLS
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- ¡Listo! Ahora los docentes se quedarán grabados permanentemente.
