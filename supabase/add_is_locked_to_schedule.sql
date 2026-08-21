-- Agregar columna is_locked a schedule_entries si no existe
ALTER TABLE public.schedule_entries ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_schedule_entries_locked ON public.schedule_entries(center_id, shift, school_year, is_locked);
