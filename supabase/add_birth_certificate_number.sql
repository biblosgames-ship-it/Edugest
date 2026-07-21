-- Ejecuta este script en el editor SQL de Supabase para añadir el campo del número de acta de nacimiento
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS birth_certificate_number text;
