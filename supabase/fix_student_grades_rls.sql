-- 1. Asegurar que la tabla existe con la estructura correcta
CREATE TABLE IF NOT EXISTS student_grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    competency_id TEXT NOT NULL,
    grade INTEGER,
    recovery_grade INTEGER,
    center_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Crear índice para evitar duplicados y permitir upsert
CREATE UNIQUE INDEX IF NOT EXISTS student_grades_unique_idx ON student_grades (student_id, course_id, subject_id, period, competency_id);

-- 3. Habilitar RLS
ALTER TABLE student_grades ENABLE ROW LEVEL SECURITY;

-- 4. Crear política de acceso total para usuarios autenticados (Alex)
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en student_grades" ON student_grades;
CREATE POLICY "Permitir todo a usuarios autenticados en student_grades" 
ON student_grades FOR ALL 
USING (true) 
WITH CHECK (true);

-- 5. Otorgar permisos a los roles anon y authenticated
GRANT ALL ON student_grades TO anon, authenticated, service_role;
