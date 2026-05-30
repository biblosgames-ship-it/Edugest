-- =========================================================
-- PARCHE 3: PANEL SUPER ADMIN SAAS Y MONITOREO
-- =========================================================

-- 1. Añadir is_superadmin a profiles
alter table public.profiles add column if not exists is_superadmin boolean default false;

-- 2. Modificar saas_licenses
alter table public.saas_licenses add column if not exists linked_email text;
alter table public.saas_licenses add column if not exists subscription_start_date timestamp with time zone;
alter table public.saas_licenses add column if not exists subscription_end_date timestamp with time zone;
alter table public.saas_licenses add column if not exists price numeric default 0;

-- 3. Actualizar register_school_saas para registrar el email y fechas
create or replace function public.register_school_saas(
  p_name text,
  p_license_key text,
  p_district text default null,
  p_regional text default null
) returns uuid as $$
declare
  new_center_id uuid;
  v_license_id uuid;
  v_email text;
begin
  -- Verificar autenticación
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  -- Obtener email del usuario
  select email into v_email from public.profiles where id = auth.uid();

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
  set is_used = true, 
      used_by_center = new_center_id,
      linked_email = v_email,
      subscription_start_date = now(),
      subscription_end_date = now() + interval '1 year'
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

-- 4. Políticas para SuperAdmin en saas_licenses
-- Permitimos a los superadmin leer y modificar cualquier licencia
create policy "Superadmins can read all licenses"
  on public.saas_licenses for select
  using (
    (select is_superadmin from public.profiles where id = auth.uid()) = true
  );

create policy "Superadmins can insert licenses"
  on public.saas_licenses for insert
  with check (
    (select is_superadmin from public.profiles where id = auth.uid()) = true
  );

create policy "Superadmins can update licenses"
  on public.saas_licenses for update
  using (
    (select is_superadmin from public.profiles where id = auth.uid()) = true
  );

-- Nos aseguramos que saas_licenses tenga RLS activado
alter table public.saas_licenses enable row level security;

-- (Opcional) Si en el futuro necesitas una política para que el usuario normal la valide en registro,
-- el RLS no aplica a funciones "security definer", así que register_school_saas() funcionará bien 
-- porque se ejecuta como owner.

-- 5. Función para Generar Licencias Masivas
create or replace function public.generate_saas_licenses(
  p_count integer,
  p_price numeric default 0
) returns setof public.saas_licenses as $$
declare
  i integer;
  new_key text;
begin
  -- Verificar que sea superadmin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin = true) then
    raise exception 'Acceso denegado: Se requiere rol de superadmin';
  end if;

  for i in 1..p_count loop
    -- Generar llave random, ej: EDG-XXXX-XXXX
    new_key := 'EDG-' || substring(md5(random()::text) from 1 for 4) || '-' || substring(md5(random()::text) from 1 for 4);
    
    insert into public.saas_licenses (product_key, price)
    values (upper(new_key), p_price);
  end loop;

  -- Retornar los generados en esta corrida
  return query select * from public.saas_licenses order by created_at desc limit p_count;
end;
$$ language plpgsql security definer;
