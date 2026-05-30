import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export const AttendanceReport = () => {
  const { state } = useApp();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredRecords = state.attendanceRecords.filter((record) => {
    return record.date >= startDate && record.date <= endDate;
  });

  const synthesis = filteredRecords.reduce(
    (acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Reporte de Inasistencias y Tardanzas</h3>
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

      {startDate && endDate && (
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
                const teacher = state.teachers.find((t) => t.id === record.teacherId);
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
