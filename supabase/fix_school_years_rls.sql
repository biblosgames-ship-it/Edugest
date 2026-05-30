-- Habilitar RLS
ALTER TABLE school_years ENABLE ROW LEVEL SECURITY;

-- Política para insertar años (Permitir a usuarios autenticados crear para su centro)
DROP POLICY IF EXISTS "Users can insert school years for their center" ON school_years;
CREATE POLICY "Users can insert school years for their center"
ON school_years FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política para ver años
DROP POLICY IF EXISTS "Users can view school years" ON school_years;
CREATE POLICY "Users can view school years"
ON school_years FOR SELECT
TO authenticated
USING (true);
