-- Añadir campos a parents si no existen
ALTER TABLE public.parents ADD COLUMN IF NOT EXISTS id_card text;
ALTER TABLE public.parents ADD COLUMN IF NOT EXISTS address text;

-- Crear tabla medical si no existe
CREATE TABLE IF NOT EXISTS public.student_medical (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references public.students(id) on delete cascade unique,
  insurance_ars text,
  medical_conditions text,
  allergies text,
  permanent_medication text,
  blood_type text,
  special_observations text,
  created_at timestamp with time zone default now()
);
ALTER TABLE public.student_medical ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on student_medical" ON public.student_medical FOR ALL USING (true);

-- Crear tabla history si no existe
CREATE TABLE IF NOT EXISTS public.student_history (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references public.students(id) on delete cascade unique,
  previous_school text,
  repeating_grade boolean default false,
  performance_observations text,
  pedagogical_diagnosis text,
  special_needs text,
  created_at timestamp with time zone default now()
);
ALTER TABLE public.student_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on student_history" ON public.student_history FOR ALL USING (true);

-- Crear tabla documents si no existe
CREATE TABLE IF NOT EXISTS public.student_documents (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references public.students(id) on delete cascade unique,
  has_birth_certificate boolean default false,
  has_previous_grades boolean default false,
  has_grades_record boolean default false,
  has_parents_id_copy boolean default false,
  has_medical_insurance_copy boolean default false,
  has_photo_2x2 boolean default false,
  has_vaccine_card boolean default false,
  has_medical_certification boolean default false,
  created_at timestamp with time zone default now()
);
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on student_documents" ON public.student_documents FOR ALL USING (true);
