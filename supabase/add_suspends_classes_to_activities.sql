-- ========================================================
-- AGREGAR CAMPO 'suspends_classes' A LA TABLA ACTIVITIES
-- Permite indicar si un evento, reunión o efeméride suspende docencia
-- ========================================================

ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS suspends_classes boolean DEFAULT false;

-- Comentario explicativo
COMMENT ON COLUMN public.activities.suspends_classes IS 'Indica si este evento o jornada suspende la docencia escolar (Alerta Roja Sin Docencia)';
