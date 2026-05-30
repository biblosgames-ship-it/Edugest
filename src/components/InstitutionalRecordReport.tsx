import React, { useMemo, useEffect, useState } from 'react';
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
import { ArrowLeft, Printer, Download } from 'lucide-react';

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
}

export const InstitutionalRecordReport: React.FC<ReportProps> = ({ onClose, period }) => {
  const { state, center, selectedYear } = useApp();

  const dataByLevel = useMemo(() => {
    const students = state.students || [];
    const courses = state.courses || [];
    const subjects = state.subjects || [];
    const grades = state.grades || [];

    // Mapear cursos para acceso rápido
    const courseMap: Record<string, any> = {};
    courses.forEach((c: any) => { courseMap[c.id] = c; });

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

    const calculateMetrics = (filterLevel: 'Primaria' | 'Secundaria' | 'General') => {
      let filteredStudents = students;
      
      if (filterLevel !== 'General') {
        filteredStudents = students.filter((s: any) => {
          const c = courseMap[s.course_id];
          const lvl = (c?.level || '').toLowerCase();
          return filterLevel === 'Primaria' ? lvl.includes('primar') : lvl.includes('secundar');
        });
      }

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

      filteredStudents.forEach((s: any) => {
        let studentTotalScore = 0;
        let studentSubjectCount = 0;
        let pendingCount = 0;

        subjects.forEach((sub: any) => {
          // Si el estudiante no está en un curso, saltar (o si la materia no aplica)
          // Simplificación: evaluamos si tiene calificaciones de esta materia
          const sGrades = gradesMap[s.id]?.[sub.id];
          if (!sGrades) return;

          const getBestGrade = (cId: string, p: string) =>
            Math.max(
              parseInt(sGrades[`${cId}_${p.toLowerCase()}`]) || 0,
              parseInt(sGrades[`${cId}_r${p.toLowerCase()}`]) || 0
            );

          let subC1 = 0, subC2 = 0, subC3 = 0, subC4 = 0;

          if (period === 'FINAL') {
            subC1 = Math.round((getBestGrade('c1', 'P1') + getBestGrade('c1', 'P2') + getBestGrade('c1', 'P3') + getBestGrade('c1', 'P4')) / 4);
            subC2 = Math.round((getBestGrade('c2', 'P1') + getBestGrade('c2', 'P2') + getBestGrade('c2', 'P3') + getBestGrade('c2', 'P4')) / 4);
            subC3 = Math.round((getBestGrade('c3', 'P1') + getBestGrade('c3', 'P2') + getBestGrade('c3', 'P3') + getBestGrade('c3', 'P4')) / 4);
            subC4 = Math.round((getBestGrade('c4', 'P1') + getBestGrade('c4', 'P2') + getBestGrade('c4', 'P3') + getBestGrade('c4', 'P4')) / 4);
          } else {
            subC1 = getBestGrade('c1', period);
            subC2 = getBestGrade('c2', period);
            subC3 = getBestGrade('c3', period);
            subC4 = getBestGrade('c4', period);
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

            if (subjectAvg < 70) pendingCount++;

            if (!subjectMetrics[sub.id]) subjectMetrics[sub.id] = { total: 0, count: 0 };
            subjectMetrics[sub.id].total += subjectAvg;
            subjectMetrics[sub.id].count++;
          }
        });

        if (studentSubjectCount > 0) {
          studentAverages.push(Math.round(studentTotalScore / studentSubjectCount));
        }

        if (pendingCount === 0) pendingSubjectsCount['Ninguna']++;
        else if (pendingCount === 1) pendingSubjectsCount['1 Materia']++;
        else if (pendingCount === 2) pendingSubjectsCount['2 Materias']++;
        else if (pendingCount === 3) pendingSubjectsCount['3 Materias']++;
        else pendingSubjectsCount['4+ Materias']++;
      });

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
      }).sort((a, b) => b.promedio - a.promedio).slice(0, 8); // top 8/bottom 8 o solo 8 materias principales

      return {
        totalStudents: filteredStudents.length,
        evalStudents: studentAverages.length,
        globalAverage,
        competencies: { c1: avgC1, c2: avgC2, c3: avgC3, c4: avgC4 },
        rankingDist,
        pendingSubjectsCount,
        subjectChartData
      };
    };

    return {
      primaria: calculateMetrics('Primaria'),
      secundaria: calculateMetrics('Secundaria'),
      general: calculateMetrics('General')
    };
  }, [state.students, state.courses, state.subjects, state.grades, period]);

  const renderSection = (title: string, data: any, colorClass: string) => {
    if (!data.evalStudents) return null;

    const rankingChart = Object.entries(data.rankingDist)
      .filter(([_, v]) => (v as number) > 0)
      .map(([name, value]) => ({ name, value: value as number, fill: rankingColors[name] }));

    return (
      <div className="mb-16 print:mb-12 break-inside-avoid">
        <div className={`flex items-center gap-3 mb-6 pb-2 border-b-2 ${colorClass}`}>
          <h2 className={`text-xl font-black uppercase ${colorClass.replace('border-', 'text-')}`}>
            {title}
          </h2>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {data.totalStudents} Estudiantes ({data.evalStudents} Evaluados)
          </span>
          <span className="text-xs font-bold text-white bg-slate-800 px-3 py-1 rounded-full ml-auto">
            PROMEDIO GLOBAL: {data.globalAverage}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-6 print:gap-4">
          
          {/* 1. RENDIMIENTO Y EXCELENCIA */}
          <div className="col-span-1 border border-slate-200 rounded-xl p-4 bg-slate-50 print:bg-white">
            <h3 className="text-[10px] font-black uppercase text-slate-500 mb-2">Clasificación de Promedios</h3>
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={rankingChart} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
                    {rankingChart.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1 mt-2">
              {rankingChart.map(r => (
                <div key={r.name} className="flex justify-between items-center text-[9px] font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.fill }}></span>
                    <span className="text-slate-600 uppercase">{r.name}</span>
                  </div>
                  <span className="text-slate-900">{r.value} <span className="text-slate-400 font-normal">({Math.round((r.value as number) / data.evalStudents * 100)}%)</span></span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. RIESGO ACADÉMICO (Pendientes) */}
          <div className="col-span-1 border border-slate-200 rounded-xl p-4 bg-slate-50 print:bg-white flex flex-col justify-between">
            <h3 className="text-[10px] font-black uppercase text-slate-500 mb-2">Asignaturas Pendientes (&#60; 70)</h3>
            <div className="space-y-2 mt-2 flex-1">
              {Object.entries(data.pendingSubjectsCount).map(([k, v]: [string, any]) => (
                <div key={k} className="flex justify-between items-center text-[10px] border-b border-slate-200 pb-1.5 last:border-0">
                  <span className={`font-bold uppercase ${k === 'Ninguna' ? 'text-emerald-600' : 'text-slate-600'}`}>{k}</span>
                  <div className="flex gap-4">
                    <span className="font-black text-slate-900">{v}</span>
                    <span className="text-slate-400 w-8 text-right font-medium">{Math.round((v / data.totalStudents) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 bg-rose-50 text-rose-700 rounded-lg p-2 flex justify-between items-center text-[9px] font-black uppercase">
              <span>Total en Riesgo (1+):</span>
              <span>{data.evalStudents - data.pendingSubjectsCount['Ninguna']}</span>
            </div>
          </div>

          {/* 3. RENDIMIENTO POR COMPETENCIAS */}
          <div className="col-span-1 border border-slate-200 rounded-xl p-4 bg-slate-50 print:bg-white flex flex-col justify-center">
            <h3 className="text-[10px] font-black uppercase text-slate-500 mb-4 text-center">Desempeño por Competencias</h3>
            <div className="flex justify-around items-end h-[100px] mb-4">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 bg-indigo-200 rounded-t-sm relative flex items-end justify-center pb-1" style={{ height: `${data.competencies.c1}%` }}>
                  <span className="text-[8px] font-black text-indigo-900">{data.competencies.c1}</span>
                </div>
                <span className="text-[9px] font-black text-slate-500 uppercase">C1</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 bg-indigo-400 rounded-t-sm relative flex items-end justify-center pb-1" style={{ height: `${data.competencies.c2}%` }}>
                  <span className="text-[8px] font-black text-white">{data.competencies.c2}</span>
                </div>
                <span className="text-[9px] font-black text-slate-500 uppercase">C2</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 bg-indigo-600 rounded-t-sm relative flex items-end justify-center pb-1" style={{ height: `${data.competencies.c3}%` }}>
                  <span className="text-[8px] font-black text-white">{data.competencies.c3}</span>
                </div>
                <span className="text-[9px] font-black text-slate-500 uppercase">C3</span>
              </div>
              {(data.competencies.c4 > 0 || title.includes('Secundari')) && (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 bg-indigo-800 rounded-t-sm relative flex items-end justify-center pb-1" style={{ height: `${data.competencies.c4}%` }}>
                    <span className="text-[8px] font-black text-white">{data.competencies.c4}</span>
                  </div>
                  <span className="text-[9px] font-black text-slate-500 uppercase">C4</span>
                </div>
              )}
            </div>
          </div>

          {/* 4. TOP RENDIMIENTO POR MATERIAS */}
          <div className="col-span-3 border border-slate-200 rounded-xl p-4 pb-6 bg-slate-50 print:bg-white h-[220px]">
             <h3 className="text-[10px] font-black uppercase text-slate-500 mb-2">Promedio Institucional por Asignatura</h3>
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={data.subjectChartData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 15 }}>
                 <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                 <XAxis type="number" domain={[0, 100]} hide />
                 <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b', fontWeight: 'bold' }} width={140} />
                 <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ fontSize: '10px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                 <Bar dataKey="promedio" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12}>
                   <LabelList dataKey="promedio" position="right" style={{ fontSize: '9px', fontWeight: 'bold', fill: '#0f172a' }} />
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
          </div>

        </div>
      </div>
    );
  };

  const downloadPDF = async () => {
    const input = document.getElementById('report-container');
    if (!input) return;

    try {
      const targetWidth = 1100;
      const originalWidth = input.style.width;
      const originalMaxWidth = input.style.maxWidth;
      const originalMargin = input.style.margin;

      // Forzar dimensiones fijas para evitar recortes a la derecha
      input.style.width = `${targetWidth}px`;
      input.style.maxWidth = `${targetWidth}px`;
      input.style.margin = '0';

      const imgData = await toJpeg(input, { 
        quality: 1.0, 
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        skipFonts: false
      });
      
      // Restaurar
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

      pdf.save(`Record_Institucional_${selectedYear}.pdf`);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert('Hubo un error al generar el PDF: ' + (error?.message || error));
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] bg-slate-100 block print:bg-white print:relative print:z-auto print:h-auto overflow-y-auto">
      {/* Barra superior de controles (no se imprime) */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 print:hidden shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-800 uppercase tracking-tight">Récord Académico Institucional</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Reporte Consolidado • Periodo: {period}
            </p>
          </div>
        </div>
        <button
          onClick={downloadPDF}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all active:scale-95"
        >
          <Download size={16} />
          Descargar en PDF
        </button>
      </div>

      {/* DOCUMENTO IMPRIMIBLE */}
      <div id="report-container" className="max-w-[1200px] w-full mx-auto p-8 print:p-0 print:max-w-none bg-white my-8 print:my-0 rounded-2xl shadow-sm print:shadow-none min-h-screen h-fit pb-16">
        
        {/* ENCABEZADO OFICIAL */}
        <div className="flex flex-col items-center justify-center text-center mb-10 pb-6 border-b-2 border-slate-800">
          {center?.logo_url && (
            <img src={center.logo_url} alt="Logo del Centro" className="w-20 h-20 object-contain mb-3 grayscale print:grayscale-0" />
          )}
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{center?.name || 'Centro Educativo'}</h1>
          <h2 className="text-sm font-black text-slate-600 uppercase tracking-widest mt-1">Récord Académico Institucional Consolidado</h2>
          <div className="flex gap-4 mt-3 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 px-4 py-1.5 rounded-full print:bg-transparent print:border print:border-slate-200">
            <span>Año Escolar: {selectedYear}</span>
            <span className="border-l border-slate-300 pl-4">Periodo Evaluado: {period}</span>
            <span className="border-l border-slate-300 pl-4">Fecha: {new Date().toLocaleDateString('es-DO')}</span>
          </div>
        </div>

        {/* SECCIONES */}
        {renderSection('Nivel Primario', dataByLevel.primaria, 'border-sky-600')}
        {renderSection('Nivel Secundario', dataByLevel.secundaria, 'border-rose-600')}
        {renderSection('Consolidado General (Global)', dataByLevel.general, 'border-slate-800')}

        {/* PIE DE FIRMAS OFICIALES */}
        <div className="mt-20 pt-10 grid grid-cols-4 gap-8 text-center break-inside-avoid">
          <div>
            <div className="border-b border-slate-400 mx-auto w-40 mb-2"></div>
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{center?.director_name || 'Director/a'}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Dirección del Centro</p>
          </div>
          <div>
            <div className="border-b border-slate-400 mx-auto w-40 mb-2"></div>
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{center?.secretary_name || 'Secretario/a'}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Secretaría Docente</p>
          </div>
          <div>
            <div className="border-b border-slate-400 mx-auto w-40 mb-2"></div>
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{center?.district_director_name || 'Director/a Distrital'}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Dirección Distrital</p>
          </div>
          <div>
            <div className="w-24 h-24 border-2 border-slate-200 rounded-full mx-auto flex items-center justify-center opacity-50 mb-2">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest rotate-[-30deg]">SELLO OFICIAL</span>
            </div>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Sello Institucional</p>
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
