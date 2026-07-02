-- Migration: Create finance ledger categories and entries for SaaS multi-tenancy
-- Created at: 2026-07-02

-- 1. Crear Tabla de Categorías Contables
CREATE TABLE IF NOT EXISTS public.finance_ledger_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  items JSONB DEFAULT '[]'::jsonb, -- Lista de conceptos y precios [{name: string, price: number}]
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_center_category_name UNIQUE (center_id, name, type)
);

-- 2. Crear Tabla de Entradas de Libro Contable
CREATE TABLE IF NOT EXISTS public.finance_ledger_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE NOT NULL,
  transaction_id UUID REFERENCES public.finance_transactions(id) ON DELETE CASCADE, -- Vinculado a pago (auto-eliminable si se anula)
  date DATE NOT NULL,
  account TEXT NOT NULL, -- Nombre de la cuenta (categoría)
  item TEXT, -- Nombre del alumno, proveedor, etc.
  desc TEXT, -- Descripción de la transacción
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC NOT NULL DEFAULT 0,
  method TEXT NOT NULL, -- Método de pago (cash, transfer, card, check)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Habilitar RLS
ALTER TABLE public.finance_ledger_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_ledger_entries ENABLE ROW LEVEL SECURITY;

-- 4. Crear Políticas de Aislamiento SaaS Multi-Centro
DROP POLICY IF EXISTS "saas_isolation" ON public.finance_ledger_categories;
CREATE POLICY "saas_isolation" ON public.finance_ledger_categories 
  FOR ALL TO authenticated 
  USING (center_id = public.get_my_center_id()) 
  WITH CHECK (center_id = public.get_my_center_id());

DROP POLICY IF EXISTS "saas_isolation" ON public.finance_ledger_entries;
CREATE POLICY "saas_isolation" ON public.finance_ledger_entries 
  FOR ALL TO authenticated 
  USING (center_id = public.get_my_center_id()) 
  WITH CHECK (center_id = public.get_my_center_id());
