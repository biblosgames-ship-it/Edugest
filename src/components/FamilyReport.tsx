import React from 'react';
import { 
  Users, 
  Download, 
  FileText, 
  TrendingUp, 
  Home,
  CheckCircle2,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FamilyReportProps {
  onClose?: () => void;
}

const FamilyReport: React.FC<FamilyReportProps> = ({ onClose }) => {
  const { state } = useApp();
  const students = state.students || [];
  const courses = state.courses || [];

  // Agrupar estudiantes por familia
  const familyGroups: { [key: string]: any[] } = {};
  students.forEach(s => {
    const fid = s.family_id || s.id; // Fallback por si acaso
    if (!familyGroups[fid]) familyGroups[fid] = [];
    familyGroups[fid].push(s);
  });

  const familyIds = Object.keys(familyGroups);
  const totalFamilies = familyIds.length;
  const multipleChildFamilies = familyIds.filter(fid => familyGroups[fid].length > 1).length;

  // Estadísticas por Nivel
  const levels = ['Inicial', 'Primario', 'Secundario'];
  const statsByLevel = levels.map(level => {
    // Familias que tienen al menos un hijo en este nivel
    const familiesInLevel = familyIds.filter(fid => {
      return familyGroups[fid].some(student => {
        const course = courses.find(c => c.id === student.course_id);
        return course?.level?.toLowerCase().includes(level.toLowerCase());
      });
    });

    return {
      name: level,
      count: familiesInLevel.length,
      students: students.filter(s => {
        const c = courses.find(course => course.id === s.course_id);
        return c?.level?.toLowerCase().includes(level.toLowerCase());
      }).length
    };
  });

  const exportPDF = () => {
    const doc = new jsPDF();
    const now = new Date().toLocaleDateString();

    doc.setFontSize(20);
    doc.text('REPORTE CONSOLIDADO DE FAMILIAS', 14, 22);
    
    doc.setFontSize(10);
    doc.text(`Fecha: ${now}`, 14, 30);
    doc.text(`Total Estudiantes: ${students.length}`, 14, 35);
    doc.text(`Total Familias Únicas: ${totalFamilies}`, 14, 40);

    const tableData = statsByLevel.map(s => [
      s.name.toUpperCase(),
      s.count,
      s.students,
      (s.students / (s.count || 1)).toFixed(2)
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['NIVEL ACADÉMICO', 'FAMILIAS', 'ESTUDIANTES', 'PROM. HIJOS/FAM']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
    });

    // Listado de familias con hermanos
    const siblingFamilies = familyIds
      .filter(fid => familyGroups[fid].length > 1)
      .map(fid => {
        const members = familyGroups[fid];
        return [
          `${members[0].first_surname} ${members[0].second_surname}`.toUpperCase(),
          members.length,
          members.map(m => {
            const c = courses.find(course => course.id === m.course_id);
            return `${m.names} (${c?.grade || 'N/A'})`;
          }).join(', ')
        ];
      });

    if (siblingFamilies.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text('DETALLE DE FAMILIAS CON HERMANOS', 14, 22);
      
      autoTable(doc, {
        startY: 30,
        head: [['FAMILIA (APELLIDOS)', 'CANT. HERMANOS', 'DETALLE DE ALUMNOS']],
        body: siblingFamilies,
        theme: 'striped'
      });
    }

    doc.save(`Reporte_Familias_${now}.pdf`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100">
              <Home size={24} />
            </div>
            Reporte de Familias
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Análisis de núcleos familiares y vinculación de hermanos
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            <Download size={18} /> Exportar PDF
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
          <Users className="text-indigo-600 mb-4 relative" size={32} />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Familias</p>
          <h3 className="text-4xl font-black text-slate-800">{totalFamilies}</h3>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full w-fit">
            <CheckCircle2 size={12} /> DATOS CONSOLIDADOS
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
          <Users className="text-amber-500 mb-4 relative" size={32} />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Familias con Hermanos</p>
          <h3 className="text-4xl font-black text-slate-800">{multipleChildFamilies}</h3>
          <p className="text-[10px] font-bold text-amber-600 mt-2 uppercase">
            {((multipleChildFamilies / totalFamilies) * 100).toFixed(1)}% del total
          </p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
          <TrendingUp className="text-emerald-500 mb-4 relative" size={32} />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Promedio Hijos/Familia</p>
          <h3 className="text-4xl font-black text-slate-800">
            {(students.length / totalFamilies).toFixed(2)}
          </h3>
          <p className="text-[10px] font-bold text-emerald-600 mt-2 uppercase tracking-widest">Ratio de Crecimiento</p>
        </div>
      </div>

      {/* Levels Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <FileText size={18} className="text-indigo-600" /> Distribución por Niveles
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Nivel Académico</th>
                <th className="px-8 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Familias Únicas</th>
                <th className="px-8 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Estudiantes</th>
                <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Prom. Hijos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {statsByLevel.map((lvl) => (
                <tr key={lvl.name} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <span className="text-sm font-black text-slate-700 uppercase">{lvl.name}</span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className="inline-flex items-center px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black">
                      {lvl.count}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-center font-bold text-slate-600">
                    {lvl.students}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <span className="text-sm font-black text-slate-800">
                      {(lvl.students / (lvl.count || 1)).toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-indigo-900 text-white p-10 rounded-[3rem] relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-[2rem] flex items-center justify-center shrink-0">
            <Users size={40} className="text-indigo-200" />
          </div>
          <div>
            <h4 className="text-xl font-black uppercase tracking-tight mb-2">Nota sobre la vinculación</h4>
            <p className="text-indigo-100 text-sm font-medium leading-relaxed max-w-2xl">
              Este reporte utiliza el sistema de <strong>Identificación Familiar (Family ID)</strong>. 
              Si un hermano no aparece vinculado, el sistema lo contará como una familia independiente. 
              Asegúrate de vincular a los hermanos en el registro de alumnos para mantener la precisión de estos datos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FamilyReport;
