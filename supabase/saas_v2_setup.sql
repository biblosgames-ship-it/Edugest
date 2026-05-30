-- =========================================================
-- PARCHE 4: SAAS V2 - PLANES, PAGOS Y LIMITES
-- (Incluye columnas previas por seguridad)
-- =========================================================

-- 0. Asegurar columnas de la versión anterior
alter table public.profiles add column if not exists is_superadmin boolean default false;
alter table public.saas_licenses add column if not exists linked_email text;
alter table public.saas_licenses add column if not exists subscription_start_date timestamp with time zone;
alter table public.saas_licenses add column if not exists subscription_end_date timestamp with time zone;
alter table public.saas_licenses add column if not exists price numeric default 0;

-- 0.1 Función para Generar Licencias Masivas (Por si no se ejecutó en parche 3)
create or replace function public.generate_saas_licenses(
  p_count integer,
  p_price numeric default 0
) returns setof public.saas_licenses as $$
declare
  i integer;
  new_key text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin = true) then
    raise exception 'Acceso denegado: Se requiere rol de superadmin';
  end if;

  for i in 1..p_count loop
    new_key := 'EDG-' || substring(md5(random()::text) from 1 for 4) || '-' || substring(md5(random()::text) from 1 for 4);
    insert into public.saas_licenses (product_key, price) values (upper(new_key), p_price);
  end loop;

  return query select * from public.saas_licenses order by created_at desc limit p_count;
end;
$$ language plpgsql security definer;

-- 1. Tabla de Planes SaaS
create table if not exists public.saas_plans (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  max_students integer default 100,
  max_teachers integer default 10,
  price_monthly numeric default 0,
  price_yearly numeric default 0,
  created_at timestamp with time zone default now()
);

-- Insertar planes por defecto
insert into public.saas_plans (name, max_students, max_teachers, price_monthly, price_yearly)
values 
  ('Básico', 100, 10, 50, 500),
  ('Pro', 500, 30, 100, 1000),
  ('Premium', 1500, 100, 200, 2000),
  ('Ilimitado', 99999, 9999, 500, 5000)
on conflict do nothing;

-- 2. Añadir Plan a la Licencia (que representa la suscripción del centro)
alter table public.saas_licenses add column if not exists plan_id uuid references public.saas_plans(id) on delete set null;

-- Asignar el plan 'Básico' por defecto a las licencias existentes si no tienen uno
do $$
declare
  default_plan_id uuid;
begin
  select id into default_plan_id from public.saas_plans where name = 'Básico' limit 1;
  update public.saas_licenses set plan_id = default_plan_id where plan_id is null;
end $$;

-- 3. Tabla de Pagos
create table if not exists public.saas_payments (
  id uuid default uuid_generate_v4() primary key,
  license_id uuid references public.saas_licenses(id) on delete cascade,
  amount numeric not null,
  payment_date timestamp with time zone default now(),
  method text check (method in ('Transferencia', 'Efectivo', 'Tarjeta', 'Otro')),
  reference_note text,
  created_at timestamp with time zone default now()
);

-- 4. Función para Registrar Pago y Extender Suscripción
create or replace function public.register_saas_payment(
  p_license_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text,
  p_months_to_add integer default 1
) returns void as $$
declare
  v_current_end_date timestamp with time zone;
begin
  -- Verificar que sea superadmin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin = true) then
    raise exception 'Acceso denegado: Se requiere rol de superadmin';
  end if;

  -- Registrar el pago
  insert into public.saas_payments (license_id, amount, method, reference_note)
  values (p_license_id, p_amount, p_method, p_reference);

  -- Obtener la fecha de fin de suscripción actual
  select subscription_end_date into v_current_end_date 
  from public.saas_licenses 
  where id = p_license_id;

  -- Si ya venció (o no tiene), agregar meses desde HOY. Si no, agregar meses a la fecha de fin actual.
  if v_current_end_date is null or v_current_end_date < now() then
    v_current_end_date := now();
  end if;

  -- Actualizar la licencia
  update public.saas_licenses
  set subscription_end_date = v_current_end_date + (p_months_to_add || ' months')::interval
  where id = p_license_id;
end;
$$ language plpgsql security definer;

-- 5. Políticas RLS
alter table public.saas_plans enable row level security;
alter table public.saas_payments enable row level security;

-- Limpiar políticas anteriores por si se ejecuta varias veces
drop policy if exists "Superadmins can manage plans" on public.saas_plans;
drop policy if exists "Superadmins can manage payments" on public.saas_payments;
drop policy if exists "Anyone can read plans" on public.saas_plans;
drop policy if exists "Admins can view their payments" on public.saas_payments;

-- Superadmins pueden hacer todo en saas_plans y saas_payments
create policy "Superadmins can manage plans" on public.saas_plans for all 
  using ((select is_superadmin from public.profiles where id = auth.uid()) = true);
  
create policy "Superadmins can manage payments" on public.saas_payments for all 
  using ((select is_superadmin from public.profiles where id = auth.uid()) = true);

-- Usuarios normales pueden leer los planes
create policy "Anyone can read plans" on public.saas_plans for select using (true);

-- Usuarios normales pueden ver sus propios pagos (basado en su centro)
create policy "Admins can view their payments" on public.saas_payments for select 
  using (
    license_id in (
      select id from public.saas_licenses 
      where used_by_center = (select center_id from public.profiles where id = auth.uid() and role in ('admin', 'coordinator'))
    )
  );
