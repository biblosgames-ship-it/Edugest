-- =========================================================
-- PARCHE DE SEGURIDAD (Ejecutar en SQL Editor de Supabase)
-- =========================================================
-- Problema: La política de Administrador estaba causando un 
-- 'Loop Infinito' (Recursión) en Postgres porque intentaba 
-- leer la tabla de perfiles dentro de la misma tabla de perfiles.
-- =========================================================

-- 1. Eliminar la política defectuosa que causa el error silencioso
drop policy if exists "Admins have full access to their center" on public.profiles;

-- 2. Crear una función super-segura que se salta el RLS solo
-- para comprobar si el usuario que intenta leer es administrador
create or replace function public.is_admin()
returns boolean as $$
declare
  user_role text;
begin
  select role into user_role from public.profiles where id = auth.uid() limit 1;
  return user_role = 'admin' or user_role = 'creator' or user_role = 'coordinator';
end;
$$ language plpgsql security definer;

-- 3. Crear nuevamente la política usando la función segura
create policy "Admins have full access to their center" 
  on public.profiles for all 
  using (public.is_admin());
