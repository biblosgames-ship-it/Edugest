-- =========================================================
-- SCRIPT PARA CREAR LA TABLA DE COMUNICACIONES EN SUPABASE
-- =========================================================
-- Si experimentas problemas al enviar o recibir comunicados/excusas,
-- ejecuta este script en el SQL Editor de tu Dashboard de Supabase.

-- 1. Crear tabla de comunicaciones si no existe
CREATE TABLE IF NOT EXISTS public.communications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT,
  motive TEXT,
  message TEXT,
  target_roles TEXT[],
  target_courses UUID[],
  target_teachers UUID[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilitar RLS (Seguridad a Nivel de Fila)
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas RLS
DROP POLICY IF EXISTS "Users can view communications in their center" ON public.communications;
CREATE POLICY "Users can view communications in their center" 
ON public.communications 
FOR SELECT 
USING (center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins/Teachers can create communications" ON public.communications;
CREATE POLICY "Admins/Teachers can create communications" 
ON public.communications 
FOR INSERT 
WITH CHECK (center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid()));
