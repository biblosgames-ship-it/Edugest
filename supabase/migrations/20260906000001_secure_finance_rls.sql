-- ============================================================================
-- PARCHE DE SEGURIDAD Y AISLAMIENTO SAAS: TABLAS FINANCIERAS (FASE 1)
-- ============================================================================

-- 1. Actualizar helper is_admin_of_center para incluir roles de finanzas y dirección
CREATE OR REPLACE FUNCTION public.is_admin_of_center(p_center_id uuid)
RETURNS boolean AS $$
DECLARE
  v_role text;
  v_center_id uuid;
BEGIN
  SELECT role, center_id INTO v_role, v_center_id FROM public.profiles WHERE id = auth.uid();
  RETURN (
    v_role IN ('admin', 'coordinator', 'creator', 'finance', 'director', 'superadmin') 
    AND v_center_id = p_center_id
  ) OR public.is_superadmin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Habilitar RLS en tablas de finanzas si no estuviera activo
ALTER TABLE public.finance_payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_scholarships ENABLE ROW LEVEL SECURITY;

-- 3. Limpiar políticas previas para evitar duplicidad o conflictos
DROP POLICY IF EXISTS "finance_plans_read" ON public.finance_payment_plans;
DROP POLICY IF EXISTS "finance_plans_write" ON public.finance_payment_plans;
DROP POLICY IF EXISTS "finance_invoices_read" ON public.finance_invoices;
DROP POLICY IF EXISTS "finance_invoices_write" ON public.finance_invoices;
DROP POLICY IF EXISTS "finance_tx_read" ON public.finance_transactions;
DROP POLICY IF EXISTS "finance_tx_write" ON public.finance_transactions;
DROP POLICY IF EXISTS "finance_scholarships_read" ON public.finance_scholarships;
DROP POLICY IF EXISTS "finance_scholarships_write" ON public.finance_scholarships;

-- 4. POLÍTICAS DE LECTURA (SELECT): Miembros autenticados del mismo centro
CREATE POLICY "finance_plans_read" ON public.finance_payment_plans
  FOR SELECT TO authenticated
  USING (center_id = public.get_my_center_id() OR public.is_superadmin());

CREATE POLICY "finance_invoices_read" ON public.finance_invoices
  FOR SELECT TO authenticated
  USING (center_id = public.get_my_center_id() OR public.is_superadmin());

CREATE POLICY "finance_tx_read" ON public.finance_transactions
  FOR SELECT TO authenticated
  USING (center_id = public.get_my_center_id() OR public.is_superadmin());

CREATE POLICY "finance_scholarships_read" ON public.finance_scholarships
  FOR SELECT TO authenticated
  USING (center_id = public.get_my_center_id() OR public.is_superadmin());

-- 5. POLÍTICAS DE GESTIÓN (INSERT, UPDATE, DELETE): Solo Administradores y Personal de Finanzas
CREATE POLICY "finance_plans_write" ON public.finance_payment_plans
  FOR ALL TO authenticated
  USING (public.is_admin_of_center(center_id))
  WITH CHECK (public.is_admin_of_center(center_id));

CREATE POLICY "finance_invoices_write" ON public.finance_invoices
  FOR ALL TO authenticated
  USING (public.is_admin_of_center(center_id))
  WITH CHECK (public.is_admin_of_center(center_id));

CREATE POLICY "finance_tx_write" ON public.finance_transactions
  FOR ALL TO authenticated
  USING (public.is_admin_of_center(center_id))
  WITH CHECK (public.is_admin_of_center(center_id));

CREATE POLICY "finance_scholarships_write" ON public.finance_scholarships
  FOR ALL TO authenticated
  USING (public.is_admin_of_center(center_id))
  WITH CHECK (public.is_admin_of_center(center_id));

-- 6. Índices para acelerar consultas y evitar caídas por lentitud en tablas financieras
CREATE INDEX IF NOT EXISTS idx_finance_invoices_center_period ON public.finance_invoices (center_id, period);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_student ON public.finance_invoices (student_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_center ON public.finance_transactions (center_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_invoice ON public.finance_transactions (invoice_id);
CREATE INDEX IF NOT EXISTS idx_finance_payment_plans_center ON public.finance_payment_plans (center_id, course_id);
