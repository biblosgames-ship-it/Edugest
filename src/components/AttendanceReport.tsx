import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { FileSpreadsheet } from 'lucide-react';
import { exportGenericTableToExcel } from '../utils/listPdfGenerator';

export const AttendanceReport = () => {
  const { state, center, selectedYear } = useApp();
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
      title: 'Reporte de Inasistencias y Tardanzas',
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
      sheetName: 'Asistencia',
      fileName: `Inasistencias_Tardanzas_${startDate}_${endDate}.xlsx`,
      centerName: center?.name || 'Centro Educativo'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">Reporte de Inasistencias y Tardanzas</h3>
        {filteredRecords.length > 0 && (
          <button
            onClick={exportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
          >
            <FileSpreadsheet size={16} /> Exportar Excel
          </button>
        )}
      </div>
      <div className="flex gap-4">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-4 py-2 rounded-lg border border-slate-300"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-4 py-2 rounded-lg border border-slate-300"
        />
      </div>

      {loading && (
        <p className="text-slate-500 text-sm animate-pulse">Cargando registros...</p>
      )}

      {!loading && startDate && endDate && (
        <div className="space-y-4">
          <div className="bg-slate-100 p-4 rounded-lg">
            <h4 className="font-semibold">Síntesis</h4>
            <p>Inasistencias: {synthesis.inasistencia || 0}</p>
            <p>Tardanzas: {synthesis.tardanza || 0}</p>
          </div>
          <table className="w-full border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-200">
                <th className="border border-slate-300 px-4 py-2">Docente</th>
                <th className="border border-slate-300 px-4 py-2">Fecha</th>
                <th className="border border-slate-300 px-4 py-2">Tipo</th>
                <th className="border border-slate-300 px-4 py-2">Notas</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => {
                const teacher = state.teachers.find((t) => t.id === record.teacher_id || t.id === record.teacherId);
                return (
                  <tr key={record.id}>
                    <td className="border border-slate-300 px-4 py-2">{teacher?.name}</td>
                    <td className="border border-slate-300 px-4 py-2">{record.date}</td>
                    <td className="border border-slate-300 px-4 py-2 capitalize">
                      {record.status}
                    </td>
                    <td className="border border-slate-300 px-4 py-2">{record.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
