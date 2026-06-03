import React from 'react';
import {
  Users,
  Download,
  Activity,
  MapPin,
  PieChart as PieIcon,
  BarChart as BarIcon,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
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
  TooltipProps
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { differenceInYears } from 'date-fns';

interface DemographicReportProps {
  onClose?: () => void;
}

const COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

const DemographicReport: React.FC<DemographicReportProps> = ({ onClose }) => {
  const { state, center } = useApp();
  const students = state.students || [];

  // 1. Distribución por Sexo
  const sexData = [
    { name: 'Masculino', value: students.filter((s) => s.sex === 'M').length, color: '#6366f1' },
    { name: 'Femenino', value: students.filter((s) => s.sex === 'F').length, color: '#f43f5e' }
  ].filter((d) => d.value > 0);

  // 2. Distribución por Edad
  const ageRanges = [
    { label: '0-5 años', min: 0, max: 5 },
    { label: '6-10 años', min: 6, max: 10 },
    { label: '11-13 años', min: 11, max: 13 },
    { label: '14-16 años', min: 14, max: 16 },
    { label: '17+ años', min: 17, max: 100 }
  ];

  const ageData = ageRanges.map((range) => {
    const count = students.filter((s) => {
      if (!s.birth_date) return false;
      const age = differenceInYears(new Date(), new Date(s.birth_date));
      return age >= range.min && age <= range.max;
    }).length;
    return { name: range.label, value: count };
  });

  // 3. Distribución por Procedencia (Sector)
  const originMap: Record<string, number> = {};
  students.forEach((s) => {
    const sector = s.address_sector || 'No especificado';
    originMap[sector] = (originMap[sector] || 0) + 1;
  });

  const originData = Object.entries(originMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7); // Top 7 sectores

  const exportPDF = () => {
    const doc = new jsPDF();
    const now = new Date().toLocaleDateString();

    doc.setFontSize(20);
    doc.text('REPORTE ESTADÍSTICO DEMOGRÁFICO', 14, 22);

    doc.setFontSize(10);
    doc.text(`Centro Educativo: ${center?.name || 'Sistema Edugest'}`, 14, 30);
    doc.text(`Fecha: ${now}`, 14, 35);
    doc.text(`Matrícula Total: ${students.length} estudiantes`, 14, 40);

    // Tabla de Sexo
    autoTable(doc, {
      startY: 50,
      head: [['DISTRIBUCIÓN POR SEXO', 'CANTIDAD', 'PORCENTAJE']],
      body: sexData.map((d) => [
        d.name.toUpperCase(),
        d.value,
        `${((d.value / students.length) * 100).toFixed(1)}%`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] }
    });

    // Tabla de Edad
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [['RANGOS DE EDAD', 'ESTUDIANTES', 'PORCENTAJE']],
      body: ageData.map((d) => [
        d.name.toUpperCase(),
        d.value,
        `${((d.value / students.length) * 100).toFixed(1)}%`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }
    });

    // Tabla de Procedencia
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [['PRINCIPALES SECTORES (PROCEDENCIA)', 'ESTUDIANTES']],
      body: originData.map((d) => [d.name.toUpperCase(), d.value]),
      theme: 'striped',
      headStyles: { fillColor: [244, 63, 94] }
    });

    doc.save(`Demografia_Escolar_${now}.pdf`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
            <div className="p-2 bg-pink-600 text-white rounded-xl shadow-lg shadow-pink-100">
              <Activity size={24} />
            </div>
            Estadísticas Demográficas
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Análisis de la población escolar por edad, género y procedencia geográfica
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sex Chart */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2 self-start">
            <PieIcon size={16} className="text-indigo-600" /> Distribución por Sexo
          </h4>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sexData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sexData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-10 mt-6 w-full max-w-xs">
            {sexData.map((d) => (
              <div key={d.name} className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {d.name}
                </p>
                <p className="text-2xl font-black text-slate-800">{d.value}</p>
                <p className="text-[10px] font-bold text-slate-400">
                  {((d.value / students.length) * 100).toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Age Chart */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
            <BarIcon size={16} className="text-emerald-500" /> Población por Edad
          </h4>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 'bold' }}
                />
                <YAxis hide />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="value" fill="#10b981" radius={[10, 10, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between mt-6 px-4">
            {ageData.map((d) => (
              <div key={d.name} className="text-center">
                <p className="text-xs font-black text-slate-800">{d.value}</p>
                <p className="text-[8px] font-black text-slate-400 uppercase">{d.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Origin Chart (Full Width) */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm lg:col-span-2">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
            <MapPin size={16} className="text-rose-500" /> Distribución por Procedencia (Sectores)
          </h4>
          <div className="grid md:grid-cols-2 gap-10">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={originData}>
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 'black', fill: '#64748b' }}
                  />
                  <Tooltip />
                  <Bar dataKey="value" fill="#f43f5e" radius={[0, 10, 10, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">
                Tabla de sectores
              </p>
              <div className="max-h-[220px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {originData.map((d, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                  >
                    <span className="text-xs font-black text-slate-700 uppercase truncate max-w-[70%]">
                      {d.name}
                    </span>
                    <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-black text-rose-600">
                      {d.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-slate-900 text-white p-10 rounded-[3rem] relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-[2rem] flex items-center justify-center shrink-0">
            <Users size={40} className="text-pink-300" />
          </div>
          <div>
            <h4 className="text-xl font-black uppercase tracking-tight mb-2 text-pink-400">
              ¿Cómo se calcula esto?
            </h4>
            <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-2xl">
              Los datos demográficos se generan en tiempo real basándose en la información
              registrada en los expedientes de los alumnos. La <strong>Edad</strong> se calcula
              dinámicamente según la fecha de nacimiento y la <strong>Procedencia</strong> se agrupa
              por el campo de sector. Mantener estos campos actualizados garantiza la precisión de
              tus reportes administrativos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemographicReport;
