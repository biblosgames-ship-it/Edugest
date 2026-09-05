import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import {
  FileCheck2,
  Calendar,
  Download,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportGenericTableToExcel } from '../utils/listPdfGenerator';
import { useStudents } from '../hooks/useStudents';
import { useCourses } from '../hooks/useCourses';

export const DailyMinerdAttendanceReport: React.FC = () => {
  const { state, center, selectedYear } = useApp();
  const { students: hookStudents } = useStudents();
  const { courses: hookCourses } = useCourses();

  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Cargar registros de asistencia para la fecha seleccionada
  const fetchAttendance = async () => {
    if (!selectedDate) return;
    setIsLoading(true);
    try {
      // 1. Consultar de Supabase para la fecha seleccionada
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('date', selectedDate)
        .order('created_at', { ascending: true });

      let records: any[] = (!error && data) ? [...data] : [];

      // 2. Consolidar registros desde localStorage para todos los cursos
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('attendance_') && k.endsWith(`_${selectedDate}`)) {
          const parts = k.split('_');
          const cId = parts.slice(1, -1).join('_');
          const localData = localStorage.getItem(k);
          if (localData) {
            try {
              const parsed = JSON.parse(localData);
              Object.entries(parsed).forEach(([sId, val]: [string, any]) => {
                const status = typeof val === 'string' ? val : val?.status || 'presente';
                const notes = typeof val === 'object' ? val?.note || '' : '';
                const existingIdx = records.findIndex(
                  (r) => String(r.student_id) === String(sId) && String(r.course_id) === String(cId)
                );
                if (existingIdx >= 0) {
                  if (status) records[existingIdx].status = status;
                } else {
                  records.push({
                    student_id: sId,
                    course_id: cId,
                    date: selectedDate,
                    status,
                    notes,
                    created_at: new Date().toISOString()
                  });
                }
              });
            } catch (e) {}
          }
        }
      }

      setAttendanceRecords(records);
    } catch (err: any) {
      console.error('Error al cargar asistencia diaria:', err);
      toast.error('Error al consultar asistencia.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();

    const handleAttendanceUpdated = () => {
      fetchAttendance();
    };

    window.addEventListener('edugens_attendance_updated', handleAttendanceUpdated);
    return () => {
      window.removeEventListener('edugens_attendance_updated', handleAttendanceUpdated);
    };
  }, [selectedDate, center?.id, state.courses]);

  // Helper para clasificar sexo del estudiante
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
    return true;
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

  // Helper para ordenamiento de grados
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

  // Cómputo consolidado de asistencia MINERD
  const consolidatedReport = useMemo(() => {
    const courses = (hookCourses && hookCourses.length > 0) ? hookCourses : (state.courses || []);
    const students = (hookStudents && hookStudents.length > 0) ? hookStudents : (state.students || []);

    // Mapear el PRIMER pase de lista por estudiante en el día
    const firstAttendanceByStudent = new Map<string, string>();
    attendanceRecords.forEach((r) => {
      if (r.student_id) {
        const sId = String(r.student_id);
        if (!firstAttendanceByStudent.has(sId)) {
          firstAttendanceByStudent.set(sId, (r.status || 'presente').toLowerCase().trim());
        }
      }
    });

    const levelGroups: Record<string, any[]> = {
      Inicial: [],
      Primaria: [],
      Secundaria: []
    };

    courses.forEach((c: any) => {
      const normLvl = getNormalizedLevel(c.level, c.grade);
      if (!levelGroups[normLvl]) levelGroups[normLvl] = [];

      const courseStudents = students.filter(
        (s: any) => String(s.course_id || s.courseId) === String(c.id)
      );

      const studentIdSet = new Set(courseStudents.map((s: any) => String(s.id)));
      const courseRecords = attendanceRecords.filter(
        (r) => String(r.course_id) === String(c.id) || studentIdSet.has(String(r.student_id))
      );
      const hasCourseRecords = courseRecords.length > 0;

      let enrolledM = 0;
      let enrolledF = 0;
      let presentM = 0;
      let presentF = 0;
      let absentM = 0;
      let absentF = 0;
      let hasTakenAttendance = hasCourseRecords;

      courseStudents.forEach((s: any) => {
        const isMale = isStudentMale(s);
        if (isMale) enrolledM++;
        else enrolledF++;

        const sId = String(s.id);
        const rec = courseRecords.find((r) => String(r.student_id) === sId);
        const status = rec && rec.status
          ? String(rec.status).toLowerCase().trim()
          : firstAttendanceByStudent.get(sId);

        if (status) {
          hasTakenAttendance = true;
          if (status === 'presente' || status === 'tardanza' || status === 'present') {
            if (isMale) presentM++;
            else presentF++;
          } else {
            // Ausente o excusa
            if (isMale) absentM++;
            else absentF++;
          }
        } else if (hasCourseRecords) {
          // Si se pasó lista en el curso y este estudiante no fue marcado ausente, cuenta como presente
          if (isMale) presentM++;
          else presentF++;
        }
      });

      const enrolledTotal = enrolledM + enrolledF;
      const presentTotal = presentM + presentF;
      const absentTotal = absentM + absentF;
      const rate = enrolledTotal > 0 && hasTakenAttendance
        ? Math.round((presentTotal / enrolledTotal) * 100)
        : hasTakenAttendance ? 0 : null;

      const baseGrade = c.grade ? c.grade.trim() : (c.name ? c.name.trim() : 'General');
      const sec = c.section ? c.section.trim() : '';
      const tandaStr = c.tanda ? c.tanda.trim() : '';
      let gradeLabel = sec ? `${baseGrade} "${sec}"` : baseGrade;
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

      levelGroups[normLvl].push({
        courseId: c.id,
        name: gradeLabel,
        order: gradeOrderScore(baseGrade),
        enrolledM,
        enrolledF,
        enrolledTotal,
        presentM,
        presentF,
        presentTotal,
        absentM,
        absentF,
        absentTotal,
        rate,
        hasTakenAttendance
      });
    });

    // Ordenar y calcular subtotales y gran total
    let grandEnrolledM = 0, grandEnrolledF = 0, grandEnrolledTotal = 0;
    let grandPresentM = 0, grandPresentF = 0, grandPresentTotal = 0;
    let grandAbsentM = 0, grandAbsentF = 0, grandAbsentTotal = 0;

    const orderedLevels = ['Inicial', 'Primaria', 'Secundaria'];
    const levelsResult = orderedLevels
      .map((lvlName) => {
        const grades = (levelGroups[lvlName] || []).sort((a, b) => {
          if (a.order !== b.order) return a.order - b.order;
          return a.name.localeCompare(b.name);
        });

        let subEnrolledM = 0, subEnrolledF = 0, subEnrolledTotal = 0;
        let subPresentM = 0, subPresentF = 0, subPresentTotal = 0;
        let subAbsentM = 0, subAbsentF = 0, subAbsentTotal = 0;
        let countWithAttendance = 0;

        grades.forEach((g) => {
          subEnrolledM += g.enrolledM;
          subEnrolledF += g.enrolledF;
          subEnrolledTotal += g.enrolledTotal;

          subPresentM += g.presentM;
          subPresentF += g.presentF;
          subPresentTotal += g.presentTotal;

          subAbsentM += g.absentM;
          subAbsentF += g.absentF;
          subAbsentTotal += g.absentTotal;

          if (g.hasTakenAttendance) countWithAttendance++;
        });

        grandEnrolledM += subEnrolledM;
        grandEnrolledF += subEnrolledF;
        grandEnrolledTotal += subEnrolledTotal;

        grandPresentM += subPresentM;
        grandPresentF += subPresentF;
        grandPresentTotal += subPresentTotal;

        grandAbsentM += subAbsentM;
        grandAbsentF += subAbsentF;
        grandAbsentTotal += subAbsentTotal;

        const subRate = subEnrolledTotal > 0 && countWithAttendance > 0
          ? Math.round((subPresentTotal / subEnrolledTotal) * 100)
          : null;

        return {
          name: lvlName,
          grades,
          subEnrolledM,
          subEnrolledF,
          subEnrolledTotal,
          subPresentM,
          subPresentF,
          subPresentTotal,
          subAbsentM,
          subAbsentF,
          subAbsentTotal,
          subRate,
          hasData: countWithAttendance > 0
        };
      })
      .filter((l) => l.grades.length > 0);

    const grandRate = grandEnrolledTotal > 0 && (grandPresentTotal > 0 || grandAbsentTotal > 0)
      ? Math.round((grandPresentTotal / grandEnrolledTotal) * 100)
      : null;

    return {
      levels: levelsResult,
      grandEnrolledM,
      grandEnrolledF,
      grandEnrolledTotal,
      grandPresentM,
      grandPresentF,
      grandPresentTotal,
      grandAbsentM,
      grandAbsentF,
      grandAbsentTotal,
      grandRate
    };
  }, [state.courses, state.students, attendanceRecords]);

  // Generar y Descargar PDF Oficial MINERD
  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      let startY = 14;
      if (center?.logo_url || center?.logo) {
        try {
          doc.addImage(center.logo_url || center.logo, 'PNG', 14, startY, 18, 18);
        } catch (e) {}
      }

      const textStartX = center?.logo_url || center?.logo ? 36 : 14;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text((center?.name || 'CENTRO EDUCATIVO EDUGEST').toUpperCase(), textStartX, startY + 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `CÓDIGO MINERD: ${center?.center_code || center?.code || 'N/A'}  |  AÑO ESCOLAR: ${selectedYear || '2026-2027'}  |  DISTRITO/REGIONAL: ${center?.district || 'N/A'}`,
        textStartX,
        startY + 9
      );
      doc.text(
        `INFORME DIARIO DE ASISTENCIA MINERD  |  FECHA DEL REPORTE: ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}`,
        textStartX,
        startY + 14
      );

      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.6);
      doc.line(14, startY + 19, pageWidth - 14, startY + 19);

      const tableBody: any[] = [];

      consolidatedReport.levels.forEach((lvl: any) => {
        tableBody.push([
          {
            content: `NIVEL ${lvl.name.toUpperCase()}`,
            colSpan: 11,
            styles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 }
          }
        ]);

        lvl.grades.forEach((g: any) => {
          tableBody.push([
            `  ${g.name}`,
            { content: String(g.enrolledM), styles: { halign: 'center' } },
            { content: String(g.enrolledF), styles: { halign: 'center' } },
            { content: String(g.enrolledTotal), styles: { halign: 'center', fontStyle: 'bold' } },
            { content: g.hasTakenAttendance ? String(g.presentM) : '-', styles: { halign: 'center', textColor: [37, 99, 235] } },
            { content: g.hasTakenAttendance ? String(g.presentF) : '-', styles: { halign: 'center', textColor: [225, 29, 72] } },
            { content: g.hasTakenAttendance ? String(g.presentTotal) : '-', styles: { halign: 'center', fontStyle: 'bold', textColor: [5, 150, 105] } },
            { content: g.hasTakenAttendance ? String(g.absentM) : '-', styles: { halign: 'center', textColor: [225, 29, 72] } },
            { content: g.hasTakenAttendance ? String(g.absentF) : '-', styles: { halign: 'center', textColor: [225, 29, 72] } },
            { content: g.hasTakenAttendance ? String(g.absentTotal) : '-', styles: { halign: 'center', fontStyle: 'bold', textColor: [225, 29, 72] } },
            { content: g.rate !== null ? `${g.rate}%` : 'Pendiente', styles: { halign: 'right', fontStyle: 'bold', textColor: g.rate !== null && g.rate >= 80 ? [5, 150, 105] : [217, 119, 6] } }
          ]);
        });

        // Subtotal Nivel
        tableBody.push([
          { content: `SUBTOTAL ${lvl.name.toUpperCase()}:`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
          { content: String(lvl.subEnrolledM), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } },
          { content: String(lvl.subEnrolledF), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } },
          { content: String(lvl.subEnrolledTotal), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } },
          { content: String(lvl.subPresentM), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [37, 99, 235] } },
          { content: String(lvl.subPresentF), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [225, 29, 72] } },
          { content: String(lvl.subPresentTotal), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [5, 150, 105] } },
          { content: String(lvl.subAbsentM), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [225, 29, 72] } },
          { content: String(lvl.subAbsentF), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [225, 29, 72] } },
          { content: String(lvl.subAbsentTotal), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [225, 29, 72] } },
          { content: lvl.subRate !== null ? `${lvl.subRate}%` : '---', styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [79, 70, 229] } }
        ]);
      });

      // Gran Total Centro
      tableBody.push([
        { content: 'TOTAL GENERAL CENTRO EDUCATIVO:', styles: { fontStyle: 'bold', halign: 'right', fillColor: [224, 231, 255], textColor: [49, 46, 129], fontSize: 8.5 } },
        { content: String(consolidatedReport.grandEnrolledM), styles: { halign: 'center', fontStyle: 'bold', fillColor: [224, 231, 255], fontSize: 8 } },
        { content: String(consolidatedReport.grandEnrolledF), styles: { halign: 'center', fontStyle: 'bold', fillColor: [224, 231, 255], fontSize: 8 } },
        { content: String(consolidatedReport.grandEnrolledTotal), styles: { halign: 'center', fontStyle: 'bold', fillColor: [224, 231, 255], fontSize: 8.5 } },
        { content: String(consolidatedReport.grandPresentM), styles: { halign: 'center', fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [37, 99, 235], fontSize: 8 } },
        { content: String(consolidatedReport.grandPresentF), styles: { halign: 'center', fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [225, 29, 72], fontSize: 8 } },
        { content: String(consolidatedReport.grandPresentTotal), styles: { halign: 'center', fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [5, 150, 105], fontSize: 8.5 } },
        { content: String(consolidatedReport.grandAbsentM), styles: { halign: 'center', fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [225, 29, 72], fontSize: 8 } },
        { content: String(consolidatedReport.grandAbsentF), styles: { halign: 'center', fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [225, 29, 72], fontSize: 8 } },
        { content: String(consolidatedReport.grandAbsentTotal), styles: { halign: 'center', fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [225, 29, 72], fontSize: 8.5 } },
        { content: consolidatedReport.grandRate !== null ? `${consolidatedReport.grandRate}%` : '---', styles: { halign: 'right', fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [79, 70, 229], fontSize: 9 } }
      ]);

      autoTable(doc, {
        startY: startY + 24,
        head: [
          [
            { content: 'GRADO / SECCIÓN', rowSpan: 2, styles: { valign: 'middle', halign: 'left' } },
            { content: 'MATRÍCULA INSCRITA', colSpan: 3, styles: { halign: 'center' } },
            { content: 'PRESENTES (1ER PASE)', colSpan: 3, styles: { halign: 'center', fillColor: [209, 250, 229], textColor: [6, 95, 70] } },
            { content: 'AUSENTES', colSpan: 3, styles: { halign: 'center', fillColor: [255, 228, 230], textColor: [159, 18, 57] } },
            { content: '% ASIST.', rowSpan: 2, styles: { valign: 'middle', halign: 'right' } }
          ],
          [
            'M', 'F', 'T',
            'M', 'F', 'T',
            'M', 'F', 'T'
          ]
        ],
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [248, 250, 252], textColor: [100, 116, 139], fontStyle: 'bold', fontSize: 6.5 },
        margin: { left: 14, right: 14 }
      });

      let currentY = (doc as any).lastAutoTable.finalY + 12;
      if (currentY > pageHeight - 35) {
        doc.addPage();
        currentY = 25;
      }

      // Firmas Oficiales
      const colW = (pageWidth - 28) / 3;
      const sigY = currentY + 10;

      // 1. Director(a)
      doc.setDrawColor(148, 163, 184);
      doc.line(14 + 4, sigY, 14 + colW - 4, sigY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      if (center?.director_name) {
        doc.text(center.director_name, 14 + colW / 2, sigY - 1.5, { align: 'center' });
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        center?.director_sex === 'M' ? 'DIRECTOR DEL CENTRO' : 'DIRECTORA DEL CENTRO',
        14 + colW / 2,
        sigY + 3.5,
        { align: 'center' }
      );

      // 2. Coordinador(a) / Secretario(a)
      doc.line(14 + colW + 4, sigY, 14 + colW * 2 - 4, sigY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      if (center?.secretary_name) {
        doc.text(center.secretary_name, 14 + colW * 1.5, sigY - 1.5, { align: 'center' });
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text('COORDINACIÓN / SECRETARÍA', 14 + colW * 1.5, sigY + 3.5, { align: 'center' });

      // 3. Sello
      doc.line(14 + colW * 2 + 4, sigY, 14 + colW * 3 - 4, sigY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      doc.text('SELLO OFICIAL DEL CENTRO', 14 + colW * 2.5, sigY + 3.5, { align: 'center' });

      doc.save(`Asistencia_Diaria_MINERD_${selectedDate}_${(center?.name || 'Centro').replace(/\s+/g, '_')}.pdf`);
      toast.success('¡Informe Diario MINERD descargado en PDF!');
    } catch (err) {
      console.error('Error generando PDF MINERD:', err);
      toast.error('Error al generar el PDF.');
    }
  };

  // Exportar Excel
  const handleExportExcel = () => {
    const excelRows: any[] = [];
    consolidatedReport.levels.forEach((lvl: any) => {
      lvl.grades.forEach((g: any) => {
        excelRows.push([
          lvl.name,
          g.name,
          g.enrolledM,
          g.enrolledF,
          g.enrolledTotal,
          g.hasTakenAttendance ? g.presentM : 0,
          g.hasTakenAttendance ? g.presentF : 0,
          g.hasTakenAttendance ? g.presentTotal : 0,
          g.hasTakenAttendance ? g.absentM : 0,
          g.hasTakenAttendance ? g.absentF : 0,
          g.hasTakenAttendance ? g.absentTotal : 0,
          g.rate !== null ? `${g.rate}%` : 'Pendiente'
        ]);
      });
    });

    exportGenericTableToExcel({
      title: `Informe Diario de Asistencia MINERD - Fecha: ${selectedDate}`,
      subtitle: `Centro: ${center?.name || 'Centro'} | Código: ${center?.center_code || 'N/A'} | Año: ${selectedYear}`,
      headers: [
        'Nivel',
        'Grado / Sección',
        'Inscritos (M)',
        'Inscritos (F)',
        'Total Inscritos',
        'Presentes (M)',
        'Presentes (F)',
        'Total Presentes',
        'Ausentes (M)',
        'Ausentes (F)',
        'Total Ausentes',
        '% Asistencia'
      ],
      data: excelRows,
      sheetName: 'Asistencia MINERD',
      fileName: `Asistencia_Diaria_MINERD_${selectedDate}.xlsx`,
      centerName: center?.name || 'Centro Educativo'
    });
  };

  return (
    <div className="space-y-6 text-left">
      {/* Barra Superior con Selector de Fecha y Acciones */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-wider">
              MINERD Oficial
            </span>
            <span className="text-slate-400 text-xs font-bold">1er Pase de Lista Diario</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Informe Diario de Asistencia
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Consolidado por nivel, grado y sexo para el reporte ministerial diario.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Selector de Fecha */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <Calendar size={16} className="text-indigo-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-black text-slate-800 outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={fetchAttendance}
            disabled={isLoading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all cursor-pointer"
            title="Recargar datos de la fecha"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin text-indigo-600' : ''} />
          </button>

          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-md transition-all cursor-pointer"
            title="Descargar PDF Oficial para MINERD"
          >
            <Download size={16} /> Descargar PDF
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-md transition-all cursor-pointer"
            title="Exportar a Excel"
          >
            <FileSpreadsheet size={16} /> Excel
          </button>
        </div>
      </div>

      {/* Tarjetas Resumen de Totales del Día */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
            Matrícula Total
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">
              {consolidatedReport.grandEnrolledTotal}
            </span>
            <span className="text-xs font-bold text-slate-500">
              M: {consolidatedReport.grandEnrolledM} | F: {consolidatedReport.grandEnrolledF}
            </span>
          </div>
        </div>

        <div className="bg-emerald-50/60 p-5 rounded-3xl border border-emerald-200/60 shadow-sm">
          <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest block mb-2">
            Total Presentes
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-emerald-700">
              {consolidatedReport.grandPresentTotal}
            </span>
            <span className="text-xs font-bold text-emerald-600">
              M: {consolidatedReport.grandPresentM} | F: {consolidatedReport.grandPresentF}
            </span>
          </div>
        </div>

        <div className="bg-rose-50/60 p-5 rounded-3xl border border-rose-200/60 shadow-sm">
          <span className="text-[10px] font-black text-rose-700 uppercase tracking-widest block mb-2">
            Total Ausentes
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-rose-700">
              {consolidatedReport.grandAbsentTotal}
            </span>
            <span className="text-xs font-bold text-rose-600">
              M: {consolidatedReport.grandAbsentM} | F: {consolidatedReport.grandAbsentF}
            </span>
          </div>
        </div>

        <div className="bg-indigo-50/60 p-5 rounded-3xl border border-indigo-200/60 shadow-sm">
          <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest block mb-2">
            % Asistencia General
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-indigo-700">
              {consolidatedReport.grandRate !== null ? `${consolidatedReport.grandRate}%` : '---'}
            </span>
            <span className="text-xs font-bold text-indigo-500">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-DO', { weekday: 'short' })}
            </span>
          </div>
        </div>
      </div>

      {/* Tabla Oficial de Asistencia por Niveles y Grados */}
      <div className="space-y-6">
        {consolidatedReport.levels.map((lvl: any) => (
          <div
            key={lvl.name}
            className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm"
          >
            {/* Cabecera del Nivel */}
            <div className="bg-slate-900 text-white px-6 py-3.5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full"></span>
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Nivel {lvl.name}
                </h3>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-300">
                <span>Inscritos: {lvl.subEnrolledTotal}</span>
                <span>Presentes: {lvl.subPresentTotal}</span>
                <span className="px-2.5 py-0.5 bg-indigo-800 text-indigo-200 rounded-full text-[10px] font-black">
                  {lvl.subRate !== null ? `${lvl.subRate}% Asistencia` : 'Sin pase'}
                </span>
              </div>
            </div>

            {/* Tabla del Nivel */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                    <th className="py-3 px-4" rowSpan={2}>Grado / Sección</th>
                    <th className="py-2 px-3 text-center border-l border-slate-200" colSpan={3}>Matrícula Inscrita</th>
                    <th className="py-2 px-3 text-center border-l border-slate-200 bg-emerald-50/50 text-emerald-800" colSpan={3}>Presentes</th>
                    <th className="py-2 px-3 text-center border-l border-slate-200 bg-rose-50/50 text-rose-800" colSpan={3}>Ausentes</th>
                    <th className="py-3 px-4 text-right border-l border-slate-200" rowSpan={2}>% Asist.</th>
                  </tr>
                  <tr className="bg-slate-50/80 text-[9px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-1 px-2 text-center border-l border-slate-200">Var</th>
                    <th className="py-1 px-2 text-center">Hem</th>
                    <th className="py-1 px-2 text-center font-bold">Total</th>
                    <th className="py-1 px-2 text-center border-l border-slate-200 text-blue-600">Var</th>
                    <th className="py-1 px-2 text-center text-rose-600">Hem</th>
                    <th className="py-1 px-2 text-center font-bold text-emerald-700">Total</th>
                    <th className="py-1 px-2 text-center border-l border-slate-200 text-blue-600">Var</th>
                    <th className="py-1 px-2 text-center text-rose-600">Hem</th>
                    <th className="py-1 px-2 text-center font-bold text-rose-700">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                  {lvl.grades.map((g: any) => (
                    <tr key={g.courseId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-black text-slate-900">{g.name}</td>
                      
                      {/* Inscritos */}
                      <td className="py-3 px-2 text-center border-l border-slate-100 text-slate-600">{g.enrolledM}</td>
                      <td className="py-3 px-2 text-center text-slate-600">{g.enrolledF}</td>
                      <td className="py-3 px-2 text-center font-black text-slate-900">{g.enrolledTotal}</td>
                      
                      {/* Presentes */}
                      <td className="py-3 px-2 text-center border-l border-slate-100 text-blue-600">
                        {g.hasTakenAttendance ? g.presentM : '-'}
                      </td>
                      <td className="py-3 px-2 text-center text-rose-600">
                        {g.hasTakenAttendance ? g.presentF : '-'}
                      </td>
                      <td className="py-3 px-2 text-center font-black text-emerald-700 bg-emerald-50/30">
                        {g.hasTakenAttendance ? g.presentTotal : '-'}
                      </td>

                      {/* Ausentes */}
                      <td className="py-3 px-2 text-center border-l border-slate-100 text-blue-600">
                        {g.hasTakenAttendance ? g.absentM : '-'}
                      </td>
                      <td className="py-3 px-2 text-center text-rose-600">
                        {g.hasTakenAttendance ? g.absentF : '-'}
                      </td>
                      <td className="py-3 px-2 text-center font-black text-rose-700 bg-rose-50/30">
                        {g.hasTakenAttendance ? g.absentTotal : '-'}
                      </td>

                      {/* % Asistencia */}
                      <td className="py-3 px-4 text-right border-l border-slate-100 font-black">
                        {g.rate !== null ? (
                          <span className={`px-2 py-0.5 rounded-lg text-xs ${g.rate >= 80 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                            {g.rate}%
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">Pendiente</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {/* Fila de Subtotal */}
                  <tr className="bg-slate-100/70 font-black text-slate-900 border-t-2 border-slate-200">
                    <td className="py-3 px-4 uppercase text-[10px] tracking-wider text-slate-600">
                      Subtotal Nivel {lvl.name}:
                    </td>
                    <td className="py-3 px-2 text-center border-l border-slate-200">{lvl.subEnrolledM}</td>
                    <td className="py-3 px-2 text-center">{lvl.subEnrolledF}</td>
                    <td className="py-3 px-2 text-center font-black text-slate-900">{lvl.subEnrolledTotal}</td>

                    <td className="py-3 px-2 text-center border-l border-slate-200 text-blue-700">{lvl.subPresentM}</td>
                    <td className="py-3 px-2 text-center text-rose-700">{lvl.subPresentF}</td>
                    <td className="py-3 px-2 text-center text-emerald-800 bg-emerald-100/50">{lvl.subPresentTotal}</td>

                    <td className="py-3 px-2 text-center border-l border-slate-200 text-blue-700">{lvl.subAbsentM}</td>
                    <td className="py-3 px-2 text-center text-rose-700">{lvl.subAbsentF}</td>
                    <td className="py-3 px-2 text-center text-rose-800 bg-rose-100/50">{lvl.subAbsentTotal}</td>

                    <td className="py-3 px-4 text-right border-l border-slate-200 text-indigo-700">
                      {lvl.subRate !== null ? `${lvl.subRate}%` : '---'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Fila de Gran Total Centro */}
        <div className="bg-indigo-950 text-white p-6 rounded-3xl shadow-lg border border-indigo-900 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest block mb-1">
              Consolidado Institucional
            </span>
            <h3 className="text-base font-black tracking-tight">
              Gran Total Asistencia Diaria del Centro
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-black">
            <div>
              <span className="text-slate-400 block text-[9px] uppercase">Matrícula</span>
              <span className="text-white text-base">{consolidatedReport.grandEnrolledTotal}</span>
            </div>
            <div className="border-l border-indigo-800 pl-4">
              <span className="text-emerald-400 block text-[9px] uppercase">Presentes</span>
              <span className="text-emerald-400 text-base">{consolidatedReport.grandPresentTotal}</span>
            </div>
            <div className="border-l border-indigo-800 pl-4">
              <span className="text-rose-400 block text-[9px] uppercase">Ausentes</span>
              <span className="text-rose-400 text-base">{consolidatedReport.grandAbsentTotal}</span>
            </div>
            <div className="border-l border-indigo-800 pl-4">
              <span className="text-indigo-300 block text-[9px] uppercase">% Asistencia</span>
              <span className="text-indigo-300 text-lg">
                {consolidatedReport.grandRate !== null ? `${consolidatedReport.grandRate}%` : '---'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
