import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { useApp } from '../context/AppContext';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList
} from 'recharts';
import { ArrowLeft, Download, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const rankingColors: Record<string, string> = {
  'Excelente': '#16a34a',
  'Muy Bueno': '#4ade80',
  'Bueno': '#3b82f6',
  'Regular': '#eab308',
  'En proceso': '#f87171'
};

const getRankingCategory = (avg: number) => {
  if (avg >= 95) return 'Excelente';
  if (avg >= 90) return 'Muy Bueno';
  if (avg >= 80) return 'Bueno';
  if (avg >= 70) return 'Regular';
  return 'En proceso';
};

interface ReportProps {
  onClose: () => void;
  period: string; // 'P1', 'P2', 'P3', 'P4', or 'FINAL'
  initialCourseId?: string;
}

export const CourseRecordReport: React.FC<ReportProps> = ({ onClose, period: initialPeriod, initialCourseId }) => {
  const { state, center, selectedYear } = useApp();
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || '');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(initialPeriod || 'P1');

  const courses = state.courses || [];
  
  // Initialize with first course if none selected and no initialCourseId
  React.useEffect(() => {
    if (!selectedCourseId && courses.length > 0) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  const courseData = useMemo(() => {
    if (!selectedCourseId) return null;

    const students = state.students?.filter((s: any) => s.course_id === selectedCourseId) || [];
    const subjects = state.subjects || [];
    const grades = state.grades?.filter((g: any) => g.course_id === selectedCourseId) || [];
    const course = courses.find((c: any) => c.id === selectedCourseId);
    const isSecondary = (course?.level || '').toLowerCase().includes('secundar');

    // Mapear calificaciones por estudiante -> materia -> periodo/competencia
    const gradesMap: Record<string, Record<string, Record<string, any>>> = {};
    students.forEach((s: any) => (gradesMap[s.id] = {}));

    grades.forEach((g: any) => {
      if (!gradesMap[g.student_id]) gradesMap[g.student_id] = {};
      if (!gradesMap[g.student_id][g.subject_id]) gradesMap[g.student_id][g.subject_id] = {};

      const sGrades = gradesMap[g.student_id][g.subject_id];
      const pL = (g.period || '').toLowerCase();

      if (g.grade !== null) sGrades[`${g.competency_id}_${pL}`] = g.grade;
      if (g.rp1 !== null) sGrades[`${g.competency_id}_rp1`] = g.rp1;
      if (g.rp2 !== null) sGrades[`${g.competency_id}_rp2`] = g.rp2;
      if (g.rp3 !== null) sGrades[`${g.competency_id}_rp3`] = g.rp3;
      if (g.rp4 !== null) sGrades[`${g.competency_id}_rp4`] = g.rp4;
    });

    let totalC1 = 0, countC1 = 0;
    let totalC2 = 0, countC2 = 0;
    let totalC3 = 0, countC3 = 0;
    let totalC4 = 0, countC4 = 0;
    let studentAverages: number[] = [];
    
    const subjectMetrics: Record<string, { total: number, count: number }> = {};
    const pendingSubjectsCount: Record<string, number> = {
      '1 Materia': 0,
      '2 Materias': 0,
      '3 Materias': 0,
      '4+ Materias': 0,
      'Ninguna': 0
    };

    const studentsDetail: any[] = [];

    students.forEach((s: any) => {
      let studentTotalScore = 0;
      let studentSubjectCount = 0;
      let pendingCount = 0;
      let pendingList: string[] = [];

      subjects.forEach((sub: any) => {
        const sGrades = gradesMap[s.id]?.[sub.id];
        if (!sGrades) return;

        const getBestGrade = (cId: string, p: string) =>
          Math.max(
            parseInt(sGrades[`${cId}_${p.toLowerCase()}`]) || 0,
            parseInt(sGrades[`${cId}_r${p.toLowerCase()}`]) || 0
          );

        let subC1 = 0, subC2 = 0, subC3 = 0, subC4 = 0;

        if (selectedPeriod === 'FINAL') {
          subC1 = Math.round((getBestGrade('c1', 'P1') + getBestGrade('c1', 'P2') + getBestGrade('c1', 'P3') + getBestGrade('c1', 'P4')) / 4);
          subC2 = Math.round((getBestGrade('c2', 'P1') + getBestGrade('c2', 'P2') + getBestGrade('c2', 'P3') + getBestGrade('c2', 'P4')) / 4);
          subC3 = Math.round((getBestGrade('c3', 'P1') + getBestGrade('c3', 'P2') + getBestGrade('c3', 'P3') + getBestGrade('c3', 'P4')) / 4);
          subC4 = Math.round((getBestGrade('c4', 'P1') + getBestGrade('c4', 'P2') + getBestGrade('c4', 'P3') + getBestGrade('c4', 'P4')) / 4);
        } else {
          subC1 = getBestGrade('c1', selectedPeriod);
          subC2 = getBestGrade('c2', selectedPeriod);
          subC3 = getBestGrade('c3', selectedPeriod);
          subC4 = getBestGrade('c4', selectedPeriod);
        }

        if (subC1 > 0) { totalC1 += subC1; countC1++; }
        if (subC2 > 0) { totalC2 += subC2; countC2++; }
        if (subC3 > 0) { totalC3 += subC3; countC3++; }
        if (subC4 > 0) { totalC4 += subC4; countC4++; }

        let subjectAvg = 0;
        let subCount = 0;
        if (subC1 > 0) subCount++;
        if (subC2 > 0) subCount++;
        if (subC3 > 0) subCount++;
        if (subC4 > 0) subCount++;

        if (subCount > 0) {
          subjectAvg = Math.round((subC1 + subC2 + subC3 + subC4) / subCount);
          studentTotalScore += subjectAvg;
          studentSubjectCount++;

          if (subjectAvg < 70) {
            pendingCount++;
            pendingList.push(sub.name || 'Materia');
          }

          if (!subjectMetrics[sub.id]) subjectMetrics[sub.id] = { total: 0, count: 0 };
          subjectMetrics[sub.id].total += subjectAvg;
          subjectMetrics[sub.id].count++;
        }
      });

      let avg = 0;
      if (studentSubjectCount > 0) {
        avg = Math.round(studentTotalScore / studentSubjectCount);
        studentAverages.push(avg);
      }

      if (pendingCount === 0) pendingSubjectsCount['Ninguna']++;
      else if (pendingCount === 1) pendingSubjectsCount['1 Materia']++;
      else if (pendingCount === 2) pendingSubjectsCount['2 Materias']++;
      else if (pendingCount === 3) pendingSubjectsCount['3 Materias']++;
      else pendingSubjectsCount['4+ Materias']++;

      let risk = 'Bajo';
      let riskColor = 'text-emerald-600 bg-emerald-50 border-emerald-200';
      if (pendingCount >= 3 || avg < 65) {
        risk = 'Alto';
        riskColor = 'text-rose-600 bg-rose-50 border-rose-200';
      } else if (pendingCount > 0 || avg < 75) {
        risk = 'Medio';
        riskColor = 'text-amber-600 bg-amber-50 border-amber-200';
      }

      studentsDetail.push({
        id: s.id,
        name: `${s.last_name || ''} ${s.first_name || ''}`.trim(),
        avg,
        pendingCount,
        pendingList: pendingList.join(', '),
        risk,
        riskColor,
        ranking: getRankingCategory(avg)
      });
    });

    studentsDetail.sort((a, b) => b.avg - a.avg);

    const avgC1 = countC1 > 0 ? Math.round(totalC1 / countC1) : 0;
    const avgC2 = countC2 > 0 ? Math.round(totalC2 / countC2) : 0;
    const avgC3 = countC3 > 0 ? Math.round(totalC3 / countC3) : 0;
    const avgC4 = countC4 > 0 ? Math.round(totalC4 / countC4) : 0;

    const rankingDist: Record<string, number> = {
      'Excelente': 0, 'Muy Bueno': 0, 'Bueno': 0, 'Regular': 0, 'En proceso': 0
    };
    let totalGlobalAvg = 0;
    studentAverages.forEach(avg => {
      totalGlobalAvg += avg;
      rankingDist[getRankingCategory(avg)]++;
    });
    const globalAverage = studentAverages.length > 0 ? Math.round(totalGlobalAvg / studentAverages.length) : 0;

    const subjectChartData = Object.keys(subjectMetrics).map(subId => {
      const sub = subjects.find((s: any) => s.id === subId);
      return {
        name: sub?.name || 'Materia Desconocida',
        promedio: Math.round(subjectMetrics[subId].total / subjectMetrics[subId].count)
      };
    }).sort((a, b) => b.promedio - a.promedio).slice(0, 8);

    return {
      course,
      isSecondary,
      totalStudents: students.length,
      evalStudents: studentAverages.length,
      globalAverage,
      competencies: { c1: avgC1, c2: avgC2, c3: avgC3, c4: avgC4 },
      rankingDist,
      pendingSubjectsCount,
      subjectChartData,
      studentsDetail
    };
  }, [state.students, state.courses, state.subjects, state.grades, selectedPeriod, selectedCourseId]);

  const downloadPDF = async () => {
    const input = document.getElementById('report-container');
    if (!input) return;

    try {
      const targetWidth = 1100;
      const originalWidth = input.style.width;
      const originalMaxWidth = input.style.maxWidth;
      const originalMargin = input.style.margin;

      input.style.width = `${targetWidth}px`;
      input.style.maxWidth = `${targetWidth}px`;
      input.style.margin = '0';

      const imgData = await toJpeg(input, { 
        quality: 1.0, 
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        skipFonts: false
      });
      
      input.style.width = originalWidth;
      input.style.maxWidth = originalMaxWidth;
      input.style.margin = originalMargin;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (input.offsetHeight * pdfWidth) / targetWidth;
      
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      pdf.save(`Record_Grado_${courseData?.course?.name || 'Curso'}_${selectedYear}.pdf`);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert('Hubo un error al generar el PDF: ' + (error?.message || error));
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] bg-slate-100 block print:bg-white print:relative print:z-auto print:h-auto overflow-y-auto">
      {/* Barra superior de controles */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 print:hidden shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-800 uppercase tracking-tight">Análisis de Riesgo Académico</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Grado: {courseData?.course?.level} {courseData?.course?.grade} {courseData?.course?.section ? `- Sección ${courseData?.course?.section}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            {['P1', 'P2', 'P3', 'P4', 'FINAL'].map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${selectedPeriod === p ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
              >
                {p}
              </button>
            ))}
          </div>

          <button onClick={downloadPDF} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all active:scale-95">
            <Download size={16} />
            Descargar en PDF
          </button>
        </div>
      </div>

      {/* DOCUMENTO IMPRIMIBLE */}
      <div id="report-container" className="max-w-[1200px] w-full mx-auto p-8 print:p-0 print:max-w-none bg-white my-8 print:my-0 rounded-2xl shadow-sm print:shadow-none min-h-screen h-fit pb-16">
        
        {/* ENCABEZADO OFICIAL */}
        <div className="flex flex-col items-center justify-center text-center mb-10 pb-6 border-b-2 border-slate-800">
          {center?.logo_url && (
            <img src={center.logo_url} alt="Logo del Centro" className="w-20 h-20 object-contain mb-3 grayscale print:grayscale-0" />
          )}
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{center?.name || 'Centro Educativo'}</h1>
          <h2 className="text-sm font-black text-slate-600 uppercase tracking-widest mt-1">Récord Académico de Grado</h2>
          <h3 className="text-xl font-bold text-indigo-700 mt-2">
            {courseData?.course?.level} {courseData?.course?.grade} {courseData?.course?.section ? `(Sección ${courseData?.course?.section})` : ''}
          </h3>
          
          <div className="flex gap-4 mt-4 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 px-4 py-1.5 rounded-full print:bg-transparent print:border print:border-slate-200">
            <span>Año Escolar: {selectedYear}</span>
            <span className="border-l border-slate-300 pl-4">Periodo: {selectedPeriod}</span>
            <span className="border-l border-slate-300 pl-4">Fecha: {new Date().toLocaleDateString('es-DO')}</span>
          </div>
        </div>

        {!courseData || courseData.evalStudents === 0 ? (
          <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest">
            <Info size={40} className="mx-auto mb-4 opacity-50" />
            No hay calificaciones registradas para este curso en este periodo.
          </div>
        ) : (
          <>
            {/* ESTADÍSTICAS MACRO */}
            <div className="mb-10 break-inside-avoid">
              <div className="flex items-center gap-3 mb-6 pb-2 border-b-2 border-indigo-600">
                <h2 className="text-xl font-black uppercase text-indigo-700">Métricas del Grado</h2>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                  {courseData.totalStudents} Estudiantes ({courseData.evalStudents} Evaluados)
                </span>
                <span className="text-xs font-bold text-white bg-slate-800 px-4 py-1.5 rounded-full ml-auto">
                  PROMEDIO DEL AULA: {courseData.globalAverage}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-6 print:gap-4">
                {/* 1. CLASIFICACIÓN DE RENDIMIENTO */}
                <div className="col-span-1 border border-slate-200 rounded-xl p-4 bg-slate-50 print:bg-white">
                  <h3 className="text-[10px] font-black uppercase text-slate-500 mb-2">Rendimiento Académico</h3>
                  <div className="h-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={Object.entries(courseData.rankingDist).filter(([_, v]) => (v as number) > 0).map(([name, value]) => ({ name, value, fill: rankingColors[name] }))} 
                          cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value"
                        >
                          {Object.entries(courseData.rankingDist).filter(([_, v]) => (v as number) > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={rankingColors[entry[0]]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1 mt-2">
                    {Object.entries(courseData.rankingDist).filter(([_, v]) => (v as number) > 0).map(([name, value]) => (
                      <div key={name} className="flex justify-between items-center text-[9px] font-bold">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: rankingColors[name] }}></span>
                          <span className="text-slate-600 uppercase">{name}</span>
                        </div>
                        <span className="text-slate-900">{value} <span className="text-slate-400 font-normal">({Math.round((value as number) / courseData.evalStudents * 100)}%)</span></span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. PROMEDIO POR ASIGNATURAS */}
                <div className="col-span-1 border border-slate-200 rounded-xl p-4 bg-slate-50 print:bg-white flex flex-col justify-between">
                  <h3 className="text-[10px] font-black uppercase text-slate-500 mb-2">Promedio por Asignaturas</h3>
                  <div className="flex-1 h-[180px] min-h-0 mt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={courseData.subjectChartData} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" domain={[0, 100]} hide />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 7, width: 70 }} width={70} />
                        <Tooltip contentStyle={{ fontSize: '9px', borderRadius: '8px' }} />
                        <Bar dataKey="promedio" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={12}>
                           <LabelList dataKey="promedio" position="right" style={{ fontSize: '8px', fontWeight: 'bold', fill: '#4f46e5' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 3. COMPETENCIAS Y MATERIAS */}
                <div className="col-span-1 border border-slate-200 rounded-xl p-4 bg-slate-50 print:bg-white flex flex-col justify-between">
                  <div>
                    <h3 className="text-[10px] font-black uppercase text-slate-500 mb-4 text-center">Promedio de Competencias</h3>
                    <div className="flex justify-around items-end h-[60px] mb-4">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-6 bg-indigo-200 rounded-t-sm flex items-end justify-center pb-0.5" style={{ height: `${courseData.competencies.c1}%` }}><span className="text-[7px] font-black text-indigo-900">{courseData.competencies.c1}</span></div>
                        <span className="text-[8px] font-black text-slate-500 uppercase">C1</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-6 bg-indigo-400 rounded-t-sm flex items-end justify-center pb-0.5" style={{ height: `${courseData.competencies.c2}%` }}><span className="text-[7px] font-black text-white">{courseData.competencies.c2}</span></div>
                        <span className="text-[8px] font-black text-slate-500 uppercase">C2</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-6 bg-indigo-600 rounded-t-sm flex items-end justify-center pb-0.5" style={{ height: `${courseData.competencies.c3}%` }}><span className="text-[7px] font-black text-white">{courseData.competencies.c3}</span></div>
                        <span className="text-[8px] font-black text-slate-500 uppercase">C3</span>
                      </div>
                      {(courseData.competencies.c4 > 0 || courseData.isSecondary) && (
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-6 bg-indigo-800 rounded-t-sm flex items-end justify-center pb-0.5" style={{ height: `${courseData.competencies.c4}%` }}><span className="text-[7px] font-black text-white">{courseData.competencies.c4}</span></div>
                          <span className="text-[8px] font-black text-slate-500 uppercase">C4</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <div className="bg-rose-50 text-rose-700 rounded-lg p-2.5 flex justify-between items-center text-[10px] font-black uppercase">
                      <div className="flex flex-col">
                        <span className="text-[7px] text-rose-400">Total en Riesgo (1+):</span>
                        <span>Alumnos en Riesgo</span>
                      </div>
                      <span className="text-lg">{courseData.evalStudents - courseData.pendingSubjectsCount['Ninguna']}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TABLA DETALLADA DE ALUMNOS (MICRO) */}
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-4 pb-2 border-b-2 border-slate-200">
                <h2 className="text-lg font-black uppercase text-slate-800">Detalle de Estudiantes</h2>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-auto">
                  Ordenado por promedio
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-300">
                      <th className="py-2 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-50">#</th>
                      <th className="py-2 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-50">Estudiante</th>
                      <th className="py-2 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 text-center">Promedio</th>
                      <th className="py-2 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 text-center">Pendientes</th>
                      <th className="py-2 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-50">Riesgo Académico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseData.studentsDetail.map((student: any, idx: number) => (
                      <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-1.5 px-4 text-xs font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-1.5 px-4">
                          <p className="text-sm font-bold text-slate-800 leading-tight">{student.name}</p>
                          {student.pendingCount > 0 && (
                            <p className="text-[9px] text-rose-500 font-medium truncate max-w-[300px] leading-tight">
                              Pendientes: {student.pendingList}
                            </p>
                          )}
                        </td>
                        <td className="py-1.5 px-4 text-center">
                          <span className="text-sm font-black text-slate-900">{student.avg > 0 ? student.avg : '-'}</span>
                          <span className="block text-[8px] font-bold text-slate-400 uppercase">{student.avg > 0 ? student.ranking : 'N/A'}</span>
                        </td>
                        <td className="py-1.5 px-4 text-center">
                          {student.pendingCount === 0 ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
                              <CheckCircle size={10} /> 0
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
                              <AlertTriangle size={10} /> {student.pendingCount}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-4">
                          <span className={`inline-block border px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${student.riskColor}`}>
                            {student.risk}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* PIE DE FIRMAS OFICIALES */}
        <div className="mt-20 pt-10 grid grid-cols-3 gap-8 text-center break-inside-avoid">
          <div>
            <div className="border-b border-slate-400 mx-auto w-40 mb-2"></div>
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{center?.director_name || 'Director/a'}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Dirección del Centro</p>
          </div>
          <div>
            <div className="border-b border-slate-400 mx-auto w-40 mb-2"></div>
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Docente Encargado/a</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Firma del Titular</p>
          </div>
          <div>
            <div className="border-b border-slate-400 mx-auto w-40 mb-2"></div>
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{center?.secretary_name || 'Secretario/a'}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Secretaría Docente</p>
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
