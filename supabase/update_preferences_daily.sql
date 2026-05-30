ALTER TABLE teacher_preferences ADD COLUMN IF NOT EXISTS daily_config JSONB DEFAULT '{}';
