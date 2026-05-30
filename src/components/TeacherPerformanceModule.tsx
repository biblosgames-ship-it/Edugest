import React, { useState } from 'react';
import { TeacherRecordForm } from './TeacherRecordForm';
import { useApp } from '../context/AppContext';

export const TeacherPerformanceModule = () => {
  const { state } = useApp();
  const [activeTab, setActiveTab] = useState<'registro' | 'reportes'>('registro');

  const tabs = [
    { id: 'registro', label: 'Registro' },
    { id: 'reportes', label: 'Reportes' }
  ];

  // Ordenar docentes que tienen registros, por fecha del último registro
  const teachersWithRecords = state.teachers
    .filter((t) => state.attendanceRecords.some((r) => r.teacherId === t.id))
    .sort((a, b) => {
      const lastA =
        state.attendanceRecords
          .filter((r) => r.teacherId === a.id)
          .sort((x, y) => y.date.localeCompare(x.date))[0]?.date || '';
      const lastB =
        state.attendanceRecords
          .filter((r) => r.teacherId === b.id)
          .sort((x, y) => y.date.localeCompare(x.date))[0]?.date || '';
      return lastB.localeCompare(lastA);
    });

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-slate-900">Seguimiento Docente</h2>

      <div className="flex gap-4 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-4 px-2 border-b-2 transition-colors ${activeTab === tab.id ? 'border-brand-blue text-brand-blue font-semibold' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'registro' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <TeacherRecordForm />
        </div>
      )}

      {activeTab === 'reportes' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Reporte de Registros Docentes</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pb-3 text-slate-600">Docente</th>
                  <th className="pb-3 text-slate-600">Último Registro</th>
                  <th className="pb-3 text-slate-600">Tipo</th>
                  <th className="pb-3 text-slate-600">Notas</th>
                </tr>
              </thead>
              <tbody>
                {teachersWithRecords.map((teacher) => {
                  const lastRecord = state.attendanceRecords
                    .filter((r) => r.teacherId === teacher.id)
                    .sort((x, y) => y.date.localeCompare(x.date))[0];

                  return (
                    <tr key={teacher.id} className="border-b border-slate-100">
                      <td className="py-3 font-medium">{teacher.name}</td>
                      <td className="py-3">{lastRecord?.date}</td>
                      <td className="py-3 capitalize">{lastRecord?.status}</td>
                      <td className="py-3 text-sm text-slate-600">{lastRecord?.notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
