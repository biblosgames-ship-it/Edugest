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
  Info,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Sliders,
  Play,
  FastForward
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

  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const currentDay = days[currentTime.getDay()];

  // Modo Proyección Temporal
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    const d = days[new Date().getDay()];
    return d === 'Domingo' || d === 'Sábado' ? 'Lunes' : d;
  });
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulatedMinutes, setSimulatedMinutes] = useState<number>(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

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

  // Normalizar texto para comparaciones seguras (sin tildes, minúsculas)
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const realCurrentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const effectiveTimeMinutes = isSimulating ? simulatedMinutes : realCurrentMinutes;

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

  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
  };

  const getEntryTimes = (e: any) => {
    const tbId = e.time_block_id || e.timeBlockId;
    const tb = state.timeBlocks.find((b) => b.id === tbId);
    const sTime = e.start_time || e.startTime || tb?.startTime || tb?.start_time || '';
    const eTime = e.end_time || e.endTime || tb?.endTime || tb?.end_time || '';
    const start = getMinutes(sTime);
    const end = getMinutes(eTime);
    return { sTime, eTime, start, end, tb };
  };

  // Ajustar horario simulado si se cambia entre tanda matutina y vespertina
  useEffect(() => {
    if (activeTanda === 'Vespertina' && simulatedMinutes < 720) {
      setSimulatedMinutes(14 * 60); // 2:00 PM
    } else if (activeTanda === 'Matutina' && simulatedMinutes >= 780) {
      setSimulatedMinutes(8 * 60); // 8:00 AM
    }
  }, [activeTanda]);

  // 1. Filtrar el horario para el día seleccionado (Normalizado y por TANDA)
  const todaySchedule = useMemo(() => {
    const normDay = normalize(selectedDay);
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
      if (entryDay && normalize(entryDay) === normDay) return true;

      const tbId = entry.time_block_id || entry.timeBlockId;
      const tb = state.timeBlocks.find((b) => b.id === tbId);
      return tb && normalize(tb.day) === normDay;
    });
  }, [state.schedule, state.timeBlocks, state.courses, selectedDay, activeTanda]);

  // 1.5. Detectar todos los bloques/horas programados para el día seleccionado
  const detectedTimeSlots = useMemo(() => {
    const slotMap = new Map<string, { start: number; end: number; sTime: string; eTime: string; count: number }>();
    todaySchedule.forEach((e) => {
      const { sTime, eTime, start, end } = getEntryTimes(e);
      if (!sTime || !eTime || end <= start) return;
      const key = `${start}_${end}`;
      const existing = slotMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        slotMap.set(key, { start, end, sTime, eTime, count: 1 });
      }
    });

    const list = Array.from(slotMap.values()).sort((a, b) => a.start - b.start);
    return list.map((slot, idx) => ({
      ...slot,
      periodIndex: idx + 1,
      label: `${idx + 1}ª Hora`,
      formattedTime: `${slot.sTime} - ${slot.eTime}`,
      midMinutes: Math.floor((slot.start + slot.end) / 2)
    }));
  }, [todaySchedule, state.timeBlocks]);

  const activeSlot = useMemo(() => {
    return (
      detectedTimeSlots.find(
        (slot) => effectiveTimeMinutes >= slot.start && effectiveTimeMinutes < slot.end
      ) || null
    );
  }, [detectedTimeSlots, effectiveTimeMinutes]);

  // Controles de proyección
  const handleGoToSlot = (slot: any) => {
    setIsSimulating(true);
    setSimulatedMinutes(slot.midMinutes);
  };

  const handleNextSlot = () => {
    if (detectedTimeSlots.length === 0) return;
    setIsSimulating(true);
    const next = detectedTimeSlots.find((s) => s.start > effectiveTimeMinutes);
    if (next) {
      setSimulatedMinutes(next.midMinutes);
    } else {
      setSimulatedMinutes(detectedTimeSlots[0].midMinutes);
    }
  };

  const handlePrevSlot = () => {
    if (detectedTimeSlots.length === 0) return;
    setIsSimulating(true);
    const rev = [...detectedTimeSlots].reverse();
    const prev = rev.find((s) => s.end <= effectiveTimeMinutes);
    if (prev) {
      setSimulatedMinutes(prev.midMinutes);
    } else {
      setSimulatedMinutes(detectedTimeSlots[detectedTimeSlots.length - 1].midMinutes);
    }
  };

  const handleResetToLive = () => {
    setIsSimulating(false);
    const d = days[new Date().getDay()];
    setSelectedDay(d === 'Domingo' || d === 'Sábado' ? 'Lunes' : d);
    setSimulatedMinutes(new Date().getHours() * 60 + new Date().getMinutes());
  };

  const handleStepMinutes = (delta: number) => {
    setIsSimulating(true);
    setSimulatedMinutes((prev) => Math.max(360, Math.min(1320, prev + delta)));
  };

  // 2. Clases activas en este momento (o en la hora proyectada)
  const activeClassesNow = useMemo(() => {
    return todaySchedule
      .map((e) => {
        const { sTime, eTime, start, end, tb } = getEntryTimes(e);
        return { ...e, sTime, eTime, start, end, tb };
      })
      .filter((e) => {
        if (!e.sTime || !e.eTime) return false;
        return effectiveTimeMinutes >= e.start && effectiveTimeMinutes < e.end;
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
  }, [todaySchedule, state, effectiveTimeMinutes]);

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
        const isNow = effectiveTimeMinutes >= start && effectiveTimeMinutes < end;
        const isNext = start > effectiveTimeMinutes;

        return { ...e, tb, sub, tea, room, isNow, isNext, startMinutes: start, sTime, eTime };
      })
      .sort((a, b) => a.startMinutes - b.startMinutes);

    return { course, classes };
  }, [mode, selectedId, todaySchedule, state, effectiveTimeMinutes]);

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
        const isNow = effectiveTimeMinutes >= start && effectiveTimeMinutes < end;

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
    const nextClass = teacherSchedule.find((c) => c.startMinutes > effectiveTimeMinutes);

    const busyBlocks = teacherSchedule.map((c) => c.time_block_id || c.timeBlockId);
    const availableBlocks = state.timeBlocks
      .filter((tb) => normalize(tb.day) === normalize(selectedDay) && !busyBlocks.includes(tb.id))
      .sort(
        (a, b) => getMinutes(a.startTime || a.start_time) - getMinutes(b.startTime || b.start_time)
      );

    return { teacher, currentClass, nextClass, availableBlocks, teacherSchedule };
  }, [mode, selectedId, todaySchedule, state, selectedDay, effectiveTimeMinutes]);

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
            <div className={`w-12 h-12 text-white rounded-2xl flex items-center justify-center shadow-lg transition-all ${
              isSimulating ? 'bg-indigo-600 shadow-indigo-300' : 'bg-brand-blue shadow-brand-blue/20'
            }`}>
              {isSimulating ? <FastForward size={24} className="animate-pulse" /> : <Activity className="animate-pulse" size={24} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black tracking-tighter uppercase text-slate-900 leading-none">
                  Torre de Control
                </h2>
                {isSimulating ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[8px] font-black bg-indigo-600 text-white uppercase tracking-widest shadow-xs animate-pulse">
                    Proyección Activa
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[8px] font-black bg-emerald-100 text-emerald-700 uppercase tracking-widest border border-emerald-200">
                    En Vivo
                  </span>
                )}
              </div>
              <p className="text-slate-500 font-black uppercase text-[8px] tracking-[0.2em] flex items-center gap-2 mt-1">
                <Calendar size={12} className="text-brand-blue" /> {selectedDay}{' '}
                <span className="text-slate-300">|</span>{' '}
                <Clock size={12} className="text-brand-blue" />{' '}
                {isSimulating ? (
                  <span className="text-indigo-600 font-black">
                    Proyectado: {formatMinutes(effectiveTimeMinutes)} {activeSlot ? `(${activeSlot.label})` : ''}
                  </span>
                ) : (
                  currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                )}
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className={`border-2 px-6 py-3 rounded-2xl text-center shadow-sm transition-all ${
              isSimulating ? 'bg-indigo-50 border-indigo-200' : 'bg-emerald-50 border-emerald-100'
            }`}>
              <p className={`text-[8px] font-black uppercase tracking-[0.1em] mb-0.5 ${
                isSimulating ? 'text-indigo-700' : 'text-emerald-700'
              }`}>
                {isSimulating ? 'Clases Proyectadas' : 'Clases en Vivo'}
              </p>
              <p className={`text-xl font-black ${isSimulating ? 'text-indigo-950' : 'text-emerald-900'}`}>
                {activeClassesNow.length}
              </p>
            </div>
            <div className="bg-slate-50 border-2 border-slate-100 px-6 py-3 rounded-2xl text-center shadow-sm">
              <p className="text-[8px] font-black uppercase text-slate-500 tracking-[0.1em] mb-0.5">
                {isSimulating ? 'Personal Libre (Hora)' : 'Personal Libre'}
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
                  className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer ${
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
                className={`flex items-center gap-2 px-6 py-3 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer ${mode === 'course' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-400 hover:text-slate-900'}`}
              >
                <BookOpen size={12} /> Cursos
              </button>
              <button
                onClick={() => {
                  setMode('teacher');
                  setSelectedId('');
                }}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer ${mode === 'teacher' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-400 hover:text-slate-900'}`}
              >
                <Users size={12} /> Docentes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL DE PROYECCIÓN TEMPORAL: AVANZAR EN EL TIEMPO HORA A HORA */}
      <div className={`p-6 rounded-[2.5rem] border-2 transition-all shadow-xl ${
        isSimulating
          ? 'bg-gradient-to-br from-indigo-50/80 via-white to-sky-50/80 border-indigo-300 ring-4 ring-indigo-500/10'
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-all ${
              isSimulating
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-300'
                : 'bg-slate-900 text-white shadow-md'
            }`}>
              {isSimulating ? <FastForward size={22} className="animate-pulse" /> : <Clock size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black uppercase text-slate-900 tracking-tight">
                  Proyector de Horas del Día
                </h3>
                {isSimulating ? (
                  <span className="px-3 py-1 rounded-full text-[9px] font-black bg-indigo-600 text-white uppercase tracking-widest shadow-xs flex items-center gap-1.5">
                    <Sparkles size={11} /> Proyectando Hora
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-[9px] font-black bg-emerald-500 text-white uppercase tracking-widest shadow-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" /> Tiempo Real
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                {isSimulating ? (
                  <>
                    Viendo actividad escolar a las{' '}
                    <span className="font-black text-indigo-700 underline decoration-indigo-300 decoration-2">
                      {formatMinutes(effectiveTimeMinutes)}
                    </span>
                    {activeSlot ? ` — ${activeSlot.label} (${activeSlot.formattedTime})` : ''}
                  </>
                ) : (
                  <>
                    Avanza a las horas siguientes para proyectar el movimiento de docentes y alumnos durante todo el día.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Botones de Navegación y Volver a En Vivo */}
          <div className="flex flex-wrap items-center gap-2">
            {isSimulating && (
              <button
                type="button"
                onClick={handleResetToLive}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <RotateCcw size={15} /> Volver a En Vivo
              </button>
            )}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={handlePrevSlot}
                disabled={detectedTimeSlots.length === 0}
                className="px-3.5 py-2 text-xs font-black text-slate-700 hover:bg-white hover:text-slate-900 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer shadow-2xs"
                title="Hora anterior"
              >
                <ChevronLeft size={16} /> Hora Anterior
              </button>
              <button
                type="button"
                onClick={handleNextSlot}
                disabled={detectedTimeSlots.length === 0}
                className="px-4 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer shadow-md active:scale-95 ml-1"
                title="Siguiente hora"
              >
                Siguiente Hora <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Selector de Día (Lunes - Viernes) y Botones de ajuste */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <span className="text-[10px] font-black uppercase text-slate-400 px-2 tracking-wider">
              Día a Proyectar:
            </span>
            {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map((d) => {
              const isToday = normalize(currentDay) === normalize(d);
              const isSelected = normalize(selectedDay) === normalize(d);
              return (
                <button
                  type="button"
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  {d} {isToday && <span className="text-[9px] text-emerald-400 ml-0.5 font-black">(Hoy)</span>}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-1">
              Saltar:
            </span>
            <button
              type="button"
              onClick={() => handleStepMinutes(-30)}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer"
            >
              -30 min
            </button>
            <button
              type="button"
              onClick={() => handleStepMinutes(30)}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer"
            >
              +30 min
            </button>
            <button
              type="button"
              onClick={() => handleStepMinutes(60)}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer"
            >
              +1 hora
            </button>
          </div>
        </div>

        {/* Carrusel Horizontal de Horas Programadas */}
        <div className="pt-4">
          <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
            <span>Horas y Bloques de {selectedDay} ({activeTanda}):</span>
            {detectedTimeSlots.length > 0 && (
              <span className="text-slate-500">{detectedTimeSlots.length} horas configuradas</span>
            )}
          </div>
          {detectedTimeSlots.length === 0 ? (
            <div className="p-6 bg-slate-50 rounded-2xl text-center text-xs font-bold text-slate-400 italic border border-slate-100">
              No hay horarios programados para {selectedDay} en la tanda {activeTanda}. Selecciona otro día o tanda.
            </div>
          ) : (
            <div className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 custom-scrollbar">
              {detectedTimeSlots.map((slot) => {
                const isSelected = effectiveTimeMinutes >= slot.start && effectiveTimeMinutes < slot.end;
                const isNowReal = realCurrentMinutes >= slot.start && realCurrentMinutes < slot.end && normalize(selectedDay) === normalize(currentDay);
                return (
                  <button
                    type="button"
                    key={`${slot.start}_${slot.end}`}
                    onClick={() => handleGoToSlot(slot)}
                    className={`shrink-0 px-4 py-3 rounded-2xl text-left border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl shadow-indigo-200 scale-102 ring-2 ring-indigo-400'
                        : isNowReal
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 hover:border-emerald-500 hover:shadow-md'
                        : 'bg-white border-slate-200 text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/40 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className={`text-[10px] font-black uppercase tracking-wider ${
                        isSelected ? 'text-indigo-100' : isNowReal ? 'text-emerald-700' : 'text-slate-500'
                      }`}>
                        {slot.label}
                      </span>
                      {isNowReal && (
                        <span className="px-1.5 py-0.5 rounded text-[7px] font-black bg-emerald-500 text-white uppercase tracking-widest shadow-2xs">
                          Ahora
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-black whitespace-nowrap leading-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                      {slot.formattedTime}
                    </p>
                    <p className={`text-[10px] font-semibold mt-1 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {slot.count} {slot.count === 1 ? 'aula con clase' : 'aulas con clase'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
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
            {/* PANEL: CLASES ACTIVAS / PROYECTADAS */}
            <div className="lg:col-span-8 space-y-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900 flex items-center gap-4">
                  <div
                    className={`w-4 h-4 rounded-full ${
                      isSimulating ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500 animate-ping'
                    }`}
                  ></div>
                  {isSimulating ? (
                    <span>
                      PROYECCIÓN TEMPORAL:{' '}
                      <span className="text-indigo-600">
                        {activeSlot ? `${activeSlot.label} (${activeSlot.formattedTime})` : formatMinutes(effectiveTimeMinutes)}
                      </span>
                    </span>
                  ) : (
                    <span>MONITOREO EN VIVO: TODA LA ESCUELA</span>
                  )}
                </h3>
                <span
                  className={`text-xs font-black px-6 py-3 rounded-full uppercase tracking-widest border-2 ${
                    isSimulating
                      ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                      : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {activeClassesNow.length} AULAS OCUPADAS
                </span>
              </div>

              {activeClassesNow.length === 0 ? (
                <div className="bg-white p-20 rounded-[3.5rem] border-4 border-dashed border-slate-200 shadow-2xl text-center flex flex-col items-center">
                  <div className="w-28 h-28 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6 border-2 border-slate-100">
                    <Clock size={56} />
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 uppercase mb-3">
                    {isSimulating
                      ? `Sin clases a las ${formatMinutes(effectiveTimeMinutes)}`
                      : 'Sin actividad en este momento'}
                  </h4>
                  <p className="text-slate-600 text-sm font-bold max-w-md">
                    {isSimulating
                      ? 'No hay clases programadas para esta hora exacta (puede ser recreo o fuera del horario escolar). Usa los botones de navegación arriba para avanzar a la siguiente hora.'
                      : 'No hay clases programadas para esta hora según el horario escolar vigente.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeClassesNow.map((c: any) => (
                    <div
                      key={c.id}
                      className={`bg-white p-8 rounded-[3rem] border-2 shadow-2xl transition-all group relative overflow-hidden ${
                        isSimulating
                          ? 'border-indigo-200 hover:border-indigo-500'
                          : 'border-slate-200 hover:border-brand-blue'
                      }`}
                    >
                      <div
                        className={`absolute top-0 right-0 w-4 h-full ${
                          isSimulating ? 'bg-indigo-500' : 'bg-emerald-500'
                        }`}
                      ></div>
                      <div className="flex items-center gap-6 mb-6">
                        <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.8rem] flex items-center justify-center font-black text-base shadow-2xl">
                          {c.room?.name || 'A'}
                        </div>
                        <div>
                          <p
                            className={`text-xs font-black uppercase tracking-[0.2em] mb-1 ${
                              isSimulating ? 'text-indigo-600' : 'text-emerald-600'
                            }`}
                          >
                            {isSimulating ? 'CLASE PROGRAMADA' : 'DANDO CLASE'}
                          </p>
                          <div className="flex items-center gap-2 text-slate-900 font-black text-xs uppercase">
                            <Clock size={14} className="text-brand-blue" />{' '}
                            {c.sTime || c.tb?.startTime} - {c.eTime || c.tb?.endTime}
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
                <Timer size={20} className="text-brand-blue" />
                {isSimulating
                  ? `AGENDA DESDE LAS ${formatMinutes(effectiveTimeMinutes)}`
                  : 'AGENDA DEL DÍA'}
              </h3>
              <div className="bg-slate-200/50 p-8 rounded-[3.5rem] border-2 border-slate-200 space-y-4 max-h-[700px] overflow-y-auto custom-scrollbar shadow-inner">
                {todaySchedule
                  .map((e) => {
                    const times = getEntryTimes(e);
                    return { ...e, ...times };
                  })
                  .filter((e) => e.start > effectiveTimeMinutes)
                  .sort((a, b) => a.start - b.start)
                  .slice(0, 15)
                  .map((e: any) => {
                    const sub = state.subjects.find((s) => s.id === (e.subject_id || e.subjectId));
                    const course = state.courses.find((c) => c.id === (e.course_id || e.courseId));
                    return (
                      <div
                        key={e.id}
                        className="bg-white p-6 rounded-2xl border-2 border-slate-300 flex items-center justify-between shadow-md hover:border-brand-blue transition-all"
                      >
                        <div className="flex items-center gap-5">
                          <div className="text-xs font-black text-white bg-slate-900 w-16 h-12 rounded-xl flex items-center justify-center shadow-lg">
                            {e.sTime || e.tb?.startTime}
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
                {todaySchedule
                  .map((e) => getEntryTimes(e))
                  .filter((e) => e.start > effectiveTimeMinutes).length === 0 && (
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
