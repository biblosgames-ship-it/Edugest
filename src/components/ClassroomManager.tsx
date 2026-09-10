import React, { useState, useMemo, useEffect } from 'react';
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
  Settings
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { useTeacherIdentity } from '../utils/teacherUtils';

type AttendanceStatus = 'presente' | 'tardanza' | 'excusa' | 'ausente';
type NoteCategory = 'Conducta' | 'Académico' | 'Padres' | 'Salud';

const getDefaultActivities = (): Record<string, Array<{ id: string; name: string; maxScore: number }>> => ({
  'c1': [{ id: 'act_c1_1', name: 'Actividad 1', maxScore: 100 }],
  'c2': [{ id: 'act_c2_1', name: 'Actividad 1', maxScore: 100 }],
  'c3': [{ id: 'act_c3_1', name: 'Actividad 1', maxScore: 100 }],
  'c4': [{ id: 'act_c4_1', name: 'Actividad 1', maxScore: 100 }],
});

export const ClassroomManager = () => {
  const { state, center, selectedYear } = useApp();
  const { profile } = useSupabase();
  const { isSameTeacher } = useTeacherIdentity();
  const { courses: allCourses } = useCourses();
  const { subjects: allSubjects } = useSubjects();
  const { assignments: allAssignments } = useAssignments();
  const { students: allStudents, isLoading: studentsLoading } = useStudents();

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
  const [activeTab, setActiveTab] = useState<'attendance' | 'notes' | 'partials' | 'tasks' | 'folder'>('attendance');
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
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    period: 'P1',
    subject_id: '',
    due_date: '',
    media_url: '',
    link_url: '',
    classroom_url: ''
  });
  const [isSavingTask, setIsSavingTask] = useState<boolean>(false);

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

  // 3. CARGAR CALIFICACIONES PARCIALES (DESDE SUPABASE Y RESPALDO LOCAL)
  useEffect(() => {
    if (!selectedCourseId || !selectedSubjectId) {
      setPartialScores({});
      setCompetencyActivities(getDefaultActivities());
      return;
    }
    let isMounted = true;

    // 1. Carga inmediata desde localStorage o reset para evitar que persista en memoria el curso/periodo previo
    const saved = localStorage.getItem(storageScopeKey);
    let loadedFromLocal = false;

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setPartialScores(parsed.scores || {});
          setCompetencyActivities(parsed.activities || getDefaultActivities());
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
          .eq('school_year', year);

        if (centerId) {
          query = query.eq('center_id', centerId);
        }

        const { data, error } = await query.maybeSingle();

        if (!isMounted) return;

        if (!error && data && data.scores) {
          const cloudScores = data.scores.scores || {};
          const cloudActivities = data.scores.activities || getDefaultActivities();

          setPartialScores(cloudScores);
          setCompetencyActivities(cloudActivities);

          // Sincronizar respaldo local para este scope exacto
          localStorage.setItem(storageScopeKey, JSON.stringify({
            scores: cloudScores,
            activities: cloudActivities,
            period: selectedPeriod,
            subjectId: selectedSubjectId,
            courseId: selectedCourseId,
            teacherId: profile?.teacher_id || profile?.id,
            centerId: centerId,
            year: year
          }));
        } else if (!loadedFromLocal) {
          // Si no hay datos en la nube ni en local para este curso/periodo, mantenerlo limpio
          setPartialScores({});
          setCompetencyActivities(getDefaultActivities());
        }
      } catch (e) {
        console.warn('Error al cargar desglose de parciales de Supabase:', e);
      }
    };

    loadPartials();
    return () => { isMounted = false; };
  }, [storageScopeKey, selectedCourseId, selectedSubjectId, selectedPeriod, selectedYear, profile?.center_id, center?.id]);

  const [newActivityName, setNewActivityName] = useState<string>('');
  const [selectedCompetencyForNewAct, setSelectedCompetencyForNewAct] = useState<string>('c1');
  const [folderStudentId, setFolderStudentId] = useState<string>('');

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
      try {
        await supabase
          .from('attendance_records')
          .delete()
          .eq('course_id', selectedCourseId)
          .eq('date', selectedDate);

        // Registro de confirmación de que el docente pasó la lista completa de ese curso/día
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
        console.warn('Supabase attendance save error:', e);
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
        await supabase.from('student_anecdotal_notes').insert([
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
        ]);
      } catch (e) {
        console.warn('Error saving note to Supabase:', e);
      }
    }

    setNewNoteContent('');
    setNewNoteStudentId('');
    alert('¡Apunte registrado exitosamente y guardado en la nube!');
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

  // Guardar calificaciones del período y sincronizar con el Registro Digital Oficial
  const handleSavePartials = async () => {
    setIsSavingPartials(true);
    try {
      const targetCourse = availableCourses.find((c) => c.id === selectedCourseId);
      const centerId = profile?.center_id || targetCourse?.center_id;
      const year = selectedYear || '2026-2027';
      const periodKey = selectedPeriod.toLowerCase(); // 'p1', 'p2', 'p3', 'p4'

      localStorage.setItem(storageScopeKey, JSON.stringify({
        scores: partialScores,
        activities: competencyActivities,
        period: selectedPeriod,
        subjectId: selectedSubjectId,
        courseId: selectedCourseId,
        teacherId: profile?.teacher_id || profile?.id,
        centerId: centerId,
        year: year,
        updatedAt: new Date().toISOString()
      }));

      if (centerId && selectedCourseId && selectedSubjectId) {
        try {
          await supabase.from('student_partial_activities').upsert([
            {
              center_id: centerId,
              course_id: selectedCourseId,
              subject_id: selectedSubjectId,
              period: selectedPeriod,
              school_year: year,
              competency_id: 'all',
              activity_name: 'Desglose de Parciales',
              scores: { scores: partialScores, activities: competencyActivities },
              updated_at: new Date().toISOString()
            }
          ], { onConflict: 'center_id,course_id,subject_id,period,school_year' });
        } catch (e) {
          console.warn('Error saving partial breakdown:', e);
        }

        try {
          const gradeUpserts = courseStudents.map((s: any) => {
            const sScores = partialScores[s.id] || {};
            const actList: number[] = [];
            Object.entries(competencyActivities).forEach(([_, acts]) => {
              acts.forEach((act) => {
                if (sScores[act.id] !== undefined && sScores[act.id] !== null && !isNaN(Number(sScores[act.id]))) {
                  actList.push(Number(sScores[act.id]));
                }
              });
            });
            const avg = actList.length > 0
              ? Math.round(actList.reduce((a, b) => a + b, 0) / actList.length)
              : null;

            return {
              center_id: centerId,
              student_id: s.id,
              course_id: selectedCourseId,
              subject_id: selectedSubjectId,
              school_year: year,
              [periodKey]: avg
            };
          });

          if (gradeUpserts.length > 0) {
            await supabase.from('student_grades').upsert(gradeUpserts, {
              onConflict: 'center_id,student_id,course_id,subject_id,school_year'
            });
          }
        } catch (e) {
          console.warn('Error syncing student_grades:', e);
        }
      }

      setSavePartialsSuccess(true);
      setTimeout(() => setSavePartialsSuccess(false), 3000);
    } catch (e) {
      alert('Error al guardar parciales');
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

  const getCleanDescription = (desc: string = ''): string => {
    return desc.replace(/<!--period:P[1-4]-->\s*/gi, '').trim();
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
      classroom_url: platformLinks.classroom_url || ''
    });
    setShowTaskModal(true);
  };

  const handleOpenEditTask = (task: any) => {
    setEditingTask(task);
    setTaskFormData({
      title: task.title || '',
      description: getCleanDescription(task.description || ''),
      period: parseTaskPeriod(task),
      subject_id: task.subject_id || '',
      due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '',
      media_url: task.media_url || '',
      link_url: task.link_url || '',
      classroom_url: task.classroom_url || ''
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
      const payload: any = {
        center_id: centerId,
        course_id: selectedCourseId,
        subject_id: taskFormData.subject_id || null,
        title: taskFormData.title.trim(),
        description: taskFormData.description.trim(),
        period: taskFormData.period,
        due_date: taskFormData.due_date ? new Date(taskFormData.due_date).toISOString() : null,
        media_url: taskFormData.media_url.trim() || null,
        link_url: taskFormData.link_url.trim() || null,
        classroom_url: taskFormData.classroom_url.trim() || null
      };

      if (editingTask?.id) {
        await dataService.updateTask(editingTask.id, payload);
        alert('¡Tarea actualizada correctamente!');
      } else {
        await dataService.addTask({
          ...payload,
          teacher_id: teacherId
        });
        alert('¡Tarea creada y publicada con éxito!');
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
            onClick={() => setActiveTab(tab.id as any)}
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
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input
                type="text"
                placeholder="Buscar por alumno o RNE..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-2xl border border-border-main bg-brand-bg text-xs font-medium focus:ring-2 focus:ring-brand-blue outline-none"
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
          <div className="bg-surface rounded-3xl border border-border-main shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900/60 border-b border-border-main text-[10px] font-black text-text-muted uppercase tracking-widest">
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
                      return (
                        <tr key={s.id} className="hover:bg-brand-bg/60 transition-colors">
                          <td className="px-4 py-2 font-black text-text-muted text-xs">
                            {s.order_number != null && s.order_number !== '' ? s.order_number : (idx + 1)}
                          </td>
                          <td className="px-4 py-2 font-bold text-text-main text-xs">
                            {getStudentFullName(s)}
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
                                    ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/30'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700'
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
                              placeholder="Ej. Llegó a 2da hora..."
                              value={attendanceState[s.id]?.note || ''}
                              onChange={(e) =>
                                setAttendanceState((prev) => ({
                                  ...prev,
                                  [s.id]: {
                                    status: prev[s.id]?.status || 'presente',
                                    note: e.target.value
                                  }
                                }))
                              }
                              className="w-full px-3 py-1 rounded-xl border border-border-main bg-brand-bg text-xs outline-none focus:ring-1 focus:ring-brand-blue"
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
            <h2 className="text-base font-black uppercase tracking-wider text-text-main flex items-center gap-2">
              <FileText size={18} className="text-brand-blue" /> Historial de Apuntes del Grado
            </h2>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {notesList.length === 0 ? (
                <div className="py-12 text-center text-text-muted font-bold text-xs">
                  No hay observaciones ni apuntes registrados todavía.
                </div>
              ) : (
                notesList.map((n) => {
                  const studentObj = courseStudents.find((s: any) => s.id === n.studentId);
                  return (
                    <div key={n.id} className="p-4 rounded-2xl border border-border-main bg-brand-bg/50 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-sm text-brand-blue">
                          {getStudentFullName(studentObj)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-black text-[9px] uppercase tracking-wider rounded-lg">
                            {n.category}
                          </span>
                          <span className="text-[10px] font-bold text-text-muted">{n.date}</span>
                        </div>
                      </div>
                      <p className="text-xs text-text-main font-medium leading-relaxed">{n.content}</p>
                      <div className="text-[9px] font-bold text-text-muted text-right">
                        Registrado por: {n.teacherName}
                      </div>
                    </div>
                  );
                })
              )}
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
                className="px-4 py-2 rounded-2xl border border-border-main bg-brand-bg text-xs outline-none focus:ring-2 focus:ring-brand-blue min-w-[220px]"
              />
              <button
                onClick={handleAddActivity}
                className="px-4 py-2 bg-brand-blue hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-brand-blue/20"
              >
                <Plus size={14} /> Añadir Columna
              </button>
            </div>

            <div className="flex items-center gap-3">
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
                      const colSpan = Math.max(1, acts.length) + 1; // columnas de actividades + col de promedio de comp
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
                            Prom. {comp.id.toUpperCase()}
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
                      
                      // Calcular promedios por competencia
                      const compAverages: number[] = [];

                      activeCompetencies.forEach((comp) => {
                        const acts = competencyActivities[comp.id] || [];
                        const validScores = acts
                          .map((a) => studentScores[a.id])
                          .filter((v) => typeof v === 'number' && !isNaN(v));

                        if (validScores.length > 0) {
                          const avg = Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length);
                          compAverages.push(avg);
                        } else {
                          compAverages.push(0);
                        }
                      });

                      // Promedio final acumulado de las competencias
                      const finalAvg = compAverages.length > 0
                        ? Math.round(compAverages.reduce((a, b) => a + b, 0) / compAverages.length)
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
                            const compAvg = compAverages[compIdx];

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
                                        value={studentScores[act.id] ?? ''}
                                        onChange={(e) => handlePartialScoreChange(s.id, act.id, Number(e.target.value))}
                                        className="w-12 text-center py-0.5 rounded-lg border border-border-main bg-brand-bg font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-brand-blue"
                                      />
                                    </td>
                                  ))
                                )}
                                <td className="px-2 py-1 text-center font-black bg-indigo-50/50 dark:bg-indigo-950/20 text-brand-blue text-xs">
                                  {compAvg}
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-900 dark:text-indigo-300">
                  <Globe size={15} className="text-indigo-600" />
                  Enlaces Fijos del Docente para Estudiantes y Padres
                </div>
                <span className="text-[10px] text-text-muted font-bold">
                  Visibles con 1 clic en el portal del alumno
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* Google Classroom */}
                <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-800/80 rounded-2xl border border-border-main shadow-sm">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                      <GraduationCap size={18} />
                    </div>
                    <div className="truncate">
                      <p className="text-[10px] font-black uppercase text-text-muted">Google Classroom</p>
                      <p className="text-xs font-bold text-text-main truncate">
                        {platformLinks.classroom_url ? 'Enlace activo' : 'No configurado'}
                      </p>
                    </div>
                  </div>
                  {platformLinks.classroom_url ? (
                    <a
                      href={platformLinks.classroom_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-colors shrink-0"
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
                      className="text-[10px] font-bold text-indigo-600 hover:underline shrink-0 cursor-pointer"
                    >
                      + Añadir
                    </button>
                  )}
                </div>

                {/* Google Meet / Videollamada */}
                <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-800/80 rounded-2xl border border-border-main shadow-sm">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                      <Video size={18} />
                    </div>
                    <div className="truncate">
                      <p className="text-[10px] font-black uppercase text-text-muted">Videollamada / Meet</p>
                      <p className="text-xs font-bold text-text-main truncate">
                        {platformLinks.meet_url ? 'Enlace activo' : 'No configurado'}
                      </p>
                    </div>
                  </div>
                  {platformLinks.meet_url ? (
                    <a
                      href={platformLinks.meet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-colors shrink-0"
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
                      className="text-[10px] font-bold text-indigo-600 hover:underline shrink-0 cursor-pointer"
                    >
                      + Añadir
                    </button>
                  )}
                </div>

                {/* Plataforma Alterna / Drive */}
                <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-800/80 rounded-2xl border border-border-main shadow-sm">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0">
                      <Globe size={18} />
                    </div>
                    <div className="truncate">
                      <p className="text-[10px] font-black uppercase text-text-muted">
                        {platformLinks.other_label || 'Plataforma Alterna'}
                      </p>
                      <p className="text-xs font-bold text-text-main truncate">
                        {platformLinks.other_url ? 'Enlace activo' : 'No configurado'}
                      </p>
                    </div>
                  </div>
                  {platformLinks.other_url ? (
                    <a
                      href={platformLinks.other_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-violet-50 hover:bg-violet-100 text-violet-600 rounded-xl transition-colors shrink-0"
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
                      className="text-[10px] font-bold text-indigo-600 hover:underline shrink-0 cursor-pointer"
                    >
                      + Añadir
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
                  className="bg-surface border border-border-main text-text-main text-xs font-bold px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-brand-blue cursor-pointer"
                >
                  <option value="ALL">TODAS MIS ASIGNATURAS</option>
                  {availableSubjects.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Buscador de tareas */}
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={15} />
                <input
                  type="text"
                  placeholder="Buscar tarea por título o descripción..."
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-surface border border-border-main rounded-xl text-xs text-text-main font-medium placeholder-text-muted outline-none focus:ring-2 focus:ring-brand-blue"
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
                        <p className="text-xs text-text-muted line-clamp-3 leading-relaxed">
                          {cleanDesc}
                        </p>
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
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-surface w-full max-w-lg rounded-3xl border border-border-main shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-slate-900 to-indigo-900 p-6 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <Settings size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-base uppercase tracking-tight">Enlaces Fijos de Clase</h3>
                      <p className="text-xs text-indigo-200">Visibles para alumnos y padres en su portal</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLinksModal(false)}
                    className="text-white/70 hover:text-white p-1 rounded-xl hover:bg-white/10 cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSavePlatformLinks} className="p-6 space-y-4 text-xs font-bold">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted">
                      Google Classroom (Link permanente del curso / clase)
                    </label>
                    <input
                      type="url"
                      placeholder="https://classroom.google.com/c/..."
                      value={tempLinks.classroom_url}
                      onChange={(e) => setTempLinks({ ...tempLinks, classroom_url: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-border-main rounded-xl outline-none focus:ring-2 focus:ring-brand-blue text-xs text-text-main"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted">
                      Google Meet / Videollamada (Enlace recurrente)
                    </label>
                    <input
                      type="url"
                      placeholder="https://meet.google.com/..."
                      value={tempLinks.meet_url}
                      onChange={(e) => setTempLinks({ ...tempLinks, meet_url: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-border-main rounded-xl outline-none focus:ring-2 focus:ring-brand-blue text-xs text-text-main"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted">
                      Plataforma Alterna o Carpeta Drive (URL)
                    </label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/drive/folders/..."
                      value={tempLinks.other_url}
                      onChange={(e) => setTempLinks({ ...tempLinks, other_url: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-border-main rounded-xl outline-none focus:ring-2 focus:ring-brand-blue text-xs text-text-main"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted">
                      Nombre o Etiqueta de la Plataforma Alterna
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Carpeta de Recursos en Drive / Padlet / Moodle"
                      value={tempLinks.other_label}
                      onChange={(e) => setTempLinks({ ...tempLinks, other_label: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-border-main rounded-xl outline-none focus:ring-2 focus:ring-brand-blue text-xs text-text-main"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-main">
                    <button
                      type="button"
                      onClick={() => setShowLinksModal(false)}
                      className="px-4 py-2.5 rounded-xl border border-border-main text-text-muted hover:text-text-main font-black uppercase tracking-wider text-[10px] cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingLinks}
                      className="px-5 py-2.5 bg-brand-blue hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-wider text-[10px] flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingLinks ? 'Guardando...' : 'Guardar Enlaces'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL PARA CREAR O EDITAR TAREA */}
          {showTaskModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
              <div className="bg-surface w-full max-w-2xl rounded-3xl border border-border-main shadow-2xl overflow-hidden my-8">
                <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-900 p-6 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                      <BookOpen size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-lg uppercase tracking-tight">
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
                    <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted">
                      Título de la Asignación *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Informe de Lectura - Capítulo 3"
                      value={taskFormData.title}
                      onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                      className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-border-main rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue text-xs text-text-main font-bold"
                      required
                    />
                  </div>

                  {/* Periodo, Asignatura y Fecha de Entrega */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted">
                        Período Escolar *
                      </label>
                      <select
                        value={taskFormData.period}
                        onChange={(e) => setTaskFormData({ ...taskFormData, period: e.target.value })}
                        className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-border-main rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue text-xs text-text-main font-bold cursor-pointer"
                        required
                      >
                        <option value="P1">Período 1 (P1)</option>
                        <option value="P2">Período 2 (P2)</option>
                        <option value="P3">Período 3 (P3)</option>
                        <option value="P4">Período 4 (P4)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted">
                        Materia Asociada
                      </label>
                      <select
                        value={taskFormData.subject_id}
                        onChange={(e) => setTaskFormData({ ...taskFormData, subject_id: e.target.value })}
                        className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-border-main rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue text-xs text-text-main font-bold cursor-pointer"
                      >
                        <option value="">GENERAL / TODAS</option>
                        {availableSubjects.map((s: any) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted">
                        Fecha y Hora Límite
                      </label>
                      <input
                        type="datetime-local"
                        value={taskFormData.due_date}
                        onChange={(e) => setTaskFormData({ ...taskFormData, due_date: e.target.value })}
                        className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-border-main rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue text-xs text-text-main font-bold"
                      />
                    </div>
                  </div>

                  {/* Instrucciones / Descripción */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted">
                      Instrucciones y Criterios de Evaluación
                    </label>
                    <textarea
                      placeholder="Indica detalladamente los pasos a seguir para completar la tarea..."
                      value={taskFormData.description}
                      onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                      rows={4}
                      className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-border-main rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue text-xs text-text-main font-medium leading-relaxed resize-none"
                    />
                  </div>

                  {/* Recursos Multimedia y Enlaces */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-border-main space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                      Recursos Adicionales (Opcional)
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-black uppercase text-text-muted">
                          Enlace Drive / PDF / Web
                        </label>
                        <input
                          type="url"
                          placeholder="https://drive.google.com/..."
                          value={taskFormData.link_url}
                          onChange={(e) => setTaskFormData({ ...taskFormData, link_url: e.target.value })}
                          className="w-full p-2.5 bg-white dark:bg-slate-900 border border-border-main rounded-xl text-xs text-text-main font-medium outline-none focus:ring-2 focus:ring-brand-blue"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[9px] font-black uppercase text-text-muted">
                          Vídeo de YouTube o Foto
                        </label>
                        <input
                          type="url"
                          placeholder="https://youtube.com/watch?v=..."
                          value={taskFormData.media_url}
                          onChange={(e) => setTaskFormData({ ...taskFormData, media_url: e.target.value })}
                          className="w-full p-2.5 bg-white dark:bg-slate-900 border border-border-main rounded-xl text-xs text-text-main font-medium outline-none focus:ring-2 focus:ring-brand-blue"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-black uppercase text-text-muted">
                        Acceso Directo a Google Classroom (para entrega en Classroom)
                      </label>
                      <input
                        type="url"
                        placeholder="https://classroom.google.com/c/..."
                        value={taskFormData.classroom_url}
                        onChange={(e) => setTaskFormData({ ...taskFormData, classroom_url: e.target.value })}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-border-main rounded-xl text-xs text-text-main font-medium outline-none focus:ring-2 focus:ring-brand-blue"
                      />
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-main">
                    <button
                      type="button"
                      onClick={() => {
                        setShowTaskModal(false);
                        setEditingTask(null);
                      }}
                      className="px-5 py-3 rounded-2xl border border-border-main text-text-muted hover:text-text-main font-black uppercase tracking-wider text-xs cursor-pointer"
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
              {courseStudents.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => setFolderStudentId(s.id)}
                  className={`w-full py-2 px-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    folderStudentId === s.id
                      ? 'bg-brand-blue text-white border-brand-blue shadow-md'
                      : 'bg-brand-bg text-text-main border-border-main hover:border-brand-blue'
                  }`}
                >
                  <span className="font-bold text-xs">{getStudentFullName(s)}</span>
                  <span className="text-[10px] font-mono opacity-70">{s.sigerd_code || s.rne || '---'}</span>
                </button>
              ))}
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
              const studentNotes = notesList.filter((n) => n.studentId === folderStudentId);
              if (!student) return null;
              const sFullName = getStudentFullName(student);

              return (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 p-6 bg-slate-900 text-white rounded-3xl border border-white/10">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-2xl text-white shadow-lg">
                        {sFullName[0]}
                      </div>
                      <div>
                        <h3 className="text-xl font-black">{sFullName}</h3>
                        <p className="text-xs text-slate-400 font-mono">
                          {student.sigerd_code ? `SIGERD: ${student.sigerd_code}` : ''}
                          {student.sigerd_code && student.rne ? ' | ' : ''}
                          {student.rne ? `RNE: ${student.rne}` : (!student.sigerd_code ? 'Sin RNE / SIGERD' : '')}
                        </p>
                      </div>
                    </div>

                    {student.parent_phone && (
                      <a
                        href={`tel:${student.parent_phone}`}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all"
                      >
                        <Phone size={14} /> Llamar Tutor ({student.parent_phone})
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl border border-border-main bg-brand-bg space-y-1">
                      <span className="text-[10px] font-bold text-text-muted uppercase">Padre / Tutor Responsable</span>
                      <p className="text-sm font-black text-text-main">{student.parent_name || 'No especificado'}</p>
                    </div>
                    <div className="p-4 rounded-2xl border border-border-main bg-brand-bg space-y-1">
                      <span className="text-[10px] font-bold text-text-muted uppercase">Teléfono de Contacto</span>
                      <p className="text-sm font-black text-text-main">{student.parent_phone || student.phone || 'Sin Teléfono'}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase text-text-muted tracking-wider">
                      Observaciones y Apuntes Históricos ({studentNotes.length})
                    </h4>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                      {studentNotes.length === 0 ? (
                        <p className="text-xs text-text-muted italic">Sin apuntes en el expediente.</p>
                      ) : (
                        studentNotes.map((n) => (
                          <div key={n.id} className="p-3 rounded-xl border border-border-main bg-brand-bg text-xs space-y-1">
                            <div className="flex justify-between font-bold text-[10px] text-text-muted">
                              <span>{n.category}</span>
                              <span>{n.date}</span>
                            </div>
                            <p className="text-text-main font-medium">{n.content}</p>
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
    </div>
  );
};
