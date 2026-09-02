import React, { useState, useEffect } from 'react';
import {
  FileBarChart,
  Printer,
  Download,
  Search as SearchIcon,
  LayoutGrid,
  Users,
  BookOpen,
  ShieldCheck,
  Activity,
  Filter,
  FileText,
  BarChart3,
  GraduationCap,
  ClipboardCheck,
  BookMarked,
  Briefcase,
  UserCheck,
  User,
  Loader2,
  AlertTriangle,
  Home,
  ScrollText as ScrollIcon,
  X,
  Plus,
  Target,
  TrendingUp as LineIcon
} from 'lucide-react';
import PrimaryCertificate from './PrimaryCertificate';
import ConductBalanceCertificate from './ConductBalanceCertificate';
import { GradeReports } from './GradeReports';
import { InstitutionalRecordReport } from './InstitutionalRecordReport';
import { CourseRecordReport } from './CourseRecordReport';
import { MassDigitizingReport } from './MassDigitizingReport';
import { PerformanceComparisonReport } from './PerformanceComparisonReport';
import { HonorRollReport } from './HonorRollReport';
import { TeacherPerformanceReport } from './TeacherPerformanceReport';
import { StaffConsolidatedReport } from './StaffConsolidatedReport';
import { WorkloadReport } from './WorkloadReport';
import { IncidentsReport } from './IncidentsReport';
import { MeetingsReport } from './MeetingsReport';
import { PedagogicalReport } from './PedagogicalReport';
import FamilyReport from './FamilyReport';
import DemographicReport from './DemographicReport';
import { GlobalAdminDashboardReport } from './GlobalAdminDashboardReport';
import MasterDirectoryReport from './MasterDirectoryReport';
import { useApp, useSupabase } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LabelList
} from 'recharts';

const rankingScales = [
  { label: 'Excelente', min: 95, max: 100, color: '#10b981' },
  { label: 'Muy Bueno', min: 90, max: 94, color: '#6366f1' },
  { label: 'Bueno', min: 80, max: 89, color: '#3b82f6' },
  { label: 'Regular', min: 70, max: 79, color: '#f59e0b' },
  { label: 'En proceso', min: 0, max: 69, color: '#ef4444' }
];

const ReportCard = ({ title, description, icon: Icon, color, onClick }: any) => (
  <div
    onClick={onClick}
    className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl group hover:-translate-y-2 transition-all duration-300 cursor-pointer relative overflow-hidden"
  >
    <div
      className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-5 ${color} blur-3xl group-hover:opacity-10 transition-opacity`}
    ></div>
    <div
      className={`p-4 rounded-2xl ${color} text-white w-fit mb-6 shadow-lg group-hover:scale-110 transition-transform duration-500`}
    >
      <Icon size={24} />
    </div>
    <h3 className="text-lg font-black uppercase text-slate-800 mb-2 leading-tight">{title}</h3>
    <p className="text-xs text-slate-500 leading-relaxed">{description}</p>

    <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-600 transition-colors">
        Generar ahora
      </span>
      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
        <Printer size={14} />
      </div>
    </div>
  </div>
);

export const GeneralReports = () => {
  const [activeCategory, setActiveCategory] = useState('academic-general');
  const [searchTerm, setSearchTerm] = useState('');

  const categories = [
    { id: 'academic-general', label: 'Académico General', icon: LayoutGrid },
    { id: 'academic-course', label: 'Académico por Curso', icon: GraduationCap },
    { id: 'admin', label: 'Administrativos', icon: ShieldCheck },
    { id: 'students', label: 'Estudiantes', icon: Users }
  ];

  const reports = {
    'academic-general': [
      {
        title: 'Estadística General',
        description:
          'Página consolidada con matrícula total por niveles, grados, sexo y distribución de personal por área.',
        icon: Users,
        color: 'bg-blue-600',
        id: 'summary-report'
      },
      {
        title: 'Control de Digitado Masivo',
        description: 'Auditoría de carga de notas de todos los profesores del centro.',
        icon: ClipboardCheck,
        color: 'bg-rose-600',
        id: 'mass-digitizing'
      },
      {
        title: 'Récord Académico Institucional',
        description: 'Historial consolidado de calificaciones de todos los niveles del centro.',
        icon: GraduationCap,
        color: 'bg-indigo-600',
        id: 'institutional-record'
      },
      {
        title: 'Desempeño Académico por Docente',
        description: 'Análisis de promedios e índices académicos agrupados por profesor y materia.',
        icon: User,
        color: 'bg-indigo-500',
        id: 'teacher-performance'
      },
      {
        title: 'Comparativa de Rendimiento',
        description: 'Análisis de promedios entre diferentes niveles y ciclos escolares.',
        icon: BarChart3,
        color: 'bg-emerald-600',
        id: 'performance-comparison'
      },
      {
        title: 'Cuadro de Honor Institucional',
        description: 'Listado de los estudiantes con mayor mérito de todo el centro.',
        icon: LayoutGrid,
        color: 'bg-amber-500',
        id: 'honor-roll'
      }
    ],
    'academic-course': [
      {
        title: 'Récord Académico por Grado',
        description:
          'Vistazo general y detallado del desempeño, promedios y alumnos en riesgo de un curso específico.',
        icon: Users,
        color: 'bg-emerald-600',
        id: 'course-record'
      }
    ],
    admin: [
      {
        title: 'Dashboard Global Administrativo',
        description: 'Análisis dinámico de matrícula, personal, finanzas (ingresos/gastos), agenda e incidencias en un rango de fechas.',
        icon: LineIcon,
        color: 'bg-indigo-600',
        id: 'global-admin-report'
      },
      {
        title: 'Reporte Consolidado de Personal',
        description: 'Listado de todo el equipo (Docentes, Administrativos, Apoyo).',
        icon: Briefcase,
        color: 'bg-teal-600',
        id: 'staff-consolidated'
      },
      {
        title: 'Carga Horaria y Funciones',
        description: 'Distribución de responsabilidades y horarios del personal.',
        icon: BookOpen,
        color: 'bg-orange-600',
        id: 'workload-report'
      },
      {
        title: 'Registro de Incidencias',
        description: 'Seguimiento consolidado de novedades y eventos reportados en la agenda.',
        icon: AlertTriangle,
        color: 'bg-rose-600',
        id: 'incidents-report'
      },
      {
        title: 'Agenda de Reuniones',
        description: 'Cronograma y actas de encuentros del personal y equipo directivo.',
        icon: Users,
        color: 'bg-cyan-600',
        id: 'meetings-report'
      },
      {
        title: 'Grupos Pedagógicos',
        description: 'Registro consolidado de sesiones de formación y trabajo colaborativo.',
        icon: BookOpen,
        color: 'bg-violet-600',
        id: 'pedagogical-report'
      }
    ],
    students: [
      {
        title: 'Directorio Maestro',
        description: 'Base de datos completa con información de contacto y tutores legal.',
        icon: Users,
        color: 'bg-violet-600',
        id: 'master-directory'
      },
      {
        title: 'Estadísticas Demográficas',
        description: 'Análisis de población escolar por edad, sexo y procedencia.',
        icon: Activity,
        color: 'bg-pink-600',
        id: 'demographic-report'
      },
      {
        title: 'Reporte de Familias',
        description: 'Análisis de núcleos familiares, cantidad de hermanos y promedio por nivel.',
        icon: Home,
        color: 'bg-indigo-600',
        id: 'family-report'
      },
      {
        title: 'Certificaciones 6to Primaria',
        description: 'Certificación oficial de conclusión del Nivel Primario.',
        icon: ScrollIcon,
        color: 'bg-amber-600',
        id: 'primary-certificate'
      },
      {
        title: 'Certificaciones y Cotizaciones',
        description:
          'Generar certificaciones de conducta y saldo, o cotización de costos de inscripción y cuotas del año escolar.',
        icon: ScrollIcon,
        color: 'bg-teal-600',
        id: 'conduct-balance-certificate'
      }
    ]
  };

  const { state, selectedYear, center, loadAllGrades } = useApp();
  const { profile } = useSupabase();
  const [selectedPeriod, setSelectedPeriod] = useState('P1');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState('TODO');
  const [comparisonMode, setComparisonMode] = useState<'indice' | 'competencias' | 'materias'>(
    'indice'
  );
  const [auditStats, setAuditStats] = useState<{
    gradeCounts: Record<string, number>;
    levelStudentCounts: Record<string, number>;
  }>({ gradeCounts: {}, levelStudentCounts: {} });
  const [isAuditing, setIsAuditing] = useState(false);
  const [showSummaryReport, setShowSummaryReport] = useState(false);
  const [showInstitutionalRecord, setShowInstitutionalRecord] = useState(false);
  const [showCourseRecord, setShowCourseRecord] = useState(false);

  const [dbStats, setDbStats] = useState<any>(null);
  const [loadingDbStats, setLoadingDbStats] = useState(false);
  const [isGradesLoading, setIsGradesLoading] = useState(false);
  const [gradesLoaded, setGradesLoaded] = useState(false);
  const [updatingStats, setUpdatingStats] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'director' || profile?.role === 'management' || profile?.role === 'management_teacher';

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

          const academicStudents = students.filter((s) => {
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

  // Fetch precalculated stats
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
        console.error('Error fetching general reports statistics:', err);
      } finally {
        setLoadingDbStats(false);
      }
    };

    fetchDbStats();
  }, [center?.id, selectedYear, selectedPeriod]);

  const [showMassDigitizing, setShowMassDigitizing] = useState(false);
  const [showPerformanceComparison, setShowPerformanceComparison] = useState(false);
  const [showHonorRoll, setShowHonorRoll] = useState(false);
  const [showTeacherPerformance, setShowTeacherPerformance] = useState(false);
  const [showStaffConsolidated, setShowStaffConsolidated] = useState(false);
  const [showWorkloadReport, setShowWorkloadReport] = useState(false);
  const [showIncidentsReport, setShowIncidentsReport] = useState(false);
  const [showMeetingsReport, setShowMeetingsReport] = useState(false);
  const [showPedagogicalReport, setShowPedagogicalReport] = useState(false);
  const [showFamilyReport, setShowFamilyReport] = useState(false);
  const [showDemographicReport, setShowDemographicReport] = useState(false);
  const [showPrimaryCertificate, setShowPrimaryCertificate] = useState(false);
  const [showConductBalanceCertificate, setShowConductBalanceCertificate] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedConductStudentId, setSelectedConductStudentId] = useState<string | null>(null);
  const [showMasterDirectory, setShowMasterDirectory] = useState(false);
  const [showGlobalAdminReport, setShowGlobalAdminReport] = useState(false);

  // Load raw grades on-demand for detailed reports
  const needsGrades = showInstitutionalRecord || showCourseRecord || showMassDigitizing || showPerformanceComparison || showHonorRoll || showTeacherPerformance;

  useEffect(() => {
    const loadGradesIfNeeded = async () => {
      if (needsGrades && !gradesLoaded) {
        setIsGradesLoading(true);
        try {
          await loadAllGrades();
          setGradesLoaded(true);
        } catch (e) {
          console.error("Error loading grades on-demand for reports:", e);
        } finally {
          setIsGradesLoading(false);
        }
      }
    };
    loadGradesIfNeeded();
  }, [needsGrades, gradesLoaded, loadAllGrades]);

  const handleBackupData = async () => {
    try {
      let attendanceData: any[] = [];
      if (center?.id) {
        const { data, error } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('center_id', center.id);
        if (error) throw error;
        attendanceData = data || [];
      }

      const backupObj = {
        center: center,
        schoolYear: selectedYear,
        courses: state.courses || [],
        subjects: state.subjects || [],
        teachers: state.teachers || [],
        assignments: state.assignments || [],
        students: state.students || [],
        grades: state.grades || [],
        schedules: state.schedule || [],
        attendance: attendanceData,
        activities: state.activities || []
      };
      const dataStr =
        'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupObj, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute(
        'download',
        `Edugest_Respaldo_${center?.name || 'Centro'}_${selectedYear}_${new Date().toISOString().split('T')[0]}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (error) {
      console.error('Backup error:', error);
      alert('Error al generar el respaldo de datos.');
    }
  };

  // Datos consolidados para la Estadística General Resumida en una página
  const summaryData = React.useMemo(() => {
    const students = state.students || [];
    const courses = state.courses || [];
    const personnel = state.teachers || [];

    // Mapear cursos por ID para acceso rápido
    const courseMap = new Map<string, any>();
    courses.forEach((c: any) => {
      if (c && c.id) {
        courseMap.set(String(c.id), c);
      }
    });

    // Detección precisa de género
    const isStudentMale = (s: any) => {
      const raw = (s.sex || s.gender || '').trim().toLowerCase();
      if (
        raw.startsWith('f') ||
        raw.includes('fem') ||
        raw.includes('muj') ||
        raw.includes('niñ') ||
        raw.includes('nina')
      ) {
        return false;
      }
      if (
        raw.startsWith('m') ||
        raw.startsWith('v') ||
        raw.includes('masc') ||
        raw.includes('var') ||
        raw.includes('hom')
      ) {
        return true;
      }
      return false;
    };

    // Helper para normalizar el nivel pedagógico
    const getNormalizedLevel = (lvl: string, gradeName: string = '') => {
      const l = (lvl || '').toLowerCase();
      const g = (gradeName || '').toLowerCase();
      if (
        l.includes('ini') ||
        g.includes('pre') ||
        g.includes('kinder') ||
        g.includes('kínder') ||
        g.includes('párv') ||
        g.includes('parv') ||
        g.includes('maternal') ||
        g.includes('guard')
      ) {
        return 'Inicial';
      }
      if (l.includes('prim')) {
        return 'Primaria';
      }
      if (l.includes('sec')) {
        return 'Secundaria';
      }
      return 'General';
    };

    // Helper para puntuación y orden pedagógico de grados
    const gradeOrderScore = (gradeName: string) => {
      const g = (gradeName || '').toLowerCase();
      if (g.includes('guard')) return 1;
      if (g.includes('maternal')) return 2;
      if (g.includes('párv') || g.includes('parv')) return 3;
      if (g.includes('pre-k') || g.includes('prek')) return 4;
      if (g.includes('kinder') || g.includes('kínder')) return 5;
      if (g.includes('pre-p') || g.includes('prep') || g.includes('preprimario') || g.includes('pre-primario')) return 6;

      if (g.includes('1ro') || g.includes('primer')) return 10;
      if (g.includes('2do') || g.includes('segund')) return 20;
      if (g.includes('3ro') || g.includes('tercer')) return 30;
      if (g.includes('4to') || g.includes('cuart')) return 40;
      if (g.includes('5to') || g.includes('quint')) return 50;
      if (g.includes('6to') || g.includes('sext')) return 60;
      return 99;
    };

    // Estructura de niveles
    const orderedLevels = ['Inicial', 'Primaria', 'Secundaria'];
    const levelGroups: Record<string, any[]> = {
      Inicial: [],
      Primaria: [],
      Secundaria: []
    };

    // 1. Inicializar todas las filas a partir de los cursos activos del centro
    courses.forEach((c: any) => {
      const normLvl = getNormalizedLevel(c.level, c.grade);
      if (!levelGroups[normLvl]) levelGroups[normLvl] = [];

      const baseGrade = c.grade ? c.grade.trim() : (c.name ? c.name.trim() : 'General');
      const sec = c.section ? c.section.trim() : '';
      const tandaStr = c.tanda ? c.tanda.trim() : '';
      let gradeLabel = sec ? `${baseGrade} - Sec. ${sec}` : baseGrade;
      if (tandaStr && tandaStr.toLowerCase() !== 'general') {
        const tLower = tandaStr.toLowerCase();
        const shiftCode =
          tLower.includes('mat') || tLower.includes('mañ')
            ? 'M'
            : tLower.includes('ves') || tLower.includes('tar')
              ? 'V'
              : tandaStr.substring(0, 1).toUpperCase();
        gradeLabel += ` (${shiftCode})`;
      }

      // Evitar duplicados si el curso ya fue registrado
      if (!levelGroups[normLvl].some((b: any) => b.courseId === String(c.id))) {
        levelGroups[normLvl].push({
          courseId: String(c.id),
          name: gradeLabel,
          male: 0,
          female: 0,
          order: gradeOrderScore(baseGrade)
        });
      }
    });

    // 2. Contar cada estudiante en su curso correspondiente
    students.forEach((s: any) => {
      const sCid = String(s.course_id || s.courseId || '');
      const matchedCourse = courseMap.get(sCid);
      const isMale = isStudentMale(s);

      if (matchedCourse) {
        const normLvl = getNormalizedLevel(matchedCourse.level, matchedCourse.grade);
        const targetBucket = levelGroups[normLvl]?.find((b: any) => b.courseId === String(matchedCourse.id));
        if (targetBucket) {
          if (isMale) targetBucket.male++;
          else targetBucket.female++;
          return;
        }
      }

      // Si no tiene course_id exacto, agrupar bajo su nivel correspondiente
      const normLvl = getNormalizedLevel(s.level, s.grade);
      if (!levelGroups[normLvl]) levelGroups[normLvl] = [];

      const fallbackLabel = s.grade
        ? s.section
          ? `${s.grade.trim()} - Sec. ${s.section.trim()}`
          : s.grade.trim()
        : 'Sin Curso Asignado';

      let targetBucket = levelGroups[normLvl].find((b: any) => b.name === fallbackLabel);
      if (!targetBucket) {
        targetBucket = {
          courseId: `fallback-${fallbackLabel}`,
          name: fallbackLabel,
          male: 0,
          female: 0,
          order: gradeOrderScore(fallbackLabel)
        };
        levelGroups[normLvl].push(targetBucket);
      }

      if (isMale) targetBucket.male++;
      else targetBucket.female++;
    });

    let grandTotalMale = 0;
    let grandTotalFemale = 0;

    // 3. Convertir a arreglo con ordenamiento pedagógico
    const levelsResult = orderedLevels
      .map((lvlName) => {
        const rawGrades = levelGroups[lvlName] || [];
        const sortedGrades = [...rawGrades].sort((a, b) => {
          if (a.order !== b.order) return a.order - b.order;
          return a.name.localeCompare(b.name);
        });

        let lvlMale = 0;
        let lvlFemale = 0;

        const gradesArr = sortedGrades.map((g) => {
          lvlMale += g.male;
          lvlFemale += g.female;
          return {
            name: g.name,
            male: g.male,
            female: g.female,
            total: g.male + g.female
          };
        });

        grandTotalMale += lvlMale;
        grandTotalFemale += lvlFemale;

        return {
          name: lvlName,
          grades: gradesArr,
          totalMale: lvlMale,
          totalFemale: lvlFemale,
          total: lvlMale + lvlFemale
        };
      })
      .filter((l) => l.grades.length > 0 && (l.total > 0 || courses.some((c: any) => getNormalizedLevel(c.level, c.grade) === l.name)));

    // Detección de género del personal
    const isStaffMale = (p: any) => {
      const raw = (p.sex || p.gender || '').trim().toLowerCase();
      if (raw.startsWith('f') || raw.includes('fem') || raw.includes('muj')) return false;
      if (raw.startsWith('m') || raw.startsWith('v') || raw.includes('masc') || raw.includes('var') || raw.includes('hom')) return true;
      return true;
    };

    // Personal clasificado por área y sexo
    let gestionM = 0, gestionF = 0;
    let docentesM = 0, docentesF = 0;
    let adminM = 0, adminF = 0;
    let apoyoM = 0, apoyoF = 0;

    personnel.forEach((p) => {
      const r = (p.role || '').toLowerCase();
      const isM = isStaffMale(p);
      if (r === 'management_teacher') {
        if (isM) { docentesM++; gestionM++; }
        else { docentesF++; gestionF++; }
      } else if (r === 'teacher') {
        if (isM) docentesM++;
        else docentesF++;
      } else if (r === 'management') {
        if (isM) gestionM++;
        else gestionF++;
      } else if (r === 'administrative') {
        if (isM) adminM++;
        else adminF++;
      } else {
        if (isM) apoyoM++;
        else apoyoF++;
      }
    });

    const staffAreas = [
      { name: 'Equipo de Gestión', count: gestionM + gestionF, male: gestionM, female: gestionF },
      { name: 'Personal Docente', count: docentesM + docentesF, male: docentesM, female: docentesF },
      { name: 'Personal Administrativo', count: adminM + adminF, male: adminM, female: adminF },
      { name: 'Personal de Apoyo', count: apoyoM + apoyoF, male: apoyoM, female: apoyoF }
    ];

    const totalStaffMale = gestionM + docentesM + adminM + apoyoM;
    const totalStaffFemale = gestionF + docentesF + adminF + apoyoF;
    const totalStaff = totalStaffMale + totalStaffFemale;

    return {
      levels: levelsResult,
      grandTotalMale,
      grandTotalFemale,
      grandTotal: grandTotalMale + grandTotalFemale,
      staffAreas,
      totalStaffMale,
      totalStaffFemale,
      totalStaff
    };
  }, [state.students, state.courses, state.teachers]);

  const handleDownloadSummaryPDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      let startY = 15;
      if (center?.logo_url || center?.logo) {
        try {
          doc.addImage(center.logo_url || center.logo, 'PNG', 14, startY, 18, 18);
        } catch (e) {}
      }

      const textStartX = center?.logo_url || center?.logo ? 36 : 14;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59);
      doc.text((center?.name || 'CENTRO EDUCATIVO EDUGEST').toUpperCase(), textStartX, startY + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`CÓDIGO: ${center?.center_code || center?.code || 'N/A'}  |  AÑO ESCOLAR: ${selectedYear || '2026-2027'}`, textStartX, startY + 10);
      doc.text(`ESTADÍSTICA GENERAL CONSOLIDADA  |  FECHA: ${new Date().toLocaleDateString('es-DO')}`, textStartX, startY + 15);

      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.6);
      doc.line(14, startY + 20, pageWidth - 14, startY + 20);

      let currentY = startY + 26;

      // 1. Matrícula Estudiantil por Niveles y Grados
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(79, 70, 229);
      doc.text('I. MATRÍCULA ESTUDIANTIL POR NIVELES Y GRADOS', 14, currentY);
      currentY += 3;

      const studentTableBody: any[] = [];

      summaryData.levels.forEach((lvl: any) => {
        studentTableBody.push([
          { content: lvl.name.toUpperCase(), colSpan: 4, styles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 } }
        ]);

        lvl.grades.forEach((g: any) => {
          studentTableBody.push([
            `  ${g.name}`,
            { content: String(g.male), styles: { halign: 'center', textColor: [37, 99, 235] } },
            { content: String(g.female), styles: { halign: 'center', textColor: [225, 29, 72] } },
            { content: String(g.total), styles: { halign: 'right', fontStyle: 'bold', textColor: [79, 70, 229] } }
          ]);
        });

        studentTableBody.push([
          { content: `SUBTOTAL ${lvl.name.toUpperCase()}:`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
          { content: String(lvl.totalMale), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [37, 99, 235] } },
          { content: String(lvl.totalFemale), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [225, 29, 72] } },
          { content: String(lvl.total), styles: { halign: 'right', fontStyle: 'bold', fillColor: [238, 242, 255], textColor: [79, 70, 229] } }
        ]);
      });

      studentTableBody.push([
        { content: 'TOTAL GENERAL MATRÍCULA ESTUDIANTIL:', styles: { fontStyle: 'bold', halign: 'right', fillColor: [224, 231, 255], textColor: [49, 46, 129], fontSize: 8.5 } },
        { content: `M: ${summaryData.grandTotalMale}`, styles: { halign: 'center', fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [37, 99, 235], fontSize: 8.5 } },
        { content: `F: ${summaryData.grandTotalFemale}`, styles: { halign: 'center', fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [225, 29, 72], fontSize: 8.5 } },
        { content: `TOTAL: ${summaryData.grandTotal}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [79, 70, 229], fontSize: 9 } }
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['GRADO / SECCIÓN', 'MASCULINO (M)', 'FEMENINO (F)', 'TOTAL GRADO']],
        body: studentTableBody,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        headStyles: { fillColor: [248, 250, 252], textColor: [100, 116, 139], fontStyle: 'bold', fontSize: 7 },
        margin: { left: 14, right: 14 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 6;

      // 2. Personal Clasificado por Área y Sexo
      if (currentY > pageHeight - 70) {
        doc.addPage();
        currentY = 15;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(5, 150, 105);
      doc.text('II. DISTRIBUCIÓN DEL PERSONAL POR ÁREA Y SEXO', 14, currentY);
      currentY += 3;

      const staffTableBody: any[] = [];
      summaryData.staffAreas.forEach((area: any) => {
        staffTableBody.push([
          area.name,
          { content: String(area.male), styles: { halign: 'center', textColor: [37, 99, 235] } },
          { content: String(area.female), styles: { halign: 'center', textColor: [225, 29, 72] } },
          { content: String(area.count), styles: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] } }
        ]);
      });

      staffTableBody.push([
        { content: 'TOTAL GENERAL PERSONAL DEL CENTRO:', styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249], fontSize: 8 } },
        { content: `M: ${summaryData.totalStaffMale}`, styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [37, 99, 235], fontSize: 8 } },
        { content: `F: ${summaryData.totalStaffFemale}`, styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [225, 29, 72], fontSize: 8 } },
        { content: `${summaryData.totalStaff} MIEMBROS`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [209, 250, 229], textColor: [6, 95, 70], fontSize: 8.5 } }
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['ÁREA / CARGO DEL PERSONAL', 'MASCULINO (M)', 'FEMENINO (F)', 'TOTAL MIEMBROS']],
        body: staffTableBody,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 1.8 },
        headStyles: { fillColor: [248, 250, 252], textColor: [100, 116, 139], fontStyle: 'bold', fontSize: 7 },
        margin: { left: 14, right: 14 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 12;

      // 3. Firmas y Autoridades
      if (currentY > pageHeight - 35) {
        doc.addPage();
        currentY = 25;
      }

      const colW = (pageWidth - 28) / 4;
      const sigY = currentY + 10;

      // Director
      doc.setDrawColor(148, 163, 184);
      doc.line(14 + 3, sigY, 14 + colW - 3, sigY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      if (center?.director_name) {
        doc.text(center.director_name, 14 + colW / 2, sigY - 1.5, { align: 'center' });
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(center?.director_sex === 'M' ? 'DIRECTOR DEL CENTRO' : 'DIRECTORA DEL CENTRO', 14 + colW / 2, sigY + 3.5, { align: 'center' });

      // Secretario Docente
      doc.line(14 + colW + 3, sigY, 14 + colW * 2 - 3, sigY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      if (center?.secretary_name) {
        doc.text(center.secretary_name, 14 + colW * 1.5, sigY - 1.5, { align: 'center' });
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(center?.secretary_sex === 'M' ? 'SECRETARIO DOCENTE' : 'SECRETARIA DOCENTE', 14 + colW * 1.5, sigY + 3.5, { align: 'center' });

      // Director Distrital
      doc.line(14 + colW * 2 + 3, sigY, 14 + colW * 3 - 3, sigY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      if (center?.district_director_name) {
        doc.text(center.district_director_name, 14 + colW * 2.5, sigY - 1.5, { align: 'center' });
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(center?.district_director_sex === 'M' ? 'DIRECTOR DISTRITAL' : 'DIRECTORA DISTRITAL', 14 + colW * 2.5, sigY + 3.5, { align: 'center' });

      // Sello / Certificación
      doc.line(14 + colW * 3 + 3, sigY, 14 + colW * 4 - 3, sigY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      if (center?.certification_officer_name) {
        doc.text(center.certification_officer_name, 14 + colW * 3.5, sigY - 1.5, { align: 'center' });
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(center?.certification_officer_name ? (center?.certification_officer_sex === 'M' ? 'ENCARGADO CERTIFICACIÓN' : 'ENCARGADA CERTIFICACIÓN') : 'SELLO OFICIAL', 14 + colW * 3.5, sigY + 3.5, { align: 'center' });

      doc.save(`Estadistica_General_${(center?.name || 'Centro').replace(/\s+/g, '_')}_${selectedYear || '2026-2027'}.pdf`);
      toast.success('¡Reporte oficial descargado en PDF con éxito!');
    } catch (err: any) {
      console.error('Error al generar PDF de estadística general:', err);
      toast.error('Error al generar el PDF.');
    }
  };

  // Auditoría Maestra (Totalmente independiente para no dañar otros gráficos)
  useEffect(() => {
    const runGlobalAudit = async () => {
      if (activeCategory !== 'academic-general') return;
      setIsAuditing(true);
      try {
        const currentYear = selectedYear || '2026-2027';
        const centerId = center?.id || profile?.center_id;
        if (!centerId) {
          setIsAuditing(false);
          return;
        }

        // 1. Cargar datos maestros en paralelo (traemos todas las notas del año para filtrar en JS)
        const [{ data: courses }, { data: students }, { data: grades }] = await Promise.all([
          supabase
            .from('courses')
            .select('id, level')
            .eq('center_id', centerId)
            .eq('school_year', currentYear),
          supabase
            .from('students')
            .select('course_id')
            .eq('center_id', centerId)
            .eq('school_year', currentYear),
          supabase
            .from('student_grades')
            .select('subject_id, period, grade')
            .eq('center_id', centerId)
            .eq('school_year', currentYear)
        ]);

        // 2. Mapear niveles a cursos
        const courseLevelMap: Record<string, string> = {};
        courses?.forEach((c) => {
          courseLevelMap[c.id] = (c.level || '').toLowerCase();
        });

        // 3. Contar estudiantes por nivel (Normalizando nombres)
        const levelStudentCounts: Record<string, number> = { total_academic: 0 };
        students?.forEach((s) => {
          const rawLvl = (courseLevelMap[s.course_id] || '').toLowerCase();
          if (rawLvl.includes('inicial')) return;

          levelStudentCounts.total_academic++;
          // Normalizar: Primario/Primaria -> prim, Secundario/Secundaria -> sec
          const key = rawLvl.substring(0, 3);
          levelStudentCounts[key] = (levelStudentCounts[key] || 0) + 1;
        });

        // 4. Contar notas por materia (Filtrando periodo en JS como en GradeReports)
        const gradeCounts: Record<string, number> = {};
        const targetPeriod = selectedPeriod.toLowerCase();

        grades?.forEach((g) => {
          if (
            g.period?.toLowerCase() === targetPeriod &&
            g.grade !== null &&
            g.grade !== undefined
          ) {
            gradeCounts[g.subject_id] = (gradeCounts[g.subject_id] || 0) + 1;
          }
        });

        setAuditStats({ gradeCounts, levelStudentCounts });
      } catch (e) {
        console.error('Audit error:', e);
      } finally {
        setIsAuditing(false);
      }
    };
    runGlobalAudit();
  }, [activeCategory, selectedPeriod, selectedYear]);

  // --- ANALÍTICA GLOBAL (PRECALCULADA CON AUDITORÍA EN VIVO) ---
  const globalAnalytics = React.useMemo(() => {
    const rawSubjects = state.subjects || [];
    const rawStudents = state.students || [];
    const rawCourses = state.courses || [];
    const periods = ['P1', 'P2', 'P3', 'P4'];

    const courseLevelMap: Record<string, string> = {};
    rawCourses.forEach((c) => {
      courseLevelMap[c.id] = (c.level || '').toLowerCase();
    });

    // Aplicar filtro de nivel ( TODO / PRIMARIA / SECUNDARIA )
    const students = rawStudents.filter((s) => {
      const lvl = courseLevelMap[s.course_id] || '';
      if (selectedLevelFilter === 'PRIMARIA') return lvl.includes('prim');
      if (selectedLevelFilter === 'SECUNDARIA') return lvl.includes('sec');
      return true;
    });

    // 1. Obtener datos precalculados de school_statistics si están disponibles
    const lvlKey = selectedLevelFilter === 'PRIMARIA' ? 'Primaria' : selectedLevelFilter === 'SECUNDARIA' ? 'Secundaria' : 'Todos';
    const computed = dbStats && dbStats[lvlKey] ? dbStats[lvlKey] : null;

    const distribution = computed?.distribution || [];
    const competencies = computed?.competencies || [];
    const subjectAverages = computed?.subjectAverages || [];
    const trend = computed?.trend || [];
    const subjectsTrend = computed?.subjectsTrend || [];
    const riskChart = computed?.riskChart || [];

    // 2. Calcular AVANCE DE CARGA GLOBAL (Digitado) - EN VIVO Y EN TIEMPO REAL
    const academicSubjects = rawSubjects.filter(
      (s) => s.level && !s.level.toLowerCase().includes('inicial')
    );

    const digitizingProgress = academicSubjects
      .map((sub) => {
        const actualGradesCount =
          auditStats.gradeCounts[sub.id] || auditStats.gradeCounts[sub.subject_id] || 0;

        const subLevel = (sub.level || '').toLowerCase();
        let studentsInLevel = 0;

        if (selectedLevelFilter === 'PRIMARIA') {
          studentsInLevel = auditStats.levelStudentCounts.prim || 0;
        } else if (selectedLevelFilter === 'SECUNDARIA') {
          studentsInLevel = auditStats.levelStudentCounts.sec || 0;
        } else {
          if (subLevel.includes('general')) {
            studentsInLevel = auditStats.levelStudentCounts.total_academic || 0;
          } else {
            const key = subLevel.substring(0, 3);
            studentsInLevel = auditStats.levelStudentCounts[key] || 0;
          }
        }

        const isSec = subLevel.includes('sec');
        const totalExpected = studentsInLevel * (isSec ? 4 : 3);

        const percent =
          totalExpected > 0
            ? Math.min(100, Math.round((actualGradesCount / totalExpected) * 100))
            : actualGradesCount > 0
              ? 5
              : 0;

        return {
          name: sub.name.substring(0, 12),
          fullName: sub.name,
          percent,
          fill: percent === 100 ? '#10b981' : percent > 50 ? '#f59e0b' : '#ef4444'
        };
      })
      .filter((s) => s.percent >= 0)
      .sort((a, b) => a.percent - b.percent);

    return {
      distribution,
      competencies,
      subjectAverages,
      trend,
      subjectsTrend,
      riskChart,
      digitizingProgress,
      filteredStudentCount: students.length
    };
  }, [
    state.subjects,
    state.students,
    state.courses,
    selectedLevelFilter,
    auditStats,
    dbStats
  ]);

  const globalStats = React.useMemo(() => {
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
    const uniqueLevels = [...new Set(courses.map((c) => c.level))].filter(Boolean).length;

    return {
      totalStudents: students.length,
      maleStudents,
      femaleStudents,
      totalTeachers: teachers.length,
      maleTeachers,
      femaleTeachers,
      totalNonTeachers: management + admin + support,
      admin,
      support,
      management,
      totalCourses: courses.length,
      totalSubjects: subjects.length,
      totalLevels: uniqueLevels || 0
    };
  }, [state.students, state.teachers, state.courses, state.subjects]);

  const currentReports = (reports[activeCategory as keyof typeof reports] || []).filter((r) =>
    r.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Header */}
      <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/20 blur-[100px] rounded-full -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl">
                <FileBarChart size={32} className="text-indigo-400" />
              </div>
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter">
                  Panel de Reportes
                </h1>
                <p className="text-xs font-bold text-indigo-300 uppercase tracking-[0.2em]">
                  Gestión de Informes del Centro
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 max-w-md">
            <div className="relative group">
              <SearchIcon
                className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-400 transition-colors"
                size={20}
              />
              <input
                type="text"
                placeholder="BUSCAR UN REPORTE..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl py-4 pl-16 pr-6 text-xs font-bold uppercase tracking-widest outline-none focus:ring-4 focus:ring-indigo-500/30 transition-all placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-3 items-center justify-center bg-brand-bg p-2 rounded-[2.5rem] border border-border-main">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${activeCategory === cat.id ? 'bg-indigo-600 text-white shadow-xl scale-105' : 'bg-surface text-slate-400 hover:bg-slate-50 border border-slate-100 shadow-sm'}`}
          >
            <cat.icon size={16} />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="min-h-[500px]">
        <div className="space-y-12">
          {activeCategory === 'academic-course' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white p-2 rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
                <GradeReports onViewChange={() => {}} />
              </div>
            </div>
          )}

          {activeCategory !== 'academic-course' && (
            <div className="space-y-12">
              {activeCategory === 'academic-general' && (
                <div className="space-y-6">
                  {/* CONTADORES */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/60 shadow-sm">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg">
                          <Users size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                          Alumnos
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <h4 className="text-4xl font-black text-slate-900 leading-none">
                          {globalStats.totalStudents}
                        </h4>
                        <div className="text-right space-y-1">
                          <p className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            V: {globalStats.maleStudents}
                          </p>
                          <p className="text-[9px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                            H: {globalStats.femaleStudents}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/60 shadow-sm">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-lg">
                          <Briefcase size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                          Docentes
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <h4 className="text-4xl font-black text-slate-900 leading-none">
                          {globalStats.totalTeachers}
                        </h4>
                        <div className="text-right space-y-1">
                          <p className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            M: {globalStats.maleTeachers}
                          </p>
                          <p className="text-[9px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                            F: {globalStats.femaleTeachers}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/60 shadow-sm">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-slate-900 text-white rounded-2xl shadow-lg">
                          <UserCheck size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                          Personal
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <h4 className="text-4xl font-black text-slate-900 leading-none">
                          {globalStats.totalNonTeachers}
                        </h4>
                        <div className="text-[8px] font-black text-slate-500 uppercase text-right">
                          <p>Adm: {globalStats.admin}</p>
                          <p>Gest: {globalStats.management}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden relative text-white">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 bg-indigo-500 text-white rounded-2xl">
                          <BookOpen size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">
                          Estructura
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-xl font-black">{globalStats.totalCourses}</p>
                          <p className="text-[7px] font-black text-indigo-400 uppercase">Curs</p>
                        </div>
                        <div>
                          <p className="text-xl font-black">{globalStats.totalSubjects}</p>
                          <p className="text-[7px] font-black text-indigo-400 uppercase">Mat</p>
                        </div>
                        <div>
                          <p className="text-xl font-black">{globalStats.totalLevels}</p>
                          <p className="text-[7px] font-black text-indigo-400 uppercase">Niv</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FILTROS ACADÉMICOS */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div>
                        <h3 className="text-sm font-black uppercase text-slate-800">
                          Métricas Académicas Globales
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                          Análisis consolidado del centro educativo
                        </p>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={handleUpdateStats}
                          disabled={updatingStats}
                          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all active:scale-95 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 border border-transparent"
                        >
                          <Activity size={12} className={updatingStats ? 'animate-spin' : ''} />
                          {updatingStats ? 'Calculando...' : 'Calcular Estadísticas'}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4">
                      {/* Filtro de Nivel */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">
                          Nivel Académico
                        </span>
                        <div className="flex gap-2">
                          {['TODO', 'PRIMARIA', 'SECUNDARIA'].map((lvl) => (
                            <button
                              key={lvl}
                              onClick={() => setSelectedLevelFilter(lvl)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${
                                selectedLevelFilter === lvl
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {lvl}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Filtro de Periodo */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">
                          Analizar Periodo
                        </span>
                        <div className="flex gap-2">
                          {['P1', 'P2', 'P3', 'P4'].map((p) => (
                            <button
                              key={p}
                              onClick={() => setSelectedPeriod(p)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${
                                selectedPeriod === p
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* GRÁFICOS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {/* 1. EXCELENCIA */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl h-[320px] flex flex-col">
                      <h4 className="text-[9px] font-black uppercase text-slate-400 mb-4">
                        Índice de Excelencia Institucional
                      </h4>
                      {!dbStats ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
                          <BarChart3 className="text-indigo-600 animate-pulse" size={32} />
                          <span className="text-[9px] font-black uppercase text-slate-400 mt-2">
                            Estadísticas no calculadas
                          </span>
                          <span className="text-[8px] text-slate-400 max-w-[150px]">
                            Calcula las estadísticas desde el inicio de la plataforma.
                          </span>
                        </div>
                      ) : (
                        <div className="flex-1 relative">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={globalAnalytics.distribution}
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
                                {globalAnalytics.distribution.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  borderRadius: '1rem',
                                  border: 'none',
                                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
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
                            <span className="text-3xl font-black text-slate-900">
                              {globalStats.totalStudents}
                            </span>
                            <span className="text-[8px] font-black text-slate-400 uppercase">
                              Estudiantes
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. MATERIAS PENDIENTES */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl h-[320px] flex flex-col">
                      <h4 className="text-[9px] font-black uppercase text-slate-400 mb-4">
                        Materias Pendientes por Estudiante
                      </h4>
                      {!dbStats ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
                          <Target className="text-slate-300" size={32} />
                          <span className="text-[9px] font-black uppercase text-slate-400">
                            Estadísticas no calculadas
                          </span>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={globalAnalytics.riskChart}
                                cx="50%"
                                cy="50%"
                                outerRadius={85}
                                dataKey="value"
                                label={({ name, value }) => `${value}`}
                              >
                                {globalAnalytics.riskChart.map((entry, index) => (
                                  <Cell key={index} fill={entry.fill} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ borderRadius: '15px', border: 'none' }} />
                              <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    {/* 3. AVANCE DE CARGA */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl h-[320px] flex flex-col">
                      <h4 className="text-[9px] font-black uppercase text-slate-400 mb-4">
                        Avance de Carga (Digitado)
                      </h4>
                      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                        {globalAnalytics.digitizingProgress.length > 0 ? (
                          globalAnalytics.digitizingProgress.map((s, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between items-center px-1">
                                <span className="text-[8px] font-black text-slate-500 uppercase truncate max-w-[70%]">
                                  {s.fullName}
                                </span>
                                <span className="text-[8px] font-black text-slate-900">
                                  {s.percent}%
                                </span>
                              </div>
                              <div className="w-full h-2 bg-slate-50 rounded-full border border-slate-100 p-0.5">
                                <div
                                  className="h-full rounded-full transition-all duration-1000"
                                  style={{ width: `${s.percent}%`, backgroundColor: s.fill }}
                                ></div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="h-full flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">
                            Sin materias académicas
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 4. COMPARATIVA POR PERIODO */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl h-[320px] col-span-full">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-[9px] font-black uppercase text-slate-400">
                          Tendencia de Rendimiento Institucional
                        </h4>
                        <div className="flex gap-1 bg-slate-50 p-1 rounded-xl">
                          {['indice', 'competencias', 'materias'].map((m) => (
                            <button
                              key={m}
                              onClick={() => setComparisonMode(m as any)}
                              className={`px-4 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${comparisonMode === m ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="h-[200px]">
                        {!dbStats ? (
                          <div className="h-full w-full flex flex-col items-center justify-center text-center gap-2">
                            <LineIcon className="text-slate-300" size={32} />
                            <span className="text-[9px] font-black uppercase text-slate-400">
                              Estadísticas no calculadas
                            </span>
                          </div>
                        ) : (
                          <>
                            {comparisonMode === 'materias' ? (
                              <div className="h-full w-full overflow-x-auto custom-scrollbar">
                                <div
                                  style={{
                                    width: Math.max(globalAnalytics.subjectsTrend.length * 60, 300)
                                  }}
                                >
                                  <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={globalAnalytics.subjectsTrend}>
                                      <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 8, fontWeight: 'bold' }}
                                      />
                                      <Tooltip contentStyle={{ borderRadius: '15px' }} />
                                      <Bar
                                        dataKey="P1"
                                        fill="#cbd5e1"
                                        radius={[3, 3, 0, 0]}
                                        barSize={8}
                                      >
                                        <LabelList
                                          dataKey="P1"
                                          position="top"
                                          style={{
                                            fontSize: '6px',
                                            fontWeight: 'bold',
                                            fill: '#94a3b8'
                                          }}
                                          formatter={(v: any) => (v > 0 ? `${v}%` : '')}
                                        />
                                      </Bar>
                                      <Bar
                                        dataKey="P2"
                                        fill="#94a3b8"
                                        radius={[3, 3, 0, 0]}
                                        barSize={8}
                                      >
                                        <LabelList
                                          dataKey="P2"
                                          position="top"
                                          style={{
                                            fontSize: '6px',
                                            fontWeight: 'bold',
                                            fill: '#94a3b8'
                                          }}
                                          formatter={(v: any) => (v > 0 ? `${v}%` : '')}
                                        />
                                      </Bar>
                                      <Bar
                                        dataKey="P3"
                                        fill="#64748b"
                                        radius={[3, 3, 0, 0]}
                                        barSize={8}
                                      >
                                        <LabelList
                                          dataKey="P3"
                                          position="top"
                                          style={{
                                            fontSize: '6px',
                                            fontWeight: 'bold',
                                            fill: '#64748b'
                                          }}
                                          formatter={(v: any) => (v > 0 ? `${v}%` : '')}
                                        />
                                      </Bar>
                                      <Bar
                                        dataKey="P4"
                                        fill="#4f46e5"
                                        radius={[3, 3, 0, 0]}
                                        barSize={8}
                                      >
                                        <LabelList
                                          dataKey="P4"
                                          position="top"
                                          style={{
                                            fontSize: '6px',
                                            fontWeight: 'bold',
                                            fill: '#4f46e5'
                                          }}
                                          formatter={(v: any) => (v > 0 ? `${v}%` : '')}
                                        />
                                      </Bar>
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={globalAnalytics.trend}>
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="#f1f5f9"
                                  />
                                  <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 'bold' }}
                                  />
                                  <Tooltip contentStyle={{ borderRadius: '20px' }} />
                                  {comparisonMode === 'indice' ? (
                                    <Bar
                                      dataKey="promedio"
                                      fill="#ef4444"
                                      radius={[10, 10, 0, 0]}
                                      barSize={40}
                                    >
                                      <LabelList
                                        dataKey="promedio"
                                        position="top"
                                        style={{
                                          fontSize: '10px',
                                          fontWeight: 'bold',
                                          fill: '#ef4444'
                                        }}
                                        formatter={(v: any) => (v > 0 ? `${v}%` : '')}
                                      />
                                    </Bar>
                                  ) : (
                                    <>
                                      <Bar
                                        dataKey="c1"
                                        fill="#6366f1"
                                        radius={[5, 5, 0, 0]}
                                        barSize={20}
                                      >
                                        <LabelList
                                          dataKey="c1"
                                          position="top"
                                          style={{
                                            fontSize: '8px',
                                            fontWeight: 'bold',
                                            fill: '#6366f1'
                                          }}
                                          formatter={(v: any) => (v > 0 ? `${v}%` : '')}
                                        />
                                      </Bar>
                                      <Bar
                                        dataKey="c2"
                                        fill="#10b981"
                                        radius={[5, 5, 0, 0]}
                                        barSize={20}
                                      >
                                        <LabelList
                                          dataKey="c2"
                                          position="top"
                                          style={{
                                            fontSize: '8px',
                                            fontWeight: 'bold',
                                            fill: '#10b981'
                                          }}
                                          formatter={(v: any) => (v > 0 ? `${v}%` : '')}
                                        />
                                      </Bar>
                                      <Bar
                                        dataKey="c3"
                                        fill="#f59e0b"
                                        radius={[5, 5, 0, 0]}
                                        barSize={20}
                                      >
                                        <LabelList
                                          dataKey="c3"
                                          position="top"
                                          style={{
                                            fontSize: '8px',
                                            fontWeight: 'bold',
                                            fill: '#f59e0b'
                                          }}
                                          formatter={(v: any) => (v > 0 ? `${v}%` : '')}
                                        />
                                      </Bar>
                                      <Bar
                                        dataKey="c4"
                                        fill="#f43f5e"
                                        radius={[5, 5, 0, 0]}
                                        barSize={20}
                                      >
                                        <LabelList
                                          dataKey="c4"
                                          position="top"
                                          style={{
                                            fontSize: '8px',
                                            fontWeight: 'bold',
                                            fill: '#f43f5e'
                                          }}
                                          formatter={(v: any) => (v > 0 ? `${v}%` : '')}
                                        />
                                      </Bar>
                                      <Legend
                                        wrapperStyle={{
                                          fontSize: '8px',
                                          textTransform: 'uppercase',
                                          fontWeight: 'black'
                                        }}
                                      />
                                    </>
                                  )}
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {currentReports.length > 0 ? (
                  currentReports.map((report, idx) => (
                    <ReportCard
                      key={idx}
                      {...report}
                      onClick={() => {
                        if (report.id === 'summary-report') {
                          setShowSummaryReport(true);
                        } else if (report.id === 'institutional-record') {
                          setShowInstitutionalRecord(true);
                        } else if (report.id === 'course-record') {
                          setShowCourseRecord(true);
                        } else if (report.id === 'mass-digitizing') {
                          setShowMassDigitizing(true);
                        } else if (report.id === 'performance-comparison') {
                          setShowPerformanceComparison(true);
                        } else if (report.id === 'honor-roll') {
                          setShowHonorRoll(true);
                        } else if (report.id === 'teacher-performance') {
                          setShowTeacherPerformance(true);
                        } else if (report.id === 'global-admin-report') {
                          setShowGlobalAdminReport(true);
                        } else if (report.id === 'staff-consolidated') {
                          setShowStaffConsolidated(true);
                        } else if (report.id === 'workload-report') {
                          setShowWorkloadReport(true);
                        } else if (report.id === 'incidents-report') {
                          setShowIncidentsReport(true);
                        } else if (report.id === 'meetings-report') {
                          setShowMeetingsReport(true);
                        } else if (report.id === 'pedagogical-report') {
                          setShowPedagogicalReport(true);
                        } else if (report.id === 'family-report') {
                          setShowFamilyReport(true);
                        } else if (report.id === 'demographic-report') {
                          setShowDemographicReport(true);
                        } else if (report.id === 'master-directory') {
                          setShowMasterDirectory(true);
                        } else if (report.id === 'primary-certificate') {
                          setShowPrimaryCertificate(true);
                        } else if (report.id === 'conduct-balance-certificate') {
                          setShowConductBalanceCertificate(true);
                        } else {
                          alert(`Generando: ${report.title}`);
                        }
                      }}
                    />
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center space-y-4">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                      <SearchIcon size={40} />
                    </div>
                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">
                      No se encontraron reportes que coincidan con tu búsqueda
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {showInstitutionalRecord && (
          <InstitutionalRecordReport
            period={selectedPeriod}
            onClose={() => setShowInstitutionalRecord(false)}
          />
        )}

        {showMassDigitizing && (
          <MassDigitizingReport
            period={selectedPeriod}
            onClose={() => setShowMassDigitizing(false)}
          />
        )}

        {showPerformanceComparison && (
          <PerformanceComparisonReport onClose={() => setShowPerformanceComparison(false)} />
        )}

        {showHonorRoll && (
          <HonorRollReport period={selectedPeriod} onClose={() => setShowHonorRoll(false)} />
        )}

        {showTeacherPerformance && (
          <TeacherPerformanceReport
            period={selectedPeriod}
            onClose={() => setShowTeacherPerformance(false)}
          />
        )}

        {showStaffConsolidated && (
          <StaffConsolidatedReport onClose={() => setShowStaffConsolidated(false)} />
        )}

        {showGlobalAdminReport && (
          <GlobalAdminDashboardReport onClose={() => setShowGlobalAdminReport(false)} />
        )}

        {showWorkloadReport && <WorkloadReport onClose={() => setShowWorkloadReport(false)} />}

        {showIncidentsReport && <IncidentsReport onClose={() => setShowIncidentsReport(false)} />}

        {showMeetingsReport && <MeetingsReport onClose={() => setShowMeetingsReport(false)} />}

        {showPedagogicalReport && (
          <PedagogicalReport onClose={() => setShowPedagogicalReport(false)} />
        )}

        {showFamilyReport && <FamilyReport onClose={() => setShowFamilyReport(false)} />}

        {showDemographicReport && (
          <DemographicReport onClose={() => setShowDemographicReport(false)} />
        )}

        {showMasterDirectory && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 lg:pl-[280px] overflow-y-auto">
            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-5xl shadow-2xl my-auto animate-in zoom-in-95 duration-200">
              <MasterDirectoryReport onClose={() => setShowMasterDirectory(false)} />
            </div>
          </div>
        )}

        {showPrimaryCertificate && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 lg:pl-[280px] overflow-y-auto">
            {!selectedStudentId ? (
              <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl my-auto animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-black text-slate-900 uppercase">Certificación 6to</h3>
                  <button
                    onClick={() => setShowPrimaryCertificate(false)}
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-400"
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">
                  Busque al estudiante o genere una certificación manual
                </p>

                {/* BUSCADOR */}
                <div className="relative mb-6">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <SearchIcon size={18} />
                  </div>
                  <input
                    type="text"
                    placeholder="BUSCAR POR NOMBRE O APELLIDO..."
                    className="w-full py-4 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-[10px] uppercase outline-none focus:border-indigo-500 transition-all"
                    onChange={(e) => setSearchTerm(e.target.value)}
                    value={searchTerm}
                  />
                </div>

                {/* RESULTADOS */}
                <div className="max-h-60 overflow-y-auto space-y-2 mb-6 pr-2 custom-scrollbar">
                  {(state.students || [])
                    .filter((s: any) => {
                      const fullName =
                        `${s.names || ''} ${s.first_surname || ''} ${s.second_surname || ''}`.toLowerCase();

                      // Si el usuario escribe algo en el buscador, busca a todos los alumnos del centro sin importar el grado
                      if (searchTerm && searchTerm.trim().length > 0) {
                        return fullName.includes(searchTerm.toLowerCase());
                      }

                      // Si está vacío, por defecto muestra solo los de 6to de Primaria para simplificar
                      const course = (state.courses || []).find((c: any) => c.id === s.course_id);
                      const lvl = (course?.level || '').toLowerCase();
                      const grd = (course?.grade || '').toLowerCase();
                      return lvl.includes('primar') && (grd.includes('6') || grd.includes('sexto'));
                    })
                    .sort((a: any, b: any) =>
                      (a.first_surname || '').localeCompare(b.first_surname || '')
                    )
                    .map((s: any) => {
                      const course = (state.courses || []).find((c: any) => c.id === s.course_id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSelectedStudentId(s.id)}
                          className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-2xl text-left transition-all group"
                        >
                          <div className="font-black text-[10px] text-slate-700 uppercase group-hover:text-indigo-600 flex justify-between items-center">
                            <span>
                              {s.first_surname} {s.second_surname || ''}, {s.names}
                            </span>
                            {course && (
                              <span className="text-[7px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full uppercase">
                                {course.grade} {course.section}
                              </span>
                            )}
                          </div>
                          <div className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                            Código SIGERD: {s.sigerd_code || s.student_code || 'N/A'}
                          </div>
                        </button>
                      );
                    })}

                  {/* BOTÓN PARA ALUMNO NUEVO / NO REGISTRADO */}
                  <button
                    onClick={() => setSelectedStudentId('new-manual')}
                    className="w-full p-4 bg-amber-50 hover:bg-amber-100 border border-amber-100 hover:border-amber-200 rounded-2xl text-left transition-all flex items-center gap-3"
                  >
                    <div className="p-2 bg-amber-500 text-white rounded-xl shadow-sm">
                      <Plus size={16} />
                    </div>
                    <div>
                      <div className="font-black text-[10px] text-amber-700 uppercase">
                        Alumno No Registrado
                      </div>
                      <div className="text-[8px] font-bold text-amber-500 uppercase mt-0.5">
                        Crear certificación con datos manuales
                      </div>
                    </div>
                  </button>
                </div>

                <div className="text-center">
                  <button
                    onClick={() => setShowPrimaryCertificate(false)}
                    className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                  >
                    Cerrar Ventana
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-5xl my-auto animate-in fade-in zoom-in-95 duration-300">
                <PrimaryCertificate
                  studentId={
                    selectedStudentId === 'new-manual' ? undefined : (selectedStudentId as string)
                  }
                  onClose={() => {
                    setSelectedStudentId(null);
                    setShowPrimaryCertificate(false);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {showConductBalanceCertificate && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 lg:pl-[280px] overflow-y-auto">
            {!selectedConductStudentId ? (
              <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl my-auto animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-black text-slate-900 uppercase">Certificaciones y Cotizaciones</h3>
                  <button
                    onClick={() => setShowConductBalanceCertificate(false)}
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-400"
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">
                  Busque y seleccione al estudiante para el reporte
                </p>

                {/* BUSCADOR */}
                <div className="relative mb-6">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <SearchIcon size={18} />
                  </div>
                  <input
                    type="text"
                    placeholder="BUSCAR POR NOMBRE O APELLIDO..."
                    className="w-full py-4 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-[10px] uppercase outline-none focus:border-indigo-500 transition-all"
                    onChange={(e) => setSearchTerm(e.target.value)}
                    value={searchTerm}
                  />
                </div>

                {/* RESULTADOS */}
                <div className="max-h-60 overflow-y-auto space-y-2 mb-6 pr-2 custom-scrollbar">
                  {(state.students || [])
                    .filter((s: any) => {
                      const fullName =
                        `${s.names || ''} ${s.first_surname || ''} ${s.second_surname || ''}`.toLowerCase();
                      if (searchTerm && searchTerm.trim().length > 0) {
                        return fullName.includes(searchTerm.toLowerCase());
                      }
                      return true; // Para este reporte, por defecto se muestran todos
                    })
                    .sort((a: any, b: any) =>
                      (a.first_surname || '').localeCompare(b.first_surname || '')
                    )
                    .map((s: any) => {
                      const course = (state.courses || []).find((c: any) => c.id === s.course_id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSelectedConductStudentId(s.id)}
                          className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-2xl text-left transition-all group"
                        >
                          <div className="font-black text-[10px] text-slate-700 uppercase group-hover:text-indigo-600 flex justify-between items-center">
                            <span>
                              {s.first_surname} {s.second_surname || ''}, {s.names}
                            </span>
                            {course && (
                              <span className="text-[7px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full uppercase">
                                {course.grade} {course.section}
                              </span>
                            )}
                          </div>
                          <div className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                            Código SIGERD: {s.sigerd_code || s.student_code || 'N/A'}
                          </div>
                        </button>
                      );
                    })}

                  {/* BOTÓN PARA ALUMNO NUEVO / NO REGISTRADO */}
                  <button
                    onClick={() => setSelectedConductStudentId('new-manual')}
                    className="w-full p-4 bg-amber-50 hover:bg-amber-100 border border-amber-100 hover:border-amber-200 rounded-2xl text-left transition-all flex items-center gap-3"
                  >
                    <div className="p-2 bg-amber-500 text-white rounded-xl shadow-sm">
                      <Plus size={16} />
                    </div>
                    <div>
                      <div className="font-black text-[10px] text-amber-700 uppercase">
                        Alumno No Registrado
                      </div>
                      <div className="text-[8px] font-bold text-amber-500 uppercase mt-0.5">
                        Crear certificación con datos manuales
                      </div>
                    </div>
                  </button>
                </div>

                <div className="text-center">
                  <button
                    onClick={() => setShowConductBalanceCertificate(false)}
                    className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                  >
                    Cerrar Ventana
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-7xl my-auto animate-in fade-in zoom-in-95 duration-300">
                <ConductBalanceCertificate
                  studentId={
                    selectedConductStudentId === 'new-manual'
                      ? ''
                      : (selectedConductStudentId as string)
                  }
                  onClose={() => {
                    setSelectedConductStudentId(null);
                    setShowConductBalanceCertificate(false);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Footer */}
      <div className="bg-indigo-50/50 p-8 rounded-[3rem] border border-indigo-100 print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
              Base de datos sincronizada
            </span>
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleBackupData}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Download size={14} /> Respaldar Todo
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE REPORTE GENERAL RESUMIDO (Una página imprimible) */}
      {showSummaryReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #official-summary-print-container, #official-summary-print-container * {
                visibility: visible !important;
              }
              #official-summary-print-container {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 10mm !important;
                background: white !important;
              }
              @page {
                size: portrait;
                margin: 8mm;
              }
            }
          `}</style>
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl my-8 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] print:max-w-none print:my-0 print:border-none print:shadow-none print:max-h-none print:rounded-none">
            {/* Barra superior de control (Oculta al imprimir) */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-indigo-600 tracking-widest px-3 py-1 bg-indigo-50 rounded-full">
                  Vista Previa Oficial
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadSummaryPDF}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:bg-emerald-700 transition-all cursor-pointer"
                  title="Descargar archivo PDF"
                >
                  <Download size={16} /> Descargar PDF
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:bg-indigo-700 transition-all cursor-pointer"
                  title="Imprimir documento"
                >
                  <Printer size={16} /> Imprimir
                </button>
                <button
                  onClick={() => setShowSummaryReport(false)}
                  className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-300 transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* CONTENIDO DEL REPORTE (Página imprimible) */}
            <div id="official-summary-print-container" className="p-12 overflow-y-auto flex-1 bg-white text-slate-800 print:p-0 print:overflow-visible">
              {/* Encabezado Oficial */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-6 mb-8">
                <div className="flex items-center gap-4">
                  {center?.logo_url || center?.logo ? (
                    <img
                      src={center?.logo_url || center?.logo}
                      alt="Logo"
                      className="w-20 h-20 object-contain"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xl tracking-tighter shadow-md">
                      {(center?.name || 'ED').substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">
                      {center?.name || 'Centro Educativo Edugest'}
                    </h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Código: {center?.center_code || center?.code || 'N/A'} | Año Escolar:{' '}
                      {selectedYear}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Estadística General Consolidada
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black px-3 py-1 bg-slate-100 rounded-lg text-slate-600 uppercase tracking-widest border border-slate-200">
                    Documento Oficial
                  </span>
                  <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase">
                    Fecha: {new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Sección 1: Alumnos por Nivel y Grado */}
              <div className="space-y-8">
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                    Matrícula Estudiantil por Niveles y Grados
                  </h3>

                  {summaryData.levels.map((lvl: any) => (
                    <div
                      key={lvl.name}
                      className="mb-6 border border-slate-200 rounded-2xl overflow-hidden shadow-sm print:mb-4 print:border-slate-300 print:rounded-lg"
                    >
                      <div className="bg-slate-900 text-white px-4 py-2 flex justify-between items-center print:bg-slate-200 print:text-slate-900">
                        <span className="text-xs font-black uppercase tracking-wider">
                          {lvl.name}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-300 print:text-slate-700">
                          Total Nivel: {lvl.total}
                        </span>
                      </div>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 print:bg-slate-50 print:text-slate-600">
                            <th className="py-2 px-4">Grado / Sección</th>
                            <th className="py-2 px-4 text-center w-28">Masculino (M)</th>
                            <th className="py-2 px-4 text-center w-28">Femenino (F)</th>
                            <th className="py-2 px-4 text-right w-28">Total Grado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                          {lvl.grades.map((g: any) => (
                            <tr
                              key={g.name}
                              className="hover:bg-slate-50/50 print:hover:bg-transparent print:divide-slate-200"
                            >
                              <td className="py-2 px-4 font-black text-slate-900">{g.name}</td>
                              <td className="py-2 px-4 text-center text-blue-600 print:text-slate-900">
                                {g.male}
                              </td>
                              <td className="py-2 px-4 text-center text-rose-600 print:text-slate-900">
                                {g.female}
                              </td>
                              <td className="py-2 px-4 text-right font-black text-indigo-600 bg-indigo-50/30 print:bg-transparent print:text-slate-900">
                                {g.total}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-200 print:bg-slate-100">
                            <td className="py-2.5 px-4 text-right text-[10px] uppercase tracking-widest text-slate-500 print:text-slate-700">
                              Subtotal Nivel:
                            </td>
                            <td className="py-2.5 px-4 text-center text-blue-700 print:text-slate-900">
                              {lvl.totalMale}
                            </td>
                            <td className="py-2.5 px-4 text-center text-rose-700 print:text-slate-900">
                              {lvl.totalFemale}
                            </td>
                            <td className="py-2.5 px-4 text-right text-indigo-700 bg-indigo-50 print:bg-transparent print:text-slate-900">
                              {lvl.total}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ))}

                  {/* TOTAL GENERAL ESTUDIANTES */}
                  <div className="bg-indigo-50 border-2 border-indigo-600/20 rounded-2xl p-4 flex justify-between items-center text-indigo-950 mt-4 print:border-slate-400 print:bg-slate-50 print:rounded-lg">
                    <span className="text-xs font-black uppercase tracking-widest">
                      Total General Matrícula Estudiantil:
                    </span>
                    <div className="flex gap-6 text-xs font-black">
                      <span className="text-blue-700 print:text-slate-900">
                        M: {summaryData.grandTotalMale}
                      </span>
                      <span className="text-rose-700 print:text-slate-900">
                        F: {summaryData.grandTotalFemale}
                      </span>
                      <span className="text-sm text-indigo-600 border-l-2 border-indigo-200 pl-4 print:border-slate-300 print:text-slate-900">
                        Total: {summaryData.grandTotal}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sección 2: Personal Clasificado por Área y Sexo */}
                <div className="pt-4 border-t-2 border-slate-100 print:pt-2 print:border-slate-300">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2 print:mb-2">
                    <span className="w-2 h-2 bg-emerald-600 rounded-full"></span>
                    Distribución del Personal por Área y Sexo
                  </h3>
                  
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm mb-4 print:border-slate-300 print:rounded-lg">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 print:bg-slate-50 print:text-slate-600">
                          <th className="py-2.5 px-4">Área / Cargo del Personal</th>
                          <th className="py-2.5 px-4 text-center w-28">Masculino (M)</th>
                          <th className="py-2.5 px-4 text-center w-28">Femenino (F)</th>
                          <th className="py-2.5 px-4 text-right w-28">Total Miembros</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                        {summaryData.staffAreas.map((area: any) => (
                          <tr key={area.name} className="hover:bg-slate-50/50 print:hover:bg-transparent">
                            <td className="py-2.5 px-4 font-black text-slate-900">{area.name}</td>
                            <td className="py-2.5 px-4 text-center text-blue-600 print:text-slate-900">
                              {area.male}
                            </td>
                            <td className="py-2.5 px-4 text-center text-rose-600 print:text-slate-900">
                              {area.female}
                            </td>
                            <td className="py-2.5 px-4 text-right font-black text-emerald-600 bg-emerald-50/30 print:bg-transparent print:text-slate-900">
                              {area.count}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-200 print:bg-slate-100">
                          <td className="py-2.5 px-4 text-right text-[10px] uppercase tracking-widest text-slate-500 print:text-slate-700">
                            Total General Personal:
                          </td>
                          <td className="py-2.5 px-4 text-center text-blue-700 print:text-slate-900">
                            {summaryData.totalStaffMale}
                          </td>
                          <td className="py-2.5 px-4 text-center text-rose-700 print:text-slate-900">
                            {summaryData.totalStaffFemale}
                          </td>
                          <td className="py-2.5 px-4 text-right text-emerald-700 bg-emerald-50 print:bg-transparent print:text-slate-900">
                            {summaryData.totalStaff}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Pie de página de firma y autoridades oficiales */}
              <div className="mt-16 pt-8 border-t border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-6 text-center print:mt-10 print:pt-6">
                {/* 1. Director(a) del Centro */}
                <div>
                  <div className="h-10 border-b border-slate-400 max-w-[160px] mx-auto flex items-end justify-center pb-1">
                    {center?.director_name && (
                      <span className="text-[10px] font-black text-slate-800 tracking-tight block truncate">
                        {center.director_name}
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-2 print:text-[8px]">
                    {center?.director_sex === 'M' ? 'Director del Centro' : 'Directora del Centro'}
                  </p>
                </div>

                {/* 2. Secretario(a) Docente */}
                <div>
                  <div className="h-10 border-b border-slate-400 max-w-[160px] mx-auto flex items-end justify-center pb-1">
                    {center?.secretary_name && (
                      <span className="text-[10px] font-black text-slate-800 tracking-tight block truncate">
                        {center.secretary_name}
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-2 print:text-[8px]">
                    {center?.secretary_sex === 'M' ? 'Secretario Docente' : 'Secretaria Docente'}
                  </p>
                </div>

                {/* 3. Director(a) Distrital */}
                <div>
                  <div className="h-10 border-b border-slate-400 max-w-[160px] mx-auto flex items-end justify-center pb-1">
                    {center?.district_director_name && (
                      <span className="text-[10px] font-black text-slate-800 tracking-tight block truncate">
                        {center.district_director_name}
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-2 print:text-[8px]">
                    {center?.district_director_sex === 'M'
                      ? 'Director del Distrito'
                      : 'Directora del Distrito'}
                  </p>
                </div>

                {/* 4. Sello / Certificación */}
                <div>
                  <div className="h-10 border-b border-slate-400 max-w-[160px] mx-auto flex items-end justify-center pb-1">
                    {center?.certification_officer_name ? (
                      <span className="text-[10px] font-black text-slate-800 tracking-tight block truncate">
                        {center.certification_officer_name}
                      </span>
                    ) : (
                      <span className="text-[8px] text-slate-300 font-bold uppercase tracking-widest">
                        Sello Oficial
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-2 print:text-[8px]">
                    {center?.certification_officer_name
                      ? center?.certification_officer_sex === 'M'
                        ? 'Encargado de Certificación'
                        : 'Encargada de Certificación'
                      : 'Sello / Certificación'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {isGradesLoading && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white text-xs font-black uppercase tracking-widest animate-pulse">
            Descargando calificaciones del centro...
          </p>
        </div>
      )}
    </div>
  );
};
