import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useSupabase } from '../context/AppContext';
import { dataService } from '../services/dataService';

type AttendanceStatus =
  | 'asistencia'
  | 'tardanza'
  | 'ausencia'
  | 'calificaciones'
  | 'planificacion'
  | 'acompanamiento';

export const AttendanceTracker = () => {
  const { state } = useApp();
  const { profile } = useSupabase();
  const [teacherId, setTeacherId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<AttendanceStatus>('asistencia');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.center_id) {
      alert('Error: No se encontró el ID del centro');
      return;
    }

    setIsSaving(true);
    try {
      await dataService.saveAttendance({
        center_id: profile.center_id,
        teacher_id: teacherId,
        date,
        status,
        notes
      });
      alert('Registro de asistencia guardado en Supabase');
      setTeacherId('');
      setNotes('');
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('Error al guardar el registro en Supabase');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    'w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue outline-none transition-all';
  const labelClass = 'block text-sm font-medium text-slate-600 mb-1';

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
      <h2 className="text-xl font-bold mb-6 text-slate-800">Registro de Asistencia Docente</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Docente</label>
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className={inputClass}
            required
          >
            <option value="">Selecciona un docente...</option>
            {state.teachers
              .filter((t) => t.role === 'teacher' || t.role === 'management_teacher')
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.area || 'General'})
                </option>
              ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Estado / Motivo</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
              className={inputClass}
            >
              <option value="asistencia">Asistencia (Puntual)</option>
              <option value="tardanza">Tardanza</option>
              <option value="ausencia">Ausencia</option>
              <option value="calificaciones">Carga de Calificaciones</option>
              <option value="planificacion">Planificación</option>
              <option value="acompanamiento">Acompañamiento Pedagógico</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Observaciones</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas u observaciones del registro..."
            className={`${inputClass} h-24 resize-none`}
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full md:w-auto bg-brand-blue text-white py-3 px-8 rounded-xl font-semibold hover:bg-brand-blue/90 transition-all shadow-md shadow-brand-blue/20 disabled:opacity-50"
          >
            {isSaving ? 'Guardando...' : 'Guardar en Supabase'}
          </button>
        </div>
      </form>
    </div>
  );
};
