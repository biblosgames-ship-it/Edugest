-- =========================================================
-- PARCHE 5: FIX PERMISOS (Bypass de Seguridad para SuperAdmin)
-- =========================================================

-- 1. Crear una función "Security Definer" para verificar si eres SuperAdmin
-- Esto asegura que la base de datos siempre pueda leer tu rango sin importar las otras reglas.
create or replace function public.is_superadmin()
returns boolean as $$
declare
  v_is_super boolean;
begin
  select is_superadmin into v_is_super from public.profiles where id = auth.uid();
  return coalesce(v_is_super, false);
end;
$$ language plpgsql security definer;

-- 2. Asegurarnos de que RLS esté activado
alter table public.saas_licenses enable row level security;

-- 3. Limpiar CUALQUIER política vieja en saas_licenses
drop policy if exists "Superadmins can read all licenses" on public.saas_licenses;
drop policy if exists "Superadmins can insert licenses" on public.saas_licenses;
drop policy if exists "Superadmins can update licenses" on public.saas_licenses;
drop policy if exists "Superadmins can delete licenses" on public.saas_licenses;

-- 4. Crear políticas infalibles usando la nueva función
create policy "Superadmins can read all licenses" 
  on public.saas_licenses for select using (public.is_superadmin());

create policy "Superadmins can insert licenses" 
  on public.saas_licenses for insert with check (public.is_superadmin());

create policy "Superadmins can update licenses" 
  on public.saas_licenses for update using (public.is_superadmin());

create policy "Superadmins can delete licenses" 
  on public.saas_licenses for delete using (public.is_superadmin());
