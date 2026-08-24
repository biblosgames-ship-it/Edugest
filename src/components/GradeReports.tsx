import React, { useState, useEffect } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LabelList
} from 'recharts';
import { useApp, useSupabase } from '../context/AppContext';
import {
  ArrowLeft,
  FileText,
  ScrollText,
  Trophy,
  Printer,
  Loader2,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { dataService } from '../services/dataService';
import * as XLSX from 'xlsx';
import { CourseRecordReport } from './CourseRecordReport';
import { Users, X, ScrollText as ScrollIcon } from 'lucide-react';
import PrimaryCertificate from './PrimaryCertificate';

export const GradeReports = ({ onViewChange }: { onViewChange?: (view: string) => void }) => {
  const { state, selectedYear, center: contextCenter } = useApp();
  const { profile } = useSupabase();
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingRegistro, setIsGeneratingRegistro] = useState(false);
  const [registroSoloNumeros, setRegistroSoloNumeros] = useState(false);

  // Boletines Modal State
  const [showBoletinModal, setShowBoletinModal] = useState(false);
  const [isFetchingBoletinData, setIsFetchingBoletinData] = useState(false);
  const [boletinData, setBoletinData] = useState<{
    students: any[];
    gradesMap: any;
    centerData: any;
    subjects: any[];
  } | null>(null);

  // Boletines Config State
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
  const [periodDivisor, setPeriodDivisor] = useState<number>(4);
  const [showAverages, setShowAverages] = useState<boolean>(true);

  // RANKING STATE
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rankingData, setRankingData] = useState<any>(null);
  const [rankingPeriod, setRankingPeriod] = useState('FINAL');
  const [rankingScales, setRankingScales] = useState([
    { id: 1, min: 95, max: 100, label: 'Excelente' },
    { id: 2, min: 90, max: 94, label: 'Muy Bueno' },
    { id: 3, min: 80, max: 89, label: 'Bueno' },
    { id: 4, min: 70, max: 79, label: 'Regular' },
    { id: 5, min: 65, max: 69, label: 'En proceso' },
    { id: 6, min: 1, max: 64, label: 'Deficiente' }
  ]);

  // SUBJECT AVG STATE
  const [showSubjectAvgModal, setShowSubjectAvgModal] = useState(false);
  const [subjectAvgData, setSubjectAvgData] = useState<any>(null);
  const [subjectAvgPeriod, setSubjectAvgPeriod] = useState('FINAL');

  // RISK REPORT STATE
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [riskData, setRiskData] = useState<any>(null);
  const [riskPeriod, setRiskPeriod] = useState('FINAL');

  // EVOLUTION REPORT STATE
  const [showEvolutionModal, setShowEvolutionModal] = useState(false);
  const [evolutionData, setEvolutionData] = useState<any>(null);

  // COMPETENCY AVG STATE
  const [showCompetencyAvgModal, setShowCompetencyAvgModal] = useState(false);
  const [competencyAvgData, setCompetencyAvgData] = useState<any>(null);
  const [competencyAvgPeriod, setCompetencyAvgPeriod] = useState('FINAL');

  // PENDING GRADES STATE
  const [showPendingGradesModal, setShowPendingGradesModal] = useState(false);
  const [pendingGradesData, setPendingGradesData] = useState<any>(null);
  const [pendingGradesPeriod, setPendingGradesPeriod] = useState('P1');

  const [showCourseRecord, setShowCourseRecord] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [certStudentId, setCertStudentId] = useState<string | null>(null);

  const courses = state.courses || [];
  const selectedCourse = courses.find((c: any) => c.id === selectedCourseId);

  // ANALYTICS STATE
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('FINAL');

  useEffect(() => {
    if (!selectedCourseId) {
      setAnalyticsData(null);
      return;
    }
    const fetchAnalytics = async () => {
      setIsLoadingAnalytics(true);
      try {
        const forceYear = selectedYear || '2026-2027';
        const centerId = contextCenter?.id || profile?.center_id;
        if (!centerId) {
          setIsLoadingAnalytics(false);
          return;
        }

        const [stdData, { data: gData }] = await Promise.all([
          dataService.getStudents(selectedCourseId, centerId, forceYear),
          supabase
            .from('student_grades')
            .select('*')
            .eq('course_id', selectedCourseId)
            .eq('school_year', forceYear)
        ]);

        if (!stdData || stdData.length === 0) {
          setAnalyticsData(null);
          return;
        }

        const assignments =
          state.assignments?.filter((a) => a.course_id === selectedCourseId) || [];
        let subs = assignments
          .map((a) => state.subjects?.find((s) => s.id === a.subject_id))
          .filter(Boolean);
        if (subs.length === 0 && selectedCourse) {
          const cLvl = (selectedCourse.level || '').toLowerCase();
          subs = (state.subjects || []).filter((s: any) =>
            (s.level || '').toLowerCase().includes(cLvl.substring(0, 5))
          );
        }
        if (subs.length === 0) subs = state.subjects || [];
        const courseSubjects = [...subs].filter(
          (s) =>
            !s.name.toLowerCase().includes('lecto') && !s.name.toLowerCase().includes('escritura')
        );

        const loadedMap: any = {};
        if (gData) {
          gData.forEach((g: any) => {
            if (!loadedMap[g.student_id]) loadedMap[g.student_id] = {};
            if (!loadedMap[g.student_id][g.subject_id]) loadedMap[g.student_id][g.subject_id] = {};
            const pL = g.period.toLowerCase();
            if (g.grade !== null)
              loadedMap[g.student_id][g.subject_id][`${g.competency_id}_${pL}`] = g.grade;
            if (g.rp1 !== null)
              loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp1`] = g.rp1;
            if (g.rp2 !== null)
              loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp2`] = g.rp2;
            if (g.rp3 !== null)
              loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp3`] = g.rp3;
            if (g.rp4 !== null)
              loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp4`] = g.rp4;
            if (g.recovery_grade !== null)
              loadedMap[g.student_id][g.subject_id]['final_rec'] = g.recovery_grade;
          });
        }
        setAnalyticsData({ students: stdData, subjects: courseSubjects, gradesMap: loadedMap });
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoadingAnalytics(false);
      }
    };
    fetchAnalytics();
  }, [selectedCourseId]);

  const isSecundario = React.useMemo(
    () => selectedCourse?.level?.toLowerCase().includes('secund'),
    [selectedCourse]
  );

  const computedAnalytics = React.useMemo(() => {
    if (!analyticsData) return null;

    const rankingDist: Record<string, number> = {};
    rankingScales.forEach((s) => (rankingDist[s.label] = 0));

    let passingStudents = 0;
    let failingStudents = 0;
    let riskDist = { '0 Reprobadas': 0, '1 Reprobada': 0, '2 Reprobadas': 0, '3+ Reprobadas': 0 };

    const subjectAvgs = analyticsData.subjects
      .map((sub: any) => {
        let total = 0,
          count = 0;
        analyticsData.students.forEach((s: any) => {
          const sGrades = analyticsData.gradesMap[s.id]?.[sub.id] || {};
          const getBestGrade = (cId: string, p: string) =>
            Math.max(
              parseInt(sGrades[`${cId}_${p.toLowerCase()}`]) || 0,
              parseInt(sGrades[`${cId}_r${p.toLowerCase()}`]) || 0
            );
          let grade = 0;
          if (analyticsPeriod === 'FINAL') {
            const compAverages = (isSecundario ? ['c1', 'c2', 'c3', 'c4'] : ['c1', 'c2', 'c3']).map(
              (cId) => {
                return Math.round(
                  (getBestGrade(cId, 'P1') +
                    getBestGrade(cId, 'P2') +
                    getBestGrade(cId, 'P3') +
                    getBestGrade(cId, 'P4')) /
                    4
                );
              }
            );
            const finalArea = Math.round(
              compAverages.reduce((a, b) => a + b, 0) / compAverages.length
            );
            grade = Math.max(finalArea, parseInt(sGrades['final_rec']) || 0);
          } else {
            const currentPeriodComps = (
              isSecundario ? ['c1', 'c2', 'c3', 'c4'] : ['c1', 'c2', 'c3']
            ).map((cId) => getBestGrade(cId, analyticsPeriod));
            grade = Math.round(
              currentPeriodComps.reduce((a, b) => a + b, 0) / currentPeriodComps.length
            );
          }
          if (grade > 0) {
            total += grade;
            count++;
          }
        });
        // Shorten name to max 10 chars
        const shortName = sub.name.length > 10 ? sub.name.substring(0, 10) + '.' : sub.name;
        return { subject: shortName, average: count > 0 ? Math.round(total / count) : 0 };
      })
      .filter((s: any) => s.average > 0);

    analyticsData.students.forEach((s: any) => {
      let totalGrade = 0,
        validSubs = 0,
        failedSubs = 0;

      analyticsData.subjects.forEach((sub: any) => {
        const sGrades = analyticsData.gradesMap[s.id]?.[sub.id] || {};
        const getBestGrade = (cId: string, p: string) =>
          Math.max(
            parseInt(sGrades[`${cId}_${p.toLowerCase()}`]) || 0,
            parseInt(sGrades[`${cId}_r${p.toLowerCase()}`]) || 0
          );
        let grade = 0;
        if (analyticsPeriod === 'FINAL') {
          const compAverages = (isSecundario ? ['c1', 'c2', 'c3', 'c4'] : ['c1', 'c2', 'c3']).map(
            (cId) => {
              return Math.round(
                (getBestGrade(cId, 'P1') +
                  getBestGrade(cId, 'P2') +
                  getBestGrade(cId, 'P3') +
                  getBestGrade(cId, 'P4')) /
                  4
              );
            }
          );
          const finalArea = Math.round(
            compAverages.reduce((a, b) => a + b, 0) / compAverages.length
          );
          grade = Math.max(finalArea, parseInt(sGrades['final_rec']) || 0);
        } else {
          const currentPeriodComps = (
            isSecundario ? ['c1', 'c2', 'c3', 'c4'] : ['c1', 'c2', 'c3']
          ).map((cId) => getBestGrade(cId, analyticsPeriod));
          grade = Math.round(
            currentPeriodComps.reduce((a, b) => a + b, 0) / currentPeriodComps.length
          );
        }
        if (grade > 0) {
          totalGrade += grade;
          validSubs++;
          if (grade < 70) failedSubs++;
        }
      });

      const stdAvg = validSubs > 0 ? Math.round(totalGrade / validSubs) : 0;
      if (stdAvg > 0) {
        const scale = rankingScales.find((sc) => stdAvg >= sc.min && stdAvg <= sc.max);
        if (scale) rankingDist[scale.label]++;

        if (failedSubs > 0) failingStudents++;
        else passingStudents++;

        if (failedSubs === 0) riskDist['0 Reprobadas']++;
        else if (failedSubs === 1) riskDist['1 Reprobada']++;
        else if (failedSubs === 2) riskDist['2 Reprobadas']++;
        else riskDist['3+ Reprobadas']++;
      }
    });

    let totalC1 = 0,
      countC1 = 0;
    let totalC2 = 0,
      countC2 = 0;
    let totalC3 = 0,
      countC3 = 0;

    analyticsData.students.forEach((s: any) => {
      analyticsData.subjects.forEach((sub: any) => {
        const sGrades = analyticsData.gradesMap[s.id]?.[sub.id] || {};
        const getBestGrade = (cId: string, p: string) =>
          Math.max(
            parseInt(sGrades[`${cId}_${p.toLowerCase()}`]) || 0,
            parseInt(sGrades[`${cId}_r${p.toLowerCase()}`]) || 0
          );

        if (analyticsPeriod === 'FINAL') {
          const gC1 = Math.round(
            (getBestGrade('c1', 'P1') +
              getBestGrade('c1', 'P2') +
              getBestGrade('c1', 'P3') +
              getBestGrade('c1', 'P4')) /
              4
          );
          const gC2 = Math.round(
            (getBestGrade('c2', 'P1') +
              getBestGrade('c2', 'P2') +
              getBestGrade('c2', 'P3') +
              getBestGrade('c2', 'P4')) /
              4
          );
          const gC3 = Math.round(
            (getBestGrade('c3', 'P1') +
              getBestGrade('c3', 'P2') +
              getBestGrade('c3', 'P3') +
              getBestGrade('c3', 'P4')) /
              4
          );
          if (gC1 > 0) {
            totalC1 += gC1;
            countC1++;
          }
          if (gC2 > 0) {
            totalC2 += gC2;
            countC2++;
          }
          if (gC3 > 0) {
            totalC3 += gC3;
            countC3++;
          }
        } else {
          const gC1 = getBestGrade('c1', analyticsPeriod);
          const gC2 = getBestGrade('c2', analyticsPeriod);
          const gC3 = getBestGrade('c3', analyticsPeriod);
          if (gC1 > 0) {
            totalC1 += gC1;
            countC1++;
          }
          if (gC2 > 0) {
            totalC2 += gC2;
            countC2++;
          }
          if (gC3 > 0) {
            totalC3 += gC3;
            countC3++;
          }
        }
      });
    });

    const competencyChart = [
      {
        competency: 'C1',
        fullLabel: 'C1 (Conceptual)',
        value: countC1 > 0 ? Math.round(totalC1 / countC1) : 0,
        fullMark: 100
      },
      {
        competency: 'C2',
        fullLabel: 'C2 (Procedimental)',
        value: countC2 > 0 ? Math.round(totalC2 / countC2) : 0,
        fullMark: 100
      },
      {
        competency: 'C3',
        fullLabel: 'C3 (Actitudinal)',
        value: countC3 > 0 ? Math.round(totalC3 / countC3) : 0,
        fullMark: 100
      }
    ];

    const rankingColors: any = {
      Excelente: '#16a34a', // verde oscuro
      'Muy Bueno': '#4ade80', // verde claro
      Bueno: '#3b82f6', // azul
      Regular: '#eab308', // amarillo
      'En proceso': '#f87171', // rojo suave
      Deficiente: '#dc2626' // rojo vivo
    };
    const rankingChart = Object.entries(rankingDist)
      .filter(([k, v]) => v > 0)
      .map(([name, value]) => ({ name, value, fill: rankingColors[name] }));

    const riskColors: any = {
      '0 Reprobadas': '#10b981',
      '1 Reprobada': '#facc15',
      '2 Reprobadas': '#f97316',
      '3+ Reprobadas': '#ef4444'
    };
    const riskChart = Object.entries(riskDist)
      .filter(([k, v]) => v > 0)
      .map(([name, value]) => ({ name, value, fill: riskColors[name] }));

    const approvalChart = [
      { name: 'Sin asignaturas pendientes', value: passingStudents, fill: '#10b981' },
      { name: 'Con asignaturas pendientes', value: failingStudents, fill: '#ef4444' }
    ].filter((item) => item.value > 0);

    // 5. Digitizing Progress (Control de Digitado)
    const digitizingChart = analyticsData.subjects.map((sub: any) => {
      let completed = 0;
      const isFinal = analyticsPeriod.toLowerCase() === 'final';
      const totalPerStudent = isFinal ? 12 : 3;
      const totalExpected = analyticsData.students.length * totalPerStudent;

      analyticsData.students.forEach((std: any) => {
        const sGrades = analyticsData.gradesMap[std.id]?.[sub.id] || {};
        const pL = analyticsPeriod.toLowerCase();

        if (pL !== 'final') {
          if (sGrades[`c1_${pL}`] !== undefined) completed++;
          if (sGrades[`c2_${pL}`] !== undefined) completed++;
          if (sGrades[`c3_${pL}`] !== undefined) completed++;
        } else {
          // Simplified check for final
          if (sGrades['final_rec'] !== undefined) completed += 3;
          ['p1', 'p2', 'p3', 'p4'].forEach((p) => {
            if (sGrades[`c1_${p}`] !== undefined) completed++;
            if (sGrades[`c2_${p}`] !== undefined) completed++;
            if (sGrades[`c3_${p}`] !== undefined) completed++;
          });
        }
      });

      const percent =
        totalExpected > 0 ? Math.min(100, Math.round((completed / totalExpected) * 100)) : 0;
      return {
        subject: sub.name.substring(0, 10),
        percent,
        fill: percent === 100 ? '#10b981' : percent > 50 ? '#f59e0b' : '#ef4444'
      };
    });

    return {
      rankingChart,
      riskChart,
      approvalChart,
      subjectAvgs,
      competencyChart,
      digitizingChart
    };
  }, [analyticsData, analyticsPeriod, rankingScales]);

  // Configuraciones estándar
  const periods = ['P1', 'P2', 'P3', 'P4'];
  const comps = ['c1', 'c2', 'c3']; // Las tres competencias principales usadas para el promedio final

  const getCourseSubjects = () => {
    if (!selectedCourseId) return [];
    let subs = (state.assignments || [])
      .filter((a: any) => a.course_id === selectedCourseId)
      .map((a: any) => (state.subjects || []).find((s: any) => s.id === a.subject_id))
      .filter(Boolean);
    if (subs.length === 0 && selectedCourse) {
      const cLvl = (selectedCourse.level || '').toLowerCase();
      subs = (state.subjects || []).filter((s: any) =>
        (s.level || '').toLowerCase().includes(cLvl.substring(0, 5))
      );
    }
    if (subs.length === 0) subs = state.subjects || [];
    return [...subs]
      .filter(
        (s) =>
          !s.name.toLowerCase().includes('lecto') && !s.name.toLowerCase().includes('escritura')
      )
      .sort((a, b) => {
        const getIdx = (n: string) => {
          const name = n.toLowerCase();
          if (name.includes('lengua')) return 0;
          if (name.includes('matemática')) return 1;
          if (name.includes('sociales')) return 2;
          if (name.includes('natura')) return 3;
          if (name.includes('física')) return 4;
          if (name.includes('fihr')) return 5;
          if (name.includes('artística')) return 6;
          return 99;
        };
        return getIdx(a.name) - getIdx(b.name);
      });
  };

  const generateActa = async () => {
    if (!selectedCourseId) return alert('Por favor, seleccione un curso primero.');
    setIsGenerating(true);

    try {
      // 1. Obtener Estudiantes del Curso
      const centerId = contextCenter?.id || profile?.center_id;
      const forceYear = selectedYear || '2026-2027';
      if (!centerId) {
        setIsGenerating(false);
        return;
      }

      const [students, centerData] = await Promise.all([
        dataService.getStudents(selectedCourseId, centerId, forceYear),
        dataService.getCenter(centerId)
      ]);
      if (!students || students.length === 0) {
        alert('No hay estudiantes inscritos en este curso.');
        setIsGenerating(false);
        return;
      }
      // Ordenar estudiantes alfabéticamente o por order_number
      students.sort((a: any, b: any) => (a.order_number || 999) - (b.order_number || 999));

      // 2. Obtener TODAS las calificaciones de este curso y año
      const { data: gData } = await supabase
        .from('student_grades')
        .select('*')
        .eq('course_id', selectedCourseId)
        .eq('school_year', forceYear);

      // Mapear calificaciones: grades[studentId][subjectId] = { 'c1_p1': 90, 'final_rec': 85, etc }
      const gradesMap: Record<string, Record<string, Record<string, any>>> = {};
      students.forEach((s) => (gradesMap[s.id] = {}));

      if (gData) {
        gData.forEach((g) => {
          if (!gradesMap[g.student_id]) gradesMap[g.student_id] = {};
          if (!gradesMap[g.student_id][g.subject_id]) gradesMap[g.student_id][g.subject_id] = {};

          const sGrades = gradesMap[g.student_id][g.subject_id];
          const pL = g.period.toLowerCase();

          if (g.grade !== null) sGrades[`${g.competency_id}_${pL}`] = g.grade;
          if (g.rp1 !== null) sGrades[`${g.competency_id}_rp1`] = g.rp1;
          if (g.rp2 !== null) sGrades[`${g.competency_id}_rp2`] = g.rp2;
          if (g.rp3 !== null) sGrades[`${g.competency_id}_rp3`] = g.rp3;
          if (g.rp4 !== null) sGrades[`${g.competency_id}_rp4`] = g.rp4;
          if (['COMP', 'EXTRA', 'ESP1', 'ESP2'].includes(g.period)) {
            sGrades[`${g.period}_${g.competency_id}`] = g.grade;
          }
          if (g.recovery_grade !== null) sGrades[`final_rec`] = g.recovery_grade;
        });
      }

      const subjects = getCourseSubjects();

      // Funciones de cálculo
      const getBestGrade = (sGrades: any, cId: string, p: string) => {
        const pL = p.toLowerCase();
        const g = parseInt(sGrades[`${cId}_${pL}`]) || 0;
        const r = parseInt(sGrades[`${cId}_r${pL}`]) || 0;
        return Math.max(g, r);
      };

      const calculateCompAvg = (sGrades: any, cId: string) => {
        const sum = periods.reduce((acc, p) => acc + getBestGrade(sGrades, cId, p), 0);
        return sum > 0 ? sum / 4 : 0;
      };

      const getFinalSubjectGrade = (studentId: string, subjectId: string) => {
        const sGrades = gradesMap[studentId]?.[subjectId] || {};
        const comps = isSecundario ? ['c1', 'c2', 'c3', 'c4'] : ['c1', 'c2', 'c3'];

        // 1. Calcular promedio de área (Media de las competencias)
        const compAverages = comps.map((cId) => Math.round(calculateCompAvg(sGrades, cId)));
        const avg = compAverages.reduce((a, b) => a + b, 0) / comps.length;
        const areaFinal = avg > 0 ? Math.round(avg) : 0;

        if (!isSecundario) {
          const recFinal = parseInt(sGrades['final_rec']) || 0;
          return Math.max(areaFinal, recFinal);
        }

        // 2. Lógica Secundaria: Recuperación Escalonada
        if (areaFinal >= 70) return areaFinal;

        // CP: Completivo (50/50)
        const cpExam = parseInt(sGrades['COMP_sec']) || 0; // Usamos el prefijo de periodo para las recuperaciones
        if (cpExam > 0) {
          const cpFinal = Math.round(areaFinal * 0.5 + cpExam * 0.5);
          if (cpFinal >= 70) return cpFinal;
        }

        // EX: Extraordinario (30/70)
        const exExam = parseInt(sGrades['EXTRA_sec']) || 0;
        if (exExam > 0) {
          const exFinal = Math.round(areaFinal * 0.3 + exExam * 0.7);
          if (exFinal >= 70) return exFinal;
        }

        // E1 / E2: Especiales
        const esp1 = parseInt(sGrades['ESP1_sec']) || 0;
        if (esp1 >= 70) return esp1;

        const esp2 = parseInt(sGrades['ESP2_sec']) || 0;
        if (esp2 >= 70) return esp2;

        return areaFinal;
      };

      // 3. Generar PDF
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' });
      const pageWidth = doc.internal.pageSize.width;

      const center = centerData || contextCenter || {
        name: 'CENTRO EDUCATIVO',
        address: '---',
        phone: '---'
      };

      // Header del Centro
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(center.name.toUpperCase(), pageWidth / 2, 15, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Dirección: ${center.address || '---'}   |   Teléfono: ${center.phone || '---'}`,
        pageWidth / 2,
        20,
        { align: 'center' }
      );

      doc.setDrawColor(0);
      doc.line(20, 23, pageWidth - 20, 23);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('ACTA DE CALIFICACIONES FINALES', pageWidth / 2, 31, { align: 'center' });

      doc.setFontSize(10);
      doc.text(
        `AÑO ESCOLAR: ${forceYear}   |   CURSO: ${selectedCourse?.level} ${selectedCourse?.grade} ${selectedCourse?.section}`,
        pageWidth / 2,
        37,
        { align: 'center' }
      );

      // Cabeceras de Tabla
      const headRow = ['Nº', 'NOMBRES Y APELLIDOS'];
      subjects.forEach((sub) => {
        // Abreviar nombres largos de materias para que quepan
        let subName = sub.name;
        if (subName.toLowerCase().includes('matemática')) subName = 'MAT.';
        else if (subName.toLowerCase().includes('lengua')) subName = 'LENG.';
        else if (subName.toLowerCase().includes('sociales')) subName = 'SOC.';
        else if (subName.toLowerCase().includes('natura')) subName = 'NAT.';
        else if (subName.toLowerCase().includes('física')) subName = 'ED. FÍS.';
        else if (subName.toLowerCase().includes('artística')) subName = 'ART.';
        else if (subName.toLowerCase().includes('fihr')) subName = 'FIHR';
        else if (
          subName.toLowerCase().includes('inglés') ||
          subName.toLowerCase().includes('ingles')
        )
          subName = 'INGLÉS';
        else if (
          subName.toLowerCase().includes('francés') ||
          subName.toLowerCase().includes('frances')
        )
          subName = 'FRANCÉS';
        else subName = subName.substring(0, 5).toUpperCase() + '.';

        headRow.push(subName);
      });
      headRow.push('PROM. FINAL');

      // Cuerpo de Tabla
      const body = students.map((s, idx) => {
        const row: any[] = [
          (idx + 1).toString().padStart(2, '0'),
          `${s.first_surname || ''} ${s.second_surname || ''}, ${s.names || ''}`
            .toUpperCase()
            .trim()
        ];

        let totalSum = 0;
        let subjectsCount = 0;

        subjects.forEach((sub) => {
          const finalGrade = getFinalSubjectGrade(s.id, sub.id);
          if (finalGrade > 0) {
            totalSum += finalGrade;
            subjectsCount++;
            row.push(finalGrade.toString());
          } else {
            row.push('-'); // No cursada o sin notas
          }
        });

        const generalAvg = subjectsCount > 0 ? Math.round(totalSum / subjectsCount) : 0;
        row.push(generalAvg > 0 ? generalAvg.toString() : '-');

        return row;
      });

      const isPrimaria = (selectedCourse?.level || '').toLowerCase().includes('primaria');
      const passingGrade = isPrimaria ? 65 : 70;

      autoTable(doc, {
        startY: 43,
        head: [headRow],
        body: body,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5, halign: 'center', valign: 'middle' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { halign: 'left', cellWidth: 50 }
        },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        didParseCell: (data: any) => {
          // Destacar el Promedio Final
          if (data.column.index === headRow.length - 1) {
            if (data.section === 'head') {
              data.cell.styles.fillColor = [55, 48, 163]; // Indigo
            } else if (data.section === 'body') {
              data.cell.styles.fillColor = [240, 240, 250];
              data.cell.styles.fontStyle = 'bold';
              const val = parseInt(data.cell.raw);
              if (val < passingGrade && val > 0) data.cell.styles.textColor = [200, 0, 0];
            }
          }
          // Destacar materias aplazadas
          if (
            data.section === 'body' &&
            data.column.index > 1 &&
            data.column.index < headRow.length - 1
          ) {
            const val = parseInt(data.cell.raw);
            if (val < passingGrade && val > 0) data.cell.styles.textColor = [200, 0, 0];
          }
        }
      });

      // ---- SECCIÓN DE FIRMAS ----
      let finalY = (doc as any).lastAutoTable.finalY + 40;

      // Verificar si hay espacio suficiente para las firmas (se necesitan al menos 30mm)
      if (finalY > doc.internal.pageSize.height - 20) {
        doc.addPage();
        finalY = 40;
      }

      const colWidth = pageWidth / 4;

      doc.setDrawColor(0);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');

      // 1. Maestro Titular
      doc.line(colWidth * 0.15, finalY, colWidth * 0.85, finalY);
      doc.text('MAESTRO/A TITULAR', colWidth * 0.5, finalY + 5, { align: 'center' });

      // 2. Coordinador Docente
      doc.line(colWidth * 1.15, finalY, colWidth * 1.85, finalY);
      doc.text('COORDINADOR/A DOCENTE', colWidth * 1.5, finalY + 5, { align: 'center' });

      // 3. Encargado de Registro
      doc.line(colWidth * 2.15, finalY, colWidth * 2.85, finalY);
      doc.text('ENCARGADO/A DE REGISTRO', colWidth * 2.5, finalY + 5, { align: 'center' });

      // 4. Director
      doc.line(colWidth * 3.15, finalY, colWidth * 3.85, finalY);
      doc.text('DIRECTOR/A DEL CENTRO', colWidth * 3.5, finalY + 5, { align: 'center' });

      doc.save(
        `Acta_Calificaciones_${selectedCourse?.grade}_${selectedCourse?.section}_${selectedYear}.pdf`
      );
    } catch (error) {
      console.error(error);
      alert('Error al generar el acta. Revise la consola.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateRegistroGrado = async () => {
    if (!selectedCourseId) return alert('Por favor, seleccione un curso primero.');
    setIsGeneratingRegistro(true);

    try {
      const centerId = contextCenter?.id || profile?.center_id;
      const forceYear = selectedYear || '2026-2027';
      if (!centerId) {
        setIsGeneratingRegistro(false);
        return;
      }

      const [students, centerData] = await Promise.all([
        dataService.getStudents(selectedCourseId, centerId, forceYear),
        dataService.getCenter(centerId)
      ]);

      if (!students || students.length === 0) {
        alert('No hay estudiantes inscritos en este curso.');
        setIsGeneratingRegistro(false);
        return;
      }
      students.sort((a: any, b: any) => (a.order_number || 999) - (b.order_number || 999));

      const { data: gData } = await supabase
        .from('student_grades')
        .select('*')
        .eq('course_id', selectedCourseId)
        .eq('school_year', forceYear);

      const gradesMap: Record<string, Record<string, Record<string, any>>> = {};
      students.forEach((s) => (gradesMap[s.id] = {}));

      if (gData) {
        gData.forEach((g) => {
          if (!gradesMap[g.student_id]) gradesMap[g.student_id] = {};
          if (!gradesMap[g.student_id][g.subject_id]) gradesMap[g.student_id][g.subject_id] = {};

          const sGrades = gradesMap[g.student_id][g.subject_id];
          const pL = g.period.toLowerCase();

          if (g.grade !== null) sGrades[`${g.competency_id}_${pL}`] = g.grade;
          if (g.rp1 !== null) sGrades[`${g.competency_id}_rp1`] = g.rp1;
          if (g.rp2 !== null) sGrades[`${g.competency_id}_rp2`] = g.rp2;
          if (g.rp3 !== null) sGrades[`${g.competency_id}_rp3`] = g.rp3;
          if (g.rp4 !== null) sGrades[`${g.competency_id}_rp4`] = g.rp4;
          if (['COMP', 'EXTRA', 'ESP1', 'ESP2'].includes(g.period)) {
            sGrades[`${g.period}_${g.competency_id}`] = g.grade;
          }
          if (g.recovery_grade !== null) sGrades[`final_rec`] = g.recovery_grade;
        });
      }

      const subjects = getCourseSubjects();
      if (subjects.length === 0) {
        alert('No hay asignaturas configuradas para este curso.');
        setIsGeneratingRegistro(false);
        return;
      }

      const getCompCell = (sGrades: any, cId: string, p: string) => {
        const pL = p.toLowerCase();
        const g = parseInt(sGrades[`${cId}_${pL}`]);
        const r = parseInt(sGrades[`${cId}_r${pL}`]);
        const hasG = !isNaN(g);
        const hasR = !isNaN(r) && r > 0;
        if (!hasG && !hasR) return '-';
        const baseG = hasG ? g : 0;
        if (hasR && r > baseG) {
          return `${baseG}→${r}`;
        }
        return `${baseG}`;
      };

      const getBestGrade = (sGrades: any, cId: string, p: string) => {
        const pL = p.toLowerCase();
        const g = parseInt(sGrades[`${cId}_${pL}`]) || 0;
        const r = parseInt(sGrades[`${cId}_r${pL}`]) || 0;
        return Math.max(g, r);
      };

      const calculateCompAvg = (sGrades: any, cId: string) => {
        const sum = periods.reduce((acc, p) => acc + getBestGrade(sGrades, cId, p), 0);
        return sum > 0 ? sum / 4 : 0;
      };

      const getFinalSubjectGrade = (studentId: string, subjectId: string) => {
        const sGrades = gradesMap[studentId]?.[subjectId] || {};
        const compsList = isSecundario ? ['c1', 'c2', 'c3', 'c4'] : ['c1', 'c2', 'c3'];
        const compAverages = compsList.map((cId) => Math.round(calculateCompAvg(sGrades, cId)));
        const avg = compAverages.reduce((a, b) => a + b, 0) / compsList.length;
        const areaFinal = avg > 0 ? Math.round(avg) : 0;

        if (!isSecundario) {
          const recFinal = parseInt(sGrades['final_rec']) || 0;
          return Math.max(areaFinal, recFinal);
        }

        if (areaFinal >= 70) return areaFinal;
        const cpExam = parseInt(sGrades['COMP_sec']) || 0;
        if (cpExam > 0) {
          const cpFinal = Math.round(areaFinal * 0.5 + cpExam * 0.5);
          if (cpFinal >= 70) return cpFinal;
        }
        const exExam = parseInt(sGrades['EXTRA_sec']) || 0;
        if (exExam > 0) {
          const exFinal = Math.round(areaFinal * 0.3 + exExam * 0.7);
          if (exFinal >= 70) return exFinal;
        }
        const esp1 = parseInt(sGrades['ESP1_sec']) || 0;
        if (esp1 >= 70) return esp1;
        const esp2 = parseInt(sGrades['ESP2_sec']) || 0;
        if (esp2 >= 70) return esp2;

        return areaFinal;
      };

      const docOrientation = registroSoloNumeros ? 'portrait' : 'landscape';
      const doc = new jsPDF({ orientation: docOrientation, unit: 'mm', format: 'legal' });
      const pageWidth = doc.internal.pageSize.width;
      const isPrimaria = (selectedCourse?.level || '').toLowerCase().includes('primaria');
      const passingGrade = isPrimaria ? 65 : 70;

      const center = centerData || contextCenter || {
        name: 'CENTRO EDUCATIVO',
        address: '---',
        phone: '---'
      };

      subjects.forEach((sub, subIdx) => {
        if (subIdx > 0) doc.addPage();

        // 1. Encabezado del centro con todo
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(center.name.toUpperCase(), pageWidth / 2, 12, { align: 'center' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`${center.address || ''}   |   Tel: ${center.phone || ''}`, pageWidth / 2, 16, {
          align: 'center'
        });

        doc.setDrawColor(0);
        doc.line(15, 19, pageWidth - 15, 19);

        // 2. Subtítulo con Curso, Sección, Tanda y Año Escolar
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        const tandaStr = 'M';
        doc.text(
          `Curso : ${selectedCourse?.grade || ''} ${selectedCourse?.level || ''}   Sección : ${selectedCourse?.section || ''}   Tanda : ${tandaStr}   Año Escolar : ${forceYear}`,
          pageWidth / 2,
          24,
          { align: 'center' }
        );

        // 3. Título de la materia y docente
        doc.setFontSize(10);
        doc.text(`ASIGNATURA: ${sub.name.toUpperCase()}`, 15, 30);

        const assignment = state.assignments?.find(
          (a) => a.course_id === selectedCourseId && a.subject_id === sub.id
        );
        const teacher = state.teachers?.find((t) => t.id === assignment?.teacher_id);
        if (teacher) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(`DOCENTE TITULAR: ${teacher.name.toUpperCase()}`, pageWidth - 15, 30, {
            align: 'right'
          });
        }

        // 4. Construcción de la matriz de columnas
        const compsList = isSecundario ? ['c1', 'c2', 'c3', 'c4'] : ['c1', 'c2', 'c3'];

        const headRowsConfig: any[] = [
          registroSoloNumeros
            ? [
                {
                  content: 'Nº',
                  rowSpan: 2,
                  styles: { halign: 'center', valign: 'middle', cellWidth: 7 }
                }
              ]
            : [
                {
                  content: 'Nº',
                  rowSpan: 2,
                  styles: { halign: 'center', valign: 'middle', cellWidth: 6 }
                },
                {
                  content: 'NOMBRES Y APELLIDOS',
                  rowSpan: 2,
                  styles: { halign: 'center', valign: 'middle', cellWidth: isSecundario ? 38 : 45 }
                }
              ],
          []
        ];

        // Fila 1: Nombres de las competencias principales
        compsList.forEach((cId, cIdx) => {
          const colors = [
            { fill: [235, 244, 255], text: [30, 58, 138] }, // C1: Azul claro
            { fill: [240, 253, 244], text: [20, 83, 45] }, // C2: Verde claro
            { fill: [254, 242, 242], text: [127, 29, 29] }, // C3: Rojo claro
            { fill: [250, 245, 255], text: [88, 28, 135] } // C4: Púrpura claro
          ][cIdx];

          headRowsConfig[0].push({
            content: `COMPETENCIA ${cIdx + 1}`,
            colSpan: 8,
            styles: {
              halign: 'center',
              fillColor: colors.fill,
              textColor: colors.text,
              fontStyle: 'bold'
            }
          });
        });

        // Fila 1: Promedios de las Competencias Específicas
        headRowsConfig[0].push({
          content: 'PROMEDIOS CE',
          colSpan: compsList.length,
          styles: {
            halign: 'center',
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          }
        });

        // Fila 1: CF (Calificación Final)
        headRowsConfig[0].push({
          content: 'CF',
          rowSpan: 2,
          styles: {
            halign: 'center',
            valign: 'middle',
            fillColor: [79, 70, 229],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          }
        });

        // Fila 2: Sub-columnas P1, RP1, P2, RP2... para cada cuadro de competencia
        compsList.forEach(() => {
          ['P1', 'R1', 'P2', 'R2', 'P3', 'R3', 'P4', 'R4'].forEach((lbl, lIdx) => {
            const isRP = lIdx % 2 !== 0;
            headRowsConfig[1].push({
              content: lbl,
              styles: {
                halign: 'center',
                fillColor: isRP ? [241, 245, 249] : [248, 250, 252],
                textColor: isRP ? [100, 116, 139] : [15, 23, 42]
              }
            });
          });
        });

        // Fila 2: Sub-columnas de los promedios PC1, PC2...
        compsList.forEach((cId, cIdx) => {
          headRowsConfig[1].push({
            content: `PC${cIdx + 1}`,
            styles: {
              halign: 'center',
              fillColor: [241, 245, 249],
              fontStyle: 'bold',
              textColor: [15, 23, 42]
            }
          });
        });

        // Mapeo de datos del cuerpo de la tabla
        const bodyData = students.map((s, idx) => {
          const sGrades = gradesMap[s.id]?.[sub.id] || {};
          const row: any[] = [(idx + 1).toString().padStart(2, '0')];

          if (!registroSoloNumeros) {
            row.push(
              `${s.first_surname || ''} ${s.second_surname || ''}, ${s.names || ''}`
                .toUpperCase()
                .trim()
            );
          }

          // Columnas P1, RP1, P2, RP2... por competencia
          compsList.forEach((cId) => {
            ['p1', 'p2', 'p3', 'p4'].forEach((p, pIdx) => {
              const gVal = sGrades[`${cId}_${p}`];
              const rVal = sGrades[`${cId}_rp${pIdx + 1}`];
              row.push(gVal !== undefined && gVal !== null ? gVal.toString() : '');
              row.push(rVal !== undefined && rVal !== null ? rVal.toString() : '');
            });
          });

          // Columnas de promedios por competencia específica
          compsList.forEach((cId) => {
            const avgVal = Math.round(calculateCompAvg(sGrades, cId));
            row.push(avgVal > 0 ? avgVal.toString() : '');
          });

          // Columna CF final
          const finalGrade = getFinalSubjectGrade(s.id, sub.id);
          row.push(finalGrade > 0 ? finalGrade.toString() : '');

          return row;
        });

        const fontSizeNum = registroSoloNumeros
          ? isSecundario
            ? 6
            : 7 // Más grande en vertical sin nombres
          : isSecundario
            ? 5
            : 6; // Estándar en horizontal con nombres

        const colStylesConfig: any = {
          0: { halign: 'center', cellWidth: registroSoloNumeros ? 7 : 6 }
        };
        if (!registroSoloNumeros) {
          colStylesConfig[1] = { halign: 'left', cellWidth: isSecundario ? 38 : 45 };
        }

        autoTable(doc, {
          startY: 34,
          head: headRowsConfig,
          body: bodyData,
          theme: 'grid',
          styles: {
            fontSize: fontSizeNum,
            cellPadding: registroSoloNumeros ? 1.0 : 0.8,
            halign: 'center',
            valign: 'middle',
            lineColor: [226, 232, 240],
            lineWidth: 0.1
          },
          columnStyles: colStylesConfig,
          didParseCell: (data: any) => {
            if (data.section === 'body') {
              const totalCols = (isSecundario ? 39 : 30) - (registroSoloNumeros ? 1 : 0);
              const isFinalCol = data.column.index === totalCols - 1;
              const isAvgBlockStart = (isSecundario ? 34 : 26) - (registroSoloNumeros ? 1 : 0);
              const isGradeCol = data.column.index >= (registroSoloNumeros ? 1 : 2);

              if (isGradeCol) {
                const val = parseInt(data.cell.raw);
                if (!isNaN(val) && val > 0 && val < passingGrade) {
                  data.cell.styles.textColor = [220, 38, 38]; // Rojo para pendientes
                  if (isFinalCol || data.column.index >= isAvgBlockStart) {
                    data.cell.styles.fontStyle = 'bold';
                  }
                } else if (isFinalCol && !isNaN(val) && val >= passingGrade) {
                  data.cell.styles.fontStyle = 'bold';
                  data.cell.styles.fillColor = [243, 244, 246];
                }
              }
            }
          }
        });

        // Pie de página con firmas
        const finalY = (doc as any).lastAutoTable.finalY + 15;
        if (finalY < doc.internal.pageSize.height - 15) {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.line(30, finalY, 100, finalY);
          doc.text(
            `DOCENTE: ${teacher?.name?.toUpperCase() || 'FIRMA DEL DOCENTE'}`,
            65,
            finalY + 4,
            { align: 'center' }
          );

          doc.line(pageWidth - 100, finalY, pageWidth - 30, finalY);
          doc.text(`COORDINACIÓN DOCENTE / SELLO`, pageWidth - 65, finalY + 4, { align: 'center' });
        }
      });

      const fileSuffix = registroSoloNumeros ? 'Solo_Numeros_Vertical' : 'Completo_Horizontal';
      doc.save(
        `Registro_Grado_${selectedCourse?.grade}_${selectedCourse?.section}_${fileSuffix}.pdf`
      );
    } catch (error) {
      console.error(error);
      alert('Error al generar el Registro de Grado.');
    } finally {
      setIsGeneratingRegistro(false);
    }
  };

  const openBoletinModal = async () => {
    if (!selectedCourseId) return alert('Por favor, seleccione un curso primero.');
    setIsFetchingBoletinData(true);

    try {
      const centerId = contextCenter?.id || profile?.center_id;
      const forceYear = selectedYear || '2026-2027';
      if (!centerId) {
        setIsFetchingBoletinData(false);
        return;
      }

      const [students, centerData] = await Promise.all([
        dataService.getStudents(selectedCourseId, centerId, forceYear),
        dataService.getCenter(centerId)
      ]);

      if (!students || students.length === 0) {
        alert('No hay estudiantes inscritos en este curso.');
        setIsFetchingBoletinData(false);
        return;
      }
      students.sort((a: any, b: any) => (a.order_number || 999) - (b.order_number || 999));

      const { data: gData } = await supabase
        .from('student_grades')
        .select('*')
        .eq('course_id', selectedCourseId)
        .eq('school_year', forceYear);

      const gradesMap: Record<string, Record<string, Record<string, any>>> = {};
      students.forEach((s) => (gradesMap[s.id] = {}));

      if (gData) {
        gData.forEach((g) => {
          if (!gradesMap[g.student_id]) gradesMap[g.student_id] = {};
          if (!gradesMap[g.student_id][g.subject_id]) gradesMap[g.student_id][g.subject_id] = {};

          const sGrades = gradesMap[g.student_id][g.subject_id];
          const pL = g.period.toLowerCase();

          if (g.grade !== null) sGrades[`${g.competency_id}_${pL}`] = g.grade;
          if (g.rp1 !== null) sGrades[`${g.competency_id}_rp1`] = g.rp1;
          if (g.rp2 !== null) sGrades[`${g.competency_id}_rp2`] = g.rp2;
          if (g.rp3 !== null) sGrades[`${g.competency_id}_rp3`] = g.rp3;
          if (g.rp4 !== null) sGrades[`${g.competency_id}_rp4`] = g.rp4;
          if (g.recovery_grade !== null) sGrades[`final_rec`] = g.recovery_grade;
          if (g.period === 'COMP') sGrades['comp'] = g.grade;
          if (g.period === 'EXTRA') sGrades['extra'] = g.grade;
          if (g.period === 'ESP1') sGrades['esp1'] = g.grade;
          if (g.period === 'ESP2') sGrades['esp2'] = g.grade;
        });
      }

      setBoletinData({ students, gradesMap, centerData, subjects: getCourseSubjects() });
      setSelectedStudentId('all');
      setShowBoletinModal(true);
    } catch (error) {
      console.error(error);
      alert('Error al obtener datos para los boletines.');
    } finally {
      setIsFetchingBoletinData(false);
    }
  };

  const openRankingModal = async () => {
    if (!selectedCourseId) return alert('Seleccione un curso');
    setIsLoading(true);
    try {
      const forceYear = selectedYear || '2026-2027';
      const centerId = contextCenter?.id || profile?.center_id;
      if (!centerId) {
        setIsLoading(false);
        return;
      }
      const stdData = await dataService.getStudents(selectedCourseId, centerId, forceYear);
      const courseSubjects = getCourseSubjects();

      const { data: gData } = await supabase
        .from('student_grades')
        .select('*')
        .eq('course_id', selectedCourseId)
        .eq('school_year', forceYear);
      const loadedMap: any = {};
      if (gData) {
        gData.forEach((g: any) => {
          if (!loadedMap[g.student_id]) loadedMap[g.student_id] = {};
          if (!loadedMap[g.student_id][g.subject_id]) loadedMap[g.student_id][g.subject_id] = {};
          const pL = g.period.toLowerCase();
          if (g.grade !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_${pL}`] = g.grade;
          if (g.rp1 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp1`] = g.rp1;
          if (g.rp2 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp2`] = g.rp2;
          if (g.rp3 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp3`] = g.rp3;
          if (g.rp4 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp4`] = g.rp4;
          if (g.recovery_grade !== null)
            loadedMap[g.student_id][g.subject_id]['final_rec'] = g.recovery_grade;
        });
      }
      const center = await dataService.getCenter(centerId);
      setRankingData({
        students: stdData || [],
        subjects: courseSubjects,
        gradesMap: loadedMap,
        centerData: center
      });
      setShowRankingModal(true);
    } catch (e) {
      console.error(e);
      alert('Error cargando datos para el ranking');
    } finally {
      setIsLoading(false);
    }
  };

  const generateRankingPDF = async () => {
    if (!rankingData) return;
    const forceYear = '2025-2026';

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.width;
    const center = rankingData.centerData || {
      name: 'CENTRO EDUCATIVO',
      address: '',
      phone: '',
      logo_url: null
    };

    let logoImg: HTMLImageElement | null = null;
    try {
      logoImg = new Image();
      logoImg.src = center.logo_url || '/Edugest2.png';
      await new Promise((resolve, reject) => {
        logoImg!.onload = resolve;
        logoImg!.onerror = reject;
      });
    } catch (e) {
      logoImg = null;
    }

    if (logoImg) doc.addImage(logoImg, 'PNG', 14, 10, 20, 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(center.name.toUpperCase(), pageWidth / 2, 15, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`CUADRO DE MÉRITO Y PROMEDIOS GENERALES`, pageWidth / 2, 23, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `PERIODO: ${rankingPeriod === 'FINAL' ? 'PROMEDIO FINAL DEL AÑO' : rankingPeriod}   |   CURSO: ${selectedCourse?.level} ${selectedCourse?.grade} ${selectedCourse?.section}`,
      pageWidth / 2,
      29,
      { align: 'center' }
    );

    const studentsWithAvgs = rankingData.students
      .map((student: any) => {
        let totalSubjectGrades = 0;
        let validSubjectsCount = 0;

        rankingData.subjects.forEach((sub: any) => {
          const sGrades = rankingData.gradesMap[student.id]?.[sub.id] || {};

          const getBestGrade = (cId: string, p: string) => {
            const pL = p.toLowerCase();
            const g = parseInt(sGrades[`${cId}_${pL}`]) || 0;
            const r = parseInt(sGrades[`${cId}_r${pL}`]) || 0;
            return Math.max(g, r);
          };

          if (rankingPeriod === 'FINAL') {
            const getCompFinal = (cId: string) =>
              Math.round(
                (getBestGrade(cId, 'P1') +
                  getBestGrade(cId, 'P2') +
                  getBestGrade(cId, 'P3') +
                  getBestGrade(cId, 'P4')) /
                  4
              );
            let finalArea = Math.round(
              (getCompFinal('c1') + getCompFinal('c2') + getCompFinal('c3')) / 3
            );
            let recFinal = parseInt(sGrades['final_rec']) || 0;
            let bestFinal = Math.max(finalArea, recFinal);
            if (bestFinal > 0) {
              totalSubjectGrades += bestFinal;
              validSubjectsCount++;
            }
          } else {
            let pArea = Math.round(
              (getBestGrade('c1', rankingPeriod) +
                getBestGrade('c2', rankingPeriod) +
                getBestGrade('c3', rankingPeriod)) /
                3
            );
            if (pArea > 0) {
              totalSubjectGrades += pArea;
              validSubjectsCount++;
            }
          }
        });

        const avg =
          validSubjectsCount > 0 ? Math.round(totalSubjectGrades / validSubjectsCount) : 0;
        let classification = '';
        rankingScales.forEach((scale) => {
          if (avg >= scale.min && avg <= scale.max) classification = scale.label;
        });

        return { ...student, average: avg, classification };
      })
      .filter((s: any) => s.average > 0);

    studentsWithAvgs.sort((a: any, b: any) => b.average - a.average);

    const body = studentsWithAvgs.map((s: any, idx: number) => {
      return [
        (s.order_number || idx + 1).toString().padStart(2, '0'),
        `${s.first_surname || ''} ${s.second_surname || ''}, ${s.names || ''}`.toUpperCase(),
        s.average.toString(),
        s.classification
      ];
    });

    autoTable(doc, {
      startY: 35,
      head: [['Nº Orden', 'Nombre del Estudiante', 'Promedio General', 'Clasificación']],
      body: body,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2, valign: 'middle' },
      headStyles: { fillColor: [55, 48, 163], textColor: [255, 255, 255], halign: 'center' },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold', cellWidth: 25 },
        1: { halign: 'left' },
        2: { halign: 'center', fontStyle: 'bold', cellWidth: 40 },
        3: { halign: 'center', fontStyle: 'bold', cellWidth: 45 }
      },
      didParseCell: (data) => {
        if (
          data.section === 'body' &&
          (data.row.index === 0 || data.row.index === 1 || data.row.index === 2)
        ) {
          data.cell.styles.fillColor = [255, 250, 230];
        }
      }
    });

    doc.save(`Ranking_${selectedCourse?.grade}_${selectedCourse?.section}_${rankingPeriod}.pdf`);
    setShowRankingModal(false);
  };

  const generateRankingExcel = () => {
    if (!rankingData) return;

    const studentsWithAvgs = rankingData.students
      .map((student: any) => {
        let totalSubjectGrades = 0;
        let validSubjectsCount = 0;

        rankingData.subjects.forEach((sub: any) => {
          const sGrades = rankingData.gradesMap[student.id]?.[sub.id] || {};

          const getBestGrade = (cId: string, p: string) => {
            const pL = p.toLowerCase();
            const g = parseInt(sGrades[`${cId}_${pL}`]) || 0;
            const r = parseInt(sGrades[`${cId}_r${pL}`]) || 0;
            return Math.max(g, r);
          };

          if (rankingPeriod === 'FINAL') {
            const getCompFinal = (cId: string) =>
              Math.round(
                (getBestGrade(cId, 'P1') +
                  getBestGrade(cId, 'P2') +
                  getBestGrade(cId, 'P3') +
                  getBestGrade(cId, 'P4')) /
                  4
              );
            let finalArea = Math.round(
              (getCompFinal('c1') + getCompFinal('c2') + getCompFinal('c3')) / 3
            );
            let recFinal = parseInt(sGrades['final_rec']) || 0;
            let bestFinal = Math.max(finalArea, recFinal);
            if (bestFinal > 0) {
              totalSubjectGrades += bestFinal;
              validSubjectsCount++;
            }
          } else {
            let pArea = Math.round(
              (getBestGrade('c1', rankingPeriod) +
                getBestGrade('c2', rankingPeriod) +
                getBestGrade('c3', rankingPeriod)) /
                3
            );
            if (pArea > 0) {
              totalSubjectGrades += pArea;
              validSubjectsCount++;
            }
          }
        });

        const avg =
          validSubjectsCount > 0 ? Math.round(totalSubjectGrades / validSubjectsCount) : 0;
        let classification = '';
        rankingScales.forEach((scale) => {
          if (avg >= scale.min && avg <= scale.max) classification = scale.label;
        });

        return { ...student, average: avg, classification };
      })
      .filter((s: any) => s.average > 0);

    studentsWithAvgs.sort((a: any, b: any) => b.average - a.average);

    const excelData = studentsWithAvgs.map((s: any, idx: number) => ({
      'Nº Orden': s.order_number || idx + 1,
      'Nombre del Estudiante':
        `${s.first_surname || ''} ${s.second_surname || ''}, ${s.names || ''}`.toUpperCase(),
      'Promedio General': s.average,
      Clasificación: s.classification
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ranking');

    const wscols = [{ wch: 10 }, { wch: 45 }, { wch: 18 }, { wch: 25 }];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(
      workbook,
      `Ranking_${selectedCourse?.grade}_${selectedCourse?.section}_${rankingPeriod}.xlsx`
    );
    setShowRankingModal(false);
  };

  const openSubjectAvgModal = async () => {
    if (!selectedCourseId) return alert('Seleccione un curso');
    setIsLoading(true);
    try {
      const forceYear = selectedYear || '2026-2027';
      const centerId = contextCenter?.id || profile?.center_id;
      if (!centerId) {
        setIsLoading(false);
        return;
      }
      const stdData = await dataService.getStudents(selectedCourseId, centerId, forceYear);
      const assignments = state.assignments?.filter((a) => a.course_id === selectedCourseId) || [];
      const courseSubjects = getCourseSubjects();

      const { data: gData } = await supabase
        .from('student_grades')
        .select('*')
        .eq('course_id', selectedCourseId)
        .eq('school_year', forceYear);
      const loadedMap: any = {};
      if (gData) {
        gData.forEach((g: any) => {
          if (!loadedMap[g.student_id]) loadedMap[g.student_id] = {};
          if (!loadedMap[g.student_id][g.subject_id]) loadedMap[g.student_id][g.subject_id] = {};
          const pL = g.period.toLowerCase();
          if (g.grade !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_${pL}`] = g.grade;
          if (g.rp1 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp1`] = g.rp1;
          if (g.rp2 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp2`] = g.rp2;
          if (g.rp3 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp3`] = g.rp3;
          if (g.rp4 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp4`] = g.rp4;
          if (g.recovery_grade !== null)
            loadedMap[g.student_id][g.subject_id]['final_rec'] = g.recovery_grade;
        });
      }
      const center = await dataService.getCenter(centerId);
      setSubjectAvgData({
        students: stdData || [],
        subjects: courseSubjects,
        gradesMap: loadedMap,
        centerData: center,
        teachersMap: assignments
      });
      setShowSubjectAvgModal(true);
    } catch (e) {
      console.error(e);
      alert('Error cargando datos para promedios por materia');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSubjectAverages = () => {
    return subjectAvgData.subjects
      .map((sub: any) => {
        let subjectTotal = 0;
        let studentsWithGrades = 0;

        subjectAvgData.students.forEach((student: any) => {
          const sGrades = subjectAvgData.gradesMap[student.id]?.[sub.id] || {};

          const getBestGrade = (cId: string, p: string) => {
            const pL = p.toLowerCase();
            const g = parseInt(sGrades[`${cId}_${pL}`]) || 0;
            const r = parseInt(sGrades[`${cId}_r${pL}`]) || 0;
            return Math.max(g, r);
          };

          let grade = 0;
          if (subjectAvgPeriod === 'FINAL') {
            const getCompFinal = (cId: string) =>
              Math.round(
                (getBestGrade(cId, 'P1') +
                  getBestGrade(cId, 'P2') +
                  getBestGrade(cId, 'P3') +
                  getBestGrade(cId, 'P4')) /
                  4
              );
            let finalArea = Math.round(
              (getCompFinal('c1') + getCompFinal('c2') + getCompFinal('c3')) / 3
            );
            let recFinal = parseInt(sGrades['final_rec']) || 0;
            grade = Math.max(finalArea, recFinal);
          } else {
            grade = Math.round(
              (getBestGrade('c1', subjectAvgPeriod) +
                getBestGrade('c2', subjectAvgPeriod) +
                getBestGrade('c3', subjectAvgPeriod)) /
                3
            );
          }

          if (grade > 0) {
            subjectTotal += grade;
            studentsWithGrades++;
          }
        });

        const avg = studentsWithGrades > 0 ? Math.round(subjectTotal / studentsWithGrades) : 0;
        let classification = '';
        rankingScales.forEach((scale) => {
          if (avg >= scale.min && avg <= scale.max) classification = scale.label;
        });

        const assignment = subjectAvgData.teachersMap.find((a: any) => a.subject_id === sub.id);
        const teacherName =
          state.teachers?.find((t) => t.id === assignment?.teacher_id)?.names || 'Sin asignar';

        return { subject: sub.name, teacher: teacherName, average: avg, classification };
      })
      .filter((s: any) => s.average > 0)
      .sort((a: any, b: any) => b.average - a.average);
  };

  const generateSubjectAvgPDF = async () => {
    if (!subjectAvgData) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.width;
    const center = subjectAvgData.centerData || {
      name: 'CENTRO EDUCATIVO',
      address: '',
      phone: '',
      logo_url: null
    };

    let logoImg: HTMLImageElement | null = null;
    try {
      logoImg = new Image();
      logoImg.src = center.logo_url || '/Edugest2.png';
      await new Promise((resolve, reject) => {
        logoImg!.onload = resolve;
        logoImg!.onerror = reject;
      });
    } catch (e) {
      logoImg = null;
    }

    if (logoImg) doc.addImage(logoImg, 'PNG', 14, 10, 20, 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(center.name.toUpperCase(), pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`PROMEDIOS GENERALES POR MATERIA`, pageWidth / 2, 23, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `PERIODO: ${subjectAvgPeriod === 'FINAL' ? 'PROMEDIO FINAL DEL AÑO' : subjectAvgPeriod}   |   CURSO: ${selectedCourse?.level} ${selectedCourse?.grade} ${selectedCourse?.section}`,
      pageWidth / 2,
      29,
      { align: 'center' }
    );

    const subjectsWithAvgs = calculateSubjectAverages();

    const body = subjectsWithAvgs.map((s: any, idx: number) => {
      return [
        (idx + 1).toString().padStart(2, '0'),
        s.subject.toUpperCase(),
        s.teacher,
        s.average.toString(),
        s.classification
      ];
    });

    autoTable(doc, {
      startY: 35,
      head: [['Nº', 'Asignatura', 'Docente Titular', 'Promedio General', 'Clasificación']],
      body: body,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2, valign: 'middle' },
      headStyles: { fillColor: [14, 165, 233], textColor: [255, 255, 255], halign: 'center' },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold', cellWidth: 15 },
        1: { halign: 'left' },
        2: { halign: 'left' },
        3: { halign: 'center', fontStyle: 'bold', cellWidth: 35 },
        4: { halign: 'center', fontStyle: 'bold', cellWidth: 35 }
      }
    });

    doc.save(
      `Promedios_Materias_${selectedCourse?.grade}_${selectedCourse?.section}_${subjectAvgPeriod}.pdf`
    );
    setShowSubjectAvgModal(false);
  };

  const generateSubjectAvgExcel = () => {
    if (!subjectAvgData) return;
    const subjectsWithAvgs = calculateSubjectAverages();

    const excelData = subjectsWithAvgs.map((s: any, idx: number) => ({
      Nº: idx + 1,
      Asignatura: s.subject.toUpperCase(),
      'Docente Titular': s.teacher,
      'Promedio General': s.average,
      Clasificación: s.classification
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PromediosMaterias');
    worksheet['!cols'] = [{ wch: 5 }, { wch: 35 }, { wch: 35 }, { wch: 18 }, { wch: 20 }];

    XLSX.writeFile(
      workbook,
      `Promedios_Materias_${selectedCourse?.grade}_${selectedCourse?.section}_${subjectAvgPeriod}.xlsx`
    );
    setShowSubjectAvgModal(false);
  };

  const openEvolutionModal = async () => {
    if (!selectedCourseId) return alert('Seleccione un curso');
    setIsLoading(true);
    try {
      const forceYear = selectedYear || '2026-2027';
      const centerId = contextCenter?.id || profile?.center_id;
      if (!centerId) {
        setIsLoading(false);
        return;
      }
      const stdData = await dataService.getStudents(selectedCourseId, centerId, forceYear);
      const courseSubjects = getCourseSubjects();

      const { data: gData } = await supabase
        .from('student_grades')
        .select('*')
        .eq('course_id', selectedCourseId)
        .eq('school_year', forceYear);
      const loadedMap: any = {};
      if (gData) {
        gData.forEach((g: any) => {
          if (!loadedMap[g.student_id]) loadedMap[g.student_id] = {};
          if (!loadedMap[g.student_id][g.subject_id]) loadedMap[g.student_id][g.subject_id] = {};
          const pL = g.period.toLowerCase();
          if (g.grade !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_${pL}`] = g.grade;
          if (g.rp1 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp1`] = g.rp1;
          if (g.rp2 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp2`] = g.rp2;
          if (g.rp3 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp3`] = g.rp3;
          if (g.rp4 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp4`] = g.rp4;
          if (g.recovery_grade !== null)
            loadedMap[g.student_id][g.subject_id]['final_rec'] = g.recovery_grade;
        });
      }
      setEvolutionData({ students: stdData || [], subjects: courseSubjects, gradesMap: loadedMap });
      setShowEvolutionModal(true);
    } catch (e) {
      console.error(e);
      alert('Error cargando datos');
    } finally {
      setIsLoading(false);
    }
  };

  const generateEvolutionReport = (format: 'pdf' | 'excel') => {
    const studentsWithTrends = evolutionData.students
      .map((student: any, idx: number) => {
        const pAvgs = { P1: 0, P2: 0, P3: 0, P4: 0 };
        const counts = { P1: 0, P2: 0, P3: 0, P4: 0 };

        evolutionData.subjects.forEach((sub: any) => {
          const sGrades = evolutionData.gradesMap[student.id]?.[sub.id] || {};
          const getBest = (cId: string, p: string) =>
            Math.max(
              parseInt(sGrades[`${cId}_${p.toLowerCase()}`]) || 0,
              parseInt(sGrades[`${cId}_r${p.toLowerCase()}`]) || 0
            );

          ['P1', 'P2', 'P3', 'P4'].forEach((p) => {
            const g = Math.round((getBest('c1', p) + getBest('c2', p) + getBest('c3', p)) / 3);
            if (g > 0) {
              pAvgs[p as keyof typeof pAvgs] += g;
              counts[p as keyof typeof counts]++;
            }
          });
        });

        const avg1 = counts.P1 > 0 ? Math.round(pAvgs.P1 / counts.P1) : 0;
        const avg2 = counts.P2 > 0 ? Math.round(pAvgs.P2 / counts.P2) : 0;
        const avg3 = counts.P3 > 0 ? Math.round(pAvgs.P3 / counts.P3) : 0;
        const avg4 = counts.P4 > 0 ? Math.round(pAvgs.P4 / counts.P4) : 0;

        const periods = [
          { name: 'P1', val: avg1 },
          { name: 'P2', val: avg2 },
          { name: 'P3', val: avg3 },
          { name: 'P4', val: avg4 }
        ].filter((p) => p.val > 0);

        let trend = '▬';
        let trendColor = [150, 150, 150];

        if (periods.length >= 2) {
          const curr = periods[periods.length - 1];
          const prev = periods[periods.length - 2];
          const diff = curr.val - prev.val;

          if (diff > 2) {
            trend = '▲';
            trendColor = [16, 163, 74];
          } else if (diff < -2) {
            trend = '▼';
            trendColor = [220, 38, 38];
          }
        }

        return {
          ...student,
          order: student.order_number || idx + 1,
          avg1,
          avg2,
          avg3,
          avg4,
          trend,
          trendColor
        };
      })
      .sort((a: any, b: any) => a.order - b.order);

    if (format === 'excel') {
      const excelData = studentsWithTrends.map((s: any) => ({
        Nº: s.order,
        Estudiante:
          `${s.first_surname || ''} ${s.second_surname || ''}, ${s.names || ''}`.toUpperCase(),
        P1: s.avg1 || '-',
        P2: s.avg2 || '-',
        P3: s.avg3 || '-',
        P4: s.avg4 || '-',
        Tendencia: s.trend
      }));
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Evolucion');
      worksheet['!cols'] = [
        { wch: 5 },
        { wch: 45 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 15 }
      ];
      XLSX.writeFile(
        workbook,
        `Evolucion_${selectedCourse?.grade}_${selectedCourse?.section}.xlsx`
      );
    } else {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
      doc.setFontSize(14);
      doc.text(
        `REPORTE DE EVOLUCIÓN ACADÉMICA - ${selectedCourse?.level} ${selectedCourse?.grade} ${selectedCourse?.section}`,
        14,
        15
      );

      const head = [['Nº', 'ESTUDIANTE', 'P1', 'P2', 'P3', 'P4', 'TENDENCIA']];
      const body = studentsWithTrends.map((s: any) => [
        s.order,
        `${s.first_surname || ''} ${s.second_surname || ''}, ${s.names || ''}`.toUpperCase(),
        s.avg1 || '-',
        s.avg2 || '-',
        s.avg3 || '-',
        s.avg4 || '-',
        s.trend
      ]);

      autoTable(doc, {
        startY: 25,
        head: head,
        body: body,
        theme: 'grid',
        styles: { fontSize: 8, valign: 'middle' },
        headStyles: { fillColor: [147, 51, 234], textColor: [255, 255, 255] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { halign: 'left', cellWidth: 85 },
          2: { halign: 'center', cellWidth: 15 },
          3: { halign: 'center', cellWidth: 15 },
          4: { halign: 'center', cellWidth: 15 },
          5: { halign: 'center', cellWidth: 15 },
          6: { halign: 'center', cellWidth: 25, fontStyle: 'bold' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 6) {
            const student = studentsWithTrends[data.row.index];
            data.cell.styles.textColor = student.trendColor;
            data.cell.styles.fontSize = 11;
          }
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Leyenda de Tendencia:   ( ▲ ) En Ascenso    |    ( ▼ ) En Declive    |    ( ▬ ) Estable`,
        14,
        finalY
      );

      doc.save(`Evolucion_${selectedCourse?.grade}_${selectedCourse?.section}.pdf`);
    }
    setShowEvolutionModal(false);
  };

  const openCompetencyAvgModal = async () => {
    if (!selectedCourseId) return alert('Seleccione un curso');
    setIsLoading(true);
    try {
      const forceYear = selectedYear || '2026-2027';
      const centerId = contextCenter?.id || profile?.center_id;
      if (!centerId) {
        setIsLoading(false);
        return;
      }
      const stdData = await dataService.getStudents(selectedCourseId, centerId, forceYear);
      const courseSubjects = getCourseSubjects();

      const { data: gData } = await supabase
        .from('student_grades')
        .select('*')
        .eq('course_id', selectedCourseId)
        .eq('school_year', forceYear);
      const loadedMap: any = {};
      if (gData) {
        gData.forEach((g: any) => {
          if (!loadedMap[g.student_id]) loadedMap[g.student_id] = {};
          if (!loadedMap[g.student_id][g.subject_id]) loadedMap[g.student_id][g.subject_id] = {};
          const pL = g.period.toLowerCase();
          if (g.grade !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_${pL}`] = g.grade;
          if (g.rp1 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp1`] = g.rp1;
          if (g.rp2 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp2`] = g.rp2;
          if (g.rp3 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp3`] = g.rp3;
          if (g.rp4 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp4`] = g.rp4;
          if (g.recovery_grade !== null)
            loadedMap[g.student_id][g.subject_id]['final_rec'] = g.recovery_grade;
        });
      }
      const center = await dataService.getCenter(centerId);
      setCompetencyAvgData({
        students: stdData || [],
        subjects: courseSubjects,
        gradesMap: loadedMap,
        centerData: center
      });
      setShowCompetencyAvgModal(true);
    } catch (e) {
      console.error(e);
      alert('Error cargando datos para el reporte de competencias');
    } finally {
      setIsLoading(false);
    }
  };

  const generateCompetencyReport = (format: 'pdf' | 'excel') => {
    if (!competencyAvgData) return;

    const reportData = competencyAvgData.subjects.map((sub: any) => {
      let tC1 = 0,
        cC1 = 0;
      let tC2 = 0,
        cC2 = 0;
      let tC3 = 0,
        cC3 = 0;
      let tTotal = 0,
        cTotal = 0;

      const assignments =
        state.assignments?.filter(
          (a) => a.course_id === selectedCourseId && a.subject_id === sub.id
        ) || [];
      const teacherName =
        assignments.length > 0
          ? state.teachers?.find((t) => t.id === assignments[0].teacher_id)?.name || 'NO ASIGNADO'
          : 'NO ASIGNADO';

      competencyAvgData.students.forEach((std: any) => {
        const sGrades = competencyAvgData.gradesMap[std.id]?.[sub.id] || {};
        const getBestGrade = (cId: string, p: string) =>
          Math.max(
            parseInt(sGrades[`${cId}_${p.toLowerCase()}`]) || 0,
            parseInt(sGrades[`${cId}_r${p.toLowerCase()}`]) || 0
          );

        if (competencyAvgPeriod === 'FINAL') {
          const gC1 = Math.round(
            (getBestGrade('c1', 'P1') +
              getBestGrade('c1', 'P2') +
              getBestGrade('c1', 'P3') +
              getBestGrade('c1', 'P4')) /
              4
          );
          const gC2 = Math.round(
            (getBestGrade('c2', 'P1') +
              getBestGrade('c2', 'P2') +
              getBestGrade('c2', 'P3') +
              getBestGrade('c2', 'P4')) /
              4
          );
          const gC3 = Math.round(
            (getBestGrade('c3', 'P1') +
              getBestGrade('c3', 'P2') +
              getBestGrade('c3', 'P3') +
              getBestGrade('c3', 'P4')) /
              4
          );
          let finalArea = Math.round((gC1 + gC2 + gC3) / 3);
          let bestFinal = Math.max(finalArea, parseInt(sGrades['final_rec']) || 0);

          if (gC1 > 0) {
            tC1 += gC1;
            cC1++;
          }
          if (gC2 > 0) {
            tC2 += gC2;
            cC2++;
          }
          if (gC3 > 0) {
            tC3 += gC3;
            cC3++;
          }
          if (bestFinal > 0) {
            tTotal += bestFinal;
            cTotal++;
          }
        } else {
          const gC1 = getBestGrade('c1', competencyAvgPeriod);
          const gC2 = getBestGrade('c2', competencyAvgPeriod);
          const gC3 = getBestGrade('c3', competencyAvgPeriod);
          let pArea = Math.round((gC1 + gC2 + gC3) / 3);
          if (gC1 > 0) {
            tC1 += gC1;
            cC1++;
          }
          if (gC2 > 0) {
            tC2 += gC2;
            cC2++;
          }
          if (gC3 > 0) {
            tC3 += gC3;
            cC3++;
          }
          if (pArea > 0) {
            tTotal += pArea;
            cTotal++;
          }
        }
      });

      return {
        subject: sub.name,
        teacher: teacherName,
        avgC1: cC1 > 0 ? Math.round(tC1 / cC1) : 0,
        avgC2: cC2 > 0 ? Math.round(tC2 / cC2) : 0,
        avgC3: cC3 > 0 ? Math.round(tC3 / cC3) : 0,
        avgTotal: cTotal > 0 ? Math.round(tTotal / cTotal) : 0
      };
    });

    if (format === 'excel') {
      const excelData = reportData.map((r: any) => ({
        Asignatura: r.subject.toUpperCase(),
        Docente: r.teacher,
        'Promedio C1': r.avgC1 || '-',
        'Promedio C2': r.avgC2 || '-',
        'Promedio C3': r.avgC3 || '-',
        'Promedio General': r.avgTotal || '-'
      }));
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Competencias');
      worksheet['!cols'] = [
        { wch: 30 },
        { wch: 30 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 18 }
      ];
      XLSX.writeFile(
        workbook,
        `Competencias_${selectedCourse?.grade}_${selectedCourse?.section}_${competencyAvgPeriod}.xlsx`
      );
    } else {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
      const pageWidth = doc.internal.pageSize.width;
      const center = competencyAvgData.centerData || { name: 'CENTRO EDUCATIVO' };

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(center.name.toUpperCase(), pageWidth / 2, 15, { align: 'center' });
      doc.setFontSize(12);
      doc.text(
        `DESEMPEÑO POR COMPETENCIAS - ${selectedCourse?.level} ${selectedCourse?.grade} ${selectedCourse?.section}`,
        pageWidth / 2,
        23,
        { align: 'center' }
      );
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `PERIODO: ${competencyAvgPeriod === 'FINAL' ? 'PROMEDIO FINAL' : competencyAvgPeriod}`,
        pageWidth / 2,
        29,
        { align: 'center' }
      );

      const head = [['ASIGNATURA', 'DOCENTE', 'PROM. C1', 'PROM. C2', 'PROM. C3', 'PROM. GENERAL']];
      const body = reportData.map((r: any) => [
        r.subject.toUpperCase(),
        r.teacher,
        r.avgC1 || '-',
        r.avgC2 || '-',
        r.avgC3 || '-',
        r.avgTotal || '-'
      ]);

      autoTable(doc, {
        startY: 35,
        head: head,
        body: body,
        theme: 'grid',
        styles: { fontSize: 9, valign: 'middle' },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], halign: 'center' },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 50 },
          2: { halign: 'center', cellWidth: 25 },
          3: { halign: 'center', cellWidth: 25 },
          4: { halign: 'center', cellWidth: 25 },
          5: { halign: 'center', fontStyle: 'bold', cellWidth: 30 }
        }
      });

      doc.save(
        `Competencias_${selectedCourse?.grade}_${selectedCourse?.section}_${competencyAvgPeriod}.pdf`
      );
    }
    setShowCompetencyAvgModal(false);
  };

  const openPendingGradesModal = async () => {
    if (!selectedCourseId) return alert('Seleccione un curso');
    setIsLoading(true);
    try {
      const forceYear = selectedYear || '2026-2027';
      const centerId = contextCenter?.id || profile?.center_id;
      if (!centerId) {
        setIsLoading(false);
        return;
      }
      const [stdData, centerData] = await Promise.all([
        dataService.getStudents(selectedCourseId, centerId, forceYear),
        dataService.getCenter(centerId)
      ]);
      const courseSubjects = getCourseSubjects();

      const { data: gData } = await supabase
        .from('student_grades')
        .select('*')
        .eq('course_id', selectedCourseId)
        .eq('school_year', forceYear);
      const loadedMap: any = {};
      if (gData) {
        gData.forEach((g: any) => {
          if (!loadedMap[g.student_id]) loadedMap[g.student_id] = {};
          if (!loadedMap[g.student_id][g.subject_id]) loadedMap[g.student_id][g.subject_id] = {};
          const pL = g.period.toLowerCase();
          if (g.grade !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_${pL}`] = g.grade;
        });
      }
      setPendingGradesData({
        students: stdData || [],
        subjects: courseSubjects,
        gradesMap: loadedMap,
        centerData
      });
      setShowPendingGradesModal(true);
    } catch (e) {
      console.error(e);
      alert('Error cargando datos para el control de digitado');
    } finally {
      setIsLoading(false);
    }
  };

  const generatePendingGradesReport = (format: 'pdf' | 'excel') => {
    if (!pendingGradesData) return;

    const reportData = pendingGradesData.subjects.map((sub: any) => {
      let completedCount = 0;
      let totalExpected = pendingGradesData.students.length * 3; // 3 competencias por alumno

      pendingGradesData.students.forEach((std: any) => {
        const sGrades = pendingGradesData.gradesMap[std.id]?.[sub.id] || {};
        const pL = pendingGradesPeriod.toLowerCase();
        if (sGrades[`c1_${pL}`] !== undefined) completedCount++;
        if (sGrades[`c2_${pL}`] !== undefined) completedCount++;
        if (sGrades[`c3_${pL}`] !== undefined) completedCount++;
      });

      const percent = totalExpected > 0 ? Math.round((completedCount / totalExpected) * 100) : 0;
      const status = percent === 100 ? 'COMPLETADO' : percent === 0 ? 'SIN INICIAR' : 'PENDIENTE';

      const assignments =
        state.assignments?.filter(
          (a) => a.course_id === selectedCourseId && a.subject_id === sub.id
        ) || [];
      const teacherName =
        assignments.length > 0
          ? state.teachers?.find((t) => t.id === assignments[0].teacher_id)?.name || 'NO ASIGNADO'
          : 'NO ASIGNADO';

      return {
        subject: sub.name,
        teacher: teacherName,
        percent,
        status,
        missing: totalExpected - completedCount
      };
    });

    if (format === 'excel') {
      const excelData = reportData.map((r: any) => ({
        Asignatura: r.subject.toUpperCase(),
        Docente: r.teacher,
        'Avance (%)': `${r.percent}%`,
        Estado: r.status,
        'Notas Faltantes': r.missing
      }));
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'ControlDigitado');
      worksheet['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
      XLSX.writeFile(
        workbook,
        `Control_Digitado_${selectedCourse?.grade}_${selectedCourse?.section}_${pendingGradesPeriod}.xlsx`
      );
    } else {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
      const pageWidth = doc.internal.pageSize.width;
      const center = pendingGradesData.centerData || { name: 'CENTRO EDUCATIVO' };

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(center.name.toUpperCase(), pageWidth / 2, 15, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`CONTROL DE DIGITADO DE CALIFICACIONES`, pageWidth / 2, 23, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `CURSO: ${selectedCourse?.level} ${selectedCourse?.grade} ${selectedCourse?.section}  |  PERIODO: ${pendingGradesPeriod}`,
        pageWidth / 2,
        29,
        { align: 'center' }
      );

      const head = [['ASIGNATURA', 'DOCENTE RESPONSABLE', 'AVANCE', 'ESTADO']];
      const body = reportData.map((r: any) => [
        r.subject.toUpperCase(),
        r.teacher,
        `${r.percent}%`,
        r.status
      ]);

      autoTable(doc, {
        startY: 35,
        head: head,
        body: body,
        theme: 'grid',
        styles: { fontSize: 9, valign: 'middle' },
        headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], halign: 'center' },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 60 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', fontStyle: 'bold', cellWidth: 40 }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 3) {
            if (data.cell.text[0] === 'COMPLETADO') data.cell.styles.textColor = [16, 163, 74];
            else if (data.cell.text[0] === 'SIN INICIAR')
              data.cell.styles.textColor = [220, 38, 38];
            else data.cell.styles.textColor = [217, 119, 6];
          }
        }
      });

      doc.save(
        `Control_Digitado_${selectedCourse?.grade}_${selectedCourse?.section}_${pendingGradesPeriod}.pdf`
      );
    }
    setShowPendingGradesModal(false);
  };

  const openRiskModal = async () => {
    if (!selectedCourseId) return alert('Seleccione un curso');
    setIsLoading(true);
    try {
      const forceYear = selectedYear || '2026-2027';
      const centerId = contextCenter?.id || profile?.center_id;
      if (!centerId) {
        setIsLoading(false);
        return;
      }
      const stdData = await dataService.getStudents(selectedCourseId, centerId, forceYear);
      const assignments = state.assignments?.filter((a) => a.course_id === selectedCourseId) || [];
      const courseSubjects = getCourseSubjects();

      const { data: gData } = await supabase
        .from('student_grades')
        .select('*')
        .eq('course_id', selectedCourseId)
        .eq('school_year', forceYear);
      const loadedMap: any = {};
      if (gData) {
        gData.forEach((g: any) => {
          if (!loadedMap[g.student_id]) loadedMap[g.student_id] = {};
          if (!loadedMap[g.student_id][g.subject_id]) loadedMap[g.student_id][g.subject_id] = {};
          const pL = g.period.toLowerCase();
          if (g.grade !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_${pL}`] = g.grade;
          if (g.rp1 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp1`] = g.rp1;
          if (g.rp2 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp2`] = g.rp2;
          if (g.rp3 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp3`] = g.rp3;
          if (g.rp4 !== null)
            loadedMap[g.student_id][g.subject_id][`${g.competency_id}_rp4`] = g.rp4;
          if (g.recovery_grade !== null)
            loadedMap[g.student_id][g.subject_id]['final_rec'] = g.recovery_grade;
        });
      }
      const center = await dataService.getCenter(centerId);
      setRiskData({
        students: stdData || [],
        subjects: courseSubjects,
        gradesMap: loadedMap,
        centerData: center
      });
      setShowRiskModal(true);
    } catch (e) {
      console.error(e);
      alert('Error cargando datos para el reporte de riesgo');
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskReportData = () => {
    if (!riskData) return [];

    return riskData.students
      .map((student: any) => {
        let failedCount = 0;
        let riskCount = 0;
        const subjectGrades: Record<string, any> = {};

        riskData.subjects.forEach((sub: any) => {
          const sGrades = riskData.gradesMap[student.id]?.[sub.id] || {};
          const getBestGrade = (cId: string, p: string) => {
            const pL = p.toLowerCase();
            const g = parseInt(sGrades[`${cId}_${pL}`]) || 0;
            const r = parseInt(sGrades[`${cId}_r${pL}`]) || 0;
            return Math.max(g, r);
          };

          let grade = 0;
          if (riskPeriod === 'FINAL') {
            const getCompFinal = (cId: string) =>
              Math.round(
                (getBestGrade(cId, 'P1') +
                  getBestGrade(cId, 'P2') +
                  getBestGrade(cId, 'P3') +
                  getBestGrade(cId, 'P4')) /
                  4
              );
            let finalArea = Math.round(
              (getCompFinal('c1') + getCompFinal('c2') + getCompFinal('c3')) / 3
            );
            let recFinal = parseInt(sGrades['final_rec']) || 0;
            grade = Math.max(finalArea, recFinal);
          } else {
            grade = Math.round(
              (getBestGrade('c1', riskPeriod) +
                getBestGrade('c2', riskPeriod) +
                getBestGrade('c3', riskPeriod)) /
                3
            );
          }

          subjectGrades[sub.id] = grade;
          if (grade > 0 && grade < 65) failedCount++;
          else if (grade >= 65 && grade <= 75) riskCount++;
        });

        return {
          ...student,
          failedCount,
          riskCount,
          subjectGrades
        };
      })
      .sort((a: any, b: any) => {
        if (b.failedCount !== a.failedCount) return b.failedCount - a.failedCount;
        return b.riskCount - a.riskCount;
      });
  };

  const generateRiskPDF = async () => {
    if (!riskData) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.width;
    const center = riskData.centerData || {
      name: 'CENTRO EDUCATIVO',
      address: '',
      phone: '',
      logo_url: null
    };

    let logoImg: HTMLImageElement | null = null;
    try {
      logoImg = new Image();
      logoImg.src = center.logo_url || '/Edugest2.png';
      await new Promise((resolve, reject) => {
        logoImg!.onload = resolve;
        logoImg!.onerror = reject;
      });
    } catch (e) {
      logoImg = null;
    }

    if (logoImg) doc.addImage(logoImg, 'PNG', 14, 10, 15, 15);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(center.name.toUpperCase(), pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`REPORTE DE RIESGO ACADÉMICO (ASIGNATURAS PENDIENTES)`, pageWidth / 2, 23, {
      align: 'center'
    });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `PERIODO: ${riskPeriod === 'FINAL' ? 'PROMEDIO FINAL' : riskPeriod}   |   CURSO: ${selectedCourse?.level} ${selectedCourse?.grade} ${selectedCourse?.section}`,
      pageWidth / 2,
      29,
      { align: 'center' }
    );

    const reportDataList = getRiskReportData();

    const headers = ['Nº', 'Estudiante'];
    riskData.subjects.forEach((sub: any) => {
      headers.push(sub.name);
    });
    headers.push('Total\nReprobadas');
    headers.push('Total\nEn Proceso');

    const body = reportDataList.map((s: any, idx: number) => {
      const row = [
        (idx + 1).toString(),
        `${s.first_surname || ''} ${s.second_surname || ''}, ${s.names || ''}`.toUpperCase()
      ];
      riskData.subjects.forEach((sub: any) => {
        row.push(s.subjectGrades[sub.id] || '-');
      });
      row.push(s.failedCount.toString());
      row.push(s.riskCount.toString());
      return row;
    });

    const totalCols = headers.length;

    autoTable(doc, {
      startY: 35,
      head: [headers],
      body: body,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        valign: 'middle',
        halign: 'center',
        textColor: [0, 0, 0]
      },
      headStyles: {
        fillColor: [100, 116, 139],
        textColor: [255, 255, 255],
        halign: 'center',
        minCellHeight: 30
      },
      columnStyles: {
        0: { cellWidth: 8, fontStyle: 'bold' },
        1: { halign: 'left', cellWidth: 45 }
      },
      didDrawCell: (data) => {
        if (data.section === 'head' && data.column.index > 1 && data.column.index < totalCols - 2) {
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7);
          const text = headers[data.column.index];
          const shortText = text.length > 20 ? text.substring(0, 18) + '..' : text;
          (doc as any).text(
            shortText,
            data.cell.x + data.cell.width / 2 + 1,
            data.cell.y + data.cell.height - 2,
            { angle: 90 }
          );
        }
      },
      didParseCell: (data) => {
        if (data.section === 'head' && data.column.index > 1 && data.column.index < totalCols - 2) {
          data.cell.text = [];
        }
        if (data.section === 'body') {
          // Total Reprobadas formatting
          if (data.column.index === totalCols - 2) {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.cellWidth = 15;
          }
          // Total En Proceso formatting
          if (data.column.index === totalCols - 1) {
            data.cell.styles.textColor = [161, 98, 7];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.cellWidth = 15;
          }
          // Subject grades coloring
          if (data.column.index > 1 && data.column.index < totalCols - 2) {
            const val = parseInt(data.cell.raw as any);
            if (val > 0 && val < 65) {
              data.cell.styles.fillColor = [254, 226, 226];
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            } else if (val >= 65 && val <= 75) {
              data.cell.styles.fillColor = [254, 249, 195];
              data.cell.styles.textColor = [161, 98, 7];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      }
    });

    doc.save(
      `Riesgo_Academico_${selectedCourse?.grade}_${selectedCourse?.section}_${riskPeriod}.pdf`
    );
    setShowRiskModal(false);
  };

  const generateRiskExcel = () => {
    if (!riskData) return;
    const reportDataList = getRiskReportData();

    const excelData = reportDataList.map((s: any, idx: number) => {
      const row: any = {
        Nº: idx + 1,
        'Nombre del Estudiante':
          `${s.first_surname || ''} ${s.second_surname || ''}, ${s.names || ''}`.toUpperCase()
      };
      riskData.subjects.forEach((sub: any) => {
        row[sub.name] = s.subjectGrades[sub.id] || '-';
      });
      row['Total Reprobadas'] = s.failedCount;
      row['Total En Proceso'] = s.riskCount;
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RiesgoAcademico');

    XLSX.writeFile(
      workbook,
      `Riesgo_Academico_${selectedCourse?.grade}_${selectedCourse?.section}_${riskPeriod}.xlsx`
    );
    setShowRiskModal(false);
  };

  const generateBoletinPDF = async () => {
    if (!boletinData) return;
    const forceYear = selectedYear || '2026-2027';

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.width;

    const center = boletinData.centerData || contextCenter || {
      name: 'CENTRO EDUCATIVO',
      address: '---',
      phone: '---',
      logo_url: null
    };

    let logoImg: HTMLImageElement | null = null;
    try {
      logoImg = new Image();
      logoImg.src = center.logo_url || '/Edugest2.png';
      await new Promise((resolve, reject) => {
        logoImg!.onload = resolve;
        logoImg!.onerror = reject;
      });
    } catch (e) {
      console.warn('No se pudo cargar el logo:', e);
      logoImg = null;
    }

    const studentsToPrint =
      selectedStudentId === 'all'
        ? boletinData.students
        : boletinData.students.filter((s) => s.id === selectedStudentId);

    const getBestGrade = (sGrades: any, cId: string, p: string) => {
      const pL = p.toLowerCase();
      const g = parseInt(sGrades[`${cId}_${pL}`]) || 0;
      const r = parseInt(sGrades[`${cId}_r${pL}`]) || 0;
      return Math.max(g, r);
    };

    const isSecundario = selectedCourse?.level?.toLowerCase().includes('secund');

    studentsToPrint.forEach((student, sIdx) => {
      if (sIdx > 0) doc.addPage();

      if (logoImg) {
        doc.addImage(logoImg, 'PNG', 14, 6, 15, 15); // Logo más pequeño
      }

      // HEADER
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(center.name.toUpperCase(), pageWidth / 2, 10, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${center.address || '---'} | Tel: ${center.phone || '---'}`, pageWidth / 2, 14, {
        align: 'center'
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Boletín de Calificaciones', pageWidth / 2, 22, { align: 'center' });

      // TABLA DATOS DEL ESTUDIANTE
      autoTable(doc, {
        startY: 28,
        body: [
          [
            {
              content: 'ALUMNO',
              rowSpan: 2,
              styles: { fontStyle: 'bold', fillColor: [255, 255, 255] }
            },
            'Nombres',
            'Apellidos',
            'No.',
            'Matrícula',
            'Grado',
            'Sección',
            'Tanda',
            'Año Escolar'
          ],
          [
            student.names || '',
            `${student.first_surname || ''} ${student.second_surname || ''}`.trim(),
            (sIdx + 1).toString(),
            student.id.substring(0, 7).toUpperCase(),
            selectedCourse?.grade,
            selectedCourse?.section,
            'M',
            forceYear
          ]
        ],
        theme: 'grid',
        styles: {
          fontSize: 9,
          halign: 'center',
          valign: 'middle',
          cellPadding: 1,
          textColor: [0, 0, 0]
        }
      });

      const startTableY = (doc as any).lastAutoTable.finalY + 2;

      if (isSecundario) {
        // --- LOGICA SECUNDARIA (34 Columnas) ---
        const mainHeadSecondary: any[] = [
          [
            {
              content: 'DESEMPEÑO INDIVIDUAL DEL/LA ESTUDIANTE',
              colSpan: 34,
              styles: {
                fillColor: [0, 112, 192],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 10
              }
            }
          ],
          [
            {
              content: 'Competencias\nFundamentales',
              rowSpan: 2,
              styles: { fillColor: [173, 216, 230], cellWidth: 32, fontSize: 6.5, halign: 'center', valign: 'middle' }
            },
            {
              content: 'Comunicativa',
              colSpan: 4,
              styles: { fillColor: [173, 216, 230], fontSize: 6.5, halign: 'center' }
            },
            {
              content: 'Pensamiento Lógico, Creativo y Crítico\nResolución de Problemas',
              colSpan: 4,
              styles: { fillColor: [173, 216, 230], fontSize: 6, halign: 'center' }
            },
            {
              content: 'Científica y Tecnológicas\nAmbiental y de la Salud',
              colSpan: 4,
              styles: { fillColor: [173, 216, 230], fontSize: 6, halign: 'center' }
            },
            {
              content: 'Desarrollo Personal y Espiritua\nÉtica y Ciudadania',
              colSpan: 4,
              styles: { fillColor: [173, 216, 230], fontSize: 6, halign: 'center' }
            },
            {
              content: 'Promedio Grupo De\nCompetencias\nEspecíficas',
              colSpan: 4,
              styles: { fillColor: [173, 216, 230], fontSize: 6, halign: 'center' }
            },
            {
              content: '', // Calificación final de Área (Vertical text in didDrawCell)
              rowSpan: 2,
              styles: { fillColor: [173, 216, 230], cellWidth: 6.5 }
            },
            {
              content: 'Calificación Completivo',
              colSpan: 4,
              styles: { fillColor: [173, 216, 230], fontSize: 6, halign: 'center' }
            },
            {
              content: 'Calificación Extraordinaria',
              colSpan: 4,
              styles: { fillColor: [173, 216, 230], fontSize: 6, halign: 'center' }
            },
            {
              content: 'Evaluación\nEspecial',
              colSpan: 2,
              styles: { fillColor: [173, 216, 230], fontSize: 6, halign: 'center' }
            },
            {
              content: 'Situación\nFinal en la\nAsignatura',
              colSpan: 2,
              styles: { fillColor: [173, 216, 230], fontSize: 6, halign: 'center' }
            }
          ],
          [
            // Sub-columnas C1-C4 (16 col)
            { content: 'P1', styles: { fillColor: [240, 240, 240] } },
            { content: 'P2', styles: { fillColor: [240, 240, 240] } },
            { content: 'P3', styles: { fillColor: [240, 240, 240] } },
            { content: 'P4', styles: { fillColor: [240, 240, 240] } },
            { content: 'P1', styles: { fillColor: [240, 240, 240] } },
            { content: 'P2', styles: { fillColor: [240, 240, 240] } },
            { content: 'P3', styles: { fillColor: [240, 240, 240] } },
            { content: 'P4', styles: { fillColor: [240, 240, 240] } },
            { content: 'P1', styles: { fillColor: [240, 240, 240] } },
            { content: 'P2', styles: { fillColor: [240, 240, 240] } },
            { content: 'P3', styles: { fillColor: [240, 240, 240] } },
            { content: 'P4', styles: { fillColor: [240, 240, 240] } },
            { content: 'P1', styles: { fillColor: [240, 240, 240] } },
            { content: 'P2', styles: { fillColor: [240, 240, 240] } },
            { content: 'P3', styles: { fillColor: [240, 240, 240] } },
            { content: 'P4', styles: { fillColor: [240, 240, 240] } },
            // PC1-PC4 (4 col)
            { content: 'PC1', styles: { fillColor: [240, 240, 240] } },
            { content: 'PC2', styles: { fillColor: [240, 240, 240] } },
            { content: 'PC3', styles: { fillColor: [240, 240, 240] } },
            { content: 'PC4', styles: { fillColor: [240, 240, 240] } },
            // Completivo (4 col) - minCellHeight to ensure height for rotated text
            { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
            { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
            { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
            { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
            // Extraordinaria (4 col)
            { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
            { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
            { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
            { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
            // Especial (2 col)
            { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
            { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
            // Situación Final (2 col)
            { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
            { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } }
          ]
        ];

        const bodySecondary: any[] = [];
        let sumC1 = 0,
          sumC2 = 0,
          sumC3 = 0,
          sumC4 = 0,
          sumFinal = 0;
        let count = 0;

        boletinData.subjects.forEach((sub) => {
          const sGrades = boletinData.gradesMap[student.id]?.[sub.id] || {};
          const row: any[] = [{ content: sub.name.toUpperCase(), styles: { halign: 'left' } }];

          // Competencia 1 (Comunicativa) -> database c2
          let p1c1 = getBestGrade(sGrades, 'c2', 'P1');
          row.push(p1c1 || '');
          let p2c1 = getBestGrade(sGrades, 'c2', 'P2');
          row.push(p2c1 || '');
          let p3c1 = getBestGrade(sGrades, 'c2', 'P3');
          row.push(p3c1 || '');
          let p4c1 = getBestGrade(sGrades, 'c2', 'P4');
          row.push(p4c1 || '');

          // Competencia 2 (Pensamiento Lógico...) -> database c3
          let p1c2 = getBestGrade(sGrades, 'c3', 'P1');
          row.push(p1c2 || '');
          let p2c2 = getBestGrade(sGrades, 'c3', 'P2');
          row.push(p2c2 || '');
          let p3c2 = getBestGrade(sGrades, 'c3', 'P3');
          row.push(p3c2 || '');
          let p4c2 = getBestGrade(sGrades, 'c3', 'P4');
          row.push(p4c2 || '');

          // Competencia 3 (Científica...) -> database c4
          let p1c3 = getBestGrade(sGrades, 'c4', 'P1');
          row.push(p1c3 || '');
          let p2c3 = getBestGrade(sGrades, 'c4', 'P2');
          row.push(p2c3 || '');
          let p3c3 = getBestGrade(sGrades, 'c4', 'P3');
          row.push(p3c3 || '');
          let p4c3 = getBestGrade(sGrades, 'c4', 'P4');
          row.push(p4c3 || '');

          // Competencia 4 (Desarrollo Personal...) -> database c1
          let p1c4 = getBestGrade(sGrades, 'c1', 'P1');
          row.push(p1c4 || '');
          let p2c4 = getBestGrade(sGrades, 'c1', 'P2');
          row.push(p2c4 || '');
          let p3c4 = getBestGrade(sGrades, 'c1', 'P3');
          row.push(p3c4 || '');
          let p4c4 = getBestGrade(sGrades, 'c1', 'P4');
          row.push(p4c4 || '');

          const getCompFinalVal = (p1: number, p2: number, p3: number, p4: number) => {
            let s = 0;
            if (periodDivisor >= 1) s += p1;
            if (periodDivisor >= 2) s += p2;
            if (periodDivisor >= 3) s += p3;
            if (periodDivisor >= 4) s += p4;
            return Math.round(s / periodDivisor);
          };

          let fC1 = getCompFinalVal(p1c1, p2c1, p3c1, p4c1);
          let fC2 = getCompFinalVal(p1c2, p2c2, p3c2, p4c2);
          let fC3 = getCompFinalVal(p1c3, p2c3, p3c3, p4c3);
          let fC4 = getCompFinalVal(p1c4, p2c4, p3c4, p4c4);

          // Agregar promedios PC1-PC4
          row.push(fC1 || '');
          row.push(fC2 || '');
          row.push(fC3 || '');
          row.push(fC4 || '');

          // Calificación final de Área (promedio de las 4 competencias)
          let areaFinal = Math.round((fC1 + fC2 + fC3 + fC4) / 4);
          row.push(areaFinal || '');

          // Recuperación de Secundaria
          const cp = parseInt(sGrades['comp']) || 0;
          const ex = parseInt(sGrades['extra']) || 0;
          const e1 = parseInt(sGrades['esp1']) || 0;
          const e2 = parseInt(sGrades['esp2']) || 0;

          // Completivo (50% CF, CEC, 50% CEC, CCF)
          let cp50 = areaFinal < 70 ? Math.round(areaFinal * 0.5) : '';
          let cpExam = cp || '';
          let cpExam50 = cp > 0 ? Math.round(cp * 0.5) : '';
          let ccFinal = cp > 0 ? Math.round(areaFinal * 0.5 + cp * 0.5) : '';

          row.push(cp50);
          row.push(cpExam);
          row.push(cpExam50);
          row.push(ccFinal || '');

          // Extraordinario (30% CF, CEEX, 70% CEEX, CEXF)
          let ex30 = areaFinal < 70 ? Math.round(areaFinal * 0.3) : '';
          let exExam = ex || '';
          let exExam70 = ex > 0 ? Math.round(ex * 0.7) : '';
          let cexFinal = ex > 0 ? Math.round(areaFinal * 0.3 + ex * 0.7) : '';

          row.push(ex30);
          row.push(exExam);
          row.push(exExam70);
          row.push(cexFinal || '');

          // Especial (C.F, C.E)
          let espExam = e1 || e2 || '';
          let defFinal = areaFinal;
          if (areaFinal < 70) {
            if (cp > 0) {
              const cpFinal = Math.round(areaFinal * 0.5 + cp * 0.5);
              if (cpFinal >= 70) defFinal = cpFinal;
            }
            if (defFinal < 70 && ex > 0) {
              const exFinal = Math.round(areaFinal * 0.3 + ex * 0.7);
              if (exFinal >= 70) defFinal = exFinal;
            }
            if (defFinal < 70 && e1 >= 70) {
              defFinal = e1;
            }
            if (defFinal < 70 && e2 >= 70) {
              defFinal = e2;
            }
          }

          let espFinal = (e1 > 0 || e2 > 0) ? defFinal : '';
          row.push(espFinal);
          row.push(espExam);

          // Situación Final (A / R)
          let sitA = defFinal >= 70 ? defFinal : '';
          let sitR = (defFinal > 0 && defFinal < 70) ? defFinal : '';
          row.push(sitA);
          row.push(sitR);

          bodySecondary.push(row);

          if (defFinal > 0) {
            sumC1 += fC1;
            sumC2 += fC2;
            sumC3 += fC3;
            sumC4 += fC4;
            sumFinal += defFinal;
            count++;
          }
        });

        // Fila de Indice
        const idxRow: any[] = [{ content: 'Indice', colSpan: 17, styles: { halign: 'right', fontStyle: 'bold' } }];
        if (count > 0) {
          idxRow.push((sumC1 / count / 25).toFixed(2));
          idxRow.push((sumC2 / count / 25).toFixed(2));
          idxRow.push((sumC3 / count / 25).toFixed(2));
          idxRow.push((sumC4 / count / 25).toFixed(2));
          idxRow.push((sumFinal / count / 25).toFixed(2));
          for (let i = 0; i < 12; i++) {
            idxRow.push('');
          }
        } else {
          idxRow.push('0.00', '0.00', '0.00', '0.00', '0.00');
          for (let i = 0; i < 12; i++) {
            idxRow.push('');
          }
        }
        bodySecondary.push(idxRow);

        autoTable(doc, {
          startY: startTableY,
          head: mainHeadSecondary,
          body: bodySecondary,
          theme: 'grid',
          styles: {
            fontSize: 5.5,
            halign: 'center',
            valign: 'middle',
            cellPadding: 0.5,
            textColor: [0, 0, 0],
            lineWidth: 0.15
          },
          headStyles: { textColor: [0, 0, 0], lineWidth: 0.15, fontSize: 6.5 },
          columnStyles: {
            0: { halign: 'left', cellWidth: 32 }
          },
          didDrawCell: (data) => {
            if (data.section === 'head') {
              if (data.row.index === 1 && data.column.index === 21) {
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(5.5);
                doc.setFont('helvetica', 'bold');
                const x = data.cell.x + data.cell.width / 2 + 1;
                const y = data.cell.y + data.cell.height - 2;
                (doc as any).text('Calificación final de Área', x, y, { angle: 90 });
              } else if (data.row.index === 2) {
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(5.5);
                doc.setFont('helvetica', 'bold');
                let text = '';
                const x = data.cell.x + data.cell.width / 2 + 1;
                const y = data.cell.y + data.cell.height - 2;

                if (data.column.index === 22) text = '50% C.F.';
                else if (data.column.index === 23) text = 'C.E.C';
                else if (data.column.index === 24) text = '50% C.E.C';
                else if (data.column.index === 25) text = 'C.C.F';
                else if (data.column.index === 26) text = '30% C.F.';
                else if (data.column.index === 27) text = 'C.E.EX';
                else if (data.column.index === 28) text = '70% C.E.EX';
                else if (data.column.index === 29) text = 'C.EX.F';
                else if (data.column.index === 30) text = 'C.F';
                else if (data.column.index === 31) text = 'C.E';
                else if (data.column.index === 32) text = 'A';
                else if (data.column.index === 33) text = 'R';

                if (text) {
                  (doc as any).text(text, x, y, { angle: 90 });
                }
              }
            }
          },
          didParseCell: (data) => {
            if (data.section === 'body') {
              if (data.column.index >= 17) {
                data.cell.styles.fillColor = [240, 240, 245];
              }
            }
          }
        });
      } else {
        // --- LOGICA PRIMARIA (18 Columnas - Original) ---
        const mainHeadPrimary: any[] = [
          [
            {
              content: 'DESEMPEÑO INDIVIDUAL DEL/LA ESTUDIANTE',
              colSpan: 18,
              styles: {
                fillColor: [0, 112, 192],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 12
              }
            }
          ],
          [
            {
              content: 'Competencias\nFundamentales',
              rowSpan: 2,
              styles: { fillColor: [173, 216, 230], cellWidth: 40, fontSize: 8 }
            },
            {
              content: 'Comunicativa',
              colSpan: 4,
              styles: { fillColor: [173, 216, 230], fontSize: 8 }
            },
            {
              content:
                'Pensamiento Lógico, Creativo y Crítico\nResolución de Problemas Ciencia y\nTecnología',
              colSpan: 4,
              styles: { fillColor: [173, 216, 230], fontSize: 7 }
            },
            {
              content:
                'Ética y Ciudadana; Desarrollo Personal y\nEspiritual;\nAmbiental y de la Salud',
              colSpan: 4,
              styles: { fillColor: [173, 216, 230], fontSize: 7 }
            },
            {
              content: 'Calificación final\npor Competencia',
              colSpan: 3,
              styles: { fillColor: [173, 216, 230], fontSize: 8 }
            },
            { content: '', rowSpan: 2, styles: { fillColor: [173, 216, 230], cellWidth: 8 } },
            { content: '', rowSpan: 2, styles: { fillColor: [173, 216, 230], cellWidth: 8 } }
          ],
          [
            { content: 'P1', styles: { fillColor: [240, 240, 240] } },
            { content: 'P2', styles: { fillColor: [240, 240, 240] } },
            { content: 'P3', styles: { fillColor: [240, 240, 240] } },
            { content: 'P4', styles: { fillColor: [240, 240, 240] } },
            { content: 'P1', styles: { fillColor: [240, 240, 240] } },
            { content: 'P2', styles: { fillColor: [240, 240, 240] } },
            { content: 'P3', styles: { fillColor: [240, 240, 240] } },
            { content: 'P4', styles: { fillColor: [240, 240, 240] } },
            { content: 'P1', styles: { fillColor: [240, 240, 240] } },
            { content: 'P2', styles: { fillColor: [240, 240, 240] } },
            { content: 'P3', styles: { fillColor: [240, 240, 240] } },
            { content: 'P4', styles: { fillColor: [240, 240, 240] } },
            { content: 'C1', styles: { fillColor: [240, 240, 240] } },
            { content: 'C2', styles: { fillColor: [240, 240, 240] } },
            { content: 'C3', styles: { fillColor: [240, 240, 240] } }
          ]
        ];

        const bodyPrimary: any[] = [];
        let sumC1 = 0,
          sumC2 = 0,
          sumC3 = 0,
          sumFinal = 0;
        let count = 0;

        boletinData.subjects.forEach((sub) => {
          const sGrades = boletinData.gradesMap[student.id]?.[sub.id] || {};
          const row: any[] = [{ content: sub.name.toUpperCase(), styles: { halign: 'left' } }];

          let p1c1 = getBestGrade(sGrades, 'c1', 'P1');
          row.push(p1c1 || '');
          let p2c1 = getBestGrade(sGrades, 'c1', 'P2');
          row.push(p2c1 || '');
          let p3c1 = getBestGrade(sGrades, 'c1', 'P3');
          row.push(p3c1 || '');
          let p4c1 = getBestGrade(sGrades, 'c1', 'P4');
          row.push(p4c1 || '');

          let p1c2 = getBestGrade(sGrades, 'c2', 'P1');
          row.push(p1c2 || '');
          let p2c2 = getBestGrade(sGrades, 'c2', 'P2');
          row.push(p2c2 || '');
          let p3c2 = getBestGrade(sGrades, 'c2', 'P3');
          row.push(p3c2 || '');
          let p4c2 = getBestGrade(sGrades, 'c2', 'P4');
          row.push(p4c2 || '');

          let p1c3 = getBestGrade(sGrades, 'c3', 'P1');
          row.push(p1c3 || '');
          let p2c3 = getBestGrade(sGrades, 'c3', 'P2');
          row.push(p2c3 || '');
          let p3c3 = getBestGrade(sGrades, 'c3', 'P3');
          row.push(p3c3 || '');
          let p4c3 = getBestGrade(sGrades, 'c3', 'P4');
          row.push(p4c3 || '');

          const getCompFinal = (p1: number, p2: number, p3: number, p4: number) => {
            let s = 0;
            if (periodDivisor >= 1) s += p1;
            if (periodDivisor >= 2) s += p2;
            if (periodDivisor >= 3) s += p3;
            if (periodDivisor >= 4) s += p4;
            return Math.round(s / periodDivisor);
          };

          let fC1 = getCompFinal(p1c1, p2c1, p3c1, p4c1);
          row.push(fC1 || '');
          let fC2 = getCompFinal(p1c2, p2c2, p3c2, p4c2);
          row.push(fC2 || '');
          let fC3 = getCompFinal(p1c3, p2c3, p3c3, p4c3);
          row.push(fC3 || '');

          let finalArea = Math.round((fC1 + fC2 + fC3) / 3);
          let recFinal = parseInt(sGrades['final_rec']) || 0;

          row.push(finalArea || '');
          row.push(recFinal || '');

          bodyPrimary.push(row);

          if (finalArea > 0) {
            sumC1 += fC1;
            sumC2 += fC2;
            sumC3 += fC3;
            let bestFinal = Math.max(finalArea, recFinal);
            sumFinal += bestFinal;
            count++;
          }
        });

        const idxRow: any[] = [{ content: 'Indice', colSpan: 13, styles: { halign: 'right', fontStyle: 'bold' } }];
        if (count > 0) {
          idxRow.push((sumC1 / count / 25).toFixed(2));
          idxRow.push((sumC2 / count / 25).toFixed(2));
          idxRow.push((sumC3 / count / 25).toFixed(2));
          idxRow.push((sumFinal / count / 25).toFixed(2));
          idxRow.push('');
        } else {
          idxRow.push('0.00', '0.00', '0.00', '0.00', '');
        }
        bodyPrimary.push(idxRow);

        autoTable(doc, {
          startY: startTableY,
          head: mainHeadPrimary,
          body: bodyPrimary,
          theme: 'grid',
          styles: {
            fontSize: 8,
            halign: 'center',
            valign: 'middle',
            cellPadding: 1,
            textColor: [0, 0, 0],
            lineWidth: 0.2
          },
          headStyles: { textColor: [0, 0, 0], lineWidth: 0.2, fontSize: 8 },
          didDrawCell: (data) => {
            if (
              data.section === 'head' &&
              data.row.index === 1 &&
              (data.column.index === 16 || data.column.index === 17)
            ) {
              doc.setTextColor(0, 0, 0);
              doc.setFontSize(7);

              const lines =
                data.column.index === 16
                  ? ['Calificación', 'Final Área']
                  : ['Calificación', 'Recuperación'];

              (doc as any).text(lines[0], data.cell.x + 3.5, data.cell.y + data.cell.height - 2, {
                angle: 90
              });
              (doc as any).text(lines[1], data.cell.x + 6.5, data.cell.y + data.cell.height - 2, {
                angle: 90
              });
            }
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index >= 13 && data.column.index <= 17) {
              data.cell.styles.fillColor = [240, 240, 245];
            }
          }
        });
      }

      let finalY = (doc as any).lastAutoTable.finalY + 5;

      // --- PANEL INFERIOR (3 Bloques) ---

      // 1. Resumen de Asistencia
      autoTable(doc, {
        startY: finalY,
        margin: { left: 14, right: 190 },
        body: [
          [
            {
              content: 'RESUMEN DE ASISTENCIA DEL ESTUDIANTE',
              colSpan: 5,
              styles: { fillColor: [173, 216, 230], fontStyle: 'bold' }
            }
          ],
          [
            { content: 'Periodos', rowSpan: 2 },
            { content: 'Asistencia', rowSpan: 2 },
            { content: 'Ausencia', rowSpan: 2 },
            { content: '% de Anual', colSpan: 2 }
          ],
          ['Asistencia', 'Ausencia'],
          ['P1', '', '', { content: '', rowSpan: 4 }, { content: '', rowSpan: 4 }],
          ['P2', '', ''],
          ['P3', '', ''],
          ['P4', '', '']
        ],
        theme: 'grid',
        styles: {
          fontSize: 8,
          halign: 'center',
          valign: 'middle',
          cellPadding: 1,
          textColor: [0, 0, 0],
          lineWidth: 0.2
        }
      });

      // 2. Panel Central (Leyenda para Secundaria / Escala Numérica para Primaria)
      if (isSecundario) {
        autoTable(doc, {
          startY: finalY,
          margin: { left: 100, right: 90 },
          body: [
            [
              {
                content: 'LEYENDA',
                colSpan: 2,
                styles: { fillColor: [173, 216, 230], fontStyle: 'bold', halign: 'center' }
              }
            ],
            [{ content: '(P1) / (P2) / (P3) / (P4)', styles: { fontStyle: 'bold', fontSize: 5.5 } }, { content: 'Periodo 1 / Periodo 2 / Periodo 3 / Periodo 4', styles: { fontSize: 5.5 } }],
            [{ content: '(P.C.)', styles: { fontStyle: 'bold', fontSize: 5.5 } }, { content: 'Promedio grupo de competencias específicas', styles: { fontSize: 5.5 } }],
            [{ content: '(C.F.)', styles: { fontStyle: 'bold', fontSize: 5.5 } }, { content: 'Calificación Final', styles: { fontSize: 5.5 } }],
            [{ content: '(C.E.C.) / (C.C.F.)', styles: { fontStyle: 'bold', fontSize: 5.5 } }, { content: 'Calif. Eval. Competencia / Calif. Completiva Final', styles: { fontSize: 5.5 } }],
            [{ content: '(C.E.EX) / (C.EX.F)', styles: { fontStyle: 'bold', fontSize: 5.5 } }, { content: 'Calif. Eval. Extraordinaria / Calif. Extraordinaria Final', styles: { fontSize: 5.5 } }],
            [{ content: '(C.E.) / (A) / (R)', styles: { fontStyle: 'bold', fontSize: 5.5 } }, { content: 'Calificación Especial / Aprobado / Reprobado', styles: { fontSize: 5.5 } }]
          ],
          theme: 'grid',
          styles: {
            fontSize: 5.5,
            halign: 'left',
            valign: 'middle',
            cellPadding: 0.5,
            textColor: [0, 0, 0],
            lineWidth: 0.2
          },
          columnStyles: { 0: { cellWidth: 32, halign: 'center' } }
        });
      } else {
        autoTable(doc, {
          startY: finalY,
          margin: { left: 100, right: 90 },
          body: [
            [
              {
                content: 'Escala\nNumérica',
                styles: { fillColor: [173, 216, 230], fontStyle: 'bold' }
              },
              { content: 'Descripción', styles: { fillColor: [173, 216, 230], fontStyle: 'bold' } }
            ],
            [
              '89-100',
              'Evidencia de que el estudiante ha alcanzado un desempeño destacado con relación a los aspectos evaluados...'
            ],
            [
              '77-88',
              'Evidencia de que el estudiante ha logrado los aprendizajes esperados con relación a los aspectos evaluados...'
            ],
            [
              '65-76',
              'Evidencia de que el estudiante aún se encuentra en proceso con relación a los aspectos evaluados...'
            ],
            [
              'Menos de\n65',
              'Evidencia que el estudiante ha alcanzado un desempeño insuficiente con relación a los aspectos evaluados...'
            ]
          ],
          theme: 'grid',
          styles: {
            fontSize: 7,
            halign: 'center',
            valign: 'middle',
            cellPadding: 1,
            textColor: [0, 0, 0],
            lineWidth: 0.2
          },
          columnStyles: { 1: { halign: 'left' } }
        });
      }

      // 3. Situación y Observaciones
      doc.setDrawColor(0);
      doc.setLineWidth(0.2);
      doc.rect(195, finalY, 70, 36); // Borde exterior

      // Situacion
      doc.setFillColor(173, 216, 230);
      doc.rect(195, finalY, 70, 5, 'FD');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Situación del Estudiante | Promovido/a | Repitente', 197, finalY + 3.5);

      doc.line(195, finalY + 5, 265, finalY + 5);
      doc.line(195, finalY + 10, 265, finalY + 10);

      // Observaciones
      doc.setFontSize(8);
      doc.text('Observaciones', 230, finalY + 14, { align: 'center' });
      doc.line(197, finalY + 20, 263, finalY + 20);
      doc.line(197, finalY + 27, 263, finalY + 27);
      doc.line(197, finalY + 34, 263, finalY + 34);

      // Firmas
      let sigY = finalY + 50;
      doc.setLineWidth(0.2);
      doc.line(180, sigY, 215, sigY);
      doc.line(225, sigY, 265, sigY);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Maestro(a) encargado(a) del grado', 197.5, sigY + 3, { align: 'center' });
      doc.text('Director(a) del centro Educativo', 245, sigY + 3, { align: 'center' });
    });

    const filename =
      selectedStudentId === 'all'
        ? `Boletines_${selectedCourse?.grade}_${selectedCourse?.section}.pdf`
        : `Boletin_${studentsToPrint[0].names}.pdf`;

    doc.save(filename);
    setShowBoletinModal(false);
  };

  return (
    <div className="space-y-6 text-slate-900 pb-20 animate-fade-in">
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Seleccione el Curso
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-3 text-xs font-black uppercase focus:border-indigo-500 outline-none transition-colors cursor-pointer"
            >
              <option value="">-- SELECCIONE EL GRADO --</option>
              {courses.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.level} {c.grade} "{c.section}" - {c.tanda || 'Matutina'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* DASHBOARD DE ANALÍTICAS */}
      {selectedCourseId && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl space-y-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-black uppercase text-slate-800">Dashboard del Curso</h3>
              <p className="text-xs text-slate-500">
                Métricas visuales basadas en las calificaciones actuales.
              </p>
            </div>
            <div className="flex gap-2">
              {['P1', 'P2', 'P3', 'P4', 'FINAL'].map((p) => (
                <button
                  key={p}
                  onClick={() => setAnalyticsPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${analyticsPeriod === p ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {isLoadingAnalytics ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 size={32} className="animate-spin text-indigo-500" />
            </div>
          ) : computedAnalytics && computedAnalytics.subjectAvgs.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
              {/* Rendimiento General */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 h-72 flex flex-col">
                <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest text-center mb-2">
                  Clasificación de Estudiantes
                </h4>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={computedAnalytics.rankingChart}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
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
                        {computedAnalytics.rankingChart.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        wrapperStyle={{ fontSize: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Desempeño por Competencia */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 h-72 flex flex-col">
                <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest text-center mb-2">
                  Desempeño Medio por Competencia
                </h4>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={computedAnalytics.competencyChart}
                      margin={{ top: 20, right: 30, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="fullLabel" tick={{ fontSize: 9, fontWeight: 'bold' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip cursor={{ fill: '#f1f5f9' }} />
                      <Bar
                        dataKey="value"
                        name="Promedio"
                        radius={[6, 6, 0, 0]}
                        label={{
                          position: 'top',
                          fontSize: 12,
                          fontWeight: 'bold',
                          fill: '#6366f1'
                        }}
                      >
                        {computedAnalytics.competencyChart.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={['#6366f1', '#8b5cf6', '#a855f7'][index % 3]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Casos de Riesgo */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 h-72 flex flex-col">
                <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest text-center mb-2">
                  Materias Pendientes por Estudiante
                </h4>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={computedAnalytics.riskChart}
                        outerRadius={80}
                        dataKey="value"
                        stroke="white"
                        strokeWidth={2}
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
                        {computedAnalytics.riskChart.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        wrapperStyle={{ fontSize: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Promedios por Materia */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 h-72 flex flex-col">
                <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest text-center mb-2">
                  Promedio del Curso por Materia
                </h4>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={computedAnalytics.subjectAvgs}
                      margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="subject"
                        tick={{ fontSize: 9 }}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                      />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip cursor={{ fill: '#f1f5f9' }} />
                      <Bar
                        dataKey="average"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                        name="Promedio"
                        label={{ position: 'top', fontSize: 10, fill: '#64748b' }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Tasa de Aprobación Global */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 h-72 flex flex-col">
                <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest text-center mb-2">
                  Estatus General del Curso
                </h4>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={computedAnalytics.approvalChart}
                        innerRadius={50}
                        outerRadius={80}
                        startAngle={180}
                        endAngle={0}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                        cy="70%"
                        label={({ value }) => value}
                        labelLine={false}
                      >
                        {computedAnalytics.approvalChart.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        wrapperStyle={{ fontSize: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Progreso de Digitado */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 h-72 flex flex-col">
                <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest text-center mb-2">
                  Avance de Carga (Digitado)
                </h4>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={computedAnalytics.digitizingChart}
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <YAxis dataKey="subject" type="category" tick={{ fontSize: 8, width: 60 }} />
                      <Tooltip cursor={{ fill: '#f1f5f9' }} />
                      <Bar dataKey="percent" name="Avance %" radius={[0, 4, 4, 0]}>
                        <LabelList
                          dataKey="percent"
                          position="right"
                          style={{ fontSize: '9px', fontWeight: 'bold', fill: '#64748b' }}
                          formatter={(v: any) => `${v}%`}
                        />
                        {computedAnalytics.digitizingChart.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>{' '}
            </div>
          ) : (
            <div className="flex justify-center items-center h-24 text-slate-400 text-sm font-bold">
              No hay suficientes calificaciones registradas en este periodo.
            </div>
          )}
        </div>
      )}

      {selectedCourseId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* ACTA DE CALIFICACIONES */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className="h-32 bg-indigo-600 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
              <FileText size={48} className="text-white relative z-10" />
            </div>
            <div className="p-6 text-center space-y-4">
              <h3 className="text-lg font-black uppercase text-slate-800">
                Acta de Calificaciones
              </h3>
              <p className="text-xs text-slate-500">
                Documento oficial con promedios finales y recuperación final de todas las materias
                del curso.
              </p>
              <button
                onClick={generateActa}
                disabled={isGenerating}
                className="w-full py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Printer size={14} />
                )}{' '}
                Generar Acta
              </button>
            </div>
          </div>

          {/* REGISTRO DE GRADO OFICIAL */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className="h-32 bg-blue-600 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
              <ScrollText size={48} className="text-white relative z-10" />
            </div>
            <div className="p-6 text-center space-y-4">
              <h3 className="text-lg font-black uppercase text-slate-800">
                Registro de Grado Oficial
              </h3>
              <p className="text-xs text-slate-500">
                Libro de calificaciones desglosado por competencias de cada materia, con historial
                de recuperaciones.
              </p>

              {/* Selector de modo: Horizontal con nombres vs Vertical solo números */}
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => setRegistroSoloNumeros(false)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all ${
                    !registroSoloNumeros
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Con Nombres
                </button>
                <button
                  type="button"
                  onClick={() => setRegistroSoloNumeros(true)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all ${
                    registroSoloNumeros
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Solo Números (Vert)
                </button>
              </div>

              <button
                onClick={generateRegistroGrado}
                disabled={isGeneratingRegistro}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                {isGeneratingRegistro ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Printer size={14} />
                )}{' '}
                Generar Registro
              </button>
            </div>
          </div>

          {/* BOLETINES */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className="h-32 bg-emerald-600 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
              <ScrollText size={48} className="text-white relative z-10" />
            </div>
            <div className="p-6 text-center space-y-4">
              <h3 className="text-lg font-black uppercase text-slate-800">
                Boletines de Calificaciones
              </h3>
              <p className="text-xs text-slate-500">
                Reporte detallado por estudiante con las calificaciones por periodo de cada
                competencia.
              </p>
              <button
                onClick={openBoletinModal}
                disabled={isFetchingBoletinData}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                {isFetchingBoletinData ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Printer size={14} />
                )}{' '}
                Configurar Boletines
              </button>
            </div>
          </div>

          {/* RÉCORD ACADÉMICO DETALLADO (EL QUE CREASTE) */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden group hover:-translate-y-1 transition-all duration-300 border-t-4 border-t-indigo-500">
            <div className="h-32 bg-indigo-600 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
              <TrendingUp size={48} className="text-white relative z-10" />
            </div>
            <div className="p-6 text-center space-y-4">
              <div className="flex items-center justify-center gap-2">
                <h3 className="text-lg font-black uppercase text-slate-800">
                  Récord Académico Detallado
                </h3>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[8px] font-black rounded-full uppercase">
                  Nuevo
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Análisis de riesgo, promedios por competencias y materias pendientes con exportación
                PDF.
              </p>
              <button
                onClick={() => setShowCourseRecord(true)}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                <BarChart3 size={14} /> Ver Récord Detallado
              </button>
            </div>
          </div>

          {/* RANKING */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className="h-32 bg-amber-500 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
              <Trophy size={48} className="text-white relative z-10" />
            </div>
            <div className="p-6 text-center space-y-4">
              <h3 className="text-lg font-black uppercase text-slate-800">Índices Académicos</h3>
              <p className="text-xs text-slate-500">
                Listado de los estudiantes del curso ordenados según su índice académico general.
              </p>
              <button
                onClick={openRankingModal}
                disabled={isLoading}
                className="w-full py-3 bg-amber-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-600 transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}{' '}
                Generar Ranking
              </button>
            </div>
          </div>

          {/* PROMEDIOS POR MATERIA */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className="h-32 bg-sky-500 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
              <BarChart3 size={48} className="text-white relative z-10" />
            </div>
            <div className="p-6 text-center space-y-4">
              <h3 className="text-lg font-black uppercase text-slate-800">Promedios por Materia</h3>
              <p className="text-xs text-slate-500">
                Rendimiento global del curso promediando a todos los estudiantes por asignatura.
              </p>
              <button
                onClick={openSubjectAvgModal}
                disabled={isLoading}
                className="w-full py-3 bg-sky-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-sky-600 transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}{' '}
                Generar Reporte
              </button>
            </div>
          </div>

          {/* RIESGO ACADÉMICO */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className="h-32 bg-red-500 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
              <FileText size={48} className="text-white relative z-10" />
            </div>
            <div className="p-6 text-center space-y-4">
              <h3 className="text-lg font-black uppercase text-slate-800">Riesgo Académico</h3>
              <p className="text-xs text-slate-500">
                Matriz de alerta temprana identificando materias reprobadas por estudiante.
              </p>
              <button
                onClick={openRiskModal}
                disabled={isLoading}
                className="w-full py-3 bg-red-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}{' '}
                Configurar Reporte
              </button>
            </div>
          </div>

          {/* EVOLUCIÓN ACADÉMICA */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className="h-32 bg-purple-600 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
              <TrendingUp size={48} className="text-white relative z-10" />
            </div>
            <div className="p-6 text-center space-y-4">
              <h3 className="text-lg font-black uppercase text-slate-800">Evolución Académica</h3>
              <p className="text-xs text-slate-500">
                Comparativa del rendimiento del estudiante a través de los diferentes periodos
                evaluados.
              </p>
              <button
                onClick={openEvolutionModal}
                disabled={isLoading}
                className="w-full py-3 bg-purple-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-purple-700 transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <TrendingUp size={14} />
                )}{' '}
                Configurar Reporte
              </button>
            </div>
          </div>

          {/* DESEMPEÑO POR COMPETENCIAS */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className="h-32 bg-indigo-500 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
              <BarChart3 size={48} className="text-white relative z-10" />
            </div>
            <div className="p-6 text-center space-y-4">
              <h3 className="text-lg font-black uppercase text-slate-800">
                Desempeño por Competencias
              </h3>
              <p className="text-xs text-slate-500">
                Análisis detallado del promedio del curso en cada una de las 3 competencias por
                asignatura.
              </p>
              <button
                onClick={openCompetencyAvgModal}
                disabled={isLoading}
                className="w-full py-3 bg-indigo-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}{' '}
                Configurar Reporte
              </button>
            </div>
          </div>

          {/* CERTIFICACIONES FINALES (6TO PRIMARIA) */}
          {selectedCourse?.level === 'Primario' &&
            (selectedCourse?.grade?.toLowerCase().trim().startsWith('6') ||
              selectedCourse?.grade?.toLowerCase().trim().includes('sexto')) && (
              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden group hover:-translate-y-1 transition-all duration-300 border-t-4 border-t-amber-500">
                <div className="h-32 bg-amber-600 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
                  <ScrollIcon size={48} className="text-white relative z-10" />
                </div>
                <div className="p-6 text-center space-y-4">
                  <h3 className="text-lg font-black uppercase text-slate-800">
                    Certificaciones 6to Primaria
                  </h3>
                  <p className="text-xs text-slate-500">
                    Certificación oficial de conclusión del Nivel Primario para estudiantes de 6to
                    grado.
                  </p>
                  <div className="space-y-2">
                    <select
                      className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold uppercase outline-none"
                      onChange={(e) => setCertStudentId(e.target.value)}
                      value={certStudentId || ''}
                    >
                      <option value="">-- Seleccionar Estudiante --</option>
                      {analyticsData?.students?.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.first_surname} {s.names}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        certStudentId
                          ? setShowCertificateModal(true)
                          : alert('Seleccione un estudiante')
                      }
                      className="w-full py-3 bg-amber-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-700 transition-colors shadow-lg flex items-center justify-center gap-2"
                    >
                      <ScrollIcon size={14} /> Configurar Certificado
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
      )}

      {showBoletinModal && boletinData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 relative">
            <button
              onClick={() => setShowBoletinModal(false)}
              className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 font-black uppercase text-[10px] bg-slate-100 px-3 py-1.5 rounded-lg"
            >
              Cerrar
            </button>

            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
                <ScrollText size={24} />
              </div>
              <h2 className="text-2xl font-black text-slate-900">Configurar Boletines</h2>
            </div>
            <p className="text-xs text-slate-500 mb-8 ml-16">
              Seleccione el estudiante, el periodo actual y si desea calcular los promedios en
              tiempo real.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  1. Estudiante
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-bold uppercase outline-none cursor-pointer"
                >
                  <option value="all">TODOS LOS ESTUDIANTES (LOTE)</option>
                  {boletinData.students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_surname} {s.second_surname}, {s.names}
                    </option>
                  ))}
                </select>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  2. Periodo Actual (Divisor)
                </label>
                <select
                  value={periodDivisor}
                  onChange={(e) => setPeriodDivisor(parseInt(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-bold uppercase outline-none cursor-pointer"
                >
                  <option value={1}>1er Periodo (Promediar ÷ 1)</option>
                  <option value={2}>2do Periodo (Promediar ÷ 2)</option>
                  <option value={3}>3er Periodo (Promediar ÷ 3)</option>
                  <option value={4}>4to Periodo (Promediar ÷ 4)</option>
                </select>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-center">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAverages}
                    onChange={(e) => setShowAverages(e.target.checked)}
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-xs font-black uppercase text-slate-700">
                    Calcular y Mostrar Promedios
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-slate-100">
              <button
                onClick={() => setShowBoletinModal(false)}
                className="px-6 py-3 text-slate-500 font-bold uppercase text-[10px] tracking-widest hover:text-slate-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={generateBoletinPDF}
                className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2"
              >
                <Printer size={16} /> Descargar{' '}
                {selectedStudentId === 'all' ? 'Boletines' : 'Boletín'} (PDF)
              </button>
            </div>
          </div>
        </div>
      )}

      {showRankingModal && rankingData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 relative">
            <button
              onClick={() => setShowRankingModal(false)}
              className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 font-black uppercase text-[10px] bg-slate-100 px-3 py-1.5 rounded-lg"
            >
              Cerrar
            </button>

            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                <BarChart3 size={24} />
              </div>
              <h2 className="text-2xl font-black text-slate-900">Configurar Ranking</h2>
            </div>
            <p className="text-xs text-slate-500 mb-8 ml-16">
              Seleccione el periodo a evaluar y ajuste las escalas de clasificación si es necesario.
            </p>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-6">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                Periodo a Evaluar
              </label>
              <div className="flex gap-2">
                {['P1', 'P2', 'P3', 'P4', 'FINAL'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setRankingPeriod(p)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${rankingPeriod === p ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 mb-6">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                Ajustar Escalas de Clasificación
              </label>
              <div className="space-y-3">
                {rankingScales.map((scale, i) => (
                  <div key={scale.id} className="flex items-center gap-3">
                    <input
                      type="number"
                      value={scale.min}
                      onChange={(e) => {
                        const newScales = [...rankingScales];
                        newScales[i].min = parseInt(e.target.value) || 0;
                        setRankingScales(newScales);
                      }}
                      className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-slate-400 font-bold text-xs">-</span>
                    <input
                      type="number"
                      value={scale.max}
                      onChange={(e) => {
                        const newScales = [...rankingScales];
                        newScales[i].max = parseInt(e.target.value) || 0;
                        setRankingScales(newScales);
                      }}
                      className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-slate-400 font-bold text-xs">=</span>
                    <input
                      type="text"
                      value={scale.label}
                      onChange={(e) => {
                        const newScales = [...rankingScales];
                        newScales[i].label = e.target.value;
                        setRankingScales(newScales);
                      }}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-slate-100">
              <button
                onClick={() => setShowRankingModal(false)}
                className="px-6 py-3 text-slate-500 font-bold uppercase text-[10px] tracking-widest hover:text-slate-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={generateRankingExcel}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2"
              >
                <FileText size={16} /> Excel
              </button>
              <button
                onClick={generateRankingPDF}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2"
              >
                <Printer size={16} /> PDF
              </button>
            </div>
          </div>
        </div>
      )}
      {showSubjectAvgModal && subjectAvgData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-8 relative">
            <button
              onClick={() => setShowSubjectAvgModal(false)}
              className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 font-black uppercase text-[10px] bg-slate-100 px-3 py-1.5 rounded-lg"
            >
              Cerrar
            </button>

            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-sky-100 text-sky-600 rounded-2xl">
                <BarChart3 size={24} />
              </div>
              <h2 className="text-2xl font-black text-slate-900">Promedios por Materia</h2>
            </div>
            <p className="text-xs text-slate-500 mb-8 ml-16">
              Seleccione el periodo para calcular el promedio global del curso por asignatura.
            </p>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-6">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                Periodo a Evaluar
              </label>
              <div className="flex gap-2">
                {['P1', 'P2', 'P3', 'P4', 'FINAL'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setSubjectAvgPeriod(p)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${subjectAvgPeriod === p ? 'bg-sky-500 text-white border-sky-500 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-slate-100">
              <button
                onClick={() => setShowSubjectAvgModal(false)}
                className="px-6 py-3 text-slate-500 font-bold uppercase text-[10px] tracking-widest hover:text-slate-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={generateSubjectAvgExcel}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2"
              >
                <FileText size={16} /> Excel
              </button>
              <button
                onClick={generateSubjectAvgPDF}
                className="px-8 py-3 bg-sky-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-sky-600 transition-all shadow-lg flex items-center gap-2"
              >
                <Printer size={16} /> Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {showRiskModal && riskData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-8 relative">
            <button
              onClick={() => setShowRiskModal(false)}
              className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 font-black uppercase text-[10px] bg-slate-100 px-3 py-1.5 rounded-lg"
            >
              Cerrar
            </button>

            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                <FileText size={24} />
              </div>
              <h2 className="text-2xl font-black text-slate-900">Alerta de Riesgo Académico</h2>
            </div>
            <p className="text-xs text-slate-500 mb-8 ml-16">
              Seleccione el periodo para generar la matriz de materias pendientes (sombreado rojo y
              amarillo).
            </p>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-6">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                Periodo a Evaluar
              </label>
              <div className="flex gap-2">
                {['P1', 'P2', 'P3', 'P4', 'FINAL'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setRiskPeriod(p)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${riskPeriod === p ? 'bg-red-500 text-white border-red-500 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-slate-100">
              <button
                onClick={() => setShowRiskModal(false)}
                className="px-6 py-3 text-slate-500 font-bold uppercase text-[10px] tracking-widest hover:text-slate-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={generateRiskExcel}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2"
              >
                <FileText size={16} /> Excel
              </button>
              <button
                onClick={generateRiskPDF}
                className="px-8 py-3 bg-red-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition-all shadow-lg flex items-center gap-2"
              >
                <Printer size={16} /> Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {showEvolutionModal && evolutionData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 relative">
            <button
              onClick={() => setShowEvolutionModal(false)}
              className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 font-black uppercase text-[10px] bg-slate-100 px-3 py-1.5 rounded-lg"
            >
              Cerrar
            </button>

            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl">
                <TrendingUp size={24} />
              </div>
              <h2 className="text-2xl font-black text-slate-900">Evolución Académica</h2>
            </div>
            <p className="text-xs text-slate-500 mb-8 ml-16">
              El sistema comparará el promedio general de todas las materias del último periodo
              cursado respecto al anterior para calcular la tendencia.
            </p>

            <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-slate-100">
              <button
                onClick={() => setShowEvolutionModal(false)}
                className="px-6 py-3 text-slate-500 font-bold uppercase text-[10px] tracking-widest hover:text-slate-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => generateEvolutionReport('excel')}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2"
              >
                <FileText size={16} /> Excel
              </button>
              <button
                onClick={() => generateEvolutionReport('pdf')}
                className="px-8 py-3 bg-purple-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-purple-700 transition-all shadow-lg flex items-center gap-2"
              >
                <Printer size={16} /> PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompetencyAvgModal && competencyAvgData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-8 relative">
            <button
              onClick={() => setShowCompetencyAvgModal(false)}
              className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 font-black uppercase text-[10px] bg-slate-100 px-3 py-1.5 rounded-lg"
            >
              Cerrar
            </button>

            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                <BarChart3 size={24} />
              </div>
              <h2 className="text-2xl font-black text-slate-900">Desempeño por Competencias</h2>
            </div>
            <p className="text-xs text-slate-500 mb-8 ml-16">
              Seleccione el periodo para desglosar el promedio del curso por competencia en cada
              materia.
            </p>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-6">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                Periodo a Evaluar
              </label>
              <div className="flex gap-2">
                {['P1', 'P2', 'P3', 'P4', 'FINAL'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setCompetencyAvgPeriod(p)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${competencyAvgPeriod === p ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-slate-100">
              <button
                onClick={() => setShowCompetencyAvgModal(false)}
                className="px-6 py-3 text-slate-500 font-bold uppercase text-[10px] tracking-widest hover:text-slate-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => generateCompetencyReport('excel')}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2"
              >
                <FileText size={16} /> Excel
              </button>
              <button
                onClick={() => generateCompetencyReport('pdf')}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2"
              >
                <Printer size={16} /> PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {showPendingGradesModal && pendingGradesData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-8 relative">
            <button
              onClick={() => setShowPendingGradesModal(false)}
              className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 font-black uppercase text-[10px] bg-slate-100 px-3 py-1.5 rounded-lg"
            >
              Cerrar
            </button>

            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
                <BarChart3 size={24} />
              </div>
              <h2 className="text-2xl font-black text-slate-900">Control de Digitado</h2>
            </div>
            <p className="text-xs text-slate-500 mb-8 ml-16">
              Seleccione el periodo para verificar el avance de carga de calificaciones por parte de
              los docentes.
            </p>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-6">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                Periodo a Auditar
              </label>
              <div className="flex gap-2">
                {['P1', 'P2', 'P3', 'P4'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPendingGradesPeriod(p)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${pendingGradesPeriod === p ? 'bg-amber-600 text-white border-amber-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-slate-100">
              <button
                onClick={() => setShowPendingGradesModal(false)}
                className="px-6 py-3 text-slate-500 font-bold uppercase text-[10px] tracking-widest hover:text-slate-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => generatePendingGradesReport('excel')}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2"
              >
                <FileText size={16} /> Excel
              </button>
              <button
                onClick={() => generatePendingGradesReport('pdf')}
                className="px-8 py-3 bg-amber-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-700 transition-all shadow-lg flex items-center gap-2"
              >
                <Printer size={16} /> PDF
              </button>
            </div>
          </div>
        </div>
      )}
      {showCourseRecord && (
        <CourseRecordReport
          onClose={() => setShowCourseRecord(false)}
          period={analyticsPeriod}
          initialCourseId={selectedCourseId}
        />
      )}
      {showCertificateModal && certStudentId && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="w-full max-w-5xl">
            <PrimaryCertificate
              studentId={certStudentId}
              onClose={() => setShowCertificateModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
