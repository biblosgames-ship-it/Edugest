-- Actualización de campos para Personal Institucional
ALTER TABLE staff ADD COLUMN IF NOT EXISTS gender TEXT; -- Femenino / Masculino
ALTER TABLE staff ADD COLUMN IF NOT EXISTS employment_type TEXT; -- Privado / MINERD
