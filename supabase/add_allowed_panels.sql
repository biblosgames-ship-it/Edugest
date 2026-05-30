-- ========================================================
-- EDUGENS: SOPORTE PARA PERMISOS DE PANELES Y ROL FINANZAS
-- ========================================================

-- 1. Añadir columnas de paneles permitidos si no existen
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allowed_panels text[] DEFAULT '{}';
ALTER TABLE public.invitation_codes ADD COLUMN IF NOT EXISTS allowed_panels text[] DEFAULT '{}';

-- 2. Modificar la restricción de roles en la tabla profiles para incluir 'finance'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'coordinator', 'creator', 'teacher', 'student', 'parent', 'finance'));

-- 3. Actualizar políticas de RLS para soportar la lectura de códigos de invitación creados
-- Asegurar que el creador y los administradores puedan gestionar códigos sin problemas
DROP POLICY IF EXISTS "Admins can manage invitation_codes" ON public.invitation_codes;
CREATE POLICY "Admins can manage invitation_codes" 
  ON public.invitation_codes FOR ALL 
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE (role = 'admin' OR role = 'coordinator') 
      AND center_id = invitation_codes.center_id
    )
  );

-- 4. Permitir lectura pública de códigos de invitación sin autenticación (requerido para registrarse)
DROP POLICY IF EXISTS "Anyone can select invitation_codes" ON public.invitation_codes;
CREATE POLICY "Anyone can select invitation_codes" 
  ON public.invitation_codes FOR SELECT 
  USING (is_used = false);
