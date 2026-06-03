-- Migration: Create finance inventory and integrate with invoices
-- Created at: 2026-06-03

-- 1. Crear Tabla de Productos de Inventario
CREATE TABLE IF NOT EXISTS public.finance_products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT NOT NULL, -- 'uniform', 'book', 'material', 'other'
  price NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Modificar Tabla de Facturas para Vincular Productos
ALTER TABLE public.finance_invoices ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.finance_products(id) ON DELETE SET NULL;
ALTER TABLE public.finance_invoices ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- 3. Habilitar RLS en Tabla de Productos
ALTER TABLE public.finance_products ENABLE ROW LEVEL SECURITY;

-- 4. Crear Política de Aislamiento SaaS Multi-Centro
DROP POLICY IF EXISTS "saas_isolation" ON public.finance_products;
CREATE POLICY "saas_isolation" ON public.finance_products 
  FOR ALL TO authenticated 
  USING (center_id = public.get_my_center_id()) 
  WITH CHECK (center_id = public.get_my_center_id());

-- 5. Función y Trigger para Restar Stock al Facturar
CREATE OR REPLACE FUNCTION public.handle_invoice_product_stock_deduction()
RETURNS trigger AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.finance_products
    SET stock = stock - COALESCE(NEW.quantity, 1)
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_invoice_product_created ON public.finance_invoices;
CREATE TRIGGER on_invoice_product_created
  AFTER INSERT ON public.finance_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invoice_product_stock_deduction();

-- 6. Función y Trigger para Restaurar Stock al Eliminar Factura
CREATE OR REPLACE FUNCTION public.handle_invoice_product_stock_restoration()
RETURNS trigger AS $$
BEGIN
  IF OLD.product_id IS NOT NULL THEN
    UPDATE public.finance_products
    SET stock = stock + COALESCE(OLD.quantity, 1)
    WHERE id = OLD.product_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_invoice_product_deleted ON public.finance_invoices;
CREATE TRIGGER on_invoice_product_deleted
  AFTER DELETE ON public.finance_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invoice_product_stock_restoration();
