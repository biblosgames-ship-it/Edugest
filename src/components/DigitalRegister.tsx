/** VERSION 41.0 - FIX TOTAL DE REFERENCIAS (config.periods) **/
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  Save,
  CheckCircle2,
  Loader2,
  BarChart3,
  Edit3,
  AlertCircle,
  Calendar,
  Printer,
  FileText,
  X,
  ScrollText
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useGrades } from '../hooks/useGrades';
import { useStudents } from '../hooks/useStudents';
import { useCourses } from '../hooks/useCourses';
import { useSubjects } from '../hooks/useSubjects';
import { useAssignments } from '../hooks/useAssignments';

export const DigitalRegister = ({ onViewChange }: { onViewChange?: (view: string) => void }) => {
  const { state, profile, selectedYear, center } = useApp();

  const currentTeacherRecord = useMemo(() => {
    if (
      (profile?.role === 'teacher' || profile?.role === 'management_teacher') &&
      profile?.teacher_id
    ) {
      return (state.teachers || []).find((t: any) => t.id === profile.teacher_id);
    }
    return null;
  }, [profile, state.teachers]);

  const isEditable = useMemo(() => {
    if (profile?.role !== 'teacher' && profile?.role !== 'management_teacher') return true;
    if (currentTeacherRecord) {
      return currentTeacherRecord.grades_editable !== false;
    }
    return true;
  }, [profile, currentTeacherRecord]);
  const { courses: allCourses } = useCourses();
  const { subjects: allSubjects } = useSubjects();
  const { assignments: allAssignments } = useAssignments();
  const { students: allStudents, isLoading: studentsLoading } = useStudents();

  const [selectedLevel, setSelectedLevel] = useState<string>('Todos');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'grades' | 'results'>('grades');
  const {
    grades: loadedGrades,
    isLoading: gradesLoading,
    isSaving,
    saveGrades,
    saveStatus
  } = useGrades(selectedCourseId, selectedSubjectId);
  const [localGrades, setLocalGrades] = useState<Record<string, any>>({});
  const [showSaveStatus, setShowSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Estados para el resumen de notas consolidado (Boletín del alumno)
  const [selectedSummaryStudent, setSelectedSummaryStudent] = useState<any | null>(null);
  const [studentSummaryGrades, setStudentSummaryGrades] = useState<
    Record<string, Record<string, any>>
  >({});
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);
  const [summaryPeriodDivisor, setSummaryPeriodDivisor] = useState<number>(4);

  const levels = ['Todos', 'Inicial', 'Primario', 'Secundario'];

  const selectedCourse = (allCourses || []).find((c: any) => c.id === selectedCourseId);
  const selectedSubject = (allSubjects || []).find((s: any) => s.id === selectedSubjectId);

  const isSecundario = useMemo(() => {
    return selectedCourse?.level?.toLowerCase().includes('secund');
  }, [selectedCourse]);

  const config = useMemo(
    () => ({
      year: selectedYear || '2025-2026',
      periods: ['P1', 'P2', 'P3', 'P4'],
      competencies: isSecundario
        ? [
            {
              id: 'c1',
              short: 'C1',
              name: 'Competencia Ética y Ciudadana',
              color: 'bg-indigo-100/40',
              rColor: 'bg-indigo-50/20'
            },
            {
              id: 'c2',
              short: 'C2',
              name: 'Competencia Comunicativa',
              color: 'bg-emerald-100/40',
              rColor: 'bg-emerald-50/20'
            },
            {
              id: 'c3',
              short: 'C3',
              name: 'Competencia de Pensamiento Lógico, Creativo y Crítico',
              color: 'bg-amber-100/40',
              rColor: 'bg-amber-50/20'
            },
            {
              id: 'c4',
              short: 'C4',
              name: 'Competencia Científica y Tecnológica',
              color: 'bg-rose-100/40',
              rColor: 'bg-rose-50/20'
            }
          ]
        : [
            {
              id: 'c1',
              short: 'C1',
              name: 'Comunicativa',
              color: 'bg-indigo-100/40',
              rColor: 'bg-indigo-50/20'
            },
            {
              id: 'c2',
              short: 'C2',
              name: 'Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica',
              color: 'bg-emerald-100/40',
              rColor: 'bg-emerald-50/20'
            },
            {
              id: 'c3',
              short: 'C3',
              name: 'Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud',
              color: 'bg-amber-100/40',
              rColor: 'bg-emerald-50/20'
            }
          ]
    }),
    [selectedYear, isSecundario]
  );

  const filteredCourses = useMemo(() => {
    let baseCourses = allCourses || [];

    // Si el rol es docente y tiene un docente vinculado, filtrar solo sus cursos asignados
    if (profile?.role === 'teacher' && profile?.teacher_id) {
      const assignedCourseIds = new Set(
        (allAssignments || [])
          .filter((a: any) => (a.teacher_id || a.teacherId) === profile.teacher_id)
          .map((a: any) => a.course_id || a.courseId)
      );
      baseCourses = baseCourses.filter((c: any) => assignedCourseIds.has(c.id));
    }

    return baseCourses.filter(
      (c: any) =>
        selectedLevel === 'Todos' ||
        (c.level && c.level.toLowerCase().includes(selectedLevel.toLowerCase().substring(0, 5)))
    );
  }, [allCourses, selectedLevel, profile, allAssignments]);

  const courseSubjects = useMemo(() => {
    if (!selectedCourseId) return [];

    // Si el rol es docente y tiene un docente vinculado, filtrar solo sus asignaturas asignadas en este curso
    if (profile?.role === 'teacher' && profile?.teacher_id) {
      return (allAssignments || [])
        .filter(
          (a: any) =>
            (a.teacher_id || a.teacherId) === profile.teacher_id &&
            (a.course_id || a.courseId) === selectedCourseId
        )
        .map((a: any) =>
          (allSubjects || []).find((s: any) => s.id === (a.subject_id || a.subjectId))
        )
        .filter(Boolean);
    }

    let subs = (allAssignments || [])
      .filter((a: any) => a.course_id === selectedCourseId)
      .map((a: any) => (allSubjects || []).find((s: any) => s.id === a.subject_id))
      .filter(Boolean);
    if (subs.length === 0 && selectedCourse) {
      const cLvl = (selectedCourse.level || '').toLowerCase();
      subs = (allSubjects || []).filter((s: any) =>
        (s.level || '').toLowerCase().includes(cLvl.substring(0, 5))
      );
    }
    if (subs.length === 0) subs = allSubjects || [];
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
  }, [selectedCourseId, allAssignments, allSubjects, selectedCourse, profile]);

  const allCourseSubjects = useMemo(() => {
    if (!selectedCourseId) return [];
    let subs = (allAssignments || [])
      .filter((a: any) => a.course_id === selectedCourseId)
      .map((a: any) => (allSubjects || []).find((s: any) => s.id === a.subject_id))
      .filter(Boolean);
    if (subs.length === 0 && selectedCourse) {
      const cLvl = (selectedCourse.level || '').toLowerCase();
      subs = (allSubjects || []).filter((s: any) =>
        (s.level || '').toLowerCase().includes(cLvl.substring(0, 5))
      );
    }
    if (subs.length === 0) subs = allSubjects || [];
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
  }, [selectedCourseId, allAssignments, allSubjects, selectedCourse]);

  const students = useMemo(() => {
    if (!selectedCourseId) return [];
    return (allStudents || []).filter((s) => s.course_id === selectedCourseId);
  }, [allStudents, selectedCourseId]);

  // Sincronizar notas de la caché al estado local para edición
  useEffect(() => {
    setLocalGrades(loadedGrades);
  }, [loadedGrades]);

  const grades = localGrades;

  const handleGradeChange = (studentId: string, key: string, value: string) => {
    if (value !== '') {
      if (!/^\d+$/.test(value)) return;
      if (parseInt(value) > 100) return;
    }
    setLocalGrades((prev) => ({ ...prev, [`${studentId}_${key}`]: value }));
  };

  const getBestGrade = (studentId: string, cId: string, p: string) => {
    const pL = p.toLowerCase();
    const g = parseInt(grades[`${studentId}_${cId}_${pL}`]) || 0;
    const r = parseInt(grades[`${studentId}_${cId}_r${pL}`]) || 0;
    return Math.max(g, r);
  };

  const calculateCompAvg = (studentId: string, cId: string) => {
    const sum = config.periods.reduce((acc, p) => acc + getBestGrade(studentId, cId, p), 0);
    return sum > 0 ? sum / 4 : 0;
  };

  const calculateAreaFinal = (studentId: string) => {
    const compSum = config.competencies.reduce(
      (acc, c) => acc + calculateCompAvg(studentId, c.id),
      0
    );
    const avg = compSum > 0 ? compSum / config.competencies.length : 0;
    return avg > 0 ? Math.round(avg) : '-';
  };

  const save = async () => {
    if (!selectedCourseId || !selectedSubjectId || isSaving) return;
    try {
      const updates = [];
      const cid = profile?.center_id || '29bd105f-af7f-48b1-a9e9-a76ddf1e9ab1';
      for (const student of students) {
        for (const p of config.periods) {
          const pL = p.toLowerCase();
          config.competencies.forEach((c) => {
            const val = grades[`${student.id}_${c.id}_${pL}`];
            const rVal = grades[`${student.id}_${c.id}_r${pL}`];

            if (val !== undefined || rVal !== undefined) {
              const gradeVal = val !== '' && val !== undefined ? parseInt(val) : null;
              const recVal = rVal !== '' && rVal !== undefined ? parseInt(rVal) : null;

              updates.push({
                student_id: student.id,
                course_id: selectedCourseId,
                subject_id: selectedSubjectId,
                period: p,
                competency_id: c.id,
                grade: gradeVal,
                rp1: p === 'P1' ? recVal : null,
                rp2: p === 'P2' ? recVal : null,
                rp3: p === 'P3' ? recVal : null,
                rp4: p === 'P4' ? recVal : null,
                center_id: cid,
                school_year: config.year
              });
            }
          });
        }
        // Guardar Recuperaciones de Secundaria
        if (isSecundario) {
          ['comp', 'extra', 'esp1', 'esp2'].forEach((stage) => {
            const val = grades[`${student.id}_${stage}`];
            if (val !== undefined) {
              updates.push({
                student_id: student.id,
                course_id: selectedCourseId,
                subject_id: selectedSubjectId,
                period: stage.toUpperCase(),
                competency_id: 'sec',
                grade: val !== '' ? parseInt(val) : null,
                center_id: cid,
                school_year: config.year
              });
            }
          });
        }

        const fRec = grades[`${student.id}_final_rec`];
        if (fRec !== undefined) {
          updates.push({
            student_id: student.id,
            course_id: selectedCourseId,
            subject_id: selectedSubjectId,
            period: 'FINAL',
            competency_id: 'rec',
            grade: null,
            recovery_grade: fRec !== '' && fRec !== undefined ? parseInt(fRec) : null,
            center_id: cid,
            school_year: config.year
          });
        }
      }
      if (updates.length > 0) {
        await saveGrades(updates);
      }
      setShowSaveStatus('success');
      setTimeout(() => setShowSaveStatus('idle'), 3000);
    } catch (e) {
      console.error('Error saving grades:', e);
      setShowSaveStatus('error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, studentIdx: number, key: string) => {
    if (e.key === 'Enter') {
      const nextIdx = studentIdx + 1;
      if (nextIdx < students.length) {
        const nextKey = `${students[nextIdx].id}_${key}`;
        inputRefs.current[nextKey]?.focus();
        inputRefs.current[nextKey]?.select();
      }
    }
  };

  const printGradesPDF = () => {
    if (!selectedCourse || !selectedSubject) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' });
    const pageWidth = doc.internal.pageSize.width;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('SÁBANA DE CALIFICACIONES Y RESULTADOS FINALES', pageWidth / 2, 12, {
      align: 'center'
    });

    doc.setFontSize(9);
    doc.text(
      `AÑO ESCOLAR: ${config.year}   |   CURSO: ${selectedCourse.level} ${selectedCourse.grade} ${selectedCourse.section}   |   ASIGNATURA: ${selectedSubject.name}`,
      pageWidth / 2,
      18,
      { align: 'center' }
    );

    const head = [];
    const headerRow1: any[] = [
      { content: 'Nº', rowSpan: 2 },
      { content: 'ESTUDIANTE', rowSpan: 2 }
    ];

    const grayScales = [
      [220, 220, 220],
      [190, 190, 190],
      [160, 160, 160],
      [130, 130, 130]
    ];

    config.competencies.forEach((c, i) => {
      headerRow1.push({
        content: c.name.length > 30 ? c.short : c.name,
        colSpan: config.periods.length * 2,
        styles: {
          halign: 'center',
          fillColor: grayScales[i % grayScales.length],
          textColor: [0, 0, 0]
        }
      });
    });

    headerRow1.push({
      content: 'RESULTADOS FINALES',
      colSpan: config.competencies.length + 2,
      styles: { halign: 'center', fillColor: [30, 30, 30], textColor: [255, 255, 255] }
    });

    const headerRow2: any[] = [];
    config.competencies.forEach((c, i) => {
      config.periods.forEach((p) => {
        headerRow2.push({
          content: p,
          styles: {
            halign: 'center',
            fillColor: grayScales[i % grayScales.length],
            textColor: [0, 0, 0]
          }
        });
        headerRow2.push({
          content: 'R',
          styles: {
            halign: 'center',
            fillColor: grayScales[i % grayScales.length],
            textColor: [100, 100, 100]
          }
        });
      });
    });

    config.competencies.forEach((c) => {
      headerRow2.push({
        content: c.short,
        styles: { halign: 'center', fillColor: [70, 70, 70], textColor: [255, 255, 255] }
      });
    });
    headerRow2.push({
      content: 'FINAL',
      styles: { halign: 'center', fillColor: [15, 23, 42], textColor: [255, 255, 255] }
    });
    headerRow2.push({
      content: 'REC',
      styles: { halign: 'center', fillColor: [150, 0, 0], textColor: [255, 255, 255] }
    });

    head.push(headerRow1);
    head.push(headerRow2);

    const body = students.map((s, idx) => {
      const row: any[] = [
        (idx + 1).toString().padStart(2, '0'),
        `${s.first_surname} ${s.names}`.toUpperCase()
      ];

      config.competencies.forEach((c) => {
        config.periods.forEach((p) => {
          const pL = p.toLowerCase();
          row.push(grades[`${s.id}_${c.id}_${pL}`] || '');
          row.push(grades[`${s.id}_${c.id}_r${pL}`] || '');
        });
      });

      config.competencies.forEach((c) => {
        row.push(calculateCompAvg(s.id, c.id).toFixed(1));
      });
      row.push(calculateAreaFinal(s.id).toString());
      row.push(grades[`${s.id}_final_rec`] || '');

      return row;
    });

    autoTable(doc, {
      startY: 22,
      head: head,
      body: body,
      theme: 'grid',
      styles: { fontSize: 6, cellPadding: 0.8, halign: 'center', valign: 'middle' },
      columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 1: { halign: 'left', cellWidth: 45 } },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index > 1) {
          let colIdx = data.column.index - 2;
          const colsPerComp = config.periods.length * 2;

          if (colIdx < config.competencies.length * colsPerComp) {
            const compIdx = Math.floor(colIdx / colsPerComp);
            const g = 250 - compIdx * 8;
            data.cell.styles.fillColor = [g, g, g];
          } else {
            colIdx -= config.competencies.length * colsPerComp;
            if (colIdx < config.competencies.length) {
              data.cell.styles.fillColor = [240, 240, 250];
              data.cell.styles.fontStyle = 'bold';
            } else if (colIdx === config.competencies.length) {
              data.cell.styles.fillColor = [220, 220, 245];
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.fillColor = [255, 240, 240];
              data.cell.styles.textColor = [200, 0, 0];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      }
    });

    doc.save(
      `Sábana_${selectedCourse.grade}${selectedCourse.section}_${selectedSubject.name.replace(/ /g, '')}.pdf`
    );
  };

  const fetchStudentConsolidatedGrades = async (student: any) => {
    if (!student) return;
    setSelectedSummaryStudent(student);
    setIsLoadingSummary(true);
    setIsSummaryModalOpen(true);
    try {
      const forceYear = '2025-2026';

      // Cargar familiares del estudiante para obtener nombres de padre/madre
      const { data: fData } = await supabase
        .from('parents')
        .select('*')
        .eq('student_id', student.id);

      setSelectedSummaryStudent({ ...student, family: fData || [] });

      const { data: gData, error: gError } = await supabase
        .from('student_grades')
        .select('*')
        .eq('student_id', student.id)
        .eq('school_year', forceYear);

      if (gError) throw gError;

      const map: Record<string, Record<string, any>> = {};
      if (gData) {
        gData.forEach((g) => {
          if (!map[g.subject_id]) map[g.subject_id] = {};
          const sGrades = map[g.subject_id];
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
      setStudentSummaryGrades(map);
    } catch (error) {
      console.error('Error al obtener el resumen de calificaciones:', error);
      alert('Error al obtener el resumen de calificaciones.');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const downloadSingleBoletinPDF = async (student: any) => {
    if (!student) return;
    const forceYear = '2025-2026';

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.width;

    const centerData = center || {
      name: 'CENTRO EDUCATIVO CRISTIANO GENESIS',
      address: 'Calle Respaldo Duarte #11, Los Alcarrizos',
      phone: '809-560-1234',
      logo_url: null
    };

    let logoImg: HTMLImageElement | null = null;
    try {
      logoImg = new Image();
      logoImg.src = centerData.logo_url || '/Edugest2.png';
      await new Promise((resolve, reject) => {
        logoImg!.onload = resolve;
        logoImg!.onerror = reject;
      });
    } catch (e) {
      console.warn('No se pudo cargar el logo:', e);
      logoImg = null;
    }

    const getBestGradeForPDF = (sGrades: any, cId: string, p: string) => {
      const pL = p.toLowerCase();
      const g = parseInt(sGrades[`${cId}_${pL}`]) || 0;
      const r = parseInt(sGrades[`${cId}_r${pL}`]) || 0;
      return Math.max(g, r);
    };

    if (logoImg) {
      doc.addImage(logoImg, 'PNG', 14, 6, 15, 15);
    }

    // HEADER
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(centerData.name.toUpperCase(), pageWidth / 2, 10, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${centerData.address || '---'} | Tel: ${centerData.phone || '---'}`,
      pageWidth / 2,
      14,
      {
        align: 'center'
      }
    );

    // Título del reporte
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('BOLETÍN DE CALIFICACIONES CONSOLIDADO', pageWidth / 2, 20, { align: 'center' });

    // Cargar familiares si no existen
    let family = student.family;
    if (!family || family.length === 0) {
      try {
        const { data: fData } = await supabase
          .from('parents')
          .select('*')
          .eq('student_id', student.id);
        family = fData || [];
      } catch (e) {
        family = [];
      }
    }

    let parentsName = 'No registrado';
    if (family && family.length > 0) {
      const parents = family.filter(
        (f: any) =>
          (f.relation || f.role)?.toLowerCase().includes('madre') ||
          (f.relation || f.role)?.toLowerCase().includes('padre')
      );
      if (parents.length > 0) {
        parentsName = parents.map((p: any) => p.name).join(' y ');
      } else {
        parentsName = family[0].name;
      }
    }

    const studentCourse = (allCourses || []).find((c: any) => c.id === student.course_id);
    const isStudentSecundario = studentCourse?.level?.toLowerCase().includes('secund');

    const courseDisplay = studentCourse
      ? `${studentCourse.grade} - ${studentCourse.section}`
      : '---';
    const levelDisplay = studentCourse?.level || '---';
    const studentCode =
      student.sigerd_code ||
      student.student_code ||
      student.rne ||
      student.id.substring(0, 7).toUpperCase();

    const studentIndex = (students || []).findIndex((s: any) => s.id === student.id);
    const orderNo = studentIndex !== -1 ? (studentIndex + 1).toString().padStart(2, '0') : '--';

    // CAJA DE DATOS ESTRUCTURADA
    const boxY = 24;
    const boxHeight = 16;
    doc.setDrawColor(220, 225, 230);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, boxY, pageWidth - 28, boxHeight, 3, 3, 'FD');

    // Fila 1 - Estudiante
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 110, 120);
    doc.text('ESTUDIANTE:', 18, boxY + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `${student.names || ''} ${student.first_surname || ''} ${student.second_surname || ''}`
        .trim()
        .toUpperCase(),
      42,
      boxY + 5.5
    );

    // Fila 1 - Orden
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 110, 120);
    doc.text('Nº DE ORDEN:', 150, boxY + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(orderNo, 175, boxY + 5.5);

    // Fila 1 - Año Escolar
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 110, 120);
    doc.text('AÑO ESCOLAR:', 210, boxY + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(forceYear, 235, boxY + 5.5);

    // Fila 2 - Grado / Nivel
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 110, 120);
    doc.text('GRADO / NIVEL:', 18, boxY + 11.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`${courseDisplay} (${levelDisplay})`, 44, boxY + 11.5);

    // Fila 2 - Código
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 110, 120);
    doc.text('CÓDIGO SIGERD:', 130, boxY + 11.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(studentCode, 158, boxY + 11.5);

    // Fila 2 - Padres o Tutor
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 110, 120);
    doc.text('PADRES / TUTOR:', 200, boxY + 11.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const truncateParents =
      parentsName.length > 30 ? parentsName.substring(0, 27) + '...' : parentsName;
    doc.text(truncateParents.toUpperCase(), 228, boxY + 11.5);

    const mainTableStartY = boxY + boxHeight + 4;

    const comps = isStudentSecundario
      ? [
          { id: 'c1', short: 'C1', name: 'Ética y Ciudadana' },
          { id: 'c2', short: 'C2', name: 'Comunicativa' },
          { id: 'c3', short: 'C3', name: 'Pensamiento Crítico' },
          { id: 'c4', short: 'C4', name: 'Científica y Tec.' }
        ]
      : [
          { id: 'c1', short: 'C1', name: 'Comunicativa' },
          { id: 'c2', short: 'C2', name: 'Pensamiento Lógico' },
          { id: 'c3', short: 'C3', name: 'Ética y Ciudadana' }
        ];

    // TABLA PRINCIPAL (Dynamic Columns)
    const mainHead: any[] = [
      [
        {
          content: 'DESEMPEÑO INDIVIDUAL DEL/LA ESTUDIANTE',
          colSpan: 1 + comps.length * 4 + comps.length + (isStudentSecundario ? 5 : 2),
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
          styles: { fillColor: [173, 216, 230], cellWidth: 35, fontSize: 7 }
        }
      ]
    ];

    comps.forEach((c) => {
      mainHead[1].push({
        content: c.name,
        colSpan: 4,
        styles: { fillColor: [173, 216, 230], fontSize: 7 }
      });
    });

    mainHead[1].push({
      content: 'Calificación final\npor Competencia',
      colSpan: comps.length,
      styles: { fillColor: [173, 216, 230], fontSize: 7 }
    });

    if (isStudentSecundario) {
      mainHead[1].push(
        { content: '', rowSpan: 2, styles: { fillColor: [173, 216, 230], cellWidth: 8 } },
        { content: '', rowSpan: 2, styles: { fillColor: [173, 216, 230], cellWidth: 8 } },
        { content: '', rowSpan: 2, styles: { fillColor: [173, 216, 230], cellWidth: 8 } },
        { content: '', rowSpan: 2, styles: { fillColor: [173, 216, 230], cellWidth: 8 } },
        { content: '', rowSpan: 2, styles: { fillColor: [173, 216, 230], cellWidth: 8 } }
      );
    } else {
      mainHead[1].push(
        { content: '', rowSpan: 2, styles: { fillColor: [173, 216, 230], cellWidth: 8 } },
        { content: '', rowSpan: 2, styles: { fillColor: [173, 216, 230], cellWidth: 8 } }
      );
    }

    const headerRow3: any[] = [];
    comps.forEach(() => {
      headerRow3.push(
        { content: 'P1', styles: { fillColor: [240, 240, 240] } },
        { content: 'P2', styles: { fillColor: [240, 240, 240] } },
        { content: 'P3', styles: { fillColor: [240, 240, 240] } },
        { content: 'P4', styles: { fillColor: [240, 240, 240] } }
      );
    });
    comps.forEach((c) => {
      headerRow3.push({
        content: c.short,
        styles: { fillColor: [240, 240, 240] }
      });
    });

    mainHead.push(headerRow3);

    const body: any[] = [];
    let sumC1 = 0,
      sumC2 = 0,
      sumC3 = 0,
      sumC4 = 0,
      sumFinal = 0;
    let count = 0;

    allCourseSubjects.forEach((sub) => {
      const sGrades = studentSummaryGrades[sub.id] || {};
      const row: any[] = [{ content: sub.name.toUpperCase(), styles: { halign: 'left' } }];

      comps.forEach((c) => {
        config.periods.forEach((p) => {
          row.push(getBestGradeForPDF(sGrades, c.id, p) || '');
        });
      });

      const getCompFinalVal = (cId: string) => {
        let sum = 0;
        config.periods.forEach((p, idx) => {
          if (summaryPeriodDivisor > idx) {
            sum += getBestGradeForPDF(sGrades, cId, p);
          }
        });
        return Math.round(sum / summaryPeriodDivisor);
      };

      const cfValues = comps.map((c) => getCompFinalVal(c.id));
      cfValues.forEach((val) => {
        row.push(val || '');
      });

      const finalArea =
        cfValues.length > 0 ? Math.round(cfValues.reduce((a, b) => a + b, 0) / cfValues.length) : 0;
      row.push(finalArea || '');

      if (isStudentSecundario) {
        const cp = parseInt(sGrades['comp']) || 0;
        const ex = parseInt(sGrades['extra']) || 0;
        const e1 = parseInt(sGrades['esp1']) || 0;
        const e2 = parseInt(sGrades['esp2']) || 0;

        row.push(cp || '');
        row.push(ex || '');
        row.push(e1 || '');
        row.push(e2 || '');

        let defFinal = finalArea;
        if (finalArea < 70) {
          if (cp > 0) {
            const cpFinal = Math.round(finalArea * 0.5 + cp * 0.5);
            if (cpFinal >= 70) defFinal = cpFinal;
          }
          if (defFinal < 70 && ex > 0) {
            const exFinal = Math.round(finalArea * 0.3 + ex * 0.7);
            if (exFinal >= 70) defFinal = exFinal;
          }
          if (defFinal < 70 && e1 >= 70) {
            defFinal = e1;
          }
          if (defFinal < 70 && e2 >= 70) {
            defFinal = e2;
          }
        }
        row.push(defFinal || '');

        if (defFinal > 0) {
          sumFinal += defFinal;
          count++;
        }
      } else {
        const recFinal = parseInt(sGrades['final_rec']) || 0;
        row.push(recFinal || '');

        const defFinal = Math.max(finalArea, recFinal);
        row.push(defFinal || '');

        if (defFinal > 0) {
          sumFinal += defFinal;
          count++;
        }
      }

      body.push(row);

      if (finalArea > 0) {
        sumC1 += cfValues[0] || 0;
        sumC2 += cfValues[1] || 0;
        sumC3 += cfValues[2] || 0;
        if (isStudentSecundario) {
          sumC4 += cfValues[3] || 0;
        }
      }
    });

    const idxRow: any[] = [{ content: '', colSpan: 1 + comps.length * 4, styles: { border: 0 } }];
    if (count > 0) {
      idxRow.push((sumC1 / count / 25).toFixed(2));
      idxRow.push((sumC2 / count / 25).toFixed(2));
      idxRow.push((sumC3 / count / 25).toFixed(2));
      if (isStudentSecundario) {
        idxRow.push((sumC4 / count / 25).toFixed(2));
      }
      idxRow.push((sumFinal / count / 25).toFixed(2));
      const remainingCols = isStudentSecundario ? 5 : 2;
      for (let i = 0; i < remainingCols - 1; i++) {
        idxRow.push('');
      }
    } else {
      comps.forEach(() => idxRow.push('0.00'));
      idxRow.push('0.00');
      const remainingCols = isStudentSecundario ? 5 : 2;
      for (let i = 0; i < remainingCols; i++) {
        idxRow.push('');
      }
    }
    body.push(idxRow);

    autoTable(doc, {
      startY: mainTableStartY,
      head: mainHead,
      body: body,
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
        if (data.section === 'head' && data.row.index === 1) {
          const finalAreaIndex = 1 + comps.length * 4 + comps.length;
          if (isStudentSecundario) {
            if (data.column.index >= finalAreaIndex && data.column.index < finalAreaIndex + 5) {
              doc.setTextColor(0, 0, 0);
              doc.setFontSize(6);
              const titles = [
                'Calif. Final',
                'Completivo',
                'Extraord.',
                'Esp. E1/E2',
                'Definitiva'
              ];
              const textIdx = data.column.index - finalAreaIndex;
              (doc as any).text(
                titles[textIdx],
                data.cell.x + 2,
                data.cell.y + data.cell.height - 2,
                {
                  angle: 90
                }
              );
            }
          } else {
            if (data.column.index === finalAreaIndex || data.column.index === finalAreaIndex + 1) {
              doc.setTextColor(0, 0, 0);
              doc.setFontSize(6);
              const titles = ['Calif. Final', 'Recup. Final'];
              const textIdx = data.column.index - finalAreaIndex;
              (doc as any).text(
                titles[textIdx],
                data.cell.x + 3.5,
                data.cell.y + data.cell.height - 2,
                {
                  angle: 90
                }
              );
            }
          }
        }
      },
      didParseCell: (data) => {
        const finalAreaIndex = 1 + comps.length * 4 + comps.length;
        if (data.section === 'body' && data.column.index >= finalAreaIndex) {
          data.cell.styles.fillColor = [240, 240, 245];
        }
      }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 5;

    // --- PANEL INFERIOR ---
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

    doc.setFontSize(6);
    doc.text(
      `Leyenda: (P1) Periodo 1  (P2) Periodo 2  (P3) Periodo 3  (P4) Periodo 4  ` +
        (isStudentSecundario
          ? `(C1) Ética y Ciudadana (C2) Comunicativa (C3) Pensamiento Crítico (C4) Científica y Tecnológica`
          : `(C1) Comunicativa  (C2) Pensamiento Lógico  (C3) Ética y Ciudadana`),
      14,
      (doc as any).lastAutoTable.finalY + 4
    );

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

    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.rect(195, finalY, 70, 36);

    doc.setFillColor(173, 216, 230);
    doc.rect(195, finalY, 70, 5, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Situación del Estudiante | Promovido/a | Repitente', 197, finalY + 3.5);

    doc.line(195, finalY + 5, 265, finalY + 5);
    doc.line(195, finalY + 10, 265, finalY + 10);

    doc.setFontSize(8);
    doc.text('Observaciones', 230, finalY + 14, { align: 'center' });
    doc.line(197, finalY + 20, 263, finalY + 20);
    doc.line(197, finalY + 27, 263, finalY + 27);
    doc.line(197, finalY + 34, 263, finalY + 34);

    let sigY = finalY + 50;
    doc.setLineWidth(0.2);
    doc.line(180, sigY, 215, sigY);
    doc.line(225, sigY, 265, sigY);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Maestro(a) encargado(a) del grado', 197.5, sigY + 3, { align: 'center' });
    doc.text('Director(a) del centro Educativo', 245, sigY + 3, { align: 'center' });

    doc.save(
      `Boletin_${student.names.replace(/ /g, '_')}_${student.first_surname.replace(/ /g, '_')}.pdf`
    );
  };

  return (
    <div className="space-y-4 text-text-main pb-20 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-indigo-600 p-4 px-6 rounded-3xl text-white shadow-xl">
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight">Registro Digital</h2>
          <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">
            Gestión de Calificaciones
          </p>
        </div>
        {onViewChange && (
          <button
            onClick={() => onViewChange('general-reports')}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black uppercase text-[10px] shadow-md flex items-center gap-2 transition-all border border-white/20"
          >
            <Printer size={14} /> Imprimir Boletines / Reportes
          </button>
        )}
      </div>

      {!isEditable && (
        <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 px-5 py-4 rounded-[1.5rem] text-xs font-bold flex items-center gap-3 animate-pulse">
          <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            La edición de calificaciones se encuentra temporalmente deshabilitada para su usuario.
            Por favor contacte al equipo de gestión.
          </span>
        </div>
      )}

      <div className="bg-surface p-4 rounded-3xl border border-border-main shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="flex gap-2 bg-slate-50 p-1 rounded-2xl">
              {levels.map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => {
                    setSelectedLevel(lvl);
                    setSelectedCourseId('');
                    setSelectedSubjectId('');
                  }}
                  className={`px-5 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${selectedLevel === lvl ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                >
                  {lvl}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-2xl text-[10px] font-black uppercase">
              <Calendar size={14} /> {config.year}
            </div>
          </div>
          <select
            value={selectedCourseId}
            onChange={(e) => {
              setSelectedCourseId(e.target.value);
              setSelectedSubjectId('');
            }}
            className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-2 text-[10px] font-black uppercase focus:border-indigo-500 outline-none"
          >
            <option value="">-- SELECCIONE EL GRADO --</option>
            {filteredCourses.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.grade} - {c.section}
              </option>
            ))}
          </select>
        </div>
        {selectedCourseId && (
          <div className="flex flex-wrap gap-1 border-t border-slate-50 pt-3">
            {courseSubjects.map((s: any) => (
              <button
                key={s.id}
                onClick={() => setSelectedSubjectId(s.id)}
                className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase transition-all border ${selectedSubjectId === s.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg scale-105' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-white hover:text-slate-600'}`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedSubjectId && (
        <div className="flex gap-2 bg-brand-bg p-1 rounded-2xl w-fit ml-auto shadow-sm">
          <button
            onClick={() => setActiveTab('grades')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ${activeTab === 'grades' ? 'bg-surface text-indigo-600 shadow-sm' : 'text-text-muted'}`}
          >
            <Edit3 size={14} /> Calificaciones
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ${activeTab === 'results' ? 'bg-surface text-emerald-600 shadow-sm' : 'text-text-muted'}`}
          >
            <BarChart3 size={14} /> Ver Promedios
          </button>
        </div>
      )}

      {selectedSubjectId && (
        <div className="bg-surface rounded-[2rem] border border-border-main shadow-2xl overflow-hidden animate-fade-in">
          <div className="p-3 border-b border-border-main flex items-center justify-between bg-surface">
            <h3 className="text-[10px] font-black uppercase text-text-main ml-2">
              {selectedSubject?.name}
            </h3>
            <div className="flex items-center gap-3">
              {showSaveStatus === 'success' && (
                <div className="flex items-center gap-1 text-emerald-600 text-[9px] font-black uppercase">
                  <CheckCircle2 size={14} /> ¡Guardado {config.year}!
                </div>
              )}
              {showSaveStatus === 'error' && (
                <div className="flex items-center gap-1 text-rose-600 text-[9px] font-black uppercase tracking-tighter">
                  <AlertCircle size={14} /> Error
                </div>
              )}
              <button
                onClick={printGradesPDF}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 transition-all hover:bg-indigo-700"
              >
                <Printer size={16} /> IMPRIMIR PDF
              </button>
              <button
                onClick={save}
                disabled={isSaving || !isEditable}
                className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{' '}
                GUARDAR
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                {activeTab === 'grades' ? (
                  <>
                    <tr className="bg-slate-900 text-white text-[7px] font-black uppercase tracking-tight">
                      <th className="p-2 border-r border-white/10 sticky left-0 bg-slate-900 z-40 w-10 text-center">
                        Nº
                      </th>
                      <th className="p-2 border-r border-white/10 sticky left-10 bg-slate-900 z-40 w-56 shadow-xl">
                        Estudiante
                      </th>
                      {config.competencies.map((c) => (
                        <th
                          key={c.id}
                          colSpan={8}
                          className="p-1 text-center border-r border-white/10 align-middle leading-tight h-10"
                        >
                          <div className="line-clamp-2 px-2">{c.name}</div>
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-slate-50 text-[7px] font-black uppercase text-slate-400 text-center">
                      <th className="p-0 border-r border-slate-200 sticky left-0 bg-slate-50"></th>
                      <th className="p-0 border-r border-slate-200 sticky left-10 bg-slate-50"></th>
                      {config.competencies.map((c) =>
                        config.periods.map((p) => (
                          <React.Fragment key={`${c.id}_${p}`}>
                            <th
                              className={`p-1.5 border-r border-slate-200 ${c.color} text-slate-700`}
                            >
                              {p}
                            </th>
                            <th
                              className={`p-1.5 border-r border-slate-200 ${c.rColor} text-slate-400 font-normal w-8`}
                            >
                              R
                            </th>
                          </React.Fragment>
                        ))
                      )}
                    </tr>
                  </>
                ) : (
                  <tr className="bg-slate-900 text-white text-[7px] font-black uppercase tracking-tight">
                    <th className="p-2 border-r border-white/10 sticky left-0 bg-slate-900 z-40 w-10 text-center">
                      Nº
                    </th>
                    <th className="p-2 border-r border-white/10 sticky left-10 bg-slate-900 z-40 w-56 shadow-xl">
                      Estudiante
                    </th>
                    {config.competencies.map((c) => (
                      <th key={`res_${c.id}`} className="p-2 text-center border-r border-white/10">
                        {c.short}
                      </th>
                    ))}
                    <th className="p-2 text-center bg-indigo-800 border-r border-white/10">PROM</th>
                    {isSecundario ? (
                      <>
                        <th className="p-2 text-center bg-amber-600 border-r border-white/10 w-14">
                          CP
                        </th>
                        <th className="p-2 text-center bg-orange-700 border-r border-white/10 w-14">
                          EX
                        </th>
                        <th className="p-2 text-center bg-rose-800 border-r border-white/10 w-14">
                          E1
                        </th>
                        <th className="p-2 text-center bg-rose-900 w-14">E2</th>
                      </>
                    ) : (
                      <th className="p-2 text-center bg-rose-800">Recuperación Final</th>
                    )}
                    <th className="p-2 text-center bg-slate-950 min-w-[60px]">Final</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100 text-[10px] font-black">
                {students.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-brand-bg transition-all">
                    <td className="p-1 border-r border-border-main sticky left-0 bg-surface z-10 text-center text-text-muted">
                      {(idx + 1).toString().padStart(2, '0')}
                    </td>
                    <td className="p-1 border-r border-border-main sticky left-10 bg-surface z-10 font-black uppercase text-text-main max-w-[220px]">
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span className="truncate">
                          {s.first_surname} {s.names}
                        </span>
                        <button
                          type="button"
                          onClick={() => fetchStudentConsolidatedGrades(s)}
                          title="Ver Boletín de Calificaciones"
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700"
                        >
                          <FileText size={12} />
                        </button>
                      </div>
                    </td>
                    {activeTab === 'grades' ? (
                      config.competencies.map((c) =>
                        config.periods.map((p) => {
                          const pL = p.toLowerCase();
                          const kVal = `${c.id}_${pL}`;
                          const kRec = `${c.id}_r${pL}`;
                          return (
                            <React.Fragment key={`${s.id}_${c.id}_${p}`}>
                              <td className={`p-0 border-r border-border-main ${c.color}`}>
                                <input
                                  ref={(el) => {
                                    inputRefs.current[`${s.id}_${kVal}`] = el;
                                  }}
                                  type="text"
                                  maxLength={3}
                                  value={grades[`${s.id}_${kVal}`] || ''}
                                  onChange={(e) => handleGradeChange(s.id, kVal, e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, idx, kVal)}
                                  className="w-9 h-8 bg-transparent text-center outline-none focus:bg-surface font-black disabled:opacity-50 disabled:cursor-not-allowed"
                                  placeholder=""
                                  disabled={!isEditable}
                                />
                              </td>
                              <td className={`p-0 border-r border-border-main ${c.rColor}`}>
                                <input
                                  ref={(el) => {
                                    inputRefs.current[`${s.id}_${kRec}`] = el;
                                  }}
                                  type="text"
                                  maxLength={3}
                                  value={grades[`${s.id}_${kRec}`] || ''}
                                  onChange={(e) => handleGradeChange(s.id, kRec, e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, idx, kRec)}
                                  className="w-8 h-8 bg-transparent text-center text-[9px] text-text-muted outline-none focus:bg-surface disabled:opacity-50 disabled:cursor-not-allowed"
                                  placeholder=""
                                  disabled={!isEditable}
                                />
                              </td>
                            </React.Fragment>
                          );
                        })
                      )
                    ) : (
                      <>
                        {config.competencies.map((c) => (
                          <td
                            key={`res_val_${c.id}`}
                            className="p-0 border-r border-border-main bg-surface text-center text-indigo-700 h-8 leading-8 font-black"
                          >
                            {calculateCompAvg(s.id, c.id).toFixed(0)}
                          </td>
                        ))}
                        <td className="p-0 border-r border-border-main bg-indigo-50/10 text-center text-indigo-500 text-sm font-black h-8 leading-8">
                          {calculateAreaFinal(s.id)}
                        </td>

                        {isSecundario ? (
                          <>
                            {/* COMPLETIVO: 50/50 */}
                            <td className="p-0 border-r border-border-main bg-amber-50/10 text-center">
                              <input
                                type="text"
                                maxLength={3}
                                value={grades[`${s.id}_comp`] || ''}
                                onChange={(e) => handleGradeChange(s.id, 'comp', e.target.value)}
                                className="w-full h-8 bg-transparent text-center text-amber-700 outline-none focus:bg-surface font-black disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="EX"
                                disabled={!isEditable}
                              />
                            </td>
                            {/* EXTRAORDINARIO: 30/70 */}
                            <td className="p-0 border-r border-border-main bg-orange-50/10 text-center">
                              <input
                                type="text"
                                maxLength={3}
                                value={grades[`${s.id}_extra`] || ''}
                                onChange={(e) => handleGradeChange(s.id, 'extra', e.target.value)}
                                className="w-full h-8 bg-transparent text-center text-orange-700 outline-none focus:bg-surface font-black disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="EX"
                                disabled={!isEditable}
                              />
                            </td>
                            {/* ESPECIAL 1 */}
                            <td className="p-0 border-r border-border-main bg-rose-50/10 text-center">
                              <input
                                type="text"
                                maxLength={3}
                                value={grades[`${s.id}_esp1`] || ''}
                                onChange={(e) => handleGradeChange(s.id, 'esp1', e.target.value)}
                                className="w-full h-8 bg-transparent text-center text-rose-700 outline-none focus:bg-surface font-black disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!isEditable}
                              />
                            </td>
                            {/* ESPECIAL 2 */}
                            <td className="p-0 border-r border-border-main bg-rose-100/10 text-center">
                              <input
                                type="text"
                                maxLength={3}
                                value={grades[`${s.id}_esp2`] || ''}
                                onChange={(e) => handleGradeChange(s.id, 'esp2', e.target.value)}
                                className="w-full h-8 bg-transparent text-center text-rose-900 outline-none focus:bg-surface font-black disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!isEditable}
                              />
                            </td>
                          </>
                        ) : (
                          <td className="p-0 bg-rose-50/10 text-center border-r border-border-main">
                            <input
                              type="text"
                              maxLength={3}
                              value={grades[`${s.id}_final_rec`] || ''}
                              onChange={(e) => handleGradeChange(s.id, 'final_rec', e.target.value)}
                              className="w-full h-8 bg-transparent text-center text-rose-600 outline-none focus:bg-surface font-black disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={!isEditable}
                            />
                          </td>
                        )}

                        {/* CALCULO NOTA FINAL DEFINITIVA */}
                        <td className="p-0 bg-slate-900 text-center text-white font-black text-xs h-8 leading-8">
                          {(() => {
                            const areaFinal = parseInt(calculateAreaFinal(s.id).toString()) || 0;
                            if (!isSecundario) {
                              const recFinal = parseInt(grades[`${s.id}_final_rec`]) || 0;
                              return Math.max(areaFinal, recFinal) || '-';
                            }

                            // LÓGICA SECUNDARIA
                            if (areaFinal >= 70) return areaFinal;

                            const cpExam = parseInt(grades[`${s.id}_comp`]) || 0;
                            if (cpExam > 0) {
                              const cpFinal = Math.round(areaFinal * 0.5 + cpExam * 0.5);
                              if (cpFinal >= 70) return cpFinal;
                            }

                            const exExam = parseInt(grades[`${s.id}_extra`]) || 0;
                            if (exExam > 0) {
                              const exFinal = Math.round(areaFinal * 0.3 + exExam * 0.7);
                              if (exFinal >= 70) return exFinal;
                            }

                            const esp1 = parseInt(grades[`${s.id}_esp1`]) || 0;
                            if (esp1 >= 70) return esp1;

                            const esp2 = parseInt(grades[`${s.id}_esp2`]) || 0;
                            if (esp2 >= 70) return esp2;

                            return areaFinal > 0 ? areaFinal : '-';
                          })()}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isSummaryModalOpen && selectedSummaryStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 lg:pl-[280px] overflow-y-auto">
          <div className="relative bg-surface rounded-3xl w-full max-w-6xl shadow-2xl border border-border-main flex flex-col my-8 animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-6 border-b border-border-main flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 dark:bg-slate-800 dark:text-indigo-400 rounded-2xl">
                  <ScrollText size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-text-main">
                    Resumen de Calificaciones Consolidadas
                  </h3>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    Boletín Académico
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-text-muted">
                    Periodos a promediar:
                  </span>
                  <select
                    value={summaryPeriodDivisor}
                    onChange={(e) => setSummaryPeriodDivisor(Number(e.target.value))}
                    className="bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase focus:border-indigo-500 outline-none"
                  >
                    <option value={1}>P1</option>
                    <option value={2}>P1 - P2</option>
                    <option value={3}>P1 - P3</option>
                    <option value={4}>P1 - P4</option>
                  </select>
                </div>

                <button
                  onClick={() => downloadSingleBoletinPDF(selectedSummaryStudent)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase text-[10px] shadow-md flex items-center gap-2 transition-all"
                >
                  <Printer size={14} /> Descargar PDF
                </button>

                <button
                  onClick={() => {
                    setIsSummaryModalOpen(false);
                    setSelectedSummaryStudent(null);
                  }}
                  className="p-2 text-text-muted hover:text-text-main rounded-xl hover:bg-slate-50 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Student Info Bar */}
            <div className="px-6 py-4 bg-slate-50 border-b border-border-main">
              {(() => {
                const family = selectedSummaryStudent.family || [];
                let parentsName = 'No registrado';
                if (family.length > 0) {
                  const parents = family.filter(
                    (f: any) =>
                      (f.relation || f.role)?.toLowerCase().includes('madre') ||
                      (f.relation || f.role)?.toLowerCase().includes('padre')
                  );
                  if (parents.length > 0) {
                    parentsName = parents.map((p: any) => p.name).join(' y ');
                  } else {
                    parentsName = family[0].name;
                  }
                }
                const studentCourse = (allCourses || []).find(
                  (c: any) => c.id === selectedSummaryStudent.course_id
                );
                const courseDisplay = studentCourse
                  ? `${studentCourse.grade} - ${studentCourse.section}`
                  : '';
                const levelDisplay = studentCourse?.level || '---';
                const studentCode =
                  selectedSummaryStudent.sigerd_code ||
                  selectedSummaryStudent.student_code ||
                  selectedSummaryStudent.rne ||
                  selectedSummaryStudent.id.substring(0, 7).toUpperCase();
                const studentIndex = (students || []).findIndex(
                  (s: any) => s.id === selectedSummaryStudent.id
                );
                const orderNo =
                  studentIndex !== -1 ? (studentIndex + 1).toString().padStart(2, '0') : '--';

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[10px] uppercase font-black">
                    <div className="p-3 bg-surface border border-border-main rounded-2xl flex flex-col justify-center shadow-sm">
                      <span className="text-text-muted text-[8px] tracking-wider mb-0.5">
                        Estudiante
                      </span>
                      <span className="text-indigo-600 text-xs font-black truncate">
                        {`${selectedSummaryStudent.names || ''} ${selectedSummaryStudent.first_surname || ''} ${selectedSummaryStudent.second_surname || ''}`
                          .trim()
                          .toUpperCase()}
                      </span>
                      <span className="text-text-muted text-[8px] mt-0.5">
                        Nº de Orden:{' '}
                        <span className="text-slate-800 dark:text-slate-200 font-black">
                          {orderNo}
                        </span>
                      </span>
                    </div>

                    <div className="p-3 bg-surface border border-border-main rounded-2xl flex flex-col justify-center shadow-sm">
                      <span className="text-text-muted text-[8px] tracking-wider mb-0.5">
                        Grado / Nivel
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 text-xs font-black truncate">
                        {courseDisplay}
                      </span>
                      <span className="text-text-muted text-[8px] mt-0.5">{levelDisplay}</span>
                    </div>

                    <div className="p-3 bg-surface border border-border-main rounded-2xl flex flex-col justify-center shadow-sm">
                      <span className="text-text-muted text-[8px] tracking-wider mb-0.5">
                        Código SIGERD / Año
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 text-xs font-black">
                        {studentCode}
                      </span>
                      <span className="text-text-muted text-[8px] mt-0.5">
                        Año Escolar:{' '}
                        <span className="text-slate-800 dark:text-slate-200 font-black">
                          {selectedYear || '2025-2026'}
                        </span>
                      </span>
                    </div>

                    <div className="p-3 bg-surface border border-border-main rounded-2xl flex flex-col justify-center shadow-sm">
                      <span className="text-text-muted text-[8px] tracking-wider mb-0.5">
                        Padres o Tutor(a)
                      </span>
                      <span
                        className="text-slate-800 dark:text-slate-200 text-xs font-black truncate"
                        title={parentsName}
                      >
                        {parentsName}
                      </span>
                      <span className="text-text-muted text-[8px] mt-0.5">
                        Relación: Madre/Padre
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Table Content */}
            <div className="p-6 overflow-x-auto max-h-[60vh]">
              {isLoadingSummary ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="animate-spin text-indigo-600" size={32} />
                  <span className="text-[10px] font-black uppercase text-text-muted">
                    Cargando Calificaciones Consolidadas...
                  </span>
                </div>
              ) : (
                <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider">
                      <th className="p-3 border border-slate-800 w-1/4">
                        Área Curricular (Materia)
                      </th>
                      {(() => {
                        const studentCourse = (allCourses || []).find(
                          (c: any) => c.id === selectedSummaryStudent.course_id
                        );
                        const isStudentSecundario = studentCourse?.level
                          ?.toLowerCase()
                          .includes('secund');
                        const comps = isStudentSecundario
                          ? [
                              { short: 'C1', name: 'Ética y Ciudadana' },
                              { short: 'C2', name: 'Comunicativa' },
                              { short: 'C3', name: 'Pensamiento Crítico' },
                              { short: 'C4', name: 'Científica y Tec.' }
                            ]
                          : [
                              { short: 'C1', name: 'Comunicativa' },
                              { short: 'C2', name: 'Pensamiento Lógico' },
                              { short: 'C3', name: 'Ética y Ciudadana' }
                            ];
                        return (
                          <>
                            {comps.map((c) => (
                              <th
                                key={c.short}
                                className="p-3 border border-slate-800 text-center"
                                title={c.name}
                              >
                                {c.short}
                              </th>
                            ))}
                            <th className="p-3 border border-slate-800 text-center bg-indigo-800">
                              C.FA
                            </th>
                            {isStudentSecundario ? (
                              <>
                                <th className="p-3 border border-slate-800 text-center bg-amber-700 w-12">
                                  CP
                                </th>
                                <th className="p-3 border border-slate-800 text-center bg-orange-700 w-12">
                                  EX
                                </th>
                                <th className="p-3 border border-slate-800 text-center bg-rose-800 w-12">
                                  E1
                                </th>
                                <th className="p-3 border border-slate-800 text-center bg-rose-900 w-12">
                                  E2
                                </th>
                              </>
                            ) : (
                              <th className="p-3 border border-slate-800 text-center bg-rose-800 w-16">
                                RP
                              </th>
                            )}
                            <th className="p-3 border border-slate-800 text-center bg-slate-950 w-16">
                              C.D
                            </th>
                          </>
                        );
                      })()}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[10px] font-black text-text-main">
                    {(() => {
                      const studentCourse = (allCourses || []).find(
                        (c: any) => c.id === selectedSummaryStudent.course_id
                      );
                      const isStudentSecundario = studentCourse?.level
                        ?.toLowerCase()
                        .includes('secund');
                      const comps = isStudentSecundario
                        ? [
                            { id: 'c1', short: 'C1' },
                            { id: 'c2', short: 'C2' },
                            { id: 'c3', short: 'C3' },
                            { id: 'c4', short: 'C4' }
                          ]
                        : [
                            { id: 'c1', short: 'C1' },
                            { id: 'c2', short: 'C2' },
                            { id: 'c3', short: 'C3' }
                          ];

                      const getBestGradeForModal = (sGrades: any, cId: string, p: string) => {
                        const pL = p.toLowerCase();
                        const g = parseInt(sGrades[`${cId}_${pL}`]) || 0;
                        const r = parseInt(sGrades[`${cId}_r${pL}`]) || 0;
                        return Math.max(g, r);
                      };

                      const getCompFinalVal = (sGrades: any, cId: string) => {
                        let sum = 0;
                        config.periods.forEach((p, idx) => {
                          if (summaryPeriodDivisor > idx) {
                            sum += getBestGradeForModal(sGrades, cId, p);
                          }
                        });
                        return Math.round(sum / summaryPeriodDivisor) || 0;
                      };

                      let sumC1 = 0,
                        sumC2 = 0,
                        sumC3 = 0,
                        sumC4 = 0,
                        sumFinal = 0;
                      let count = 0;

                      const rows = allCourseSubjects.map((sub) => {
                        const sGrades = studentSummaryGrades[sub.id] || {};
                        const cfValues = comps.map((c) => getCompFinalVal(sGrades, c.id));
                        const finalArea =
                          cfValues.length > 0
                            ? Math.round(cfValues.reduce((a, b) => a + b, 0) / cfValues.length)
                            : 0;

                        let defFinal = finalArea;
                        let cp = 0,
                          ex = 0,
                          e1 = 0,
                          e2 = 0,
                          rp = 0;

                        if (isStudentSecundario) {
                          cp = parseInt(sGrades['comp']) || 0;
                          ex = parseInt(sGrades['extra']) || 0;
                          e1 = parseInt(sGrades['esp1']) || 0;
                          e2 = parseInt(sGrades['esp2']) || 0;

                          if (finalArea < 70) {
                            if (cp > 0) {
                              const cpFinal = Math.round(finalArea * 0.5 + cp * 0.5);
                              if (cpFinal >= 70) defFinal = cpFinal;
                            }
                            if (defFinal < 70 && ex > 0) {
                              const exFinal = Math.round(finalArea * 0.3 + ex * 0.7);
                              if (exFinal >= 70) defFinal = exFinal;
                            }
                            if (defFinal < 70 && e1 >= 70) {
                              defFinal = e1;
                            }
                            if (defFinal < 70 && e2 >= 70) {
                              defFinal = e2;
                            }
                          }
                        } else {
                          rp = parseInt(sGrades['final_rec']) || 0;
                          defFinal = Math.max(finalArea, rp);
                        }

                        if (defFinal > 0) {
                          sumFinal += defFinal;
                          count++;
                        }
                        if (finalArea > 0) {
                          sumC1 += cfValues[0] || 0;
                          sumC2 += cfValues[1] || 0;
                          sumC3 += cfValues[2] || 0;
                          if (isStudentSecundario) {
                            sumC4 += cfValues[3] || 0;
                          }
                        }

                        return (
                          <tr
                            key={sub.id}
                            className="hover:bg-slate-50 transition-all border-b border-slate-100"
                          >
                            <td className="p-3 border border-slate-100 font-bold uppercase">
                              {sub.name}
                            </td>
                            {cfValues.map((val, idx) => (
                              <td key={idx} className="p-3 border border-slate-100 text-center">
                                {val || '-'}
                              </td>
                            ))}
                            <td className="p-3 border border-slate-100 text-center bg-indigo-50/40 text-indigo-700 font-black">
                              {finalArea || '-'}
                            </td>
                            {isStudentSecundario ? (
                              <>
                                <td className="p-3 border border-slate-100 text-center text-amber-700">
                                  {cp || '-'}
                                </td>
                                <td className="p-3 border border-slate-100 text-center text-orange-700">
                                  {ex || '-'}
                                </td>
                                <td className="p-3 border border-slate-100 text-center text-rose-700">
                                  {e1 || '-'}
                                </td>
                                <td className="p-3 border border-slate-100 text-center text-rose-900">
                                  {e2 || '-'}
                                </td>
                              </>
                            ) : (
                              <td className="p-3 border border-slate-100 text-center text-rose-700">
                                {rp || '-'}
                              </td>
                            )}
                            <td className="p-3 border border-slate-100 text-center bg-slate-900 text-white font-black">
                              {defFinal || '-'}
                            </td>
                          </tr>
                        );
                      });

                      const idxRow = (
                        <tr
                          key="idx-row"
                          className="bg-slate-50 text-[10px] font-black border-t-2 border-slate-200"
                        >
                          <td className="p-3 border border-slate-100 text-right text-indigo-600 uppercase font-black">
                            Índice Académico (GPA)
                          </td>
                          <td className="p-3 border border-slate-100 text-center text-indigo-600">
                            {count > 0 ? (sumC1 / count / 25).toFixed(2) : '0.00'}
                          </td>
                          <td className="p-3 border border-slate-100 text-center text-indigo-600">
                            {count > 0 ? (sumC2 / count / 25).toFixed(2) : '0.00'}
                          </td>
                          <td className="p-3 border border-slate-100 text-center text-indigo-600">
                            {count > 0 ? (sumC3 / count / 25).toFixed(2) : '0.00'}
                          </td>
                          {isStudentSecundario && (
                            <td className="p-3 border border-slate-100 text-center text-indigo-600">
                              {count > 0 ? (sumC4 / count / 25).toFixed(2) : '0.00'}
                            </td>
                          )}
                          <td className="p-3 border border-slate-100 text-center bg-indigo-50 text-indigo-700">
                            {count > 0 ? (sumFinal / count / 25).toFixed(2) : '0.00'}
                          </td>
                          {isStudentSecundario ? (
                            <>
                              <td className="p-3 border border-slate-100"></td>
                              <td className="p-3 border border-slate-100"></td>
                              <td className="p-3 border border-slate-100"></td>
                              <td className="p-3 border border-slate-100"></td>
                            </>
                          ) : (
                            <td className="p-3 border border-slate-100"></td>
                          )}
                          <td className="p-3 border border-slate-100 text-center bg-slate-900 text-white">
                            {count > 0 ? (sumFinal / count / 25).toFixed(2) : '0.00'}
                          </td>
                        </tr>
                      );

                      return [...rows, idxRow];
                    })()}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border-main bg-slate-50 flex items-center justify-between text-[9px] text-text-muted font-bold uppercase rounded-b-3xl">
              <div>
                * Leyenda: C.FA = Calif. Final del Área | CP = Completivo | EX = Extraordinario |
                E1/E2 = Especial | RP = Recup. Final | C.D = Calif. Definitiva
              </div>
              <div>EduGens v41.0</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
