import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { dataService } from '../services/dataService';
import html2canvas from 'html2canvas-pro';
import {
  Bell,
  Clock,
  Calendar as CalendarIcon,
  User,
  BookOpen,
  Activity,
  MapPin,
  Plus,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  AlertCircle,
  FileText,
  Send,
  X,
  Printer,
  Download,
  CalendarDays
} from 'lucide-react';
import { ExcuseAlert } from './ExcuseAlert';
import { TeacherTaskAnnouncement } from './TeacherTaskAnnouncement';

export const TeacherDashboard = ({ userData: profile }: { userData: any }) => {
  const { state } = useApp();

  // Guardar y recuperar la selección del docente de localStorage o de la base de datos (Supabase)
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(() => {
    return profile?.teacher_id || localStorage.getItem('selected_teacher_id') || '';
  });

  useEffect(() => {
    if (profile?.teacher_id) {
      setSelectedTeacherId(profile.teacher_id);
    }
  }, [profile?.teacher_id]);

  const [isLinking, setIsLinking] = useState(false);

  const handleLinkTeacher = async (teacherId: string) => {
    if (!profile?.id) return;
    try {
      setIsLinking(true);
      const { error } = await supabase
        .from('profiles')
        .update({ teacher_id: teacherId })
        .eq('id', profile.id);

      if (error) {
        console.warn('Supabase profiles update failed, saving locally:', error);
        localStorage.setItem('selected_teacher_id', teacherId);
        setSelectedTeacherId(teacherId);
        alert('Selección guardada localmente en este dispositivo.');
      } else {
        localStorage.setItem('selected_teacher_id', teacherId);
        setSelectedTeacherId(teacherId);

        // Actualizar perfil local en memoria
        profile.teacher_id = teacherId;

        alert('¡Cuenta vinculada de forma permanente con éxito en Supabase!');
      }
    } catch (err) {
      console.error('Error linking teacher:', err);
      localStorage.setItem('selected_teacher_id', teacherId);
      setSelectedTeacherId(teacherId);
    } finally {
      setIsLinking(false);
    }
  };

  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [courseTasks, setCourseTasks] = useState<any[]>([]);
  const [courseAnnouncements, setCourseAnnouncements] = useState<any[]>([]);
  const [courseCommunications, setCourseCommunications] = useState<any[]>([]);
  const [activeCourseTab, setActiveCourseTab] = useState<
    'horario' | 'tareas' | 'comunicados' | 'excusas'
  >('horario');
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [initialFormType, setInitialFormType] = useState<'task' | 'announcement'>('task');
  const [showWeeklyScheduleModal, setShowWeeklyScheduleModal] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Reloj interno
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

  // Persistir la selección
  const handleTeacherChange = (id: string) => {
    setSelectedTeacherId(id);
    if (id) {
      localStorage.setItem('selected_teacher_id', id);
    } else {
      localStorage.removeItem('selected_teacher_id');
    }
    setSelectedCourse(null);
    setShowCreateForm(false);
  };

  const currentTeacher = useMemo(() => {
    return state.teachers.find((t) => t.id === selectedTeacherId);
  }, [state.teachers, selectedTeacherId]);

  // Cargar datos al entrar a un curso
  useEffect(() => {
    if (!selectedCourse) return;

    const loadCourseData = async () => {
      try {
        const [tasksData, annData, commsData] = await Promise.all([
          dataService.getTasks(selectedCourse.id),
          dataService.getAnnouncements(selectedCourse.id),
          dataService.getCommunications(profile?.id || '', profile?.role || 'teacher')
        ]);

        setCourseTasks(tasksData);
        setCourseAnnouncements(annData);

        // Filtrar comunicaciones/excusas de este curso específico
        const courseCommsFiltered = (commsData || []).filter((c: any) =>
          (c.target_courses || []).includes(selectedCourse.id)
        );
        setCourseCommunications(courseCommsFiltered);
      } catch (error) {
        console.error('Error loading selected course details:', error);
      }
    };

    loadCourseData();
  }, [selectedCourse, showCreateForm, profile]);

  // Horario del docente para el día de hoy con recreos integrados
  const teacherTodaySchedule = useMemo(() => {
    if (!selectedTeacherId) return [];
    const normCurrentDay = normalize(currentDay);

    const normTodayClasses = state.schedule
      .filter((entry) => {
        if (entry.teacherId !== selectedTeacherId && entry.teacher_id !== selectedTeacherId)
          return false;

        const entryDay = entry.day || '';
        if (entryDay && normalize(entryDay) === normCurrentDay) return true;

        const tbId = entry.time_block_id || entry.timeBlockId;
        const tb = state.timeBlocks.find((b) => b.id === tbId);
        return tb && normalize(tb.day) === normCurrentDay;
      })
      .map((entry) => {
        const tbId = entry.time_block_id || entry.timeBlockId;
        const subId = entry.subject_id || entry.subjectId;
        const courseId = entry.course_id || entry.courseId;

        const tb = state.timeBlocks.find((b) => b.id === tbId);
        const sub = state.subjects.find((s) => s.id === subId);
        const course = state.courses.find((c) => c.id === courseId);
        const room = state.rooms.find((r) => r.id === (entry.room_id || entry.roomId));

        const sTime = entry.start_time || entry.startTime || tb?.startTime || tb?.start_time || '';
        const eTime = entry.end_time || entry.endTime || tb?.endTime || tb?.end_time || '';

        const start = getMinutes(sTime);
        const end = getMinutes(eTime);
        const isNow = currentTimeMinutes >= start && currentTimeMinutes < end;

        return {
          ...entry,
          isBreak: false,
          tb,
          sub,
          course,
          room,
          isNow,
          startMinutes: start,
          sTime,
          eTime
        };
      });

    // Si no hay clases hoy, retornar vacío
    if (normTodayClasses.length === 0) return [];

    // Calcular el recreo correspondiente para la tanda del día
    const toMins = (val: string) => {
      const [h, m] = (val || '')
        .replace(/[^0-9:]/g, '')
        .split(':')
        .map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const fromMins = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // Determinar tanda
    const isMorning = normTodayClasses.some((c) => c.startMinutes < 780);

    // Buscar recreo en breakPreferences
    const firstRelevantBreak = (state.breakPreferences || []).find((bp: any) => {
      let bpMins = toMins(bp.startTime);
      if (!isMorning && bpMins < 420) bpMins += 720;
      const isBpMorning = bpMins < 780;
      return isMorning === isBpMorning;
    });

    const bStart = firstRelevantBreak
      ? toMins(firstRelevantBreak.startTime)
      : isMorning
        ? 600
        : 960; // 10:00 AM o 04:00 PM
    const bDuration = firstRelevantBreak ? Number(firstRelevantBreak.durationMinutes) : 30;
    const bEnd = bStart + bDuration;

    const breakItem = {
      id: 'today_recess',
      isBreak: true,
      label: 'RECREO GENERAL',
      sTime: fromMins(bStart),
      eTime: fromMins(bEnd),
      startMinutes: bStart,
      isNow: currentTimeMinutes >= bStart && currentTimeMinutes < bEnd,
      durationMinutes: bDuration,
      sub: { name: '🔔 RECREO' }
    } as any;

    return [...normTodayClasses, breakItem].sort((a, b) => a.startMinutes - b.startMinutes);
  }, [
    selectedTeacherId,
    state.schedule,
    state.timeBlocks,
    state.subjects,
    state.courses,
    state.rooms,
    currentDay,
    currentTimeMinutes,
    state.breakPreferences
  ]);

  const activeClassNow = useMemo(() => {
    return teacherTodaySchedule.find((c) => c.isNow && !c.isBreak);
  }, [teacherTodaySchedule]);

  // Matriz semanal completa del docente (Lunes a Viernes)
  const teacherWeeklyScheduleMatrix = useMemo(() => {
    if (!selectedTeacherId) return { slots: [], matrix: {} };

    const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

    // 1. Obtener todas las clases asignadas al docente a lo largo de la semana
    const teacherEntries = state.schedule
      .filter((s) => {
        const tId = s.teacherId || s.teacher_id;
        return tId === selectedTeacherId;
      })
      .map((s) => {
        const tb = state.timeBlocks.find((b) => b.id === (s.timeBlockId || s.time_block_id));
        const sub = state.subjects.find((sub) => sub.id === (s.subjectId || s.subject_id));
        const course = state.courses.find((c) => c.id === (s.courseId || s.course_id));
        const room = state.rooms.find((r) => r.id === (s.roomId || s.room_id));
        const sTime = s.start_time || s.startTime || tb?.startTime || tb?.start_time || '';
        const eTime = s.end_time || s.endTime || tb?.endTime || tb?.end_time || '';
        const day = s.day || tb?.day || '';

        return {
          ...s,
          day,
          sTime,
          eTime,
          sub,
          course,
          room,
          startMinutes: getMinutes(sTime)
        };
      });

    // 2. Extraer horas y bloques únicos
    const timeKeys = new Set<string>();
    const timeBlocksList: {
      start: string;
      end: string;
      startMinutes: number;
      isBreak: boolean;
      label: string;
    }[] = [];

    teacherEntries.forEach((entry) => {
      if (entry.sTime && entry.eTime) {
        const key = `${entry.sTime}-${entry.eTime}`;
        if (!timeKeys.has(key)) {
          timeKeys.add(key);
          timeBlocksList.push({
            start: entry.sTime,
            end: entry.eTime,
            startMinutes: entry.startMinutes,
            isBreak: false,
            label: 'Clase'
          });
        }
      }
    });

    const toMins = (val: string) => {
      const [h, m] = (val || '')
        .replace(/[^0-9:]/g, '')
        .split(':')
        .map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const fromMins = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // Agregar recreos generales si corresponden a los turnos del docente
    const hasMorning = teacherEntries.some((e) => e.startMinutes < 780);
    const hasAfternoon = teacherEntries.some((e) => e.startMinutes >= 780);

    const addBreakForShift = (morning: boolean) => {
      const firstRelevantBreak = (state.breakPreferences || []).find((bp: any) => {
        let bpMins = toMins(bp.startTime);
        if (!morning && bpMins < 420) bpMins += 720;
        const isBpMorning = bpMins < 780;
        return morning === isBpMorning;
      });

      const bStart = firstRelevantBreak
        ? toMins(firstRelevantBreak.startTime)
        : morning
          ? 600
          : 960;
      const bDuration = firstRelevantBreak ? Number(firstRelevantBreak.durationMinutes) : 30;
      const bEnd = bStart + bDuration;

      const sTime = fromMins(bStart);
      const eTime = fromMins(bEnd);
      const key = `${sTime}-${eTime}`;

      if (!timeKeys.has(key)) {
        timeKeys.add(key);
        timeBlocksList.push({
          start: sTime,
          end: eTime,
          startMinutes: bStart,
          isBreak: true,
          label: morning ? 'RECREO MAÑANA' : 'RECREO TARDE'
        });
      }
    };

    if (hasMorning || (!hasMorning && !hasAfternoon)) {
      addBreakForShift(true);
    }
    if (hasAfternoon) {
      addBreakForShift(false);
    }

    // Ordenar bloques por hora de inicio
    const sortedSlots = timeBlocksList.sort((a, b) => a.startMinutes - b.startMinutes);

    // 3. Rellenar matriz de datos por día y hora
    const matrix: Record<string, Record<string, any>> = {};

    sortedSlots.forEach((slot) => {
      matrix[slot.start] = {};
      weekDays.forEach((day) => {
        if (slot.isBreak) {
          matrix[slot.start][day] = {
            isBreak: true,
            label: slot.label,
            sTime: slot.start,
            eTime: slot.end
          };
        } else {
          // Buscar si hay clase este día a esta hora
          const match = teacherEntries.find((e) => {
            const entryDay = e.day || '';
            const dayMatches = normalize(entryDay) === normalize(day);
            return dayMatches && Math.abs(e.startMinutes - slot.startMinutes) <= 25;
          });

          if (match) {
            matrix[slot.start][day] = {
              isBreak: false,
              isFree: false,
              ...match
            };
          } else {
            matrix[slot.start][day] = {
              isBreak: false,
              isFree: true,
              sTime: slot.start,
              eTime: slot.end
            };
          }
        }
      });
    });

    return { slots: sortedSlots, matrix };
  }, [
    selectedTeacherId,
    state.schedule,
    state.timeBlocks,
    state.subjects,
    state.courses,
    state.rooms,
    state.breakPreferences
  ]);

  // Obtener los cursos que dicta el docente
  const myCourses = useMemo(() => {
    if (!selectedTeacherId) return [];

    // Obtener cursos únicos de sus schedule entries o de sus assignments
    const courseIds = new Set<string>();

    state.schedule.forEach((s) => {
      const tId = s.teacherId || s.teacher_id;
      const cId = s.courseId || s.course_id;
      if (tId === selectedTeacherId && cId) {
        courseIds.add(cId);
      }
    });

    state.assignments.forEach((a) => {
      const tId = a.teacherId || a.teacher_id;
      const cId = a.courseId || a.course_id;
      if (tId === selectedTeacherId && cId) {
        courseIds.add(cId);
      }
    });

    return state.courses.filter((c) => courseIds.has(c.id));
  }, [selectedTeacherId, state.schedule, state.assignments, state.courses]);

  // Horario del curso que está inspeccionando el docente con recreos completos y horas libres
  const selectedCourseSchedule = useMemo(() => {
    if (!selectedCourse) return [];

    const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

    const toMins = (val: string) => {
      const [h, m] = (val || '')
        .replace(/[^0-9:]/g, '')
        .split(':')
        .map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const fromMins = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // 1. Obtener slots exactos del curso (igual al motor principal)
    const getSlotsForCourse = (course: any) => {
      const isMorning =
        (course.tanda || '').toLowerCase().includes('mat') ||
        (course.tanda || '').toLowerCase().includes('mañ') ||
        !(course.tanda || '').toLowerCase().includes('ves');
      const official = (state.levelSchedules || []).find(
        (ls: any) =>
          ls.level === course.level &&
          (ls.shift === (isMorning ? 'Matutina' : 'Vespertina') || !ls.shift)
      );
      const startT = official?.start_time ? toMins(official.start_time) : isMorning ? 480 : 840;
      const endT = official?.end_time ? toMins(official.end_time) : isMorning ? 720 : 1095;

      const firstRelevantBreak = (state.breakPreferences || []).find((bp: any) => {
        let bpMins = toMins(bp.startTime);
        if (!isMorning && bpMins < 420) bpMins += 720;
        const isBpMorning = bpMins < 780;
        return isMorning === isBpMorning;
      });

      const rawMasterStart = firstRelevantBreak?.startTime || (isMorning ? '10:00:00' : '16:00:00');
      let masterStartMins = toMins(rawMasterStart);
      if (!isMorning && masterStartMins < 420) masterStartMins += 720;
      const masterBPref = {
        startTime: fromMins(masterStartMins),
        durationMinutes: firstRelevantBreak?.durationMinutes || 30
      };

      const grade = course.grade?.toLowerCase() || '';
      const isFirstCycle =
        /^[1-3]/.test(grade) ||
        grade.includes('1') ||
        grade.includes('2') ||
        grade.includes('3') ||
        grade.includes('primer') ||
        (grade.includes('segundo') && !grade.includes('ciclo')) ||
        grade.includes('tercer');
      const isSecondCycle =
        /^[4-6]/.test(grade) ||
        grade.includes('4') ||
        grade.includes('5') ||
        grade.includes('6') ||
        grade.includes('cuarto') ||
        grade.includes('quinto') ||
        grade.includes('sexto');

      const applicableBPs = (state.breakPreferences || []).filter((bp: any) => {
        let bpMins = toMins(bp.startTime);
        if (!isMorning && bpMins < 420) bpMins += 720;
        const isBpMorning = bpMins < 780;
        if (isMorning !== isBpMorning) return false;

        const levelNormBP = (bp.level || '').toLowerCase();
        const levelNormCourse = (course.level || '').toLowerCase();
        if (!levelNormBP || levelNormBP.includes('gen') || levelNormBP.includes('todo')) return true;
        return (
          levelNormBP.substring(0, 3) === levelNormCourse.substring(0, 3) ||
          levelNormCourse.includes(levelNormBP.substring(0, 3))
        );
      });

      let bPref = applicableBPs.find((bp: any) => {
        if (isFirstCycle && (bp.cycle || '').includes('Primer')) return true;
        if (isSecondCycle && (bp.cycle || '').includes('Segundo')) return true;
        return false;
      });

      if (!bPref) {
        bPref = applicableBPs.find((bp: any) => !bp.cycle || bp.cycle === 'General');
      }

      bPref = bPref || masterBPref;

      let bStart = toMins(bPref.startTime);
      if (!isMorning && bStart < 420) bStart += 720;
      const bEnd = bStart + (Number(bPref.durationMinutes) || masterBPref.durationMinutes);

      const dbActoEvent = (state.fixedEvents || []).find((fe: any) => {
        const feName = (fe.name || '').toLowerCase();
        return feName.includes('acto') || feName.includes('bandera') || feName.includes('apertura');
      });

      let classStart = official?.start_time ? startT : isMorning && startT <= 480 ? 480 : startT;
      if (isMorning) {
        if (dbActoEvent && dbActoEvent.end_time) {
          const feEndMins = toMins(dbActoEvent.end_time);
          if (feEndMins > 0) classStart = Math.max(classStart, feEndMins);
        } else if (startT <= 450) {
          classStart = 470; // 07:50 AM por defecto tras Acto de Bandera
        }
      }

      const slots = [];

      if (!dbActoEvent) {
        if (isMorning && classStart > 450 && classStart <= 480) {
          slots.push({ start: '07:30:00', end: fromMins(classStart) + ':00', isBreak: true, label: 'ACTO APERTURA' });
        } else if (isMorning && startT <= 450) {
          slots.push({ start: '07:30:00', end: '07:50:00', isBreak: true, label: 'ACTO APERTURA' });
        }
      }

      // CÁLCULO FLEXIBLE Y DINÁMICO ANTES DEL RECREO (40 a 45 minutos por clase)
      const preWindow = Math.max(0, bStart - classStart);
      let preCountLocal = 2;
      if (preWindow >= 120) {
        preCountLocal = 3;
      } else if (preWindow < 70) {
        preCountLocal = 1;
      }

      let currTimePre = classStart;
      for (let i = 0; i < preCountLocal; i++) {
        const remainingSlots = preCountLocal - i;
        const remainingTime = bStart - currTimePre;
        let dur = 45;
        if (remainingSlots === 1) {
          dur = remainingTime;
        } else {
          dur = remainingTime >= remainingSlots * 40 + 5 ? 45 : 40;
        }
        let sTime = currTimePre;
        let eTime = i === preCountLocal - 1 ? bStart : sTime + dur;
        currTimePre = eTime;

        slots.push({
          start: fromMins(sTime) + ':00',
          end: fromMins(eTime) + ':00',
          isBreak: false,
          label: `${i + 1}ra Hora`
        });
      }

      slots.push({ start: fromMins(bStart), end: fromMins(bEnd), isBreak: true, label: 'RECREO' });

      const targetTotalLocal = isMorning || (course.level || '').toLowerCase().includes('primar') ? 5 : 6;
      const postCountLocal = Math.max(1, targetTotalLocal - preCountLocal);
      const postDuration = Math.floor((endT - bEnd) / postCountLocal);
      for (let i = 0; i < postCountLocal; i++) {
        let sTime = bEnd + i * postDuration;
        let eTime = i === postCountLocal - 1 ? endT : sTime + postDuration;
        slots.push({
          start: fromMins(sTime),
          end: fromMins(eTime),
          isBreak: false,
          label: `${preCountLocal + i + 1}ra Hora`
        });
      }

      return slots;
    };

    const courseSlots = getSlotsForCourse(selectedCourse);

    return weekDays.map((day) => {
      // Filtrar materias registradas para este día
      const dayEntries = state.schedule.filter((s) => {
        const cId = s.courseId || s.course_id;
        if (cId !== selectedCourse.id) return false;

        const sDay = s.day || '';
        if (sDay && normalize(sDay) === normalize(day)) return true;

        const tb = state.timeBlocks.find((b) => b.id === (s.timeBlockId || s.time_block_id));
        return tb && normalize(tb.day) === normalize(day);
      });

      // Mapear cada slot de la rejilla con la materia asignada, libre o recreo
      const entries = courseSlots.map((slot) => {
        if (slot.isBreak) {
          return {
            isBreak: true,
            isFree: false,
            label: slot.label,
            sTime: slot.start,
            eTime: slot.end,
            startMinutes: getMinutes(slot.start)
          };
        }

        // Buscar si hay una clase en esta hora aproximada
        const slotMins = getMinutes(slot.start);
        const matchingEntry = dayEntries.find((e) => {
          const eTime = e.start_time || e.startTime;
          if (eTime) {
            return Math.abs(getMinutes(eTime) - slotMins) <= 25;
          }
          const tb = state.timeBlocks.find((b) => b.id === (e.timeBlockId || e.time_block_id));
          const tbTime = tb?.startTime || tb?.start_time;
          return tbTime && Math.abs(getMinutes(tbTime) - slotMins) <= 25;
        });

        if (matchingEntry) {
          const tb = state.timeBlocks.find(
            (b) => b.id === (matchingEntry.timeBlockId || matchingEntry.time_block_id)
          );
          const sub = state.subjects.find(
            (sub) => sub.id === (matchingEntry.subjectId || matchingEntry.subject_id)
          );
          const tea = state.teachers.find(
            (t) => t.id === (matchingEntry.teacherId || matchingEntry.teacher_id)
          );
          const sTime =
            matchingEntry.start_time ||
            matchingEntry.startTime ||
            tb?.startTime ||
            tb?.start_time ||
            slot.start;
          const eTime =
            matchingEntry.end_time ||
            matchingEntry.endTime ||
            tb?.endTime ||
            tb?.end_time ||
            slot.end;

          return {
            ...matchingEntry,
            isBreak: false,
            isFree: false,
            label: slot.label,
            sTime,
            eTime,
            sub,
            tea,
            startMinutes: getMinutes(sTime)
          };
        }

        return {
          isBreak: false,
          isFree: true,
          label: slot.label,
          sTime: slot.start,
          eTime: slot.end,
          startMinutes: getMinutes(slot.start)
        };
      });

      return { day, entries };
    });
  }, [
    selectedCourse,
    state.schedule,
    state.timeBlocks,
    state.subjects,
    state.teachers,
    state.breakPreferences
  ]);

  // Próximas actividades del centro
  const upcomingActivities = useMemo(() => {
    const todayStr = currentTime.toISOString().split('T')[0];
    return (state.activities || [])
      .filter((act) => act.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [state.activities, currentTime]);

  const suggestedTeacher = useMemo(() => {
    if (!profile || !state.teachers) return null;
    return state.teachers.find((t) => {
      const tName = normalize(t.name);
      const pName = profile.full_name ? normalize(profile.full_name) : '';
      const tEmail = t.email ? t.email.toLowerCase().trim() : '';
      const pEmail = profile.email ? profile.email.toLowerCase().trim() : '';
      return (pName && tName === pName) || (pEmail && tEmail === pEmail);
    });
  }, [state.teachers, profile]);

  return (
    <div className="space-y-8 pb-20 animate-fade-in">
      {/* SELECCIONAR O CAMBIAR DOCENTE */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <User size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase">
              {currentTeacher ? `Hola, ${currentTeacher.name}` : 'Acceso Docente'}
            </h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              {currentTeacher
                ? 'Área Académica: ' + (currentTeacher.area || 'General')
                : 'Selecciona tu cuenta docente'}
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto shrink-0">
          <div className="w-full md:w-64">
            <select
              value={selectedTeacherId}
              onChange={(e) => handleTeacherChange(e.target.value)}
              className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-black text-xs uppercase tracking-wider"
              disabled={!!profile?.teacher_id}
            >
              <option value="">-- SELECCIONAR MI PERFIL --</option>
              {state.teachers
                .filter((t) => t.role === 'teacher' || t.role === 'management_teacher')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name.toUpperCase()}
                  </option>
                ))}
            </select>
          </div>
          {selectedTeacherId && profile?.teacher_id !== selectedTeacherId && (
            <button
              onClick={() => handleLinkTeacher(selectedTeacherId)}
              disabled={isLinking}
              className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-2xl transition-all font-black text-[9px] uppercase tracking-widest shadow-md shrink-0 cursor-pointer animate-pulse"
            >
              <CheckCircle2 size={12} />
              {isLinking ? 'Vinculando...' : 'Vincular Cuenta'}
            </button>
          )}
          {profile?.teacher_id && (
            <span className="text-[8px] font-black text-indigo-700 bg-indigo-50 border border-indigo-150 px-3 py-2.5 rounded-xl uppercase tracking-widest shrink-0">
              ✓ Vínculo Activo
            </span>
          )}
          {selectedTeacherId && (
            <button
              onClick={() => setShowWeeklyScheduleModal(true)}
              className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-2xl transition-all font-black text-[9px] uppercase tracking-widest shadow-md shrink-0 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <CalendarDays size={12} />
              Ver Mi Horario Completo
            </button>
          )}
        </div>
      </div>

      {!selectedTeacherId ? (
        <div className="space-y-6 max-w-xl mx-auto mt-6 animate-in fade-in slide-in-from-bottom-5 duration-300">
          {suggestedTeacher && (
            <div className="bg-emerald-50 border-2 border-emerald-300 p-6 rounded-[2.5rem] text-center shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-xl rounded-full"></div>
              <CheckCircle2 className="mx-auto mb-4 text-emerald-600 animate-bounce" size={48} />
              <h4 className="text-base font-black uppercase text-emerald-950 tracking-tight">
                ¿Eres {suggestedTeacher.name}?
              </h4>
              <p className="text-xs text-emerald-800 mt-2 leading-relaxed font-semibold">
                Hemos detectado que tu nombre de usuario o correo coincide con este perfil docente.
                Vincula tu cuenta de forma permanente para acceder automáticamente en tus próximos
                ingresos.
              </p>
              <button
                onClick={() => handleLinkTeacher(suggestedTeacher.id)}
                disabled={isLinking}
                className="mt-5 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 cursor-pointer"
              >
                {isLinking ? 'Vinculando...' : 'Sí, Vincular de Forma Permanente'}
              </button>
            </div>
          )}

          <div className="p-12 text-center bg-white rounded-[3rem] border border-slate-100 shadow-2xl">
            <ClipboardList className="mx-auto mb-6 text-indigo-600 animate-pulse" size={64} />
            <h3 className="text-xl font-black text-slate-900 uppercase">Panel Docente</h3>
            <p className="text-slate-500 mt-2 text-sm leading-relaxed">
              Por favor, selecciona tu nombre del listado superior para acceder a tu agenda escolar,
              horarios de cursos, asignación de tareas, comunicados y control de excusas.
            </p>
            <p className="text-[10px] text-slate-400 mt-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 font-bold uppercase tracking-wider">
              💡 Una vez seleccionado tu perfil, haz clic en "Vincular Cuenta" para guardar la
              configuración de forma definitiva en la nube.
            </p>
          </div>
        </div>
      ) : showCreateForm ? (
        // FORMULARIO DE CREACIÓN DE TAREA / COMUNICADO
        <div className="relative">
          <button
            onClick={() => setShowCreateForm(false)}
            className="absolute top-6 right-6 z-20 w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-all shadow-md"
          >
            <X size={20} />
          </button>
          <TeacherTaskAnnouncement
            userData={profile}
            initialCourseId={selectedCourse?.id}
            onClose={() => setShowCreateForm(false)}
          />
        </div>
      ) : selectedCourse ? (
        // VISTA COMPLETA DEL CURSO SELECCIONADO
        <div className="space-y-6">
          {/* HEADER VISTA CURSO */}
          <div className="bg-slate-950 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 blur-[100px] rounded-full -mr-40 -mt-40"></div>
            <div className="relative z-10 flex items-center gap-4">
              <button
                onClick={() => setSelectedCourse(null)}
                className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center text-white transition-all"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em]">
                  GESTIÓN Y SEGUIMIENTO DE CURSO
                </span>
                <h3 className="text-3xl font-black uppercase tracking-tight mt-1">
                  {selectedCourse.grade} {selectedCourse.section}
                </h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                  {selectedCourse.level} • Tanda {selectedCourse.tanda}
                </p>
              </div>
            </div>

            <div className="relative z-10 flex gap-3 shrink-0">
              <button
                onClick={() => {
                  setInitialFormType('task');
                  setShowCreateForm(true);
                }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-2xl transition-all font-black text-[9px] uppercase tracking-widest shadow-lg"
              >
                <Plus size={14} /> Asignar Tarea
              </button>
              <button
                onClick={() => {
                  setInitialFormType('announcement');
                  setShowCreateForm(true);
                }}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-5 py-3 rounded-2xl transition-all font-black text-[9px] uppercase tracking-widest shadow-lg"
              >
                <Bell size={14} /> Publicar Anuncio
              </button>
            </div>
          </div>

          {/* TABS DE CURSO */}
          <div className="flex gap-2 bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm max-w-fit overflow-x-auto">
            {[
              { id: 'horario', label: 'Horario del Curso', icon: CalendarIcon },
              { id: 'tareas', label: 'Tareas del Curso', icon: ClipboardList },
              { id: 'comunicados', label: 'Anuncios', icon: Bell },
              { id: 'excusas', label: 'Excusas y Reportes', icon: AlertCircle }
            ].map((tab: any) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCourseTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                    activeCourseTab === tab.id
                      ? 'bg-slate-900 text-white shadow-xl'
                      : 'text-slate-400 hover:text-slate-800'
                  }`}
                >
                  <Icon size={14} /> {tab.label}
                </button>
              );
            })}
          </div>

          {/* CONTENIDOS TABS */}
          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl min-h-[400px]">
            {/* HORARIO DEL CURSO */}
            {activeCourseTab === 'horario' && (
              <div className="space-y-6">
                <h4 className="text-lg font-black uppercase text-slate-850 border-b border-slate-50 pb-3 mb-6">
                  Horario de Clases Semanal
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {selectedCourseSchedule.map((d: any) => (
                    <div
                      key={d.day}
                      className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col min-h-[300px]"
                    >
                      <div className="text-center font-black text-[10px] uppercase text-indigo-600 bg-indigo-50 py-1.5 rounded-lg mb-3 tracking-widest">
                        {d.day}
                      </div>

                      <div className="space-y-2 flex-1">
                        {d.entries.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-center text-slate-400 font-bold italic text-[9px] py-10">
                            Sin clases
                          </div>
                        ) : (
                          d.entries.map((c: any, index: number) => {
                            if (c.isBreak) {
                              return (
                                <div
                                  key={index}
                                  className="bg-amber-50 p-3 rounded-xl border border-amber-200 shadow-sm flex flex-col justify-between"
                                >
                                  <div>
                                    <p className="text-[10px] font-black text-amber-700 leading-tight uppercase">
                                      🔔 {c.label}
                                    </p>
                                    <p className="text-[8px] font-bold text-amber-600 uppercase mt-0.5">
                                      Receso General
                                    </p>
                                  </div>
                                  <span className="text-[8px] font-black text-amber-700 mt-2 block bg-amber-100/50 w-fit px-1.5 py-0.5 rounded">
                                    {c.sTime} - {c.eTime}
                                  </span>
                                </div>
                              );
                            }

                            if (c.isFree) {
                              return (
                                <div
                                  key={index}
                                  className="bg-slate-55/50 p-3 rounded-xl border border-slate-200 border-dashed flex flex-col justify-between opacity-60"
                                >
                                  <div>
                                    <p className="text-[10px] font-bold text-slate-450 leading-tight uppercase">
                                      {c.label}
                                    </p>
                                    <p className="text-[8px] font-semibold text-slate-400 uppercase mt-0.5">
                                      Hora Libre
                                    </p>
                                  </div>
                                  <span className="text-[8px] font-semibold text-slate-400 mt-2 block bg-slate-100/50 w-fit px-1.5 py-0.5 rounded">
                                    {c.sTime} - {c.eTime}
                                  </span>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={index}
                                className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between"
                              >
                                <div>
                                  <p className="text-[10px] font-black text-slate-900 leading-tight uppercase line-clamp-2">
                                    {c.sub?.name}
                                  </p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                                    {c.tea?.name}
                                  </p>
                                </div>
                                <span className="text-[8px] font-black text-indigo-600 mt-2 block bg-indigo-50/50 w-fit px-1.5 py-0.5 rounded">
                                  {c.sTime} - {c.eTime}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAREAS DE CURSO */}
            {activeCourseTab === 'tareas' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-50 pb-3 mb-6">
                  <h4 className="text-lg font-black uppercase text-slate-850">Tareas Asignadas</h4>
                  <span className="bg-indigo-50 text-indigo-600 font-black text-[10px] px-3 py-1 rounded-full">
                    {courseTasks.length} Tareas
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {courseTasks.length === 0 ? (
                    <div className="col-span-2 text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      <ClipboardList className="mx-auto mb-4 text-slate-300" size={48} />
                      <p className="text-xs font-black text-slate-900 uppercase">
                        Sin tareas publicadas
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        Utiliza el botón superior para asignar la primera tarea al grupo.
                      </p>
                    </div>
                  ) : (
                    courseTasks.map((t: any) => {
                      const isLate = new Date(t.due_date) < new Date();
                      const subject = state.subjects.find((s) => s.id === t.subject_id);
                      return (
                        <div
                          key={t.id}
                          className="p-5 bg-slate-50/50 rounded-2xl border-2 border-slate-100 hover:border-indigo-200 transition-all flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex justify-between items-start gap-3 mb-2">
                              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-black uppercase tracking-widest">
                                {subject?.name || 'General'}
                              </span>
                              <span
                                className={`text-[8px] font-black px-2 py-0.5 rounded ${isLate ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}
                              >
                                {isLate ? 'VENCIDA' : 'ACTIVA'}
                              </span>
                            </div>
                            <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight mt-1">
                              {t.title}
                            </h5>
                            <p className="text-xs text-slate-600 mt-2 leading-relaxed line-clamp-3">
                              {t.description}
                            </p>
                          </div>

                          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[9px] font-black text-slate-400">
                            <span>ENTREGA:</span>
                            <span>{new Date(t.due_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ANUNCIOS DE CURSO */}
            {activeCourseTab === 'comunicados' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-50 pb-3 mb-6">
                  <h4 className="text-lg font-black uppercase text-slate-850">
                    Circulares del Curso
                  </h4>
                  <span className="bg-amber-50 text-amber-600 font-black text-[10px] px-3 py-1 rounded-full">
                    {courseAnnouncements.length} Publicados
                  </span>
                </div>

                <div className="space-y-4">
                  {courseAnnouncements.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-2xl border border-slate-100">
                      <Bell className="mx-auto mb-4 text-slate-300 animate-bounce" size={48} />
                      <p className="text-xs font-black text-slate-900 uppercase">
                        Sin anuncios activos
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        Comunícales información importante de forma rápida.
                      </p>
                    </div>
                  ) : (
                    courseAnnouncements.map((a: any) => (
                      <div
                        key={a.id}
                        className="p-5 bg-slate-50/50 rounded-2xl border border-slate-150"
                      >
                        <div className="flex justify-between items-start gap-3">
                          <h5 className="text-sm font-black text-slate-900 uppercase">{a.title}</h5>
                          <span className="text-[8px] font-black text-slate-400">
                            {new Date(a.created_at || a.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">{a.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* EXCUSAS Y COMUNICACIONES */}
            {activeCourseTab === 'excusas' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-50 pb-3 mb-6">
                  <h4 className="text-lg font-black uppercase text-slate-850">
                    Control de Excusas y Justificaciones
                  </h4>
                  <span className="bg-rose-50 text-rose-600 font-black text-[10px] px-3 py-1 rounded-full">
                    {courseCommunications.length} Reportes
                  </span>
                </div>

                <div className="space-y-4">
                  {courseCommunications.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-2xl border border-slate-100">
                      <AlertCircle className="mx-auto mb-4 text-slate-300" size={48} />
                      <p className="text-xs font-black text-slate-900 uppercase">
                        Sin justificaciones enviadas
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        Los avisos de enfermedad, inasistencia o tardanza de los padres aparecerán
                        aquí.
                      </p>
                    </div>
                  ) : (
                    courseCommunications.map((c: any) => (
                      <div
                        key={c.id}
                        className="p-5 bg-white border-2 border-rose-100 rounded-2xl shadow-sm relative"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-lg text-[8px] font-black uppercase tracking-widest">
                            {c.motive || 'Excusa'}
                          </span>
                          <span className="text-[8px] font-black text-slate-400">
                            • {new Date(c.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs font-black text-slate-900 uppercase">
                          {c.sender_name}
                        </p>
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">{c.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        // DASHBOARD GENERAL DOCENTE
        <div className="space-y-8">
          {/* MODO ALARMA Y NOTIFICACIONES */}
          <ExcuseAlert />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* HOY Y CLASES EN VIVO */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-200 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-4 h-full bg-indigo-600"></div>

                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-50">
                  <h3 className="text-base font-black uppercase tracking-widest text-slate-900 flex items-center gap-3">
                    <Activity className="text-indigo-600 animate-pulse" size={20} /> Mi Agenda
                    Escolar ({currentDay})
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
                          <BookOpen size={12} /> Curso: {activeClassNow.course?.grade}{' '}
                          {activeClassNow.course?.section} ({activeClassNow.course?.level})
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-6 text-center text-slate-500 font-bold text-xs italic">
                    {(() => {
                      const currentRecess = teacherTodaySchedule.find((c) => c.isBreak && c.isNow);
                      if (currentRecess) {
                        return `🔔 ¡ESTÁS EN RECREO ACTUALMENTE! (${currentRecess.sTime} - ${currentRecess.eTime})`;
                      }
                      return teacherTodaySchedule.length > 0 &&
                        currentTimeMinutes >
                          teacherTodaySchedule[teacherTodaySchedule.length - 1].startMinutes
                        ? '🔔 Has finalizado tu jornada escolar por hoy.'
                        : '☕ No tienes clases asignadas a esta hora exacta.';
                    })()}
                  </div>
                )}

                {/* TIMELINE DE HOY */}
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">
                  Clases Asignadas para Hoy
                </h4>
                <div className="space-y-3">
                  {teacherTodaySchedule.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 font-bold italic bg-slate-50 rounded-2xl text-[10px]">
                      No tienes clases presenciales asignadas para el día de hoy.
                    </div>
                  ) : (
                    teacherTodaySchedule.map((c) => {
                      if (c.isBreak) {
                        return (
                          <div
                            key={c.id}
                            className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
                              c.isNow
                                ? 'bg-amber-50 border-amber-400 shadow-lg animate-pulse'
                                : 'bg-amber-50/50 border-amber-200/50'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div
                                className={`w-12 h-10 rounded-lg flex items-center justify-center font-black text-xs ${c.isNow ? 'bg-amber-500 text-white shadow-md' : 'bg-amber-600 text-white'}`}
                              >
                                {c.sTime}
                              </div>
                              <div>
                                <p className="text-sm font-black tracking-tight text-amber-900">
                                  🔔 {c.label}
                                </p>
                                <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mt-0.5">
                                  Receso Escolar
                                </p>
                              </div>
                            </div>
                            <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 uppercase">
                              {c.durationMinutes || 30} Min
                            </span>
                          </div>
                        );
                      }

                      return (
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
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                {c.course?.level} • {c.course?.grade}
                                {c.course?.section}
                              </p>
                            </div>
                          </div>
                          {c.room && (
                            <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 uppercase">
                              <MapPin size={10} className="text-indigo-600" /> {c.room.name}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* CURSOS ASIGNADOS (GRID DE GESTIÓN) */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 blur-xl rounded-full"></div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-300 mb-4 flex items-center gap-2">
                  <BookOpen size={16} className="text-indigo-400" /> Mis Cursos dictados
                </h3>

                <div className="space-y-3">
                  {myCourses.length === 0 ? (
                    <p className="text-xs font-bold opacity-70 italic">
                      No tienes cursos vinculados en el horario escolar.
                    </p>
                  ) : (
                    myCourses.map((c) => (
                      <div
                        key={c.id}
                        className="bg-white/10 hover:bg-white/20 border border-white/15 p-4 rounded-2xl flex items-center justify-between transition-all group"
                      >
                        <div>
                          <p className="text-sm font-black uppercase tracking-tight text-white">
                            {c.grade} {c.section}
                          </p>
                          <p className="text-[8px] font-bold opacity-60 uppercase mt-0.5">
                            {c.level}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedCourse(c);
                            setActiveCourseTab('horario');
                          }}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[9px] uppercase tracking-widest px-4 py-2 rounded-xl transition-all"
                        >
                          Entrar
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* TENDENCIA Y ACTIVIDADES */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
                  Agenda General del Centro
                </h4>
                <div className="space-y-3">
                  {upcomingActivities.length === 0 ? (
                    <p className="text-slate-400 italic text-[10px] font-bold">
                      Sin eventos próximos programados.
                    </p>
                  ) : (
                    upcomingActivities.map((act) => (
                      <div
                        key={act.id}
                        className="p-3 bg-slate-50 border border-slate-100 rounded-xl"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-[10px] font-black text-slate-900 uppercase truncate max-w-[70%]">
                            {act.title}
                          </p>
                          <span className="text-[8px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">
                            {act.date.split('-').reverse().slice(0, 2).join('/')}
                          </span>
                        </div>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">
                          {act.startTime} - {act.endTime}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HORARIO SEMANAL COMPLETO DEL DOCENTE */}
      {showWeeklyScheduleModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
          {/* Estilos especiales de impresión embebidos */}
          <style
            dangerouslySetInnerHTML={{
              __html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #teacher-weekly-schedule-print-area, #teacher-weekly-schedule-print-area * {
                visibility: visible !important;
              }
              #teacher-weekly-schedule-print-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
                background: white !important;
                box-shadow: none !important;
                border: none !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `
            }}
          />

          <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-100 max-w-6xl w-full overflow-hidden relative animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            {/* Cabecera del Modal con controles */}
            <div className="bg-indigo-600 p-6 md:p-8 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-indigo-700 shrink-0 no-print">
              <div>
                <span className="px-3 py-1 bg-white/25 text-white rounded-full text-[9px] font-black uppercase tracking-widest">
                  Mi Agenda Completa
                </span>
                <h3 className="text-2xl font-black uppercase tracking-tight mt-2 flex items-center gap-2">
                  <CalendarIcon size={22} className="text-indigo-200" /> Horario Semanal Completo
                </h3>
                <p className="text-xs font-bold text-indigo-200 mt-1 uppercase tracking-wide">
                  Docente: {currentTeacher?.name} • Área: {currentTeacher?.area || 'General'}
                </p>
              </div>

              {/* Botones de acción del Modal */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={() => {
                    const element = document.getElementById('teacher-weekly-schedule-print-area');
                    if (!element) return;
                    html2canvas(element, {
                      scale: 2.5,
                      useCORS: true,
                      backgroundColor: '#ffffff'
                    })
                      .then((canvas) => {
                        const link = document.createElement('a');
                        link.download = `Horario_Semanal_${(currentTeacher?.name || 'Docente').replace(/\s+/g, '_')}.png`;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                      })
                      .catch((err) => {
                        console.error('Error exporting schedule image:', err);
                      });
                  }}
                  className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-2xl transition-all font-black text-[9px] uppercase tracking-widest shadow-md cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Download size={12} />
                  Descargar Imagen
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-indigo-750 hover:bg-indigo-800 text-white px-5 py-3 rounded-2xl transition-all font-black text-[9px] uppercase tracking-widest shadow-md cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Printer size={12} />
                  Imprimir Horario
                </button>
                <button
                  onClick={() => setShowWeeklyScheduleModal(false)}
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all shadow-md shrink-0 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Contenido / Cuadrícula del Horario */}
            <div className="overflow-y-auto p-6 md:p-8 flex-1 bg-slate-50/50">
              <div
                id="teacher-weekly-schedule-print-area"
                className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden"
              >
                {/* Decoración del fondo premium */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/20 blur-3xl rounded-full pointer-events-none"></div>

                {/* Cabecera del reporte impreso */}
                <div className="mb-6 pb-6 border-b border-slate-100 flex justify-between items-end">
                  <div>
                    <h2 className="text-xl font-black text-indigo-950 uppercase tracking-tight">
                      EDUGEST • HORARIO DE DOCENTE
                    </h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                      Profesor(a):{' '}
                      <span className="text-slate-805 font-black">{currentTeacher?.name}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg tracking-wider">
                      Tanda Escolar Semanal
                    </span>
                  </div>
                </div>

                {/* Tabla de Horario Semanal */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="p-3 text-left font-black text-[9px] uppercase tracking-widest text-slate-400 bg-slate-50 rounded-l-xl w-32">
                          Hora / Bloque
                        </th>
                        {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map((day) => (
                          <th
                            key={day}
                            className="p-3 text-center font-black text-[9px] uppercase tracking-widest text-slate-500 bg-slate-50"
                          >
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teacherWeeklyScheduleMatrix.slots.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-20 text-center text-slate-400 italic font-bold text-xs bg-slate-50/50 rounded-b-xl"
                          >
                            No tienes ninguna clase o recreo asignado en el sistema escolar semanal.
                          </td>
                        </tr>
                      ) : (
                        teacherWeeklyScheduleMatrix.slots.map((slot) => (
                          <tr key={slot.start} className="hover:bg-slate-50/30 transition-all">
                            {/* Celda de Hora */}
                            <td className="p-4 align-middle">
                              <span className="flex flex-col">
                                <span className="text-xs font-black text-slate-900 tracking-tight">
                                  {slot.start.substring(0, 5)} - {slot.end.substring(0, 5)}
                                </span>
                                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">
                                  {slot.label}
                                </span>
                              </span>
                            </td>

                            {/* Celdas de Días */}
                            {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map((day) => {
                              const cell = teacherWeeklyScheduleMatrix.matrix[slot.start]?.[day];

                              if (!cell) {
                                return <td key={day} className="p-2 align-middle"></td>;
                              }

                              if (cell.isBreak) {
                                return (
                                  <td key={day} className="p-2 align-middle">
                                    <div className="bg-amber-50 border-2 border-amber-200 text-amber-800 rounded-2xl p-3 text-center hover:scale-[1.01] transition-all">
                                      <p className="text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1">
                                        🔔 {cell.label}
                                      </p>
                                    </div>
                                  </td>
                                );
                              }

                              if (cell.isFree) {
                                return (
                                  <td key={day} className="p-2 align-middle">
                                    <div className="bg-slate-50/60 border border-dashed border-slate-200 rounded-2xl p-3 text-center text-slate-400 hover:bg-slate-50 transition-all">
                                      <p className="text-[9px] font-black uppercase tracking-widest italic opacity-60">
                                        Hora Libre
                                      </p>
                                    </div>
                                  </td>
                                );
                              }

                              // Celda de clase activa
                              return (
                                <td key={day} className="p-2 align-middle">
                                  <div className="bg-indigo-50/80 border-2 border-indigo-150 rounded-2xl p-3.5 text-left relative overflow-hidden group hover:border-indigo-400 hover:shadow-lg transition-all duration-300">
                                    <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-500/5 blur-md rounded-full"></div>
                                    <h5 className="text-xs font-black text-indigo-950 uppercase tracking-tight leading-tight">
                                      {cell.sub?.name}
                                    </h5>
                                    <p className="text-[9px] font-black text-indigo-600 mt-1 uppercase tracking-tight">
                                      Curso: {cell.course?.grade} {cell.course?.section}
                                    </p>
                                    {cell.room && (
                                      <p className="text-[8px] font-bold text-slate-400 mt-1 flex items-center gap-1.5 uppercase">
                                        <MapPin size={8} className="text-indigo-500" />{' '}
                                        {cell.room.name}
                                      </p>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Pie de página del Modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0 no-print">
              Edugest • Sistema de Gestión Académica Multi-Tenant
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
