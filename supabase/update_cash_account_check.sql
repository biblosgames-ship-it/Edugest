-- Actualizar la regla de validación en el libro contable (ledger entries)
ALTER TABLE finance_ledger_entries DROP CONSTRAINT IF EXISTS finance_ledger_entries_cash_account_check;

ALTER TABLE finance_ledger_entries ADD CONSTRAINT finance_ledger_entries_cash_account_check 
CHECK (cash_account IN ('caja_chica', 'banco', 'caja_general', 'cuenta_banco'));
