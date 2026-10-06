-- ============================================================================
-- PARCHE DE SEGURIDAD Y AISLAMIENTO SAAS: LIBRO CONTABLE (CATEGORÍAS Y ENTRADAS)
-- ============================================================================

-- 1. Habilitar RLS en tablas del libro contable
ALTER TABLE public.finance_ledger_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_ledger_entries ENABLE ROW LEVEL SECURITY;

-- 2. Limpiar políticas previas que causaban violación de RLS al insertar categorías o movimientos
DROP POLICY IF EXISTS "saas_isolation" ON public.finance_ledger_categories;
DROP POLICY IF EXISTS "saas_isolation" ON public.finance_ledger_entries;
DROP POLICY IF EXISTS "finance_ledger_categories_read" ON public.finance_ledger_categories;
DROP POLICY IF EXISTS "finance_ledger_categories_write" ON public.finance_ledger_categories;
DROP POLICY IF EXISTS "finance_ledger_entries_read" ON public.finance_ledger_entries;
DROP POLICY IF EXISTS "finance_ledger_entries_write" ON public.finance_ledger_entries;

-- 3. POLÍTICAS DE LECTURA (SELECT): Miembros del centro, administradores o superadmin
CREATE POLICY "finance_ledger_categories_read" ON public.finance_ledger_categories
  FOR SELECT TO authenticated
  USING (
    center_id = public.get_my_center_id() 
    OR public.is_admin_of_center(center_id) 
    OR public.is_superadmin()
  );

CREATE POLICY "finance_ledger_entries_read" ON public.finance_ledger_entries
  FOR SELECT TO authenticated
  USING (
    center_id = public.get_my_center_id() 
    OR public.is_admin_of_center(center_id) 
    OR public.is_superadmin()
  );

-- 4. POLÍTICAS DE ESCRITURA (INSERT, UPDATE, DELETE): Personal autorizado del centro o superadmin
CREATE POLICY "finance_ledger_categories_write" ON public.finance_ledger_categories
  FOR ALL TO authenticated
  USING (
    center_id = public.get_my_center_id() 
    OR public.is_admin_of_center(center_id) 
    OR public.is_superadmin()
  )
  WITH CHECK (
    center_id = public.get_my_center_id() 
    OR public.is_admin_of_center(center_id) 
    OR public.is_superadmin()
  );

CREATE POLICY "finance_ledger_entries_write" ON public.finance_ledger_entries
  FOR ALL TO authenticated
  USING (
    center_id = public.get_my_center_id() 
    OR public.is_admin_of_center(center_id) 
    OR public.is_superadmin()
  )
  WITH CHECK (
    center_id = public.get_my_center_id() 
    OR public.is_admin_of_center(center_id) 
    OR public.is_superadmin()
  );
