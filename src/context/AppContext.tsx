import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export const normalizeNameString = (name: string): string => {
  if (!name) return '';
  return name
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
};

export interface AppState {
  courses: any[];
  subjects: any[];
  teachers: any[];
  assignments: any[];
  rooms: any[];
  timeBlocks: any[];
  schedule: any[];
  academicRequirements: any[];
  teacherPreferences: any[];
  breakPreferences: any[];
  priorityPreferences: any[];
  winterSchedulePreference: any | null;
  levelSchedules: any[];
  fixedEvents: any[]; // NUEVO
  schoolYears: any[]; // NUEVO
  attendanceRecords: any[];
  performanceAlerts: any[];
  students: any[]; // NUEVO
  grades: any[]; // NUEVO
  activities: any[]; // NUEVO: Agenda Escolar
  avoidDeporteDuringAnyBreak?: boolean;
  loading: boolean;
  error: string | null;
  teacherPerformanceStats?: any[];
}

interface AppContextType {
  state: AppState;
  user: any | null;
  profile: any | null;
  center: any | null;
  license: any | null;
  isSubscriptionExpired: boolean;
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  refreshData: (centerId?: string, force?: boolean) => Promise<void>;
  updateProfile: (updates: any) => Promise<void>;
  addSchoolYear: (y: any) => Promise<void>;
  deleteSchoolYear: (id: string) => Promise<void>;
  updateSchoolYear: (id: string, u: any) => Promise<void>;
  addCourse: (c: any) => Promise<void>;
  updateCourse: (id: string, u: any) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;
  addSubject: (s: any) => Promise<void>;
  updateSubject: (id: string, u: any) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  addAssignment: (a: any) => Promise<void>;
  deleteAssignment: (id: string) => Promise<void>;
  addAcademicRequirement: (r: any) => Promise<void>;
  deleteAcademicRequirement: (id: string) => Promise<void>;
  addTeacherPreference: (p: any) => Promise<void>;
  deleteTeacherPreference: (id: string) => Promise<void>;
  addBreakPreference: (b: any) => Promise<void>;
  deleteBreakPreference: (id: string) => Promise<void>;
  addPriorityPreference: (p: any) => Promise<void>;
  deletePriorityPreference: (id: string) => Promise<void>;
  setWinterSchedulePreference: (w: any) => Promise<void>;
  addActivity: (a: any) => Promise<void>;
  updateActivity: (id: string, u: any) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
  addAttendanceRecord: (record: any) => Promise<void>;
  setAvoidDeporteDuringAnyBreak: (val: boolean) => void;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  loadAllGrades: () => Promise<any[]>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    courses: [],
    subjects: [],
    teachers: [],
    assignments: [],
    rooms: [],
    timeBlocks: [],
    schedule: [],
    academicRequirements: [],
    teacherPreferences: [],
    breakPreferences: [],
    priorityPreferences: [],
    winterSchedulePreference: null,
    levelSchedules: [],
    fixedEvents: [], // NUEVO
    schoolYears: [], // NUEVO
    attendanceRecords: [],
    performanceAlerts: [],
    students: [], // NUEVO
    grades: [], // NUEVO
    activities: [],
    loading: true,
    error: null
  });
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [center, setCenter] = useState<any | null>(null);
  const [license, setLicense] = useState<any | null>(null);
  const [isSubscriptionExpired, setIsSubscriptionExpired] = useState<boolean>(false);
  const [selectedYear, setSelectedYear] = useState('');

  useEffect(() => {
    if (profile?.center_id) {
      const stored = localStorage.getItem(`edugest_selected_year_${profile.center_id}`);
      setSelectedYear(stored || '');
      const storedDeporteBreak = localStorage.getItem(`edugest_avoid_deporte_break_${profile.center_id}`);
      setState((prev) => ({
        ...prev,
        avoidDeporteDuringAnyBreak: storedDeporteBreak === 'true'
      }));
    }
  }, [profile?.center_id]);

  const setAvoidDeporteDuringAnyBreak = (val: boolean) => {
    setState((prev) => ({ ...prev, avoidDeporteDuringAnyBreak: val }));
    if (profile?.center_id) {
      localStorage.setItem(`edugest_avoid_deporte_break_${profile.center_id}`, val ? 'true' : 'false');
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && profile?.center_id && selectedYear) {
      localStorage.setItem(`edugest_selected_year_${profile.center_id}`, selectedYear);
    }
  }, [selectedYear, profile?.center_id]);

  const [isAuthReady, setIsAuthReady] = useState(false);

  const stateRef = useRef(state);
  const fetchPromiseRef = useRef<Promise<void> | null>(null);
  const lastFetchedYearRef = useRef<string | null>(null);
  const userRef = useRef<any | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const refreshData = useCallback(
    async (centerId?: string, force = false) => {
      const targetCid = centerId || profile?.center_id;
      if (!targetCid) {
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }

      // Si ya hay una petición concurrente en curso, reusamos la misma promesa
      if (!force && fetchPromiseRef.current) {
        return fetchPromiseRef.current;
      }

      const latestState = stateRef.current;
      const yearChanged = lastFetchedYearRef.current !== selectedYear;

      // Si no es forzado ni cambió el año, y ya hay datos cargados, evitamos recargar
      if (
        !force &&
        !yearChanged &&
        latestState.courses.length > 0 &&
        latestState.teachers.length > 0
      ) {
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }

      const performFetch = async () => {
        setState((prev) => ({ ...prev, loading: true }));
        try {
          let currentFetchYear = selectedYear;
          let resolvedSyResData: any[] | null = null;

          // Resolve active school year beforehand if empty to avoid querying empty values
          if (!currentFetchYear) {
            const { data } = await supabase
              .from('school_years')
              .select('*')
              .eq('center_id', targetCid)
              .order('name', { ascending: false });

            resolvedSyResData = data || [];
            const activeYear = resolvedSyResData?.find((y: any) => y.status === 'activo' || y.is_active);
            const fallbackYear = activeYear?.name || resolvedSyResData?.[0]?.name || '2026-2027';
            currentFetchYear = fallbackYear;

            // Immediately set the state for selectedYear
            setSelectedYear(fallbackYear);
          }

          const [
            cRes,
            sRes,
            pRes,
            aRes,
            stRes,
            tLegacy,
            reqRes,
            tPrefRes,
            bPrefRes,
            wPrefRes,
            roomRes,
            blockRes,
            schedRes,
            perfRes,
            lvlSchedRes,
            fEventsRes,
            syRes,
            studRes,
            actRes,
            centRes,
            licRes,
            pPrefRes
          ] = await Promise.all([
            supabase
              .from('courses')
              .select('*')
              .eq('center_id', targetCid)
              .or(`school_year.eq.${currentFetchYear},school_year.is.null,school_year.eq.""`),
            supabase.from('subjects').select('*').eq('center_id', targetCid),
            supabase.from('profiles').select('*').eq('center_id', targetCid),
            supabase.from('assignments').select('*').eq('center_id', targetCid),
            supabase.from('staff').select('*').eq('center_id', targetCid),
            supabase.from('teachers').select('*').eq('center_id', targetCid),
            supabase.from('academic_requirements').select('*').eq('center_id', targetCid),
            supabase.from('teacher_preferences').select('*').eq('center_id', targetCid),
            supabase.from('break_preferences').select('*').eq('center_id', targetCid),
            supabase
              .from('winter_schedule_preferences')
              .select('*')
              .eq('center_id', targetCid)
              .single(),
            supabase.from('rooms').select('*').eq('center_id', targetCid),
            supabase.from('time_blocks').select('*').eq('center_id', targetCid),
            supabase
              .from('schedule_entries')
              .select('*')
              .eq('center_id', targetCid)
              .or(`school_year.eq.${currentFetchYear},school_year.is.null,school_year.eq.""`),
            supabase
              .from('performance_alerts')
              .select('*')
              .eq('center_id', targetCid)
              .order('date', { ascending: false })
              .limit(200),
            supabase.from('level_schedules').select('*').eq('center_id', targetCid),
            supabase.from('fixed_events').select('*').eq('center_id', targetCid),
            resolvedSyResData
              ? Promise.resolve({ data: resolvedSyResData, error: null })
              : supabase
                  .from('school_years')
                  .select('*')
                  .eq('center_id', targetCid)
                  .order('name', { ascending: false }),
            supabase
              .from('students')
              .select('*')
              .eq('center_id', targetCid)
              .or(`school_year.eq.${currentFetchYear},school_year.is.null,school_year.eq.""`),
            supabase
              .from('activities')
              .select('*')
              .eq('center_id', targetCid)
              .order('date', { ascending: false })
              .limit(300),
            supabase.from('centers').select('*').eq('id', targetCid).single(),
            supabase
              .from('saas_licenses')
              .select('*, plan:saas_plans(*)')
              .eq('used_by_center', targetCid)
              .maybeSingle(),
            supabase.from('priority_preferences').select('*').eq('center_id', targetCid)
          ]);

          if (centRes.data) setCenter(centRes.data);

          if (licRes && licRes.data) {
            setLicense(licRes.data);
            const expired = licRes.data.subscription_end_date
              ? new Date(licRes.data.subscription_end_date) < new Date()
              : false;
            setIsSubscriptionExpired(expired);
          } else {
            setLicense(null);
            setIsSubscriptionExpired(false);
          }

          const normalize = (t: any, priority: number) => {
            const name = (t.name || t.full_name || 'Sin Nombre').trim();
            let rawRole = (t.team || t.role || t.cargo || t.position || '').toLowerCase();

            const isManagement =
              rawRole.includes('gest') ||
              rawRole.includes('direc') ||
              rawRole.includes('coord') ||
              rawRole.includes('management');

            const isTeacher =
              rawRole.includes('docente') ||
              rawRole.includes('teach') ||
              rawRole.includes('maestr') ||
              rawRole.includes('prof') ||
              rawRole.includes('educ') ||
              rawRole.includes('fisic') ||
              rawRole.includes('deport') ||
              rawRole.includes('teacher');

            let finalRole = 'teacher';
            if (rawRole.includes('management_teacher')) {
              finalRole = 'management_teacher';
            } else if (isManagement && isTeacher) {
              finalRole = 'management_teacher';
            } else if (isManagement) {
              finalRole = 'management';
            } else if (
              rawRole.includes('caja') ||
              rawRole.includes('cashier') ||
              rawRole.includes('finan') ||
              rawRole.includes('contab')
            ) {
              finalRole = 'cashier';
            } else if (
              rawRole.includes('admin') ||
              rawRole.includes('secret') ||
              rawRole.includes('administrative')
            ) {
              finalRole = 'administrative';
            } else if (
              rawRole.includes('apoy') ||
              rawRole.includes('cons') ||
              rawRole.includes('support') ||
              rawRole.includes('limpieza') ||
              rawRole.includes('mantenimiento')
            ) {
              finalRole = 'support';
            } else if (isTeacher) {
              finalRole = 'teacher';
            }

            return {
              ...t,
              name: name,
              full_name: name,
              role: finalRole,
              sex: (t.sex || t.gender || 'M').startsWith('F') ? 'F' : 'M',
              _priority: priority
            };
          };

          const rawList = [
            ...(stRes.data || []).map((s) => normalize(s, 1)),
            ...(pRes.data || []).map((p) => normalize(p, 2)),
            ...(tLegacy.data || []).map((t) => normalize(t, 3))
          ];

          const assignedIds = new Set((aRes.data || []).map((a: any) => a.teacher_id));

          const uniquePersonnel: any[] = [];
          const seenNames = new Set();

          rawList
            .sort((a, b) => {
              if (a._priority !== b._priority) return a._priority - b._priority;
              const aAssigned = assignedIds.has(a.id);
              const bAssigned = assignedIds.has(b.id);
              if (aAssigned && !bAssigned) return -1;
              if (!aAssigned && bAssigned) return 1;
              return 0;
            })
            .forEach((p) => {
              const n = normalizeNameString(p.full_name);
              if (n && n !== 'SIN NOMBRE' && !n.includes('GENESIS') && !seenNames.has(n)) {
                seenNames.add(n);
                uniquePersonnel.push(p);
              }
            });

          // Mapa de traducción de IDs originales a IDs unificados
          const idMap: Record<string, string> = {};
          rawList.forEach((raw) => {
            const n = normalizeNameString(raw.full_name);
            const unified = uniquePersonnel.find((u) => normalizeNameString(u.full_name) === n);
            if (unified) {
              idMap[raw.id] = unified.id;
            }
          });

          // Unificación de referencias a docentes en las distintas relaciones y filtrado por año escolar
          const courseIdSet = new Set((cRes.data || []).map((c: any) => String(c.id)));
          const assignmentsUnified = (aRes.data || [])
            .filter((a: any) => courseIdSet.has(String(a.course_id || a.courseId)))
            .map((a: any) => ({
              ...a,
              teacher_id: idMap[a.teacher_id] || a.teacher_id
            }));

          const teacherPrefs = (tPrefRes.data || []).map((p: any) => ({
            id: p.id,
            teacherId: idMap[p.teacher_id] || p.teacher_id,
            workingDays: p.working_days,
            morningStart: p.morning_start,
            morningEnd: p.morning_end,
            afternoonStart: p.afternoon_start,
            afternoonEnd: p.afternoon_end,
            dailyConfig: p.daily_config
          }));

          const breakPrefs = (bPrefRes.data || []).map((b: any) => ({
            id: b.id,
            startTime: b.start_time,
            durationMinutes: b.duration_minutes,
            level: b.level,
            cycle: b.cycle
          }));

          const dbPriorityList = (pPrefRes?.data || []).map((p: any) => ({
            id: p.id,
            level: p.level,
            cycle: p.cycle,
            targetType: p.target_type || p.targetType,
            targetId: p.target_id || p.targetId,
            score: Number(p.score) || 2500
          }));

          const localPriorityPrefs = JSON.parse(localStorage.getItem('edugens_priority_prefs') || '[]');
          
          const combinedMap = new Map();
          localPriorityPrefs.forEach((p: any) => combinedMap.set(`${p.targetType}-${p.targetId}`, p));
          dbPriorityList.forEach((p: any) => combinedMap.set(`${p.targetType}-${p.targetId}`, p));
          const priorityPrefs = Array.from(combinedMap.values());

          if (priorityPrefs.length > 0) {
            try {
              localStorage.setItem('edugens_priority_prefs', JSON.stringify(priorityPrefs));
            } catch (err) {}
          }

          // 1. Filtrar cursos para el año activo (evitar mezclas de otros años)
          const rawCourses = cRes.data || [];
          const yearSpecificCourses = rawCourses.filter((c: any) => c.school_year === currentFetchYear);
          const unassignedCourses = rawCourses.filter((c: any) => !c.school_year || c.school_year === '');
          const filteredCourses = yearSpecificCourses.length > 0
            ? yearSpecificCourses
            : (rawCourses.every((c: any) => !c.school_year) ? unassignedCourses : []);

          let localTitularMap: Record<string, any> = {};
          try {
            localTitularMap = JSON.parse(
              localStorage.getItem('edugens_course_titular_map') || '{}'
            );
          } catch {}

          const coursesUnified = filteredCourses.map((c: any) => {
            const localTitular = localTitularMap[c.id] || {};
            const rawTeacherId = c.titular_teacher_id || localTitular.titular_teacher_id || null;
            const mappedTeacherId = rawTeacherId ? (idMap[rawTeacherId] || rawTeacherId) : null;
            return {
              ...c,
              school_year: c.school_year || currentFetchYear,
              titular_teacher_id: mappedTeacherId,
              titular_subject_id: c.titular_subject_id || localTitular.titular_subject_id || null,
              titular_monday_first_hour:
                c.titular_monday_first_hour !== undefined
                  ? c.titular_monday_first_hour
                  : localTitular.titular_monday_first_hour !== undefined
                    ? localTitular.titular_monday_first_hour
                    : true
            };
          });

          // 2. Filtrar horarios para el año activo
          const rawSchedule = schedRes.data || [];
          const yearSpecificSchedule = rawSchedule.filter((s: any) => s.school_year === currentFetchYear);
          const unassignedSchedule = rawSchedule.filter((s: any) => !s.school_year || s.school_year === '');
          const filteredSchedule = yearSpecificSchedule.length > 0
            ? yearSpecificSchedule
            : (rawSchedule.every((s: any) => !s.school_year) ? unassignedSchedule : []);

          const scheduleUnified = filteredSchedule.map((s: any) => ({
            ...s,
            school_year: s.school_year || currentFetchYear,
            teacher_id: idMap[s.teacher_id] || s.teacher_id
          }));

          // 3. Filtrar estudiantes para el año activo (evitar sumar los 1000 estudiantes de años anteriores)
          const rawStudents = studRes.data || [];
          const yearSpecificStudents = rawStudents.filter((s: any) => s.school_year === currentFetchYear);
          const unassignedStudents = rawStudents.filter((s: any) => !s.school_year || s.school_year === '');
          const filteredStudents = yearSpecificStudents.length > 0
            ? yearSpecificStudents
            : (rawStudents.every((s: any) => !s.school_year) ? unassignedStudents : []);

          const priorityPrefsUnified = priorityPrefs.map((p: any) => {
            if (p.targetType === 'teacher') {
              return {
                ...p,
                targetId: idMap[p.targetId] || p.targetId
              };
            }
            return p;
          });

          const performanceAlertsUnified = (perfRes.data || []).map((p: any) => ({
            ...p,
            teacher_id: idMap[p.teacher_id] || p.teacher_id
          }));

          setState((prev) => ({
            ...prev,
            courses: coursesUnified,
            subjects: sRes.data || [],
            teachers: uniquePersonnel,
            assignments: assignmentsUnified,
            academicRequirements: reqRes.data || [],
            teacherPreferences: teacherPrefs,
            breakPreferences: breakPrefs,
            priorityPreferences: priorityPrefsUnified,
            winterSchedulePreference: wPrefRes.data || null,
            levelSchedules: lvlSchedRes.data || [],
            fixedEvents: fEventsRes.data || [],
            schoolYears: syRes.data || [],
            rooms: roomRes.data || [],
            timeBlocks: blockRes.data || [],
            schedule: scheduleUnified,
            attendanceRecords: [],
            performanceAlerts: performanceAlertsUnified,
            students: filteredStudents,
            grades: [], // Vacío por defecto
            activities: (actRes.data || []).map((a: any) => ({
              ...a,
              startTime: a.start_time,
              endTime: a.end_time
            })),
            loading: false
          }));

          lastFetchedYearRef.current = currentFetchYear;

          // Seleccionar automáticamente el año activo si existe
          if (!selectedYear) {
            // Ya se resolvió e inicializó currentFetchYear al principio del fetch
          } else {
            const activeYear = syRes.data?.find((y: any) => y.status === 'activo' || y.is_active);
            if (activeYear && (!selectedYear || !syRes.data.some((y: any) => y.name === selectedYear))) {
              setSelectedYear(activeYear.name);
            }
          }
        } catch (error: any) {
          console.error('Error fetching dashboard data:', error);
          setState((prev) => ({ ...prev, loading: false }));
        }
      };

      const promise = performFetch().finally(() => {
        fetchPromiseRef.current = null;
      });

      fetchPromiseRef.current = promise;
      return promise;
    },
    [profile?.center_id, selectedYear]
  );

  const addSchoolYear = async (year: any) => {
    if (!profile?.center_id) return;
    const { error } = await supabase
      .from('school_years')
      .upsert([{ ...year, center_id: profile.center_id }], { onConflict: 'center_id,name' });
    if (error) throw error;
    await refreshData(undefined, true);
  };

  const updateSchoolYear = async (id: string, updates: any) => {
    const { error } = await supabase.from('school_years').update(updates).eq('id', id);
    if (error) throw error;
    await refreshData(undefined, true);
  };

  const deleteSchoolYear = async (id: string) => {
    const { error } = await supabase.from('school_years').delete().eq('id', id);
    if (error) throw error;
    await refreshData(undefined, true);
  };

  // Load initial session on mount
  useEffect(() => {
    const hasAuthHash = window.location.hash && (
      window.location.hash.includes('access_token=') || 
      window.location.hash.includes('id_token=') || 
      window.location.hash.includes('error=')
    );

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);

      if (event === 'SIGNED_IN') {
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        setIsAuthReady(true);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setCenter(null);
        setIsAuthReady(true);
      } else {
        // For INITIAL_SESSION or other events, if no auth hash is in progress, mark auth as ready
        if (!hasAuthHash) {
          setIsAuthReady(true);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch profile whenever user state changes
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setProfile(null);
        setCenter(null);
        return;
      }

      try {
        // 1. Intentar buscar el perfil por ID del usuario
        const { data: profData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        let activeProfile = profData;

        // 2. Si no se encuentra pero el email está disponible, buscar por email como fallback resiliente
        if (!activeProfile && user.email) {
          console.log('[DEBUG auth] Perfil no encontrado por ID. Buscando por email:', user.email);
          const { data: emailProf } = await supabase
            .from('profiles')
            .select('*')
            .ilike('email', user.email)
            .maybeSingle();

          if (emailProf) {
            activeProfile = emailProf;
            console.log(
              '[DEBUG auth] Perfil encontrado por email. Intentando sincronizar ID de Auth...'
            );
            try {
              const { error: syncError } = await supabase
                .from('profiles')
                .update({ id: user.id })
                .ilike('email', user.email);
              if (syncError) throw syncError;
              console.log('[DEBUG auth] ID de perfil sincronizado con éxito.');
            } catch (e) {
              console.warn(
                '[DEBUG auth] No se pudo sincronizar el ID en la tabla profiles (puede deberse a RLS):',
                e
              );
            }
          }
        }

        // 3. Si aún no tiene centro asignado, verificar si hay un centro SaaS vinculado a este correo
        if ((!activeProfile || !activeProfile.center_id) && user.email) {
          const cleanEmail = user.email.trim().toLowerCase();
          const { data: licData } = await supabase
            .from('saas_licenses')
            .select('id, used_by_center, product_key')
            .ilike('linked_email', cleanEmail)
            .not('used_by_center', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (licData && licData.used_by_center) {
            console.log(
              '[DEBUG auth] Centro SaaS vinculado encontrado para este correo:',
              licData.used_by_center
            );
            try {
              await supabase.from('profiles').upsert([
                {
                  id: user.id,
                  email: user.email,
                  center_id: licData.used_by_center,
                  role: 'admin',
                  is_active: true
                }
              ]);
            } catch (err) {
              console.warn('[DEBUG auth] Error actualizando perfil con centro vinculado:', err);
            }

            activeProfile = {
              ...(activeProfile || {}),
              id: user.id,
              email: user.email,
              center_id: licData.used_by_center,
              role: 'admin',
              is_active: true
            };
          }
        }

        const finalProfile = activeProfile || {
          center_id: null,
          role: 'pending',
          email: user.email
        };
        setProfile(finalProfile);

        if (finalProfile.center_id) {
          const { data: centData } = await supabase
            .from('centers')
            .select('*')
            .eq('id', finalProfile.center_id)
            .single();
          if (centData) setCenter(centData);
        } else {
          setState((prev) => ({ ...prev, loading: false }));
        }
      } catch (err) {
        console.error('Error loading profile:', err);
        setState((prev) => ({ ...prev, loading: false }));
      }
    };

    loadProfile();
  }, [user]);

  // Cargar/Sincronizar datos reactivamente cuando cambie el centro o el año escolar seleccionado
  useEffect(() => {
    if (profile?.center_id) {
      refreshData(profile.center_id);
    }
  }, [profile?.center_id, selectedYear, refreshData]);

  const addCourse = async (c: any) => {
    if (!profile?.center_id) return;
    await supabase
      .from('courses')
      .insert([{ ...c, center_id: profile.center_id, school_year: c.school_year || selectedYear }]);
    await refreshData(undefined, true);
  };
  const deleteCourse = async (id: string) => {
    await supabase.from('courses').delete().eq('id', id);
    await refreshData(undefined, true);
  };
  const addSubject = async (s: any) => {
    if (!profile?.center_id) return;
    await supabase.from('subjects').insert([{ ...s, center_id: profile.center_id }]);
    await refreshData(undefined, true);
  };
  const deleteSubject = async (id: string) => {
    await supabase.from('subjects').delete().eq('id', id);
    await refreshData(undefined, true);
  };
  const addAssignment = async (a: any) => {
    if (!profile?.center_id) return;
    const mapped = {
      course_id: a.courseId,
      subject_id: a.subjectId,
      teacher_id: a.teacherId,
      hours_per_week: a.hoursPerWeek,
      center_id: profile.center_id
    };
    await supabase.from('assignments').insert([mapped]);
    await refreshData(undefined, true);
  };
  const deleteAssignment = async (id: string) => {
    await supabase.from('assignments').delete().eq('id', id);
    await refreshData(undefined, true);
  };

  const addAcademicRequirement = async (r: any) => {
    if (!profile?.center_id) return;
    const mapped = {
      level: r.level || 'Primario',
      cycle: r.cycle,
      modality: r.modality,
      output: r.output,
      weekly_hours: r.weeklyHours,
      class_duration_minutes: r.classDurationMinutes,
      center_id: profile.center_id
    };
    await supabase.from('academic_requirements').insert([mapped]);
    await refreshData(undefined, true);
  };
  const deleteAcademicRequirement = async (id: string) => {
    await supabase.from('academic_requirements').delete().eq('id', id);
    await refreshData(undefined, true);
  };

  const addTeacherPreference = async (p: any) => {
    if (!profile?.center_id) return;
    const mapped = {
      teacher_id: p.teacherId,
      working_days: p.workingDays,
      morning_start: p.morningStart,
      morning_end: p.morningEnd,
      afternoon_start: p.afternoonStart,
      afternoon_end: p.afternoonEnd,
      daily_config: p.dailyConfig,
      center_id: profile.center_id
    };
    if (p.id) await supabase.from('teacher_preferences').update(mapped).eq('id', p.id);
    else await supabase.from('teacher_preferences').insert([mapped]);
    await refreshData(undefined, true);
  };
  const deleteTeacherPreference = async (id: string) => {
    await supabase.from('teacher_preferences').delete().eq('id', id);
    await refreshData(undefined, true);
  };

  const addBreakPreference = async (b: any) => {
    if (!profile?.center_id) return;
    const mapped = {
      start_time: b.startTime,
      duration_minutes: b.durationMinutes,
      level: b.level,
      cycle: b.cycle,
      center_id: profile.center_id
    };
    await supabase.from('break_preferences').insert([mapped]);
    await refreshData(undefined, true);
  };
  const deleteBreakPreference = async (id: string) => {
    await supabase.from('break_preferences').delete().eq('id', id);
    await refreshData(undefined, true);
  };

  const addPriorityPreference = async (p: any) => {
    const cid = profile?.center_id;
    const current = JSON.parse(localStorage.getItem('edugens_priority_prefs') || '[]');
    const newPref = { ...p, id: p.id || Math.random().toString(36).substring(7) };
    const updated = p.id
      ? current.map((c: any) => (c.id === p.id ? newPref : c))
      : [...current, newPref];
    localStorage.setItem('edugens_priority_prefs', JSON.stringify(updated));

    if (cid) {
      const payload = {
        center_id: cid,
        level: p.level,
        cycle: p.cycle,
        target_type: p.targetType,
        target_id: p.targetId,
        score: p.score
      };
      try {
        if (p.id && typeof p.id === 'string' && p.id.length > 20) {
          await supabase.from('priority_preferences').update(payload).eq('id', p.id);
        } else {
          await supabase.from('priority_preferences').insert([payload]);
        }
      } catch (err) {
        console.warn('Priority preference persisted locally:', err);
      }
    }

    setState((prev) => ({
      ...prev,
      priorityPreferences: updated
    }));

    if (cid) await refreshData(undefined, true);
  };

  const deletePriorityPreference = async (id: string) => {
    const cid = profile?.center_id;
    const current = JSON.parse(localStorage.getItem('edugens_priority_prefs') || '[]');
    const updated = current.filter((c: any) => c.id !== id);
    localStorage.setItem('edugens_priority_prefs', JSON.stringify(updated));

    if (cid && id) {
      try {
        await supabase.from('priority_preferences').delete().eq('id', id);
      } catch (err) {
        console.warn('Priority preference deleted locally:', err);
      }
    }

    setState((prev) => ({
      ...prev,
      priorityPreferences: updated
    }));

    if (cid) await refreshData(undefined, true);
  };

  const addAttendanceRecord = async (record: any) => {
    if (!profile?.center_id) return;
    const mapped = {
      teacher_id: record.teacherId,
      date: record.date,
      status: record.status,
      notes: record.notes,
      center_id: profile.center_id
    };
    const { error } = await supabase.from('attendance_records').insert([mapped]);
    if (error) {
      console.error('Error in addAttendanceRecord:', error);
      throw error;
    }
    await refreshData(undefined, true);
  };

  const setWinterSchedulePreference = async (w: any) => {
    if (!profile?.center_id) return;
    if (!w) {
      await supabase
        .from('winter_schedule_preferences')
        .delete()
        .eq('center_id', profile.center_id);
    } else {
      const mapped = {
        start_date: w.startDate,
        end_date: w.endDate,
        reduction_factor: w.reductionFactor,
        center_id: profile.center_id
      };
      await supabase
        .from('winter_schedule_preferences')
        .upsert(mapped, { onConflict: 'center_id' });
    }
    await refreshData(undefined, true);
  };

  return (
    <AppContext.Provider
      value={{
        state,
        user,
        profile,
        center,
        license,
        isSubscriptionExpired,
        selectedYear,
        setSelectedYear,
        refreshData,
        loadAllGrades: async () => {
          const targetCid = center?.id || profile?.center_id;
          if (!targetCid) return [];
          if (state.grades && state.grades.length > 0) return state.grades;

          try {
            const { data, error } = await supabase
              .from('student_grades')
              .select('*')
              .eq('center_id', targetCid)
              .eq('school_year', selectedYear);

            if (error) throw error;
            if (data) {
              setState((prev) => ({ ...prev, grades: data }));
              return data;
            }
          } catch (err) {
            console.error('Error fetching on-demand grades:', err);
          }
          return [];
        },
        updateProfile: async () => {},
        addSchoolYear,
        deleteSchoolYear,
        updateSchoolYear,
        addCourse,
        updateCourse: async () => {},
        deleteCourse,
        addSubject,
        updateSubject: async () => {},
        deleteSubject,
        addAssignment,
        deleteAssignment,
        addAcademicRequirement,
        deleteAcademicRequirement,
        addTeacherPreference,
        deleteTeacherPreference,
        addBreakPreference,
        deleteBreakPreference,
        addPriorityPreference,
        deletePriorityPreference,
        setWinterSchedulePreference,
        addAttendanceRecord,
        setAvoidDeporteDuringAnyBreak,
        setAppState: setState,
        addActivity: async (a: any) => {
          if (!profile?.center_id) return;
          const mapped = {
            title: a.title,
            description: a.description,
            date: a.date,
            start_time: a.startTime,
            end_time: a.endTime,
            type: a.type || 'event',
            schedule_entry_id: a.scheduleEntryId || null,
            center_id: profile.center_id
          };
          const { error } = await supabase.from('activities').insert([mapped]);
          if (error) {
            console.error('Error in addActivity:', error);
            throw error;
          }
          await refreshData(undefined, true);
        },
        updateActivity: async (id: string, u: any) => {
          const mapped = {
            title: u.title,
            description: u.description,
            date: u.date,
            start_time: u.startTime,
            end_time: u.endTime,
            type: u.type || 'event',
            schedule_entry_id: u.scheduleEntryId || null
          };
          const { error } = await supabase.from('activities').update(mapped).eq('id', id);
          if (error) {
            console.error('Error in updateActivity:', error);
            throw error;
          }
          await refreshData(undefined, true);
        },
        deleteActivity: async (id: string) => {
          const { error } = await supabase.from('activities').delete().eq('id', id);
          if (error) throw error;
          await refreshData(undefined, true);
        }
      }}
    >
      <AuthContext.Provider value={{ user, profile, isAuthReady }}>{children}</AuthContext.Provider>
    </AppContext.Provider>
  );
};

const AuthContext = createContext<{ user: any; profile: any; isAuthReady: boolean } | undefined>(
  undefined
);
export const useSupabase = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useSupabase must be used within AppProvider');
  return context;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
