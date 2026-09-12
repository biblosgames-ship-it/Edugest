import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Video,
  Link as LinkIcon,
  GraduationCap,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Bell,
  Search,
  Filter,
  Layers,
  ArrowLeft,
  FolderOpen,
  User,
  Sparkles,
  School
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dataService } from '../services/dataService';
import { LinkifiedText } from './LinkifiedText';
import { TaskDetailModal } from './TaskDetailModal';

interface StudentTasksModuleProps {
  userData: any;
  onViewChange?: (view: string) => void;
  initialSubjectId?: string;
}

export const StudentTasksModule: React.FC<StudentTasksModuleProps> = ({
  userData: profile,
  onViewChange,
  initialSubjectId
}) => {
  const { state, selectedYear } = useApp();

  const isParentRole = ['parent', 'padre', 'tutor', 'madre', 'familiar'].includes(
    profile?.role || ''
  );

  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [parentCourseIds, setParentCourseIds] = useState<string[]>(() => {
    try {
      const local = localStorage.getItem('parent_course_ids');
      const localList = local ? JSON.parse(local) : null;
      return profile?.parent_course_ids || localList || [];
    } catch {
      return profile?.parent_course_ids || [];
    }
  });

  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    const local = localStorage.getItem('selected_course_id');
    return profile?.course_id || profile?.course_code || local || '';
  });

  const [course, setCourse] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros de navegación
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    initialSubjectId || 'ALL'
  );
  const [activeTab, setActiveTab] = useState<'tasks' | 'announcements'>('tasks');
  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'P1' | 'P2' | 'P3' | 'P4'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'LATE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal de detalle de tarea
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<any | null>(null);

  // Cargar cursos del centro
  useEffect(() => {
    const fetchCourses = async () => {
      if (!profile?.center_id) return;
      try {
        const data = await dataService.getCourses(
          profile.center_id,
          selectedYear || '2026-2027'
        );
        setAllCourses(data || []);
      } catch (error) {
        console.error('[StudentTasksModule] Error loading center courses:', error);
      }
    };
    fetchCourses();
  }, [profile?.center_id, selectedYear]);

  // Cursos vinculados del padre
  const linkedParentCourses = useMemo(() => {
    if (!parentCourseIds.length || !allCourses.length) return [];
    return allCourses.filter(
      (c) => parentCourseIds.includes(c.id) || parentCourseIds.includes(c.code)
    );
  }, [parentCourseIds, allCourses]);

  // Sincronizar selección inicial de curso
  useEffect(() => {
    if (!selectedCourseId && allCourses.length > 0) {
      if (linkedParentCourses.length > 0) {
        setSelectedCourseId(linkedParentCourses[0].id);
      } else if (profile?.course_id) {
        setSelectedCourseId(profile.course_id);
      } else {
        setSelectedCourseId(allCourses[0].id);
      }
    }
  }, [allCourses, linkedParentCourses, selectedCourseId, profile?.course_id]);

  // Cargar tareas y anuncios del curso activo
  useEffect(() => {
    const fetchCourseData = async () => {
      if (!selectedCourseId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const coursesList =
          allCourses.length > 0
            ? allCourses
            : await dataService.getCourses(profile.center_id, selectedYear || '2026-2027');

        const currentCourse = coursesList.find(
          (c: any) => c.id === selectedCourseId || c.code === selectedCourseId
        );

        if (currentCourse) {
          setCourse(currentCourse);
          const [tasksData, annData] = await Promise.all([
            dataService.getTasks(currentCourse.id),
            dataService.getAnnouncements(currentCourse.id)
          ]);
          setTasks(tasksData || []);
          setAnnouncements(annData || []);
        }
      } catch (err) {
        console.error('[StudentTasksModule] Error fetching course tasks & announcements:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [selectedCourseId, allCourses, selectedYear, profile?.center_id]);

  // Lista consolidada de todas las materias del curso
  const courseSubjects = useMemo(() => {
    if (!course) return [];

    const subjectsMap = new Map<string, { subject: any; teacher?: any }>();

    // 1. Materias asignadas en el curso vía assignments
    const courseAssignments = (state.assignments || []).filter(
      (a: any) => a.course_id === course.id
    );

    courseAssignments.forEach((a: any) => {
      const sub = (state.subjects || []).find((s: any) => s.id === a.subject_id);
      const tea = (state.teachers || []).find((t: any) => t.id === a.teacher_id);
      if (sub) {
        subjectsMap.set(sub.id, { subject: sub, teacher: tea });
      }
    });

    // 2. Materias con tareas existentes en este curso
    tasks.forEach((t: any) => {
      if (t.subject_id && !subjectsMap.has(t.subject_id)) {
        const sub = (state.subjects || []).find((s: any) => s.id === t.subject_id);
        if (sub) {
          const assign = (state.assignments || []).find(
            (a: any) => a.course_id === course.id && a.subject_id === sub.id
          );
          const tea = assign ? (state.teachers || []).find((tc: any) => tc.id === assign.teacher_id) : undefined;
          subjectsMap.set(sub.id, { subject: sub, teacher: tea });
        }
      }
    });

    // 3. Materias con anuncios existentes en este curso
    announcements.forEach((a: any) => {
      if (a.subject_id && !subjectsMap.has(a.subject_id)) {
        const sub = (state.subjects || []).find((s: any) => s.id === a.subject_id);
        if (sub) {
          const assign = (state.assignments || []).find(
            (asg: any) => asg.course_id === course.id && asg.subject_id === sub.id
          );
          const tea = assign ? (state.teachers || []).find((tc: any) => tc.id === assign.teacher_id) : undefined;
          subjectsMap.set(sub.id, { subject: sub, teacher: tea });
        }
      }
    });

    // 4. Fallback si no hay asignaciones: materias según el nivel del curso
    if (subjectsMap.size === 0) {
      const cLvl = (course.level || '').toLowerCase().substring(0, 5);
      const matching = (state.subjects || []).filter((s: any) =>
        cLvl ? (s.level || '').toLowerCase().includes(cLvl) : true
      );
      matching.forEach((sub: any) => {
        subjectsMap.set(sub.id, { subject: sub });
      });
    }

    // Ordenar de forma curricular amigable
    const result = Array.from(subjectsMap.values());
    result.sort((a, b) => {
      const getPriority = (name: string = '') => {
        const n = name.toLowerCase();
        if (n.includes('lengua')) return 1;
        if (n.includes('matemát')) return 2;
        if (n.includes('social')) return 3;
        if (n.includes('natur')) return 4;
        if (n.includes('inglés') || n.includes('ingles')) return 5;
        if (n.includes('física') || n.includes('fisica')) return 6;
        if (n.includes('artíst') || n.includes('artist')) return 7;
        if (n.includes('fihr') || n.includes('human')) return 8;
        return 99;
      };
      return getPriority(a.subject?.name) - getPriority(b.subject?.name);
    });

    return result;
  }, [course, state.assignments, state.subjects, state.teachers, tasks, announcements]);

  // Contadores por materia
  const subjectStats = useMemo(() => {
    const stats: Record<string, { totalTasks: number; pendingTasks: number; announcements: number }> = {};

    courseSubjects.forEach(({ subject }) => {
      const subTasks = tasks.filter((t: any) => t.subject_id === subject.id);
      const pending = subTasks.filter((t: any) => !t.due_date || new Date(t.due_date) >= new Date()).length;
      const subAnnouncements = announcements.filter((a: any) => a.subject_id === subject.id);

      stats[subject.id] = {
        totalTasks: subTasks.length,
        pendingTasks: pending,
        announcements: subAnnouncements.length
      };
    });

    return stats;
  }, [courseSubjects, tasks, announcements]);

  // Total global
  const globalStats = useMemo(() => {
    const pending = tasks.filter((t: any) => !t.due_date || new Date(t.due_date) >= new Date()).length;
    return {
      totalTasks: tasks.length,
      pendingTasks: pending,
      announcements: announcements.length
    };
  }, [tasks, announcements]);

  // Materia activa
  const activeSubjectData = useMemo(() => {
    if (selectedSubjectId === 'ALL') return null;
    return courseSubjects.find((item) => item.subject.id === selectedSubjectId) || null;
  }, [selectedSubjectId, courseSubjects]);

  // Tareas filtradas para la materia activa (o todas) y con filtros aplicados
  const displayedTasks = useMemo(() => {
    let list = tasks;

    if (selectedSubjectId !== 'ALL') {
      list = list.filter((t: any) => t.subject_id === selectedSubjectId);
    }

    if (periodFilter !== 'ALL') {
      list = list.filter((t: any) => (t.period || 'P1').toUpperCase() === periodFilter);
    }

    if (statusFilter === 'PENDING') {
      list = list.filter((t: any) => !t.due_date || new Date(t.due_date) >= new Date());
    } else if (statusFilter === 'LATE') {
      list = list.filter((t: any) => t.due_date && new Date(t.due_date) < new Date());
    }

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      list = list.filter(
        (t: any) =>
          (t.title || '').toLowerCase().includes(query) ||
          (t.description || '').toLowerCase().includes(query)
      );
    }

    // Ordenar: pendientes primero, luego por fecha más próxima
    return [...list].sort((a: any, b: any) => {
      const dateA = a.due_date ? new Date(a.due_date).getTime() : 0;
      const dateB = b.due_date ? new Date(b.due_date).getTime() : 0;
      return dateB - dateA;
    });
  }, [tasks, selectedSubjectId, periodFilter, statusFilter, searchTerm]);

  // Anuncios filtrados para la materia activa (o todos)
  const displayedAnnouncements = useMemo(() => {
    let list = announcements;

    if (selectedSubjectId !== 'ALL') {
      list = list.filter((a: any) => a.subject_id === selectedSubjectId);
    }

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      list = list.filter(
        (a: any) =>
          (a.title || '').toLowerCase().includes(query) ||
          (a.content || '').toLowerCase().includes(query)
      );
    }

    return list;
  }, [announcements, selectedSubjectId, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Modal de Detalle Completo de Tarea */}
      {selectedTaskForModal && (
        <TaskDetailModal
          task={selectedTaskForModal}
          subjectName={
            (state.subjects || []).find((s: any) => s.id === selectedTaskForModal.subject_id)?.name ||
            'Materia General'
          }
          teacherName={
            activeSubjectData?.teacher?.name ||
            activeSubjectData?.teacher?.full_name ||
            (state.teachers || []).find((tc: any) => {
              const assign = (state.assignments || []).find(
                (a: any) => a.course_id === course?.id && a.subject_id === selectedTaskForModal.subject_id
              );
              return assign && tc.id === assign.teacher_id;
            })?.name
          }
          onClose={() => setSelectedTaskForModal(null)}
        />
      )}

      {/* ENCABEZADO PRINCIPAL DEL MÓDULO */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-indigo-500/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-indigo-500/30 text-indigo-300 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-400/20 flex items-center gap-1.5">
                <BookOpen size={12} />
                Portal Escolar del Alumno
              </span>
              {course && (
                <span className="px-3 py-1 bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10">
                  {course.grade} {course.section ? `"${course.section}"` : ''} • {course.level || 'Secundaria'}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              MÓDULO DE TAREAS Y MATERIAS
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200/80 font-medium max-w-2xl">
              Explora tus asignaciones organizadas por materia, lee las instrucciones completas y consulta los avisos que tus profesores publican para cada área.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Selector de Cursos de Hermanos (Padres) */}
            {isParentRole && linkedParentCourses.length > 1 && (
              <div className="bg-white/10 p-1.5 rounded-2xl border border-white/10 flex items-center gap-2">
                <School size={14} className="text-indigo-300 ml-2" />
                <select
                  value={selectedCourseId}
                  onChange={(e) => {
                    setSelectedCourseId(e.target.value);
                    localStorage.setItem('selected_course_id', e.target.value);
                    setSelectedSubjectId('ALL');
                  }}
                  className="bg-transparent text-white font-bold text-xs p-1.5 rounded-xl outline-none cursor-pointer"
                >
                  {linkedParentCourses.map((c) => (
                    <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                      {c.grade} "{c.section}" ({c.level})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {onViewChange && (
              <button
                type="button"
                onClick={() => onViewChange('dashboard')}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <ArrowLeft size={14} />
                Volver a Mi Aula
              </button>
            )}
          </div>
        </div>

        {/* Resumen de Métricas Rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-2xl border border-white/5">
            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300 block mb-1">
              Materias Activas
            </span>
            <span className="text-xl font-black text-white">{courseSubjects.length}</span>
          </div>
          <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-2xl border border-white/5">
            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300 block mb-1">
              Tareas Pendientes
            </span>
            <span className="text-xl font-black text-amber-400">{globalStats.pendingTasks}</span>
          </div>
          <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-2xl border border-white/5">
            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300 block mb-1">
              Total de Tareas
            </span>
            <span className="text-xl font-black text-white">{globalStats.totalTasks}</span>
          </div>
          <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-2xl border border-white/5">
            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300 block mb-1">
              Anuncios del Curso
            </span>
            <span className="text-xl font-black text-indigo-200">{globalStats.announcements}</span>
          </div>
        </div>
      </div>

      {/* CLASIFICACIÓN POR MATERIAS (SELECTOR Y GRID) */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Layers size={18} className="text-indigo-600" />
              MATERIAS Y ÁREAS DE APRENDIZAJE
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Selecciona una materia para ver sus tareas asignadas y los avisos de su profesor.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSelectedSubjectId('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
              selectedSubjectId === 'ALL'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Ver Todas las Materias ({globalStats.totalTasks})
          </button>
        </div>

        {/* Carrusel / Grid de Materias */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 pt-2">
          {/* Tarjeta General: Todas */}
          <div
            onClick={() => setSelectedSubjectId('ALL')}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
              selectedSubjectId === 'ALL'
                ? 'bg-indigo-50/70 border-indigo-600 shadow-md scale-[1.01]'
                : 'bg-slate-50/60 border-slate-200/80 hover:border-indigo-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-sm">
                <BookOpen size={18} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-indigo-600">
                General
              </span>
            </div>

            <div>
              <h3 className="font-black text-slate-900 text-sm tracking-tight mb-1">
                Todas las Materias
              </h3>
              <p className="text-[11px] text-slate-500 font-medium line-clamp-1">
                Vista general de todas las áreas
              </p>
            </div>

            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200/60 text-[10px] font-black uppercase tracking-wider text-slate-600">
              <span className="text-amber-600 font-black">{globalStats.pendingTasks} pendientes</span>
              <span>•</span>
              <span>{globalStats.announcements} avisos</span>
            </div>
          </div>

          {/* Tarjetas individuales de materias */}
          {courseSubjects.map(({ subject, teacher }) => {
            const stats = subjectStats[subject.id] || { totalTasks: 0, pendingTasks: 0, announcements: 0 };
            const isSelected = selectedSubjectId === subject.id;

            return (
              <div
                key={subject.id}
                onClick={() => setSelectedSubjectId(subject.id)}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-50/70 border-indigo-600 shadow-md scale-[1.01]'
                    : 'bg-white border-slate-200/80 hover:border-indigo-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs uppercase shadow-sm">
                    {subject.name.substring(0, 2)}
                  </div>
                  {stats.pendingTasks > 0 ? (
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 animate-pulse">
                      {stats.pendingTasks} pendiente{stats.pendingTasks === 1 ? '' : 's'}
                    </span>
                  ) : (
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-slate-50 text-slate-400 border border-slate-200">
                      Al día
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-black text-slate-900 text-sm tracking-tight leading-snug line-clamp-2 mb-1">
                    {subject.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 truncate">
                    <User size={12} className="text-indigo-600 shrink-0" />
                    {teacher ? (teacher.name || teacher.full_name) : 'Docente asignado'}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100 text-[10px] font-black uppercase tracking-wider">
                  <span className="text-indigo-600 font-bold">
                    {stats.totalTasks} tarea{stats.totalTasks === 1 ? '' : 's'}
                  </span>
                  <span className="text-slate-400">
                    {stats.announcements} anuncio{stats.announcements === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CONTENIDO DE LA MATERIA SELECCIONADA (O TODAS) */}
      <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 shadow-xl space-y-6">
        {/* Banner de la materia activa */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-indigo-600 text-white rounded-md text-[9px] font-black uppercase tracking-widest">
                {selectedSubjectId === 'ALL' ? 'Todas las áreas' : 'Materia Seleccionada'}
              </span>
              {activeSubjectData?.teacher && (
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <User size={13} className="text-indigo-600" />
                  Prof. {activeSubjectData.teacher.name || activeSubjectData.teacher.full_name}
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {selectedSubjectId === 'ALL' ? 'Todas las Materias' : activeSubjectData?.subject.name}
            </h2>
          </div>

          {/* Switcher de Pestañas: Tareas vs Anuncios */}
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'tasks'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <BookOpen size={14} />
              Tareas ({displayedTasks.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('announcements')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'announcements'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Bell size={14} />
              Anuncios del Área ({displayedAnnouncements.length})
            </button>
          </div>
        </div>

        {/* BARRA DE FILTROS Y BÚSQUEDA */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          {/* Búsqueda */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                activeTab === 'tasks'
                  ? 'Buscar por título o palabras clave de la tarea...'
                  : 'Buscar en comunicados y avisos...'
              }
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
            />
          </div>

          {/* Filtros específicos de Tareas */}
          {activeTab === 'tasks' && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Filtro por Período */}
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                {(['ALL', 'P1', 'P2', 'P3', 'P4'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriodFilter(p)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      periodFilter === p
                        ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {p === 'ALL' ? 'Todos P.' : p}
                  </button>
                ))}
              </div>

              {/* Filtro por Estado */}
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    statusFilter === 'ALL'
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('PENDING')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    statusFilter === 'PENDING'
                      ? 'bg-emerald-50 text-emerald-700 font-black shadow-sm border border-emerald-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Pendientes
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('LATE')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    statusFilter === 'LATE'
                      ? 'bg-rose-50 text-rose-700 font-black shadow-sm border border-rose-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Vencidas
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SECCIÓN 1: LISTADO DE TAREAS */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {displayedTasks.length === 0 ? (
              <div className="text-center py-16 bg-slate-50/80 rounded-3xl p-8 border-2 border-dashed border-slate-200">
                <CheckCircle2 size={44} className="mx-auto mb-3 text-emerald-500" />
                <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">
                  {searchTerm
                    ? 'No se encontraron tareas con esa búsqueda'
                    : selectedSubjectId === 'ALL'
                    ? '¡No hay tareas pendientes en ninguna materia!'
                    : `No hay tareas asignadas para ${activeSubjectData?.subject.name || 'esta materia'}`}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  {searchTerm
                    ? 'Intenta con otro término o limpia el buscador.'
                    : 'Cuando el profesor publique una nueva asignación o deber escolar, aparecerá aquí con todas sus instrucciones y enlaces.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedTasks.map((t: any) => {
                  const subject = (state.subjects || []).find((s: any) => s.id === t.subject_id);
                  const isLate = t.due_date && new Date(t.due_date) < new Date();
                  const cleanDesc = (t.description || '').replace(/<!--period:P[1-4]-->\s*/gi, '').trim();

                  return (
                    <div
                      key={t.id}
                      className="p-5 bg-white rounded-2xl border-2 border-slate-100 hover:border-indigo-200 transition-all shadow-sm hover:shadow-md flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        {/* Header de la tarjeta */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-[9px] font-black uppercase tracking-wider">
                              {subject?.name || 'General'}
                            </span>
                            {t.period && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-wider">
                                {t.period}
                              </span>
                            )}
                          </div>

                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                              isLate
                                ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            }`}
                          >
                            {isLate ? 'VENCIDA' : 'PENDIENTE'}
                          </span>
                        </div>

                        {/* Título de la tarea */}
                        <h4 className="font-black text-slate-900 text-base tracking-tight leading-snug">
                          {t.title}
                        </h4>

                        {/* Fecha Límite */}
                        {t.due_date && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold">
                            <Calendar size={13} className="text-indigo-600" />
                            <span>Entrega:</span>
                            <span className="text-slate-800">
                              {new Date(t.due_date).toLocaleDateString('es-ES', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short'
                              })}
                            </span>
                          </div>
                        )}

                        {/* DESCRIPCIÓN COMPLETA (Con enlaces activos, sin cortar texto) */}
                        {cleanDesc && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                            <LinkifiedText text={cleanDesc} className="text-xs" allowExpand={true} />
                          </div>
                        )}
                      </div>

                      {/* Botones de acción y recursos */}
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {t.media_url && (
                            <a
                              href={t.media_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-wider text-indigo-600 flex items-center gap-1 transition-colors"
                            >
                              <Video size={11} /> Video
                            </a>
                          )}
                          {t.link_url && (
                            <a
                              href={t.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-wider text-indigo-600 flex items-center gap-1 transition-colors"
                            >
                              <LinkIcon size={11} /> Drive / Archivo
                            </a>
                          )}
                          {t.classroom_url && (
                            <a
                              href={t.classroom_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-[9px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1 transition-colors"
                            >
                              <GraduationCap size={11} /> Classroom
                            </a>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedTaskForModal(t)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 active:scale-95"
                        >
                          Ver detalle completo <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SECCIÓN 2: ANUNCIOS Y CIRCULARES DEL ÁREA */}
        {activeTab === 'announcements' && (
          <div className="space-y-4">
            {displayedAnnouncements.length === 0 ? (
              <div className="text-center py-16 bg-slate-50/80 rounded-3xl p-8 border-2 border-dashed border-slate-200">
                <Bell size={44} className="mx-auto mb-3 text-amber-500" />
                <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">
                  {selectedSubjectId === 'ALL'
                    ? 'No hay comunicados publicados para este curso'
                    : `No hay avisos publicados aún para ${activeSubjectData?.subject.name || 'esta área'}`}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Cualquier circular, recordatorio o aviso que publiquen los maestros del área se notificará aquí con todos sus detalles.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {displayedAnnouncements.map((a: any) => {
                  const subject = (state.subjects || []).find((s: any) => s.id === a.subject_id);

                  return (
                    <div
                      key={a.id}
                      className="p-6 bg-white rounded-2xl border-2 border-slate-100 hover:border-amber-200 transition-all shadow-sm space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-50">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-[9px] font-black uppercase tracking-widest">
                            {subject?.name || 'Aviso General'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {new Date(a.created_at || a.timestamp).toLocaleDateString('es-ES', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-[9px] font-black uppercase">
                            {a.sender_role?.charAt(0) || 'D'}
                          </div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            Publicado por {a.sender_role === 'teacher' ? 'Docente del Área' : 'Dirección'}
                          </span>
                        </div>
                      </div>

                      <h3 className="text-lg font-black text-slate-900 tracking-tight">
                        {a.title}
                      </h3>

                      {/* Contenido completo del anuncio con enlaces */}
                      <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 text-xs">
                        <LinkifiedText text={a.content} className="text-xs leading-relaxed" />
                      </div>

                      {/* Adjunto si existe */}
                      {a.link_url && (
                        <a
                          href={a.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 transition-colors"
                        >
                          <ExternalLink size={13} />
                          Descargar Documento / Circular Adjunta
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
