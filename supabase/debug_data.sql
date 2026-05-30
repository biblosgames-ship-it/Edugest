SELECT 'Teachers' as table, count(*), center_id FROM teachers GROUP BY center_id;
SELECT 'Courses' as table, count(*), center_id FROM courses GROUP BY center_id;
SELECT 'Profiles' as table, id, center_id FROM profiles WHERE id = auth.uid();
