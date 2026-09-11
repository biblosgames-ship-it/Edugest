import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { dataService } from '../services/dataService';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  CalendarDays,
  Pencil,
  Trash2,
  Building2,
  UserCheck
} from 'lucide-react';
import { ExcuseAlert } from './ExcuseAlert';
import { TeacherTaskAnnouncement } from './TeacherTaskAnnouncement';
import { useNotifications } from '../hooks/useNotifications';
import { useTeacherIdentity } from '../utils/teacherUtils';

const toMins = (val: string) => {
  if (!val) return 0;
  const clean = (val || '').replace(/[^0-9:APMapm]/g, '').trim();
  const isPM = clean.toUpperCase().includes('PM');
  const isAM = clean.toUpperCase().includes('AM');
  const parts = clean.replace(/[APMapm]/g, '').split(':').map(Number);
  let h = parts[0] || 0;
  const m = parts[1] || 0;
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return h * 60 + m;
};

const fromMins = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const TeacherDashboard = ({
  userData: profile,
  onViewChange
}: {
  userData: any;
  onViewChange?: (view: string) => void;
}) => {
  const { state, selectedYear, center } = useApp();
  const { unreadCount } = useNotifications();
  const { isSameTeacher } = useTeacherIdentity();

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
  const [editingTask, setEditingTask] = useState<any>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);
  const [initialFormType, setInitialFormType] = useState<'task' | 'announcement'>('task');
  const [showWeeklyScheduleModal, setShowWeeklyScheduleModal] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowWeeklyScheduleModal(false);
      }
    };
    if (showWeeklyScheduleModal) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showWeeklyScheduleModal]);

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta tarea publicada?')) return;
    try {
      await dataService.deleteTask(taskId);
      setCourseTasks((prev) => prev.filter((t) => t.id !== taskId));
      alert('¡Tarea eliminada con éxito!');
    } catch (err: any) {
      console.error('Error al eliminar tarea:', err);
      alert('Error al eliminar la tarea.');
    }
  };

  const handleDeleteAnnouncement = async (annId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta circular?')) return;
    try {
      await dataService.deleteAnnouncement(annId);
      setCourseAnnouncements((prev) => prev.filter((a) => a.id !== annId));
      alert('¡Circular eliminada con éxito!');
    } catch (err: any) {
      console.error('Error al eliminar circular:', err);
      alert('Error al eliminar la circular.');
    }
  };
  const [hidePeriodAlert, setHidePeriodAlert] = useState<boolean>(() => {
    return localStorage.getItem('edugens_hide_period_alert') === 'true';
  });
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

  const format12h = (timeStr: string): string => {
    if (!timeStr) return '';
    const clean = timeStr.trim();
    const parts = clean.split(':');
    if (parts.length < 2) return clean;
    let h = parseInt(parts[0], 10);
    const m = parts[1].substring(0, 2);
    if (isNaN(h)) return clean;
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${m}`;
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
    return (
      state.teachers.find((t) => isSameTeacher(t.id, selectedTeacherId) || t.id === selectedTeacherId) ||
      state.teachers.find((t) => t.id === selectedTeacherId)
    );
  }, [state.teachers, selectedTeacherId, isSameTeacher]);

  // Cargar datos al entrar a un curso
  useEffect(() => {
    if (!selectedCourse) return;

    const loadCourseData = async () => {
      try {
        const targetCid = selectedCourse?.center_id || profile?.center_id || center?.id;
        const [tasksData, annData, commsData] = await Promise.all([
          dataService.getTasks(selectedCourse.id),
          dataService.getAnnouncements(selectedCourse.id),
          dataService.getCommunications(profile?.id || '', profile?.role || 'teacher', targetCid)
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

  const findOfficialSchedule = useCallback((schedules: any[], levelName: string, shiftName: string) => {
    if (!schedules || schedules.length === 0) return null;
    const lNorm = (levelName || '').toLowerCase().substring(0, 3);
    const sNorm = (shiftName || '').toLowerCase().substring(0, 3);

    let match = schedules.find((ls: any) => {
      const lsLvl = (ls.level || '').toLowerCase();
      const lsShift = (ls.shift || '').toLowerCase();
      const lvlMatch = !lNorm || lsLvl.substring(0, 3) === lNorm || lNorm.includes(lsLvl.substring(0, 3));
      const shiftMatch =
        lsShift.substring(0, 3) === sNorm ||
        (sNorm === 'mat' && (lsShift.includes('mañ') || lsShift.includes('ext') || lsShift.includes('com'))) ||
        (sNorm === 'ves' && (lsShift.includes('tar') || lsShift.includes('ves')));
      return lvlMatch && shiftMatch;
    });

    if (!match) {
      match = schedules.find((ls: any) => {
        const lsShift = (ls.shift || '').toLowerCase();
        return (
          lsShift.substring(0, 3) === sNorm ||
          (sNorm === 'mat' && (lsShift.includes('mañ') || lsShift.includes('ext') || lsShift.includes('com'))) ||
          (sNorm === 'ves' && (lsShift.includes('tar') || lsShift.includes('ves')))
        );
      });
    }
    return match || null;
  }, []);

  const isCourseFirstCycle = useCallback((course: any) => {
    const cGrade = (course?.grade || course?.name || '').toLowerCase();
    const cCycle = (course?.cycle || '').toLowerCase();

    if (cCycle.includes('primer') || cCycle.includes('1er') || cCycle.includes('1')) return true;
    if (cCycle.includes('segundo') || cCycle.includes('2do') || cCycle.includes('2')) {
      const hasStrictC1Grade =
        /^[1-3]/.test(cGrade) ||
        cGrade.includes('1ro') ||
        cGrade.includes('1ero') ||
        cGrade.includes('2do') ||
        cGrade.includes('3ro') ||
        cGrade.includes('7mo') ||
        cGrade.includes('8vo') ||
        cGrade.includes('9no');
      if (!hasStrictC1Grade) return false;
    }

    if (
      cGrade.includes('segundo ciclo') ||
      cGrade.includes('2do ciclo') ||
      cGrade.includes('2do. ciclo') ||
      cGrade.includes('2do.ciclo')
    ) {
      return false;
    }
    if (
      cGrade.includes('primer ciclo') ||
      cGrade.includes('1er ciclo') ||
      cGrade.includes('1er. ciclo') ||
      cGrade.includes('1er.ciclo')
    ) {
      return true;
    }

    return (
      /^[1-3]/.test(cGrade) ||
      cGrade.includes('1ro') ||
      cGrade.includes('2do') ||
      cGrade.includes('3ro') ||
      cGrade.includes('1ero') ||
      cGrade.includes('1°') ||
      cGrade.includes('2°') ||
      cGrade.includes('3°') ||
      cGrade.includes('primero') ||
      (cGrade.includes('segundo') && !cGrade.includes('ciclo')) ||
      cGrade.includes('tercero') ||
      cGrade.includes('primer') ||
      cGrade.includes('tercer') ||
      cGrade.includes('7mo') ||
      cGrade.includes('8vo') ||
      cGrade.includes('9no') ||
      cGrade.includes('septimo') ||
      cGrade.includes('séptimo') ||
      cGrade.includes('octavo') ||
      cGrade.includes('noveno')
    );
  }, []);

  const isCourseSecondCycle = useCallback((course: any) => {
    const cGrade = (course?.grade || course?.name || '').toLowerCase();
    const cCycle = (course?.cycle || '').toLowerCase();

    if (cCycle.includes('segundo') || cCycle.includes('2do') || cCycle.includes('2')) return true;
    if (cCycle.includes('primer') || cCycle.includes('1er') || cCycle.includes('1')) return false;

    if (
      cGrade.includes('segundo ciclo') ||
      cGrade.includes('2do ciclo') ||
      cGrade.includes('2do. ciclo') ||
      cGrade.includes('2do.ciclo')
    ) {
      return true;
    }
    if (
      cGrade.includes('primer ciclo') ||
      cGrade.includes('1er ciclo') ||
      cGrade.includes('1er. ciclo') ||
      cGrade.includes('1er.ciclo')
    ) {
      return false;
    }

    return (
      /^[4-6]/.test(cGrade) ||
      cGrade.includes('4to') ||
      cGrade.includes('5to') ||
      cGrade.includes('6to') ||
      cGrade.includes('cuarto') ||
      cGrade.includes('quinto') ||
      cGrade.includes('sexto') ||
      cGrade.includes('4°') ||
      cGrade.includes('5°') ||
      cGrade.includes('6°') ||
      cGrade.includes('10mo') ||
      cGrade.includes('11mo') ||
      cGrade.includes('12mo') ||
      cGrade.includes('decimo') ||
      cGrade.includes('décimo')
    );
  }, []);

  const getSlotsForCourse = useCallback(
    (course: any) => {
      if (!course) return [];
      const cTanda = (course?.tanda || '').toLowerCase();
      const cLevel = (course?.level || '').toLowerCase();
      const courseIsMorning = cTanda
        ? !cTanda.includes('ves') && !cTanda.includes('tar')
        : !cLevel.includes('secun');
      const courseShiftName = courseIsMorning ? 'Matutina' : 'Vespertina';
      const courseOfficial = findOfficialSchedule(state.levelSchedules, course?.level, courseShiftName);

      const levelNormCourse = (course?.level || '').toLowerCase();
      const isSecundaria = levelNormCourse.includes('secun');
      const targetTotalLocal = isSecundaria ? 6 : (courseOfficial?.periods_per_day || 5);

      let courseStartT = courseIsMorning ? 480 : 840;
      let courseEndT = courseIsMorning ? (isSecundaria ? 750 : 720) : (isSecundaria ? 1095 : 1050);
      if (courseOfficial?.start_time) {
        let s = toMins(courseOfficial.start_time);
        if (!courseIsMorning && s < 720 && s > 0) s += 720;
        courseStartT = s;
      }
      if (courseOfficial?.end_time) {
        let e = toMins(courseOfficial.end_time);
        if (!courseIsMorning && e < 720 && e > 0) e += 720;
        courseEndT = e;
      }

      const isC1 = isCourseFirstCycle(course);
      const isC2 = isCourseSecondCycle(course);

      const shiftBPs = (state.breakPreferences || []).filter((bp: any) => {
        let bpMins = toMins(bp.startTime || bp.start_time);
        if (!courseIsMorning && bpMins < 720 && bpMins > 0) bpMins += 720;
        const isBpMorning = bpMins < 780;
        return courseIsMorning === isBpMorning;
      });

      const levelNorm = (course?.level || '').toLowerCase();

      const matchesLevel = (bp: any) => {
        const bpLevel = (bp.level || '').toLowerCase();
        if (!bpLevel) return false;
        return (
          bpLevel.substring(0, 3) === levelNorm.substring(0, 3) ||
          levelNorm.includes(bpLevel.substring(0, 3)) ||
          bpLevel.includes(levelNorm.substring(0, 3))
        );
      };

      const matchesCycle = (bp: any) => {
        const bpCycle = (bp.cycle || '').toLowerCase();
        if (!bpCycle || bpCycle.includes('gen') || bpCycle.includes('todo')) return false;
        if (isC1 && (bpCycle.includes('primer') || bpCycle.includes('1er') || bpCycle.includes('1'))) return true;
        if (isC2 && (bpCycle.includes('segundo') || bpCycle.includes('2do') || bpCycle.includes('2'))) return true;
        return false;
      };

      // Prioridad 1: Coincidencia EXACTA de Nivel Y Ciclo
      let cycleBPref = shiftBPs.find((bp: any) => matchesLevel(bp) && matchesCycle(bp));

      // Prioridad 2: Nivel exacto y Ciclo General o vacío
      if (!cycleBPref) {
        cycleBPref = shiftBPs.find((bp: any) => {
          const bpCycle = (bp.cycle || '').toLowerCase();
          const isGenCycle = !bpCycle || bpCycle.includes('gen') || bpCycle.includes('todo');
          return matchesLevel(bp) && isGenCycle;
        });
      }

      // Prioridad 3: Nivel General y Ciclo exacto
      if (!cycleBPref) {
        cycleBPref = shiftBPs.find((bp: any) => {
          const bpLevel = (bp.level || '').toLowerCase();
          const isGenLevel = !bpLevel || bpLevel.includes('gen') || bpLevel.includes('todo');
          return isGenLevel && matchesCycle(bp);
        });
      }

      // Prioridad 4: Nivel General y Ciclo General
      if (!cycleBPref) {
        cycleBPref = shiftBPs.find((bp: any) => {
          const bpLevel = (bp.level || '').toLowerCase();
          const bpCycle = (bp.cycle || '').toLowerCase();
          const isGenLevel = !bpLevel || bpLevel.includes('gen') || bpLevel.includes('todo');
          const isGenCycle = !bpCycle || bpCycle.includes('gen') || bpCycle.includes('todo');
          return isGenLevel && isGenCycle;
        });
      }

      // Prioridad 5: Cualquier recreo de la tanda
      if (!cycleBPref && shiftBPs.length > 0) {
        cycleBPref = shiftBPs[0];
      }

      const firstRelevantBreak = shiftBPs[0] || null;

      const rawMasterStart =
        firstRelevantBreak?.startTime || firstRelevantBreak?.start_time || (courseIsMorning ? '10:00:00' : '16:00:00');
      let masterStartMins = toMins(rawMasterStart);
      if (!courseIsMorning && masterStartMins < 720 && masterStartMins > 0) masterStartMins += 720;
      if (!courseIsMorning && (masterStartMins <= courseStartT || masterStartMins >= courseEndT)) masterStartMins = 960;
      const masterBPref = {
        startTime: fromMins(masterStartMins),
        durationMinutes:
          Number(firstRelevantBreak?.durationMinutes || firstRelevantBreak?.duration_minutes) ||
          (courseIsMorning ? 30 : 15)
      };

      const effectiveBPref = cycleBPref || masterBPref;
      let bStart = toMins(effectiveBPref.startTime || effectiveBPref.start_time);
      if (!courseIsMorning && bStart < 720 && bStart > 0) bStart += 720;
      if (!courseIsMorning && (bStart <= courseStartT || bStart >= courseEndT)) bStart = 960;
      const bDuration =
        Number(effectiveBPref.durationMinutes || effectiveBPref.duration_minutes) ||
        (courseIsMorning ? 30 : 15);
      const bEnd = bStart + bDuration;

      // Evento de Acto Cívico/Apertura
      const dbActoEvent = (state.fixedEvents || []).find((fe: any) => {
        const feName = (fe.name || '').toLowerCase();
        const isActo = feName.includes('acto') || feName.includes('bandera') || feName.includes('apertura');
        if (!isActo) return false;
        const feLevel = (fe.level || '').toLowerCase();
        const levelNorm = (course?.level || '').toLowerCase();
        return !feLevel || feLevel.includes('gen') || feLevel.includes(levelNorm.substring(0, 3));
      });

      let classStart = courseOfficial?.start_time
        ? courseStartT
        : courseIsMorning && courseStartT <= 480
        ? 480
        : courseStartT;
      const slots: any[] = [];

      if (courseIsMorning && dbActoEvent) {
        const feEndMins = toMins(dbActoEvent.end_time);
        if (feEndMins > 0) classStart = feEndMins;

        slots.push({
          start: fromMins(toMins(dbActoEvent.start_time)),
          end: fromMins(toMins(dbActoEvent.end_time)),
          isBreak: true,
          label: dbActoEvent.name
        });
      }

      const calculateSlotDurations = (totalMins: number, preferredCount: number, maxCount?: number) => {
        if (totalMins <= 0 || preferredCount <= 0) return [];
        let count = preferredCount;
        const limit = maxCount || 6;
        while (count > 1 && totalMins / count < 35) {
          count--;
        }
        while (totalMins / count > 50 && count < limit) {
          if (totalMins / (count + 1) < 35) {
            break;
          }
          count++;
        }
        const base = Math.floor(totalMins / count);
        let rem = totalMins - base * count;
        const durs = new Array(count).fill(base);
        for (let idx = 0; idx < count && rem > 0; idx++) {
          durs[idx] += 1;
          rem -= 1;
        }
        return durs;
      };

      // CÁLCULO DINÁMICO ANTES DEL RECREO
      const preWindow = Math.max(0, bStart - classStart);
      let preCountLocal = targetTotalLocal === 6 && isSecundaria ? 3 : preWindow >= 115 ? 3 : 2;
      if (preWindow / preCountLocal < 35) {
        preCountLocal = Math.max(1, Math.floor(preWindow / 35));
      }
      const maxPreCount = isSecundaria ? 3 : 6;
      const preDurs = calculateSlotDurations(preWindow, preCountLocal, maxPreCount);
      preCountLocal = preDurs.length;

      let currTimePre = classStart;
      for (let i = 0; i < preCountLocal; i++) {
        let dur = preDurs[i];
        let sTime = currTimePre;
        let eTime = i === preCountLocal - 1 ? bStart : sTime + dur;
        currTimePre = eTime;

        slots.push({
          start: fromMins(sTime),
          end: fromMins(eTime),
          isBreak: false,
          label: `${i + 1}ra Hora`
        });
      }

      // EL RECREO
      slots.push({ start: fromMins(bStart), end: fromMins(bEnd), isBreak: true, label: 'RECREO' });

      // Eventos Fijos Post-Recreo
      let currTimePost = bEnd;
      const postFixedEvents = (state.fixedEvents || []).filter((fe: any) => {
        const feName = (fe.name || '').toLowerCase();
        const isActo = feName.includes('acto') || feName.includes('bandera') || feName.includes('apertura');
        let feStartMins = toMins(fe.start_time);
        if (!courseIsMorning && feStartMins < 720 && feStartMins > 0) feStartMins += 720;
        if (isActo || feStartMins < bStart - 5 || feStartMins >= courseEndT) return false;

        const feLevel = (fe.level || '').toLowerCase();
        const feCycle = (fe.cycle || '').toLowerCase();
        const levelMatch =
          !feLevel ||
          feLevel.includes('gen') ||
          feLevel.includes('todo') ||
          feLevel.substring(0, 3) === levelNorm.substring(0, 3) ||
          levelNorm.includes(feLevel.substring(0, 3));
        const cycleMatch =
          !feCycle ||
          feCycle.includes('gen') ||
          feCycle.includes('todo') ||
          (isC1 && (feCycle.includes('primer') || feCycle.includes('1'))) ||
          (isC2 && (feCycle.includes('segundo') || feCycle.includes('2')));
        return levelMatch && cycleMatch;
      });

      postFixedEvents.forEach((fe: any) => {
        let feEndMins = toMins(fe.end_time);
        if (!courseIsMorning && feEndMins < 720 && feEndMins > 0) feEndMins += 720;
        if (feEndMins > currTimePost) {
          slots.push({
            start: fromMins(toMins(fe.start_time)),
            end: fromMins(toMins(fe.end_time)),
            isBreak: true,
            label: fe.name
          });
          currTimePost = Math.max(currTimePost, feEndMins);
        }
      });

      // CÁLCULO DINÁMICO DESPUÉS DEL RECREO
      const postWindow = Math.max(0, courseEndT - currTimePost);
      let postCountLocal = isSecundaria ? 3 : Math.max(1, targetTotalLocal - preCountLocal);
      if (postWindow / postCountLocal < 35) {
        postCountLocal = Math.max(1, Math.floor(postWindow / 35));
      }
      const maxPostCount = isSecundaria ? 3 : 6;
      const postDurs = calculateSlotDurations(postWindow, postCountLocal, maxPostCount);
      postCountLocal = postDurs.length;
      for (let i = 0; i < postCountLocal; i++) {
        let dur = postDurs[i];
        let sTime = currTimePost;
        let eTime = i === postDurs.length - 1 ? courseEndT : sTime + dur;
        currTimePost = eTime;

        slots.push({
          start: fromMins(sTime),
          end: fromMins(eTime),
          isBreak: false,
          label: `${preCountLocal + i + 1}ra Hora`
        });
      }

      return slots;
    },
    [
      findOfficialSchedule,
      isCourseFirstCycle,
      isCourseSecondCycle,
      state.levelSchedules,
      state.breakPreferences,
      state.fixedEvents
    ]
  );

  // Horario del docente para el día de hoy con recreos integrados
  const teacherTodaySchedule = useMemo(() => {
    if (!selectedTeacherId) return [];
    const normCurrentDay = normalize(currentDay);

    const hasExplicitYearEntries = selectedYear && state.schedule.some((s: any) => s.school_year === selectedYear);
    const seenSlotKeys = new Set<string>();

    const normTodayClasses = state.schedule
      .filter((entry: any) => {
        // Filtro estricto por año escolar
        if (selectedYear) {
          if (hasExplicitYearEntries) {
            if (entry.school_year !== selectedYear) return false;
          } else {
            if (entry.school_year && entry.school_year !== selectedYear) return false;
          }
        }

        // Validación de pertenencia al docente (por ID directo o por asignación académica)
        const entryTId = entry.teacherId || entry.teacher_id;
        const matchesTeacher =
          isSameTeacher(entryTId, selectedTeacherId) ||
          entryTId === selectedTeacherId ||
          (!entryTId &&
            (state.assignments || []).some(
              (a: any) =>
                (isSameTeacher(a.teacher_id, selectedTeacherId) || isSameTeacher(a.teacherId, selectedTeacherId) || a.teacher_id === selectedTeacherId || a.teacherId === selectedTeacherId) &&
                (a.course_id === entry.course_id || a.courseId === entry.course_id) &&
                a.subject_id === entry.subject_id
            ));

        if (!matchesTeacher) return false;

        const entryDay = entry.day || '';
        if (entryDay && normalize(entryDay) === normCurrentDay) return true;

        const tbId = entry.time_block_id || entry.timeBlockId;
        const tb = state.timeBlocks.find((b) => b.id === tbId);
        return tb && normalize(tb.day) === normCurrentDay;
      })
      .map((entry: any) => {
        const tbId = entry.time_block_id || entry.timeBlockId;
        const subId = entry.subject_id || entry.subjectId;
        const courseId = entry.course_id || entry.courseId;

        const tb = state.timeBlocks.find((b) => b.id === tbId);
        const sub = state.subjects.find((s) => s.id === subId);
        const course = state.courses.find((c) => c.id === courseId);
        const room = state.rooms.find((r) => r.id === (entry.room_id || entry.roomId));

        const sTime = entry.start_time || entry.startTime || tb?.startTime || tb?.start_time || '';
        const eTime = entry.end_time || entry.endTime || tb?.endTime || tb?.end_time || '';

        const start = toMins(sTime);
        const end = toMins(eTime);
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
      })
      .filter((entry: any) => {
        // Deduplicación en tiempo real evitando descartar periodos consecutivos
        const key = entry.id
          ? `id_${entry.id}`
          : `${entry.course_id || entry.courseId}_${entry.subject_id || entry.subjectId}_${(entry.day || '').trim().toLowerCase()}_${entry.sTime || entry.time_block_id || ''}`;
        if (seenSlotKeys.has(key)) return false;
        seenSlotKeys.add(key);
        return true;
      });

    // Si no hay clases hoy, retornar vacío
    if (normTodayClasses.length === 0) return [];

    // Determinar tanda
    const isMorning = normTodayClasses.some((c) => c.startMinutes < 780);

    // Buscar recreo en breakPreferences
    const firstRelevantBreak = (state.breakPreferences || []).find((bp: any) => {
      let bpMins = toMins(bp.startTime || bp.start_time);
      if (!isMorning && bpMins < 420) bpMins += 720;
      const isBpMorning = bpMins < 780;
      return isMorning === isBpMorning;
    });

    let bStart = firstRelevantBreak
      ? toMins(firstRelevantBreak.startTime || firstRelevantBreak.start_time)
      : isMorning
        ? 600
        : 960; // 10:00 AM o 04:00 PM
    if (!isMorning && bStart < 720 && bStart > 0) bStart += 720;
    const bDuration = firstRelevantBreak
      ? Number(firstRelevantBreak.durationMinutes || firstRelevantBreak.duration_minutes) || 30
      : 30;
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
    state.breakPreferences,
    selectedYear,
    isSameTeacher
  ]);

  const activeClassNow = useMemo(() => {
    return teacherTodaySchedule.find((c) => c.isNow && !c.isBreak);
  }, [teacherTodaySchedule]);

  const periodAlert = useMemo(() => {
    if (!teacherTodaySchedule || teacherTodaySchedule.length === 0) return null;

    const currentClass = teacherTodaySchedule.find((c) => c.isNow && !c.isBreak);
    const upcomingClasses = teacherTodaySchedule.filter(
      (c) => !c.isBreak && (c.startMinutes || getMinutes(c.sTime)) > currentTimeMinutes
    );
    const nextClass = upcomingClasses[0];

    if (currentClass) {
      const endMins = currentClass.endMinutes || getMinutes(currentClass.eTime);
      const minsLeft = endMins - currentTimeMinutes;
      return {
        type: 'current',
        minsLeft: Math.max(1, minsLeft),
        currentSubject: currentClass.sub?.name || 'Materia Actual',
        currentCourse: `${currentClass.course?.grade || ''} ${currentClass.course?.section || ''}`.trim(),
        nextSubject: nextClass?.sub?.name || null,
        nextCourse: nextClass ? `${nextClass.course?.grade || ''} ${nextClass.course?.section || ''}`.trim() : null,
        nextTime: nextClass?.sTime || null
      };
    }

    if (nextClass) {
      const startMins = nextClass.startMinutes || getMinutes(nextClass.sTime);
      const minsUntilNext = startMins - currentTimeMinutes;
      if (minsUntilNext > 0 && minsUntilNext <= 20) {
        return {
          type: 'upcoming',
          minsUntilNext,
          nextSubject: nextClass.sub?.name || 'Próxima Clase',
          nextCourse: `${nextClass.course?.grade || ''} ${nextClass.course?.section || ''}`.trim(),
          nextTime: nextClass.sTime
        };
      }
    }

    return null;
  }, [teacherTodaySchedule, currentTimeMinutes]);

  // Matriz semanal completa del docente (Lunes a Viernes)
  const teacherWeeklyScheduleMatrix = useMemo(() => {
    if (!selectedTeacherId) return { slots: [], matrix: {} };

    const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const hasExplicitYearEntries =
      selectedYear && state.schedule.some((s: any) => s.school_year === selectedYear);
    const seenSlotKeys = new Set<string>();

    const getEntryMins = (val: string, s?: any, c?: any) => {
      if (!val) return 0;
      let mins = toMins(val);
      const clean = (val || '').replace(/[^0-9:APMapm]/g, '').trim();
      const isPM = clean.toUpperCase().includes('PM');
      const isAM = clean.toUpperCase().includes('AM');
      if (!isPM && !isAM) {
        const cTanda = (s?.shift || c?.tanda || '').toLowerCase();
        const isVesp =
          cTanda.includes('ves') ||
          cTanda.includes('tar') ||
          ((c?.level || '').toLowerCase().includes('secun') && !cTanda.includes('mat'));
        if (isVesp && mins < 420 && mins > 0) mins += 720;
      }
      return mins;
    };

    // 1. Obtener todas las clases asignadas al docente a lo largo de la semana con filtro estricto por año y deduplicación exacta
    const teacherEntries = state.schedule
      .filter((s: any) => {
        if (selectedYear) {
          if (hasExplicitYearEntries) {
            if (s.school_year !== selectedYear) return false;
          } else {
            if (s.school_year && s.school_year !== selectedYear) return false;
          }
        }

        const sTId = s.teacherId || s.teacher_id;
        const matchesTeacher =
          isSameTeacher(sTId, selectedTeacherId) ||
          sTId === selectedTeacherId ||
          (!sTId &&
            (state.assignments || []).some(
              (a: any) =>
                (isSameTeacher(a.teacher_id, selectedTeacherId) || isSameTeacher(a.teacherId, selectedTeacherId) || a.teacher_id === selectedTeacherId || a.teacherId === selectedTeacherId) &&
                (a.course_id === s.course_id || a.courseId === s.course_id) &&
                a.subject_id === s.subject_id
            ));

        return matchesTeacher;
      })
      .map((s: any) => {
        const tb = state.timeBlocks.find((b: any) => b.id === (s.timeBlockId || s.time_block_id));
        const sub = state.subjects.find((sub: any) => sub.id === (s.subjectId || s.subject_id));
        const course = state.courses.find((c: any) => c.id === (s.courseId || s.course_id));
        const room = state.rooms.find((r: any) => r.id === (s.roomId || s.room_id));
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
          startMinutes: getEntryMins(sTime, s, course)
        };
      })
      .filter((s: any) => {
        if (!s.day || !s.sTime) return false;
        const key = s.id
          ? `id_${s.id}`
          : `${s.course_id || s.courseId}_${s.subject_id}_${(s.day || '').trim().toLowerCase()}_${s.sTime}_${s.time_block_id || s.timeBlockId || ''}`;
        if (seenSlotKeys.has(key)) return false;
        seenSlotKeys.add(key);
        return true;
      });

    // 2. Determinar si el docente tiene clases en la mañana, en la tarde, o en ambas
    const hasMorningClasses = teacherEntries.some((e: any) => e.startMinutes < 780);
    const hasAfternoonClasses = teacherEntries.some((e: any) => e.startMinutes >= 780);

    const teacherCourseIds = new Set<string>();
    teacherEntries.forEach((e: any) => {
      const cId = e.courseId || e.course_id;
      if (cId) teacherCourseIds.add(cId);
    });
    (state.assignments || []).forEach((a: any) => {
      if (isSameTeacher(a.teacher_id, selectedTeacherId) || isSameTeacher(a.teacherId, selectedTeacherId)) {
        const cId = a.courseId || a.course_id;
        if (cId) teacherCourseIds.add(cId);
      }
    });
    const teacherCourses = state.courses.filter((c: any) => teacherCourseIds.has(c.id));

    const mornCourses = teacherCourses.filter((c: any) => {
      const t = (c.tanda || '').toLowerCase();
      return t.includes('mat') || t.includes('mañ') || (!t.includes('ves') && !t.includes('tar') && !(c.level || '').toLowerCase().includes('secun'));
    });
    const vespCourses = teacherCourses.filter((c: any) => {
      const t = (c.tanda || '').toLowerCase();
      return t.includes('ves') || t.includes('tar') || (!t.includes('mat') && !t.includes('mañ') && (c.level || '').toLowerCase().includes('secun'));
    });

    const getPrimaryCourse = (list: any[]) => {
      if (list.length === 0) return null;
      let best = list[0];
      let maxCount = 0;
      list.forEach((c: any) => {
        const count = teacherEntries.filter((e: any) => String(e.courseId || e.course_id) === String(c.id)).length;
        if (count > maxCount) {
          maxCount = count;
          best = c;
        }
      });
      return best;
    };

    const primaryMornCourse = getPrimaryCourse(mornCourses) || getPrimaryCourse(teacherCourses) || state.courses[0];
    const primaryVespCourse = getPrimaryCourse(vespCourses) || getPrimaryCourse(teacherCourses) || state.courses[0];

    let standardSlots: any[] = [];
    if (hasMorningClasses && hasAfternoonClasses) {
      const mSlots = primaryMornCourse ? getSlotsForCourse(primaryMornCourse).filter((s: any) => toMins(s.start) < 780) : [];
      const vSlots = primaryVespCourse ? getSlotsForCourse(primaryVespCourse).filter((s: any) => toMins(s.start) >= 780) : [];
      standardSlots = [...mSlots, ...vSlots];
    } else if (hasAfternoonClasses) {
      standardSlots = primaryVespCourse ? getSlotsForCourse(primaryVespCourse) : [];
    } else {
      standardSlots = primaryMornCourse ? getSlotsForCourse(primaryMornCourse) : [];
    }

    // Deduplicar slots por start
    const seenStarts = new Set<string>();
    const uniqueSlots = standardSlots.filter((slot: any) => {
      if (seenStarts.has(slot.start)) return false;
      seenStarts.add(slot.start);
      return true;
    });

    const sortedSlots = uniqueSlots.sort((a, b) => toMins(a.start) - toMins(b.start));

    // 3. Inicializar matriz semanal
    const matrix: Record<string, Record<string, any>> = {};

    sortedSlots.forEach((slot) => {
      matrix[slot.start] = {};
      weekDays.forEach((day) => {
        matrix[slot.start][day] = {
          isBreak: !!slot.isBreak,
          isFree: !slot.isBreak,
          label: slot.label,
          sTime: slot.start,
          eTime: slot.end
        };
      });
    });

    const nonBreakSlots = sortedSlots.filter((s: any) => !s.isBreak);
    const slotsToMatch = nonBreakSlots.length > 0 ? nonBreakSlots : sortedSlots;

    // 4. Mapear cada clase del docente A SU CORRESPONDIENTE HORA DE LAS 6
    weekDays.forEach((day) => {
      const normDay = normalize(day);
      const dayEntries = teacherEntries
        .filter((e: any) => normalize(e.day || '') === normDay)
        .sort((a: any, b: any) => a.startMinutes - b.startMinutes);

      dayEntries.forEach((entry: any) => {
        const eMins = entry.startMinutes;
        const entryTbId = entry.time_block_id || entry.timeBlockId;

        // 1. Coincidencia directa por time_block_id si el slot tiene id
        let bestSlot = slotsToMatch.find(
          (s: any) => s.id && entryTbId && String(s.id) === String(entryTbId)
        );

        // 2. Si no coincide por ID, buscar por el slot no-recreo más cercano
        if (!bestSlot) {
          let minDiff = Infinity;
          slotsToMatch.forEach((slot: any) => {
            const slotMins = toMins(slot.start);
            const diff = Math.abs(eMins - slotMins);
            const currentCell = matrix[slot.start]?.[day];
            if (diff < minDiff && (currentCell?.isFree || diff < 15)) {
              minDiff = diff;
              bestSlot = slot;
            }
          });

          if (bestSlot) {
            const bestSlotStartM = toMins(bestSlot.start);
            const bestSlotEndM = toMins(bestSlot.end);
            const diff = Math.abs(eMins - bestSlotStartM);
            const inWindow = eMins >= bestSlotStartM - 15 && eMins < bestSlotEndM + 15;
            if (diff > 50 && !inWindow) {
              bestSlot = null;
            }
          }
        }

        if (bestSlot) {
          matrix[bestSlot.start][day] = {
            isBreak: false,
            isFree: false,
            ...entry
          };
        }
      });
    });

    return { slots: sortedSlots, matrix };
  }, [
    selectedTeacherId,
    selectedYear,
    state.schedule,
    state.timeBlocks,
    state.subjects,
    state.courses,
    state.assignments,
    state.rooms,
    isSameTeacher,
    getSlotsForCourse
  ]);

  // Obtener los cursos que dicta el docente
  const myCourses = useMemo(() => {
    if (!selectedTeacherId) return [];

    const courseIds = new Set<string>();

    const hasExplicitYearEntries = selectedYear && state.schedule.some((s: any) => s.school_year === selectedYear);

    state.schedule.forEach((s: any) => {
      if (selectedYear) {
        if (hasExplicitYearEntries) {
          if (s.school_year !== selectedYear) return;
        } else {
          if (s.school_year && s.school_year !== selectedYear) return;
        }
      }

      const tId = s.teacherId || s.teacher_id;
      const cId = s.courseId || s.course_id;
      if ((isSameTeacher(tId, selectedTeacherId) || tId === selectedTeacherId || (!tId && (state.assignments || []).some((a: any) => (isSameTeacher(a.teacher_id, selectedTeacherId) || isSameTeacher(a.teacherId, selectedTeacherId) || a.teacher_id === selectedTeacherId || a.teacherId === selectedTeacherId) && (a.course_id === cId || a.courseId === cId) && a.subject_id === s.subject_id))) && cId) {
        courseIds.add(cId);
      }
    });

    state.assignments.forEach((a: any) => {
      const tId = a.teacherId || a.teacher_id;
      const cId = a.courseId || a.course_id;
      if ((isSameTeacher(tId, selectedTeacherId) || tId === selectedTeacherId) && cId) {
        courseIds.add(cId);
      }
    });

    return state.courses.filter((c) => courseIds.has(c.id));
  }, [selectedTeacherId, selectedYear, state.schedule, state.assignments, state.courses, isSameTeacher]);

  // Horario del curso que está inspeccionando el docente con recreos completos y horas libres
  const selectedCourseSchedule = useMemo(() => {
    if (!selectedCourse) return [];

    const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

    const courseSlots = getSlotsForCourse(selectedCourse);
    const hasExplicitYearEntries = selectedYear && state.schedule.some((s: any) => s.school_year === selectedYear);

    return weekDays.map((day) => {
      // Filtrar materias registradas para este día con filtro estricto por año
      const dayEntries = state.schedule.filter((s: any) => {
        if (selectedYear) {
          if (hasExplicitYearEntries) {
            if (s.school_year !== selectedYear) return false;
          } else {
            if (s.school_year && s.school_year !== selectedYear) return false;
          }
        }

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
            return Math.abs(getMinutes(eTime) - slotMins) <= 45;
          }
          const tb = state.timeBlocks.find((b) => b.id === (e.timeBlockId || e.time_block_id));
          const tbTime = tb?.startTime || tb?.start_time;
          return tbTime && Math.abs(getMinutes(tbTime) - slotMins) <= 45;
        });

        if (matchingEntry) {
          const tb = state.timeBlocks.find(
            (b) => b.id === (matchingEntry.timeBlockId || matchingEntry.time_block_id)
          );
          const sub = state.subjects.find(
            (sub) => sub.id === (matchingEntry.subjectId || matchingEntry.subject_id)
          );
          const matchingTId = matchingEntry.teacherId || matchingEntry.teacher_id;
          const tea = state.teachers.find(
            (t) => isSameTeacher(t.id, matchingTId) || t.id === matchingTId
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
    selectedYear,
    state.schedule,
    state.timeBlocks,
    state.subjects,
    state.teachers,
    getSlotsForCourse,
    isSameTeacher
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
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
            <User size={24} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 uppercase">
                {currentTeacher ? `Hola, ${currentTeacher.name}` : 'Acceso Docente'}
              </h2>
              {profile?.teacher_id && (
                <span className="inline-flex items-center gap-1 text-[8px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  <CheckCircle2 size={10} className="text-emerald-600" />
                  Vínculo Activo
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
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
              className="w-full p-2.5 bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-500 font-bold text-xs uppercase"
            >
              <option value="">-- SELECCIONAR MI PERFIL --</option>
              {[...(state.teachers || [])]
                .sort((a, b) => (a.name || a.full_name || '').localeCompare(b.name || b.full_name || ''))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {(t.name || t.full_name || 'Docente').toUpperCase()}
                  </option>
                ))}
            </select>
          </div>

          {selectedTeacherId && profile?.teacher_id !== selectedTeacherId && (
            <button
              onClick={() => handleLinkTeacher(selectedTeacherId)}
              disabled={isLinking}
              className="w-full md:w-auto flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-2xl transition-all font-black text-[9px] uppercase tracking-widest shadow-md shrink-0 cursor-pointer animate-pulse"
            >
              <CheckCircle2 size={12} />
              {isLinking ? 'Vinculando...' : 'Vincular este Perfil'}
            </button>
          )}

          {/* Fila de los 3 Botones de Acceso Rápido: Horario, Aula, Tareas */}
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 sm:pb-0">
            {selectedTeacherId && (
              <button
                onClick={() => setShowWeeklyScheduleModal(true)}
                className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl transition-all font-black text-[9px] uppercase tracking-wider shadow-sm shrink-0 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                title="Ver Horario Semanal"
              >
                <CalendarDays size={13} />
                Horario
              </button>
            )}

            {onViewChange && (
              <button
                onClick={() => onViewChange('classroom')}
                className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl transition-all font-black text-[9px] uppercase tracking-wider shadow-sm shrink-0 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                title="Ir a Aula"
              >
                <UserCheck size={13} />
                Aula
              </button>
            )}

            {onViewChange && (
              <button
                onClick={() => onViewChange('tasks')}
                className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-2 rounded-xl transition-all font-black text-[9px] uppercase tracking-wider shadow-sm shrink-0 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                title="Ir a Tareas"
              >
                <BookOpen size={13} />
                Tareas
              </button>
            )}
          </div>

          {hidePeriodAlert && (
            <button
              onClick={() => {
                setHidePeriodAlert(false);
                localStorage.setItem('edugens_hide_period_alert', 'false');
              }}
              className="w-full md:w-auto text-[9px] font-black text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 border border-slate-200 px-4 py-3 rounded-2xl uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              title="Activar Alerta de Cambio de Hora"
            >
              <Bell size={12} /> Activar Alerta de Hora
            </button>
          )}
        </div>
      </div>

      {/* BANNER ALERTA VIVA DE CAMBIO DE HORA (SI NO ESTA DESACTIVADA) */}
      {periodAlert && !hidePeriodAlert && (
        <div
          className={`p-6 rounded-[2.5rem] shadow-xl border transition-all duration-500 relative ${
            periodAlert.type === 'current' && periodAlert.minsLeft <= 10
              ? 'bg-gradient-to-r from-amber-500 via-rose-600 to-amber-600 text-white border-amber-300 animate-pulse'
              : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-indigo-500/30'
          }`}
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0">
                <Bell size={28} className="animate-bounce text-white" />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-wider mb-1">
                  <Clock size={12} /> Alerta de Tiempo Real
                </div>
                {periodAlert.type === 'current' ? (
                  <>
                    <h3 className="text-xl font-black tracking-tight">
                      {periodAlert.minsLeft <= 10
                        ? `¡Restan ${periodAlert.minsLeft} min para Cambio de Hora!`
                        : `Clase en Curso: ${periodAlert.currentSubject}`}
                    </h3>
                    <p className="text-xs font-bold opacity-90">
                      Impartiendo: <span className="underline font-extrabold">{periodAlert.currentSubject}</span> ({periodAlert.currentCourse})
                      {periodAlert.nextSubject && (
                        <span className="block sm:inline sm:ml-2">
                          — Próxima clase: <strong className="text-amber-200">{periodAlert.nextSubject}</strong> en {periodAlert.nextCourse} ({periodAlert.nextTime})
                        </span>
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-black tracking-tight">
                      Próximo Cambio de Hora en {periodAlert.minsUntilNext} min
                    </h3>
                    <p className="text-xs font-bold opacity-90">
                      Próxima asignatura: <span className="underline font-extrabold">{periodAlert.nextSubject}</span> ({periodAlert.nextCourse}) a las {periodAlert.nextTime}.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 self-end md:self-auto">
              <div className="bg-white/10 px-4 py-2.5 rounded-2xl border border-white/20 text-center font-mono font-black text-xs shrink-0">
                {currentDay} • {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <button
                onClick={() => {
                  setHidePeriodAlert(true);
                  localStorage.setItem('edugens_hide_period_alert', 'true');
                }}
                className="p-2.5 bg-white/10 hover:bg-white/20 rounded-2xl text-white/80 hover:text-white transition-all cursor-pointer"
                title="Desactivar / Ocultar Alerta"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

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
      ) : showCreateForm || editingTask || editingAnnouncement ? (
        // FORMULARIO DE CREACIÓN / EDICIÓN DE TAREA / COMUNICADO
        <div className="relative">
          <button
            onClick={() => {
              setShowCreateForm(false);
              setEditingTask(null);
              setEditingAnnouncement(null);
            }}
            className="absolute top-6 right-6 z-20 w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-all shadow-md cursor-pointer"
          >
            <X size={20} />
          </button>
          <TeacherTaskAnnouncement
            userData={profile}
            initialCourseId={selectedCourse?.id}
            taskToEdit={editingTask}
            announcementToEdit={editingAnnouncement}
            onClose={() => {
              setShowCreateForm(false);
              setEditingTask(null);
              setEditingAnnouncement(null);
              if (selectedCourse?.id) {
                dataService.getTasks(selectedCourse.id).then((t) => setCourseTasks(t));
                dataService.getAnnouncements(selectedCourse.id).then((a) => setCourseAnnouncements(a));
              }
            }}
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
              { id: 'comunicados', label: 'Anuncios', icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined },
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
                  {tab.badge !== undefined && (
                    <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-xs animate-pulse">
                      {tab.badge}
                    </span>
                  )}
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
                                    {format12h(c.sTime)} - {format12h(c.eTime)}
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
                                    {format12h(c.sTime)} - {format12h(c.eTime)}
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
                                  {format12h(c.sTime)} - {format12h(c.eTime)}
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
                      const isLate = t.due_date ? new Date(t.due_date) < new Date() : false;
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
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[8px] font-black px-2 py-0.5 rounded ${isLate ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}
                                >
                                  {isLate ? 'VENCIDA' : 'ACTIVA'}
                                </span>
                                <button
                                  onClick={() => setEditingTask(t)}
                                  className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-md transition-all cursor-pointer"
                                  title="Editar Tarea"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  onClick={() => handleDeleteTask(t.id)}
                                  className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md transition-all cursor-pointer"
                                  title="Eliminar Tarea"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
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
                            <span>{t.due_date ? new Date(t.due_date).toLocaleDateString() : 'Sin fecha'}</span>
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
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black text-slate-400">
                              {new Date(a.created_at || a.timestamp).toLocaleDateString()}
                            </span>
                            <button
                              onClick={() => setEditingAnnouncement(a)}
                              className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-md transition-all cursor-pointer"
                              title="Editar Circular"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteAnnouncement(a.id)}
                              className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md transition-all cursor-pointer"
                              title="Eliminar Circular"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
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
          <div id="excuse-alert-section">
            <ExcuseAlert />
          </div>

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
                                {format12h(c.sTime)}
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
                              {format12h(c.sTime)}
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
                            {c.grade} "{c.section}"
                          </p>
                          <p className="text-[8px] font-bold opacity-75 uppercase mt-0.5 text-indigo-200">
                            {c.level} • {c.tanda || 'Matutina'}
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
      {showWeeklyScheduleModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[999999] overflow-y-auto bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200"
            onClick={() => setShowWeeklyScheduleModal(false)}
          >
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

            <div
              className="bg-white rounded-[2.5rem] md:rounded-[3rem] shadow-2xl border border-slate-100 max-w-6xl w-full overflow-hidden relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabecera del Modal con controles */}
              <div className="bg-indigo-600 p-5 md:p-7 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-indigo-700 shrink-0 no-print">
                <div>
                  <span className="px-3 py-1 bg-white/25 text-white rounded-full text-[9px] font-black uppercase tracking-widest">
                    Mi Agenda Completa
                  </span>
                  <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight mt-1.5 flex items-center gap-2">
                    <CalendarIcon size={22} className="text-indigo-200" /> Horario Semanal Completo
                  </h3>
                  <p className="text-xs font-bold text-indigo-200 mt-0.5 uppercase tracking-wide">
                    Docente: {currentTeacher?.name} • Área: {currentTeacher?.area || 'General'}
                  </p>
                </div>

                {/* Botones de acción del Modal */}
                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                  <button
                    onClick={() => {
                      if (!currentTeacher) return;
                      try {
                        const doc = new jsPDF({
                          orientation: 'landscape',
                          unit: 'mm',
                          format: 'a4'
                        });

                        const centerName =
                          center?.name ||
                          (profile as any)?.center_name ||
                          profile?.center?.name ||
                          localStorage.getItem('edugens_center_name') ||
                          localStorage.getItem('edugest_center_name') ||
                          'Centro Educativo';

                        // Header Superior Elegante
                        doc.setFillColor(30, 41, 59); // slate-800
                        doc.rect(0, 0, 297, 18, 'F');

                        doc.setTextColor(255, 255, 255);
                        doc.setFontSize(11);
                        doc.setFont('helvetica', 'bold');
                        doc.text(centerName.toUpperCase(), 14, 11);

                        doc.setFontSize(9);
                        doc.setFont('helvetica', 'normal');
                        doc.text(`AÑO ESCOLAR: ${selectedYear || '2026-2027'}`, 283, 11, {
                          align: 'right'
                        });

                        // Título del Docente
                        doc.setTextColor(15, 23, 42); // slate-900
                        doc.setFontSize(13);
                        doc.setFont('helvetica', 'bold');
                        const teacherTitle = `HORARIO DOCENTE: ${currentTeacher.name} - ${currentTeacher.area || 'GENERAL'}`;
                        doc.text(teacherTitle.toUpperCase(), 14, 28);

                        doc.setFontSize(8);
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(100, 116, 139);
                        doc.text(`Generado oficialmente a través de Edugest`, 14, 33);

                        const tableDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
                        const tableBody = teacherWeeklyScheduleMatrix.slots.map((slot) => {
                          const timeLabel = `${format12h(slot.start)}\n${format12h(slot.end)}`;

                          if (slot.isBreak) {
                            return [
                              timeLabel,
                              {
                                content: `🔔 ${slot.label || 'RECREO'}`,
                                colSpan: 5,
                                styles: {
                                  halign: 'center',
                                  fillColor: [254, 243, 199],
                                  textColor: [180, 83, 9],
                                  fontStyle: 'bold' as any
                                }
                              }
                            ];
                          }

                          const dayCols = tableDays.map((day) => {
                            const cell = teacherWeeklyScheduleMatrix.matrix[slot.start]?.[day];
                            if (!cell || cell.isFree) return '';
                            if (cell.isBreak) return `🔔 ${cell.label || 'RECREO'}`;
                            const courseName = cell.course
                              ? `${cell.course.grade} "${cell.course.section || ''}"`
                              : 'Curso';
                            const subName = (cell.sub?.name || 'Materia').toUpperCase();
                            return `${subName}\n(${courseName})`;
                          });

                          return [timeLabel, ...dayCols];
                        });

                        autoTable(doc, {
                          startY: 37,
                          head: [['BLOQUE / HORA', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES']],
                          body: tableBody as any,
                          theme: 'grid',
                          headStyles: {
                            fillColor: [79, 70, 229],
                            textColor: [255, 255, 255],
                            fontStyle: 'bold',
                            halign: 'center',
                            fontSize: 9,
                            cellPadding: 3
                          },
                          bodyStyles: {
                            fontSize: 8,
                            cellPadding: 3,
                            valign: 'middle',
                            textColor: [30, 41, 59]
                          },
                          columnStyles: {
                            0: { halign: 'center', fontStyle: 'bold', cellWidth: 26, fillColor: [248, 250, 252] },
                            1: { cellWidth: 48, halign: 'center' },
                            2: { cellWidth: 48, halign: 'center' },
                            3: { cellWidth: 48, halign: 'center' },
                            4: { cellWidth: 48, halign: 'center' },
                            5: { cellWidth: 48, halign: 'center' }
                          },
                          margin: { left: 14, right: 14 }
                        });

                        doc.save(`Horario_Docente_${currentTeacher.name.replace(/\s+/g, '_')}.pdf`);
                      } catch (err: any) {
                        alert('Error al generar PDF: ' + err.message);
                      }
                    }}
                    className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-4 py-2.5 rounded-xl transition-all font-black text-[9px] uppercase tracking-wider shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <FileText size={12} />
                    PDF
                  </button>
                  <button
                    onClick={() => {
                      const element = document.getElementById('teacher-weekly-schedule-print-area');
                      if (!element) return;
                      html2canvas(element, {
                        scale: 2.5,
                        useCORS: true,
                        backgroundColor: '#ffffff',
                        windowWidth: 1400,
                        onclone: (clonedDoc) => {
                          const el = clonedDoc.getElementById('teacher-weekly-schedule-print-area');
                          if (el) {
                            el.style.width = '1200px';
                            el.style.maxWidth = 'none';
                            el.style.overflow = 'visible';
                          }
                        }
                      })
                        .then((canvas) => {
                          const link = document.createElement('a');
                          link.download = `Horario_Docente_${(currentTeacher?.name || 'Docente').replace(/\s+/g, '_')}.png`;
                          link.href = canvas.toDataURL('image/png');
                          link.click();
                        })
                        .catch((err) => {
                          console.error('Error exporting schedule image:', err);
                        });
                    }}
                    className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl transition-all font-black text-[9px] uppercase tracking-wider shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Download size={12} />
                    Imagen
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-indigo-800 hover:bg-indigo-900 text-white px-4 py-2.5 rounded-xl transition-all font-black text-[9px] uppercase tracking-wider shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Printer size={12} />
                    Imprimir
                  </button>
                </div>
              </div>

              {/* Contenido / Cuadrícula del Horario */}
              <div className="overflow-y-auto p-4 md:p-8 flex-1 bg-slate-50/50">
                <div
                  id="teacher-weekly-schedule-print-area"
                  className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden"
                >
                  {/* Decoración del fondo premium */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/20 blur-3xl rounded-full pointer-events-none"></div>

                  {/* Cabecera del reporte impreso */}
                  <div className="mb-6 pb-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
                    <div>
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5">
                        <Building2 size={12} />
                        {center?.name || (profile as any)?.center_name || 'CENTRO EDUCATIVO'}
                      </span>
                      <h2 className="text-lg md:text-xl font-black text-indigo-950 uppercase tracking-tight mt-2">
                        HORARIO SEMANAL DEL DOCENTE
                      </h2>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-1">
                        Profesor(a):{' '}
                        <span className="text-slate-900 font-black">{currentTeacher?.name}</span> • Área:{' '}
                        <span className="text-indigo-600 font-black">{currentTeacher?.area || 'General'}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black text-slate-600 uppercase bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg tracking-wider">
                        Año Escolar: {selectedYear || '2026-2027'}
                      </span>
                    </div>
                  </div>

                  {/* Tabla de Horario Semanal */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[650px]">
                      <thead>
                        <tr>
                          <th className="p-3 text-left font-black text-[9px] uppercase tracking-widest text-slate-400 bg-slate-50 rounded-l-xl w-28">
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
                              <td className="p-3.5 align-middle">
                                <span className="flex flex-col">
                                  <span className="text-xs font-black text-slate-900 tracking-tight">
                                    {format12h(slot.start)} - {format12h(slot.end)}
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
                                      <div className="bg-amber-50 border-2 border-amber-200 text-amber-800 rounded-2xl p-2.5 text-center hover:scale-[1.01] transition-all">
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
                                      <div className="bg-slate-50/60 border border-dashed border-slate-200 rounded-2xl p-2.5 text-center text-slate-400 hover:bg-slate-50 transition-all">
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
                                    <div className="bg-indigo-50/80 border-2 border-indigo-150 rounded-2xl p-3 text-left relative overflow-hidden group hover:border-indigo-400 hover:shadow-lg transition-all duration-300">
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

              {/* Pie de página del Modal con botón grande de cerrar */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4 shrink-0 no-print">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:inline">
                  Edugest • Horario Escolar
                </span>
                <button
                  onClick={() => setShowWeeklyScheduleModal(false)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ml-auto"
                >
                  <X size={16} />
                  Cerrar Horario
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
