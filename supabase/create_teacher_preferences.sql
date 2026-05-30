CREATE TABLE IF NOT EXISTS teacher_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    center_id UUID REFERENCES centers(id) ON DELETE CASCADE,
    working_days TEXT[] DEFAULT '{"Lunes", "Martes", "Miércoles", "Jueves", "Viernes"}',
    morning_start TIME DEFAULT '08:00',
    morning_end TIME DEFAULT '12:00',
    afternoon_start TIME DEFAULT '14:00',
    afternoon_end TIME DEFAULT '18:00',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS
ALTER TABLE teacher_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their center's teacher preferences" ON teacher_preferences
    FOR ALL USING (center_id IN (SELECT center_id FROM profiles WHERE id = auth.uid()));
