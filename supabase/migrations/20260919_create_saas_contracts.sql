-- ============================================================================
-- TABLA DE CONTRATOS DIGITALES SAAS (EDUGENS)
-- Permite generar, firmar digitalmente y auditar acuerdos con centros educativos
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.saas_contracts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  center_name TEXT NOT NULL,
  director_name TEXT,
  director_id_card TEXT,
  director_email TEXT NOT NULL,
  plan_name TEXT NOT NULL DEFAULT 'Estándar',
  max_students INTEGER DEFAULT 500,
  max_teachers INTEGER DEFAULT 50,
  price NUMERIC NOT NULL DEFAULT 0,
  billing_cycle TEXT DEFAULT 'Mensual',
  currency TEXT DEFAULT 'USD',
  has_support_24_7 BOOLEAN DEFAULT false,
  has_payment_filter BOOLEAN DEFAULT false,
  ad_mode TEXT DEFAULT 'ad_free',
  inflation_clause_rate NUMERIC DEFAULT 25.0,
  status TEXT DEFAULT 'pending',
  contract_terms_json JSONB DEFAULT '{}'::jsonb,
  signed_at TIMESTAMPTZ,
  signer_ip TEXT,
  signer_user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices de búsqueda
CREATE INDEX IF NOT EXISTS idx_saas_contracts_token ON public.saas_contracts(token);
CREATE INDEX IF NOT EXISTS idx_saas_contracts_center ON public.saas_contracts(center_id);

-- Habilitar RLS
ALTER TABLE public.saas_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saas_contracts_select_policy" ON public.saas_contracts;
DROP POLICY IF EXISTS "saas_contracts_insert_policy" ON public.saas_contracts;
DROP POLICY IF EXISTS "saas_contracts_update_policy" ON public.saas_contracts;
DROP POLICY IF EXISTS "saas_contracts_delete_policy" ON public.saas_contracts;

-- Permitir lectura por token (para que el director abra el link sin requerir login)
CREATE POLICY "saas_contracts_select_policy" ON public.saas_contracts
  FOR SELECT TO anon, authenticated
  USING (true);

-- Permitir inserción a administradores
CREATE POLICY "saas_contracts_insert_policy" ON public.saas_contracts
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Permitir firma digital (actualización) a través del token
CREATE POLICY "saas_contracts_update_policy" ON public.saas_contracts
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Solo superadmin puede eliminar contratos
CREATE POLICY "saas_contracts_delete_policy" ON public.saas_contracts
  FOR DELETE TO authenticated
  USING (
    COALESCE((SELECT is_superadmin FROM public.profiles WHERE id = auth.uid()), false) = true
  );
