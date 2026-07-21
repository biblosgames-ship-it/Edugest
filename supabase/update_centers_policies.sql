-- 1. Limpiar políticas existentes en la tabla centers
DROP POLICY IF EXISTS "Users can read center info" ON public.centers;
DROP POLICY IF EXISTS "Admins can manage centers" ON public.centers;

-- 2. Permitir lectura a cualquier miembro autenticado de su propio centro
CREATE POLICY "Users can read center info" ON public.centers
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT center_id FROM public.profiles WHERE id = auth.uid())
    OR public.is_superadmin()
  );

-- 3. Permitir actualización y gestión a administradores de su propio centro
CREATE POLICY "Admins can manage centers" ON public.centers
  FOR ALL
  TO authenticated
  USING (
    (id = (SELECT center_id FROM public.profiles WHERE id = auth.uid()) AND public.is_admin())
    OR public.is_superadmin()
  )
  WITH CHECK (
    (id = (SELECT center_id FROM public.profiles WHERE id = auth.uid()) AND public.is_admin())
    OR public.is_superadmin()
  );
