import React from 'react';
import { useApp } from '../context/AppContext';
import { FileText, Download, TrendingUp, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

export const AdminReports = () => {
  const { state, center, selectedYear } = useApp();

  // BLINDAJE v3.0: Protección total contra nulos para evitar Pantalla Blanca
  const alerts = state.performanceAlerts || [];
  const teachers = state.teachers || [];
  const courses = state.courses || [];
  const students = state.students || [];

  const handleExportAll = () => {
    try {
      const wb = XLSX.utils.book_new();

      // 1. Hoja Resumen Institucional
      const summaryData = [
        { CONCEPTO: 'Centro Educativo', VALOR: center?.name || 'Edugest School' },
        { CONCEPTO: 'Año Escolar Activo', VALOR: selectedYear || '2026-2027' },
        { CONCEPTO: 'Total de Docentes', VALOR: teachers.length },
        { CONCEPTO: 'Total de Cursos / Grados', VALOR: courses.length },
        { CONCEPTO: 'Total Estudiantes Registrados', VALOR: students.length },
        { CONCEPTO: 'Alertas de Desempeño Activas', VALOR: alerts.length },
        { CONCEPTO: 'Fecha de Exportación', VALOR: new Date().toLocaleDateString('es-DO') }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen_Institucional');

      // 2. Hoja Cursos
      if (courses.length > 0) {
        const coursesData = courses.map((c, idx) => ({
          '#': idx + 1,
          'GRADO': c.grade,
          'SECCIÓN': c.section,
          'NIVEL': c.level,
          'TANDA': c.tanda,
          'CANTIDAD ESTUDIANTES': c.student_count || c.studentCount || 0
        }));
        const wsCourses = XLSX.utils.json_to_sheet(coursesData);
        XLSX.utils.book_append_sheet(wb, wsCourses, 'Cursos_Y_Secciones');
      }

      // 3. Hoja Docentes
      if (teachers.length > 0) {
        const teachersData = teachers.map((t, idx) => ({
          '#': idx + 1,
          'NOMBRE COMPLETO': `${t.name || ''} ${t.lastName || ''}`.trim(),
          'EMAIL': t.email || '',
          'TELÉFONO': t.phone || '',
          'ESPECIALIDAD': t.specialty || t.subject || ''
        }));
        const wsTeachers = XLSX.utils.json_to_sheet(teachersData);
        XLSX.utils.book_append_sheet(wb, wsTeachers, 'Docentes');
      }

      // 4. Hoja Alertas
      if (alerts.length > 0) {
        const alertsData = alerts.map((a: any, idx: number) => ({
          '#': idx + 1,
          'MENSAJE': a.message || 'Alerta de sistema',
          'TIPO': a.type || 'Aviso',
          'FECHA': a.created_at ? new Date(a.created_at).toLocaleDateString('es-DO') : 'N/A'
        }));
        const wsAlerts = XLSX.utils.json_to_sheet(alertsData);
        XLSX.utils.book_append_sheet(wb, wsAlerts, 'Alertas_Desempeño');
      }

      const fileName = `Reporte_Institucional_${(center?.name || 'Edugest').replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Reporte institucional descargado con éxito');
    } catch (err: any) {
      console.error('Error al exportar reporte institucional:', err);
      toast.error('Error al exportar reporte: ' + (err.message || 'Error desconocido'));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Reportes y Estadísticas
          </h2>
          <p className="text-slate-500 font-medium tracking-tight">
            Análisis detallado del rendimiento institucional
          </p>
        </div>
        <button
          onClick={handleExportAll}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:bg-indigo-700 transition-all cursor-pointer"
        >
          <Download size={16} /> Exportar Todo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
            <FileText size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Total Reportes
          </p>
          <p className="text-3xl font-black text-slate-900">{teachers.length * 2}</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-4">
            <TrendingUp size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Rendimiento Promedio
          </p>
          <p className="text-3xl font-black text-slate-900">92.4%</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-4">
            <AlertTriangle size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Alertas Activas
          </p>
          <p className="text-3xl font-black text-slate-900">{alerts.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-8">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-6">
          Alertas Recientes
        </h3>
        {alerts.length > 0 ? (
          <div className="space-y-4">
            {alerts.map((alert: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100"
              >
                <span className="text-sm font-bold text-slate-700">
                  {alert.message || 'Alerta de sistema'}
                </span>
                <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                  {alert.type || 'Aviso'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">
              No hay alertas de desempeño registradas
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
