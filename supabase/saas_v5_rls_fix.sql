-- 1. HABILITAR RLS EN TODAS LAS TABLAS CRÍTICAS
alter table public.courses enable row level security;
alter table public.subjects enable row level security;
alter table public.teachers enable row level security;
alter table public.rooms enable row level security;
alter table public.time_blocks enable row level security;
alter table public.assignments enable row level security;
alter table public.schedule_entries enable row level security;

-- 2. ELIMINAR POLÍTICAS ANTIGUAS PARA RECREARLAS LIMPIAS
drop policy if exists "Users can read courses" on public.courses;
drop policy if exists "Admins can manage courses" on public.courses;
drop policy if exists "Users can read subjects" on public.subjects;
drop policy if exists "Admins can manage subjects" on public.subjects;
drop policy if exists "Users can read teachers" on public.teachers;
drop policy if exists "Admins can manage teachers" on public.teachers;
drop policy if exists "Users can read rooms" on public.rooms;
drop policy if exists "Admins can manage rooms" on public.rooms;
drop policy if exists "Users can read time_blocks" on public.time_blocks;
drop policy if exists "Admins can manage time_blocks" on public.time_blocks;
drop policy if exists "Users can read assignments" on public.assignments;
drop policy if exists "Admins can manage assignments" on public.assignments;
drop policy if exists "Users can read schedule_entries" on public.schedule_entries;
drop policy if exists "Admins can manage schedule_entries" on public.schedule_entries;

-- 3. CREAR POLÍTICAS DE GESTIÓN TOTAL PARA ADMINS EN SU CENTRO
-- CURSOS
create policy "Admins can manage courses" on public.courses
  for all using (center_id = (select center_id from profiles where id = auth.uid() and role = 'admin'));

-- MATERIAS
create policy "Admins can manage subjects" on public.subjects
  for all using (center_id = (select center_id from profiles where id = auth.uid() and role = 'admin'));

-- DOCENTES
create policy "Admins can manage teachers" on public.teachers
  for all using (center_id = (select center_id from profiles where id = auth.uid() and role = 'admin'));

-- AULAS
create policy "Admins can manage rooms" on public.rooms
  for all using (center_id = (select center_id from profiles where id = auth.uid() and role = 'admin'));

-- BLOQUES
create policy "Admins can manage time_blocks" on public.time_blocks
  for all using (center_id = (select center_id from profiles where id = auth.uid() and role = 'admin'));

-- ASIGNACIONES
create policy "Admins can manage assignments" on public.assignments
  for all using (center_id = (select center_id from profiles where id = auth.uid() and role = 'admin'));

-- HORARIOS
create policy "Admins can manage schedule_entries" on public.schedule_entries
  for all using (center_id = (select center_id from profiles where id = auth.uid() and role = 'admin'));

-- 4. POLÍTICAS DE LECTURA PARA OTROS USUARIOS (PROFESORES/ESTUDIANTES)
create policy "Users can read courses" on public.courses for select using (center_id = (select center_id from profiles where id = auth.uid()));
create policy "Users can read subjects" on public.subjects for select using (center_id = (select center_id from profiles where id = auth.uid()));
create policy "Users can read teachers" on public.teachers for select using (center_id = (select center_id from profiles where id = auth.uid()));
create policy "Users can read rooms" on public.rooms for select using (center_id = (select center_id from profiles where id = auth.uid()));
create policy "Users can read time_blocks" on public.time_blocks for select using (center_id = (select center_id from profiles where id = auth.uid()));
create policy "Users can read assignments" on public.assignments for select using (center_id = (select center_id from profiles where id = auth.uid()));
create policy "Users can read schedule_entries" on public.schedule_entries for select using (center_id = (select center_id from profiles where id = auth.uid()));
