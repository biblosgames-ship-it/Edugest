-- 1. LIMPIEZA DE PLANES DUPLICADOS
-- Eliminar planes con nombres repetidos, dejando solo uno de cada uno
delete from public.saas_plans
where id not in (
    select distinct on (name) id
    from public.saas_plans
    order by name, created_at
);

-- Agregar restricción de unicidad para evitar que vuelva a pasar
alter table public.saas_plans drop constraint if exists saas_plans_name_key;
alter table public.saas_plans add constraint saas_plans_name_key unique (name);

-- 2. FUNCIÓN PARA BORRAR CENTRO (SUPERADMIN SOLAMENTE)
create or replace function public.delete_saas_center(p_center_id uuid)
returns void as $$
declare
  v_license_id uuid;
begin
  -- Verificar superadmin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin = true) then
    raise exception 'Acceso denegado';
  end if;

  -- 1. Desvincular la licencia (volverla a poner como disponible)
  update public.saas_licenses
  set is_used = false,
      used_by_center = null,
      linked_email = null,
      subscription_start_date = null,
      subscription_end_date = null
  where used_by_center = p_center_id;

  -- 2. Limpiar perfiles asociados (opcional: podrías borrarlos o solo quitarles el center_id)
  -- En este caso, les quitamos el center_id para que no se queden huérfanos con error
  update public.profiles
  set center_id = null,
      role = 'student' -- reset role
  where center_id = p_center_id;

  -- 3. Borrar el centro (esto disparará el cascade en las tablas que tengan center_id)
  delete from public.centers where id = p_center_id;
end;
$$ language plpgsql security definer;
