-- =========================================================
-- PARCHE 3: FIX DE BUCLE CONTINUO (RESTRICCIÓN DE CHECK DE ROLES)
-- =========================================================

-- El problema: La tabla profiles originalmente forzaba que el "role" fuera ('admin', 'coordinator', 'creator', 'teacher', 'student', 'parent').
-- Con el modelo SaaS, dictamos que los usuarios nuevos nacen con rol 'pending'.
-- Postgres está rebotando (Database error saving new user) a todo nuevo usuario porque 'pending' no estaba en la lista blanca de la restricción.

-- 1. Eliminar la restricción vieja de verificación de roles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Crear la nueva restricción incluyendo el rol temporal SaaS ('pending')
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'coordinator', 'creator', 'teacher', 'student', 'parent', 'pending'));

-- (Opcional por seguridad) Reforzar el trigger para usar pending correctamente en caso de que lo necesiten
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, center_id, is_active)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    'pending',  -- Nace esperando ser asignado
    null,       -- Sin colegio
    false       -- Pendiente de registro
  );
  return new;
end;
$$ language plpgsql security definer;
