CREATE TABLE IF NOT EXISTS public.break_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID,
    start_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    level TEXT NOT NULL,
    cycle TEXT DEFAULT 'General',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.break_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Centros pueden gestionar sus recreos" ON public.break_preferences;
CREATE POLICY "Centros pueden gestionar sus recreos" 
ON public.break_preferences
FOR ALL
USING (center_id IN (SELECT center_id FROM profiles WHERE id = auth.uid()));
