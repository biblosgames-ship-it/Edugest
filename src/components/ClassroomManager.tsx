import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useApp, useSupabase } from '../context/AppContext';
import { useStudents } from '../hooks/useStudents';
import { useCourses } from '../hooks/useCourses';
import { useAssignments } from '../hooks/useAssignments';
import { useSubjects } from '../hooks/useSubjects';
import { supabase } from '../lib/supabase';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  BookOpen,
  FileText,
  Plus,
  Save,
  Search,
  Phone,
  UserCheck,
  Calendar,
  Sparkles,
  Award,
  Filter,
  Check,
  Info,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  ExternalLink,
  Edit3,
  Trash2,
  Video,
  Globe,
  Link as LinkIcon,
  ClipboardList,
  X,
  Settings,
  Pin,
  MessageSquare,
  Send
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { useTeacherIdentity } from '../utils/teacherUtils';
import { LinkifiedText, parseTextWithLinks } from './LinkifiedText';
import { enqueueSyncAction } from '../utils/offlineSync';

type AttendanceStatus = 'presente' | 'tardanza' | 'excusa' | 'ausente';
type NoteCategory = 'Conducta' | 'Académico' | 'Padres' | 'Salud';

const getDefaultActivities = (): Record<string, Array<{ id: string; name: string; maxScore: number }>> => ({
  'c1': [{ id: 'act_c1_1', name: 'Actividad 1', maxScore: 100 }],
  'c2': [{ id: 'act_c2_1', name: 'Actividad 1', maxScore: 100 }],
  'c3': [{ id: 'act_c3_1', name: 'Actividad 1', maxScore: 100 }],
  'c4': [{ id: 'act_c4_1', name: 'Actividad 1', maxScore: 100 }],
});

export interface ClassroomManagerProps {
  initialTab?: 'attendance' | 'notes' | 'partials' | 'tasks' | 'folder';
  onTabChange?: (tab: 'attendance' | 'notes' | 'partials' | 'tasks' | 'folder') => void;
}

export const ClassroomManager: React.FC<ClassroomManagerProps> = ({
  initialTab = 'attendance',
  onTabChange
}) => {
  const { state, center, selectedYear } = useApp();
  const { profile } = useSupabase();
  const { isSameTeacher } = useTeacherIdentity();
  const { courses: allCourses } = useCourses();
  const { subjects: allSubjects } = useSubjects();
  const { assignments: allAssignments } = useAssignments();
  const { students: allStudents, isLoading: studentsLoading } = useStudents();

  // Roles y Permisos: Equipo de Gestión, Coordinadores y Directores
  const isManagementOrDirector = Boolean(
    profile?.is_superadmin ||
    ['admin', 'superAdmin', 'coordinator', 'coordinador', 'management_teacher', 'director', 'directora', 'orientador', 'orientacion', 'psicologo', 'creator'].includes(profile?.role || '')
  );

  // Verificador si un apunte o nota fue redactada por el usuario actual
  const isMyNote = (n: { teacherId?: string; teacherName?: string }) => {
    if (!profile) return false;
    const myTeacherId = profile.teacher_id || profile.id;
    const myName = (profile.full_name || profile.name || '').toLowerCase().trim();
    if (n.teacherId && myTeacherId && String(n.teacherId) === String(myTeacherId)) return true;
    if (myName && n.teacherName && n.teacherName.toLowerCase().trim() === myName) return true;
    return false;
  };

  // Fecha local YYYY-MM-DD
  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Estados de vista
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'attendance' | 'notes' | 'partials' | 'tasks' | 'folder'>(initialTab);

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleTabChange = (tab: 'attendance' | 'notes' | 'partials' | 'tasks' | 'folder') => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [hideStudentNames, setHideStudentNames] = useState<boolean>(false);

  // Estado de Asistencia
  const [attendanceState, setAttendanceState] = useState<Record<string, { status: AttendanceStatus; note: string }>>({});
  const [isSavingAttendance, setIsSavingAttendance] = useState<boolean>(false);
  const [attendanceSuccess, setAttendanceSuccess] = useState<boolean>(false);

  // Estado de Apuntes / Anecdotario
  const [notesList, setNotesList] = useState<Array<{
    id: string;
    studentId: string;
    teacherId?: string;
    date: string;
    category: NoteCategory;
    content: string;
    teacherName: string;
  }>>(() => {
    const saved = localStorage.getItem('edugens_anecdotal_notes') || localStorage.getItem('edugest_anecdotal_notes');
    return saved ? JSON.parse(saved) : [];
  });
  const [newNoteStudentId, setNewNoteStudentId] = useState<string>('');
  const [newNoteCategory, setNewNoteCategory] = useState<NoteCategory>('Conducta');
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const [notesTeacherFilter, setNotesTeacherFilter] = useState<'ALL' | 'MINE'>('ALL');

  // Estado de Notas del Alumno (cargadas exclusivamente si Gestión de Alumnos le asignó una observación en su perfil)
  const [specialNotesMap, setSpecialNotesMap] = useState<Record<string, string>>({});
  const [selectedSpecialNoteModalStudentId, setSelectedSpecialNoteModalStudentId] = useState<string | null>(null);

  // Estado de Excusas Activas (cargadas desde el módulo de comunicaciones para los alumnos del curso)
  const [activeExcusesMap, setActiveExcusesMap] = useState<Record<string, {
    id: string;
    studentId: string;
    studentName?: string;
    motive: string;
    message: string;
    senderName: string;
    createdAt: string;
    validUntil: string;
    color: string;
    durationHours?: number;
    hoursRemaining: number;
  }>>({});
  const [selectedExcuseModalData, setSelectedExcuseModalData] = useState<any | null>(null);

  // Modo de Cálculo de Parciales por Competencias: 'average' (promediado base 100) o 'sum' (sumativo acumulación hasta 100)
  const [competencyCalcMode, setCompetencyCalcMode] = useState<'average' | 'sum'>('average');

  const [selectedPeriod, setSelectedPeriod] = useState<string>('P1');

  // Estados de Tareas y Enlaces Fijos
  const [courseTasks, setCourseTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<boolean>(false);
  const [taskFilterPeriod, setTaskFilterPeriod] = useState<string>('ALL');
  const [taskFilterStatus, setTaskFilterStatus] = useState<'ALL' | 'active' | 'expired'>('ALL');
  const [taskFilterSubjectId, setTaskFilterSubjectId] = useState<string>('ALL');
  const [taskSearchQuery, setTaskSearchQuery] = useState<string>('');

  const [platformLinks, setPlatformLinks] = useState<{
    classroom_url: string;
    meet_url: string;
    other_url: string;
    other_label: string;
  }>({
    classroom_url: '',
    meet_url: '',
    other_url: '',
    other_label: 'Plataforma Alterna'
  });
  const [showLinksModal, setShowLinksModal] = useState<boolean>(false);
  const [tempLinks, setTempLinks] = useState({
    classroom_url: '',
    meet_url: '',
    other_url: '',
    other_label: 'Plataforma Alterna'
  });
  const [isSavingLinks, setIsSavingLinks] = useState<boolean>(false);

  const [showTaskModal, setShowTaskModal] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [taskFormData, setTaskFormData] = useState<{
    title: string;
    description: string;
    period: string;
    subject_id: string;
    due_date: string;
    media_url: string;
    link_url: string;
    classroom_url: string;
    linkToPartial: boolean;
    linkedCompetencyId: string;
    linkedMaxScore: number;
  }>({
    title: '',
    description: '',
    period: 'P1',
    subject_id: '',
    due_date: '',
    media_url: '',
    link_url: '',
    classroom_url: '',
    linkToPartial: false,
    linkedCompetencyId: 'c1',
    linkedMaxScore: 100
  });
  const [isSavingTask, setIsSavingTask] = useState<boolean>(false);

  // Estados para corrección y evaluación de tareas
  const [selectedTaskForGrading, setSelectedTaskForGrading] = useState<any | null>(null);
  const [taskGradingState, setTaskGradingState] = useState<Record<string, {
    status: 'completed' | 'pending' | 'uncompleted';
    score?: number | string;
    feedback?: string;
  }>>({});
  const [gradingSearch, setGradingSearch] = useState<string>('');
  const [gradingStatusFilter, setGradingStatusFilter] = useState<'all' | 'completed' | 'pending' | 'uncompleted'>('all');
  const [bulkGradeValue, setBulkGradeValue] = useState<string>('');
  const [isSavingGrading, setIsSavingGrading] = useState<boolean>(false);
  const [gradingSuccess, setGradingSuccess] = useState<boolean>(false);
  const [gradingIsLinkedToPartial, setGradingIsLinkedToPartial] = useState<boolean>(false);
  const [gradingCompetencyId, setGradingCompetencyId] = useState<string>('c1');
  const [gradingMaxScore, setGradingMaxScore] = useState<number>(100);

  // Asignaturas del curso seleccionado (personalizadas por docente y curso)
  const availableSubjects = useMemo(() => {
    if (!selectedCourseId) return [];
    
    let teacherAssignments = (allAssignments || []).filter(
      (a: any) => (a.course_id || a.courseId) === selectedCourseId
    );

    // Si el usuario es docente, filtrar solo las asignaturas que él imparte en este curso
    if (profile?.role === 'teacher' && profile?.teacher_id) {
      const myAssignments = teacherAssignments.filter(
        (a: any) => isSameTeacher(a.teacher_id || a.teacherId, profile.teacher_id) || (a.teacher_id || a.teacherId) === profile.teacher_id
      );
      if (myAssignments.length > 0) {
        teacherAssignments = myAssignments;
      }
    }

    let subs = teacherAssignments
      .map((a: any) => (allSubjects || []).find((s: any) => s.id === (a.subject_id || a.subjectId)))
      .filter(Boolean);

    // Eliminar duplicados si hay múltiples bloques asignados de la misma materia
    const uniqueSubs = Array.from(new Map(subs.map((s: any) => [s.id, s])).values());

    if (uniqueSubs.length === 0) return allSubjects || [];
    return uniqueSubs;
  }, [selectedCourseId, allAssignments, allSubjects, profile]);

  // Autoseleccionar primera asignatura válida al cambiar curso o asignaturas
  useEffect(() => {
    if (availableSubjects.length > 0) {
      const isValid = availableSubjects.some((s: any) => s.id === selectedSubjectId);
      if (!isValid) {
        setSelectedSubjectId(availableSubjects[0].id);
      }
    } else {
      setSelectedSubjectId('');
    }
  }, [availableSubjects, selectedSubjectId]);

  const currentSubjectObj = useMemo(() => {
    return availableSubjects.find((s: any) => s.id === selectedSubjectId);
  }, [availableSubjects, selectedSubjectId]);

  // Clave de scope estricto: centro_año_docente_curso_asignatura_periodo
  const storageScopeKey = useMemo(() => {
    const centerId = profile?.center_id || center?.id || 'default_center';
    const year = selectedYear || '2026-2027';
    const teacherId = profile?.teacher_id || profile?.id || 'default_teacher';
    const courseId = selectedCourseId || 'nocourse';
    const subjectId = selectedSubjectId || 'nosubject';
    const period = selectedPeriod || 'P1';
    return `edugens_partials_${centerId}_${year}_${teacherId}_${courseId}_${subjectId}_${period}`;
  }, [profile, center?.id, selectedYear, selectedCourseId, selectedSubjectId, selectedPeriod]);

  // Estado de Calificaciones Parciales por Competencias
  const [competencyActivities, setCompetencyActivities] = useState<Record<string, Array<{ id: string; name: string; maxScore: number }>>>(getDefaultActivities);

  const [partialScores, setPartialScores] = useState<Record<string, Record<string, number>>>({});
  const [isSavingPartials, setIsSavingPartials] = useState<boolean>(false);
  const [savePartialsSuccess, setSavePartialsSuccess] = useState<boolean>(false);

  // Cursos disponibles para el usuario
  const availableCourses = useMemo(() => {
    let base = [...(allCourses || [])];
    if (profile?.role === 'teacher' && profile?.teacher_id) {
      const assignedIds = new Set(
        (allAssignments || [])
          .filter((a: any) => isSameTeacher(a.teacher_id || a.teacherId, profile.teacher_id) || (a.teacher_id || a.teacherId) === profile.teacher_id)
          .map((a: any) => a.course_id || a.courseId)
      );
      if (assignedIds.size > 0) {
        base = base.filter((c: any) => assignedIds.has(c.id));
      }
    }
    return base;
  }, [allCourses, profile, allAssignments, isSameTeacher]);

  // Autoseleccionar primer curso disponible
  useEffect(() => {
    if (availableCourses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(availableCourses[0].id);
    }
  }, [availableCourses, selectedCourseId]);

  // Helper para obtener el nombre completo del estudiante (sin duplicar apellidos)
  const getStudentFullName = (s: any) => {
    if (!s) return 'Estudiante';

    if (s.first_surname || s.second_surname) {
      const surname = `${s.first_surname || ''} ${s.second_surname || ''}`.trim();
      const names = (s.names || s.first_name || s.nombre || '').trim();
      if (names && surname) return `${names} ${surname}`.trim();
      if (names) return names;
      if (surname) return surname;
    }

    if (s.names && String(s.names).trim()) {
      const names = String(s.names).trim();
      const surname = (s.apellidos || s.last_name || s.apellido || '').trim();
      if (surname && !names.toLowerCase().includes(surname.toLowerCase())) {
        return `${names} ${surname}`.trim();
      }
      return names;
    }

    if (s.first_name || s.last_name) {
      const fn = (s.first_name || '').trim();
      const ln = (s.last_name || '').trim();
      if (fn && ln && !fn.toLowerCase().includes(ln.toLowerCase())) return `${fn} ${ln}`.trim();
      return fn || ln;
    }

    if (s.full_name && String(s.full_name).trim()) return String(s.full_name).trim();
    if (s.nombre_completo && String(s.nombre_completo).trim()) return String(s.nombre_completo).trim();
    if (s.name && String(s.name).trim()) return String(s.name).trim();
    if (s.nombre) {
      const n = String(s.nombre).trim();
      const ap = (s.apellido || s.apellidos || '').trim();
      if (ap && !n.toLowerCase().includes(ap.toLowerCase())) return `${n} ${ap}`.trim();
      return n;
    }

    return s.student_code || s.rne || (s.order_number ? `Estudiante #${s.order_number}` : 'Estudiante');
  };

  // Helper para clave de ordenamiento por Apellido Primero
  const getSortKeyBySurname = (s: any) => {
    if (!s) return 'zzz';
    if (s.first_surname || s.second_surname) {
      const surname = `${s.first_surname || ''} ${s.second_surname || ''}`.trim();
      const names = s.names || s.first_name || s.name || '';
      return `${surname} ${names}`.trim().toLowerCase();
    }
    if (s.last_name || s.apellidos) {
      const surname = (s.last_name || s.apellidos || '').trim();
      const names = s.names || s.first_name || s.name || '';
      return `${surname} ${names}`.trim().toLowerCase();
    }
    return getStudentFullName(s).toLowerCase();
  };

  // Estudiantes del curso seleccionado
  const courseStudents = useMemo(() => {
    if (!selectedCourseId) return [];
    return (allStudents || [])
      .filter((s: any) => s.course_id === selectedCourseId || s.courseId === selectedCourseId)
      .sort((a: any, b: any) => {
        const numA = (a.order_number !== undefined && a.order_number !== null && a.order_number !== '') ? Number(a.order_number) : null;
        const numB = (b.order_number !== undefined && b.order_number !== null && b.order_number !== '') ? Number(b.order_number) : null;

        if (numA !== null && numB !== null) {
          return numA - numB;
        }
        if (numA !== null) return -1;
        if (numB !== null) return 1;

        return getSortKeyBySurname(a).localeCompare(getSortKeyBySurname(b));
      });
  }, [allStudents, selectedCourseId]);

  // 1. CARGAR ASISTENCIA (DESDE SUPABASE Y RESPALDO LOCAL)
  useEffect(() => {
    if (!selectedCourseId || !selectedDate) return;
    let isMounted = true;

    const loadAttendance = async () => {
      const localKey = `attendance_${selectedCourseId}_${selectedDate}`;
      const saved = localStorage.getItem(localKey);
      let initialMap: Record<string, { status: AttendanceStatus; note: string }> = {};
      if (saved) {
        try {
          initialMap = JSON.parse(saved);
        } catch (e) {}
      }

      try {
        const { data, error } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('course_id', selectedCourseId)
          .eq('date', selectedDate);

        if (!error && data && data.length > 0 && isMounted) {
          // Si hay registros en la nube (checkpoint o excepciones) y localmente no teníamos datos completos:
          const hasCloudRecords = data.length > 0;
          if (hasCloudRecords && Object.keys(initialMap).length === 0) {
            courseStudents.forEach((s: any) => {
              initialMap[s.id] = { status: 'presente', note: '' };
            });
          }

          // Sobrescribir con las excepciones específicas guardadas en BD
          data.forEach((r: any) => {
            if (r.student_id) {
              initialMap[r.student_id] = {
                status: (r.status as AttendanceStatus) || 'presente',
                note: r.notes || ''
              };
            }
          });
        }
      } catch (e) {}

      if (isMounted) {
        setAttendanceState(initialMap);
      }
    };

    loadAttendance();
    return () => { isMounted = false; };
  }, [selectedCourseId, selectedDate, courseStudents]);

  // 2. CARGAR APUNTES / ANECDOTARIO (DESDE SUPABASE Y RESPALDO LOCAL)
  useEffect(() => {
    if (!selectedCourseId) return;
    let isMounted = true;

    const loadNotes = async () => {
      try {
        const { data, error } = await supabase
          .from('student_anecdotal_notes')
          .select('*')
          .eq('course_id', selectedCourseId)
          .order('created_at', { ascending: false });

        if (!error && data && isMounted) {
          const cloudNotes = data.map((n: any) => ({
            id: n.id,
            studentId: n.student_id,
            teacherId: n.teacher_id,
            date: n.date,
            category: n.category as NoteCategory,
            content: n.content,
            teacherName: n.teacher_name || 'Docente'
          }));

          const localSaved = localStorage.getItem('edugens_anecdotal_notes');
          const localNotes = localSaved ? JSON.parse(localSaved) : [];
          const combined = [...cloudNotes];
          localNotes.forEach((ln: any) => {
            if (!combined.some((cn) => cn.id === ln.id)) {
              combined.push(ln);
            }
          });
          setNotesList(combined);
        }
      } catch (e) {}
    };

    loadNotes();
    return () => { isMounted = false; };
  }, [selectedCourseId]);

  // 2.1 CARGAR NOTAS FIJAS / OBSERVACIONES ESPECIALES (CONFIGURADAS EN HISTORIAL)
  useEffect(() => {
    if (!selectedCourseId || courseStudents.length === 0) return;
    let isMounted = true;
    const studentIds = courseStudents.map((s: any) => s.id);

    const isRealStudentNote = (note?: string | null): boolean => {
      if (!note) return false;
      const clean = note.trim().toLowerCase();
      if (!clean) return false;
      const ignored = [
        'no',
        'no.',
        'no tiene',
        'ninguna',
        'ninguno',
        'ningun',
        'ningún',
        'n/a',
        'na',
        '-',
        '--',
        'ninguno/a',
        'sin observaciones',
        'ninguna observacion',
        'ninguna observación',
        'sin observacion',
        'sin observación'
      ];
      return !ignored.includes(clean);
    };

    const loadSpecialNotes = async () => {
      try {
        const { data, error } = await supabase
          .from('student_history')
          .select('student_id, performance_observations')
          .in('student_id', studentIds);

        if (!error && data && isMounted) {
          const map: Record<string, string> = {};
          data.forEach((item: any) => {
            const obs = (item.performance_observations || '').trim();
            if (isRealStudentNote(obs)) {
              map[item.student_id] = obs;
            }
          });
          setSpecialNotesMap(map);
        }
      } catch (err) {
        console.warn('Error fetching special notes from history:', err);
      }
    };

    loadSpecialNotes();
    return () => { isMounted = false; };
  }, [selectedCourseId, courseStudents]);

  // 3. CARGAR CALIFICACIONES PARCIALES (DESDE SUPABASE Y RESPALDO LOCAL)
  useEffect(() => {
    if (!selectedCourseId || !selectedSubjectId) {
      setPartialScores({});
      setCompetencyActivities(getDefaultActivities());
      return;
    }
    let isMounted = true;

    // 1. Carga inmediata desde localStorage o reset para evitar que persista en memoria el curso/periodo previo
    let saved = localStorage.getItem(storageScopeKey);
    let loadedFromLocal = false;

    // Fallback: si no está con la key exacta, buscar variantes con profile.teacher_id / profile.id / default_teacher
    if (!saved) {
      const centerId = profile?.center_id || center?.id || 'default_center';
      const year = selectedYear || '2026-2027';
      const alternates = [profile?.teacher_id, profile?.id, 'default_teacher'].filter(Boolean);
      for (const alt of alternates) {
        const altKey = `edugens_partials_${centerId}_${year}_${alt}_${selectedCourseId}_${selectedSubjectId}_${selectedPeriod}`;
        const val = localStorage.getItem(altKey);
        if (val) {
          saved = val;
          break;
        }
      }
      if (!saved) {
        // Búsqueda genérica por sufijo curso_asignatura_periodo
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('edugens_partials_') && k.endsWith(`_${selectedCourseId}_${selectedSubjectId}_${selectedPeriod}`)) {
            const val = localStorage.getItem(k);
            if (val) {
              saved = val;
              break;
            }
          }
        }
      }
    }

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setPartialScores(parsed.scores || {});
          setCompetencyActivities(parsed.activities || getDefaultActivities());
          if (parsed.calcMode === 'sum' || parsed.calcMode === 'average') {
            setCompetencyCalcMode(parsed.calcMode);
          }
          loadedFromLocal = true;
        }
      } catch (e) {
        console.warn('Error al leer datos locales de parciales:', e);
      }
    }

    if (!loadedFromLocal) {
      // RESET INMEDIATO: asegura que el nuevo curso/periodo comience limpio
      setPartialScores({});
      setCompetencyActivities(getDefaultActivities());
      setCompetencyCalcMode('average');
    }

    // 2. Consulta asíncrona a la nube (Supabase)
    const loadPartials = async () => {
      try {
        const year = selectedYear || '2026-2027';
        const centerId = profile?.center_id || center?.id;

        let query = supabase
          .from('student_partial_activities')
          .select('*')
          .eq('course_id', selectedCourseId)
          .eq('subject_id', selectedSubjectId)
          .eq('period', selectedPeriod)
          .eq('school_year', year)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (centerId) {
          query = query.eq('center_id', centerId);
        }

        const { data, error } = await query;

        if (!isMounted) return;

        const row = data && data.length > 0 ? data[0] : null;

        if (!error && row && row.scores) {
          const cloudScores = row.scores.scores || {};
          const cloudActivities = row.scores.activities || getDefaultActivities();
          const cloudMode = row.scores.calcMode || 'average';

          setPartialScores(cloudScores);
          setCompetencyActivities(cloudActivities);
          setCompetencyCalcMode(cloudMode);

          // Sincronizar respaldo local para este scope exacto
          localStorage.setItem(storageScopeKey, JSON.stringify({
            scores: cloudScores,
            activities: cloudActivities,
            calcMode: cloudMode,
            period: selectedPeriod,
            subjectId: selectedSubjectId,
            courseId: selectedCourseId,
            teacherId: profile?.teacher_id || profile?.id,
            centerId: centerId,
            year: year
          }));
        } else if (!error && (!data || data.length === 0) && !loadedFromLocal) {
          // Solo si Supabase respondió explícitamente sin registros Y no había nada local
          setPartialScores({});
          setCompetencyActivities(getDefaultActivities());
          setCompetencyCalcMode('average');
        }
      } catch (e) {
        console.warn('Error al cargar desglose de parciales de Supabase:', e);
      }
    };

    loadPartials();
    return () => { isMounted = false; };
  }, [storageScopeKey, selectedCourseId, selectedSubjectId, selectedPeriod, selectedYear, profile?.center_id, center?.id]);

  // CARGAR EXCUSAS ACTIVAS PARA LOS ALUMNOS DEL CURSO SELECCIONADO
  useEffect(() => {
    if (!selectedCourseId || courseStudents.length === 0) {
      setActiveExcusesMap({});
      return;
    }
    let isMounted = true;

    const loadCourseExcuses = async () => {
      try {
        const centerId = profile?.center_id || center?.id;
        const comms = await dataService.getCommunications(
          profile?.id || '',
          profile?.role || 'teacher',
          centerId
        );

        if (!isMounted) return;

        const studentIdsSet = new Set(courseStudents.map((s: any) => s.id));
        const now = Date.now();
        const map: Record<string, any> = {};

        (comms || []).forEach((c: any) => {
          const isExcuseMotive = (c.motive || '').toLowerCase().includes('excus') || (c.motive || '').toLowerCase().includes('ausenc');
          if (!isExcuseMotive) return;

          // Verificar si aplica a estudiantes de este curso
          const targets = c.target_student_ids || [];
          targets.forEach((stId: string) => {
            if (!studentIdsSet.has(stId)) return;

            // Calcular vigencia: si tiene valid_until comprobamos tiempo, si no, 12h desde created_at
            let validUntilMs = 0;
            if (c.valid_until) {
              validUntilMs = new Date(c.valid_until).getTime();
            } else if (c.created_at) {
              validUntilMs = new Date(c.created_at).getTime() + (c.duration_hours || 12) * 3600 * 1000;
            }

            // Si aún no ha expirado
            if (validUntilMs > now) {
              const diffMs = validUntilMs - now;
              const hoursRemaining = Math.max(1, Math.round(diffMs / (3600 * 1000)));

              // Guardar la más reciente o con mayor vigencia
              if (!map[stId] || new Date(c.created_at).getTime() > new Date(map[stId].createdAt).getTime()) {
                map[stId] = {
                  id: c.id,
                  studentId: stId,
                  studentName: c.target_student_name,
                  motive: c.motive || 'Excusa Médica / Ausencia',
                  message: c.message,
                  senderName: c.sender_name,
                  createdAt: c.created_at,
                  validUntil: new Date(validUntilMs).toISOString(),
                  color: c.excuse_color || 'amber',
                  durationHours: c.duration_hours || 12,
                  hoursRemaining: hoursRemaining
                };
              }
            }
          });
        });

        setActiveExcusesMap(map);
      } catch (err) {
        console.warn('Error al cargar excusas del curso en ClassroomManager:', err);
      }
    };

    loadCourseExcuses();

    const handleUpdate = () => loadCourseExcuses();
    window.addEventListener('edugens_notifications_updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('edugens_notifications_updated', handleUpdate);
    };
  }, [selectedCourseId, courseStudents, profile?.id, profile?.role, profile?.center_id, center?.id]);

  const [newActivityName, setNewActivityName] = useState<string>('');
  const [selectedCompetencyForNewAct, setSelectedCompetencyForNewAct] = useState<string>('c1');
  const [folderStudentId, setFolderStudentId] = useState<string>('');
  const [folderStudentDetails, setFolderStudentDetails] = useState<{
    parents: any[];
    medical: any;
    history: any;
    studentInfo: any;
    loading: boolean;
  }>({
    parents: [],
    medical: null,
    history: null,
    studentInfo: null,
    loading: false
  });

  // Estado para enviar mensaje interno al tutor desde la ficha
  const [showDirectMessageModal, setShowDirectMessageModal] = useState<boolean>(false);
  const [directMessageRecipient, setDirectMessageRecipient] = useState<{
    studentId: string;
    studentName: string;
    tutorName: string;
    tutorPhone: string;
    courseId: string;
  } | null>(null);
  const [directMessageMotive, setDirectMessageMotive] = useState<string>('Aviso');
  const [directMessageText, setDirectMessageText] = useState<string>('');
  const [isSendingDirectMessage, setIsSendingDirectMessage] = useState<boolean>(false);

  // Cargar expediente digital completo (familia, salud, tutor) al seleccionar alumno
  useEffect(() => {
    if (!folderStudentId) {
      setFolderStudentDetails({
        parents: [],
        medical: null,
        history: null,
        studentInfo: null,
        loading: false
      });
      return;
    }

    let isMounted = true;
    const loadFolder = async () => {
      setFolderStudentDetails((prev) => ({ ...prev, loading: true }));
      try {
        const full = await dataService.getFullStudent(folderStudentId);
        if (isMounted && full) {
          setFolderStudentDetails({
            parents: full.family || [],
            medical: full.medical || null,
            history: full.history || null,
            studentInfo: full,
            loading: false
          });
        }
      } catch (err) {
        console.error('Error loading student folder:', err);
        if (isMounted) {
          setFolderStudentDetails((prev) => ({ ...prev, loading: false }));
        }
      }
    };

    loadFolder();
    return () => {
      isMounted = false;
    };
  }, [folderStudentId]);

  // Guardar o actualizar datos de contacto del tutor
  const handleSendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directMessageRecipient || !directMessageText.trim()) {
      toast.error('Por favor escribe un mensaje.');
      return;
    }

    const targetCourse = availableCourses.find((c) => c.id === selectedCourseId);
    const centerId = profile?.center_id || targetCourse?.center_id || center?.id;
    if (!centerId) {
      toast.error('Centro educativo no identificado.');
      return;
    }

    setIsSendingDirectMessage(true);
    try {
      const senderName = currentTeacherIdentity?.name || profile?.full_name || 'Docente';

      await dataService.saveCommunication({
        center_id: centerId,
        sender_id: profile?.id,
        sender_name: senderName,
        motive: directMessageMotive || 'Aviso',
        message: directMessageText.trim(),
        target_roles: ['Padres'],
        target_student_ids: [directMessageRecipient.studentId],
        target_student_name: directMessageRecipient.studentName,
        target_courses: [directMessageRecipient.courseId || selectedCourseId]
      });

      toast.success(`Mensaje enviado con éxito al tutor de ${directMessageRecipient.studentName}`);
      setShowDirectMessageModal(false);
      setDirectMessageText('');
    } catch (err: any) {
      console.error('Error sending direct message:', err);
      toast.error('Error al enviar el mensaje: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSendingDirectMessage(false);
    }
  };

  // Filtrar estudiantes por búsqueda
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return courseStudents;
    const term = searchTerm.toLowerCase();
    return courseStudents.filter((s: any) =>
      getStudentFullName(s).toLowerCase().includes(term) ||
      (s.rne || '').toLowerCase().includes(term)
    );
  }, [courseStudents, searchTerm]);

  // Manejo de asistencia individual
  const handleSetAttendance = (studentId: string, status: AttendanceStatus) => {
    setAttendanceState((prev) => ({
      ...prev,
      [studentId]: {
        status,
        note: prev[studentId]?.note || ''
      }
    }));
  };

  // Marcar a todos los alumnos como Presentes
  const handleMarkAllPresent = () => {
    const updated: Record<string, { status: AttendanceStatus; note: string }> = {};
    courseStudents.forEach((s: any) => {
      updated[s.id] = { status: 'presente', note: attendanceState[s.id]?.note || '' };
    });
    setAttendanceState(updated);
  };

  // Guardar Asistencia (en LocalStorage y Supabase)
  const handleSaveAttendance = async () => {
    if (!selectedCourseId) return;
    setIsSavingAttendance(true);
    try {
      const targetCourse = availableCourses.find((c) => c.id === selectedCourseId);
      const centerId = center?.id || profile?.center_id || targetCourse?.center_id || (state.teachers?.[0]?.center_id) || '29bd105f-af7f-48b1-a9e9-a76ddf1e9ab1';

      // 1. Mapear estado de asistencia para TODOS los estudiantes del curso
      const fullStateMap: Record<string, { status: AttendanceStatus; note: string }> = {};
      const exceptionRecords: any[] = [];

      courseStudents.forEach((s: any) => {
        const current = attendanceState[s.id];
        const status: AttendanceStatus = current?.status || 'presente';
        const note: string = (current?.note || '').trim();

        fullStateMap[s.id] = { status, note };

        // Guardar como excepción en base de datos si NO es presente o si tiene una nota especial
        if (status !== 'presente' || note !== '') {
          exceptionRecords.push({
            center_id: centerId,
            student_id: s.id,
            course_id: selectedCourseId,
            date: selectedDate,
            status: status,
            notes: note,
            recorded_by: profile?.id || null
          });
        }
      });

      // 2. Guardar en localStorage (estado completo para respuesta instantánea)
      const key = `attendance_${selectedCourseId}_${selectedDate}`;
      localStorage.setItem(key, JSON.stringify(fullStateMap));
      setAttendanceState(fullStateMap);

      // 3. Guardar en Supabase: 1 Checkpoint Maestro de Pase de Lista + Solo Excepciones
      // Esto ahorra un 95% de almacenamiento en la base de datos (<1 MB por año por centro)
      const checkpointRecord = {
        center_id: centerId,
        student_id: null,
        course_id: selectedCourseId,
        date: selectedDate,
        status: 'presente',
        notes: 'PASE_COMPLETO',
        recorded_by: profile?.id || null
      };

      const recordsToInsert = [checkpointRecord, ...exceptionRecords];

      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (isOffline) {
        await enqueueSyncAction({
          type: 'attendance',
          payload: {
            courseId: selectedCourseId,
            date: selectedDate,
            recordsToInsert
          },
          centerId,
          description: `Asistencia curso (${selectedDate})`
        });
      } else {
        try {
          await supabase
            .from('attendance_records')
            .delete()
            .eq('course_id', selectedCourseId)
            .eq('date', selectedDate);

          const { error: insertErr } = await supabase
            .from('attendance_records')
            .insert(recordsToInsert);

          if (insertErr) {
            console.warn('Supabase sparse insert fallback:', insertErr);
            for (const rec of recordsToInsert) {
              try {
                await supabase.from('attendance_records').insert([rec]);
              } catch {}
            }
          }
        } catch (e) {
          console.warn('Supabase attendance save error, guardando en cola offline:', e);
          await enqueueSyncAction({
            type: 'attendance',
            payload: {
              courseId: selectedCourseId,
              date: selectedDate,
              recordsToInsert
            },
            centerId,
            description: `Asistencia curso (${selectedDate})`
          });
        }
      }

      // 4. Notificar a toda la app que la asistencia fue actualizada
      window.dispatchEvent(
        new CustomEvent('edugens_attendance_updated', {
          detail: { courseId: selectedCourseId, date: selectedDate }
        })
      );

      setAttendanceSuccess(true);
      setTimeout(() => setAttendanceSuccess(false), 3000);
    } catch (error) {
      console.error('Error al guardar asistencia:', error);
      alert('Error al guardar asistencia');
    } finally {
      setIsSavingAttendance(false);
    }
  };

  // Guardar nuevo Apunte / Anecdotario (en LocalStorage y Supabase)
  const handleAddNote = async () => {
    if (!newNoteStudentId || !newNoteContent.trim()) {
      alert('Por favor selecciona un estudiante y escribe el apunte.');
      return;
    }

    const targetCourse = availableCourses.find((c) => c.id === selectedCourseId);
    const centerId = profile?.center_id || targetCourse?.center_id;
    const teacherName = profile?.full_name || profile?.name || profile?.email || 'Docente';
    const dateFormatted = new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });

    const note = {
      id: `note_${Date.now()}`,
      studentId: newNoteStudentId,
      teacherId: profile?.teacher_id || profile?.id || '',
      date: dateFormatted,
      category: newNoteCategory,
      content: newNoteContent.trim(),
      teacherName: teacherName
    };

    const updated = [note, ...notesList];
    setNotesList(updated);
    localStorage.setItem('edugens_anecdotal_notes', JSON.stringify(updated));

    if (centerId) {
      try {
        const { data: insertedData, error: insErr } = await supabase
          .from('student_anecdotal_notes')
          .insert([
            {
              center_id: centerId,
              student_id: newNoteStudentId,
              course_id: selectedCourseId,
              teacher_id: profile?.teacher_id || profile?.id || null,
              teacher_name: teacherName,
              category: newNoteCategory,
              content: newNoteContent.trim(),
              date: dateFormatted
            }
          ])
          .select('id')
          .maybeSingle();

        if (insertedData?.id) {
          const withRealId = updated.map((n) => n.id === note.id ? { ...n, id: insertedData.id } : n);
          setNotesList(withRealId);
          localStorage.setItem('edugens_anecdotal_notes', JSON.stringify(withRealId));
        }
      } catch (e) {
        console.warn('Error saving note to Supabase:', e);
      }
    }

    setNewNoteContent('');
    setNewNoteStudentId('');
    toast.success('¡Apunte registrado exitosamente en el historial!');
  };

  // Eliminación de un apunte del anecdotario
  const handleDeleteNote = async (noteId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const confirmed = window.confirm(
      '¿Estás seguro de que deseas eliminar este apunte del historial anecdótico? Esta acción no se puede deshacer.'
    );
    if (!confirmed) return;

    try {
      await supabase.from('student_anecdotal_notes').delete().eq('id', noteId);
    } catch (e) {
      console.warn('Error deleting note from supabase:', e);
    }

    const updated = notesList.filter((n) => n.id !== noteId);
    setNotesList(updated);
    localStorage.setItem('edugens_anecdotal_notes', JSON.stringify(updated));
    toast.success('Apunte eliminado del cuadernillo');
  };

  // Permiso para borrar un apunte
  const canDeleteNote = (n: any) => {
    if (!profile) return false;
    if (isManagementOrDirector) return true;
    return isMyNote(n);
  };

  const openSpecialNoteModal = (studentId: string) => {
    setSelectedSpecialNoteModalStudentId(studentId);
  };

  // Determinar número de competencias según nivel del curso (3 para Primaria/Inicial, 4 para Secundaria)
  const selectedCourseObj = availableCourses.find((c) => c.id === selectedCourseId);
  const isSecondary = (selectedCourseObj?.level || '').toLowerCase().includes('secundar');
  const competencyCount = isSecondary ? 4 : 3;

  // Lista activa de competencias para el curso seleccionado
  const activeCompetencies = useMemo(() => {
    const list = [
      { id: 'c1', label: 'Competencia 1' },
      { id: 'c2', label: 'Competencia 2' },
      { id: 'c3', label: 'Competencia 3' },
    ];
    if (isSecondary) {
      list.push({ id: 'c4', label: 'Competencia 4' });
    }
    return list;
  }, [isSecondary]);

  // Agregar nueva actividad parcial a una competencia específica (estrictamente personalizada por curso/periodo)
  const handleAddActivity = () => {
    if (!newActivityName.trim()) return;
    if (!selectedCourseId || !selectedSubjectId) {
      alert('Por favor selecciona un curso y una asignatura antes de añadir columnas.');
      return;
    }
    const compId = selectedCompetencyForNewAct || 'c1';
    const act = { id: `act_${compId}_${Date.now()}`, name: newActivityName.trim(), maxScore: 100 };

    setCompetencyActivities((prev) => {
      const updated = {
        ...prev,
        [compId]: [...(prev[compId] || []), act]
      };

      // Guardar inmediatamente en localStorage bajo el scope exclusivo de este curso/asignatura/periodo
      const centerId = profile?.center_id || center?.id;
      const year = selectedYear || '2026-2027';
      localStorage.setItem(storageScopeKey, JSON.stringify({
        scores: partialScores,
        activities: updated,
        period: selectedPeriod,
        subjectId: selectedSubjectId,
        courseId: selectedCourseId,
        teacherId: profile?.teacher_id || profile?.id,
        centerId: centerId,
        year: year,
        updatedAt: new Date().toISOString()
      }));

      return updated;
    });
    setNewActivityName('');
  };

  // Eliminar actividad parcial
  const handleDeleteActivity = (compId: string, actId: string) => {
    setCompetencyActivities((prev) => {
      const updatedActs = {
        ...prev,
        [compId]: (prev[compId] || []).filter((a) => a.id !== actId)
      };

      // Limpiar también las notas de la actividad eliminada
      setPartialScores((prevScores) => {
        const cleanedScores: Record<string, Record<string, number>> = {};
        Object.entries(prevScores).forEach(([studentId, sMap]) => {
          const studentCopy = { ...sMap };
          delete studentCopy[actId];
          cleanedScores[studentId] = studentCopy;
        });

        // Guardar inmediatamente en localStorage para este scope exclusivo
        const centerId = profile?.center_id || center?.id;
        const year = selectedYear || '2026-2027';
        localStorage.setItem(storageScopeKey, JSON.stringify({
          scores: cleanedScores,
          activities: updatedActs,
          period: selectedPeriod,
          subjectId: selectedSubjectId,
          courseId: selectedCourseId,
          teacherId: profile?.teacher_id || profile?.id,
          centerId: centerId,
          year: year,
          updatedAt: new Date().toISOString()
        }));

        return cleanedScores;
      });

      return updatedActs;
    });
  };

  // Cambiar nota parcial de alumno
  const handlePartialScoreChange = (studentId: string, activityId: string, val: number) => {
    setPartialScores((prev) => {
      const studentScores = prev[studentId] || {};
      const updatedScores = {
        ...prev,
        [studentId]: {
          ...studentScores,
          [activityId]: isNaN(val) ? 0 : Math.min(100, Math.max(0, val))
        }
      };
      localStorage.setItem(storageScopeKey, JSON.stringify({
        scores: updatedScores,
        activities: competencyActivities,
        calcMode: competencyCalcMode,
        period: selectedPeriod,
        subjectId: selectedSubjectId,
        courseId: selectedCourseId,
        teacherId: profile?.teacher_id || profile?.id,
        centerId: profile?.center_id || center?.id,
        year: selectedYear || '2026-2027',
        updatedAt: new Date().toISOString()
      }));
      return updatedScores;
    });
  };

  // Navegar verticalmente entre estudiantes al pulsar Enter, Flecha Abajo o Flecha Arriba
  const handlePartialKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, studentIdx: number, activityId: string) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        const prevIdx = studentIdx - 1;
        if (prevIdx >= 0) {
          const prevInput = document.querySelector<HTMLInputElement>(`input[data-partial-act="${activityId}"][data-student-idx="${prevIdx}"]`);
          if (prevInput) {
            prevInput.focus();
            prevInput.select();
          }
        }
        return;
      }

      e.preventDefault();
      const nextIdx = studentIdx + 1;
      const nextInput = document.querySelector<HTMLInputElement>(`input[data-partial-act="${activityId}"][data-student-idx="${nextIdx}"]`);
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = studentIdx - 1;
      if (prevIdx >= 0) {
        const prevInput = document.querySelector<HTMLInputElement>(`input[data-partial-act="${activityId}"][data-student-idx="${prevIdx}"]`);
        if (prevInput) {
          prevInput.focus();
          prevInput.select();
        }
      }
    }
  };

  // Pegar calificaciones en Calificaciones Parciales directamente desde Excel o Google Sheets (por columna o cuadrícula)
  const handlePartialPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    startStudentIdx: number,
    currentActivityId: string
  ) => {
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    const rawLines = pasteData.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
    const hasMultipleRows = rawLines.length > 1;
    const hasMultipleCols = rawLines.some((line) => line.includes('\t'));

    if (!hasMultipleRows && !hasMultipleCols) {
      return; // Dejar que el navegador pegue normalmente si es un solo valor
    }

    e.preventDefault();

    // Obtener actividades ordenadas de todas las competencias activas
    const allActivities: any[] = [];
    activeCompetencies.forEach((comp) => {
      const acts = competencyActivities[comp.id] || [];
      allActivities.push(...acts);
    });

    const startActIdx = allActivities.findIndex((a) => a.id === currentActivityId);

    setPartialScores((prev) => {
      const updatedScores = { ...prev };

      rawLines.forEach((line, rowOffset) => {
        const studentIdx = startStudentIdx + rowOffset;
        if (studentIdx >= courseStudents.length) return;
        const student = courseStudents[studentIdx];
        if (!student) return;

        const cols = line.split('\t');
        const studentActScores = { ...(updatedScores[student.id] || {}) };

        cols.forEach((colVal, colOffset) => {
          const actIdx = (startActIdx >= 0 ? startActIdx : 0) + colOffset;
          if (actIdx < allActivities.length) {
            const targetAct = allActivities[actIdx];
            const cleanVal = colVal.trim().replace(',', '.');
            const num = parseFloat(cleanVal);
            if (!isNaN(num)) {
              studentActScores[targetAct.id] = Math.max(0, Math.min(100, Math.round(num)));
            }
          }
        });

        updatedScores[student.id] = studentActScores;
      });

      // Guardar en localStorage de forma persistente
      const storageKey = `partial_scores_${selectedCourseId}_${selectedSubjectId}_${selectedPeriod}`;
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          scores: updatedScores,
          activities: competencyActivities,
          calcMode: competencyCalcMode,
          period: selectedPeriod,
          subjectId: selectedSubjectId,
          courseId: selectedCourseId,
          teacherId: profile?.teacher_id || profile?.id,
          centerId: profile?.center_id || center?.id,
          year: selectedYear || '2026-2027',
          updatedAt: new Date().toISOString()
        })
      );

      return updatedScores;
    });
  };

  // Pegar calificaciones en el modal de evaluación de tareas desde Excel
  const handleTaskGradingPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    startIdx: number,
    studentList: any[]
  ) => {
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    const rawLines = pasteData.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
    if (rawLines.length <= 1) return;

    e.preventDefault();

    setTaskGradingState((prev) => {
      const updated = { ...prev };
      const maxScore = Number(gradingMaxScore) || 100;

      rawLines.forEach((line, offset) => {
        const studentIdx = startIdx + offset;
        if (studentIdx >= studentList.length) return;
        const student = studentList[studentIdx];
        if (!student) return;

        const firstCol = line.split('\t')[0].trim().replace(',', '.');
        const numVal = parseFloat(firstCol);
        if (!isNaN(numVal)) {
          const clamped = Math.max(0, Math.min(maxScore, Math.round(numVal)));
          updated[student.id] = {
            ...(updated[student.id] || {}),
            score: clamped,
            status: 'completed'
          };
        }
      });

      return updated;
    });
  };

  // Guardar calificaciones del período y sincronizar con el Registro Digital Oficial
  const handleSavePartials = async () => {
    setIsSavingPartials(true);
    try {
      const targetCourse = availableCourses.find((c) => c.id === selectedCourseId);
      const centerId = profile?.center_id || targetCourse?.center_id || center?.id;
      const year = selectedYear || '2026-2027';

      // 1. Guardar de inmediato en localStorage (múltiples claves para evitar fallos de identidad)
      const payloadData = {
        scores: partialScores,
        activities: competencyActivities,
        calcMode: competencyCalcMode,
        period: selectedPeriod,
        subjectId: selectedSubjectId,
        courseId: selectedCourseId,
        teacherId: profile?.teacher_id || profile?.id,
        centerId: centerId,
        year: year,
        updatedAt: new Date().toISOString()
      };

      localStorage.setItem(storageScopeKey, JSON.stringify(payloadData));
      if (profile?.id && profile?.teacher_id && profile.id !== profile.teacher_id) {
        const altKey = `edugens_partials_${centerId || 'default_center'}_${year}_${profile.id}_${selectedCourseId}_${selectedSubjectId}_${selectedPeriod}`;
        localStorage.setItem(altKey, JSON.stringify(payloadData));
      }

      // 2. Preparar notas por competencia para student_grades
      const competencyGrades: any[] = [];
      courseStudents.forEach((s: any) => {
        const sScores = partialScores[s.id] || {};

        activeCompetencies.forEach((comp) => {
          const acts = competencyActivities[comp.id] || [];
          const validScores = acts
            .map((a) => sScores[a.id])
            .filter((v) => typeof v === 'number' && !isNaN(v));

          if (validScores.length > 0) {
            let compGrade: number;
            if (competencyCalcMode === 'sum') {
              compGrade = Math.min(100, Math.round(validScores.reduce((a, b) => a + b, 0)));
            } else {
              compGrade = Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length);
            }

            competencyGrades.push({
              center_id: centerId,
              student_id: s.id,
              course_id: selectedCourseId,
              subject_id: selectedSubjectId,
              period: selectedPeriod,
              competency_id: comp.id,
              grade: compGrade,
              school_year: year,
              updated_at: new Date().toISOString()
            });
          }
        });
      });

      const scoresPayload = { scores: partialScores, activities: competencyActivities, calcMode: competencyCalcMode };
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      if (isOffline) {
        // Encolar acciones offline
        await enqueueSyncAction({
          type: 'partial_activities',
          payload: {
            centerId,
            courseId: selectedCourseId,
            subjectId: selectedSubjectId,
            period: selectedPeriod,
            schoolYear: year,
            scoresData: scoresPayload,
            activityName: 'Desglose de Parciales'
          },
          centerId,
          description: `Desglose de parciales (${selectedPeriod})`
        });

        if (competencyGrades.length > 0) {
          await enqueueSyncAction({
            type: 'grades',
            payload: competencyGrades,
            centerId,
            description: `Calificaciones sincronizadas de parciales (${competencyGrades.length} registros)`
          });
        }

        toast.success('Guardado localmente (sin internet). Se sincronizará al reconectar.');
      } else if (centerId && selectedCourseId && selectedSubjectId) {
        // 3. Persistir en student_partial_activities sin depender exclusivamente de índices ON CONFLICT
        try {
          let checkQuery = supabase
            .from('student_partial_activities')
            .select('id')
            .eq('course_id', selectedCourseId)
            .eq('subject_id', selectedSubjectId)
            .eq('period', selectedPeriod)
            .eq('school_year', year);

          if (centerId) {
            checkQuery = checkQuery.eq('center_id', centerId);
          }

          const { data: existingRows, error: fetchErr } = await checkQuery;

          if (!fetchErr && existingRows && existingRows.length > 0) {
            const primaryId = existingRows[0].id;
            const { error: updateErr } = await supabase
              .from('student_partial_activities')
              .update({
                scores: scoresPayload,
                activity_name: 'Desglose de Parciales',
                updated_at: new Date().toISOString()
              })
              .eq('id', primaryId);

            if (updateErr) throw updateErr;

            if (existingRows.length > 1) {
              const dupIds = existingRows.slice(1).map((r: any) => r.id);
              await supabase.from('student_partial_activities').delete().in('id', dupIds);
            }
          } else {
            const { error: insertErr } = await supabase
              .from('student_partial_activities')
              .insert([{
                center_id: centerId,
                course_id: selectedCourseId,
                subject_id: selectedSubjectId,
                period: selectedPeriod,
                school_year: year,
                competency_id: 'all',
                activity_name: 'Desglose de Parciales',
                scores: scoresPayload,
                updated_at: new Date().toISOString()
              }]);

            if (insertErr) throw insertErr;
          }
        } catch (partialErr: any) {
          console.warn('[ClassroomManager] Error al guardar student_partial_activities en nube, encolando offline:', partialErr);
          await enqueueSyncAction({
            type: 'partial_activities',
            payload: {
              centerId,
              courseId: selectedCourseId,
              subjectId: selectedSubjectId,
              period: selectedPeriod,
              schoolYear: year,
              scoresData: scoresPayload,
              activityName: 'Desglose de Parciales'
            },
            centerId,
            description: `Desglose de parciales (${selectedPeriod})`
          });
        }

        // 4. Sincronizar calificaciones por competencia con student_grades (Registro Digital)
        if (competencyGrades.length > 0) {
          try {
            const { error: gradeErr } = await supabase
              .from('student_grades')
              .upsert(competencyGrades, {
                onConflict: 'student_id,course_id,subject_id,period,competency_id'
              });

            if (gradeErr) throw gradeErr;
          } catch (gradeSyncErr: any) {
            console.warn('[ClassroomManager] Error al sincronizar student_grades en nube, encolando offline:', gradeSyncErr);
            await enqueueSyncAction({
              type: 'grades',
              payload: competencyGrades,
              centerId,
              description: `Calificaciones sincronizadas de parciales (${competencyGrades.length} registros)`
            });
          }
        }
      }

      setSavePartialsSuccess(true);
      setTimeout(() => setSavePartialsSuccess(false), 3000);
    } catch (e: any) {
      console.error('Error al guardar parciales:', e);
      alert('Hubo un inconveniente al guardar parciales. Los datos se mantendrán seguros en este navegador.');
    } finally {
      setIsSavingPartials(false);
    }
  };

  // Métricas rápidas de asistencia de hoy
  const attendanceStats = useMemo(() => {
    let presente = 0, tardanza = 0, excusa = 0, ausente = 0;
    courseStudents.forEach((s: any) => {
      const st = attendanceState[s.id]?.status || 'presente';
      if (st === 'presente') presente++;
      if (st === 'tardanza') tardanza++;
      if (st === 'excusa') excusa++;
      if (st === 'ausente') ausente++;
    });
    return { presente, tardanza, excusa, ausente, total: courseStudents.length };
  }, [courseStudents, attendanceState]);

  // CARGA Y GESTIÓN DE TAREAS Y ENLACES DE PLATAFORMA
  const loadTasksAndLinks = async () => {
    if (!selectedCourseId) return;
    setLoadingTasks(true);
    try {
      const [tasks, links] = await Promise.all([
        dataService.getTasks(selectedCourseId),
        dataService.getPlatformLinks(selectedCourseId, selectedSubjectId || null)
      ]);
      setCourseTasks(tasks || []);
      if (links) {
        setPlatformLinks(links);
        setTempLinks(links);
      }
    } catch (err) {
      console.error('Error al cargar tareas o enlaces:', err);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (selectedCourseId) {
      loadTasksAndLinks();
    }
  }, [selectedCourseId, selectedSubjectId]);

  const parseTaskPeriod = (t: any): string => {
    if (t.period && ['P1', 'P2', 'P3', 'P4'].includes(t.period.toUpperCase())) {
      return t.period.toUpperCase();
    }
    const match = (t.description || '').match(/<!--period:(P[1-4])-->/i);
    if (match) return match[1].toUpperCase();
    return 'P1';
  };

  const parseTaskPartialLink = (t: any): { linked: boolean; competencyId: string; maxScore: number } => {
    try {
      const desc = t?.description || '';
      const match = desc.match(/<!--partial_link:({.*?})-->/);
      if (match && match[1]) {
        return JSON.parse(match[1]);
      }
    } catch (e) {}
    return { linked: false, competencyId: 'c1', maxScore: 100 };
  };

  const getCleanDescription = (desc: string = ''): string => {
    return (desc || '')
      .replace(/<!--period:P[1-4]-->\s*/gi, '')
      .replace(/<!--partial_link:\{.*?\}-->\s*/gi, '')
      .trim();
  };

  // AISLAMIENTO POR DOCENTE: solo tareas de este maestro o de materias asignadas a él
  const teacherTasks = useMemo(() => {
    if (!courseTasks || courseTasks.length === 0) return [];

    if (profile?.role === 'teacher') {
      const myTeacherId = profile.teacher_id || profile.id;
      const myCourseSubjectIds = new Set(
        (allAssignments || [])
          .filter((a: any) => 
            (a.course_id || a.courseId) === selectedCourseId &&
            (isSameTeacher(a.teacher_id || a.teacherId, myTeacherId) || 
             (a.teacher_id || a.teacherId) === myTeacherId ||
             (a.teacher_id || a.teacherId) === profile.id)
          )
          .map((a: any) => a.subject_id || a.subjectId)
      );

      return courseTasks.filter((t: any) => {
        if (t.teacher_id) {
          if (
            t.teacher_id === myTeacherId || 
            t.teacher_id === profile.id || 
            isSameTeacher(t.teacher_id, myTeacherId)
          ) {
            return true;
          }
        }
        if (t.subject_id && myCourseSubjectIds.has(t.subject_id)) {
          return true;
        }
        return false;
      });
    }

    return courseTasks;
  }, [courseTasks, profile, isSameTeacher, allAssignments, selectedCourseId]);

  // Contadores por periodo para el docente
  const taskPeriodCounts = useMemo(() => {
    const counts: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, total: teacherTasks.length };
    teacherTasks.forEach((t: any) => {
      const p = parseTaskPeriod(t);
      if (counts[p] !== undefined) counts[p]++;
    });
    return counts;
  }, [teacherTasks]);

  // Filtrado final de tareas para la vista
  const displayedTasks = useMemo(() => {
    let list = [...teacherTasks];

    if (taskFilterPeriod !== 'ALL') {
      list = list.filter((t: any) => parseTaskPeriod(t) === taskFilterPeriod);
    }

    if (taskFilterSubjectId !== 'ALL') {
      list = list.filter((t: any) => t.subject_id === taskFilterSubjectId);
    }

    if (taskFilterStatus === 'active') {
      list = list.filter((t: any) => !t.due_date || new Date(t.due_date) >= new Date());
    } else if (taskFilterStatus === 'expired') {
      list = list.filter((t: any) => t.due_date && new Date(t.due_date) < new Date());
    }

    if (taskSearchQuery.trim()) {
      const q = taskSearchQuery.toLowerCase();
      list = list.filter((t: any) => 
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    }

    return list.sort((a: any, b: any) => {
      const dateA = new Date(a.due_date || a.created_at || 0).getTime();
      const dateB = new Date(b.due_date || b.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [teacherTasks, taskFilterPeriod, taskFilterSubjectId, taskFilterStatus, taskSearchQuery]);

  const handleOpenCreateTask = () => {
    setEditingTask(null);
    setTaskFormData({
      title: '',
      description: '',
      period: selectedPeriod || 'P1',
      subject_id: selectedSubjectId || (availableSubjects[0]?.id || ''),
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      media_url: '',
      link_url: '',
      classroom_url: platformLinks.classroom_url || '',
      linkToPartial: false,
      linkedCompetencyId: 'c1',
      linkedMaxScore: 100
    });
    setShowTaskModal(true);
  };

  const handleOpenEditTask = (task: any) => {
    setEditingTask(task);
    const partialLink = parseTaskPartialLink(task);
    setTaskFormData({
      title: task.title || '',
      description: getCleanDescription(task.description || ''),
      period: parseTaskPeriod(task),
      subject_id: task.subject_id || '',
      due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '',
      media_url: task.media_url || '',
      link_url: task.link_url || '',
      classroom_url: task.classroom_url || '',
      linkToPartial: partialLink.linked,
      linkedCompetencyId: partialLink.competencyId || 'c1',
      linkedMaxScore: partialLink.maxScore || 100
    });
    setShowTaskModal(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskFormData.title.trim()) {
      alert('Por favor, indica un título para la tarea.');
      return;
    }
    if (!selectedCourseId) {
      alert('Debes seleccionar un curso para publicar la tarea.');
      return;
    }

    setIsSavingTask(true);
    try {
      const centerId = profile?.center_id || center?.id;
      const teacherId = profile?.teacher_id || profile?.id;

      let finalDescription = taskFormData.description.trim();
      if (taskFormData.linkToPartial) {
        const meta = JSON.stringify({
          linked: true,
          competencyId: taskFormData.linkedCompetencyId || 'c1',
          maxScore: Number(taskFormData.linkedMaxScore) || 100
        });
        finalDescription = `<!--partial_link:${meta}-->\n${finalDescription}`;
      }

      const payload: any = {
        center_id: centerId,
        course_id: selectedCourseId,
        subject_id: taskFormData.subject_id || null,
        title: taskFormData.title.trim(),
        description: finalDescription,
        period: taskFormData.period,
        due_date: taskFormData.due_date ? new Date(taskFormData.due_date).toISOString() : null,
        media_url: taskFormData.media_url.trim() || null,
        link_url: taskFormData.link_url.trim() || null,
        classroom_url: taskFormData.classroom_url.trim() || null
      };

      let savedTaskId = editingTask?.id;
      if (editingTask?.id) {
        await dataService.updateTask(editingTask.id, payload);
        alert('¡Tarea actualizada correctamente!');
      } else {
        const created = await dataService.addTask({
          ...payload,
          teacher_id: teacherId
        });
        savedTaskId = (created as any)?.id;
        alert('¡Tarea creada y publicada con éxito!');
      }

      // Si está vinculada a parciales, asegurar actividad en competencyActivities
      if (taskFormData.linkToPartial) {
        const compId = taskFormData.linkedCompetencyId || 'c1';
        const targetActId = `task_act_${savedTaskId || Date.now()}`;
        const updatedActivities = { ...competencyActivities };
        const compActs = updatedActivities[compId] ? [...updatedActivities[compId]] : [];
        const foundIdx = compActs.findIndex((a) => a.id === targetActId || a.name.toLowerCase() === taskFormData.title.trim().toLowerCase());
        const actData = {
          id: targetActId,
          name: taskFormData.title.trim(),
          maxScore: Number(taskFormData.linkedMaxScore) || 100
        };
        if (foundIdx >= 0) {
          compActs[foundIdx] = actData;
        } else {
          compActs.push(actData);
        }
        updatedActivities[compId] = compActs;
        setCompetencyActivities(updatedActivities);
      }

      setShowTaskModal(false);
      setEditingTask(null);
      await loadTasksAndLinks();
    } catch (err: any) {
      console.error('Error al guardar tarea:', err);
      alert(`Error al guardar la tarea: ${err.message || err}`);
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta tarea? Esta acción no se puede deshacer.')) {
      return;
    }
    try {
      await dataService.deleteTask(taskId);
      setCourseTasks((prev) => prev.filter((t) => t.id !== taskId));
      alert('Tarea eliminada correctamente.');
    } catch (err: any) {
      console.error('Error al eliminar tarea:', err);
      alert(`Error al eliminar la tarea: ${err.message || err}`);
    }
  };

  // Estadísticas de evaluación de una tarea (porcentaje de cumplimiento)
  const getTaskStats = useCallback((task: any) => {
    if (!task) return { total: 0, completed: 0, percentage: 0, average: 0, isLinked: false, competencyLabel: '', compId: 'c1', maxScore: 100 };
    const centerId = profile?.center_id || center?.id || 'default_center';
    const storageKey = `edugens_task_grades_${centerId}_${task.id}`;
    let saved: Record<string, { status: string; score?: any }> = {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) saved = JSON.parse(raw);
    } catch (e) {}

    const partialLink = parseTaskPartialLink(task);
    const isLinked = partialLink.linked;
    const compId = partialLink.competencyId || 'c1';
    const compLabel = activeCompetencies.find((c) => c.id === compId)?.label || compId.toUpperCase();

    const targetActId = `task_act_${task.id}`;
    let completed = 0;
    let totalScore = 0;
    let scoredCount = 0;

    courseStudents.forEach((s: any) => {
      const localRecord = saved[s.id];
      const partialScore = isLinked ? (partialScores[s.id]?.[targetActId] ?? partialScores[s.id]?.[task.id]) : undefined;
      const hasValidPartial = typeof partialScore === 'number' && !isNaN(partialScore);
      const isCompletedLocally = localRecord?.status === 'completed' || (localRecord?.score !== undefined && localRecord?.score !== '');

      if (hasValidPartial || isCompletedLocally) {
        completed++;
        const sVal = hasValidPartial ? partialScore : Number(localRecord?.score);
        if (!isNaN(sVal)) {
          totalScore += sVal;
          scoredCount++;
        }
      }
    });

    const total = courseStudents.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const average = scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0;

    return { total, completed, percentage, average, isLinked, competencyLabel, compId, maxScore: partialLink.maxScore || 100 };
  }, [courseStudents, partialScores, activeCompetencies, profile?.center_id, center?.id]);

  // Abrir modal de corrección y calificaciones de tarea
  const handleOpenGradeTask = (task: any) => {
    setSelectedTaskForGrading(task);
    const centerId = profile?.center_id || center?.id || 'default_center';
    const storageKey = `edugens_task_grades_${centerId}_${task.id}`;
    const partialLink = parseTaskPartialLink(task);

    setGradingIsLinkedToPartial(partialLink.linked);
    setGradingCompetencyId(partialLink.competencyId || 'c1');
    setGradingMaxScore(partialLink.maxScore || 100);

    let savedGrades: Record<string, any> = {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) savedGrades = JSON.parse(raw);
    } catch (e) {}

    const targetActId = `task_act_${task.id}`;
    const initialState: Record<string, { status: 'completed' | 'pending' | 'uncompleted'; score?: number | string; feedback?: string }> = {};

    courseStudents.forEach((s: any) => {
      const local = savedGrades[s.id];
      const pScore = partialScores[s.id]?.[targetActId] ?? partialScores[s.id]?.[task.id];
      const hasPartialScore = typeof pScore === 'number' && !isNaN(pScore);

      if (hasPartialScore) {
        initialState[s.id] = {
          status: 'completed',
          score: pScore,
          feedback: local?.feedback || ''
        };
      } else if (local) {
        initialState[s.id] = {
          status: local.status || (local.score !== undefined && local.score !== '' ? 'completed' : 'pending'),
          score: local.score !== undefined ? local.score : '',
          feedback: local.feedback || ''
        };
      } else {
        initialState[s.id] = {
          status: 'pending',
          score: '',
          feedback: ''
        };
      }
    });

    setTaskGradingState(initialState);
    setGradingSearch('');
    setGradingStatusFilter('all');
    setBulkGradeValue('');
  };

  // Guardar correcciones y notas de tarea
  const handleSaveTaskGrading = async () => {
    if (!selectedTaskForGrading) return;
    setIsSavingGrading(true);
    try {
      const centerId = profile?.center_id || center?.id || 'default_center';
      const year = selectedYear || '2026-2027';
      const storageKey = `edugens_task_grades_${centerId}_${selectedTaskForGrading.id}`;

      // 1. Guardar en almacenamiento de calificaciones de tareas
      localStorage.setItem(storageKey, JSON.stringify(taskGradingState));

      // 2. Si está vinculado a Calificaciones Parciales
      if (gradingIsLinkedToPartial) {
        const targetActId = `task_act_${selectedTaskForGrading.id}`;
        const compId = gradingCompetencyId || 'c1';

        // Asegurar que la actividad esté en competencyActivities
        const updatedActivities = { ...competencyActivities };
        const existingActs = updatedActivities[compId] ? [...updatedActivities[compId]] : [];
        const actIndex = existingActs.findIndex((a) => a.id === targetActId);

        const newActData = {
          id: targetActId,
          name: selectedTaskForGrading.title,
          maxScore: Number(gradingMaxScore) || 100
        };

        if (actIndex >= 0) {
          existingActs[actIndex] = newActData;
        } else {
          existingActs.push(newActData);
        }
        updatedActivities[compId] = existingActs;
        setCompetencyActivities(updatedActivities);

        // Actualizar partialScores con las notas ingresadas
        const updatedScores = { ...partialScores };
        courseStudents.forEach((s: any) => {
          const rec = taskGradingState[s.id];
          if (rec && rec.score !== undefined && rec.score !== '') {
            const num = Number(rec.score);
            if (!isNaN(num)) {
              if (!updatedScores[s.id]) updatedScores[s.id] = {};
              updatedScores[s.id][targetActId] = Math.min(Number(gradingMaxScore) || 100, Math.max(0, num));
            }
          }
        });
        setPartialScores(updatedScores);

        // Guardar en almacenamiento local de parciales
        const partialPeriod = parseTaskPeriod(selectedTaskForGrading) || selectedPeriod || 'P1';
        const targetSubjectId = selectedTaskForGrading.subject_id || selectedSubjectId;

        const partialPayloadData = {
          scores: updatedScores,
          activities: updatedActivities,
          calcMode: competencyCalcMode,
          period: partialPeriod,
          subjectId: targetSubjectId,
          courseId: selectedCourseId,
          teacherId: profile?.teacher_id || profile?.id,
          centerId: centerId,
          year: year,
          updatedAt: new Date().toISOString()
        };

        const targetScopeKey = `edugens_partials_${centerId}_${year}_${profile?.teacher_id || profile?.id}_${selectedCourseId}_${targetSubjectId}_${partialPeriod}`;
        localStorage.setItem(targetScopeKey, JSON.stringify(partialPayloadData));

        // Actualizar la descripción de la tarea con los metadatos de vinculación parcial
        const clean = getCleanDescription(selectedTaskForGrading.description);
        const meta = JSON.stringify({
          linked: true,
          competencyId: compId,
          maxScore: Number(gradingMaxScore) || 100
        });
        const newDesc = `<!--partial_link:${meta}-->\n${clean}`;
        await dataService.updateTask(selectedTaskForGrading.id, {
          description: newDesc,
          period: partialPeriod
        });
        await loadTasksAndLinks();

        // Si tenemos conexión, sincronizar con Supabase student_partial_activities
        if (typeof navigator !== 'undefined' && navigator.onLine && centerId && selectedCourseId && targetSubjectId) {
          try {
            await supabase.from('student_partial_activities').upsert({
              center_id: centerId,
              course_id: selectedCourseId,
              subject_id: targetSubjectId,
              period: partialPeriod,
              school_year: year,
              competency_id: compId,
              activity_name: selectedTaskForGrading.title,
              max_score: Number(gradingMaxScore) || 100,
              scores: {
                scores: updatedScores,
                activities: updatedActivities,
                calcMode: competencyCalcMode
              },
              updated_at: new Date().toISOString()
            });
          } catch (cloudErr) {
            console.warn('Error al sincronizar parciales en la nube:', cloudErr);
          }
        }
      }

      setGradingSuccess(true);
      toast.success('¡Corrección y notas guardadas correctamente!');
      setTimeout(() => {
        setGradingSuccess(false);
        setSelectedTaskForGrading(null);
      }, 1000);
    } catch (err: any) {
      console.error('Error al guardar corrección de tarea:', err);
      toast.error(`Error al guardar: ${err.message || err}`);
    } finally {
      setIsSavingGrading(false);
    }
  };

  const handleMarkAllCompleted = () => {
    setTaskGradingState((prev) => {
      const updated = { ...prev };
      courseStudents.forEach((s: any) => {
        updated[s.id] = {
          ...updated[s.id],
          status: 'completed'
        };
      });
      return updated;
    });
  };

  const handleApplyBulkGrade = () => {
    const val = Number(bulkGradeValue);
    if (isNaN(val)) return;
    const clamped = Math.min(Number(gradingMaxScore) || 100, Math.max(0, val));
    setTaskGradingState((prev) => {
      const updated = { ...prev };
      courseStudents.forEach((s: any) => {
        updated[s.id] = {
          ...updated[s.id],
          status: 'completed',
          score: clamped
        };
      });
      return updated;
    });
    setBulkGradeValue('');
  };

  const handleSavePlatformLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;
    setIsSavingLinks(true);
    try {
      const centerId = profile?.center_id || center?.id || 'default_center';
      const teacherId = profile?.teacher_id || profile?.id || 'default_teacher';
      await dataService.savePlatformLinks({
        center_id: centerId,
        course_id: selectedCourseId,
        subject_id: selectedSubjectId || null,
        teacher_id: teacherId,
        classroom_url: tempLinks.classroom_url.trim(),
        meet_url: tempLinks.meet_url.trim(),
        other_url: tempLinks.other_url.trim(),
        other_label: tempLinks.other_label.trim() || 'Plataforma Alterna'
      });
      setPlatformLinks({ ...tempLinks });
      setShowLinksModal(false);
      alert('¡Enlaces de plataforma guardados con éxito!');
    } catch (err: any) {
      console.error('Error al guardar enlaces de plataforma:', err);
      alert(`Error al guardar los enlaces: ${err.message || err}`);
    } finally {
      setIsSavingLinks(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* HEADER DE BIENVENIDA Y SELECTORES */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 md:p-8 rounded-[2.5rem] shadow-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-wrap items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-indigo-300 text-xs font-black uppercase tracking-wider">
              <UserCheck size={14} /> Mi Aula & Control Rápido
            </div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight">
              Gestión de Estudiantes por Grado
            </h1>
            <p className="text-slate-400 text-xs md:text-sm font-medium max-w-xl">
              Pasa lista, registra apuntes de conducta, toma notas parciales y consulta la ficha de tus estudiantes de forma instantánea.
            </p>
          </div>

          {/* SELECTOR DE CURSO, ASIGNATURA Y PERIODO */}
          <div className="flex flex-wrap items-center gap-3 bg-white/5 p-3 rounded-3xl border border-white/10 backdrop-blur-md">
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-1">
                Curso / Grado:
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => {
                  setSelectedCourseId(e.target.value);
                  setSelectedSubjectId('');
                }}
                className="bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-2xl border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
              >
                {availableCourses.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.level} {c.grade} "{c.section}" - {c.tanda || 'Matutina'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-1">
                Asignatura:
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-2xl border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer min-w-[150px]"
              >
                {availableSubjects.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-1">
                Período Evaluativo:
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="bg-slate-900 text-amber-300 font-black text-xs px-4 py-2.5 rounded-2xl border border-amber-400/40 outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
              >
                <option value="P1">Período 1 (P1)</option>
                <option value="P2">Período 2 (P2)</option>
                <option value="P3">Período 3 (P3)</option>
                <option value="P4">Período 4 (P4)</option>
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-1">
                Fecha Asistencia:
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-2xl border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* METRICAS RAPIDAS DE ASISTENCIA */}
        {selectedCourseId && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t border-white/10 relative z-10">
            <div className="bg-white/5 p-3 rounded-2xl border border-white/10 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Inscriptos</span>
              <span className="text-xl font-black text-white">{attendanceStats.total}</span>
            </div>
            <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 text-center">
              <span className="text-[10px] font-bold text-emerald-400 uppercase block">Presentes</span>
              <span className="text-xl font-black text-emerald-400">{attendanceStats.presente}</span>
            </div>
            <div className="bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20 text-center">
              <span className="text-[10px] font-bold text-amber-400 uppercase block">Tardanzas</span>
              <span className="text-xl font-black text-amber-400">{attendanceStats.tardanza}</span>
            </div>
            <div className="bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20 text-center">
              <span className="text-[10px] font-bold text-indigo-400 uppercase block">Excusas</span>
              <span className="text-xl font-black text-indigo-400">{attendanceStats.excusa}</span>
            </div>
            <div className="bg-rose-500/10 p-3 rounded-2xl border border-rose-500/20 text-center">
              <span className="text-[10px] font-bold text-rose-400 uppercase block">Ausentes</span>
              <span className="text-xl font-black text-rose-400">{attendanceStats.ausente}</span>
            </div>
          </div>
        )}
      </div>

      {/* PESTAÑAS DE NAVEGACION DE MI AULA */}
      <div className="flex gap-2 border-b border-border-main overflow-x-auto pb-2 text-xs font-black uppercase tracking-wider">
        {[
          { id: 'attendance', label: '1. Pasar Lista', icon: UserCheck },
          { id: 'notes', label: '2. Apuntes y Anecdotario', icon: FileText },
          { id: 'partials', label: '3. Calificaciones Parciales', icon: Award },
          { id: 'tasks', label: '4. Tareas y Asignaciones', icon: BookOpen },
          { id: 'folder', label: '5. Ficha del Estudiante', icon: Users }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl border-2 transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-brand-blue text-white border-brand-blue shadow-lg shadow-brand-blue/30 scale-[1.02]'
                : 'bg-surface text-text-muted border-border-main hover:border-brand-blue/40'
            }`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PASAR LISTA (ASISTENCIA DIARIA) */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-3xl border border-border-main shadow-md">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por alumno o RNE..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleMarkAllPresent}
                className="px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border border-emerald-500/30"
              >
                <CheckCircle2 size={16} /> Marcar Todos Presentes
              </button>

              <button
                onClick={handleSaveAttendance}
                disabled={isSavingAttendance}
                className="px-6 py-2.5 bg-brand-blue hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-brand-blue/30 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save size={16} /> {isSavingAttendance ? 'Guardando...' : 'Guardar Lista'}
              </button>
            </div>
          </div>

          {attendanceSuccess && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 p-4 rounded-2xl border border-emerald-300 font-bold text-xs flex items-center gap-2 animate-bounce">
              <CheckCircle2 size={18} /> ¡Asistencia guardada exitosamente para la fecha seleccionada!
            </div>
          )}

          {/* LISTADO DE ALUMNOS */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Estudiante</th>
                    <th className="px-4 py-2.5">Cód. SIGERD / RNE</th>
                    <th className="px-4 py-2.5 text-center">Estado de Asistencia</th>
                    <th className="px-4 py-2.5">Nota u Observación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-main text-xs">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-text-muted font-bold">
                        {studentsLoading ? 'Cargando estudiantes...' : 'No hay alumnos registrados en este curso.'}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s: any, idx: number) => {
                      const currentStatus = attendanceState[s.id]?.status || 'presente';
                      const isExcusa = currentStatus === 'excusa';
                      const isAusente = currentStatus === 'ausente';
                      const studentNote = specialNotesMap[s.id];
                      const activeExcuse = activeExcusesMap[s.id];

                      // Color dinámico para la fila si tiene excusa médica/justificación activa
                      const excuseThemeMap: Record<string, { bg: string; border: string; badge: string; text: string }> = {
                        amber: { bg: 'bg-amber-500/15 dark:bg-amber-950/40', border: 'border-l-4 border-l-amber-500', badge: 'bg-amber-500 text-white', text: 'text-amber-800 dark:text-amber-300' },
                        rose: { bg: 'bg-rose-500/15 dark:bg-rose-950/40', border: 'border-l-4 border-l-rose-500', badge: 'bg-rose-500 text-white', text: 'text-rose-800 dark:text-rose-300' },
                        indigo: { bg: 'bg-indigo-500/15 dark:bg-indigo-950/40', border: 'border-l-4 border-l-indigo-500', badge: 'bg-indigo-600 text-white', text: 'text-indigo-800 dark:text-indigo-300' },
                        emerald: { bg: 'bg-emerald-500/15 dark:bg-emerald-950/40', border: 'border-l-4 border-l-emerald-500', badge: 'bg-emerald-600 text-white', text: 'text-emerald-800 dark:text-emerald-300' },
                        purple: { bg: 'bg-purple-500/15 dark:bg-purple-950/40', border: 'border-l-4 border-l-purple-500', badge: 'bg-purple-600 text-white', text: 'text-purple-800 dark:text-purple-300' }
                      };
                      const activeExcuseTheme = activeExcuse ? (excuseThemeMap[activeExcuse.color] || excuseThemeMap.amber) : null;

                      return (
                        <tr
                          key={s.id}
                          className={`transition-colors border-b border-border-main/40 ${
                            activeExcuseTheme
                              ? `${activeExcuseTheme.bg} ${activeExcuseTheme.border} hover:opacity-90`
                              : isExcusa
                              ? 'bg-amber-500/15 dark:bg-amber-950/40 border-l-4 border-l-amber-500 hover:bg-amber-500/20'
                              : isAusente
                              ? 'bg-rose-500/5 hover:bg-surface-hover'
                              : 'hover:bg-brand-bg/60'
                          }`}
                        >
                          <td className="px-4 py-2 font-black text-text-muted text-xs">
                            {s.order_number != null && s.order_number !== '' ? s.order_number : (idx + 1)}
                          </td>
                          <td className="px-4 py-2 font-bold text-text-main text-xs">
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center gap-1.5">
                                <span>{getStudentFullName(s)}</span>
                                {studentNote && (
                                  <button
                                    type="button"
                                    onClick={() => openSpecialNoteModal(s.id)}
                                    className="text-amber-600 hover:text-amber-700 hover:scale-125 transition-transform cursor-pointer inline-flex items-center p-0.5"
                                    title={studentNote}
                                  >
                                    <Pin size={12} className="fill-amber-500 text-amber-600 rotate-45" />
                                  </button>
                                )}
                              </span>

                              {activeExcuse && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedExcuseModalData(activeExcuse)}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-black text-[9px] uppercase tracking-wider shadow-xs cursor-pointer hover:scale-105 transition-transform ${activeExcuseTheme?.badge}`}
                                    title="Haga clic para ver el comunicado y motivo completo de la excusa"
                                  >
                                    <Clock size={10} />
                                    <span>Excusa Activa ({activeExcuse.hoursRemaining}h rest.)</span>
                                  </button>
                                  <span className={`text-[10px] font-semibold truncate max-w-[220px] ${activeExcuseTheme?.text}`} title={activeExcuse.message}>
                                    • {activeExcuse.message}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 font-mono text-[10px] text-text-muted">
                            {s.sigerd_code || s.rne || s.student_code || '---'}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleSetAttendance(s.id, 'presente')}
                                className={`px-2.5 py-1 rounded-xl font-black text-[9px] uppercase transition-all cursor-pointer flex items-center gap-1 ${
                                  currentStatus === 'presente'
                                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-emerald-100 hover:text-emerald-700'
                                }`}
                              >
                                <Check size={11} /> Presente
                              </button>

                              <button
                                onClick={() => handleSetAttendance(s.id, 'tardanza')}
                                className={`px-2.5 py-1 rounded-xl font-black text-[9px] uppercase transition-all cursor-pointer flex items-center gap-1 ${
                                  currentStatus === 'tardanza'
                                    ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-amber-100 hover:text-amber-700'
                                }`}
                              >
                                <Clock size={11} /> Tardanza
                              </button>

                              <button
                                onClick={() => handleSetAttendance(s.id, 'excusa')}
                                className={`px-2.5 py-1 rounded-xl font-black text-[9px] uppercase transition-all cursor-pointer flex items-center gap-1 ${
                                  currentStatus === 'excusa'
                                    ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                                    : activeExcuse
                                    ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 ring-2 ring-amber-400/50'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-amber-100 hover:text-amber-700'
                                }`}
                              >
                                <Info size={11} /> Excusa
                              </button>

                              <button
                                onClick={() => handleSetAttendance(s.id, 'ausente')}
                                className={`px-2.5 py-1 rounded-xl font-black text-[9px] uppercase transition-all cursor-pointer flex items-center gap-1 ${
                                  currentStatus === 'ausente'
                                    ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/30'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-rose-100 hover:text-rose-700'
                                }`}
                              >
                                <XCircle size={11} /> Ausente
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              placeholder={
                                activeExcuse
                                  ? `Excusa vigente: ${activeExcuse.message.slice(0, 40)}...`
                                  : isExcusa
                                  ? 'Motivo directo de la excusa (médico, permiso)...'
                                  : 'Ej. Llegó a 2da hora...'
                              }
                              value={attendanceState[s.id]?.note || ''}
                              onChange={(e) =>
                                setAttendanceState((prev) => ({
                                  ...prev,
                                  [s.id]: {
                                    status: prev[s.id]?.status || (activeExcuse ? 'excusa' : 'presente'),
                                    note: e.target.value
                                  }
                                }))
                              }
                              className={`w-full px-3 py-1.5 rounded-xl border text-xs outline-none transition-all ${
                                activeExcuse
                                  ? 'border-amber-400 bg-amber-50/90 dark:bg-amber-950/70 text-amber-950 dark:text-amber-100 placeholder:text-amber-700/70 ring-1 ring-amber-400/50 font-medium'
                                  : isExcusa
                                  ? 'border-amber-400 bg-amber-50/80 dark:bg-amber-950/60 text-amber-950 dark:text-amber-100 placeholder:text-amber-600/70 ring-1 ring-amber-400/40 font-medium'
                                  : 'border-border-main bg-brand-bg text-text-main focus:ring-1 focus:ring-brand-blue'
                              }`}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: APUNTES Y ANECDOTARIO */}
      {activeTab === 'notes' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* FORMULARIO AGREGAR APUNTE */}
          <div className="bg-surface p-6 rounded-3xl border border-border-main shadow-xl space-y-4">
            <h2 className="text-base font-black uppercase tracking-wider text-text-main flex items-center gap-2">
              <Plus size={18} className="text-brand-blue" /> Registrar Nuevo Apunte
            </h2>

            <div>
              <label className="block text-[10px] font-black uppercase text-text-muted mb-1">
                Seleccionar Estudiante:
              </label>
              <select
                value={newNoteStudentId}
                onChange={(e) => setNewNoteStudentId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-border-main bg-brand-bg text-xs font-bold outline-none focus:ring-2 focus:ring-brand-blue"
              >
                <option value="">-- Elige un Alumno --</option>
                {courseStudents.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {getStudentFullName(s)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-text-muted mb-1">
                Categoría:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['Conducta', 'Académico', 'Padres', 'Salud'] as NoteCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setNewNoteCategory(cat)}
                    className={`py-2 rounded-xl text-[10px] font-black uppercase border transition-all cursor-pointer ${
                      newNoteCategory === cat
                        ? 'bg-brand-blue text-white border-brand-blue'
                        : 'bg-brand-bg text-text-muted border-border-main hover:border-brand-blue'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-text-muted mb-1">
                Observación / Apunte:
              </label>
              <textarea
                rows={4}
                placeholder="Escribe los detalles del acontecimiento o seguimiento del alumno..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                className="w-full p-4 rounded-2xl border border-border-main bg-brand-bg text-xs font-medium outline-none focus:ring-2 focus:ring-brand-blue"
              />
            </div>

            <button
              onClick={handleAddNote}
              className="w-full py-3 bg-brand-blue hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-blue/30 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Save size={16} /> Guardar Apunte en Expediente
            </button>
          </div>

          {/* LISTADO DE APUNTES HISTORICOS */}
          <div className="md:col-span-2 bg-surface p-6 rounded-3xl border border-border-main shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-main">
              <h2 className="text-base font-black uppercase tracking-wider text-text-main flex items-center gap-2">
                <FileText size={18} className="text-brand-blue" />
                {isManagementOrDirector ? 'Historial de Apuntes del Grado' : 'Mis Apuntes en este Grado'}
              </h2>

              {isManagementOrDirector ? (
                <div className="flex items-center gap-1.5 bg-brand-bg p-1 rounded-xl border border-border-main text-xs">
                  <button
                    type="button"
                    onClick={() => setNotesTeacherFilter('ALL')}
                    className={`px-3 py-1 rounded-lg font-black uppercase text-[10px] tracking-wider transition-all cursor-pointer ${
                      notesTeacherFilter === 'ALL'
                        ? 'bg-brand-blue text-white shadow-sm'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    Todos ({notesList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotesTeacherFilter('MINE')}
                    className={`px-3 py-1 rounded-lg font-black uppercase text-[10px] tracking-wider transition-all cursor-pointer ${
                      notesTeacherFilter === 'MINE'
                        ? 'bg-brand-blue text-white shadow-sm'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    Mis Apuntes ({notesList.filter(isMyNote).length})
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-brand-bg px-3 py-1.5 rounded-xl border border-border-main text-[11px] font-bold text-text-muted">
                  <span>🔒 Solo tus apuntes ({notesList.filter(isMyNote).length})</span>
                </div>
              )}
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {(() => {
                const displayed = notesList.filter((n) => {
                  if (!isManagementOrDirector) {
                    return isMyNote(n);
                  }
                  if (notesTeacherFilter === 'MINE') {
                    return isMyNote(n);
                  }
                  return true;
                });

                if (displayed.length === 0) {
                  return (
                    <div className="py-12 text-center text-text-muted font-bold text-xs space-y-1">
                      <p>
                        {!isManagementOrDirector || notesTeacherFilter === 'MINE'
                          ? 'No has registrado ningún apunte personal en este grado todavía.'
                          : 'No hay observaciones ni apuntes registrados todavía.'}
                      </p>
                      {!isManagementOrDirector && (
                        <p className="text-[10px] text-text-muted/80 font-normal">
                          Por confidencialidad y objetividad docente, los apuntes de otros profesores están reservados exclusivamente al Equipo de Gestión y Dirección.
                        </p>
                      )}
                    </div>
                  );
                }

                return displayed.map((n) => {
                  const studentObj = courseStudents.find((s: any) => s.id === n.studentId);
                  return (
                    <div key={n.id} className="p-4 rounded-2xl border border-border-main bg-brand-bg/50 space-y-2 relative group hover:border-brand-blue/30 transition-all">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-sm text-brand-blue">
                          {getStudentFullName(studentObj)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-black text-[9px] uppercase tracking-wider rounded-lg">
                            {n.category}
                          </span>
                          <span className="text-[10px] font-bold text-text-muted">{n.date}</span>
                          {canDeleteNote(n) && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteNote(n.id, e)}
                              className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all cursor-pointer"
                              title="Eliminar apunte del cuadernillo"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-text-main font-medium leading-relaxed">{n.content}</p>
                      <div className="text-[9px] font-bold text-text-muted text-right">
                        Registrado por: {n.teacherName}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CALIFICACIONES PARCIALES POR COMPETENCIAS */}
      {activeTab === 'partials' && (
        <div className="space-y-6">
          {/* BARRA DE CREACION DE COLUMNA Y METADATOS */}
          <div className="bg-surface p-5 rounded-3xl border border-border-main shadow-md flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-black uppercase text-text-muted">Añadir evaluacion a:</span>
              <select
                value={selectedCompetencyForNewAct}
                onChange={(e) => setSelectedCompetencyForNewAct(e.target.value)}
                className="px-3 py-2 rounded-2xl border border-border-main bg-brand-bg text-xs font-bold text-brand-blue outline-none focus:ring-2 focus:ring-brand-blue cursor-pointer"
              >
                {activeCompetencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Nombre de la actividad (Ej. Quiz 1)..."
                value={newActivityName}
                onChange={(e) => setNewActivityName(e.target.value)}
                className="px-4 py-2 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 min-w-[220px]"
              />
              <button
                onClick={handleAddActivity}
                className="px-4 py-2 bg-brand-blue hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-brand-blue/20"
              >
                <Plus size={14} /> Añadir Columna
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* COTEJO / SELECTOR DE MODO DE CÁLCULO DE COMPETENCIAS */}
              <div className="flex items-center gap-1.5 p-1 bg-brand-bg rounded-2xl border border-border-main shadow-xs">
                <button
                  type="button"
                  onClick={() => {
                    setCompetencyCalcMode('average');
                    localStorage.setItem(storageScopeKey, JSON.stringify({
                      scores: partialScores,
                      activities: competencyActivities,
                      calcMode: 'average',
                      period: selectedPeriod,
                      subjectId: selectedSubjectId,
                      courseId: selectedCourseId,
                      teacherId: profile?.teacher_id || profile?.id,
                      centerId: profile?.center_id || center?.id,
                      year: selectedYear || '2026-2027',
                      updatedAt: new Date().toISOString()
                    }));
                  }}
                  className={`px-3 py-1.5 rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    competencyCalcMode === 'average'
                      ? 'bg-brand-blue text-white shadow-sm shadow-brand-blue/30'
                      : 'text-text-muted hover:text-text-main hover:bg-surface'
                  }`}
                  title="Calcula el promedio aritmético de las actividades en base a 100"
                >
                  <Award size={13} />
                  <span>Promediado (Base 100)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCompetencyCalcMode('sum');
                    localStorage.setItem(storageScopeKey, JSON.stringify({
                      scores: partialScores,
                      activities: competencyActivities,
                      calcMode: 'sum',
                      period: selectedPeriod,
                      subjectId: selectedSubjectId,
                      courseId: selectedCourseId,
                      teacherId: profile?.teacher_id || profile?.id,
                      centerId: profile?.center_id || center?.id,
                      year: selectedYear || '2026-2027',
                      updatedAt: new Date().toISOString()
                    }));
                  }}
                  className={`px-3 py-1.5 rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    competencyCalcMode === 'sum'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                      : 'text-text-muted hover:text-text-main hover:bg-surface'
                  }`}
                  title="Suma las puntuaciones parciales de las actividades acumulando hasta 100 puntos"
                >
                  <Plus size={13} />
                  <span>Sumativo (Hasta 100 pts)</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setHideStudentNames((prev) => !prev)}
                className={`px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border shadow-sm ${
                  hideStudentNames
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-500/20'
                    : 'bg-brand-bg hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main border-border-main'
                }`}
                title={hideStudentNames ? 'Mostrar nombres completos de estudiantes' : 'Ocultar nombres para ver más columnas de notas'}
              >
                {hideStudentNames ? <Eye size={15} /> : <EyeOff size={15} />}
                <span>{hideStudentNames ? 'Mostrar Nombres' : 'Ocultar Nombres'}</span>
              </button>

              {savePartialsSuccess && (
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-bounce">
                  <CheckCircle2 size={16} /> ¡Calificaciones del {selectedPeriod} Guardadas!
                </span>
              )}
              <button
                onClick={handleSavePartials}
                disabled={isSavingPartials}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save size={16} /> {isSavingPartials ? 'Guardando...' : `Guardar Parciales (${selectedPeriod})`}
              </button>
            </div>
          </div>

          {/* TABLA MULTI-COMPETENCIAS */}
          <div className="bg-surface rounded-3xl border border-border-main shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  {/* FILA SUPERIOR: TITULOS DE COMPETENCIA */}
                  <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider divide-x divide-slate-800">
                    <th
                      rowSpan={2}
                      className={`py-2 sticky left-0 bg-slate-900 z-20 transition-all ${
                        hideStudentNames ? 'px-2 w-16 text-center' : 'px-4 min-w-[200px]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{hideStudentNames ? 'No.' : 'Estudiante'}</span>
                        <button
                          type="button"
                          onClick={() => setHideStudentNames((prev) => !prev)}
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title={hideStudentNames ? 'Desplegar nombres completos' : 'Ocultar nombres para maximizar columnas'}
                        >
                          {hideStudentNames ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
                        </button>
                      </div>
                    </th>
                    {activeCompetencies.map((comp, idx) => {
                      const acts = competencyActivities[comp.id] || [];
                      const colSpan = Math.max(1, acts.length) + 1; // columnas de actividades + col de promedio/suma de comp
                      const colors = [
                        'from-blue-600 to-indigo-700',
                        'from-purple-600 to-indigo-800',
                        'from-emerald-600 to-teal-700',
                        'from-amber-600 to-orange-700'
                      ];
                      return (
                        <th
                          key={comp.id}
                          colSpan={colSpan}
                          className={`text-center py-2 px-2 bg-gradient-to-r ${colors[idx % colors.length]}`}
                        >
                          {comp.label}
                        </th>
                      );
                    })}
                    <th rowSpan={2} className="px-4 py-2 text-center bg-indigo-950 text-indigo-200 font-black min-w-[100px]">
                      Nota Final Parcial
                    </th>
                  </tr>

                  {/* FILA INFERIOR: COLUMNAS DE ACTIVIDADES */}
                  <tr className="bg-slate-100 dark:bg-slate-900/80 border-b border-border-main text-[10px] font-black text-text-muted uppercase tracking-widest divide-x divide-border-main">
                    {activeCompetencies.map((comp) => {
                      const acts = competencyActivities[comp.id] || [];
                      return (
                        <React.Fragment key={`subhead_${comp.id}`}>
                          {acts.length === 0 ? (
                            <th className="px-2 py-1.5 text-center text-slate-400 italic font-normal text-[10px]">
                              Sin columnas
                            </th>
                          ) : (
                            acts.map((act) => (
                              <th key={act.id} className="px-2 py-1.5 text-center min-w-[90px] relative group text-[10px]">
                                <div className="flex items-center justify-center gap-1">
                                  <span className="truncate max-w-[80px]">{act.name}</span>
                                  <button
                                    onClick={() => handleDeleteActivity(comp.id, act.id)}
                                    className="text-rose-400 hover:text-rose-600 ml-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    title="Eliminar columna"
                                  >
                                    ×
                                  </button>
                                </div>
                              </th>
                            ))
                          )}
                          <th className="px-2 py-1.5 text-center bg-indigo-50 dark:bg-indigo-950/40 text-brand-blue font-black min-w-[65px] text-[10px]">
                            {competencyCalcMode === 'sum' ? `Total ${comp.id.toUpperCase()}` : `Prom. ${comp.id.toUpperCase()}`}
                          </th>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-border-main text-xs">
                  {courseStudents.length === 0 ? (
                    <tr>
                      <td colSpan={20} className="py-8 text-center text-text-muted font-bold">
                        No hay alumnos inscriptos en este curso.
                      </td>
                    </tr>
                  ) : (
                    courseStudents.map((s: any, idx: number) => {
                      const studentScores = partialScores[s.id] || {};
                      
                      // Calcular resultados por competencia según modo seleccionado (Promediado vs Sumativo)
                      const compCalculatedValues: number[] = [];

                      activeCompetencies.forEach((comp) => {
                        const acts = competencyActivities[comp.id] || [];
                        const validScores = acts
                          .map((a) => studentScores[a.id])
                          .filter((v) => typeof v === 'number' && !isNaN(v));

                        if (validScores.length > 0) {
                          if (competencyCalcMode === 'sum') {
                            const sumVal = Math.min(100, validScores.reduce((a, b) => a + b, 0));
                            compCalculatedValues.push(sumVal);
                          } else {
                            const avgVal = Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length);
                            compCalculatedValues.push(avgVal);
                          }
                        } else {
                          compCalculatedValues.push(0);
                        }
                      });

                      // Calificación final del período (promedio de las competencias)
                      const finalAvg = compCalculatedValues.length > 0
                        ? Math.round(compCalculatedValues.reduce((a, b) => a + b, 0) / compCalculatedValues.length)
                        : 0;

                      return (
                        <tr key={s.id} className="hover:bg-brand-bg/60 transition-colors divide-x divide-border-main">
                          <td
                            className={`py-1.5 font-bold text-text-main sticky left-0 bg-surface z-10 shadow-sm transition-all ${
                              hideStudentNames ? 'px-2 text-center w-16' : 'px-4 min-w-[200px]'
                            }`}
                            title={getStudentFullName(s)}
                          >
                            {hideStudentNames ? (
                              <div className="flex items-center justify-center">
                                <span className="inline-flex items-center justify-center min-w-[26px] h-6 px-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-brand-blue font-black font-mono text-[11px] border border-indigo-100 dark:border-indigo-900">
                                  #{s.order_number || s.number || idx + 1}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-text-muted font-mono w-5 shrink-0">
                                  #{s.order_number || s.number || idx + 1}
                                </span>
                                <span className="truncate text-xs">{getStudentFullName(s)}</span>
                              </div>
                            )}
                          </td>

                          {activeCompetencies.map((comp, compIdx) => {
                            const acts = competencyActivities[comp.id] || [];
                            const compScore = compCalculatedValues[compIdx];

                            return (
                              <React.Fragment key={`cell_group_${comp.id}_${s.id}`}>
                                {acts.length === 0 ? (
                                  <td className="px-2 py-1 text-center text-slate-400 italic text-[11px]">--</td>
                                ) : (
                                  acts.map((act) => (
                                    <td key={act.id} className="px-2 py-1 text-center">
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        data-partial-act={act.id}
                                        data-student-idx={idx}
                                        value={studentScores[act.id] ?? ''}
                                        onChange={(e) => handlePartialScoreChange(s.id, act.id, Number(e.target.value))}
                                        onKeyDown={(e) => handlePartialKeyDown(e, idx, act.id)}
                                        onPaste={(e) => handlePartialPaste(e, idx, act.id)}
                                        onFocus={(e) => e.target.select()}
                                        className="w-12 text-center py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-black text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50 dark:focus:bg-indigo-950 transition-colors shadow-xs"
                                      />
                                    </td>
                                  ))
                                )}
                                <td className="px-2 py-1 text-center font-black bg-indigo-50/50 dark:bg-indigo-950/20 text-brand-blue text-xs">
                                  {compScore}
                                </td>
                              </React.Fragment>
                            );
                          })}

                          <td className="px-3 py-1 text-center font-black text-xs bg-slate-50 dark:bg-slate-900/40">
                            <span className={`px-2.5 py-0.5 rounded-lg shadow-sm font-mono font-bold ${finalAvg >= 70 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                              {finalAvg}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TAREAS Y ASIGNACIONES */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          {/* HEADER DEL MODULO Y ENLACES FIJOS DE PLATAFORMA */}
          <div className="bg-surface p-6 md:p-8 rounded-[2.5rem] border border-border-main shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider mb-2">
                  <BookOpen size={13} /> Historial y Publicaciones
                </div>
                <h2 className="text-xl md:text-2xl font-black text-text-main tracking-tight uppercase">
                  Tareas y Asignaciones
                </h2>
                <p className="text-xs md:text-sm text-text-muted font-medium">
                  Publica tareas para tu grado, administra el historial por períodos y configura los enlaces de acceso virtual permanente.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTempLinks({ ...platformLinks });
                    setShowLinksModal(true);
                  }}
                  className="px-4 py-3 bg-surface hover:bg-slate-100 dark:hover:bg-slate-800 border border-border-main rounded-2xl text-xs font-black uppercase tracking-wider text-text-main flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Settings size={16} className="text-indigo-600" />
                  Configurar Enlaces Fijos
                </button>
                <button
                  type="button"
                  onClick={handleOpenCreateTask}
                  className="px-5 py-3 bg-brand-blue hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-brand-blue/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Plus size={16} />
                  Nueva Tarea
                </button>
              </div>
            </div>

            {/* BANNER DE ACCESOS Y ENLACES FIJOS */}
            <div className="bg-gradient-to-r from-indigo-50/70 via-slate-50 to-blue-50/70 dark:from-slate-900/60 dark:via-slate-800/40 dark:to-slate-900/60 p-5 rounded-3xl border border-indigo-100/60 dark:border-white/5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-900 dark:text-indigo-300">
                  <Globe size={15} className="text-indigo-600" />
                  <span>Enlaces Fijos {currentSubjectObj ? `• ${currentSubjectObj.name}` : 'del Curso'}</span>
                  {currentSubjectObj && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] normal-case font-bold tracking-normal">
                      Exclusivos para esta materia
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-text-muted font-bold">
                  {currentSubjectObj 
                    ? `Visibles al alumno cuando entra a ${currentSubjectObj.name}`
                    : 'Visibles con 1 clic en el portal del alumno'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* Google Classroom */}
                <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                      <GraduationCap size={20} />
                    </div>
                    <div className="truncate min-w-0">
                      <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Google Classroom</p>
                      <p className="text-xs font-bold truncate">
                        {platformLinks.classroom_url ? (
                          <span className="text-emerald-600 dark:text-emerald-400">Enlace activo</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">No configurado</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {platformLinks.classroom_url ? (
                    <a
                      href={platformLinks.classroom_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-300 rounded-xl transition-colors shrink-0"
                      title="Abrir Classroom"
                    >
                      <ExternalLink size={14} />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setTempLinks({ ...platformLinks });
                        setShowLinksModal(true);
                      }}
                      className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800 shrink-0 cursor-pointer transition-colors"
                    >
                      + Configurar
                    </button>
                  )}
                </div>

                {/* Google Meet / Videollamada */}
                <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                      <Video size={20} />
                    </div>
                    <div className="truncate min-w-0">
                      <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Videollamada / Meet</p>
                      <p className="text-xs font-bold truncate">
                        {platformLinks.meet_url ? (
                          <span className="text-emerald-600 dark:text-emerald-400">Enlace activo</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">No configurado</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {platformLinks.meet_url ? (
                    <a
                      href={platformLinks.meet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-emerald-600 dark:text-emerald-300 rounded-xl transition-colors shrink-0"
                      title="Abrir Videollamada"
                    >
                      <ExternalLink size={14} />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setTempLinks({ ...platformLinks });
                        setShowLinksModal(true);
                      }}
                      className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800 shrink-0 cursor-pointer transition-colors"
                    >
                      + Configurar
                    </button>
                  )}
                </div>

                {/* Plataforma Alterna / Drive */}
                <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 border border-violet-500/20">
                      <Globe size={20} />
                    </div>
                    <div className="truncate min-w-0">
                      <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                        {platformLinks.other_label || 'Plataforma Alterna'}
                      </p>
                      <p className="text-xs font-bold truncate">
                        {platformLinks.other_url ? (
                          <span className="text-emerald-600 dark:text-emerald-400">Enlace activo</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">No configurado</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {platformLinks.other_url ? (
                    <a
                      href={platformLinks.other_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/60 dark:hover:bg-violet-900/80 text-violet-600 dark:text-violet-300 rounded-xl transition-colors shrink-0"
                      title="Abrir Plataforma Alterna"
                    >
                      <ExternalLink size={14} />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setTempLinks({ ...platformLinks });
                        setShowLinksModal(true);
                      }}
                      className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800 shrink-0 cursor-pointer transition-colors"
                    >
                      + Configurar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* BARRA DE FILTROS */}
          <div className="bg-surface p-4 rounded-3xl border border-border-main shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Filtro por Periodo */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-border-main overflow-x-auto text-[11px] font-black uppercase">
                {[
                  { id: 'ALL', label: `Todos (${taskPeriodCounts.total})` },
                  { id: 'P1', label: `P1 (${taskPeriodCounts.P1})` },
                  { id: 'P2', label: `P2 (${taskPeriodCounts.P2})` },
                  { id: 'P3', label: `P3 (${taskPeriodCounts.P3})` },
                  { id: 'P4', label: `P4 (${taskPeriodCounts.P4})` }
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setTaskFilterPeriod(p.id)}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                      taskFilterPeriod === p.id
                        ? 'bg-brand-blue text-white shadow-md'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Filtro por Estado */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-border-main text-[11px] font-black uppercase">
                {[
                  { id: 'ALL', label: 'Todas' },
                  { id: 'active', label: 'Pendientes' },
                  { id: 'expired', label: 'Vencidas' }
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setTaskFilterStatus(st.id as any)}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      taskFilterStatus === st.id
                        ? 'bg-white dark:bg-slate-700 text-text-main shadow-sm'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-border-main/50">
              {/* Filtro por Materia */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Materia:</span>
                <select
                  value={taskFilterSubjectId}
                  onChange={(e) => setTaskFilterSubjectId(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="ALL">TODAS MIS ASIGNATURAS</option>
                  {availableSubjects.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Buscador de tareas */}
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Buscar tarea por título o descripción..."
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* LISTA / HISTORIAL DE TAREAS */}
          {loadingTasks ? (
            <div className="py-20 text-center bg-surface rounded-3xl border border-border-main">
              <div className="w-8 h-8 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-black uppercase tracking-widest text-text-muted">
                Cargando historial de tareas...
              </p>
            </div>
          ) : displayedTasks.length === 0 ? (
            <div className="py-16 text-center bg-surface rounded-[2.5rem] border-2 border-dashed border-border-main p-6 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-slate-800 text-indigo-600 mx-auto flex items-center justify-center">
                <ClipboardList size={30} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-text-main uppercase tracking-tight">
                  No hay tareas registradas
                </h3>
                <p className="text-xs text-text-muted max-w-md mx-auto">
                  {taskSearchQuery || taskFilterPeriod !== 'ALL' || taskFilterSubjectId !== 'ALL'
                    ? 'No se encontraron tareas con los filtros aplicados. Prueba restablecer los filtros.'
                    : 'Aún no has publicado tareas para este grado. Las tareas creadas aquí son exclusivas para tus materias.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreateTask}
                className="px-5 py-2.5 bg-brand-blue hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <Plus size={15} /> Publicar Primera Tarea
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedTasks.map((t: any) => {
                const subject = (allSubjects || []).find((s: any) => s.id === t.subject_id);
                const period = parseTaskPeriod(t);
                const isLate = t.due_date && new Date(t.due_date) < new Date();
                const cleanDesc = getCleanDescription(t.description);

                return (
                  <div
                    key={t.id}
                    className="bg-surface p-6 rounded-3xl border border-border-main shadow-md hover:shadow-xl transition-all space-y-4 flex flex-col justify-between group"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 rounded-lg text-[9px] font-black uppercase tracking-wider">
                            {subject?.name || 'General'}
                          </span>
                          <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900 rounded-lg text-[9px] font-black uppercase tracking-wider font-mono">
                            {period}
                          </span>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${
                            isLate
                              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-100 dark:border-rose-900'
                              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900'
                          }`}
                        >
                          <Clock size={11} />
                          {isLate ? 'Vencida' : 'Activa'}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-text-main group-hover:text-brand-blue transition-colors">
                        {t.title}
                      </h3>

                      {cleanDesc && (
                        <LinkifiedText
                          text={cleanDesc}
                          className="text-xs text-text-muted"
                          clampLines={3}
                        />
                      )}

                      {/* Enlaces y Recursos Adjuntos */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {t.media_url && (
                          <a
                            href={t.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-indigo-50 flex items-center gap-1 transition-colors"
                          >
                            <Video size={11} /> Recurso Multimedia
                          </a>
                        )}
                        {t.link_url && (
                          <a
                            href={t.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-indigo-50 flex items-center gap-1 transition-colors"
                          >
                            <LinkIcon size={11} /> Documento / Drive
                          </a>
                        )}
                        {t.classroom_url && (
                          <a
                            href={t.classroom_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-emerald-100 flex items-center gap-1 transition-colors"
                          >
                            <GraduationCap size={11} /> Google Classroom
                          </a>
                        )}
                      </div>

                      {/* Estadísticas de Cumplimiento / Alumnos que hicieron la tarea */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-border-main/60 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <div className="flex items-center gap-1.5 text-text-main">
                            <CheckCircle2 size={14} className={getTaskStats(t).completed > 0 ? "text-emerald-500" : "text-slate-400"} />
                            <span className="text-[11px] font-black uppercase tracking-tight">
                              Cumplimiento: <span className="text-brand-blue">{getTaskStats(t).completed}</span> de {getTaskStats(t).total} alumnos
                            </span>
                          </div>
                          <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                            getTaskStats(t).percentage === 100 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                              : getTaskStats(t).percentage > 0 
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' 
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                          }`}>
                            {getTaskStats(t).percentage}%
                          </span>
                        </div>

                        {/* Barra de progreso */}
                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              getTaskStats(t).percentage === 100
                                ? 'bg-emerald-500'
                                : getTaskStats(t).percentage >= 50
                                ? 'bg-brand-blue'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${getTaskStats(t).percentage}%` }}
                          />
                        </div>

                        {getTaskStats(t).isLinked && (
                          <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-indigo-500 pt-0.5">
                            <Award size={11} /> Vinculada a Parciales ({getTaskStats(t).competencyLabel})
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border-main/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="text-[10px] text-text-muted font-bold flex items-center gap-1.5">
                        <Calendar size={13} />
                        <span>Límite:</span>
                        <span className={isLate ? 'text-rose-500 font-black' : 'text-text-main font-black'}>
                          {t.due_date ? new Date(t.due_date).toLocaleDateString() : 'Sin fecha límite'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenGradeTask(t)}
                          className="px-3.5 py-1.5 bg-brand-blue hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer hover:scale-105 active:scale-95"
                          title="Corregir y calificar alumnos en esta tarea"
                        >
                          <Award size={12} /> Corregir ({getTaskStats(t).percentage}%)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditTask(t)}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Edit3 size={12} /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(t.id)}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-500 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Trash2 size={12} /> Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MODAL PARA CONFIGURAR ENLACES FIJOS */}
          {showLinksModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 p-6 text-white flex items-center justify-between border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center">
                      <Settings size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-base uppercase tracking-tight text-white">
                        Enlaces Fijos {currentSubjectObj ? `• ${currentSubjectObj.name}` : 'de Clase'}
                      </h3>
                      <p className="text-xs text-indigo-200">
                        {currentSubjectObj 
                          ? `Exclusivos para ${currentSubjectObj.name} en este curso (se muestran al alumno en su materia)` 
                          : 'Visibles para alumnos y padres en su portal de Mi Aula'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLinksModal(false)}
                    className="text-white/70 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSavePlatformLinks} className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Google Classroom {currentSubjectObj ? `(${currentSubjectObj.name})` : '(Link de clase)'}
                    </label>
                    <input
                      type="url"
                      placeholder="https://classroom.google.com/c/..."
                      value={tempLinks.classroom_url}
                      onChange={(e) => setTempLinks({ ...tempLinks, classroom_url: e.target.value })}
                      className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all shadow-inner"
                    />
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Pega aquí el enlace de la clase o invitación de Classroom para esta materia.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Google Meet / Videollamada {currentSubjectObj ? `(${currentSubjectObj.name})` : ''}
                    </label>
                    <input
                      type="url"
                      placeholder="https://meet.google.com/..."
                      value={tempLinks.meet_url}
                      onChange={(e) => setTempLinks({ ...tempLinks, meet_url: e.target.value })}
                      className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all shadow-inner"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Plataforma Alterna o Carpeta Drive (URL)
                    </label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/drive/folders/..."
                      value={tempLinks.other_url}
                      onChange={(e) => setTempLinks({ ...tempLinks, other_url: e.target.value })}
                      className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all shadow-inner"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Nombre o Etiqueta de la Plataforma Alterna
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Carpeta de Recursos en Drive / Padlet / Moodle"
                      value={tempLinks.other_label}
                      onChange={(e) => setTempLinks({ ...tempLinks, other_label: e.target.value })}
                      className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all shadow-inner"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowLinksModal(false)}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-black uppercase tracking-wider text-xs cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingLinks}
                      className="px-6 py-2.5 bg-brand-blue hover:bg-indigo-700 text-white rounded-xl font-black uppercase tracking-wider text-xs flex items-center gap-2 shadow-lg shadow-brand-blue/30 disabled:opacity-50 cursor-pointer transition-all active:scale-95"
                    >
                      {isSavingLinks ? 'Guardando...' : `Guardar Enlaces ${currentSubjectObj ? `(${currentSubjectObj.name})` : ''}`}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL PARA CREAR O EDITAR TAREA */}
          {showTaskModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
              <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
                <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-900 p-6 text-white flex items-center justify-between border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                      <BookOpen size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-lg uppercase tracking-tight text-white">
                        {editingTask ? 'Editar Tarea' : 'Nueva Tarea / Asignación'}
                      </h3>
                      <p className="text-xs text-indigo-100">
                        {editingTask ? 'Modifica los detalles de la asignación' : 'Publica una tarea para este grado'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTaskModal(false);
                      setEditingTask(null);
                    }}
                    className="text-white/70 hover:text-white p-1 rounded-xl hover:bg-white/10 cursor-pointer"
                  >
                    <X size={22} />
                  </button>
                </div>

                <form onSubmit={handleSaveTask} className="p-6 md:p-8 space-y-6">
                  {/* Título */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Título de la Asignación *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Informe de Lectura - Capítulo 3"
                      value={taskFormData.title}
                      onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                      className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
                      required
                    />
                  </div>

                  {/* Periodo, Asignatura y Fecha de Entrega */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Período Escolar *
                      </label>
                      <select
                        value={taskFormData.period}
                        onChange={(e) => setTaskFormData({ ...taskFormData, period: e.target.value })}
                        className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                        required
                      >
                        <option value="P1">Período 1 (P1)</option>
                        <option value="P2">Período 2 (P2)</option>
                        <option value="P3">Período 3 (P3)</option>
                        <option value="P4">Período 4 (P4)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Materia Asociada
                      </label>
                      <select
                        value={taskFormData.subject_id}
                        onChange={(e) => setTaskFormData({ ...taskFormData, subject_id: e.target.value })}
                        className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                      >
                        <option value="">GENERAL / TODAS</option>
                        {availableSubjects.map((s: any) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Fecha y Hora Límite
                      </label>
                      <input
                        type="datetime-local"
                        value={taskFormData.due_date}
                        onChange={(e) => setTaskFormData({ ...taskFormData, due_date: e.target.value })}
                        className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                      />
                    </div>
                  </div>

                  {/* Instrucciones / Descripción */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Instrucciones y Criterios de Evaluación
                    </label>
                    <textarea
                      placeholder="Indica detalladamente los pasos a seguir para completar la tarea... Puedes incluir enlaces (ej: https://... o www....) y se convertirán en enlaces clicables."
                      value={taskFormData.description}
                      onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                      rows={4}
                      className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 leading-relaxed resize-none transition-all"
                    />
                    {taskFormData.description && parseTextWithLinks(taskFormData.description).some((p) => p.type === 'link') && (
                      <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 p-2 rounded-xl border border-indigo-100 dark:border-indigo-900">
                        <span>🔗 Enlaces detectados en el texto. Se mostrarán como enlaces directos para los estudiantes.</span>
                      </p>
                    )}
                  </div>

                  {/* Vinculación con Calificaciones Parciales */}
                  <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award size={18} className="text-indigo-600 dark:text-indigo-400" />
                        <div>
                          <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 block">
                            Vincular a Calificación Parcial
                          </label>
                          <p className="text-[10px] text-text-muted font-medium">
                            Permite calificar la tarea y transferir automáticamente la nota a Calificaciones Parciales.
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={taskFormData.linkToPartial || false}
                        onChange={(e) => setTaskFormData({ ...taskFormData, linkToPartial: e.target.checked })}
                        className="w-5 h-5 text-indigo-600 rounded-lg cursor-pointer accent-brand-blue"
                      />
                    </div>

                    {taskFormData.linkToPartial && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-indigo-100 dark:border-indigo-900/60">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">
                            Competencia a Evaluar
                          </label>
                          <select
                            value={taskFormData.linkedCompetencyId || 'c1'}
                            onChange={(e) => setTaskFormData({ ...taskFormData, linkedCompetencyId: e.target.value })}
                            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                          >
                            {activeCompetencies.map((comp) => (
                              <option key={comp.id} value={comp.id}>
                                {comp.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">
                            Puntuación Máxima
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={taskFormData.linkedMaxScore || 100}
                            onChange={(e) => setTaskFormData({ ...taskFormData, linkedMaxScore: Number(e.target.value) || 100 })}
                            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recursos Multimedia y Enlaces */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                      Recursos Adicionales (Opcional)
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-black uppercase text-slate-600 dark:text-slate-300">
                          Enlace Drive / PDF / Web
                        </label>
                        <input
                          type="url"
                          placeholder="https://drive.google.com/..."
                          value={taskFormData.link_url}
                          onChange={(e) => setTaskFormData({ ...taskFormData, link_url: e.target.value })}
                          className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[9px] font-black uppercase text-slate-600 dark:text-slate-300">
                          Vídeo de YouTube o Foto
                        </label>
                        <input
                          type="url"
                          placeholder="https://youtube.com/watch?v=..."
                          value={taskFormData.media_url}
                          onChange={(e) => setTaskFormData({ ...taskFormData, media_url: e.target.value })}
                          className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-black uppercase text-slate-600 dark:text-slate-300">
                        Acceso Directo a Google Classroom (para entrega en Classroom)
                      </label>
                      <input
                        type="url"
                        placeholder="https://classroom.google.com/c/..."
                        value={taskFormData.classroom_url}
                        onChange={(e) => setTaskFormData({ ...taskFormData, classroom_url: e.target.value })}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setShowTaskModal(false);
                        setEditingTask(null);
                      }}
                      className="px-5 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-black uppercase tracking-wider text-xs cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingTask}
                      className="px-6 py-3 bg-brand-blue hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-wider text-xs flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingTask ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={16} />
                          {editingTask ? 'Actualizar Tarea' : 'Publicar Tarea Ahora'}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL PARA CORREGIR Y EVALUAR TAREA (PORCENTAJE DE CUMPLIMIENTO) */}
          {selectedTaskForGrading && (() => {
            const totalStudents = courseStudents.length;
            const completedCount = courseStudents.filter((s: any) => {
              const rec = taskGradingState[s.id];
              return rec?.status === 'completed' || (rec?.score !== undefined && rec?.score !== '');
            }).length;
            const currentPercentage = totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0;
            const scoresList = courseStudents
              .map((s: any) => Number(taskGradingState[s.id]?.score))
              .filter((v: number) => !isNaN(v) && v > 0);
            const averageScore = scoresList.length > 0 ? Math.round(scoresList.reduce((a, b) => a + b, 0) / scoresList.length) : 0;

            const filteredStudents = courseStudents.filter((s: any) => {
              if (gradingSearch.trim()) {
                const q = gradingSearch.toLowerCase().trim();
                const fullName = `${s.first_name || ''} ${s.last_name || ''} ${s.name || ''}`.toLowerCase();
                const rne = (s.rne || '').toLowerCase();
                const num = String(s.order_number || '');
                if (!fullName.includes(q) && !rne.includes(q) && num !== q) return false;
              }
              if (gradingStatusFilter !== 'all') {
                const st = taskGradingState[s.id]?.status || 'pending';
                if (st !== gradingStatusFilter) return false;
              }
              return true;
            });

            return (
              <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-fade-in overflow-y-auto">
                <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
                  {/* Encabezado del modal */}
                  <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 p-6 text-white flex items-center justify-between border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center shrink-0">
                        <Award size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-lg text-[9px] font-black uppercase tracking-wider font-mono">
                            {parseTaskPeriod(selectedTaskForGrading)}
                          </span>
                          <span className="text-[10px] font-bold text-indigo-200 uppercase">
                            {selectedCourseObj ? `${selectedCourseObj.level} ${selectedCourseObj.grade} "${selectedCourseObj.section}"` : 'Curso'}
                          </span>
                        </div>
                        <h3 className="font-black text-lg md:text-xl uppercase tracking-tight text-white line-clamp-1">
                          Corregir: {selectedTaskForGrading.title}
                        </h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedTaskForGrading(null)}
                      className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 cursor-pointer transition-colors"
                    >
                      <X size={22} />
                    </button>
                  </div>

                  {/* Cuerpo scrollable */}
                  <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                    {/* Tarjetas de Métricas de Cumplimiento */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-indigo-500/10 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/50">
                        <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 block tracking-wider">
                          % Cumplimiento
                        </span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-2xl font-black text-indigo-600 dark:text-indigo-300">
                            {currentPercentage}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-indigo-200/50 dark:bg-indigo-900/60 rounded-full mt-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              currentPercentage === 100
                                ? 'bg-emerald-500'
                                : currentPercentage >= 50
                                ? 'bg-indigo-600'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${currentPercentage}%` }}
                          />
                        </div>
                      </div>

                      <div className="bg-emerald-500/10 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50">
                        <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 block tracking-wider">
                          Entregadas / Con Nota
                        </span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-300">
                            {completedCount}
                          </span>
                          <span className="text-xs font-bold text-slate-500">/ {totalStudents}</span>
                        </div>
                        <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400 block mt-1">
                          Alumnos evaluados
                        </span>
                      </div>

                      <div className="bg-amber-500/10 dark:bg-amber-950/40 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50">
                        <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 block tracking-wider">
                          Pendientes
                        </span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-2xl font-black text-amber-600 dark:text-amber-300">
                            {Math.max(0, totalStudents - completedCount)}
                          </span>
                          <span className="text-xs font-bold text-slate-500">alumnos</span>
                        </div>
                        <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400 block mt-1">
                          Sin corregir o entregar
                        </span>
                      </div>

                      <div className="bg-slate-100 dark:bg-slate-800/80 p-4 rounded-2xl border border-border-main">
                        <span className="text-[10px] font-black uppercase text-text-muted block tracking-wider">
                          Promedio del Aula
                        </span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-2xl font-black text-text-main">
                            {averageScore > 0 ? averageScore : '-'}
                          </span>
                          <span className="text-xs font-bold text-text-muted">/ {gradingMaxScore} pts</span>
                        </div>
                        <span className="text-[9px] font-medium text-text-muted block mt-1">
                          Calificación media
                        </span>
                      </div>
                    </div>

                    {/* Configuración de Vinculación con Calificaciones Parciales */}
                    <div className="p-4 bg-indigo-50/70 dark:bg-slate-800/60 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Award size={18} className="text-indigo-600 dark:text-indigo-400" />
                          <div>
                            <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 block">
                              Vincular calificaciones con Registro de Parciales
                            </span>
                            <p className="text-[10px] text-text-muted font-medium">
                              Al guardar, las notas de cada estudiante se transferirán directamente a la pestaña de Calificaciones Parciales.
                            </p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={gradingIsLinkedToPartial}
                          onChange={(e) => setGradingIsLinkedToPartial(e.target.checked)}
                          className="w-5 h-5 text-indigo-600 rounded-lg cursor-pointer accent-brand-blue"
                        />
                      </div>

                      {gradingIsLinkedToPartial && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-indigo-200/60 dark:border-indigo-900/50">
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                              Competencia a Asignar en Parciales
                            </label>
                            <select
                              value={gradingCompetencyId}
                              onChange={(e) => setGradingCompetencyId(e.target.value)}
                              className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                            >
                              {activeCompetencies.map((comp) => (
                                <option key={comp.id} value={comp.id}>
                                  {comp.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                              Puntuación Máxima de la Tarea
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={gradingMaxScore}
                              onChange={(e) => setGradingMaxScore(Number(e.target.value) || 100)}
                              className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Barra de Búsqueda y Acciones Rápidas */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-3 rounded-2xl border border-border-main shadow-xs">
                      <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <input
                            type="text"
                            placeholder="Buscar alumno o RNE..."
                            value={gradingSearch}
                            onChange={(e) => setGradingSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-brand-bg border border-border-main rounded-xl text-xs font-semibold text-text-main outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <select
                          value={gradingStatusFilter}
                          onChange={(e: any) => setGradingStatusFilter(e.target.value)}
                          className="px-3 py-2 bg-brand-bg border border-border-main rounded-xl text-xs font-bold text-text-muted outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="all">Todos ({totalStudents})</option>
                          <option value="completed">Entregados ({completedCount})</option>
                          <option value="pending">Pendientes ({totalStudents - completedCount})</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleMarkAllCompleted}
                          className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                          title="Marcar a todos los alumnos como Entregado"
                        >
                          <CheckCircle2 size={13} /> Marcar Todos Entregados
                        </button>

                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max={gradingMaxScore}
                            placeholder="Pts"
                            value={bulkGradeValue}
                            onChange={(e) => setBulkGradeValue(e.target.value)}
                            className="w-16 px-2 py-2 bg-brand-bg border border-border-main rounded-xl text-xs font-bold text-center text-text-main outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={handleApplyBulkGrade}
                            disabled={!bulkGradeValue}
                            className="px-3 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider disabled:opacity-50 transition-all cursor-pointer"
                            title="Asignar esta nota a todos los alumnos"
                          >
                            Asignar a Todos
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Tabla de Alumnos para Calificar */}
                    <div className="border border-border-main rounded-2xl overflow-hidden shadow-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                            <th className="py-2.5 px-3 w-12 text-center">No.</th>
                            <th className="py-2.5 px-3">Estudiante</th>
                            <th className="py-2.5 px-3 w-48 text-center">Estado de Entrega</th>
                            <th className="py-2.5 px-3 w-28 text-center">Calificación (/{gradingMaxScore})</th>
                            <th className="py-2.5 px-3 min-w-[160px]">Observación / Feedback</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-main text-xs bg-surface">
                          {filteredStudents.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-text-muted">
                                No se encontraron alumnos con los filtros seleccionados.
                              </td>
                            </tr>
                          ) : (
                            filteredStudents.map((s: any, idx: number) => {
                              const studentOrder = s.order_number || idx + 1;
                              const studentName = `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.name || 'Estudiante';
                              const currentRec = taskGradingState[s.id] || { status: 'pending', score: '', feedback: '' };
                              const isCompleted = currentRec.status === 'completed' || (currentRec.score !== undefined && currentRec.score !== '');

                              return (
                                <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                                  <td className="py-2 px-3 font-mono font-bold text-center text-text-muted">
                                    {studentOrder}
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="font-bold text-text-main line-clamp-1">{studentName}</div>
                                    {s.rne && <div className="text-[10px] text-text-muted font-mono">{s.rne}</div>}
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setTaskGradingState((prev) => ({
                                            ...prev,
                                            [s.id]: {
                                              ...prev[s.id],
                                              status: 'completed'
                                            }
                                          }));
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all cursor-pointer ${
                                          isCompleted
                                            ? 'bg-emerald-500 text-white shadow-xs'
                                            : 'bg-slate-100 dark:bg-slate-800 text-text-muted hover:bg-emerald-50 hover:text-emerald-600'
                                        }`}
                                      >
                                        ✓ Entregado
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setTaskGradingState((prev) => ({
                                            ...prev,
                                            [s.id]: {
                                              ...prev[s.id],
                                              status: 'pending',
                                              score: ''
                                            }
                                          }));
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all cursor-pointer ${
                                          currentRec.status === 'pending' && !currentRec.score
                                            ? 'bg-amber-500 text-white shadow-xs'
                                            : 'bg-slate-100 dark:bg-slate-800 text-text-muted hover:bg-amber-50 hover:text-amber-600'
                                        }`}
                                      >
                                        ⏳ Pendiente
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setTaskGradingState((prev) => ({
                                            ...prev,
                                            [s.id]: {
                                              ...prev[s.id],
                                              status: 'uncompleted',
                                              score: 0
                                            }
                                          }));
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all cursor-pointer ${
                                          currentRec.status === 'uncompleted'
                                            ? 'bg-rose-500 text-white shadow-xs'
                                            : 'bg-slate-100 dark:bg-slate-800 text-text-muted hover:bg-rose-50 hover:text-rose-600'
                                        }`}
                                      >
                                        ✗ No
                                      </button>
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <input
                                      type="number"
                                      min="0"
                                      max={gradingMaxScore}
                                      value={currentRec.score !== undefined ? currentRec.score : ''}
                                      onChange={(e) => {
                                        const val = e.target.value === '' ? '' : Math.min(Number(gradingMaxScore) || 100, Math.max(0, Number(e.target.value)));
                                        setTaskGradingState((prev) => ({
                                          ...prev,
                                          [s.id]: {
                                            ...prev[s.id],
                                            score: val,
                                            status: val !== '' ? 'completed' : prev[s.id]?.status || 'pending'
                                          }
                                        }));
                                      }}
                                      placeholder="-"
                                      onPaste={(e) => handleTaskGradingPaste(e, idx, filteredStudents)}
                                      onFocus={(e) => e.target.select()}
                                      className="w-16 p-1.5 text-center font-black rounded-xl border border-border-main bg-brand-bg text-text-main text-xs outline-none focus:ring-2 focus:ring-indigo-500 mx-auto"
                                    />
                                  </td>
                                  <td className="py-2 px-3">
                                    <input
                                      type="text"
                                      placeholder="Observación opcional..."
                                      value={currentRec.feedback || ''}
                                      onChange={(e) => {
                                        const txt = e.target.value;
                                        setTaskGradingState((prev) => ({
                                          ...prev,
                                          [s.id]: {
                                            ...prev[s.id],
                                            feedback: txt
                                          }
                                        }));
                                      }}
                                      className="w-full p-1.5 rounded-xl border border-border-main bg-brand-bg text-text-main text-xs outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-text-muted/60"
                                    />
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pie del modal con botones de acción */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-border-main flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 text-xs font-bold text-text-muted">
                      <CheckCircle2 size={16} className={currentPercentage > 0 ? "text-emerald-500" : "text-slate-400"} />
                      <span>{completedCount} de {totalStudents} alumnos evaluados ({currentPercentage}%)</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedTaskForGrading(null)}
                        className="px-4 py-2.5 rounded-2xl border border-border-main text-text-main hover:bg-surface font-black uppercase tracking-wider text-xs cursor-pointer transition-colors"
                      >
                        Cerrar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveTaskGrading}
                        disabled={isSavingGrading}
                        className="px-6 py-2.5 bg-brand-blue hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-wider text-xs flex items-center gap-2 shadow-lg shadow-brand-blue/30 disabled:opacity-50 cursor-pointer transition-all"
                      >
                        {isSavingGrading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Guardando...
                          </>
                        ) : gradingSuccess ? (
                          <>
                            <Check size={16} />
                            ¡Guardado con Éxito!
                          </>
                        ) : (
                          <>
                            <Save size={16} />
                            Guardar Correcciones y Calificaciones
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 5: FICHA DEL ESTUDIANTE */}
      {activeTab === 'folder' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* SELECTOR DE ALUMNO */}
          <div className="bg-surface p-6 rounded-3xl border border-border-main shadow-xl space-y-4">
            <h2 className="text-base font-black uppercase tracking-wider text-text-main flex items-center gap-2">
              <Users size={18} className="text-brand-blue" /> Alumnos del Curso
            </h2>

            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-2">
              {courseStudents.map((s: any) => {
                const sExcuse = activeExcusesMap[s.id];
                const sExcuseColor = sExcuse?.color || 'amber';
                const sExcuseBadgeBg = sExcuseColor === 'rose' ? 'bg-rose-500' : sExcuseColor === 'indigo' ? 'bg-indigo-600' : sExcuseColor === 'emerald' ? 'bg-emerald-600' : sExcuseColor === 'purple' ? 'bg-purple-600' : 'bg-amber-500';

                return (
                  <button
                    key={s.id}
                    onClick={() => setFolderStudentId(s.id)}
                    className={`w-full py-2 px-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      folderStudentId === s.id
                        ? 'bg-brand-blue text-white border-brand-blue shadow-md'
                        : sExcuse
                        ? 'bg-amber-500/10 dark:bg-amber-950/30 border-amber-400 text-text-main hover:border-amber-500'
                        : 'bg-brand-bg text-text-main border-border-main hover:border-brand-blue'
                    }`}
                  >
                    <span className="font-bold text-xs flex items-center gap-1.5 truncate">
                      <span>{getStudentFullName(s)}</span>
                      {specialNotesMap[s.id] && (
                        <Pin size={11} className="text-amber-600 fill-amber-500 shrink-0 rotate-45" title={specialNotesMap[s.id]} />
                      )}
                      {sExcuse && (
                        <span className={`px-1.5 py-0.2 rounded text-[8px] font-black text-white shrink-0 ${sExcuseBadgeBg}`} title={`Excusa: ${sExcuse.message}`}>
                          EXCUSA ({sExcuse.hoursRemaining}h)
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] font-mono opacity-70 shrink-0">{s.sigerd_code || s.rne || '---'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DETALLES EXPEDIENTE */}
          <div className="md:col-span-2 bg-surface p-6 rounded-3xl border border-border-main shadow-xl space-y-6">
            {!folderStudentId ? (
              <div className="py-20 text-center text-text-muted font-bold text-sm">
                Selecciona un alumno de la lista lateral para desplegar su ficha digital completa.
              </div>
            ) : (() => {
              const student = courseStudents.find((s: any) => s.id === folderStudentId);
              const studentNotes = notesList.filter((n) => {
                if (n.studentId !== folderStudentId) return false;
                if (isManagementOrDirector) return true;
                return isMyNote(n);
              });
              if (!student) return null;
              const sFullName = getStudentFullName(student);

              const familyList = folderStudentDetails.parents || [];
              const getRole = (f: any) => (f.relation || f.role || '').toLowerCase().trim();
              const dbPadre = familyList.find((f: any) => getRole(f) === 'padre');
              const dbMadre = familyList.find((f: any) => getRole(f) === 'madre');
              const dbTutor = familyList.find((f: any) => {
                const r = getRole(f);
                return r === 'tutor' || (!['padre', 'madre'].includes(r) && r !== '');
              });

              const primaryContact = dbTutor || dbMadre || dbPadre || familyList[0];
              const primaryName =
                primaryContact?.name ||
                student.parent_name ||
                student.authorized_person ||
                folderStudentDetails.studentInfo?.authorized_person ||
                '';
              const primaryPhone =
                primaryContact?.phone ||
                student.parent_phone ||
                student.personal_phone ||
                student.home_phone ||
                folderStudentDetails.studentInfo?.personal_phone ||
                folderStudentDetails.studentInfo?.home_phone ||
                '';
              const primaryRelation =
                primaryContact?.relation ||
                primaryContact?.role ||
                (dbTutor ? 'Tutor' : dbMadre ? 'Madre' : dbPadre ? 'Padre' : 'Tutor / Encargado');
              const cleanPhone = primaryPhone.replace(/[^0-9]/g, '');

              const openEditModal = () => {
                setTutorEditForm({
                  name: primaryName,
                  relation: primaryRelation || 'Tutor',
                  phone: primaryPhone,
                  id_card: primaryContact?.secondary_phone || primaryContact?.id_card || '',
                  occupation: primaryContact?.occupation || ''
                });
                setShowTutorEditModal(true);
              };

              return (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* ENCABEZADO DEL ESTUDIANTE */}
                  <div className="p-6 bg-slate-900 text-white rounded-3xl border border-white/10 shadow-lg space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-2xl text-white shadow-lg shrink-0">
                          {sFullName[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-black text-white">{sFullName}</h3>
                            {student.order_number && (
                              <span className="text-[10px] font-black bg-white/10 text-indigo-200 px-2 py-0.5 rounded-md">
                                #{student.order_number}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">
                            {student.sigerd_code ? `SIGERD: ${student.sigerd_code}` : ''}
                            {student.sigerd_code && student.rne ? ' | ' : ''}
                            {student.rne ? `RNE: ${student.rne}` : (!student.sigerd_code ? 'Sin RNE / SIGERD' : '')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* DATO COMPACTO DEL TUTOR DEBAJO DEL NOMBRE Y CÓDIGO */}
                    <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-500/30">
                          {primaryRelation || 'Tutor'}:
                        </span>
                        <span className="font-bold text-white text-xs">
                          {primaryName || <span className="text-slate-400 italic">No especificado</span>}
                        </span>
                        {primaryPhone && (
                          <span className="font-mono text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-md">
                            {primaryPhone}
                          </span>
                        )}
                        {primaryContact?.secondary_phone && (
                          <span className="font-mono text-[10px] text-slate-400">
                            Cédula: {primaryContact.secondary_phone}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {cleanPhone && (
                          <a
                            href={`https://wa.me/${cleanPhone.length <= 10 && !cleanPhone.startsWith('1') ? '1' + cleanPhone : cleanPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                            title="Contactar al tutor vía WhatsApp"
                          >
                            <span>💬 WhatsApp</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setDirectMessageRecipient({
                              studentId: student.id,
                              studentName: sFullName,
                              tutorName: primaryName || 'Tutor Responsable',
                              tutorPhone: primaryPhone,
                              courseId: selectedCourseId
                            });
                            setShowDirectMessageModal(true);
                          }}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                          title="Enviar Mensaje Interno dentro de la plataforma"
                        >
                          <MessageSquare size={14} />
                          <span>Mensaje Interno</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* FICHA MÉDICA / SALUD DEL ESTUDIANTE (UBICACIÓN SUPERIOR DESTACADA) */}
                  {folderStudentDetails.medical && (
                    <div className="p-4 rounded-2xl border border-border-main bg-brand-bg/40 space-y-2">
                      <h4 className="text-xs font-black uppercase text-text-muted tracking-wider flex items-center gap-2">
                        <span>🩺</span> Información Médica y Alergias
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-text-muted block">Alergias:</span>
                          <span className="font-bold text-text-main">
                            {folderStudentDetails.medical.allergies || 'Ninguna reportada'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-text-muted block">Condiciones / Cuidados:</span>
                          <span className="font-bold text-text-main">
                            {folderStudentDetails.medical.medical_conditions || 'Ninguna'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-text-muted block">Tipo de Sangre:</span>
                          <span className="font-bold text-text-main">
                            {folderStudentDetails.medical.blood_type || 'No registrado'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* EXCUSA MÉDICA O DE AUSENCIA VIGENTE (DESDE MÓDULO DE COMUNICADOS) */}
                  {activeExcusesMap[folderStudentId] && (() => {
                    const exc = activeExcusesMap[folderStudentId];
                    return (
                      <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-400 text-xs flex items-start justify-between gap-3 shadow-sm animate-in fade-in duration-150">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Clock size={18} />
                          </div>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-black text-amber-900 dark:text-amber-200 text-[11px] uppercase tracking-wider">
                                {exc.motive}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-black text-[9px] uppercase tracking-wider">
                                Vigente: {exc.hoursRemaining}h restantes
                              </span>
                            </div>
                            <p className="text-xs text-text-main font-semibold leading-relaxed">
                              "{exc.message}"
                            </p>
                            <p className="text-[10px] text-text-muted font-medium">
                              Registrada por: <strong>{exc.senderName}</strong> • Vigente hasta: {new Date(exc.validUntil).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedExcuseModalData(exc)}
                          className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-amber-100 text-amber-900 dark:text-amber-200 border border-amber-300 rounded-xl font-black text-[10px] uppercase tracking-wider shrink-0 transition-all cursor-pointer"
                        >
                          Ver Detalle
                        </button>
                      </div>
                    );
                  })()}

                  {/* NOTA DEL ALUMNO (SOLO SI FUE REGISTRADA EN EL HISTORIAL) */}
                  {specialNotesMap[folderStudentId] && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/40 text-xs flex items-start gap-2.5">
                      <Pin size={15} className="text-amber-600 fill-amber-500 shrink-0 mt-0.5 rotate-45" />
                      <div>
                        <span className="font-black text-amber-800 dark:text-amber-300 text-[10px] uppercase tracking-wider block">
                          Nota del Alumno (Historial)
                        </span>
                        <p className="font-semibold text-text-main mt-0.5 leading-relaxed whitespace-pre-wrap">
                          {specialNotesMap[folderStudentId]}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* HISTORIAL Y OBSERVACIONES DEL CUADERNILLO ANECDÓTICO */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-black uppercase text-text-muted tracking-wider flex items-center gap-2">
                          <FileText size={15} className="text-brand-blue" />
                          {isManagementOrDirector ? 'Historial de Apuntes del Alumno' : 'Mis Apuntes sobre este Alumno'} ({studentNotes.length})
                        </h4>
                        {!isManagementOrDirector && (
                          <p className="text-[10px] text-text-muted/80 font-medium mt-0.5">
                            🔒 Vista confidencial: Los apuntes de otros docentes están reservados exclusivamente al Equipo de Gestión.
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNewNoteStudentId(folderStudentId);
                          setActiveTab('notes');
                        }}
                        className="text-[11px] font-black uppercase text-brand-blue hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none shrink-0"
                      >
                        <Plus size={12} /> Nuevo Apunte
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-2">
                      {studentNotes.length === 0 ? (
                        <div className="py-8 text-center bg-brand-bg rounded-2xl border border-dashed border-border-main space-y-1">
                          <p className="text-xs text-text-muted italic">
                            {isManagementOrDirector
                              ? 'Sin apuntes ni observaciones registradas para este alumno.'
                              : 'No tienes apuntes personales registrados para este alumno.'}
                          </p>
                          {!isManagementOrDirector && (
                            <p className="text-[10px] text-text-muted/70">
                              Puedes redactar un apunte personal con el botón "+ Nuevo Apunte".
                            </p>
                          )}
                        </div>
                      ) : (
                        studentNotes.map((n) => (
                          <div
                            key={n.id}
                            className="p-4 rounded-2xl border border-border-main bg-brand-bg text-xs space-y-2 relative group hover:border-brand-blue/30 transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-black text-[9px] uppercase tracking-wider rounded-md">
                                {n.category}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[10px] text-text-muted">{n.date}</span>
                                {canDeleteNote(n) && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteNote(n.id, e)}
                                    className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all cursor-pointer"
                                    title="Eliminar este apunte del expediente"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-text-main font-medium leading-relaxed">{n.content}</p>
                            <div className="text-[10px] font-bold text-text-muted text-right">
                              Registrado por: {n.teacherName}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL PARA ENVIAR MENSAJE INTERNO AL TUTOR / PADRE */}
      {showDirectMessageModal && directMessageRecipient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-md rounded-[2.5rem] border border-border-main shadow-2xl p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-main pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center shrink-0">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-text-main">
                    Mensaje Interno al Tutor
                  </h3>
                  <p className="text-xs text-brand-blue font-bold">
                    {directMessageRecipient.studentName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDirectMessageModal(false)}
                className="p-1.5 rounded-xl hover:bg-brand-bg text-text-muted hover:text-text-main cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendDirectMessage} className="space-y-4">
              <div className="p-3.5 bg-brand-bg rounded-2xl border border-border-main text-xs space-y-1">
                <div className="flex items-center justify-between text-[11px] text-text-muted font-semibold">
                  <span>Destinatario:</span>
                  <span className="font-bold text-text-main">{directMessageRecipient.tutorName}</span>
                </div>
                {directMessageRecipient.tutorPhone && (
                  <div className="flex items-center justify-between text-[11px] text-text-muted font-semibold">
                    <span>Contacto:</span>
                    <span className="font-mono text-emerald-600 font-bold">{directMessageRecipient.tutorPhone}</span>
                  </div>
                )}
                <p className="text-[10px] text-text-muted/80 italic pt-1">
                  Este mensaje llegará directamente a la bandeja y notificaciones de la cuenta del padre/tutor en la plataforma.
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase text-text-muted">
                  Motivo / Tipo de Mensaje
                </label>
                <select
                  value={directMessageMotive}
                  onChange={(e) => setDirectMessageMotive(e.target.value)}
                  className="w-full p-3 bg-brand-bg border border-border-main rounded-xl text-xs font-bold text-text-main outline-none focus:ring-2 focus:ring-brand-blue cursor-pointer"
                >
                  <option value="Aviso">Aviso sobre el Alumno</option>
                  <option value="Conducta">Seguimiento / Conducta</option>
                  <option value="Rendimiento Académico">Rendimiento Académico</option>
                  <option value="Cita / Convocatoria">Convocatoria a Reunión</option>
                  <option value="Felicitación">Felicitación / Reconocimiento</option>
                  <option value="Comunicado General">Comunicado</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase text-text-muted">
                  Mensaje *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Escribe aquí el mensaje respetuoso y claro para el padre o tutor del alumno..."
                  value={directMessageText}
                  onChange={(e) => setDirectMessageText(e.target.value)}
                  className="w-full p-3 bg-brand-bg border border-border-main rounded-xl text-xs font-medium text-text-main outline-none focus:ring-2 focus:ring-brand-blue leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-main">
                <button
                  type="button"
                  onClick={() => setShowDirectMessageModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-border-main text-xs font-black uppercase text-text-muted hover:bg-brand-bg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSendingDirectMessage || !directMessageText.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Send size={14} />
                  {isSendingDirectMessage ? 'Enviando...' : 'Enviar Mensaje'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE OBSERVACIÓN ESPECIAL / ORIENTACIÓN Y PSICOLOGÍA */}
      {/* MODAL DE CONSULTA DE NOTA DEL ALUMNO */}
      {selectedSpecialNoteModalStudentId && specialNotesMap[selectedSpecialNoteModalStudentId] && (() => {
        const student = courseStudents.find((s: any) => s.id === selectedSpecialNoteModalStudentId);
        const noteText = specialNotesMap[selectedSpecialNoteModalStudentId];
        const studentName = student ? getStudentFullName(student) : 'Estudiante';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-surface border border-border-main rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border-main pb-3">
                <div className="flex items-center gap-2">
                  <Pin size={16} className="fill-amber-500 text-amber-600 rotate-45" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-text-main">
                    Nota del Alumno
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSpecialNoteModalStudentId(null)}
                  className="p-1.5 text-text-muted hover:text-text-main hover:bg-brand-bg rounded-xl transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div>
                <p className="text-xs font-black text-brand-blue mb-2">
                  {studentName}
                </p>
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30">
                  <p className="text-xs font-medium text-text-main leading-relaxed whitespace-pre-wrap">
                    {noteText}
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedSpecialNoteModalStudentId(null)}
                  className="px-5 py-2 bg-brand-blue hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-md"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL DE DETALLE DE EXCUSA MÉDICA / COMUNICADO ACTIVO */}
      {selectedExcuseModalData && (() => {
        const excuse = selectedExcuseModalData;
        const student = courseStudents.find((s: any) => s.id === excuse.studentId);
        const studentName = excuse.studentName || (student ? getStudentFullName(student) : 'Estudiante');

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-surface border border-border-main rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-border-main pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center font-bold">
                    <Clock size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-text-main">
                      Detalle de Excusa Activa
                    </h3>
                    <p className="text-[10px] text-text-muted">Generada desde el Módulo de Comunicaciones</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedExcuseModalData(null)}
                  className="p-1.5 text-text-muted hover:text-text-main hover:bg-brand-bg rounded-xl transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-brand-bg border border-border-main flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-text-muted block">
                      Estudiante:
                    </span>
                    <span className="text-xs font-black text-brand-blue">
                      {studentName}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-amber-500 text-white font-black text-[10px] uppercase tracking-wider shadow-xs">
                    {excuse.hoursRemaining}h restantes
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      Motivo: {excuse.motive}
                    </span>
                    <span className="text-[10px] text-text-muted font-mono">
                      Emisión: {new Date(excuse.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-text-main leading-relaxed whitespace-pre-wrap">
                    {excuse.message}
                  </p>
                </div>

                <div className="text-[11px] text-text-muted space-y-1 px-1">
                  <p>
                    <strong>Remitente:</strong> {excuse.senderName}
                  </p>
                  <p>
                    <strong>Válida hasta:</strong> {new Date(excuse.validUntil).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-border-main">
                <button
                  type="button"
                  onClick={() => setSelectedExcuseModalData(null)}
                  className="px-5 py-2 bg-brand-blue hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-md"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
