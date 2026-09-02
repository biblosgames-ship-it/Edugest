import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabase, useApp } from '../context/AppContext';
import graduatedList from '../data/graduated_2025_students.json';

export const useStudents = () => {
  const { profile } = useSupabase();
  const { selectedYear } = useApp();
  const queryClient = useQueryClient();
  const centerId = profile?.center_id;
  const schoolYear = selectedYear || '2026-2027';

  const query = useQuery({
    queryKey: ['students', centerId, schoolYear],
    queryFn: async () => {
      if (!centerId) return [];
      const [studRes, coursesRes] = await Promise.all([
        supabase
          .from('students')
          .select('*')
          .eq('center_id', centerId)
          .order('created_at', { ascending: false })
          .range(0, 9999),
        supabase
          .from('courses')
          .select('id, school_year, level, grade, section, tanda')
          .eq('center_id', centerId)
          .range(0, 9999)
      ]);

      if (studRes.error) throw studRes.error;
      const raw = studRes.data || [];
      const rawCourses = coursesRes.data || [];

      const activeCourses = rawCourses.filter((c: any) => c.school_year === schoolYear);
      const finalActiveCourses = activeCourses.length > 0 ? activeCourses : rawCourses.filter((c: any) => c.school_year === schoolYear);
      const activeCourseIds = new Set(finalActiveCourses.map((c: any) => String(c.id)));

      const normStr = (str: string) => (str || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const canonicalCourseMap = new Map<string, string>();
      rawCourses.forEach((c: any) => {
        const tandaStr = normStr(c.tanda || 'matutina');
        const keyWithTanda = `${normStr(c.level)}_${normStr(c.grade)}_${normStr(c.section)}_${tandaStr}`.replace(/primaria|secundaria|inicial/g, '').trim();
        const keyNoTanda = `${normStr(c.level)}_${normStr(c.grade)}_${normStr(c.section)}`.replace(/primaria|secundaria|inicial/g, '').trim();
        const keyGradeOnly = `${normStr(c.level)}_${normStr(c.grade)}`.replace(/primaria|secundaria|inicial/g, '').trim();

        let activeMatch = finalActiveCourses.find((ac: any) => {
          const acTanda = normStr(ac.tanda || 'matutina');
          const acKey = `${normStr(ac.level)}_${normStr(ac.grade)}_${normStr(ac.section)}_${acTanda}`.replace(/primaria|secundaria|inicial/g, '').trim();
          return acKey === keyWithTanda;
        });

        if (!activeMatch && !normStr(c.grade).includes('pre')) {
          activeMatch = finalActiveCourses.find((ac: any) => {
            const acKey = `${normStr(ac.level)}_${normStr(ac.grade)}_${normStr(ac.section)}`.replace(/primaria|secundaria|inicial/g, '').trim();
            return acKey === keyNoTanda;
          });
        }

        if (!activeMatch && !normStr(c.grade).includes('pre')) {
          activeMatch = finalActiveCourses.find((ac: any) => {
            const acKey = `${normStr(ac.level)}_${normStr(ac.grade)}`.replace(/primaria|secundaria|inicial/g, '').trim();
            return acKey === keyGradeOnly;
          });
        }

        if (activeMatch) {
          canonicalCourseMap.set(String(c.id), String(activeMatch.id));
        }
      });
      canonicalCourseMap.set('7291214b-2cf8-4064-b232-42ad86c8c570', '45d99eaf-28e8-4901-b8e7-950fce7f4f0d');

      const normIdentity = (s: any) =>
        `${s.first_surname || s.last_name || ''} ${s.second_surname || ''} ${s.names || s.first_name || ''}`
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Z0-9]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      const isGenesis = centerId === '29bd105f-af7f-48b1-a9e9-a76ddf1e9ab1';
      const gradSet = new Set(
        (graduatedList as string[]).map((g) =>
          g.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
        )
      );

      const vespIdentitiesSet = new Set([
        'BRITO MARIANO MAXIMILIANO',
        'CASTILLO DELGADO HADID',
        'CEDANO SOLER LUCAS',
        'CEDENO ADAISCHA',
        'CORDERO CEDENO KALEB ENRIQUE',
        'DE LOS SANTOS VALERA YOHANDRY',
        'FLORES RODRIGUEZ DAPHNE',
        'GARCIA JISMEIRY KAMILL',
        'JIMENEZ CABRERA YAHIRA ABIGAIL',
        'JOSE GUERRERO DAMIAN',
        'MEJIA SANTANA BRIANNA KAILANNY',
        'MOJICA RIJO JULIO ALEJANDRO',
        'MONTAS AMARANTE MANUEL ANTONIO',
        'NUNEZ SANTANA YAILEINYS CHARLOTTE',
        'PICHARDO RIJO GAEL ANDRES'
      ]);

      const seenIdentities = new Set<string>();
      const unified: any[] = [];

      if (schoolYear === '2026-2027') {
        raw.forEach((s: any) => {
          const st = (s.status || '').toLowerCase().trim();
          if (st === 'retirado' || st === 'inactivo' || st === 'graduado' || st === 'egresado' || st === 'expulsado') return;

          const firstName = (s.names || s.first_name || '').trim();
          const lastName = (s.first_surname || s.last_name || '').trim();
          const secondSurname = (s.second_surname || '').trim();
          
          s.names = firstName || lastName;
          s.first_name = firstName || lastName;
          s.first_surname = lastName || firstName;
          s.second_surname = secondSurname;
          s.last_name = `${lastName} ${secondSurname}`.trim() || firstName;

          const key = normIdentity(s);
          if (!key) return;

          // Excluir graduados de 2025 solo si no es un nuevo ingreso o reingreso formal de 2026
          const is2026New = (s.created_at && s.created_at >= '2026-08-01') || s.school_year === '2026-2027';
          if (isGenesis && !is2026New && gradSet.has(key)) return;

          // Si el registro pertenece explícitamente al ciclo escolar 2025-2026 y no fue reinscrito en 2026, dejar en el historial de 2025-2026
          if (s.school_year === '2025-2026' && !is2026New && (!s.course_id || !activeCourseIds.has(String(s.course_id)))) {
            return;
          }

          if (!seenIdentities.has(key)) {
            seenIdentities.add(key);
            
            let targetCid = s.course_id;

            if (isGenesis) {
              const isPreprimarioVesp = vespIdentitiesSet.has(key) || (s.shift || '').toLowerCase().includes('vesp') || (s.shift || '').toLowerCase().includes('tard');
              if (s.course_id === '8400e2af-1124-421c-8ad3-f35e96c49525' || (isPreprimarioVesp && (s.course_id === '73f8f202-f31f-465b-b1ef-6028b89ae271' || s.course_id === '7291214b-2cf8-4064-b232-42ad86c8c570' || s.course_id === 'beff5a14-a3d7-4249-bff4-5b3b843adc36' || !s.course_id))) {
                targetCid = '8400e2af-1124-421c-8ad3-f35e96c49525';
              } else if (s.course_id && activeCourseIds.has(String(s.course_id))) {
                targetCid = s.course_id;
              } else if (s.course_id && canonicalCourseMap.has(String(s.course_id))) {
                targetCid = canonicalCourseMap.get(String(s.course_id))!;
              }
            } else {
              if (s.course_id && activeCourseIds.has(String(s.course_id))) {
                targetCid = s.course_id;
              } else if (s.course_id && canonicalCourseMap.has(String(s.course_id))) {
                targetCid = canonicalCourseMap.get(String(s.course_id))!;
              }
            }

            s.course_id = targetCid;
            s.school_year = schoolYear;
            unified.push(s);
          }
        });
      } else {
        // Ciclo 2025-2026: mostrar los 540+ alumnos históricos reales
        raw.forEach((s: any) => {
          const st = (s.status || '').toLowerCase().trim();
          if (st === 'retirado' || st === 'inactivo' || st === 'graduado' || st === 'egresado' || st === 'expulsado') return;

          const key = normIdentity(s);
          if (key && !seenIdentities.has(key)) {
            seenIdentities.add(key);
            unified.push(s);
          }
        });
      }

      return unified;
    },
    staleTime: 1000 * 5 // 5 segundos de caché para reflejar cambios de inmediato
  });

  const addStudentMutation = useMutation({
    mutationFn: async (newStudent: any) => {
      const { error } = await supabase.from('students').insert([
        {
          ...newStudent,
          center_id: centerId,
          school_year: schoolYear
        }
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', centerId, schoolYear] });
      queryClient.invalidateQueries({ queryKey: ['center-stats', centerId] });
    }
  });

  const updateStudentMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase.from('students').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', centerId, schoolYear] });
    }
  });

  const deleteStudentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', centerId, schoolYear] });
      queryClient.invalidateQueries({ queryKey: ['center-stats', centerId] });
    }
  });

  return {
    students: query.data || [],
    isLoading: query.isLoading,
    addStudent: addStudentMutation.mutateAsync,
    updateStudent: updateStudentMutation.mutateAsync,
    deleteStudent: deleteStudentMutation.mutateAsync
  };
};
