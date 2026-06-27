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
import MasterDirectoryReport from './MasterDirectoryReport';
import { useApp, useSupabase } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
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
        title: 'Certificación de Conducta y Saldo',
        description:
          'Generar certificación de conducta y estado de saldo financiero para un estudiante.',
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
    const courseMap: Record<string, any> = {};
    courses.forEach((c) => {
      courseMap[c.id] = c;
    });

    // Agrupar estudiantes por nivel y grado
    const levelGroups: Record<string, Record<string, { male: number; female: number }>> = {};

    // Inicializar con los niveles ordenados estándar
    const orderedLevels = ['Inicial', 'Primaria', 'Secundaria'];
    courses.forEach((c) => {
      const lvl = c.level || 'General';
      let normLvl = lvl;
      if (lvl.toLowerCase().includes('ini')) normLvl = 'Inicial';
      else if (lvl.toLowerCase().includes('prim')) normLvl = 'Primaria';
      else if (lvl.toLowerCase().includes('sec')) normLvl = 'Secundaria';

      if (!levelGroups[normLvl]) {
        levelGroups[normLvl] = {};
      }
      const baseGrade = c.grade ? c.grade.trim() : c.name ? c.name.trim() : 'General';
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
      if (!levelGroups[normLvl][gradeLabel]) {
        levelGroups[normLvl][gradeLabel] = { male: 0, female: 0 };
      }
    });

    // Contar alumnos
    students.forEach((s) => {
      const c = courseMap[s.course_id];
      const lvl = c?.level || 'General';
      let normLvl = lvl;
      if (lvl.toLowerCase().includes('ini')) normLvl = 'Inicial';
      else if (lvl.toLowerCase().includes('prim')) normLvl = 'Primaria';
      else if (lvl.toLowerCase().includes('sec')) normLvl = 'Secundaria';

      if (!levelGroups[normLvl]) levelGroups[normLvl] = {};
      const baseGrade = c?.grade ? c.grade.trim() : c?.name ? c.name.trim() : 'General';
      const sec = c?.section ? c.section.trim() : '';
      const tandaStr = c?.tanda ? c.tanda.trim() : '';
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
      if (!levelGroups[normLvl][gradeLabel])
        levelGroups[normLvl][gradeLabel] = { male: 0, female: 0 };

      const isMale =
        (s.sex || s.gender || '').toUpperCase().startsWith('M') ||
        (s.sex || s.gender || '').toUpperCase().startsWith('V');
      if (isMale) {
        levelGroups[normLvl][gradeLabel].male++;
      } else {
        levelGroups[normLvl][gradeLabel].female++;
      }
    });

    let grandTotalMale = 0;
    let grandTotalFemale = 0;

    // Convertir a array con un orden consistente
    const levelsResult = Object.keys(levelGroups)
      .sort((a, b) => {
        const idxA = orderedLevels.indexOf(a);
        const idxB = orderedLevels.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      })
      .map((lvlName) => {
        const gradesObj = levelGroups[lvlName];
        let lvlMale = 0;
        let lvlFemale = 0;

        const gradesArr = Object.keys(gradesObj)
          .sort()
          .map((gName) => {
            const m = gradesObj[gName].male;
            const f = gradesObj[gName].female;
            lvlMale += m;
            lvlFemale += f;
            return {
              name: gName,
              male: m,
              female: f,
              total: m + f
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
      .filter((l) => l.grades.some((g) => g.total > 0) || l.name !== 'General'); // Mostrar niveles con alumnos o definidos

    // Personal por área
    let docentes = 0;
    let gestion = 0;
    let admin = 0;
    let apoyo = 0;

    personnel.forEach((p) => {
      const r = p.role;
      if (r === 'management_teacher') {
        docentes++;
        gestion++;
      } else if (r === 'teacher') {
        docentes++;
      } else if (r === 'management') {
        gestion++;
      } else if (r === 'administrative') {
        admin++;
      } else {
        apoyo++;
      }
    });

    const staffAreas = [
      { name: 'Equipo de Gestión', count: gestion },
      { name: 'Personal Docente', count: docentes },
      { name: 'Personal Administrativo', count: admin },
      { name: 'Personal de Apoyo', count: apoyo }
    ];

    return {
      levels: levelsResult,
      grandTotalMale,
      grandTotalFemale,
      grandTotal: grandTotalMale + grandTotalFemale,
      staffAreas,
      totalStaff: personnel.length
    };
  }, [state.students, state.courses, state.teachers]);

  // Auditoría Maestra (Totalmente independiente para no dañar otros gráficos)
  useEffect(() => {
    const runGlobalAudit = async () => {
      if (activeCategory !== 'academic-general') return;
      setIsAuditing(true);
      try {
        const currentYear = selectedYear || '2025-2026';
        const centerId = center?.id || profile?.center_id || '29bd105f-af7f-48b1-a9e9-a76ddf1e9ab1';

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
                  <h3 className="text-xl font-black text-slate-900 uppercase">Conducta y Saldo</h3>
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
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:absolute print:inset-0 print:bg-white print:p-0">
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
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:bg-indigo-700 transition-all"
                >
                  <Printer size={16} /> Imprimir Página
                </button>
                <button
                  onClick={() => setShowSummaryReport(false)}
                  className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-300 transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* CONTENIDO DEL REPORTE (Página imprimible) */}
            <div className="p-12 overflow-y-auto flex-1 bg-white text-slate-800 print:p-0 print:overflow-visible">
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
                            <th className="py-2 px-4">Grado</th>
                            <th className="py-2 px-4 text-center w-24">Masculino (M)</th>
                            <th className="py-2 px-4 text-center w-24">Femenino (F)</th>
                            <th className="py-2 px-4 text-right w-24">Total Grado</th>
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

                {/* Sección 2: Personal por Área */}
                <div className="pt-4 border-t-2 border-slate-100 print:pt-2 print:border-slate-300">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2 print:mb-2">
                    <span className="w-2 h-2 bg-emerald-600 rounded-full"></span>
                    Distribución del Personal por Área
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:gap-2">
                    {summaryData.staffAreas.map((area: any) => (
                      <div
                        key={area.name}
                        className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex flex-col justify-between print:p-3 print:rounded-lg print:border-slate-300"
                      >
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          {area.name}
                        </span>
                        <div className="mt-2 flex items-baseline justify-between">
                          <span className="text-2xl font-black text-slate-900 print:text-lg">
                            {area.count}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">
                            Miembros
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* TOTAL PERSONAL */}
                  <div className="bg-slate-900 text-white rounded-2xl p-4 flex justify-between items-center mt-4 print:bg-slate-100 print:text-slate-900 print:border print:border-slate-400 print:rounded-lg">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400 print:text-slate-700">
                      Total General Personal del Centro:
                    </span>
                    <span className="text-base font-black text-emerald-400 print:text-slate-900">
                      {summaryData.totalStaff} Miembros
                    </span>
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
