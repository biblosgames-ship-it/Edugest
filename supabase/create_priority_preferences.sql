CREATE TABLE IF NOT EXISTS public.priority_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
    level TEXT NOT NULL,
    cycle TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('subject', 'teacher')),
    target_id TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 2500,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.priority_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Centros pueden gestionar sus prioridades" ON public.priority_preferences;
CREATE POLICY "Centros pueden gestionar sus prioridades"
ON public.priority_preferences
FOR ALL
USING (
    center_id = auth.uid() OR
    center_id IN (SELECT center_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
    center_id = auth.uid() OR
    center_id IN (SELECT center_id FROM public.profiles WHERE id = auth.uid())
);
