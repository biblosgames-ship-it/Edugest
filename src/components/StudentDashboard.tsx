import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { dataService } from '../services/dataService';
import {
  Bell,
  Calendar as CalendarIcon,
  ClipboardList,
  Clock,
  MapPin,
  User,
  BookOpen,
  Activity,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { SEO } from './SEO';

export const StudentDashboard = ({ userData: profile }: { userData: any }) => {
  const { state, selectedYear } = useApp();
  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    // Si es padre y tiene cursos vinculados, por defecto cargar el primero
    if (profile?.role === 'parent') {
      const saved = localStorage.getItem('parent_course_ids');
      let localList: string[] = [];
      try {
        localList = saved ? JSON.parse(saved) : [];
      } catch {}
      const firstId = profile?.parent_course_ids?.[0] || localList?.[0] || '';
      return firstId || localStorage.getItem('selected_course_id') || '';
    }
    return (
      profile?.course_id || profile?.course_code || localStorage.getItem('selected_course_id') || ''
    );
  });

  const [parentCourseIds, setParentCourseIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('parent_course_ids');
      const localList = saved ? JSON.parse(saved) : [];
      return profile?.parent_course_ids || localList || [];
    } catch {
      return profile?.parent_course_ids || [];
    }
  });

  useEffect(() => {
    if (profile?.parent_course_ids) {
      setParentCourseIds(profile.parent_course_ids);
    }
  }, [profile?.parent_course_ids]);

  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [course, setCourse] = useState<any>(null);
  const [familyStudents, setFamilyStudents] = useState<any[]>([]);
  const hasCheckedSiblings = React.useRef(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Actualizar el reloj interno cada 30 segundos
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const currentDay = days[currentTime.getDay()];
  const currentTimeMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  const getMinutes = (time: string) => {
    if (!time) return 0;
    let [h, m] = time.split(':').map((s) => s.trim());
    let hours = parseInt(h);
    let minutes = parseInt(m.substring(0, 2));

    if (time.toUpperCase().includes('PM') && hours < 12) hours += 12;
    if (time.toUpperCase().includes('AM') && hours === 12) hours = 0;

    return hours * 60 + minutes;
  };

  const normalize = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  // Cargar cursos del centro
  useEffect(() => {
    const fetchCourses = async () => {
      if (!profile?.center_id) return;
      try {
        const data = await dataService.getCourses(profile.center_id, selectedYear || '2025-2026');
        setAllCourses(data || []);
      } catch (error) {
        console.error('Error loading center courses:', error);
      }
    };
    fetchCourses();
  }, [profile?.center_id, selectedYear]);

  // Autovinculación de cursos de hermanos para padres
  useEffect(() => {
    const autoLinkSiblings = async () => {
      if (profile?.role !== 'parent' || !profile.full_name || !profile.center_id || !allCourses.length) {
        return;
      }
      if (hasCheckedSiblings.current) return;

      try {
        // 1. Extraer nombre del alumno
        let studentNamePart = profile.full_name.toLowerCase();
        if (studentNamePart.includes('padre/madre') || studentNamePart.includes('tutor') || studentNamePart.includes('encargado')) {
          studentNamePart = studentNamePart
            .replace('(padre/madre)', '')
            .replace('(tutor)', '')
            .replace('(encargado)', '')
            .trim();
        }

        // 2. Buscar al alumno en el ciclo activo
        const { data: students, error: sErr } = await supabase
          .from('students')
          .select('id, names, first_surname, second_surname, family_id, course_id')
          .eq('center_id', profile.center_id)
          .eq('school_year', selectedYear || '2025-2026');

        if (sErr || !students) return;

        // Encontrar el alumno que coincida con el nombre en el perfil del padre
        const match = students.find((s) => {
          const fullName = `${s.names} ${s.first_surname} ${s.second_surname}`.toLowerCase().trim();
          return fullName.includes(studentNamePart) || studentNamePart.includes(s.names.toLowerCase());
        });

        if (!match) return;
        
        hasCheckedSiblings.current = true;

        if (!match.family_id) return;

        // 3. Obtener todos los hermanos que comparten el family_id
        const siblings = students.filter((s) => s.family_id === match.family_id);
        setFamilyStudents(siblings);

        const siblingCourseIds = siblings
          .map((s) => s.course_id)
          .filter(Boolean) as string[];

        // 4. Filtrar los cursos que aún no están vinculados en el perfil del padre
        const currentLinked = profile.parent_course_ids || parentCourseIds || [];
        const missingCourseIds = siblingCourseIds.filter(
          (cId) => !currentLinked.includes(cId)
        );

        if (missingCourseIds.length > 0) {
          const updatedIds = Array.from(new Set([...currentLinked, ...missingCourseIds]));
          
          console.log('[StudentDashboard] Autovinculando cursos de hermanos:', missingCourseIds);
          
          const { error: updErr } = await supabase
            .from('profiles')
            .update({ parent_course_ids: updatedIds })
            .eq('id', profile.id);

          if (!updErr) {
            localStorage.setItem('parent_course_ids', JSON.stringify(updatedIds));
            setParentCourseIds(updatedIds);
            profile.parent_course_ids = updatedIds;
          }
        }
      } catch (err) {
        console.error('Error auto-linking sibling courses:', err);
      }
    };

    autoLinkSiblings();
  }, [profile, allCourses, selectedYear]);

  // Sincronizar reactivamente si cambia en el perfil
  useEffect(() => {
    if (profile?.course_id) {
      setSelectedCourseId(profile.course_id);
    } else if (profile?.course_code) {
      setSelectedCourseId(profile.course_code);
    }
  }, [profile?.course_id, profile?.course_code]);

  useEffect(() => {
    if (selectedCourseId) {
      window.dispatchEvent(new CustomEvent('selectedCourseChanged', { detail: selectedCourseId }));
    }
  }, [selectedCourseId]);

  // Cargar detalles del curso seleccionado
  useEffect(() => {
    const fetchActiveCourseData = async () => {
      const activeId = selectedCourseId;
      if (!activeId) {
        setCourse(null);
        setTasks([]);
        setAnnouncements([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const coursesList =
          allCourses.length > 0
            ? allCourses
            : await dataService.getCourses(profile.center_id, selectedYear || '2025-2026');
        const currentCourse = coursesList.find(
          (c: any) => c.id === activeId || c.code === activeId
        );

        if (currentCourse) {
          setCourse(currentCourse);
          const [tasksData, annData] = await Promise.all([
            dataService.getTasks(currentCourse.id),
            dataService.getAnnouncements(currentCourse.id)
          ]);
          setTasks(tasksData);
          setAnnouncements(annData);
        }
      } catch (error) {
        console.error('Error loading active course data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (allCourses.length > 0 || selectedCourseId) {
      fetchActiveCourseData();
    } else {
      setLoading(false);
    }
  }, [selectedCourseId, allCourses, selectedYear, profile?.center_id]);

  const [isLinking, setIsLinking] = useState(false);

  const handleLinkCourse = async (courseId: string, isSilent = false) => {
    if (!profile?.id) return;
    try {
      setIsLinking(true);
      const { error } = await supabase
        .from('profiles')
        .update({ course_id: courseId })
        .eq('id', profile.id);

      if (error) {
        console.warn('Supabase profiles course_id update failed, saving locally:', error);
        localStorage.setItem('selected_course_id', courseId);
        setSelectedCourseId(courseId);
        if (!isSilent) alert('Curso guardado localmente en este dispositivo.');
      } else {
        localStorage.setItem('selected_course_id', courseId);
        setSelectedCourseId(courseId);

        // Actualizar perfil local en memoria
        profile.course_id = courseId;

        if (!isSilent) alert('¡Curso vinculado de forma permanente con éxito en Supabase!');
      }
    } catch (err) {
      console.error('Error linking course:', err);
      localStorage.setItem('selected_course_id', courseId);
      setSelectedCourseId(courseId);
    } finally {
      setIsLinking(false);
    }
  };

  const handleLinkParentCourse = async (courseId: string, isSilent = false) => {
    if (!profile?.id) return;
    if (parentCourseIds.includes(courseId)) return;

    const updatedIds = [...parentCourseIds, courseId];
    try {
      setIsLinking(true);
      const { error } = await supabase
        .from('profiles')
        .update({ parent_course_ids: updatedIds })
        .eq('id', profile.id);

      if (error) {
        console.warn('Failed to save parent_course_ids to Supabase, saving locally:', error);
        localStorage.setItem('parent_course_ids', JSON.stringify(updatedIds));
        setParentCourseIds(updatedIds);
        setSelectedCourseId(courseId);
        if (!isSilent) alert('Curso agregado localmente.');
      } else {
        localStorage.setItem('parent_course_ids', JSON.stringify(updatedIds));
        setParentCourseIds(updatedIds);
        setSelectedCourseId(courseId);
        profile.parent_course_ids = updatedIds;
        if (!isSilent) alert('¡Curso agregado y vinculado con éxito en Supabase!');
      }
    } catch (err) {
      console.error('Error adding parent course:', err);
      localStorage.setItem('parent_course_ids', JSON.stringify(updatedIds));
      setParentCourseIds(updatedIds);
      setSelectedCourseId(courseId);
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkParentCourse = async (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile?.id) return;
    const updatedIds = parentCourseIds.filter((id) => id !== courseId);
    try {
      setIsLinking(true);
      const { error } = await supabase
        .from('profiles')
        .update({ parent_course_ids: updatedIds })
        .eq('id', profile.id);

      if (error) {
        console.warn('Failed to unlink parent_course_ids from Supabase, saving locally:', error);
        localStorage.setItem('parent_course_ids', JSON.stringify(updatedIds));
        setParentCourseIds(updatedIds);
      } else {
        localStorage.setItem('parent_course_ids', JSON.stringify(updatedIds));
        setParentCourseIds(updatedIds);
        profile.parent_course_ids = updatedIds;
      }

      // Si el curso desvinculado era el activo, seleccionar otro
      if (selectedCourseId === courseId) {
        setSelectedCourseId(updatedIds[0] || '');
      }
      alert('Curso desvinculado.');
    } catch (err) {
      console.error('Error removing parent course:', err);
      localStorage.setItem('parent_course_ids', JSON.stringify(updatedIds));
      setParentCourseIds(updatedIds);
    } finally {
      setIsLinking(false);
    }
  };

  const linkedParentCourses = useMemo(() => {
    if (!parentCourseIds.length || !allCourses.length) return [];
    return allCourses.filter(
      (c) => parentCourseIds.includes(c.id) || parentCourseIds.includes(c.code)
    );
  }, [parentCourseIds, allCourses]);

  const suggestedCourse = useMemo(() => {
    if (!profile || !state.students || !allCourses.length) return null;
    const physicalStudent = state.students.find((s) => {
      const sName = normalize(s.name || s.full_name || '');
      let pName = profile.full_name ? normalize(profile.full_name) : '';

      // Limpiar sufijos parentales para emparejar nombre del padre/tutor con el alumno
      if (pName.includes('padre/madre') || pName.includes('tutor') || pName.includes('encargado')) {
        pName = pName
          .replace('(padre/madre)', '')
          .replace('(tutor)', '')
          .replace('(encargado)', '')
          .trim();
      }

      const sEmail = s.email ? s.email.toLowerCase().trim() : '';
      const pEmail = profile.email ? profile.email.toLowerCase().trim() : '';
      return (pName && sName === pName) || (pEmail && sEmail === pEmail);
    });
    if (!physicalStudent) return null;

    const cId = physicalStudent.course_id || physicalStudent.courseId;
    return allCourses.find((c) => c.id === cId || c.code === cId);
  }, [state.students, allCourses, profile]);

  // Autovinculación instantánea del nuevo curso al promover alumno
  useEffect(() => {
    if (!suggestedCourse) return;

    if (profile?.role === 'student') {
      const hasActiveCourseInCycle = allCourses.some((c) => c.id === selectedCourseId);
      if (!selectedCourseId || !hasActiveCourseInCycle) {
        console.log(
          '[StudentDashboard] Autovinculando estudiante al nuevo curso:',
          suggestedCourse.grade,
          suggestedCourse.section
        );
        handleLinkCourse(suggestedCourse.id, true);
      }
    } else if (profile?.role === 'parent') {
      const hasActiveCourseInCycle = linkedParentCourses.length > 0;
      if (!hasActiveCourseInCycle) {
        console.log(
          '[StudentDashboard] Autovinculando padre al nuevo curso de su hijo:',
          suggestedCourse.grade,
          suggestedCourse.section
        );
        handleLinkParentCourse(suggestedCourse.id, true);
      }
    }
  }, [suggestedCourse, selectedCourseId, allCourses, linkedParentCourses, profile?.role]);

  // Clases del curso programadas para el día de hoy
  const todaySchedule = useMemo(() => {
    if (!course) return [];
    const normCurrentDay = normalize(currentDay);

    return state.schedule
      .filter((entry) => {
        const courseId = entry.course_id || entry.courseId;
        if (courseId !== course.id) return false;

        const entryDay = entry.day || '';
        if (entryDay && normalize(entryDay) === normCurrentDay) return true;

        const tbId = entry.time_block_id || entry.timeBlockId;
        const tb = state.timeBlocks.find((b) => b.id === tbId);
        return tb && normalize(tb.day) === normCurrentDay;
      })
      .map((entry) => {
        const tbId = entry.time_block_id || entry.timeBlockId;
        const subId = entry.subject_id || entry.subjectId;
        const teaId = entry.teacher_id || entry.teacherId;

        const tb = state.timeBlocks.find((b) => b.id === tbId);
        const sub = state.subjects.find((s) => s.id === subId);
        const tea = state.teachers.find((t) => t.id === teaId);
        const room = state.rooms.find((r) => r.id === (entry.room_id || entry.roomId));

        const sTime = entry.start_time || entry.startTime || tb?.startTime || tb?.start_time || '';
        const eTime = entry.end_time || entry.endTime || tb?.endTime || tb?.end_time || '';

        const start = getMinutes(sTime);
        const end = getMinutes(eTime);
        const isNow = currentTimeMinutes >= start && currentTimeMinutes < end;
        const isNext = start > currentTimeMinutes;

        return { ...entry, tb, sub, tea, room, isNow, isNext, startMinutes: start, sTime, eTime };
      })
      .sort((a, b) => a.startMinutes - b.startMinutes);
  }, [
    course,
    state.schedule,
    state.timeBlocks,
    state.subjects,
    state.teachers,
    state.rooms,
    currentDay,
    currentTimeMinutes
  ]);

  const activeClassNow = useMemo(() => {
    return todaySchedule.find((c) => c.isNow);
  }, [todaySchedule]);

  const nextClass = useMemo(() => {
    return todaySchedule.find((c) => c.startMinutes > currentTimeMinutes);
  }, [todaySchedule, currentTimeMinutes]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-black text-slate-500 uppercase tracking-widest animate-pulse">
          Cargando tu aula virtual...
        </p>
      </div>
    );
  }

  if (!course) {
    const isParent = profile?.role === 'parent';
    return (
      <div className="space-y-6 max-w-xl mx-auto mt-10 animate-in fade-in slide-in-from-bottom-5 duration-300">
        {/* VINCULAR CURSO MEDIANTE CÓDIGO */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-6 w-full text-left">
          <div className="flex items-center gap-4 w-full">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
              <User size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-slate-900 uppercase">
                {isParent ? 'Vincular Grado de tu Hijo' : 'Vincular a tu Aula Virtual'}
              </h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                {isParent
                  ? 'Ingresa el código del curso de tu hijo para vincularlo'
                  : 'Ingresa el código de tu curso para acceder'}
              </p>
            </div>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const inputVal = (
                e.currentTarget.elements.namedItem('courseCodeInput') as HTMLInputElement
              ).value;
              const sanitized = inputVal.trim().toUpperCase().replace(/\s+/g, '');
              if (!sanitized) return;

              setIsLinking(true);
              try {
                const { data: course, error: fetchErr } = await supabase
                  .from('courses')
                  .select('id')
                  .eq('code', sanitized)
                  .maybeSingle();

                if (fetchErr || !course) {
                  alert('Código de curso inválido. Verifica e intenta de nuevo.');
                  setIsLinking(false);
                  return;
                }

                if (isParent) {
                  await handleLinkParentCourse(course.id);
                } else {
                  await handleLinkCourse(course.id);
                }
              } catch (err) {
                console.error('Error linking course:', err);
                alert('Ocurrió un error al procesar el código.');
                setIsLinking(false);
              }
            }}
            className="flex flex-col sm:flex-row items-center gap-3 w-full"
          >
            <input
              name="courseCodeInput"
              type="text"
              placeholder="Ej: GEN-5A"
              className="flex-1 w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-mono font-bold uppercase tracking-wider text-xs"
              required
            />
            <button
              type="submit"
              disabled={isLinking}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all shadow-md shrink-0 disabled:opacity-55"
            >
              {isLinking ? 'Vinculando...' : 'Vincular Curso'}
            </button>
          </form>
        </div>

        {suggestedCourse && (
          <div className="bg-emerald-50 border-2 border-emerald-300 p-6 rounded-[2.5rem] text-center shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-xl rounded-full"></div>
            <CheckCircle2 className="mx-auto mb-4 text-emerald-600 animate-bounce" size={48} />
            <h4 className="text-base font-black uppercase text-emerald-950 tracking-tight">
              ¿Estás en {suggestedCourse.grade} {suggestedCourse.section}?
            </h4>
            <p className="text-xs text-emerald-800 mt-2 leading-relaxed font-semibold">
              Hemos encontrado tu registro de alumno asignado a este grado en el centro. ¡Vincula tu
              cuenta permanentemente para entrar directamente!
            </p>
            <button
              onClick={() => {
                if (isParent) {
                  handleLinkParentCourse(suggestedCourse.id);
                } else {
                  handleLinkCourse(suggestedCourse.id);
                }
              }}
              disabled={isLinking}
              className="mt-5 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 cursor-pointer"
            >
              {isLinking ? 'Vinculando...' : 'Sí, Vincular de Forma Permanente'}
            </button>
          </div>
        )}

        <div className="p-12 text-center bg-white rounded-[3rem] border border-slate-100 shadow-2xl">
          <ClipboardList className="mx-auto mb-6 text-indigo-600 animate-pulse" size={64} />
          <h3 className="text-xl font-black text-slate-900 uppercase">
            {isParent ? 'Sin Curso del Hijo' : 'Sin Aula Virtual'}
          </h3>
          <p className="text-slate-500 mt-2 text-sm leading-relaxed">
            {isParent
              ? 'Por favor, selecciona el grado y sección de tu hijo en el listado superior para ver su muro de tareas, cronograma de clases de hoy y comunicados escolares.'
              : 'Aún no has seleccionado o vinculado tu grado. Por favor, selecciona tu curso del menú de arriba para poder ingresar y ver tus clases del día, tareas asignadas, anuncios y comunicados del centro.'}
          </p>
          <p className="text-[10px] text-slate-400 mt-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 font-bold uppercase tracking-wider">
            {isParent
              ? '💡 Como padre, puedes vincular y guardar los cursos de varios hijos para alternar entre sus tareas con un solo botón.'
              : '💡 Una vez vinculado tu curso, no tendrás que volver a seleccionarlo. Entrarás directo desde cualquier dispositivo.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 animate-fade-in">
      <SEO
        title={`Aula Virtual - ${course.grade} ${course.section}`}
        description="Muro virtual de tareas, anuncios y horarios para estudiantes."
      />

      {/* TABS DE HIJOS PARA PADRES */}
      {profile?.role === 'parent' && linkedParentCourses.length > 0 && (
        <div className="flex flex-wrap gap-2 animate-fade-in">
          {linkedParentCourses.map((c) => (
            <div key={c.id} className="relative group">
              <button
                onClick={() => setSelectedCourseId(c.id)}
                className={`flex items-center gap-3 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                  selectedCourseId === c.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                    : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-50 shadow-sm'
                }`}
              >
                <span>
                  {(() => {
                    const studentForCourse = familyStudents.find((s) => s.course_id === c.id);
                    return studentForCourse
                      ? `${studentForCourse.names.split(' ')[0]}: ${c.grade} "${c.section}"`
                      : `Hijo: ${c.grade} "${c.section}"`;
                  })()}
                </span>
                <span
                  className="text-[8px] bg-slate-150 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-md p-1 transition-all cursor-pointer"
                  onClick={(e) => handleUnlinkParentCourse(c.id, e)}
                  title="Desvincular curso"
                >
                  ✕
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ENCABEZADO DE CURSO */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] bg-indigo-50 px-4 py-1.5 rounded-full mb-3 inline-block">
            {profile?.role === 'parent' ? 'VISTA DEL PADRE' : 'MI AULA VIRTUAL'}
          </span>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">
            {course.grade} {course.section}
          </h1>
          <p className="text-slate-500 mt-2 font-bold text-sm uppercase tracking-widest flex items-center gap-2">
            <span>{course.level}</span>
            <span className="text-slate-300">•</span>
            <span>Tanda {course.tanda}</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {profile?.role === 'parent' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const inputVal = (
                  e.currentTarget.elements.namedItem('newCourseCode') as HTMLInputElement
                ).value;
                const sanitized = inputVal.trim().toUpperCase().replace(/\s+/g, '');
                if (!sanitized) return;

                setIsLinking(true);
                try {
                  // 1. Buscar en courses
                  const { data: course } = await supabase
                    .from('courses')
                    .select('id')
                    .ilike('code', sanitized)
                    .maybeSingle();

                  let targetCourseId = course?.id;

                  // 2. Si no está en courses, buscar en invitation_codes
                  if (!targetCourseId) {
                    const { data: invMatch } = await supabase
                      .from('invitation_codes')
                      .select('course_id')
                      .ilike('code', sanitized)
                      .maybeSingle();
                    if (invMatch?.course_id) {
                      targetCourseId = invMatch.course_id;
                    }
                  }

                  if (!targetCourseId) {
                    alert('Código de curso inválido o no encontrado.');
                    setIsLinking(false);
                    return;
                  }

                  await handleLinkParentCourse(targetCourseId);
                  (e.currentTarget.elements.namedItem('newCourseCode') as HTMLInputElement).value =
                    '';
                } catch (err) {
                  console.error('Error linking parent course:', err);
                  alert('Error al vincular el curso.');
                  setIsLinking(false);
                }
              }}
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <input
                name="newCourseCode"
                type="text"
                placeholder="Vincular otro hijo (Código)"
                className="w-full sm:w-56 p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-500 font-mono font-bold uppercase tracking-wider text-[10px]"
                required
              />
              <button
                type="submit"
                disabled={isLinking}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all shrink-0 disabled:opacity-50"
              >
                + Vincular
              </button>
            </form>
          )}

          {profile?.role !== 'parent' && profile?.course_id && (
            <span className="text-[8px] font-black text-indigo-700 bg-indigo-50 border border-indigo-150 px-3 py-2.5 rounded-xl uppercase tracking-widest shrink-0">
              ✓ Curso Vinculado
            </span>
          )}
        </div>
      </div>

      {/* MONITOR OPERATIVO EN VIVO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LADO IZQUIERDO: ACTIVIDAD EN TIEMPO REAL */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-200 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-4 h-full bg-indigo-600"></div>

            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-50">
              <h3 className="text-base font-black uppercase tracking-widest text-slate-900 flex items-center gap-3">
                <Activity className="text-indigo-600 animate-pulse" size={20} /> Mi Jornada de Hoy (
                {currentDay})
              </h3>
              <span className="text-[10px] font-black text-slate-500 flex items-center gap-2">
                <Clock size={12} className="text-indigo-600" />{' '}
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* CLASE ACTUAL EN VIVO */}
            {activeClassNow ? (
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-[2rem] p-6 mb-6 relative overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="absolute -top-3 right-6 px-4 py-1 bg-emerald-500 text-white rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm animate-pulse">
                  CLASE EN VIVO
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center font-black text-base shadow-md">
                    {activeClassNow.room?.name || 'A'}
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-emerald-700 uppercase tracking-widest">
                      AHORA MISMO
                    </span>
                    <h4 className="text-2xl font-black text-emerald-950 uppercase tracking-tight leading-tight mt-0.5">
                      {activeClassNow.sub?.name}
                    </h4>
                    <p className="text-xs font-bold text-emerald-600 uppercase flex items-center gap-2 mt-1">
                      <User size={12} /> Prof. {activeClassNow.tea?.name}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-6 text-center text-slate-500 font-bold text-xs italic">
                {todaySchedule.length > 0 &&
                currentTimeMinutes > todaySchedule[todaySchedule.length - 1].startMinutes
                  ? '🔔 Jornada de clases finalizada por hoy.'
                  : '☕ Sin clases programadas en este momento.'}
              </div>
            )}

            {/* TIMELINE DE HOY */}
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">
              Cronograma de Clases
            </h4>
            <div className="space-y-3">
              {todaySchedule.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold italic bg-slate-50 rounded-2xl text-[10px]">
                  No tienes clases presenciales programadas para hoy.
                </div>
              ) : (
                todaySchedule.map((c) => (
                  <div
                    key={c.id}
                    className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
                      c.isNow
                        ? 'bg-emerald-50 border-emerald-400 shadow-sm'
                        : 'bg-white border-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-10 rounded-lg flex items-center justify-center font-black text-xs ${c.isNow ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'}`}
                      >
                        {c.sTime}
                      </div>
                      <div>
                        <p
                          className={`text-sm font-black tracking-tight ${c.isNow ? 'text-emerald-950' : 'text-slate-900'}`}
                        >
                          {c.sub?.name}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                          <User size={10} /> {c.tea?.name}
                        </p>
                      </div>
                    </div>
                    {c.room && (
                      <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 uppercase">
                        <MapPin size={10} className="text-indigo-600" /> {c.room.name}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* LADO DERECHO: PRÓXIMA CLASE Y ESTADO */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 blur-xl rounded-full"></div>
            <h4 className="text-[8px] font-black uppercase tracking-widest opacity-60 mb-2">
              Próxima Clase
            </h4>
            {nextClass ? (
              <div>
                <p className="text-xl font-black tracking-tight uppercase leading-snug mb-3">
                  {nextClass.sub?.name}
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[10px] font-bold opacity-80 uppercase">
                    <Clock size={12} className="text-indigo-400" /> Hoy, {nextClass.sTime}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold opacity-80 uppercase">
                    <User size={12} className="text-indigo-400" /> {nextClass.tea?.name}
                  </div>
                  {nextClass.room && (
                    <div className="flex items-center gap-2 text-[10px] font-bold opacity-80 uppercase">
                      <MapPin size={12} className="text-indigo-400" /> Aula {nextClass.room.name}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs font-bold opacity-75 italic py-4">
                No hay más clases por hoy 🎉
              </p>
            )}
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl">
            <h4 className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-4">
              Resumen Escolar
            </h4>
            <div className="space-y-3 text-[10px] font-black uppercase tracking-widest">
              <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500">Tareas Pendientes</span>
                <span className="text-indigo-600">
                  {tasks.filter((t) => new Date(t.due_date) >= new Date()).length}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500">Anuncios del Mes</span>
                <span className="text-slate-900">{announcements.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* COMUNICADOS Y TAREAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* TAREAS PENDIENTES */}
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl">
          <h2 className="text-xl font-black mb-6 flex items-center gap-3 text-slate-900">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              <ClipboardList size={20} />
            </div>
            TAREAS Y ASIGNACIONES
          </h2>

          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {tasks.length === 0 ? (
              <div className="text-center py-16 bg-slate-50 rounded-2xl p-6 border-2 border-dashed border-slate-200">
                <CheckCircle2 className="mx-auto mb-4 text-emerald-500 animate-bounce" size={40} />
                <p className="text-xs font-black text-slate-950 uppercase tracking-widest">
                  ¡Estás al día!
                </p>
                <p className="text-slate-500 text-xs mt-1 font-medium">
                  No tienes tareas asignadas pendientes en este curso.
                </p>
              </div>
            ) : (
              tasks.map((t: any) => {
                const subject = state.subjects.find((s) => s.id === t.subject_id);
                const isLate = new Date(t.due_date) < new Date();
                return (
                  <div
                    key={t.id}
                    className="p-5 bg-white rounded-2xl border-2 border-slate-100 hover:border-indigo-200 transition-all shadow-md group relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div>
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-black uppercase tracking-widest">
                          {subject?.name || 'General'}
                        </span>
                        <h4 className="font-black text-slate-900 text-base mt-2 tracking-tight group-hover:text-indigo-600 transition-colors">
                          {t.title}
                        </h4>
                      </div>
                      <span
                        className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                          isLate
                            ? 'bg-rose-50 text-rose-500 border border-rose-100'
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        }`}
                      >
                        {isLate ? 'VENCIDA' : 'PENDIENTE'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4">{t.description}</p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {t.media_url && (
                        <a
                          href={t.media_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 rounded-lg text-[9px] font-black uppercase tracking-widest text-indigo-600 transition-all"
                        >
                          Ver recurso adjunto
                        </a>
                      )}
                      {t.link_url && (
                        <a
                          href={t.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 rounded-lg text-[9px] font-black uppercase tracking-widest text-indigo-600 transition-all"
                        >
                          Enlace de Drive / PDF
                        </a>
                      )}
                      {t.classroom_url && (
                        <a
                          href={t.classroom_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-lg text-[9px] font-black uppercase tracking-widest text-emerald-600 transition-all"
                        >
                          Entregar en Classroom
                        </a>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[9px] font-black text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span>LÍMITE DE ENTREGA:</span>
                      <span className={isLate ? 'text-rose-500' : 'text-slate-700'}>
                        {new Date(t.due_date).toLocaleDateString()}{' '}
                        {new Date(t.due_date).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COMUNICADOS RECIENTES */}
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl">
          <h2 className="text-xl font-black mb-6 flex items-center gap-3 text-slate-900">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shadow-sm">
              <Bell size={20} />
            </div>
            CIRCULARES Y ANUNCIOS
          </h2>

          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {announcements.length === 0 ? (
              <div className="text-center py-16 bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <p className="text-slate-400 italic text-[10px] font-bold uppercase tracking-widest">
                  No hay circulares recientes
                </p>
                <p className="text-slate-400 text-xs mt-1 font-medium">
                  Cualquier comunicado urgente aparecerá aquí.
                </p>
              </div>
            ) : (
              announcements.map((a: any) => {
                const subject = state.subjects.find((s) => s.id === a.subject_id);
                return (
                  <div
                    key={a.id}
                    className="p-5 bg-white rounded-2xl border-2 border-slate-100 hover:border-amber-200 transition-all shadow-md"
                  >
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <div>
                        {subject && (
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[8px] font-black uppercase tracking-widest">
                            {subject.name}
                          </span>
                        )}
                        <h4 className="font-black text-slate-900 text-base mt-2 tracking-tight">
                          {a.title}
                        </h4>
                      </div>
                      <span className="text-[8px] bg-slate-50 px-2 py-1 rounded-lg text-slate-400 font-black border border-slate-100">
                        {new Date(a.created_at || a.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4">{a.content}</p>

                    {a.link_url && (
                      <a
                        href={a.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-slate-50 hover:bg-amber-50 border border-slate-100 rounded-lg text-[9px] font-black uppercase tracking-widest text-amber-600 transition-all mb-4 inline-block"
                      >
                        Descargar Adjunto / circular
                      </a>
                    )}

                    <div className="pt-3 border-t border-slate-50 flex items-center gap-2">
                      <div className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-[8px] font-black uppercase">
                        {a.sender_role?.charAt(0) || 'D'}
                      </div>
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                        Publicado por {a.sender_role === 'teacher' ? 'Docente' : 'Dirección'}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
