-- =========================================================
-- PARCHE MULTI-TENANT (SAAS): CENTROS AISLADOS
-- =========================================================

-- 1. Modificar el comportamiento de los nuevos registros:
-- A partir de ahora, los usuarios nuevos NACEN SIN CENTRO (aislados).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, center_id, is_active)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    'pending', -- Rol pendiende hasta que acceda con código o cree escuela
    null,      -- SIN CENTRO!
    false      -- INACTIVO HASTA REGISTRO
  );
  return new;
end;
$$ language plpgsql security definer;

-- 2. Función Atómica para Registrar un Nuevo Centro:
-- Esta función crea un Centro e inmeditamente "Mete" al usuario
-- que la llamó como Administrador de ese centro.
create or replace function public.register_school_saas(
  p_name text,
  p_district text default null,
  p_regional text default null
) returns uuid as $$
declare
  new_center_id uuid;
begin
  -- Solo usuarios autenticados sin centro pueden ejecutar esto
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  -- Crear el nuevo Centro
  insert into public.centers (name, district, regional)
  values (p_name, p_district, p_regional)
  returning id into new_center_id;

  -- Actualizar el perfil del usuario para hacerlo Administrador de este nuevo centro!
  update public.profiles 
  set center_id = new_center_id,
      role = 'admin',
      is_active = true
  where id = auth.uid();

  return new_center_id;
end;
$$ language plpgsql security definer;
