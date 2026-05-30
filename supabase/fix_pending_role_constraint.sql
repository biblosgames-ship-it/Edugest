-- =========================================================
-- PARCHE UNIFICADO: FIX ROLES 'PENDING' Y POLÍTICAS DE ACTIVACIÓN
-- =========================================================

-- 1. Eliminar la restricción actual de verificación de roles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Crear la restricción completa y definitiva incluyendo todos los roles válidos
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'coordinator', 'creator', 'teacher', 'student', 'parent', 'finance', 'pending'));

-- 3. Permitir a usuarios autenticados marcar códigos de invitación válidos como usados
DROP POLICY IF EXISTS "Users can mark invitation codes as used" ON public.invitation_codes;
CREATE POLICY "Users can mark invitation codes as used"
  ON public.invitation_codes FOR UPDATE
  TO authenticated
  USING (is_used = false)
  WITH CHECK (is_used = true);
