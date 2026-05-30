-- RECONSTRUCCIÓN DE LOS 11 DOCENTES DESDE SUS HUELLAS EN LAS MATERIAS
INSERT INTO profiles (id, center_id, full_name, role)
VALUES 
  ('326c1385-f236-4bbd-8604-5dc7ca4ecc1b', '29bd105f-af7f-48b1-a9e9-a76ddf1e9ab1', 'Docente Recuperado 1', 'teacher'),
  ('8aff9ec7-03bb-41c2-9342-5069a5f63e4a', '29bd105f-af7f-48b1-a9e9-a76ddf1e9ab1', 'Docente Recuperado 2', 'teacher'),
  ('ed5eaf27-bbe0-4508-8961-aa97b43ddea3', '29bd105f-af7f-48b1-a9e9-a76ddf1e9ab1', 'Docente Recuperado 3', 'teacher'),
  ('94457c4a-c12d-42df-94f4-a62d5d03e62c', '29bd105f-af7f-48b1-a9e9-a76ddf1e9ab1', 'Docente Recuperado 4', 'teacher'),
  ('18505978-41af-4188-91e1-db72acd635cf', '29bd105f-af7f-48b1-a9e9-a76ddf1e9ab1', 'Docente Recuperado 5', 'teacher'),
  ('2d4cb964-aa39-4cab-8f2b-8c869ce2e736', '29bd105f-af7f-48b1-a9e9-a76ddf1e9ab1', 'Docente Recuperado 6', 'teacher'),
  ('3c9ce788-ab43-4c7d-8e12-34cd5303be48', '29bd105f-af7f-48b1-a9e9-a76ddf1e9ab1', 'Docente Recuperado 7', 'teacher'),
  ('a90de0b9-0697-4ab1-b2d4-a30335d6c8b8', '29bd105f-af7f-48b1-a9e9-a76ddf1e9ab1', 'Docente Recuperado 8', 'teacher'),
  ('bdaf4420-18cb-435c-815e-96f06ade0613', '29bd105f-af7f-48b1-a9e9-a76ddf1e9ab1', 'Docente Recuperado 9', 'teacher'),
  ('a4e0c8f1-2465-4c55-bbe6-21bec8d31806', '29bd105f-af7f-48b1-a9e9-a76ddf1e9ab1', 'Docente Recuperado 10', 'teacher'),
  ('f71d1359-53cb-45c9-9ca9-4f7648ffea2c', '29bd105f-af7f-48b1-a9e9-a76ddf1e9ab1', 'Docente Recuperado 11', 'teacher')
ON CONFLICT (id) DO UPDATE SET 
  center_id = EXCLUDED.center_id,
  role = 'teacher';
