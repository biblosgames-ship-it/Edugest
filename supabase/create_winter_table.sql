CREATE TABLE IF NOT EXISTS winter_schedule_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id UUID REFERENCES profiles(center_id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reduction_factor DECIMAL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(center_id)
);
ALTER TABLE winter_schedule_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage winter preferences" ON winter_schedule_preferences FOR ALL USING (auth.role() = 'authenticated');
