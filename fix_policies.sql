-- Drop the recursive policy
drop policy if exists "Admins have full access to their center" on public.profiles;

-- Recreate policy using a non-recursive approach (checking via a function or checking user email directly)
-- Or we just say if the user has role='admin' in their OWN profile.
-- Wait, using ( role = 'admin' ) doesn't work if they can only select their own.
-- Let's use a function that bypasses RLS
create or replace function public.is_admin()
returns boolean as $$
declare
  user_role text;
begin
  select role into user_role from public.profiles where id = auth.uid() limit 1;
  return user_role = 'admin';
end;
$$ language plpgsql security definer;

create policy "Admins have full access to their center" 
  on public.profiles for all 
  using (public.is_admin());
  
