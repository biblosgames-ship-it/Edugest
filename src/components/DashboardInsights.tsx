import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';

export const DashboardInsights = () => {
  const { state } = useApp();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // 1 minute
    return () => clearInterval(timer);
  }, []);

  // Get current day and time
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const currentDay = days[currentTime.getDay()];
  const currentTimeStr = currentTime.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });

  // Find active classes
  const activeClasses = state.schedule.filter((entry) => {
    const timeBlock = state.timeBlocks.find((tb) => tb.id === entry.timeBlockId);
    if (!timeBlock) return false;
    return (
      timeBlock.day === currentDay &&
      currentTimeStr >= timeBlock.startTime &&
      currentTimeStr < timeBlock.endTime
    );
  });

  // 1. Teacher Workload
  const teacherWorkload = state.teachers
    .filter((t) => t.role === 'teacher' || t.role === 'management_teacher')
    .map((teacher) => {
      const assignedHours = state.schedule.filter((s) => s.teacherId === teacher.id).length;
      return { ...teacher, assignedHours };
    });

  // 2. Availability by Time Block
  const availabilityByBlock = state.timeBlocks.map((block) => {
    const busyTeacherIds = state.schedule
      .filter((s) => s.timeBlockId === block.id)
      .map((s) => s.teacherId);
    const availableTeachers = state.teachers.filter(
      (t) =>
        (t.role === 'teacher' || t.role === 'management_teacher') && !busyTeacherIds.includes(t.id)
    );
    return { block, availableTeachers };
  });

  // 3. Availability Analysis
  const availabilityAnalysis = useMemo(() => {
    const analysis = teacherWorkload.map((t) => ({
      ...t,
      freeHours: Math.max(0, t.hoursAvailable - t.assignedHours),
      isOverloaded: t.assignedHours > t.hoursAvailable
    }));

    const mostAvailable = [...analysis].sort((a, b) => b.freeHours - a.freeHours).slice(0, 3);
    const overloaded = analysis.filter((t) => t.isOverloaded);
    const totalFreeHours = analysis.reduce((sum, t) => sum + t.freeHours, 0);

    return { mostAvailable, overloaded, totalFreeHours };
  }, [teacherWorkload]);

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">
          Clases en Tiempo Real ({currentDay} {currentTimeStr})
        </h2>
        {activeClasses.length > 0 ? (
          <div className="space-y-2">
            {activeClasses.map((entry) => {
              const course = state.courses.find((c) => c.id === entry.courseId);
              const subject = state.subjects.find((s) => s.id === entry.subjectId);
              const teacher = state.teachers.find((t) => t.id === entry.teacherId);
              return (
                <div
                  key={entry.id}
                  className="p-3 bg-brand-blue/5 rounded-lg border border-brand-blue/10"
                >
                  <p className="font-semibold">
                    {course ? `${course.level} ${course.grade} ${course.section}` : '-'}
                  </p>
                  <p className="text-sm text-slate-600">
                    {subject?.name || '-'} - {teacher?.name || '-'}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-slate-500">No hay clases en curso en este momento.</p>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Carga Horaria Docente</h2>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2">Docente</th>
              <th className="py-2">Horas Asignadas</th>
              <th className="py-2">Horas Disponibles</th>
            </tr>
          </thead>
          <tbody>
            {teacherWorkload.map((t) => (
              <tr key={t.id} className="border-b">
                <td className="py-2">{t.name}</td>
                <td className="py-2">{t.assignedHours}</td>
                <td className="py-2">{t.hoursAvailable}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Disponibilidad por Bloque</h2>
        <div className="space-y-4">
          {availabilityByBlock.map((item) => (
            <div key={item.block.id} className="border-b pb-2">
              <p className="font-semibold">
                {item.block.day} {item.block.startTime} - {item.block.endTime}
              </p>
              <p className="text-sm text-slate-600">
                Disponibles: {item.availableTeachers.map((t) => t.name).join(', ') || 'Ninguno'}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">🧠 Análisis de Disponibilidad</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-emerald-50 rounded-lg">
            <p className="text-sm text-emerald-700">Total Horas Libres</p>
            <p className="text-2xl font-bold text-emerald-900">
              {availabilityAnalysis.totalFreeHours}
            </p>
          </div>
          <div className="p-4 bg-rose-50 rounded-lg">
            <p className="text-sm text-rose-700">Docentes Sobrecargados</p>
            <p className="text-2xl font-bold text-rose-900">
              {availabilityAnalysis.overloaded.length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-2">Docentes más disponibles</h3>
            <ul className="space-y-1">
              {availabilityAnalysis.mostAvailable.map((t) => (
                <li key={t.id} className="text-sm">
                  {t.name}: {t.freeHours} horas libres
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Docentes sobrecargados</h3>
            <ul className="space-y-1">
              {availabilityAnalysis.overloaded.map((t) => (
                <li key={t.id} className="text-sm text-rose-600">
                  {t.name}: {t.assignedHours - t.hoursAvailable} horas extra
                </li>
              ))}
              {availabilityAnalysis.overloaded.length === 0 && (
                <li className="text-sm text-slate-500">Ninguno</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
