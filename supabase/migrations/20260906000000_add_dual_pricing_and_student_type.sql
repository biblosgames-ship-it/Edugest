-- Migración: Soporte de tarifas diferenciadas (Nuevos vs Antiguos)
-- Fecha: 2026-09-06

-- 1. Agregar columna student_type a la tabla students
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS student_type text DEFAULT 'antiguo';

-- 2. Asegurar que los registros existentes sean 'antiguo'
UPDATE public.students 
SET student_type = 'antiguo' 
WHERE student_type IS NULL;

-- 3. Agregar columnas de tarifas diferenciadas a finance_payment_plans
ALTER TABLE public.finance_payment_plans 
ADD COLUMN IF NOT EXISTS has_dual_pricing boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS enrollment_fee_new numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS monthly_fee_new numeric DEFAULT NULL;
