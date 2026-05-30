import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export const TeacherRecordForm = () => {
  const { state, addAttendanceRecord } = useApp();
  const [formData, setFormData] = useState({
    teacherId: '',
    date: new Date().toISOString().split('T')[0],
    status: 'asistencia' as
      | 'asistencia'
      | 'tardanza'
      | 'ausencia'
      | 'calificaciones'
      | 'planificacion'
      | 'acompanamiento',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addAttendanceRecord({ id: Date.now().toString(), ...formData });
    setFormData({
      teacherId: '',
      date: new Date().toISOString().split('T')[0],
      status: 'asistencia',
      notes: ''
    });
  };

  const inputClass =
    'w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <h3 className="text-lg font-semibold">Generar Registro Docente</h3>
      <div>
        <label className={labelClass}>Docente</label>
        <select
          value={formData.teacherId}
          onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
          className={inputClass}
          required
        >
          <option value="">Seleccionar Docente</option>
          {state.teachers
            .filter((t) => t.role === 'teacher' || t.role === 'management_teacher')
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Fecha</label>
        <input
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          className={inputClass}
          required
        />
      </div>
      <div>
        <label className={labelClass}>Tipo de Registro</label>
        <select
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
          className={inputClass}
        >
          <option value="asistencia">Asistencia</option>
          <option value="tardanza">Tardanza</option>
          <option value="ausencia">Ausencia</option>
          <option value="calificaciones">Calificaciones Pendientes</option>
          <option value="planificacion">Planificación Pendiente</option>
          <option value="acompanamiento">Acompañamiento Pendiente</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Notas / Detalles</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className={inputClass}
        />
      </div>
      <button
        type="submit"
        className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
      >
        Guardar Registro
      </button>
    </form>
  );
};
