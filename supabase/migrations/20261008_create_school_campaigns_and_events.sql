-- ========================================================
-- EDUGENS: MÓDULO DE CAMPAÑAS, PASEOS Y CONSULTAS A PADRES
-- ========================================================

create table if not exists public.school_campaigns (
  id uuid default gen_random_uuid() primary key,
  center_id uuid references public.centers(id) on delete cascade not null,
  title text not null,
  description text,
  type text not null default 'trip' check (type in ('trip', 'event', 'survey', 'meeting', 'campaign')),
  location text,
  event_date timestamp with time zone,
  deadline_date timestamp with time zone,
  price numeric default 0,
  requires_permission boolean default false,
  permission_text text default 'Autorizo formalmente la participación de mi hijo(a) en esta actividad y confirmo que cumple con las condiciones para asistir.',
  survey_questions jsonb default '[]'::jsonb,
  target_courses text[] default null, -- null o vacío significa todos los cursos
  is_active boolean default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.school_campaign_responses (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references public.school_campaigns(id) on delete cascade not null,
  center_id uuid references public.centers(id) on delete cascade not null,
  student_id uuid references public.students(id) on delete cascade not null,
  parent_id uuid references public.profiles(id) on delete set null,
  response text not null default 'undecided' check (response in ('yes', 'no', 'undecided')),
  permission_granted boolean default false,
  permission_signed_by text,
  permission_date timestamp with time zone,
  emergency_contact_phone text,
  medical_notes text,
  survey_answers jsonb default '{}'::jsonb,
  payment_status text default 'pending' check (payment_status in ('pending', 'partial', 'paid', 'not_applicable')),
  amount_paid numeric default 0,
  payment_method text default 'cash',
  receipt_number text,
  payment_date timestamp with time zone,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint unique_campaign_student unique (campaign_id, student_id)
);

-- Índices de alto rendimiento
create index if not exists idx_campaigns_center on public.school_campaigns(center_id, is_active);
create index if not exists idx_campaign_responses_camp on public.school_campaign_responses(campaign_id);
create index if not exists idx_campaign_responses_student on public.school_campaign_responses(student_id);

-- Habilitar RLS
alter table public.school_campaigns enable row level security;
alter table public.school_campaign_responses enable row level security;

-- Políticas de RLS (Idempotentes)
drop policy if exists "Allow all users to view campaigns" on public.school_campaigns;
create policy "Allow all users to view campaigns"
  on public.school_campaigns for select
  using (true);

drop policy if exists "Allow authenticated to manage campaigns" on public.school_campaigns;
create policy "Allow authenticated to manage campaigns"
  on public.school_campaigns for all
  using (true)
  with check (true);

drop policy if exists "Allow all users to view responses" on public.school_campaign_responses;
create policy "Allow all users to view responses"
  on public.school_campaign_responses for select
  using (true);

drop policy if exists "Allow authenticated to manage responses" on public.school_campaign_responses;
create policy "Allow authenticated to manage responses"
  on public.school_campaign_responses for all
  using (true)
  with check (true);
