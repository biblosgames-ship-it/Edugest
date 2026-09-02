import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { FileSpreadsheet, UserCheck, Users } from 'lucide-react';
import { exportGenericTableToExcel } from '../utils/listPdfGenerator';
import { DailyMinerdAttendanceReport } from './DailyMinerdAttendanceReport';

export const AttendanceReport = () => {
  const { state, center, selectedYear } = useApp();
  const [activeTab, setActiveTab] = useState<'minerd' | 'staff'>('minerd');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filteredRecords, setFilteredRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!startDate || !endDate || !center?.id) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('center_id', center.id)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false });

        if (error) throw error;
        setFilteredRecords(data || []);
      } catch (e) {
        console.error('Error loading attendance records:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, [startDate, endDate, center?.id]);

  const synthesis = filteredRecords.reduce(
    (acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const exportExcel = () => {
    if (filteredRecords.length === 0) return;
    exportGenericTableToExcel({
      title: 'Reporte de Inasistencias y Tardanzas del Personal',
      subtitle: `Rango: ${startDate} al ${endDate} | Año Escolar: ${selectedYear}`,
      headers: ['Nº', 'Docente / Colaborador', 'Fecha', 'Tipo / Estado', 'Notas / Justificación'],
      data: filteredRecords.map((r, idx) => {
        const teacher = state.teachers.find((t) => t.id === r.teacher_id || t.id === r.teacherId);
        return [
          idx + 1,
          (teacher?.name || teacher?.full_name || 'Desconocido').toUpperCase(),
          r.date,
          (r.status || '').toUpperCase(),
          r.notes || '---'
        ];
      }),
      sheetName: 'Personal',
      fileName: `Inasistencias_Personal_${startDate}_${endDate}.xlsx`,
      centerName: center?.name || 'Centro Educativo'
    });
  };

  return (
    <div className="space-y-6 text-left">
      {/* Selector de Pestañas */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl max-w-md">
        <button
          onClick={() => setActiveTab('minerd')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'minerd'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <UserCheck size={16} /> Asistencia MINERD
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'staff'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users size={16} /> Inasistencias Personal
        </button>
      </div>

      {activeTab === 'minerd' ? (
        <DailyMinerdAttendanceReport />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Reporte de Inasistencias y Tardanzas del Personal
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Control y justificación de asistencias del equipo docente y administrativo.
              </p>
            </div>
            {filteredRecords.length > 0 && (
              <button
                onClick={exportExcel}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
              >
                <FileSpreadsheet size={16} /> Exportar Excel
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Fecha Desde</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Fecha Hasta</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {loading && (
            <p className="text-slate-500 text-sm animate-pulse">Cargando registros del personal...</p>
          )}

          {!loading && startDate && endDate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-rose-600">Total Inasistencias</span>
                  <p className="text-2xl font-black text-rose-700 mt-1">{synthesis.inasistencia || 0}</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-amber-600">Total Tardanzas</span>
                  <p className="text-2xl font-black text-amber-700 mt-1">{synthesis.tardanza || 0}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                      <th className="py-3 px-4">Docente / Colaborador</th>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Notas / Justificación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                    {filteredRecords.length > 0 ? (
                      filteredRecords.map((record) => {
                        const teacher = state.teachers.find((t) => t.id === record.teacher_id || t.id === record.teacherId);
                        return (
                          <tr key={record.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-black text-slate-900">{teacher?.name || teacher?.full_name || 'Desconocido'}</td>
                            <td className="py-3 px-4 text-slate-600">{record.date}</td>
                            <td className="py-3 px-4 capitalize">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${record.status === 'inasistencia' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                                {record.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500">{record.notes || '---'}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">
                          No se encontraron registros de inasistencias en este rango de fechas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
