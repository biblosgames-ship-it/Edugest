-- Creación de la Tabla de Personal Institucional
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id UUID REFERENCES centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  team TEXT NOT NULL, -- management, teacher, administrative, support
  position TEXT,      -- Cargo específico (ej: Director, Secretaria, Conserje)
  phone TEXT,
  email TEXT,         -- Email de contacto (opcional, no para login)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Políticas de Seguridad (Multi-Tenant)
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v1_read_staff" ON staff FOR SELECT TO authenticated USING (true);

CREATE POLICY "v1_admin_insert_staff" ON staff FOR INSERT TO authenticated 
WITH CHECK (center_id = (SELECT center_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "v1_admin_update_staff" ON staff FOR UPDATE TO authenticated 
USING (center_id = (SELECT center_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "v1_admin_delete_staff" ON staff FOR DELETE TO authenticated 
USING (center_id = (SELECT center_id FROM profiles WHERE id = auth.uid()));

-- Migrar docentes existentes al nuevo registro (opcional, para no perder datos)
-- INSERT INTO staff (id, center_id, name, team, position)
-- SELECT id, center_id, name, 'teacher', 'Docente' FROM teachers
-- ON CONFLICT (id) DO NOTHING;

