-- 1. Actualizar el constraint de la tabla de libro contable (ledger entries)
ALTER TABLE finance_ledger_entries DROP CONSTRAINT IF EXISTS finance_ledger_entries_cash_account_check;

ALTER TABLE finance_ledger_entries ADD CONSTRAINT finance_ledger_entries_cash_account_check 
CHECK (cash_account IN ('caja_chica', 'banco', 'caja_general', 'cuenta_banco'));

-- 2. Actualizar el constraint de la tabla de gastos (expenses) si existe
ALTER TABLE finance_expenses DROP CONSTRAINT IF EXISTS finance_expenses_cash_account_check;

ALTER TABLE finance_expenses ADD CONSTRAINT finance_expenses_cash_account_check 
CHECK (cash_account IN ('caja_chica', 'banco', 'caja_general', 'cuenta_banco'));
