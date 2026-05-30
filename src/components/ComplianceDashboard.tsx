import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { dataService } from '../services/dataService';
import { ShieldCheck, TrendingUp, TrendingDown, Clock, UserCheck, AlertCircle } from 'lucide-react';

export const ComplianceDashboard = () => {
  const { state } = useApp();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComplianceData = async () => {
      try {
        setLoading(true);
        const data = await dataService.getAttendance();
        setRecords(data || []);
      } catch (error) {
        console.error('Error fetching attendance records for compliance:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchComplianceData();
  }, []);

  // Agrupar estadísticas por docente
  const ranking = records.reduce(
    (acc, record) => {
      const teacherId = record.teacher_id;
      if (!acc[teacherId]) acc[teacherId] = { onTime: 0, late: 0, absent: 0, total: 0 };

      const status = record.status;
      if (status === 'asistencia' || status === 'on-time') {
        acc[teacherId].onTime++;
      } else if (status === 'tardanza' || status === 'late') {
        acc[teacherId].late++;
      } else {
        acc[teacherId].absent++;
      }

      acc[teacherId].total++;
      return acc;
    },
    {} as Record<string, { onTime: number; late: number; absent: number; total: number }>
  );

  // Convertir a array y añadir nombres
  const rankingList = Object.entries(ranking)
    .map(([id, stats]: [string, any]) => {
      const teacher = state.teachers.find((t) => t.id === id);
      const complianceRate = stats.total > 0 ? Math.round((stats.onTime / stats.total) * 100) : 0;
      return {
        id,
        name: teacher ? teacher.name : 'Docente Desconocido',
        photo: teacher ? (teacher as any).photoUrl : null,
        onTime: stats.onTime,
        late: stats.late,
        absent: stats.absent,
        total: stats.total,
        complianceRate
      };
    })
    .sort((a, b) => b.complianceRate - a.complianceRate);

  if (loading)
    return (
      <div className="p-8 text-center text-slate-500 italic">
        Analizando datos de cumplimiento...
      </div>
    );

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
          <ShieldCheck size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Cumplimiento Institucional</h2>
          <p className="text-slate-500">
            Seguimiento de puntualidad y asistencia del personal docente
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
            <UserCheck size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Registros</p>
            <p className="text-2xl font-black text-slate-800">{records.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-500">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">A Tiempo (Promedio)</p>
            <p className="text-2xl font-black text-slate-800">
              {records.length > 0
                ? Math.round(
                    (records.filter((r) => r.status === 'on-time').length / records.length) * 100
                  )
                : 0}
              %
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-500">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Alertas Críticas</p>
            <p className="text-2xl font-black text-slate-800">
              {rankingList.filter((r) => r.complianceRate < 70).length}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Ranking de Puntualidad</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-4">Docente</th>
                <th className="px-6 py-4">Cumplimiento</th>
                <th className="px-6 py-4">A Tiempo</th>
                <th className="px-6 py-4">Tardanzas</th>
                <th className="px-6 py-4">Ausencias</th>
                <th className="px-6 py-4">Tendencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rankingList.map((teacher) => (
                <tr key={teacher.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-brand-blue/10 rounded-full flex items-center justify-center text-brand-blue font-bold">
                        {teacher.photo ? (
                          <img
                            src={teacher.photo}
                            alt=""
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          teacher.name.charAt(0)
                        )}
                      </div>
                      <p className="text-sm font-bold text-slate-700">{teacher.name}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden w-24">
                        <div
                          className={`h-full rounded-full ${teacher.complianceRate > 90 ? 'bg-green-500' : teacher.complianceRate > 75 ? 'bg-blue-500' : 'bg-red-500'}`}
                          style={{ width: `${teacher.complianceRate}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-slate-800">
                        {teacher.complianceRate}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-green-600">{teacher.onTime}</td>
                  <td className="px-6 py-4 font-bold text-amber-500">{teacher.late}</td>
                  <td className="px-6 py-4 font-bold text-red-400">{teacher.absent}</td>
                  <td className="px-6 py-4">
                    {teacher.complianceRate > 85 ? (
                      <TrendingUp className="text-green-500" size={20} />
                    ) : (
                      <TrendingDown className="text-red-400" size={20} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
