DELETE FROM teacher_preferences a USING teacher_preferences b 
WHERE a.id < b.id AND a.teacher_id = b.teacher_id AND a.center_id = b.center_id;

ALTER TABLE teacher_preferences 
ADD CONSTRAINT teacher_center_unique UNIQUE (teacher_id, center_id);
