-- =========================================================
-- PARCHE 2: LICENCIAS MAESTRAS SAAS Y FIX INVITACIONES
-- =========================================================

-- 1. Tabla de Licencias SaaS
create table if not exists public.saas_licenses (
  id uuid default uuid_generate_v4() primary key,
  product_key text unique not null,
  is_used boolean default false,
  used_by_center uuid references public.centers(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- (Opcional) Insertar un par de licencias de prueba directamente aquí
insert into public.saas_licenses (product_key) values ('VIP-EDUGENS-2026') on conflict do nothing;
insert into public.saas_licenses (product_key) values ('BETA-TEST-100') on conflict do nothing;

-- 2. Reescribir Función Atómica para exigir Licencia
create or replace function public.register_school_saas(
  p_name text,
  p_license_key text,  -- NUEVO PARÁMETRO
  p_district text default null,
  p_regional text default null
) returns uuid as $$
declare
  new_center_id uuid;
  v_license_id uuid;
begin
  -- Verificar autenticación
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  -- IMPORTANTE: Verificar Licencia SaaS
  select id into v_license_id 
  from public.saas_licenses 
  where product_key = p_license_key and is_used = false;

  if v_license_id is null then
    raise exception 'INVALID_LICENSE';
  end if;

  -- Crear el nuevo Centro
  insert into public.centers (name, district, regional)
  values (p_name, p_district, p_regional)
  returning id into new_center_id;

  -- Consumir (Quemar) la licencia para que no pueda reusarse
  update public.saas_licenses 
  set is_used = true, used_by_center = new_center_id 
  where id = v_license_id;

  -- Actualizar el perfil del usuario para hacerlo Administrador de este nuevo centro
  update public.profiles 
  set center_id = new_center_id,
      role = 'admin',
      is_active = true
  where id = auth.uid();

  return new_center_id;
end;
$$ language plpgsql security definer;


-- 3. FIX: Permitir a los Administradores crear "Códigos de Invitación" (invitation_codes)
-- Eliminamos políticas viejas por si acaso
drop policy if exists "Admins can manage invitation_codes" on public.invitation_codes;

-- Permite ver códigos si fueron creados en tu centro o eres dueño del centro
create policy "Users can see codes for their center"
  on public.invitation_codes for select
  using (center_id = (select center_id from profiles where id = auth.uid()));

-- Permite SOLO a los administradores y coordinadores insertar códigos PARA SU CENTRO
create policy "Admins can insert invitation codes"
  on public.invitation_codes for insert
  with check (
    center_id = (select center_id from profiles where id = auth.uid()) and
    (select role from profiles where id = auth.uid()) in ('admin', 'coordinator', 'creator')
  );

-- Permite actualizar a los administradores
create policy "Admins can update invitation codes"
  on public.invitation_codes for update
  using (
    center_id = (select center_id from profiles where id = auth.uid()) and
    (select role from profiles where id = auth.uid()) in ('admin', 'coordinator', 'creator')
  );
