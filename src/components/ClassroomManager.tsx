import React, { useState, useMemo } from 'react';
import { useApp, useSupabase } from '../context/AppContext';
import { useStudents } from '../hooks/useStudents';
import { useCourses } from '../hooks/useCourses';
import { useAssignments } from '../hooks/useAssignments';
import { useSubjects } from '../hooks/useSubjects';
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
  ChevronRight
} from 'lucide-react';
import { dataService } from '../services/dataService';

type AttendanceStatus = 'presente' | 'tardanza' | 'excusa' | 'ausente';
type NoteCategory = 'Conducta' | 'Académico' | 'Padres' | 'Salud';

export const ClassroomManager = () => {
  const { state, selectedYear } = useApp();
  const { profile } = useSupabase();
  const { courses: allCourses } = useCourses();
  const { subjects: allSubjects } = useSubjects();
  const { assignments: allAssignments } = useAssignments();
  const { students: allStudents, isLoading: studentsLoading } = useStudents();

  // Estados de vista
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'attendance' | 'notes' | 'partials' | 'folder'>('attendance');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
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
    const saved = localStorage.getItem('edugest_anecdotal_notes');
    return saved ? JSON.parse(saved) : [];
  });
  const [newNoteStudentId, setNewNoteStudentId] = useState<string>('');
  const [newNoteCategory, setNewNoteCategory] = useState<NoteCategory>('Conducta');
  const [newNoteContent, setNewNoteContent] = useState<string>('');

  const [selectedPeriod, setSelectedPeriod] = useState<string>('P1');

  // Asignaturas del curso seleccionado
  const availableSubjects = useMemo(() => {
    if (!selectedCourseId) return [];
    let subs = (allAssignments || [])
      .filter((a: any) => (a.course_id || a.courseId) === selectedCourseId)
      .map((a: any) => (allSubjects || []).find((s: any) => s.id === (a.subject_id || a.subjectId)))
      .filter(Boolean);
    if (subs.length === 0) subs = allSubjects || [];
    return subs;
  }, [selectedCourseId, allAssignments, allSubjects]);

  // Autoseleccionar primera asignatura
  React.useEffect(() => {
    if (availableSubjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(availableSubjects[0].id);
    }
  }, [availableSubjects, selectedSubjectId]);

  // Clave de scope estricto: centro_año_docente_curso_asignatura_periodo
  const storageScopeKey = useMemo(() => {
    const centerId = profile?.center_id || 'default_center';
    const year = selectedYear || '2026-2027';
    const teacherId = profile?.teacher_id || profile?.id || 'default_teacher';
    const courseId = selectedCourseId || 'nocourse';
    const subjectId = selectedSubjectId || 'nosubject';
    const period = selectedPeriod || 'P1';
    return `edugens_partials_${centerId}_${year}_${teacherId}_${courseId}_${subjectId}_${period}`;
  }, [profile, selectedYear, selectedCourseId, selectedSubjectId, selectedPeriod]);

  // Estado de Calificaciones Parciales por Competencias
  const [competencyActivities, setCompetencyActivities] = useState<Record<string, Array<{ id: string; name: string; maxScore: number }>>>({
    'c1': [{ id: 'act_c1_1', name: 'Actividad 1', maxScore: 100 }],
    'c2': [{ id: 'act_c2_1', name: 'Actividad 1', maxScore: 100 }],
    'c3': [{ id: 'act_c3_1', name: 'Actividad 1', maxScore: 100 }],
    'c4': [{ id: 'act_c4_1', name: 'Actividad 1', maxScore: 100 }],
  });

  const [partialScores, setPartialScores] = useState<Record<string, Record<string, number>>>({});
  const [isSavingPartials, setIsSavingPartials] = useState<boolean>(false);
  const [savePartialsSuccess, setSavePartialsSuccess] = useState<boolean>(false);

  // Cargar calificaciones parciales especificas del scope bajo demanda (Lazy Load)
  React.useEffect(() => {
    if (!selectedCourseId || !selectedSubjectId) return;
    const saved = localStorage.getItem(storageScopeKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPartialScores(parsed.scores || {});
        if (parsed.activities) setCompetencyActivities(parsed.activities);
      } catch (e) {
        setPartialScores({});
      }
    } else {
      setPartialScores({});
    }
  }, [storageScopeKey, selectedCourseId, selectedSubjectId]);

  const [newActivityName, setNewActivityName] = useState<string>('');
  const [selectedCompetencyForNewAct, setSelectedCompetencyForNewAct] = useState<string>('c1');

  // Ficha de Estudiante Seleccionado
  const [folderStudentId, setFolderStudentId] = useState<string>('');

  // Cursos disponibles para el usuario
  const availableCourses = useMemo(() => {
    let base = [...(allCourses || [])];
    if (profile?.role === 'teacher' && profile?.teacher_id) {
      const assignedIds = new Set(
        (allAssignments || [])
          .filter((a: any) => (a.teacher_id || a.teacherId) === profile.teacher_id)
          .map((a: any) => a.course_id || a.courseId)
      );
      if (assignedIds.size > 0) {
        base = base.filter((c: any) => assignedIds.has(c.id));
      }
    }
    return base;
  }, [allCourses, profile, allAssignments]);

  // Autoseleccionar primer curso disponible
  React.useEffect(() => {
    if (availableCourses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(availableCourses[0].id);
    }
  }, [availableCourses, selectedCourseId]);

  // Helper para obtener el nombre completo del estudiante (sin duplicar apellidos)
  const getStudentFullName = (s: any) => {
    if (!s) return 'Estudiante';

    // 1. Si tiene first_surname o second_surname, usar primero esos campos exactos:
    if (s.first_surname || s.second_surname) {
      const surname = `${s.first_surname || ''} ${s.second_surname || ''}`.trim();
      const names = (s.names || s.first_name || s.nombre || '').trim();
      if (names && surname) return `${names} ${surname}`.trim();
      if (names) return names;
      if (surname) return surname;
    }

    // 2. Si tiene names y apellidos/last_name (sin first_surname separado)
    if (s.names && String(s.names).trim()) {
      const names = String(s.names).trim();
      const surname = (s.apellidos || s.last_name || s.apellido || '').trim();
      if (surname && !names.toLowerCase().includes(surname.toLowerCase())) {
        return `${names} ${surname}`.trim();
      }
      return names;
    }

    // 3. first_name / last_name
    if (s.first_name || s.last_name) {
      const fn = (s.first_name || '').trim();
      const ln = (s.last_name || '').trim();
      if (fn && ln && !fn.toLowerCase().includes(ln.toLowerCase())) return `${fn} ${ln}`.trim();
      return fn || ln;
    }

    // 4. full_name / name / nombre_completo
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

  // Helper para clave de ordenamiento por Apellido Primero (Primer Apellido, Segundo Apellido, Nombres)
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

  // Estudiantes del curso seleccionado (ordenados ESTRICTAMENTE por Número de Orden oficial de Gestión de Alumnos)
  const courseStudents = useMemo(() => {
    if (!selectedCourseId) return [];
    return (allStudents || [])
      .filter((s: any) => s.course_id === selectedCourseId || s.courseId === selectedCourseId)
      .sort((a: any, b: any) => {
        const numA = (a.order_number !== undefined && a.order_number !== null && a.order_number !== '') ? Number(a.order_number) : null;
        const numB = (b.order_number !== undefined && b.order_number !== null && b.order_number !== '') ? Number(b.order_number) : null;

        // SI TIENEN NÚMERO DE ORDEN ASIGNADO, EL ORDEN ES 100% ESTRICTO POR ESE NÚMERO
        // (Ejemplo: Si un alumno con apellido 'Areche' tiene el orden #28 por inscribirse de último, aparecerá en el puesto #28 al final)
        if (numA !== null && numB !== null) {
          return numA - numB;
        }
        if (numA !== null) return -1;
        if (numB !== null) return 1;

        // Solo si no tienen número de orden asignado, se ordenan alfabéticamente por apellido
        return getSortKeyBySurname(a).localeCompare(getSortKeyBySurname(b));
      });
  }, [allStudents, selectedCourseId]);

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

  // Guardar Asistencia
  const handleSaveAttendance = async () => {
    if (!selectedCourseId) return;
    setIsSavingAttendance(true);
    try {
      // Guardar en localStorage para persistencia instantánea
      const key = `attendance_${selectedCourseId}_${selectedDate}`;
      localStorage.setItem(key, JSON.stringify(attendanceState));

      // Guardar también en Supabase si está disponible
      if (profile?.center_id) {
        const recordsToSave = Object.entries(attendanceState).map(([sId, data]) => ({
          center_id: profile.center_id,
          student_id: sId,
          course_id: selectedCourseId,
          date: selectedDate,
          status: data.status,
          notes: data.note,
          recorded_by: profile.id
        }));

        for (const rec of recordsToSave) {
          try {
            await dataService.saveAttendance(rec);
          } catch {}
        }
      }

      setAttendanceSuccess(true);
      setTimeout(() => setAttendanceSuccess(false), 3000);
    } catch (error) {
      alert('Error al guardar asistencia');
    } finally {
      setIsSavingAttendance(false);
    }
  };

  // Guardar nuevo Apunte / Anecdotario
  const handleAddNote = () => {
    if (!newNoteStudentId || !newNoteContent.trim()) {
      alert('Por favor selecciona un estudiante y escribe el apunte.');
      return;
    }

    const note = {
      id: `note_${Date.now()}`,
      studentId: newNoteStudentId,
      date: new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }),
      category: newNoteCategory,
      content: newNoteContent.trim(),
      teacherName: profile?.full_name || profile?.email || 'Docente'
    };

    const updated = [note, ...notesList];
    setNotesList(updated);
    localStorage.setItem('edugens_anecdotal_notes', JSON.stringify(updated));
    setNewNoteContent('');
    setNewNoteStudentId('');
    alert('¡Apunte registrado exitosamente!');
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

  // Agregar nueva actividad parcial a una competencia específica
  const handleAddActivity = () => {
    if (!newActivityName.trim()) return;
    const compId = selectedCompetencyForNewAct || 'c1';
    const act = { id: `act_${compId}_${Date.now()}`, name: newActivityName.trim(), maxScore: 100 };
    setCompetencyActivities((prev) => ({
      ...prev,
      [compId]: [...(prev[compId] || []), act]
    }));
    setNewActivityName('');
  };

  // Eliminar actividad parcial
  const handleDeleteActivity = (compId: string, actId: string) => {
    setCompetencyActivities((prev) => ({
      ...prev,
      [compId]: (prev[compId] || []).filter((a) => a.id !== actId)
    }));
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
      // Guardar localmente en el scope estricto
      localStorage.setItem(storageScopeKey, JSON.stringify({
        scores: updatedScores,
        activities: competencyActivities,
        period: selectedPeriod,
        subjectId: selectedSubjectId,
        courseId: selectedCourseId,
        teacherId: profile?.teacher_id || profile?.id,
        centerId: profile?.center_id,
        year: selectedYear
      }));
      return updatedScores;
    });
  };

  // Guardar calificaciones del período explicitamente
  const handleSavePartials = () => {
    setIsSavingPartials(true);
    try {
      localStorage.setItem(storageScopeKey, JSON.stringify({
        scores: partialScores,
        activities: competencyActivities,
        period: selectedPeriod,
        subjectId: selectedSubjectId,
        courseId: selectedCourseId,
        teacherId: profile?.teacher_id || profile?.id,
        centerId: profile?.center_id,
        year: selectedYear,
        updatedAt: new Date().toISOString()
      }));
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
          { id: 'folder', label: '4. Ficha del Estudiante', icon: Users }
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
                    <th className="px-4 py-2.5">RNE / Código</th>
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
                            {s.rne || s.student_code || '---'}
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

      {/* TAB 4: FICHA DEL ESTUDIANTE */}
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
                  <span className="text-[10px] font-mono opacity-70">{s.rne || 'RNE'}</span>
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
                        <p className="text-xs text-slate-400 font-mono">RNE: {student.rne || 'Sin RNE'}</p>
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
