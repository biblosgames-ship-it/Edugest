import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Users,
  User,
  BookOpen,
  UserCheck,
  Activity,
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Calendar,
  MapPin,
  Target,
  BarChart3,
  PieChart as PieIcon,
  LineChart as LineIcon
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { SEO } from './SEO';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  Legend,
  LabelList,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

const rankingScales = [
  { label: 'Excelente', min: 95, max: 100, color: '#10b981' },
  { label: 'Muy Bueno', min: 90, max: 94, color: '#6366f1' },
  { label: 'Bueno', min: 80, max: 89, color: '#3b82f6' },
  { label: 'Regular', min: 70, max: 79, color: '#f59e0b' },
  { label: 'En proceso', min: 0, max: 69, color: '#ef4444' }
];

export const Dashboard = React.memo(() => {
  const { state, center, selectedYear, profile, loadAllGrades } = useApp();
  const [currentTime, setCurrentTime] = useState(new Date());

  const [selectedPeriod, setSelectedPeriod] = useState('P1');
  const [selectedLevel, setSelectedLevel] = useState('Todos');
  const [comparisonMode, setComparisonMode] = useState<'indice' | 'competencias' | 'materias'>(
    'indice'
  );

  const [dbStats, setDbStats] = useState<any>(null);
  const [loadingDbStats, setLoadingDbStats] = useState(false);
  const [updatingStats, setUpdatingStats] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'director' || profile?.role === 'management' || profile?.role === 'management_teacher';

  useEffect(() => {
    const fetchDbStats = async () => {
      if (!center?.id || !selectedYear) return;
      setLoadingDbStats(true);
      try {
        const { data, error } = await supabase
          .from('school_statistics')
          .select('*')
          .eq('center_id', center.id)
          .eq('school_year', selectedYear)
          .eq('period', selectedPeriod)
          .maybeSingle();

        if (data && data.stats) {
          setDbStats(data.stats);
        } else {
          setDbStats(null);
        }
      } catch (err) {
        console.error('Error fetching statistics:', err);
      } finally {
        setLoadingDbStats(false);
      }
    };

    fetchDbStats();
  }, [center?.id, selectedYear, selectedPeriod]);

  const handleUpdateStats = async () => {
    if (!center?.id) return;
    setUpdatingStats(true);
    const loadingToast = toast.loading('Calculando estadísticas generales...');
    try {
      const grades = await loadAllGrades();
      if (!grades || grades.length === 0) {
        toast.dismiss(loadingToast);
        toast.error('No hay calificaciones registradas para procesar.');
        setUpdatingStats(false);
        return;
      }

      const subjects = state.subjects || [];
      const students = state.students || [];
      const courses = state.courses || [];
      const periods = ['P1', 'P2', 'P3', 'P4'];

      const courseLevelMap: Record<string, string> = {};
      courses.forEach((c) => {
        courseLevelMap[c.id] = (c.level || '').toLowerCase();
      });

      for (const p of periods) {
        const statsObj: Record<string, any> = {};

        for (const level of ['Todos', 'Primaria', 'Secundaria']) {
          const filteredStudents =
            level === 'Todos'
              ? students
              : students.filter((s) => {
                  const lvl = courseLevelMap[s.course_id] || '';
                  return lvl.includes(level === 'Primaria' ? 'prim' : 'sec');
                });

          const studentIds = new Set(filteredStudents.map((s) => s.id));
          const filteredGrades = grades.filter(
            (g) => g.period === p && studentIds.has(g.student_id)
          );

          const studentAverages = filteredStudents
            .map((student) => {
              const studentGrades = filteredGrades.filter(
                (g) => g.student_id === student.id && g.grade !== null
              );
              if (studentGrades.length === 0) return null;
              return studentGrades.reduce((acc, g) => acc + (g.grade || 0), 0) / studentGrades.length;
            })
            .filter((a) => a !== null) as number[];

          const distribution = [
            { name: 'Deficiente', value: studentAverages.filter((a) => a < 70).length, color: '#ef4444' },
            { name: 'Regular', value: studentAverages.filter((a) => a >= 70 && a < 80).length, color: '#f59e0b' },
            { name: 'Bueno', value: studentAverages.filter((a) => a >= 80 && a < 90).length, color: '#3b82f6' },
            { name: 'Muy Bueno', value: studentAverages.filter((a) => a >= 90 && a < 95).length, color: '#6366f1' },
            { name: 'Excelente', value: studentAverages.filter((a) => a >= 95).length, color: '#10b981' }
          ].filter((d) => d.value > 0);

          const compIds = level === 'Primaria' ? ['c1', 'c2', 'c3'] : ['c1', 'c2', 'c3', 'c4'];
          const compLabels: any = {
            c1: 'Comunicativa (C1)',
            c2: 'Pensamiento Crítico (C2)',
            c3: 'Ética y Ciudadana (C3)',
            c4: 'Personal y Social (C4)'
          };

          const competencies = compIds.map((id) => {
            const compGrades = filteredGrades.filter((g) => g.competency_id === id && g.grade !== null);
            const avg =
              compGrades.length > 0
                ? Math.round(compGrades.reduce((acc, g) => acc + (g.grade || 0), 0) / compGrades.length)
                : 0;
            return { subject: compLabels[id] || id.toUpperCase(), A: avg };
          });

          const subjectAverages = subjects
            .map((s) => {
              const sGrades = filteredGrades.filter((g) => g.subject_id === s.id && g.grade !== null);
              const avg =
                sGrades.length > 0
                  ? Math.round(sGrades.reduce((acc, g) => acc + (g.grade || 0), 0) / sGrades.length)
                  : 0;
              return { name: s.name.substring(0, 10), nota: avg, fullName: s.name };
            })
            .filter((s) => s.nota > 0)
            .sort((a, b) => b.nota - a.nota)
            .slice(0, 8);

          const trend = periods.map((tp) => {
            const pGrades = grades.filter(
              (g) => g.period === tp && g.grade !== null && studentIds.has(g.student_id)
            );
            const pAvg =
              pGrades.length > 0
                ? Math.round(pGrades.reduce((acc, g) => acc + (g.grade || 0), 0) / pGrades.length)
                : 0;

            const compStats: any = { name: tp, promedio: pAvg };
            ['c1', 'c2', 'c3', 'c4'].forEach((cId) => {
              const cGrades = pGrades.filter((g) => g.competency_id === cId);
              compStats[cId] =
                cGrades.length > 0
                  ? Math.round(cGrades.reduce((acc, g) => acc + (g.grade || 0), 0) / cGrades.length)
                  : 0;
            });
            return compStats;
          });

          const subjectsTrend = subjects
            .map((s) => {
              const data: any = { name: s.name.substring(0, 8), fullName: s.name };
              periods.forEach((tp) => {
                const sg = grades.filter(
                  (g) =>
                    g.subject_id === s.id &&
                    g.period === tp &&
                    g.grade !== null &&
                    studentIds.has(g.student_id)
                );
                data[tp] =
                  sg.length > 0
                    ? Math.round(sg.reduce((acc, g) => acc + (g.grade || 0), 0) / sg.length)
                    : 0;
              });
              return data;
            })
            .filter((s) => periods.some((tp) => s[tp] > 0));

          const academicStudents = filteredStudents.filter((s) => {
            const course = courses.find((c) => c.id === s.course_id || c.id === s.courseId);
            return !course?.level?.toLowerCase().includes('inicial');
          });

          const riskDist = { '0 Pendientes': 0, '1 Pendiente': 0, '2 Pendientes': 0, '3+ Pendientes': 0 };
          academicStudents.forEach((student) => {
            const studentGrades = filteredGrades.filter(
              (g) => g.student_id === student.id && g.grade !== null
            );
            const subjectGradesMap: Record<string, number[]> = {};
            studentGrades.forEach((g) => {
              if (!subjectGradesMap[g.subject_id]) subjectGradesMap[g.subject_id] = [];
              subjectGradesMap[g.subject_id].push(g.grade || 0);
            });

            let failedCount = 0;
            Object.values(subjectGradesMap).forEach((gradesArr) => {
              const avg = gradesArr.reduce((a, b) => a + b, 0) / gradesArr.length;
              if (avg < 70) failedCount++;
            });

            if (failedCount === 0) riskDist['0 Pendientes']++;
            else if (failedCount === 1) riskDist['1 Pendiente']++;
            else if (failedCount === 2) riskDist['2 Pendientes']++;
            else riskDist['3+ Pendientes']++;
          });

          const riskChart = Object.entries(riskDist)
            .map(([name, value]) => ({
              name,
              value,
              fill: name.includes('0')
                ? '#10b981'
                : name.includes('1')
                  ? '#facc15'
                  : name.includes('2')
                    ? '#f97316'
                    : '#ef4444'
            }))
            .filter((d) => d.value > 0);

          statsObj[level] = { distribution, competencies, subjectAverages, trend, subjectsTrend, riskChart };
        }

        const { error } = await supabase
          .from('school_statistics')
          .upsert({
            center_id: center.id,
            school_year: selectedYear,
            period: p,
            stats: statsObj,
            updated_by: profile?.id
          }, { onConflict: 'center_id,school_year,period' });

        if (error) throw error;
      }

      toast.dismiss(loadingToast);
      toast.success('Estadísticas actualizadas con éxito.');

      const { data } = await supabase
        .from('school_statistics')
        .select('*')
        .eq('center_id', center.id)
        .eq('school_year', selectedYear)
        .eq('period', selectedPeriod)
        .maybeSingle();
      if (data && data.stats) setDbStats(data.stats);

    } catch (err: any) {
      console.error('Error updating stats:', err);
      toast.dismiss(loadingToast);
      toast.error('Error al actualizar: ' + err.message);
    } finally {
      setUpdatingStats(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const currentDay = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][
    currentTime.getDay()
  ];
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

  const normalize = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  // --- CÁLCULOS REALES DE POBLACIÓN (SIN NOTAS) ---
  const stats = useMemo(() => {
    const students = state.students || [];
    const personnel = state.teachers || [];
    const courses = state.courses || [];
    const subjects = state.subjects || [];

    const maleStudents = students.filter((s) => (s.sex || s.gender || '').startsWith('M')).length;
    const femaleStudents = students.filter((s) => (s.sex || s.gender || '').startsWith('F')).length;

    const teachers = personnel.filter(
      (p) => p.role === 'teacher' || p.role === 'management_teacher'
    );
    const maleTeachers = teachers.filter((t) => t.sex === 'M').length;
    const femaleTeachers = teachers.filter((t) => t.sex === 'F').length;

    const management = personnel.filter(
      (p) => p.role === 'management' || p.role === 'management_teacher'
    ).length;
    const admin = personnel.filter((p) => p.role === 'administrative').length;
    const support = personnel.filter((p) => p.role === 'support').length;
    const totalNonTeachers = management + admin + support;

    const uniqueLevels = [...new Set(courses.map((c) => c.level))].filter(Boolean).length;

    return {
      totalStudents: students.length,
      maleStudents,
      femaleStudents,
      totalTeachers: teachers.length,
      maleTeachers,
      femaleTeachers,
      totalNonTeachers,
      management,
      admin,
      support,
      totalCourses: courses.length,
      totalSubjects: subjects.length,
      totalLevels: uniqueLevels || 0
    };
  }, [state.students, state.teachers, state.courses, state.subjects]);

  // --- ANALÍTICA AVANZADA (PRECALCULADA) ---
  const analytics = useMemo(() => {
    const lvlKey = selectedLevel === 'Primario' ? 'Primaria' : selectedLevel === 'Secundario' ? 'Secundaria' : 'Todos';
    if (dbStats && dbStats[lvlKey]) {
      return dbStats[lvlKey];
    }
    return {
      distribution: [],
      competencies: [],
      subjectAverages: [],
      trend: [],
      subjectsTrend: []
    };
  }, [dbStats, selectedLevel]);

  // --- AGENDA DEL DÍA (REAL DEL CALENDARIO) ---
  const todayEvents = useMemo(() => {
    const year = currentTime.getFullYear();
    const month = String(currentTime.getMonth() + 1).padStart(2, '0');
    const day = String(currentTime.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    return (state.activities || [])
      .filter((e) => e.date >= todayStr)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return getMinutes(a.startTime) - getMinutes(b.startTime);
      })
      .slice(0, 6);
  }, [state.activities, currentTime]);

  // --- OPERACIONES EN VIVO (FILTRADO POR TANDA) ---
  const [activeTanda, setActiveTanda] = useState<'Matutina' | 'Vespertina' | 'Extendida' | 'Todas'>(
    currentTime.getHours() < 13 ? 'Matutina' : 'Vespertina'
  );

  const liveStats = useMemo(() => {
    const normCurrentDay = normalize(currentDay);
    return state.courses
      .filter((course) => {
        if (activeTanda === 'Todas') return true;
        if (activeTanda === 'Matutina')
          return course.tanda === 'Matutina' || course.tanda === 'Extendida';
        if (activeTanda === 'Vespertina') return course.tanda === 'Vespertina';
        return course.tanda === activeTanda;
      })
      .map((course) => {
        const currentEntry = state.schedule.find((entry) => {
          if (entry.course_id !== course.id && entry.courseId !== course.id) return false;

          const entryDay = entry.day || '';
          if (entryDay && normalize(entryDay) !== normCurrentDay) return false;

          const sTime = entry.start_time || entry.startTime;
          const eTime = entry.end_time || entry.endTime;

          if (sTime && eTime) {
            const start = getMinutes(sTime);
            const end = getMinutes(eTime);
            return currentTimeMinutes >= start && currentTimeMinutes < end;
          }

          const tbId = entry.time_block_id || entry.timeBlockId;
          const tb = state.timeBlocks.find((b) => b.id === tbId);
          if (!tb) return false;
          if (normalize(tb.day) !== normCurrentDay) return false;

          const start = getMinutes(tb.startTime || tb.start_time || '');
          const end = getMinutes(tb.endTime || tb.end_time || '');
          return currentTimeMinutes >= start && currentTimeMinutes < end;
        });

        if (currentEntry) {
          const subId = currentEntry.subject_id || currentEntry.subjectId;
          const teaId = currentEntry.teacher_id || currentEntry.teacherId;
          const subject = state.subjects.find((s) => s.id === subId);
          const teacher = state.teachers.find((t) => t.id === teaId);
          return {
            ...course,
            status: 'busy',
            subject,
            teacher,
            start_time: currentEntry.start_time || currentEntry.startTime,
            end_time: currentEntry.end_time || currentEntry.endTime
          };
        }

        // --- DETECCIÓN DE RECREO INTELIGENTE ---
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

        const applicableBPs = (state.breakPreferences || []).filter((bp) => {
          if (bp.level && bp.level !== course.level) {
            const levelNormBP = (bp.level || '').toLowerCase();
            const levelNormCourse = (course.level || '').toLowerCase();
            if (levelNormBP.substring(0, 4) !== levelNormCourse.substring(0, 4)) return false;
          }
          const start = getMinutes(bp.startTime || bp.start_time || '');
          const isMorningBreak = start < 780; // Antes de la 1:00 PM
          const isMorningCourse = course.tanda === 'Matutina' || course.tanda === 'Extendida';
          return isMorningBreak === isMorningCourse;
        });

        let targetBP = applicableBPs.find((bp) => {
          if (isFirstCycle && (bp.cycle || '').includes('Primer')) return true;
          if (isSecondCycle && (bp.cycle || '').includes('Segundo')) return true;
          return false;
        });

        if (!targetBP) {
          targetBP = applicableBPs.find((bp) => !bp.cycle || bp.cycle === 'General');
        }

        let breakTime = null;
        if (targetBP) {
          const start = getMinutes(targetBP.startTime || targetBP.start_time || '');
          const end = start + (targetBP.durationMinutes || 15);
          if (currentTimeMinutes >= start && currentTimeMinutes < end) {
            breakTime = targetBP;
          }
        }

        if (breakTime) {
          return {
            ...course,
            status: 'break',
            start_time: breakTime.startTime || breakTime.start_time
          };
        }

        return { ...course, status: 'free' };
      });
  }, [state, currentDay, currentTimeMinutes, activeTanda]);

  const freeTeachers = useMemo(() => {
    const busyTeacherIds = new Set(
      liveStats
        .filter((c) => c.status === 'busy')
        .map((c) => c.teacher?.id)
        .filter(Boolean)
    );
    return state.teachers.filter(
      (t) => (t.role === 'teacher' || t.role === 'management_teacher') && !busyTeacherIds.has(t.id)
    );
  }, [state.teachers, liveStats]);

  const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#6366f1', '#10b981'];

  return (
    <div className="space-y-6 pb-20">
      <SEO title="Dashboard Operativo" description="Centro de mando institucional Edugest." />

      {/* 1. ENCABEZADO PREMIUM */}
      <div className="bg-white py-6 px-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-8">
        <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center p-4 border border-slate-50 relative">
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white animate-pulse"></div>
          {center?.logo_url ? (
            <img src={center.logo_url} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl">
              {center?.name?.[0] || 'E'}
            </div>
          )}
        </div>
        <div className="text-center md:text-left flex-1">
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none mb-2">
            {center?.name || 'Gestión Institucional'}
          </h1>
          <p className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.4em] opacity-70">
            BALUARTE DE LA EDUCACIÓN EN PRINCIPIOS MORALES Y ESPIRITUALES
          </p>
        </div>
      </div>

      {/* 1.5 CONTADORES DE POBLACIÓN (REDISEÑO CONSOLIDADO) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD ALUMNOS */}
        <div className="bg-white/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/60 shadow-sm hover:shadow-xl transition-all group">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
              <Users size={20} />
            </div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Alumnos
            </span>
          </div>
          <div className="flex items-end justify-between">
            <h4 className="text-4xl font-black text-slate-900 leading-none">
              {stats.totalStudents}
            </h4>
            <div className="text-right space-y-1">
              <p className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                VARONES: {stats.maleStudents}
              </p>
              <p className="text-[9px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                HEMBRAS: {stats.femaleStudents}
              </p>
            </div>
          </div>
        </div>

        {/* CARD DOCENTES */}
        <div className="bg-white/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/60 shadow-sm hover:shadow-xl transition-all group">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform">
              <Briefcase size={20} />
            </div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Docentes
            </span>
          </div>
          <div className="flex items-end justify-between">
            <h4 className="text-4xl font-black text-slate-900 leading-none">
              {stats.totalTeachers}
            </h4>
            <div className="text-right space-y-1">
              <p className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                MASC: {stats.maleTeachers}
              </p>
              <p className="text-[9px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                FEM: {stats.femaleTeachers}
              </p>
            </div>
          </div>
        </div>

        {/* CARD PERSONAL GENERAL (CONSOLIDADO) */}
        <div className="bg-white/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/60 shadow-sm hover:shadow-xl transition-all group">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-2xl shadow-lg shadow-slate-200 group-hover:scale-110 transition-transform">
              <UserCheck size={20} />
            </div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Personal
            </span>
          </div>
          <div className="flex items-end justify-between">
            <h4 className="text-4xl font-black text-slate-900 leading-none">
              {stats.totalNonTeachers}
            </h4>
            <div className="text-[8px] font-black text-slate-500 uppercase leading-relaxed text-right">
              <p>Admin: {stats.admin}</p>
              <p>Apoyo: {stats.support}</p>
              <p>Gestión: {stats.management}</p>
            </div>
          </div>
        </div>

        {/* CARD ESTRUCTURA ACADÉMICA (NUEVO) */}
        <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl hover:shadow-indigo-500/20 transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 blur-2xl rounded-full -mr-12 -mt-12"></div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-2.5 bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-500/40 group-hover:scale-110 transition-transform">
              <BookOpen size={20} />
            </div>
            <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">
              Estructura Académica
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 relative z-10">
            <div className="text-center">
              <p className="text-xl font-black text-white">{stats.totalCourses}</p>
              <p className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">
                Cursos
              </p>
            </div>
            <div className="text-center border-x border-white/10">
              <p className="text-xl font-black text-white">{stats.totalSubjects}</p>
              <p className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">
                Materias
              </p>
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-white">{stats.totalLevels}</p>
              <p className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">
                Niveles
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DASHBOARD DE ANALÍTICA (4 GRÁFICOS HORIZONTALES) */}
      {!dbStats ? (
        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-12 text-center flex flex-col items-center justify-center gap-4 shadow-xl relative overflow-hidden my-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full"></div>
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl mb-2">
            <BarChart3 size={32} />
          </div>
          <h3 className="text-lg font-black uppercase text-slate-800 tracking-tight leading-tight">
            Estadísticas no calculadas
          </h3>
          <p className="text-xs text-slate-500 max-w-md leading-relaxed">
            Las estadísticas de rendimiento académico para el periodo <strong>{selectedPeriod}</strong> del año <strong>{selectedYear}</strong> no han sido procesadas aún en la base de datos.
          </p>
          {isAdmin && (
            <button
              onClick={handleUpdateStats}
              disabled={updatingStats}
              className="mt-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-2xl shadow-xl shadow-indigo-100 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Activity size={14} className={updatingStats ? 'animate-spin' : ''} />
              {updatingStats ? 'Calculando estadísticas...' : 'Calcular Estadísticas del Centro'}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* GRÁFICO 1: ÍNDICE DE EXCELENCIA */}
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl hover:shadow-2xl transition-all group overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <PieIcon size={18} />
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Índice Académico
                </h3>
              </div>
              <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">
                EN VIVO
              </span>
            </div>
            <div className="h-[200px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    labelLine={false}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                      const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                      return (
                        <text
                          x={x}
                          y={y}
                          fill="white"
                          textAnchor="middle"
                          dominantBaseline="central"
                          style={{ fontSize: '10px', fontWeight: 'bold' }}
                        >
                          {`${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                  >
                    {analytics.distribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '20px',
                      border: 'none',
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value, entry: any) => {
                      const scale = rankingScales.find((s) => s.label === value);
                      return (
                        <span className="text-[10px] text-slate-500 font-medium">
                          {value} ({scale?.min}-{scale?.max})
                        </span>
                      );
                    }}
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-2xl font-black text-slate-900">{stats.totalStudents}</p>
                <p className="text-[8px] font-black text-slate-400 uppercase">Alumnos</p>
              </div>
            </div>
          </div>

          {/* GRÁFICO 2: DESEMPEÑO POR COMPETENCIA (BARRAS DIGERIBLES) */}
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl hover:shadow-2xl transition-all">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Target size={18} />
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Por Competencia
                </h3>
              </div>
              <span className="text-[9px] font-black text-slate-400">Promedio %</span>
            </div>
            <div className="h-[200px] w-full flex flex-col justify-center gap-6 px-2">
              {analytics.competencies.map((c: any, i: number) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-700 uppercase">
                      {c.subject}
                    </span>
                    <span className="text-[10px] font-black text-emerald-600">{c.A}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${c.A}%`,
                        backgroundColor: i === 0 ? '#6366f1' : i === 1 ? '#10b981' : '#f59e0b',
                        boxShadow: '0 0 10px rgba(0,0,0,0.1)'
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* GRÁFICO 3: PROMEDIO POR MATERIA (REDiseño LEGIBLE) */}
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl hover:shadow-2xl transition-all">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <BarChart3 size={18} />
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Rendimiento Materia
                </h3>
              </div>
            </div>
            <div className="h-[200px] w-full overflow-y-auto pr-2 custom-scrollbar space-y-4">
              {analytics.subjectAverages.length > 0 ? (
                analytics.subjectAverages.map((s: any, idx: number) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[8px] font-black text-slate-500 uppercase truncate max-w-[80%]">
                        {s.fullName}
                      </span>
                      <span className="text-[9px] font-black text-indigo-600">{s.nota}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${s.nota >= 70 ? 'bg-indigo-500' : 'bg-rose-500'}`}
                        style={{ width: `${s.nota}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex items-center justify-center text-[10px] font-bold text-slate-300 uppercase italic">
                  Sin datos este periodo
                </div>
              )}
            </div>
          </div>

          {/* GRÁFICO 4: TENDENCIA Y COMPARATIVA MULTI-PERIODO (POTENCIADO) */}
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl hover:shadow-2xl transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <LineIcon size={18} />
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Análisis Comparativo
                </h3>
              </div>
            </div>

            {/* SELECTOR DE MODO INTERNO */}
            <div className="flex gap-1 bg-slate-50 p-1 rounded-xl mb-6">
              <button
                onClick={() => setComparisonMode('indice')}
                className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${comparisonMode === 'indice' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}
              >
                Índice
              </button>
              <button
                onClick={() => setComparisonMode('competencias')}
                className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${comparisonMode === 'competencias' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
              >
                Comps
              </button>
              <button
                onClick={() => setComparisonMode('materias')}
                className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${comparisonMode === 'materias' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
              >
                Materias
              </button>
            </div>

            <div className="h-[200px] w-full">
              {comparisonMode === 'materias' ? (
                <div className="h-full w-full overflow-x-auto custom-scrollbar">
                  <div style={{ width: Math.max(analytics.subjectsTrend.length * 80, 300) }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analytics.subjectsTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 8, fontWeight: 'bold', fill: '#94a3b8' }}
                        />
                        <Tooltip contentStyle={{ borderRadius: '20px', border: 'none' }} />
                        <Bar dataKey="P1" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={10}>
                          <LabelList
                            dataKey="P1"
                            position="top"
                            style={{ fontSize: '6px', fontWeight: 'bold', fill: '#94a3b8' }}
                            formatter={(v: any) => (v > 0 ? `${v}%` : '')}
                          />
                        </Bar>
                        <Bar dataKey="P2" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={10}>
                          <LabelList
                            dataKey="P2"
                            position="top"
                            style={{ fontSize: '6px', fontWeight: 'bold', fill: '#94a3b8' }}
                            formatter={(v: any) => (v > 0 ? `${v}%` : '')}
                          />
                        </Bar>
                        <Bar dataKey="P3" fill="#64748b" radius={[4, 4, 0, 0]} barSize={10}>
                          <LabelList
                            dataKey="P3"
                            position="top"
                            style={{ fontSize: '6px', fontWeight: 'bold', fill: '#64748b' }}
                            formatter={(v: any) => (v > 0 ? `${v}%` : '')}
                          />
                        </Bar>
                        <Bar dataKey="P4" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={10}>
                          <LabelList
                            dataKey="P4"
                            position="top"
                            style={{ fontSize: '6px', fontWeight: 'bold', fill: '#4f46e5' }}
                            formatter={(v: any) => (v > 0 ? `${v}%` : '')}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                    />
                    <YAxis hide domain={[0, 100]} />
                    <Tooltip contentStyle={{ borderRadius: '20px', border: 'none' }} />
                    {comparisonMode === 'indice' ? (
                      <Bar dataKey="promedio" fill="#ef4444" radius={[10, 10, 0, 0]} barSize={30}>
                        <LabelList
                          dataKey="promedio"
                          position="top"
                          style={{ fontSize: '8px', fontWeight: 'bold', fill: '#ef4444' }}
                          formatter={(v: any) => `${v}%`}
                        />
                      </Bar>
                    ) : (
                      <>
                        <Bar dataKey="c1" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={15}>
                          <LabelList
                            dataKey="c1"
                            position="top"
                            style={{ fontSize: '7px', fontWeight: 'bold', fill: '#6366f1' }}
                            formatter={(v: any) => `${v}%`}
                          />
                        </Bar>
                        <Bar dataKey="c2" fill="#10b981" radius={[4, 4, 0, 0]} barSize={15}>
                          <LabelList
                            dataKey="c2"
                            position="top"
                            style={{ fontSize: '7px', fontWeight: 'bold', fill: '#10b981' }}
                            formatter={(v: any) => `${v}%`}
                          />
                        </Bar>
                        <Bar dataKey="c3" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={15}>
                          <LabelList
                            dataKey="c3"
                            position="top"
                            style={{ fontSize: '7px', fontWeight: 'bold', fill: '#f59e0b' }}
                            formatter={(v: any) => `${v}%`}
                          />
                        </Bar>
                        <Legend
                          iconType="circle"
                          wrapperStyle={{
                            fontSize: '8px',
                            fontWeight: 'bold',
                            textTransform: 'uppercase'
                          }}
                        />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2.1 SELECTOR DE PERIODO Y NIVEL (FILTRO DE ANALÍTICA) */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-6 bg-white/50 backdrop-blur-sm p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 border-r border-slate-200 pr-6">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
            Nivel Académico:
          </span>
          {['Todos', 'Primario', 'Secundario'].map((l) => (
            <button
              key={l}
              onClick={() => setSelectedLevel(l)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                selectedLevel === l
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-white text-slate-400 hover:text-slate-600 border border-slate-100'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 border-r border-slate-200 pr-6">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
            Analizar Periodo:
          </span>
          {['P1', 'P2', 'P3', 'P4'].map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={`px-8 py-3 rounded-2xl text-xs font-black transition-all ${
                selectedPeriod === p
                  ? 'bg-slate-900 text-white shadow-xl scale-110'
                  : 'bg-white text-slate-400 hover:text-slate-600 border border-slate-100'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {isAdmin && (
          <button
            onClick={handleUpdateStats}
            disabled={updatingStats}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 cursor-pointer ${
              updatingStats
                ? 'bg-slate-100 text-slate-400 border border-slate-200'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100'
            }`}
          >
            <Activity size={12} className={updatingStats ? 'animate-spin' : ''} />
            {updatingStats ? 'Procesando...' : 'Calcular Estadísticas'}
          </button>
        )}
      </div>

      {/* 3. MONITOREO EN TIEMPO REAL - REDISEÑO ALTO CONTRASTE */}
      <div className="bg-white rounded-[3rem] p-10 text-slate-900 shadow-2xl border-4 border-brand-blue relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-blue/5 blur-[120px] rounded-full -mr-40 -mt-40"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-6 border-b-2 border-slate-50 pb-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-brand-blue text-white rounded-[1.8rem] flex items-center justify-center shadow-2xl shadow-brand-blue/30">
              <Activity size={32} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">
                MONITOREO EN TIEMPO REAL
              </h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3 mt-1">
                <Calendar size={14} className="text-brand-blue" /> {currentDay}{' '}
                <span className="text-slate-200">|</span>{' '}
                <Clock size={14} className="text-brand-blue" />{' '}
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                <span className="ml-4 px-2 py-1 bg-slate-100 text-slate-400 rounded-lg text-[8px]">
                  DEBUG: {state.schedule.length} Entradas | {state.timeBlocks.length} Bloques |{' '}
                  {selectedYear}
                </span>
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="px-8 py-4 bg-emerald-50 rounded-[2rem] border-2 border-emerald-200 flex flex-col items-center shadow-sm">
              <p className="text-[10px] font-black uppercase text-emerald-700 tracking-widest mb-1">
                Clases Activas
              </p>
              <p className="text-3xl font-black text-emerald-900 leading-none">
                {liveStats.filter((c) => c.status === 'busy').length}
              </p>
            </div>
            <div className="px-8 py-4 bg-slate-50 rounded-[2rem] border-2 border-slate-200 flex flex-col items-center shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">
                Cursos en Vista
              </p>
              <p className="text-3xl font-black text-slate-900 leading-none">{liveStats.length}</p>
            </div>
          </div>
        </div>

        {/* SELECTOR DE TANDA PARA EL MONITOREO */}
        <div className="relative z-10 flex flex-wrap gap-2 mb-8 bg-slate-50 p-2 rounded-[2.5rem] border-2 border-slate-100 max-w-fit">
          {['Matutina', 'Vespertina', 'Todas'].map((t: any) => (
            <button
              key={t}
              onClick={() => setActiveTanda(t)}
              className={`px-8 py-3 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                activeTanda === t
                  ? 'bg-slate-900 text-white shadow-xl'
                  : 'text-slate-400 hover:bg-white hover:text-slate-900'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {liveStats.map((c) => {
            const sTime = c.start_time || c.startTime;
            const eTime = c.end_time || c.endTime;

            return (
              <div
                key={c.id}
                className={`p-5 rounded-[2rem] border-2 transition-all duration-300 hover:scale-105 shadow-md flex flex-col justify-between min-h-[140px] ${
                  c.status === 'busy'
                    ? 'bg-white border-emerald-400 ring-2 ring-emerald-50'
                    : c.status === 'break'
                      ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-100'
                      : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter leading-none">
                    {c.grade}
                    {c.section}
                  </span>
                  <div
                    className={`w-2.5 h-2.5 rounded-full border-2 border-white ${
                      c.status === 'busy'
                        ? 'bg-emerald-500 animate-pulse'
                        : c.status === 'break'
                          ? 'bg-amber-500 animate-bounce'
                          : 'bg-slate-300'
                    }`}
                  ></div>
                </div>

                {c.status === 'busy' ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1 text-emerald-600 font-black text-[7px] uppercase tracking-tighter bg-emerald-50 px-1.5 py-0.5 rounded-md w-fit whitespace-nowrap">
                      <Clock size={7} /> {sTime} - {eTime}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-900 leading-tight uppercase line-clamp-2 mb-0.5">
                        {c.subject?.name}
                      </p>
                      <p className="text-[7.5px] font-bold text-slate-500 uppercase truncate">
                        {c.teacher?.name}
                      </p>
                    </div>
                  </div>
                ) : c.status === 'break' ? (
                  <div className="space-y-2">
                    <div className="bg-amber-500 text-white text-[8px] font-black px-2 py-0.5 rounded-md inline-block uppercase tracking-widest text-center w-full">
                      🔔 RECREO
                    </div>
                    <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest italic text-center">
                      Hora de Descanso
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-slate-200 text-slate-600 text-[8px] font-black px-2 py-0.5 rounded-md inline-block uppercase tracking-widest text-center w-full">
                      DISPONIBLE
                    </div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic text-center">
                      Aula Libre
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* DOCENTES DISPONIBLES - ALTO CONTRASTE */}
        <div className="relative z-10 mt-10 pt-8 border-t-2 border-slate-50">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border-2 border-indigo-100">
                <Users size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
                  Personal Disponible
                </h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                  Docentes sin clase en este momento
                </p>
              </div>
            </div>
            <div className="px-4 py-1.5 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
              {freeTeachers.length} Libres
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {freeTeachers.length > 0 ? (
              freeTeachers.map((t: any) => (
                <div
                  key={t.id}
                  className="px-4 py-2 bg-white border-2 border-slate-100 rounded-xl flex items-center gap-3 shadow-sm hover:border-brand-blue hover:shadow-md transition-all group"
                >
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-brand-blue/10 group-hover:text-brand-blue transition-colors">
                    <User size={12} />
                  </div>
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">
                    {t.name}
                  </span>
                </div>
              ))
            ) : (
              <div className="w-full p-8 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Todo el personal está ocupado en este momento
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. AGENDA DEL DÍA (HORIZONTAL) */}
      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-4">
            <Calendar size={20} className="text-indigo-600" /> Agenda Próxima
          </h3>
          <div className="h-1 flex-1 mx-6 bg-slate-50 rounded-full"></div>
        </div>

        <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar">
          {todayEvents.length === 0 ? (
            <div className="w-full py-16 flex flex-col items-center justify-center text-slate-300 italic text-sm">
              <Calendar size={48} className="mb-4 opacity-10" />
              No hay eventos programados en el calendario escolar.
            </div>
          ) : (
            todayEvents.map((event, idx) => {
              const eventDate = new Date(event.date + 'T12:00:00');
              const dayNum = eventDate.getDate();
              const monthName = eventDate
                .toLocaleString('es', { month: 'short' })
                .toUpperCase()
                .replace('.', '');

              return (
                <div
                  key={idx}
                  className="min-w-[300px] p-6 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:border-indigo-600 hover:bg-white transition-all group cursor-pointer shadow-sm hover:shadow-xl"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-white rounded-[1.5rem] flex flex-col items-center justify-center shadow-lg border border-slate-100 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                      <span className="text-[9px] font-black uppercase leading-none mb-1 opacity-60 group-hover:text-white/60">
                        {monthName}
                      </span>
                      <span className="text-2xl font-black leading-none">{dayNum}</span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="text-md font-black text-slate-800 truncate group-hover:text-indigo-600 transition-colors leading-tight mb-2">
                        {event.title}
                      </h4>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <p className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-1.5">
                          <Clock size={12} /> {event.startTime}
                        </p>
                        <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5">
                          <MapPin size={12} /> {event.level?.[0] || 'I'} -{' '}
                          {event.cycle || 'Institucional'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
});
