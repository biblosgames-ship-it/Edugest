const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createTable() {
  console.log('Intentando verificar/crear tabla student_grades...');
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_string: `
      CREATE TABLE IF NOT EXISTS student_grades (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        student_id UUID NOT NULL,
        course_id UUID NOT NULL,
        subject_id UUID NOT NULL,
        period TEXT NOT NULL,
        competency_id TEXT NOT NULL,
        grade INTEGER,
        recovery_grade INTEGER,
        center_id UUID NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
      
      -- Índice único para evitar duplicados
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'student_grades_unique_idx') THEN
              CREATE UNIQUE INDEX student_grades_unique_idx ON student_grades (student_id, course_id, subject_id, period, competency_id);
          END IF;
      END $$;

      -- Permisos
      ALTER TABLE student_grades ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "Public Full Access" ON student_grades;
      CREATE POLICY "Public Full Access" ON student_grades FOR ALL USING (true) WITH CHECK (true);
    `
  });

  if (error) {
    console.error('Error al crear tabla (probablemente falta RPC exec_sql):', error.message);
    console.log('Intentando inserción de prueba para forzar creación...');
    const { error: insertError } = await supabase.from('student_grades').insert([{
      student_id: '00000000-0000-0000-0000-000000000000',
      course_id: '00000000-0000-0000-0000-000000000000',
      subject_id: '00000000-0000-0000-0000-000000000000',
      period: 'P1',
      competency_id: 'c1',
      grade: 0,
      center_id: '00000000-0000-0000-0000-000000000000'
    }]);
    if (insertError) console.error('La tabla definitivamente no existe o no hay permisos:', insertError.message);
    else console.log('¡Tabla verificada/existente!');
  } else {
    console.log('¡Tabla creada/actualizada con éxito!');
  }
}

createTable();
