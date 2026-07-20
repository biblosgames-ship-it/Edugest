-- Migration: Add cash_account column to finance_ledger_entries
-- Created at: 2026-07-20
-- Purpose: Support two separate cash registers: caja_chica (physical cash) and banco (bank/reserve)

ALTER TABLE public.finance_ledger_entries
ADD COLUMN IF NOT EXISTS cash_account TEXT NOT NULL DEFAULT 'caja_chica'
CHECK (cash_account IN ('caja_chica', 'banco'));

-- Add index for fast filtering by cash_account
CREATE INDEX IF NOT EXISTS idx_finance_ledger_entries_cash_account
  ON public.finance_ledger_entries (center_id, cash_account, date);

COMMENT ON COLUMN public.finance_ledger_entries.cash_account IS
  'Tipo de caja: caja_chica = efectivo físico del día, banco = cuenta bancaria/reserva acumulada';
