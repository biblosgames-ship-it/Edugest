-- ========================================================
-- EDUGENS: ESQUEMA COMPLETO Y SEGURIDAD (SUPABASE)
-- ========================================================

-- Limpieza total (¡CUIDADO!)
drop table if exists public.notifications cascade;
drop table if exists public.announcements cascade;
drop table if exists public.tasks cascade;
drop table if exists public.excuses cascade;
drop table if exists public.grade_records cascade;
drop table if exists public.performance_alerts cascade;
drop table if exists public.attendance_records cascade;
drop table if exists public.schedule_entries cascade;
drop table if exists public.time_blocks cascade;
drop table if exists public.rooms cascade;
drop table if exists public.assignments cascade;
drop table if exists public.teacher_subjects cascade;
drop table if exists public.teachers cascade;
drop table if exists public.parents cascade;
drop table if exists public.students cascade;
drop table if exists public.subjects cascade;
drop table if exists public.courses cascade;
drop table if exists public.academic_requirements cascade;
drop table if exists public.invitation_codes cascade;
drop table if exists public.profiles cascade;
drop table if exists public.centers cascade;

-- 1. Extensiones
create extension if not exists "uuid-ossp";

-- 2. Tablas de Infraestructura (Estructura Base)

-- Centros Educativos (Multi-tenencia)
create table public.centers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  address text,
  phone text,
  district text,
  regional text,
  logo_url text,
  primary_color text default '#4F46E5',
  secondary_color text default '#1E1B4B',
  created_at timestamp with time zone default now()
);

-- Perfiles de Usuario (Extensión de Auth)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  center_id uuid references public.centers(id) on delete set null,
  email text unique not null,
  role text not null check (role in ('admin', 'coordinator', 'creator', 'teacher', 'student', 'parent')),
  full_name text,
  phone text,
  is_active boolean default false,
  invitation_code text,
  course_code text, 
  last_login timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- 3. Tablas Académicas

-- Requisitos Académicos
create table public.academic_requirements (
  id uuid default uuid_generate_v4() primary key,
  center_id uuid references public.centers(id) on delete cascade,
  level text not null, 
  cycle text, 
  modality text,
  output text,
  weekly_hours integer,
  class_duration_minutes integer default 45,
  created_at timestamp with time zone default now()
);

-- Cursos (Grados y Secciones)
create table public.courses (
  id uuid default uuid_generate_v4() primary key,
  center_id uuid references public.centers(id) on delete cascade,
  code text, 
  level text not null,
  grade text not null,
  section text not null,
  student_count integer default 0,
  tanda text, 
  cycle text,
  modality text,
  output text,
  created_at timestamp with time zone default now()
);

-- Materias
create table public.subjects (
  id uuid default uuid_generate_v4() primary key,
  center_id uuid references public.centers(id) on delete cascade,
  name text not null,
  hours_per_week integer not null,
  level text not null,
  is_pedagogical_block boolean default false,
  distribution_type text default 'together',
  area text,
  created_at timestamp with time zone default now()
);

-- Docentes
create table public.teachers (
  id uuid references public.profiles(id) on delete cascade primary key,
  center_id uuid references public.centers(id) on delete cascade,
  hours_available integer default 40,
  area text,
  preferred_days text[],
  created_at timestamp with time zone default now()
);

-- Estudiantes (ID desacoplado de Auth para permitir registros sin login)
create table public.students (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  center_id uuid references public.centers(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  sex char(1) check (sex in ('M', 'F')),
  birth_date date,
  address text,
  course_id uuid references public.courses(id) on delete set null,
  status text default 'Active',
  order_number integer,
  created_at timestamp with time zone default now()
);

-- Padres/Tutores
create table public.parents (
  id uuid default uuid_generate_v4() primary key,
  center_id uuid references public.centers(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  relation text,
  phone text,
  secondary_phone text,
  email text,
  occupation text,
  created_at timestamp with time zone default now()
);

-- 4. Operación y Gestión

-- Asignaciones
create table public.assignments (
  id uuid default uuid_generate_v4() primary key,
  center_id uuid references public.centers(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete cascade,
  created_at timestamp with time zone default now()
);

-- Aulas
create table public.rooms (
  id uuid default uuid_generate_v4() primary key,
  center_id uuid references public.centers(id) on delete cascade,
  name text not null,
  capacity integer,
  type text default 'normal',
  created_at timestamp with time zone default now()
);

-- Bloques de Horario
create table public.time_blocks (
  id uuid default uuid_generate_v4() primary key,
  center_id uuid references public.centers(id) on delete cascade,
  day text not null,
  start_time time not null,
  end_time time not null,
  created_at timestamp with time zone default now()
);

-- Horario (Schedule Entries)
create table public.schedule_entries (
  id uuid default uuid_generate_v4() primary key,
  center_id uuid references public.centers(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  time_block_id uuid references public.time_blocks(id) on delete cascade,
  created_at timestamp with time zone default now()
);

-- Asistencia Docente
create table public.attendance_records (
  id uuid default uuid_generate_v4() primary key,
  center_id uuid references public.centers(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete cascade,
  date date not null,
  status text not null check (status in ('asistencia', 'tardanza', 'ausencia', 'calificaciones', 'planificacion', 'acompanamiento')),
  notes text,
  created_at timestamp with time zone default now()
);

-- Alertas de Rendimiento
create table public.performance_alerts (
  id uuid default uuid_generate_v4() primary key,
  center_id uuid references public.centers(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete cascade,
  type text not null, 
  status text default 'pendiente',
  date date default current_date,
  description text,
  created_at timestamp with time zone default now()
);

-- Notas de Estudiantes
create table public.grade_records (
  id uuid default uuid_generate_v4() primary key,
  center_id uuid references public.centers(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  school_year text not null,
  period1 numeric check (period1 between 0 and 100),
  period2 numeric check (period2 between 0 and 100),
  period3 numeric check (period3 between 0 and 100),
  final_exam numeric check (final_exam between 0 and 100),
  final_grade numeric check (final_grade between 0 and 100),
  created_at timestamp with time zone default now()
);

-- Excusas
create table public.excuses (
  id uuid default uuid_generate_v4() primary key,
  center_id uuid references public.centers(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  reason text not null,
  date date default current_date,
  created_at timestamp with time zone default now()
);

-- Tareas y Anuncios
create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  center_id uuid references public.centers(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete cascade,
  title text not null,
  description text,
  due_date timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table public.announcements (
  id uuid default uuid_generate_v4() primary key,
  center_id uuid references public.centers(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null, 
  sender_id uuid references public.profiles(id) on delete cascade,
  sender_role text not null,
  title text not null,
  content text not null,
  created_at timestamp with time zone default now()
);

-- Invitaciones
create table public.invitation_codes (
  code text primary key,
  center_id uuid references public.centers(id) on delete cascade,
  role text not null,
  is_used boolean default false,
  course_id uuid references public.courses(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- ========================================================
-- 5. SEGURIDAD (RLS)
-- ========================================================

-- Habilitar RLS en TODO
alter table public.centers enable row level security;
alter table public.profiles enable row level security;
alter table public.academic_requirements enable row level security;
alter table public.courses enable row level security;
alter table public.subjects enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.parents enable row level security;
alter table public.assignments enable row level security;
alter table public.rooms enable row level security;
alter table public.time_blocks enable row level security;
alter table public.schedule_entries enable row level security;
alter table public.attendance_records enable row level security;
alter table public.performance_alerts enable row level security;
alter table public.grade_records enable row level security;
alter table public.excuses enable row level security;
alter table public.tasks enable row level security;
alter table public.announcements enable row level security;
alter table public.invitation_codes enable row level security;

-- POLÍTICAS GENERALES (ADMIN)
create policy "Admins have full access to their center" 
  on public.profiles for all 
  using (auth.uid() in (select id from public.profiles where role = 'admin' and center_id = profiles.center_id));

-- POLÍTICAS DE LECTURA (AUTHED USERS)
create policy "Users can read subjects" on subjects for select using (center_id = (select center_id from profiles where id = auth.uid()));
create policy "Users can read courses" on courses for select using (center_id = (select center_id from profiles where id = auth.uid()));
create policy "Users can read center info" on centers for select using (id = (select center_id from profiles where id = auth.uid()));

-- POLÍTICAS PROPIAS
create policy "Users can select own profile" on profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- POLÍTICAS DOCENTES
create policy "Teachers can read their assignments" 
  on assignments for select 
  using (teacher_id = auth.uid());

create policy "Teachers can manage their tasks" 
  on tasks for all 
  using (teacher_id = auth.uid());

-- POLÍTICAS ESTUDIANTES/PADRES
create policy "Students can view their grades" 
  on grade_records for select 
  using (
    student_id in (select id from students where profile_id = auth.uid()) or 
    student_id in (select student_id from parents where profile_id = auth.uid())
  );

-- ========================================================
-- 6. AUTOMATIZACIÓN Y TRIGGERS
-- ========================================================

-- Crear un centro por defecto si no existe
insert into public.centers (name, district, regional) 
values ('Centro Educativo Edugens', 'Distrito Educativo 01', 'Regional 01')
on conflict do nothing;

-- Función para manejar el nuevo usuario desde Auth
create or replace function public.handle_new_user()
returns trigger as $$
declare
  default_center_id uuid;
begin
  select id into default_center_id from public.centers limit 1;

  insert into public.profiles (id, email, full_name, role, center_id, is_active)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    default_center_id,
    true 
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger de Auth
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Comunicaciones generales
create table if not exists public.communications (
  id uuid default uuid_generate_v4() primary key,
  center_id uuid references public.centers(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete cascade,
  sender_name text,
  motive text,
  message text,
  target_roles text[],
  target_courses uuid[],
  target_teachers uuid[],
  created_at timestamp with time zone default now()
);

-- Habilitar RLS para comunicaciones
alter table public.communications enable row level security;
create policy "Users can view communications in their center" on public.communications for select using (center_id = (select center_id from profiles where id = auth.uid()));
create policy "Admins/Teachers can create communications" on public.communications for insert with check (center_id = (select center_id from profiles where id = auth.uid()));
