import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  BookOpen,
  Users,
  Clock,
  ArrowRight,
  Activity,
  MapPin,
  User,
  Calendar,
  AlertCircle,
  Timer,
  CheckCircle2,
  ChevronDown,
  Info
} from 'lucide-react';
import { SEO } from './SEO';
import { TeacherDashboard } from './TeacherDashboard';
import { StudentDashboard } from './StudentDashboard';

export const ControlDashboard = () => {
  const { state, center } = useApp();
  const [mode, setMode] = useState<'course' | 'teacher'>('course');
  const [selectedId, setSelectedId] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTanda, setActiveTanda] = useState<'Matutina' | 'Vespertina' | 'Todas'>(
    new Date().getHours() < 13 ? 'Matutina' : 'Vespertina'
  );

  const [courseTab, setCourseTab] = useState<'live' | 'student-view'>('live');
  const [teacherTab, setTeacherTab] = useState<'live' | 'teacher-view'>('live');

  useEffect(() => {
    setCourseTab('live');
    setTeacherTab('live');
  }, [selectedId, mode]);

  // Actualizar el reloj interno cada minuto para que el "En Vivo" sea real
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const currentDay = days[currentTime.getDay()];

  // Normalizar texto para comparaciones seguras (sin tildes, minúsculas)
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const currentTimeMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  const getMinutes = (time: string) => {
    if (!time) return 0;
    // Manejar formato "08:00 AM" o "01:00 PM"
    let [h, m] = time.split(':').map((s) => s.trim());
    let hours = parseInt(h);
    let minutes = parseInt(m.substring(0, 2));

    if (time.toUpperCase().includes('PM') && hours < 12) hours += 12;
    if (time.toUpperCase().includes('AM') && hours === 12) hours = 0;

    return hours * 60 + minutes;
  };

  // 1. Filtrar el horario para HOY (Normalizado y por TANDA)
  const todaySchedule = useMemo(() => {
    const normCurrentDay = normalize(currentDay);
    return state.schedule.filter((entry) => {
      const courseId = entry.course_id || entry.courseId;
      const course = state.courses.find((c) => c.id === courseId);
      if (!course) return false;

      // Filtrado por Tanda
      if (activeTanda !== 'Todas') {
        if (activeTanda === 'Matutina') {
          if (course.tanda !== 'Matutina' && course.tanda !== 'Extendida') return false;
        } else if (activeTanda === 'Vespertina') {
          if (course.tanda !== 'Vespertina') return false;
        }
      }

      // USAR DATOS DIRECTOS DEL HORARIO (MÁS ROBUSTO)
      const entryDay = entry.day || '';
      if (entryDay && normalize(entryDay) === normCurrentDay) return true;

      const tbId = entry.time_block_id || entry.timeBlockId;
      const tb = state.timeBlocks.find((b) => b.id === tbId);
      return tb && normalize(tb.day) === normCurrentDay;
    });
  }, [state.schedule, state.timeBlocks, state.courses, currentDay, activeTanda]);

  // 2. Clases activas en este momento
  const activeClassesNow = useMemo(() => {
    return todaySchedule
      .filter((e) => {
        const sTime = e.start_time || e.startTime;
        const eTime = e.end_time || e.endTime;

        if (sTime && eTime) {
          const start = getMinutes(sTime);
          const end = getMinutes(eTime);
          return currentTimeMinutes >= start && currentTimeMinutes < end;
        }

        const tbId = e.time_block_id || e.timeBlockId;
        const tb = state.timeBlocks.find((b) => b.id === tbId);
        const start = getMinutes(tb?.startTime || tb?.start_time || '');
        const end = getMinutes(tb?.endTime || tb?.end_time || '');
        return currentTimeMinutes >= start && currentTimeMinutes < end;
      })
      .map((e) => {
        const subId = e.subject_id || e.subjectId;
        const teaId = e.teacher_id || e.teacherId;
        const sub = state.subjects.find((s) => s.id === subId);
        const tea = state.teachers.find((t) => t.id === teaId);
        const courseId = e.course_id || e.courseId;
        const course = state.courses.find((c) => c.id === courseId);
        const roomId = e.room_id || e.roomId;
        const room = state.rooms.find((r) => r.id === roomId);
        return { ...e, sub, tea, course, room };
      });
  }, [todaySchedule, state, currentTimeMinutes]);

  // 3. Lógica para vista de Curso
  const courseData = useMemo(() => {
    if (mode !== 'course' || !selectedId) return null;
    const course = state.courses.find((c) => c.id === selectedId);
    if (!course) return null;

    const classes = todaySchedule
      .filter((e) => (e.course_id || e.courseId) === selectedId)
      .map((e) => {
        const tbId = e.time_block_id || e.timeBlockId;
        const subId = e.subject_id || e.subjectId;
        const teaId = e.teacher_id || e.teacherId;

        const tb = state.timeBlocks.find((b) => b.id === tbId);
        const sub = state.subjects.find((s) => s.id === subId);
        const tea = state.teachers.find((t) => t.id === teaId);
        const room = state.rooms.find((r) => r.id === (e.room_id || e.roomId));

        const sTime = e.start_time || e.startTime || tb?.startTime || tb?.start_time || '';
        const eTime = e.end_time || e.endTime || tb?.endTime || tb?.end_time || '';

        const start = getMinutes(sTime);
        const end = getMinutes(eTime);
        const isNow = currentTimeMinutes >= start && currentTimeMinutes < end;
        const isNext = start > currentTimeMinutes;

        return { ...e, tb, sub, tea, room, isNow, isNext, startMinutes: start, sTime, eTime };
      })
      .sort((a, b) => a.startMinutes - b.startMinutes);

    return { course, classes };
  }, [mode, selectedId, todaySchedule, state, currentTimeMinutes]);

  // 4. Lógica para vista de Docente
  const teacherData = useMemo(() => {
    if (mode !== 'teacher' || !selectedId) return null;
    const teacher = state.teachers.find((t) => t.id === selectedId);
    if (!teacher) return null;

    const teacherSchedule = todaySchedule
      .filter((e) => (e.teacher_id || e.teacherId) === selectedId)
      .map((e) => {
        const tbId = e.time_block_id || e.timeBlockId;
        const subId = e.subject_id || e.subjectId;
        const courseId = e.course_id || e.courseId;

        const tb = state.timeBlocks.find((b) => b.id === tbId);
        const sub = state.subjects.find((s) => s.id === subId);
        const course = state.courses.find((c) => c.id === courseId);
        const room = state.rooms.find((r) => r.id === (e.room_id || e.roomId));

        const sTime = e.start_time || e.startTime || tb?.startTime || tb?.start_time || '';
        const eTime = e.end_time || e.endTime || tb?.endTime || tb?.end_time || '';

        const start = getMinutes(sTime);
        const end = getMinutes(eTime);
        const isNow = currentTimeMinutes >= start && currentTimeMinutes < end;

        return {
          ...e,
          tb,
          sub,
          course,
          room,
          isNow,
          startMinutes: start,
          endMinutes: end,
          sTime,
          eTime
        };
      })
      .sort((a, b) => a.startMinutes - b.startMinutes);

    const currentClass = teacherSchedule.find((c) => c.isNow);
    const nextClass = teacherSchedule.find((c) => c.startMinutes > currentTimeMinutes);

    const busyBlocks = teacherSchedule.map((c) => c.time_block_id || c.timeBlockId);
    const availableBlocks = state.timeBlocks
      .filter((tb) => normalize(tb.day) === normalize(currentDay) && !busyBlocks.includes(tb.id))
      .sort(
        (a, b) => getMinutes(a.startTime || a.start_time) - getMinutes(b.startTime || b.start_time)
      );

    return { teacher, currentClass, nextClass, availableBlocks, teacherSchedule };
  }, [mode, selectedId, todaySchedule, state, currentDay, currentTimeMinutes]);

  const mockStudentProfile = useMemo(() => {
    if (!courseData) return null;
    return {
      id: `mock-student-${courseData.course.id}`,
      role: 'student',
      course_id: courseData.course.id,
      course_code: courseData.course.code || courseData.course.id,
      center_id: courseData.course.center_id || center?.id || '',
      full_name: `Estudiante de ${courseData.course.grade}`
    };
  }, [courseData, center]);

  const mockTeacherProfile = useMemo(() => {
    if (!teacherData) return null;
    return {
      id: `mock-teacher-${teacherData.teacher.id}`,
      role: 'teacher',
      teacher_id: teacherData.teacher.id,
      full_name: teacherData.teacher.name,
      center_id: teacherData.teacher.center_id || center?.id || '',
      email: teacherData.teacher.email
    };
  }, [teacherData, center]);

  // 5. Docentes Libres
  const freeTeachers = useMemo(() => {
    const busyTeacherIds = new Set(
      activeClassesNow.map((c) => c.teacher_id || c.teacherId).filter(Boolean)
    );
    return state.teachers.filter(
      (t) => (t.role === 'teacher' || t.role === 'management_teacher') && !busyTeacherIds.has(t.id)
    );
  }, [state.teachers, activeClassesNow]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <SEO
        title="Modo Control"
        description="Monitoreo en tiempo real de la actividad escolar por curso y docente."
      />

      {/* HEADER DE ESTADO COMPACTO */}
      <div className="bg-white rounded-[2rem] p-6 text-slate-900 relative overflow-hidden border-2 border-brand-blue shadow-lg">
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-blue text-white rounded-2xl flex items-center justify-center shadow-lg shadow-brand-blue/20">
              <Activity className="animate-pulse" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tighter uppercase text-slate-900 leading-none">
                Torre de Control
              </h2>
              <p className="text-slate-500 font-black uppercase text-[8px] tracking-[0.2em] flex items-center gap-2 mt-1">
                <Calendar size={12} className="text-brand-blue" /> {currentDay}{' '}
                <span className="text-slate-300">|</span>{' '}
                <Clock size={12} className="text-brand-blue" />{' '}
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="bg-emerald-50 border-2 border-emerald-100 px-6 py-3 rounded-2xl text-center shadow-sm">
              <p className="text-[8px] font-black uppercase text-emerald-700 tracking-[0.1em] mb-0.5">
                Clases en Vivo
              </p>
              <p className="text-xl font-black text-emerald-900">{activeClassesNow.length}</p>
            </div>
            <div className="bg-slate-50 border-2 border-slate-100 px-6 py-3 rounded-2xl text-center shadow-sm">
              <p className="text-[8px] font-black uppercase text-slate-500 tracking-[0.1em] mb-0.5">
                Personal Libre
              </p>
              <p className="text-xl font-black text-slate-900">{freeTeachers.length}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
              {['Matutina', 'Vespertina', 'Todas'].map((t: any) => (
                <button
                  key={t}
                  onClick={() => {
                    setActiveTanda(t);
                    setSelectedId('');
                  }}
                  className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                    activeTanda === t
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => {
                  setMode('course');
                  setSelectedId('');
                }}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${mode === 'course' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-400 hover:text-slate-900'}`}
              >
                <BookOpen size={12} /> Cursos
              </button>
              <button
                onClick={() => {
                  setMode('teacher');
                  setSelectedId('');
                }}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${mode === 'teacher' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-400 hover:text-slate-900'}`}
              >
                <Users size={12} /> Docentes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SELECTOR DE ENTIDAD COMPACTO */}
      <div className="max-w-xl mx-auto w-full">
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-blue transition-colors">
            {mode === 'course' ? <BookOpen size={18} /> : <User size={18} />}
          </div>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl shadow-lg focus:ring-4 focus:ring-brand-blue/10 outline-none appearance-none text-sm font-black text-slate-900 transition-all cursor-pointer"
          >
            <option value="">
              {mode === 'course' ? 'SELECCIONAR CURSO...' : 'SELECCIONAR DOCENTE...'}
            </option>
            {mode === 'course'
              ? state.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.level} {c.grade} {c.section} ({c.tanda})
                  </option>
                ))
              : state.teachers
                  .filter((t) => t.role === 'teacher' || t.role === 'management_teacher')
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
          </select>
          <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-slate-900">
            <ChevronDown size={18} />
          </div>
        </div>
      </div>

      {/* RESULTADOS VISTA CURSO COMPACTA */}
      {courseData && (
        <div className="space-y-6">
          {/* TABS INTERNOS DEL CURSO */}
          <div className="flex gap-4 border-b border-slate-100 pb-1">
            <button
              onClick={() => setCourseTab('live')}
              className={`pb-3 font-bold text-sm transition-all border-b-2 px-1 flex items-center gap-2 ${
                courseTab === 'live'
                  ? 'border-brand-blue text-brand-blue'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Activity size={16} />
              Monitoreo en Vivo (Clases de Hoy)
            </button>
            <button
              onClick={() => setCourseTab('student-view')}
              className={`pb-3 font-bold text-sm transition-all border-b-2 px-1 flex items-center gap-2 ${
                courseTab === 'student-view'
                  ? 'border-brand-blue text-brand-blue'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <BookOpen size={16} />
              Vista como Alumno (Aula Virtual)
            </button>
          </div>

          {courseTab === 'live' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl">
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-50">
                    <h3 className="text-lg font-black uppercase tracking-tighter text-slate-900 flex items-center gap-3">
                      <Activity className="text-brand-blue" size={20} /> {courseData.course.level}{' '}
                      {courseData.course.grade} {courseData.course.section}
                    </h3>
                    <span className="px-4 py-1.5 bg-slate-900 text-white rounded-full text-[8px] font-black uppercase tracking-widest">
                      {courseData.course.tanda}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {courseData.classes.length === 0 ? (
                      <div className="py-10 text-center text-slate-400 font-bold italic bg-slate-50 rounded-2xl text-[10px]">
                        No hay clases programadas hoy.
                      </div>
                    ) : (
                      courseData.classes.map((c) => (
                        <div
                          key={c.id}
                          className={`group relative p-5 rounded-2xl border-2 transition-all ${c.isNow ? 'bg-emerald-50 border-emerald-400 shadow-md' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                        >
                          {c.isNow && (
                            <div className="absolute -top-3 left-6 px-3 py-1 bg-emerald-500 text-white rounded-full text-[7px] font-black uppercase tracking-widest shadow-sm">
                              EN VIVO
                            </div>
                          )}
                          <div className="flex justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                              <div
                                className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs shadow-md ${c.isNow ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'}`}
                              >
                                {c.sTime}
                              </div>
                              <div>
                                <p
                                  className={`text-sm font-black tracking-tight ${c.isNow ? 'text-emerald-950' : 'text-slate-900'}`}
                                >
                                  {c.sub?.name}
                                </p>
                                <p className="text-[9px] font-black text-slate-400 flex items-center gap-2 uppercase mt-0.5">
                                  <User size={12} className="text-brand-blue" /> {c.tea?.name}
                                </p>
                              </div>
                            </div>
                            {c.room && (
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-slate-600 text-[9px] font-black uppercase tracking-widest">
                                <MapPin size={12} className="text-brand-blue" /> {c.room.name}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-brand-blue p-6 rounded-[2rem] text-white shadow-xl relative overflow-hidden group">
                  <h4 className="text-[8px] font-black uppercase tracking-widest opacity-70 mb-2">
                    Próxima Clase
                  </h4>
                  {courseData.classes.find((c) => c.isNext) ? (
                    <div>
                      <p className="text-xl font-black tracking-tighter mb-3 line-clamp-1">
                        {courseData.classes.find((c) => c.isNext)?.sub?.name}
                      </p>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-[10px] font-bold opacity-90">
                          <Clock size={12} /> {courseData.classes.find((c) => c.isNext)?.sTime}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold opacity-90">
                          <User size={12} /> {courseData.classes.find((c) => c.isNext)?.tea?.name}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs font-bold opacity-80 italic">No hay más hoy</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-brand-blue/5 text-brand-blue border border-brand-blue/15 px-5 py-4 rounded-[1.5rem] text-xs font-bold flex items-center gap-3">
                <Info size={18} className="shrink-0" />
                <span>
                  Estás previsualizando la pantalla de este curso tal como la verían sus alumnos y
                  padres.
                </span>
              </div>
              <div className="bg-white p-2 rounded-[2.5rem] border border-slate-150 shadow-2xl overflow-hidden">
                <StudentDashboard userData={mockStudentProfile} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* RESULTADOS VISTA DOCENTE COMPACTA */}
      {teacherData && (
        <div className="space-y-6">
          {/* TABS INTERNOS DEL DOCENTE */}
          <div className="flex gap-4 border-b border-slate-100 pb-1">
            <button
              onClick={() => setTeacherTab('live')}
              className={`pb-3 font-bold text-sm transition-all border-b-2 px-1 flex items-center gap-2 ${
                teacherTab === 'live'
                  ? 'border-brand-blue text-brand-blue'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Activity size={16} />
              Monitoreo en Vivo (Agenda de Hoy)
            </button>
            <button
              onClick={() => setTeacherTab('teacher-view')}
              className={`pb-3 font-bold text-sm transition-all border-b-2 px-1 flex items-center gap-2 ${
                teacherTab === 'teacher-view'
                  ? 'border-brand-blue text-brand-blue'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <User size={16} />
              Vista como Docente (Panel de Control de Clases)
            </button>
          </div>

          {teacherTab === 'live' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl">
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-50">
                    <h3 className="text-lg font-black uppercase tracking-tight text-slate-800 flex items-center gap-3">
                      <User className="text-brand-blue" size={20} /> Agenda de Hoy:{' '}
                      {teacherData.teacher.name}
                    </h3>
                    <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[8px] font-black uppercase tracking-widest">
                      {teacherData.teacherSchedule.length} Clases
                    </span>
                  </div>

                  <div className="space-y-3">
                    {teacherData.teacherSchedule.length === 0 ? (
                      <div className="py-10 text-center text-slate-400 italic text-[10px]">
                        El docente no tiene clases programadas para hoy.
                      </div>
                    ) : (
                      teacherData.teacherSchedule.map((c) => (
                        <div
                          key={c.id}
                          className={`relative p-5 rounded-2xl border transition-all ${c.isNow ? 'bg-indigo-50 border-indigo-200 shadow-md' : 'bg-white border-slate-50 hover:bg-slate-50'}`}
                        >
                          {c.isNow && (
                            <div className="absolute -top-3 left-6 px-3 py-1 bg-indigo-600 text-white rounded-full text-[7px] font-black uppercase tracking-widest shadow-sm">
                              EN VIVO
                            </div>
                          )}
                          <div className="flex justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                              <div className="text-center min-w-[50px]">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                  {c.sTime}
                                </p>
                                <div
                                  className={`w-0.5 h-4 mx-auto my-0.5 rounded-full ${c.isNow ? 'bg-indigo-500' : 'bg-slate-200'}`}
                                ></div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                  {c.eTime}
                                </p>
                              </div>
                              <div>
                                <p
                                  className={`text-sm font-black tracking-tight ${c.isNow ? 'text-indigo-900' : 'text-slate-800'}`}
                                >
                                  {c.sub?.name}
                                </p>
                                <p className="text-[9px] font-bold text-slate-400 flex items-center gap-2 uppercase tracking-widest mt-0.5">
                                  <BookOpen size={10} /> {c.course?.level} {c.course?.grade}
                                  {c.course?.section}
                                </p>
                              </div>
                            </div>
                            {c.room && (
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/50 rounded-lg text-slate-500 text-[9px] font-black uppercase tracking-widest">
                                <MapPin size={10} /> {c.room.name}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div
                  className={`p-6 rounded-[2rem] text-white shadow-xl transition-all duration-500 ${teacherData.currentClass ? 'bg-emerald-600' : 'bg-amber-500'}`}
                >
                  <h4 className="text-[8px] font-black uppercase tracking-widest opacity-80 mb-3">
                    Estado Actual
                  </h4>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      {teacherData.currentClass ? (
                        <Activity size={20} className="animate-pulse" />
                      ) : (
                        <Clock size={20} />
                      )}
                    </div>
                    <div>
                      <p className="text-lg font-black uppercase leading-none">
                        {teacherData.currentClass ? 'Ocupado' : 'Disponible'}
                      </p>
                      <p className="text-[9px] font-bold opacity-70 mt-1">
                        {teacherData.currentClass
                          ? `En ${teacherData.currentClass.course?.grade}${teacherData.currentClass.course?.section}`
                          : 'Sin clases ahora'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl">
                  <h4 className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-4">
                    Huecos Libres
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {teacherData.availableBlocks.filter(
                      (tb) => getMinutes(tb.startTime || tb.start_time) >= currentTimeMinutes
                    ).length === 0 ? (
                      <p className="text-[10px] font-bold text-slate-400 italic">No hay más hoy</p>
                    ) : (
                      teacherData.availableBlocks
                        .filter(
                          (tb) => getMinutes(tb.startTime || tb.start_time) >= currentTimeMinutes
                        )
                        .slice(0, 3)
                        .map((tb) => (
                          <div
                            key={tb.id}
                            className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center min-w-[70px]"
                          >
                            <span className="text-[9px] font-black text-slate-900">
                              {tb.startTime || tb.start_time}
                            </span>
                            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">
                              Libre
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-brand-blue/5 text-brand-blue border border-brand-blue/15 px-5 py-4 rounded-[1.5rem] text-xs font-bold flex items-center gap-3">
                <Info size={18} className="shrink-0" />
                <span>
                  Estás previsualizando la pantalla de este docente tal como la vería él en su
                  perfil de Edugest.
                </span>
              </div>
              <div className="bg-white p-2 rounded-[2.5rem] border border-slate-150 shadow-2xl overflow-hidden">
                <TeacherDashboard userData={mockTeacherProfile} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* VISTA RESUMEN (CUANDO NO HAY NADA SELECCIONADO) */}
      {!selectedId && (
        <div className="space-y-10 animate-in fade-in duration-700">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* PANEL: CLASES EN VIVO AHORA */}
            <div className="lg:col-span-8 space-y-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900 flex items-center gap-4">
                  <div className="w-4 h-4 bg-emerald-500 rounded-full animate-ping"></div>
                  MONITOREO EN VIVO: TODA LA ESCUELA
                </h3>
                <span className="text-xs font-black bg-emerald-100 text-emerald-700 px-6 py-3 rounded-full uppercase tracking-widest border-2 border-emerald-200">
                  {activeClassesNow.length} AULAS OCUPADAS
                </span>
              </div>

              {activeClassesNow.length === 0 ? (
                <div className="bg-white p-24 rounded-[3.5rem] border-4 border-dashed border-slate-200 shadow-2xl text-center flex flex-col items-center">
                  <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-8 border-2 border-slate-100">
                    <Clock size={64} />
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 uppercase mb-3">
                    Sin actividad en este momento
                  </h4>
                  <p className="text-slate-600 text-sm font-bold max-w-sm">
                    No hay clases programadas para esta hora según el horario escolar vigente.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeClassesNow.map((c: any) => (
                    <div
                      key={c.id}
                      className="bg-white p-8 rounded-[3rem] border-2 border-slate-200 shadow-2xl hover:border-brand-blue transition-all group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-4 h-full bg-emerald-500"></div>
                      <div className="flex items-center gap-6 mb-6">
                        <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.8rem] flex items-center justify-center font-black text-base shadow-2xl">
                          {c.room?.name || 'A'}
                        </div>
                        <div>
                          <p className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">
                            DANDO CLASE
                          </p>
                          <div className="flex items-center gap-2 text-slate-900 font-black text-xs uppercase">
                            <Clock size={14} className="text-brand-blue" /> {c.tb?.startTime} -{' '}
                            {c.tb?.endTime}
                          </div>
                        </div>
                      </div>

                      <h4 className="text-2xl font-black text-black uppercase leading-none mb-6 min-h-[3rem] tracking-tighter">
                        {c.sub?.name}
                      </h4>

                      <div className="space-y-4 pt-6 border-t-2 border-slate-50">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-brand-blue text-white flex items-center justify-center shadow-lg">
                            <Users size={18} />
                          </div>
                          <p className="text-sm font-black text-slate-900 uppercase">
                            {c.course?.level} {c.course?.grade} {c.course?.section}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center border-2 border-slate-200">
                            <User size={18} />
                          </div>
                          <p className="text-sm font-black text-slate-900 uppercase">
                            {c.tea?.name}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PANEL: AGENDA DEL DÍA - ALTO CONTRASTE */}
            <div className="lg:col-span-4 space-y-6">
              <h3 className="text-base font-black uppercase tracking-widest text-slate-900 mb-2 px-2 flex items-center gap-3">
                <Timer size={20} className="text-brand-blue" /> AGENDA DEL DÍA
              </h3>
              <div className="bg-slate-200/50 p-8 rounded-[3.5rem] border-2 border-slate-200 space-y-4 max-h-[700px] overflow-y-auto custom-scrollbar shadow-inner">
                {todaySchedule
                  .filter(
                    (e) =>
                      getMinutes(
                        state.timeBlocks.find((b) => b.id === e.timeBlockId)?.startTime || ''
                      ) > currentTimeMinutes
                  )
                  .sort(
                    (a, b) =>
                      getMinutes(
                        state.timeBlocks.find((b) => b.id === a.timeBlockId)?.startTime || ''
                      ) -
                      getMinutes(
                        state.timeBlocks.find((b) => b.id === b.timeBlockId)?.startTime || ''
                      )
                  )
                  .slice(0, 15)
                  .map((e: any) => {
                    const tb = state.timeBlocks.find((b) => b.id === e.timeBlockId);
                    const sub = state.subjects.find((s) => s.id === e.subjectId);
                    const course = state.courses.find((c) => c.id === e.course_id);
                    return (
                      <div
                        key={e.id}
                        className="bg-white p-6 rounded-2xl border-2 border-slate-300 flex items-center justify-between shadow-md hover:border-brand-blue transition-all"
                      >
                        <div className="flex items-center gap-5">
                          <div className="text-xs font-black text-white bg-slate-900 w-16 h-12 rounded-xl flex items-center justify-center shadow-lg">
                            {tb?.startTime}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 uppercase leading-none mb-1">
                              {sub?.name}
                            </p>
                            <p className="text-[10px] font-black text-brand-blue uppercase">
                              {course?.grade} {course?.section}
                            </p>
                          </div>
                        </div>
                        <ArrowRight size={18} className="text-slate-400" />
                      </div>
                    );
                  })}
                {todaySchedule.filter(
                  (e) =>
                    getMinutes(
                      state.timeBlocks.find((b) => b.id === e.timeBlockId)?.startTime || ''
                    ) > currentTimeMinutes
                ).length === 0 && (
                  <div className="text-center py-20 px-6">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl border-2 border-slate-100">
                      <CheckCircle2 size={32} className="text-emerald-500" />
                    </div>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-widest">
                      JORNADA FINALIZADA
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlDashboard;
