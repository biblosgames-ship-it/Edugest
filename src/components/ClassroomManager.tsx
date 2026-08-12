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
  Info
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

  // Estado de Calificaciones Parciales
  const [partialActivities, setPartialActivities] = useState<Array<{ id: string; name: string; maxScore: number }>>([
    { id: 'act_1', name: 'Práctica 1', maxScore: 100 },
    { id: 'act_2', name: 'Examen Parcial', maxScore: 100 }
  ]);
  const [partialScores, setPartialScores] = useState<Record<string, Record<string, number>>>(() => {
    const saved = localStorage.getItem('edugest_partial_scores');
    return saved ? JSON.parse(saved) : {};
  });
  const [newActivityName, setNewActivityName] = useState<string>('');

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

  // Helper para obtener el nombre completo del estudiante (soporta names, surnames, full_name, etc.)
  const getStudentFullName = (s: any) => {
    if (!s) return 'Estudiante';
    // 1. Campo oficial de la tabla 'students' de Supabase (names + surnames)
    if (s.names && String(s.names).trim()) {
      const surnames = [s.first_surname, s.second_surname, s.apellidos, s.last_name].filter(Boolean).join(' ');
      return surnames ? `${s.names} ${surnames}`.trim() : String(s.names).trim();
    }
    // 2. first_name / last_name
    if (s.first_name || s.last_name) {
      return `${s.first_name || ''} ${s.last_name || ''}`.trim();
    }
    // 3. full_name / name / nombre
    if (s.full_name && String(s.full_name).trim()) return String(s.full_name).trim();
    if (s.name && String(s.name).trim()) return String(s.name).trim();
    if (s.nombre_completo && String(s.nombre_completo).trim()) return String(s.nombre_completo).trim();
    if (s.nombre) {
      const ap = s.apellido || s.apellidos || '';
      return `${s.nombre} ${ap}`.trim();
    }
    return s.student_code || s.rne || (s.order_number ? `Estudiante #${s.order_number}` : 'Estudiante');
  };

  // Estudiantes del curso seleccionado
  const courseStudents = useMemo(() => {
    if (!selectedCourseId) return [];
    return (allStudents || [])
      .filter((s: any) => s.course_id === selectedCourseId || s.courseId === selectedCourseId)
      .sort((a: any, b: any) => getStudentFullName(a).localeCompare(getStudentFullName(b)));
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

  // Agregar nueva actividad parcial
  const handleAddActivity = () => {
    if (!newActivityName.trim()) return;
    const act = { id: `act_${Date.now()}`, name: newActivityName.trim(), maxScore: 100 };
    setPartialActivities((prev) => [...prev, act]);
    setNewActivityName('');
  };

  // Cambiar nota parcial de alumno
  const handlePartialScoreChange = (studentId: string, activityId: string, val: number) => {
    setPartialScores((prev) => {
      const studentScores = prev[studentId] || {};
      const updated = {
        ...prev,
        [studentId]: {
          ...studentScores,
          [activityId]: Math.min(100, Math.max(0, val))
        }
      };
      localStorage.setItem('edugens_partial_scores', JSON.stringify(updated));
      return updated;
    });
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

  const selectedCourseObj = availableCourses.find((c) => c.id === selectedCourseId);

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

          {/* SELECTOR DE CURSO Y FECHA */}
          <div className="flex flex-wrap items-center gap-3 bg-white/5 p-3 rounded-3xl border border-white/10 backdrop-blur-md">
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-1">
                Curso / Grado:
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-2xl border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
              >
                {availableCourses.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.grade} {c.section} ({c.level})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-1">
                Fecha:
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
                    <th className="px-6 py-4">#</th>
                    <th className="px-6 py-4">Estudiante</th>
                    <th className="px-6 py-4">RNE / Código</th>
                    <th className="px-6 py-4 text-center">Estado de Asistencia</th>
                    <th className="px-6 py-4">Nota u Observación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-main text-xs">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-text-muted font-bold">
                        {studentsLoading ? 'Cargando estudiantes...' : 'No hay alumnos registrados en este curso.'}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s: any, idx: number) => {
                      const currentStatus = attendanceState[s.id]?.status || 'presente';
                      return (
                        <tr key={s.id} className="hover:bg-brand-bg/60 transition-colors">
                          <td className="px-6 py-4 font-black text-text-muted">{idx + 1}</td>
                          <td className="px-6 py-4 font-bold text-text-main">
                            {getStudentFullName(s)}
                          </td>
                          <td className="px-6 py-4 font-mono text-[11px] text-text-muted">
                            {s.rne || s.student_code || '---'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleSetAttendance(s.id, 'presente')}
                                className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase transition-all cursor-pointer flex items-center gap-1 ${
                                  currentStatus === 'presente'
                                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                                    : 'bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-700'
                                }`}
                              >
                                <Check size={12} /> Presente
                              </button>

                              <button
                                onClick={() => handleSetAttendance(s.id, 'tardanza')}
                                className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase transition-all cursor-pointer flex items-center gap-1 ${
                                  currentStatus === 'tardanza'
                                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                                    : 'bg-slate-100 text-slate-500 hover:bg-amber-100 hover:text-amber-700'
                                }`}
                              >
                                <Clock size={12} /> Tardanza
                              </button>

                              <button
                                onClick={() => handleSetAttendance(s.id, 'excusa')}
                                className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase transition-all cursor-pointer flex items-center gap-1 ${
                                  currentStatus === 'excusa'
                                    ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
                                    : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700'
                                }`}
                              >
                                <Info size={12} /> Excusa
                              </button>

                              <button
                                onClick={() => handleSetAttendance(s.id, 'ausente')}
                                className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase transition-all cursor-pointer flex items-center gap-1 ${
                                  currentStatus === 'ausente'
                                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                                    : 'bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-700'
                                }`}
                              >
                                <XCircle size={12} /> Ausente
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4">
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
                              className="w-full px-3 py-1.5 rounded-xl border border-border-main bg-brand-bg text-xs outline-none focus:ring-2 focus:ring-brand-blue"
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

      {/* TAB 3: CALIFICACIONES PARCIALES */}
      {activeTab === 'partials' && (
        <div className="space-y-4">
          <div className="bg-surface p-4 rounded-3xl border border-border-main shadow-md flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Nueva Actividad (Ej. Quiz 2)..."
                value={newActivityName}
                onChange={(e) => setNewActivityName(e.target.value)}
                className="px-4 py-2 rounded-2xl border border-border-main bg-brand-bg text-xs outline-none focus:ring-2 focus:ring-brand-blue"
              />
              <button
                onClick={handleAddActivity}
                className="px-4 py-2 bg-brand-blue text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Añadir Columna
              </button>
            </div>

            <p className="text-xs font-bold text-text-muted">
              Ingresa las calificaciones continuas (0 a 100). El promedio parcial se calcula en tiempo real.
            </p>
          </div>

          <div className="bg-surface rounded-3xl border border-border-main shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900/60 border-b border-border-main text-[10px] font-black text-text-muted uppercase tracking-widest">
                    <th className="px-6 py-4">Estudiante</th>
                    {partialActivities.map((act) => (
                      <th key={act.id} className="px-4 py-4 text-center">
                        {act.name} (100)
                      </th>
                    ))}
                    <th className="px-6 py-4 text-center text-brand-blue">Promedio Parcial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-main text-xs">
                  {courseStudents.map((s: any) => {
                    const studentScores = partialScores[s.id] || {};
                    const scoresArr = Object.values(studentScores).filter((v) => typeof v === 'number');
                    const avg = scoresArr.length > 0 ? Math.round(scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length) : 0;

                    return (
                      <tr key={s.id} className="hover:bg-brand-bg/60 transition-colors">
                        <td className="px-6 py-4 font-bold text-text-main">
                          {getStudentFullName(s)}
                        </td>
                        {partialActivities.map((act) => (
                          <td key={act.id} className="px-4 py-4 text-center">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={studentScores[act.id] ?? ''}
                              onChange={(e) => handlePartialScoreChange(s.id, act.id, Number(e.target.value))}
                              className="w-16 text-center py-1 rounded-xl border border-border-main bg-brand-bg font-mono font-bold text-xs outline-none focus:ring-2 focus:ring-brand-blue"
                            />
                          </td>
                        ))}
                        <td className="px-6 py-4 text-center font-black text-sm">
                          <span className={`px-3 py-1 rounded-xl ${avg >= 70 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {avg}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
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

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {courseStudents.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => setFolderStudentId(s.id)}
                  className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
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
