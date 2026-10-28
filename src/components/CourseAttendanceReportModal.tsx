import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Download,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Users,
  FileText,
  Filter,
  BarChart3,
  CalendarRange
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { exportGenericTableToExcel } from '../utils/listPdfGenerator';
import { sortStudents, getStudentOrderNumber } from '../utils/studentSorter';

interface CourseAttendanceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  courseName: string;
  courseLevel?: string;
  courseGrade?: string;
  courseSection?: string;
  students: any[];
  centerName?: string;
  selectedYear?: string;
  teacherName?: string;
}

type AttendanceStatus = 'presente' | 'tardanza' | 'excusa' | 'ausente';

interface DayRecord {
  status: AttendanceStatus;
  note: string;
}

export const CourseAttendanceReportModal: React.FC<CourseAttendanceReportModalProps> = ({
  isOpen,
  onClose,
  courseId,
  courseName,
  courseLevel = '',
  courseGrade = '',
  courseSection = '',
  students,
  centerName = 'Centro Educativo',
  selectedYear = '',
  teacherName = ''
}) => {
  // Helper para fechas por defecto (1er día del mes actual hasta hoy)
  const getInitialDates = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    const firstDayStr = `${y}-${m}-01`;
    return { firstDayStr, todayStr };
  };

  const { firstDayStr, todayStr } = useMemo(getInitialDates, []);

  const [startDate, setStartDate] = useState<string>(firstDayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [activeTab, setActiveTab] = useState<'matrix' | 'summary'>('matrix');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'absences' | 'tardiness' | 'at_risk'>('all');
  const [isLoading, setIsLoading] = useState(false);

  // Mapa de asistencia: [studentId][date] => { status, note }
  // y conjunto de fechas donde se pasó lista en el curso
  const [attendanceData, setAttendanceData] = useState<{
    recordedDates: string[];
    recordsMap: Record<string, Record<string, DayRecord>>;
  }>({
    recordedDates: [],
    recordsMap: {}
  });

  // Helper para nombre completo
  const getStudentDisplayName = (s: any): string => {
    if (!s) return 'Estudiante';
    if (s.first_surname || s.second_surname) {
      const surname = `${s.first_surname || ''} ${s.second_surname || ''}`.trim();
      const names = (s.names || s.first_name || s.nombre || '').trim();
      if (names && surname) return `${names} ${surname}`;
      if (names) return names;
      if (surname) return surname;
    }
    return (
      s.names ||
      s.full_name ||
      s.name ||
      `${s.firstName || ''} ${s.lastName || ''}`.trim() ||
      'Estudiante'
    );
  };

  // Cargar asistencia de Supabase y localStorage
  const fetchCourseAttendance = async () => {
    if (!courseId || !startDate || !endDate) return;
    setIsLoading(true);

    try {
      // 1. Consultar registros en Supabase para el curso y rango de fecha
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('course_id', courseId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) {
        console.warn('Error fetching attendance from Supabase:', error);
      }

      const cloudRows = data || [];

      // Fechas donde hubo pase de lista (por checkpoint maestro o registros individuales)
      const dateSet = new Set<string>();
      cloudRows.forEach((r: any) => {
        if (r.date) dateSet.add(r.date);
      });

      // 2. Revisar localStorage por pases de lista offline o locales
      // Clave: attendance_${courseId}_${date}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`attendance_${courseId}_`)) {
          const datePart = k.replace(`attendance_${courseId}_`, '');
          if (datePart >= startDate && datePart <= endDate) {
            dateSet.add(datePart);
          }
        }
      }

      // Fechas ordenadas cronológicamente
      const sortedDates = Array.from(dateSet).sort();

      // 3. Reconstruir el mapa de asistencia por estudiante y por fecha
      const map: Record<string, Record<string, DayRecord>> = {};
      const studentIds = new Set(students.map((s) => String(s.id)));

      // Inicializar mapa de estudiantes
      studentIds.forEach((sId) => {
        map[sId] = {};
      });

      // Procesar cada fecha
      sortedDates.forEach((date) => {
        const localKey = `attendance_${courseId}_${date}`;
        const localSaved = localStorage.getItem(localKey);
        let localParsed: Record<string, { status: AttendanceStatus; note: string }> | null = null;
        if (localSaved) {
          try {
            localParsed = JSON.parse(localSaved);
          } catch {}
        }

        // Filtro de filas de la nube para esta fecha
        const dateRows = cloudRows.filter((r: any) => r.date === date);
        const hasDateRecords = dateRows.length > 0 || localParsed !== null;

        if (hasDateRecords) {
          studentIds.forEach((sId) => {
            // Caso A: existe en localStorage
            if (localParsed && localParsed[sId]) {
              map[sId][date] = {
                status: localParsed[sId].status || 'presente',
                note: localParsed[sId].note || ''
              };
              return;
            }

            // Caso B: existe registro individual en BD
            const row = dateRows.find((r: any) => String(r.student_id) === sId);
            if (row) {
              map[sId][date] = {
                status: (row.status as AttendanceStatus) || 'presente',
                note: row.notes || ''
              };
              return;
            }

            // Caso C: no hay excepción, pero el curso tiene pase de lista en esta fecha -> presente
            map[sId][date] = {
              status: 'presente',
              note: ''
            };
          });
        }
      });

      setAttendanceData({
        recordedDates: sortedDates,
        recordsMap: map
      });
    } catch (err: any) {
      console.error('Error loading course attendance report:', err);
      toast.error('Error al consultar los registros de asistencia');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCourseAttendance();
    }
  }, [isOpen, courseId, startDate, endDate]);

  // Lista ordenada de estudiantes
  const sortedStudentList = useMemo(() => {
    return sortStudents(students || []);
  }, [students]);

  // Estadísticas consolidadas por estudiante
  const studentStats = useMemo(() => {
    const totalDays = attendanceData.recordedDates.length;

    return sortedStudentList.map((s: any, idx: number) => {
      const sId = String(s.id);
      const sRecords = attendanceData.recordsMap[sId] || {};

      let presentes = 0;
      let tardanzas = 0;
      let excusas = 0;
      let ausencias = 0;

      attendanceData.recordedDates.forEach((date) => {
        const rec = sRecords[date];
        const status = rec?.status || 'presente';
        if (status === 'presente') presentes++;
        else if (status === 'tardanza') tardanzas++;
        else if (status === 'excusa') excusas++;
        else if (status === 'ausente') ausencias++;
      });

      // % de asistencia según estándar MINERD: (presentes + tardanzas) / días
      const attendanceRate =
        totalDays > 0 ? Math.round(((presentes + tardanzas) / totalDays) * 100) : 100;

      return {
        student: s,
        orderNumber: getStudentOrderNumber(s) ?? idx + 1,
        fullName: getStudentDisplayName(s),
        rne: s.sigerd_number || s.rne || s.sigerd_code || s.sigerdCode || '---',
        records: sRecords,
        presentes,
        tardanzas,
        excusas,
        ausencias,
        totalDays,
        attendanceRate,
        isAtRisk: totalDays > 0 && attendanceRate < 80
      };
    });
  }, [sortedStudentList, attendanceData]);

  // Resumen global del curso
  const courseGlobalStats = useMemo(() => {
    const totalDays = attendanceData.recordedDates.length;
    const totalStudents = studentStats.length;

    let sumPresentes = 0;
    let sumTardanzas = 0;
    let sumExcusas = 0;
    let sumAusencias = 0;
    let sumRates = 0;
    let atRiskCount = 0;
    let perfectCount = 0;

    studentStats.forEach((st) => {
      sumPresentes += st.presentes;
      sumTardanzas += st.tardanzas;
      sumExcusas += st.excusas;
      sumAusencias += st.ausencias;
      sumRates += st.attendanceRate;
      if (st.isAtRisk) atRiskCount++;
      if (st.totalDays > 0 && st.attendanceRate === 100) perfectCount++;
    });

    const averageRate = totalStudents > 0 ? Math.round(sumRates / totalStudents) : 100;

    return {
      totalDays,
      totalStudents,
      sumPresentes,
      sumTardanzas,
      sumExcusas,
      sumAusencias,
      averageRate,
      atRiskCount,
      perfectCount
    };
  }, [studentStats, attendanceData.recordedDates]);

  // Filtrado de estudiantes para la vista
  const filteredStudentStats = useMemo(() => {
    return studentStats.filter((st) => {
      // Filtro de búsqueda
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = st.fullName.toLowerCase().includes(term);
        const matchesRne = st.rne.toLowerCase().includes(term);
        if (!matchesName && !matchesRne) return false;
      }

      // Filtro por tipo de incidencia
      if (filterType === 'absences' && st.ausencias === 0) return false;
      if (filterType === 'tardiness' && st.tardanzas === 0) return false;
      if (filterType === 'at_risk' && !st.isAtRisk) return false;

      return true;
    });
  }, [studentStats, searchTerm, filterType]);

  // Atajos rápidos de rango de fechas
  const setQuickRange = (range: 'this_month' | 'last_month' | 'last_15' | 'last_30' | 'school_year') => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (range === 'this_month') {
      const first = new Date(y, m, 1).toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];
      setStartDate(first);
      setEndDate(today);
    } else if (range === 'last_month') {
      const first = new Date(y, m - 1, 1).toISOString().split('T')[0];
      const last = new Date(y, m, 0).toISOString().split('T')[0];
      setStartDate(first);
      setEndDate(last);
    } else if (range === 'last_15') {
      const past = new Date();
      past.setDate(past.getDate() - 15);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (range === 'last_30') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (range === 'school_year') {
      // Año escolar en RD suele iniciar a finales de agosto / septiembre
      const schoolYearStartYear = m >= 7 ? y : y - 1;
      setStartDate(`${schoolYearStartYear}-09-01`);
      setEndDate(now.toISOString().split('T')[0]);
    }
  };

  // Exportar a Excel
  const handleExportExcel = () => {
    if (studentStats.length === 0) {
      toast.error('No hay estudiantes para exportar');
      return;
    }

    const dateHeaders = attendanceData.recordedDates.map((d) => {
      const parts = d.split('-');
      return `${parts[2]}/${parts[1]}`;
    });

    const headers = [
      'Nº',
      'Estudiante',
      'Cód. SIGERD / RNE',
      'Días Evaluados',
      'Presentes (P)',
      'Tardanzas (T)',
      'Excusas (E)',
      'Ausencias (A)',
      '% Asistencia',
      ...dateHeaders
    ];

    const excelRows = studentStats.map((st) => {
      const dateValues = attendanceData.recordedDates.map((d) => {
        const rec = st.records[d];
        const status = rec?.status || 'presente';
        if (status === 'presente') return 'P';
        if (status === 'tardanza') return 'T';
        if (status === 'excusa') return 'E';
        if (status === 'ausente') return 'A';
        return '-';
      });

      return [
        st.orderNumber,
        st.fullName.toUpperCase(),
        st.rne,
        st.totalDays,
        st.presentes,
        st.tardanzas,
        st.excusas,
        st.ausencias,
        `${st.attendanceRate}%`,
        ...dateValues
      ];
    });

    exportGenericTableToExcel({
      title: `Reporte de Asistencia del Curso - ${courseName}`,
      subtitle: `Rango: ${startDate} al ${endDate} | Días con Pase de Lista: ${attendanceData.recordedDates.length} | Año Escolar: ${selectedYear}`,
      headers,
      data: excelRows,
      sheetName: 'Asistencia Curso',
      fileName: `Asistencia_${courseName.replace(/\s+/g, '_')}_${startDate}_a_${endDate}.xlsx`,
      centerName
    });

    toast.success('¡Reporte exportado a Excel con éxito!');
  };

  // Exportar a PDF
  const handleExportPDF = () => {
    if (studentStats.length === 0) {
      toast.error('No hay datos para generar el PDF');
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: attendanceData.recordedDates.length > 8 ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'letter'
      });

      const pageWidth = doc.internal.pageSize.getWidth();

      // Encabezado institucional
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(centerName.toUpperCase(), pageWidth / 2, 14, { align: 'center' });

      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229);
      doc.text('INFORME CONSOLIDADO DE ASISTENCIA POR CURSO', pageWidth / 2, 20, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Curso: ${courseName}   |   Rango: ${startDate} al ${endDate}   |   Año Escolar: ${selectedYear || 'Vigente'}`,
        pageWidth / 2,
        25,
        { align: 'center' }
      );

      // Resumen estadístico
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 28, pageWidth - 28, 12, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);

      const metricCol = (pageWidth - 28) / 6;
      doc.text(`Días Evaluados: ${courseGlobalStats.totalDays}`, 14 + 4, 35);
      doc.text(`Matrícula: ${courseGlobalStats.totalStudents}`, 14 + metricCol * 1.2, 35);
      doc.text(`Presentes Totales: ${courseGlobalStats.sumPresentes}`, 14 + metricCol * 2.2, 35);
      doc.text(`Tardanzas: ${courseGlobalStats.sumTardanzas}`, 14 + metricCol * 3.4, 35);
      doc.text(`Ausencias: ${courseGlobalStats.sumAusencias}`, 14 + metricCol * 4.4, 35);
      doc.text(`% Asistencia Promedio: ${courseGlobalStats.averageRate}%`, 14 + metricCol * 5.2, 35);

      // Si hay pocas fechas (<= 14), incluimos las columnas de fecha en la tabla
      const includeDateCols = attendanceData.recordedDates.length <= 14;

      const dateHeaders = includeDateCols
        ? attendanceData.recordedDates.map((d) => {
            const p = d.split('-');
            return `${p[2]}/${p[1]}`;
          })
        : [];

      const tableHead = [
        ['#', 'Estudiante', 'RNE / SIGERD', 'Días', 'P', 'T', 'E', 'A', '% Asist.', ...dateHeaders]
      ];

      const tableBody = studentStats.map((st) => {
        const dateVals = includeDateCols
          ? attendanceData.recordedDates.map((d) => {
              const rec = st.records[d];
              const status = rec?.status || 'presente';
              if (status === 'presente') return 'P';
              if (status === 'tardanza') return 'T';
              if (status === 'excusa') return 'E';
              if (status === 'ausente') return 'A';
              return '-';
            })
          : [];

        return [
          st.orderNumber,
          st.fullName.toUpperCase(),
          st.rne,
          st.totalDays,
          st.presentes,
          st.tardanzas,
          st.excusas,
          st.ausencias,
          `${st.attendanceRate}%`,
          ...dateVals
        ];
      });

      autoTable(doc, {
        startY: 43,
        head: tableHead,
        body: tableBody,
        theme: 'grid',
        styles: {
          fontSize: includeDateCols ? 7 : 8,
          cellPadding: 1.5,
          valign: 'middle',
          halign: 'center'
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: includeDateCols ? 7 : 8
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: includeDateCols ? 48 : 70, halign: 'left', fontStyle: 'bold' },
          2: { cellWidth: 24, halign: 'center' },
          3: { cellWidth: 10, halign: 'center' },
          4: { cellWidth: 10, halign: 'center' },
          5: { cellWidth: 10, halign: 'center' },
          6: { cellWidth: 10, halign: 'center' },
          7: { cellWidth: 10, halign: 'center' },
          8: { cellWidth: 16, halign: 'center', fontStyle: 'bold' }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        }
      });

      // Pie de firmas
      const finalY = (doc as any).lastAutoTable.finalY || 160;
      const sigY = finalY + 16 > doc.internal.pageSize.getHeight() - 25
        ? (doc.addPage(), 30)
        : finalY + 16;

      const colW = (pageWidth - 28) / 2;

      // 1. Docente
      doc.setDrawColor(148, 163, 184);
      doc.line(20, sigY, 20 + colW - 15, sigY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      if (teacherName) {
        doc.text(teacherName.toUpperCase(), 20 + (colW - 15) / 2, sigY + 4, { align: 'center' });
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('DOCENTE / TITULAR DEL CURSO', 20 + (colW - 15) / 2, sigY + 8, { align: 'center' });

      // 2. Coordinación / Dirección
      doc.line(pageWidth - 20 - colW + 15, sigY, pageWidth - 20, sigY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text('DIRECCIÓN / COORDINACIÓN', pageWidth - 20 - (colW - 15) / 2, sigY + 4, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('FIRMA Y SELLO OFICIAL', pageWidth - 20 - (colW - 15) / 2, sigY + 8, { align: 'center' });

      doc.save(
        `Reporte_Asistencia_${courseName.replace(/\s+/g, '_')}_${startDate}_a_${endDate}.pdf`
      );
      toast.success('¡Informe de asistencia descargado en PDF!');
    } catch (err: any) {
      console.error('Error generando PDF de asistencia:', err);
      toast.error('Error al generar el archivo PDF');
    }
  };

  // Imprimir reporte
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-7xl max-h-[92vh] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        {/* ENCABEZADO DEL MODAL */}
        <div className="p-5 md:px-8 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-blue/10 text-brand-blue dark:bg-indigo-950/60 dark:text-indigo-400 rounded-2xl">
              <CalendarRange size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                  {courseLevel || 'Curso'}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {centerName} {selectedYear ? `• ${selectedYear}` : ''}
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Reporte de Asistencia del Curso: {courseName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Descargar tabla en formato Excel (.xlsx)"
            >
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Descargar informe oficial en PDF"
            >
              <Download size={16} /> PDF
            </button>
            <button
              onClick={handlePrint}
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-all cursor-pointer"
              title="Imprimir vista"
            >
              <Printer size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl transition-all cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Cerrar ventana"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* CONTROLES Y FILTROS */}
        <div className="p-4 md:px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Selector de Rango de Fechas */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-black uppercase text-slate-400">Desde:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-black uppercase text-slate-400">Hasta:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                />
              </div>

              <button
                onClick={fetchCourseAttendance}
                disabled={isLoading}
                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                title="Actualizar datos"
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin text-indigo-600' : ''} />
              </button>
            </div>

            {/* Atajos de Fecha */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
              <span className="text-slate-400 uppercase tracking-wider text-[9px] mr-1">Rápido:</span>
              <button
                onClick={() => setQuickRange('this_month')}
                className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
              >
                Este Mes
              </button>
              <button
                onClick={() => setQuickRange('last_month')}
                className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
              >
                Mes Anterior
              </button>
              <button
                onClick={() => setQuickRange('last_15')}
                className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
              >
                Últimos 15 Días
              </button>
              <button
                onClick={() => setQuickRange('last_30')}
                className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
              >
                Últimos 30 Días
              </button>
              <button
                onClick={() => setQuickRange('school_year')}
                className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
              >
                Año Escolar
              </button>
            </div>
          </div>

          {/* Segunda barra: Buscador y selector de incidencia */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Buscar alumno por nombre o RNE..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                <Filter size={12} /> Filtrar:
              </span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="all">Todos los alumnos ({studentStats.length})</option>
                <option value="absences">Con Ausencias</option>
                <option value="tardiness">Con Tardanzas</option>
                <option value="at_risk">En Riesgo de Inasistencia (&lt;80%)</option>
              </select>

              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 ml-2">
                <button
                  onClick={() => setActiveTab('matrix')}
                  className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'matrix'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  Matriz Calendario
                </button>
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'summary'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  Resumen de Alumnos
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* TARJETAS DE ESTADÍSTICAS DEL RANGO */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 p-4 md:px-8 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800 text-xs">
          <div className="bg-white dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Días con Pase de Lista
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {courseGlobalStats.totalDays}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">días</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              % Asistencia Promedio
            </span>
            <div className="flex items-baseline justify-between">
              <span
                className={`text-2xl font-black ${
                  courseGlobalStats.averageRate >= 90
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : courseGlobalStats.averageRate >= 80
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {courseGlobalStats.averageRate}%
              </span>
              <span className="text-[10px] text-slate-400 font-bold">general</span>
            </div>
          </div>

          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-3 rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 shadow-2xs">
            <span className="text-[9.5px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block mb-1">
              Total Presentes
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                {courseGlobalStats.sumPresentes}
              </span>
              <span className="text-[10px] text-emerald-600 font-bold">asistencias</span>
            </div>
          </div>

          <div className="bg-amber-50/60 dark:bg-amber-950/20 p-3 rounded-2xl border border-amber-200/60 dark:border-amber-800/40 shadow-2xs">
            <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 block mb-1">
              Total Tardanzas
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-700 dark:text-amber-300">
                {courseGlobalStats.sumTardanzas}
              </span>
              <span className="text-[10px] text-amber-600 font-bold">atrasos</span>
            </div>
          </div>

          <div className="bg-indigo-50/60 dark:bg-indigo-950/20 p-3 rounded-2xl border border-indigo-200/60 dark:border-indigo-800/40 shadow-2xs">
            <span className="text-[9.5px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block mb-1">
              Total Excusas
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-indigo-700 dark:text-indigo-300">
                {courseGlobalStats.sumExcusas}
              </span>
              <span className="text-[10px] text-indigo-600 font-bold">justificadas</span>
            </div>
          </div>

          <div className="bg-rose-50/60 dark:bg-rose-950/20 p-3 rounded-2xl border border-rose-200/60 dark:border-rose-800/40 shadow-2xs">
            <span className="text-[9.5px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-300 block mb-1">
              Total Ausencias
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-rose-700 dark:text-rose-300">
                {courseGlobalStats.sumAusencias}
              </span>
              <span className="text-[10px] text-rose-600 font-bold">faltas</span>
            </div>
          </div>
        </div>

        {/* LEYENDA RÁPIDA */}
        <div className="px-4 md:px-8 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-500">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-bold text-slate-400 uppercase text-[9px]">Convenciones:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-black flex items-center justify-center text-[10px]">
                P
              </span>
              <span>Presente</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-black flex items-center justify-center text-[10px]">
                T
              </span>
              <span>Tardanza</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 font-black flex items-center justify-center text-[10px]">
                E
              </span>
              <span>Excusa</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 font-black flex items-center justify-center text-[10px]">
                A
              </span>
              <span>Ausente</span>
            </div>
          </div>

          <div className="text-slate-400 font-medium text-[10px]">
            Mostrando {filteredStudentStats.length} de {studentStats.length} estudiantes
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL SCROLLABLE */}
        <div className="flex-1 overflow-auto p-4 md:px-8">
          {isLoading ? (
            <div className="py-20 text-center">
              <RefreshCw className="animate-spin text-brand-blue mx-auto mb-3" size={32} />
              <p className="text-xs font-bold text-slate-500">Cargando reporte de asistencia del curso...</p>
            </div>
          ) : attendanceData.recordedDates.length === 0 ? (
            <div className="py-16 text-center max-w-md mx-auto space-y-3">
              <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-3xl mx-auto flex items-center justify-center">
                <Calendar size={28} />
              </div>
              <h3 className="text-base font-black text-slate-800 dark:text-white">
                No se encontraron pases de lista en este rango
              </h3>
              <p className="text-xs text-slate-500">
                No hay registros de asistencia entre el <span className="font-bold text-slate-700 dark:text-slate-300">{startDate}</span> y el <span className="font-bold text-slate-700 dark:text-slate-300">{endDate}</span> para este curso. Puedes cambiar el rango de fechas con los botones superiores o pasar lista en el panel principal.
              </p>
            </div>
          ) : activeTab === 'matrix' ? (
            /* TAB 1: TABLA MATRIZ CALENDARIO */
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-2.5 text-center sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 min-w-[36px]">
                      #
                    </th>
                    <th className="px-4 py-2.5 sticky left-[36px] z-20 bg-slate-100 dark:bg-slate-800 min-w-[200px]">
                      Estudiante
                    </th>
                    <th className="px-3 py-2.5 text-center min-w-[100px]">RNE</th>
                    <th className="px-2 py-2.5 text-center bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 min-w-[45px]">
                      Días
                    </th>
                    <th className="px-2 py-2.5 text-center bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 min-w-[40px]">
                      P
                    </th>
                    <th className="px-2 py-2.5 text-center bg-amber-50/60 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 min-w-[40px]">
                      T
                    </th>
                    <th className="px-2 py-2.5 text-center bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 min-w-[40px]">
                      E
                    </th>
                    <th className="px-2 py-2.5 text-center bg-rose-50/60 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 min-w-[40px]">
                      A
                    </th>
                    <th className="px-3 py-2.5 text-center min-w-[65px] font-black">
                      % Asist.
                    </th>

                    {/* Columnas de Fechas */}
                    {attendanceData.recordedDates.map((date) => {
                      const [yr, mo, da] = date.split('-');
                      const dObj = new Date(Number(yr), Number(mo) - 1, Number(da));
                      const dayName = dObj
                        .toLocaleDateString('es-DO', { weekday: 'short' })
                        .replace('.', '');

                      return (
                        <th
                          key={date}
                          className="px-2 py-2 text-center min-w-[50px] border-l border-slate-200 dark:border-slate-700 hover:bg-slate-200/50 transition-colors"
                          title={date}
                        >
                          <div className="flex flex-col items-center">
                            <span className="text-[8px] font-bold text-slate-400 capitalize">
                              {dayName}
                            </span>
                            <span className="text-[10px] font-black text-slate-800 dark:text-slate-100">
                              {da}/{mo}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {filteredStudentStats.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9 + attendanceData.recordedDates.length}
                        className="py-10 text-center text-slate-400 font-bold"
                      >
                        No se encontraron estudiantes con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredStudentStats.map((st) => (
                      <tr
                        key={st.student.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                          st.isAtRisk ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''
                        }`}
                      >
                        {/* # Orden */}
                        <td className="px-3 py-2 text-center font-bold text-slate-400 sticky left-0 z-10 bg-white dark:bg-slate-900">
                          {st.orderNumber}
                        </td>

                        {/* Nombre del estudiante */}
                        <td className="px-4 py-2 font-bold text-slate-900 dark:text-white sticky left-[36px] z-10 bg-white dark:bg-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{st.fullName}</span>
                            {st.isAtRisk && (
                              <span
                                className="px-1.5 py-0.2 bg-rose-500 text-white text-[8px] font-black rounded-full"
                                title="Riesgo de reprobación por inasistencia (<80%)"
                              >
                                Riesgo
                              </span>
                            )}
                          </div>
                        </td>

                        {/* RNE */}
                        <td className="px-3 py-2 text-center text-[10px] font-mono text-slate-500 whitespace-nowrap">
                          {st.rne}
                        </td>

                        {/* Totales */}
                        <td className="px-2 py-2 text-center font-bold text-slate-700 dark:text-slate-300 bg-indigo-50/20 dark:bg-indigo-950/20">
                          {st.totalDays}
                        </td>
                        <td className="px-2 py-2 text-center font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/20">
                          {st.presentes}
                        </td>
                        <td className="px-2 py-2 text-center font-black text-amber-600 dark:text-amber-400 bg-amber-50/20 dark:bg-amber-950/20">
                          {st.tardanzas}
                        </td>
                        <td className="px-2 py-2 text-center font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/20">
                          {st.excusas}
                        </td>
                        <td className="px-2 py-2 text-center font-black text-rose-600 dark:text-rose-400 bg-rose-50/20 dark:bg-rose-950/20">
                          {st.ausencias}
                        </td>

                        {/* % Asistencia */}
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-black ${
                              st.attendanceRate >= 90
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                                : st.attendanceRate >= 80
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
                            }`}
                          >
                            {st.attendanceRate}%
                          </span>
                        </td>

                        {/* Celdas de fechas individuales */}
                        {attendanceData.recordedDates.map((date) => {
                          const rec = st.records[date];
                          const status = rec?.status || 'presente';
                          const note = rec?.note;

                          return (
                            <td
                              key={date}
                              className="px-1.5 py-1.5 text-center border-l border-slate-100 dark:border-slate-800"
                              title={`${date}: ${status.toUpperCase()}${note ? ` (${note})` : ''}`}
                            >
                              {status === 'presente' ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-black text-[10px]">
                                  P
                                </span>
                              ) : status === 'tardanza' ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-black text-[10px]">
                                  T
                                </span>
                              ) : status === 'excusa' ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 font-black text-[10px]">
                                  E
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-black text-[10px]">
                                  A
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* TAB 2: RESUMEN Y DIAGNÓSTICO DE ALUMNOS */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStudentStats.map((st) => (
                <div
                  key={st.student.id}
                  className={`p-4 rounded-3xl border transition-all ${
                    st.isAtRisk
                      ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 shadow-xs'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-2xs hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs flex items-center justify-center">
                        {st.orderNumber}
                      </span>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                          {st.fullName}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {st.rne}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-xl text-xs font-black ${
                        st.attendanceRate >= 90
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                          : st.attendanceRate >= 80
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                          : 'bg-rose-500 text-white'
                      }`}
                    >
                      {st.attendanceRate}%
                    </span>
                  </div>

                  {/* Barra de progreso */}
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 mb-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        st.attendanceRate >= 90
                          ? 'bg-emerald-500'
                          : st.attendanceRate >= 80
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${st.attendanceRate}%` }}
                    />
                  </div>

                  {/* Desglose de contadores */}
                  <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-bold">
                    <div className="p-1.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                      <span className="block text-[8.5px] uppercase text-emerald-500">Presente</span>
                      <span className="font-black text-xs">{st.presentes}</span>
                    </div>
                    <div className="p-1.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                      <span className="block text-[8.5px] uppercase text-amber-500">Tardanza</span>
                      <span className="font-black text-xs">{st.tardanzas}</span>
                    </div>
                    <div className="p-1.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                      <span className="block text-[8.5px] uppercase text-indigo-500">Excusa</span>
                      <span className="font-black text-xs">{st.excusas}</span>
                    </div>
                    <div className="p-1.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
                      <span className="block text-[8.5px] uppercase text-rose-500">Ausente</span>
                      <span className="font-black text-xs">{st.ausencias}</span>
                    </div>
                  </div>

                  {st.isAtRisk && (
                    <div className="mt-2.5 pt-2 border-t border-rose-200 dark:border-rose-900/50 flex items-center gap-1.5 text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                      <AlertCircle size={13} />
                      <span>Alerta: Menos del 80% de asistencia obligatoria</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PIE DEL MODAL */}
        <div className="p-4 md:px-8 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 font-medium">
            Registros sincronizados con la nube y almacenamiento local del centro.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
