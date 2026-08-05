import React, { useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useApp } from '../context/AppContext';
import { useSupabase } from '../context/AppContext';
import { Activity } from '../types';
import {
  Plus,
  X,
  Trash2,
  Clock,
  Calendar as CalendarIcon,
  FileText,
  Link as LinkIcon,
  Pencil,
  AlertTriangle,
  Users as UsersIcon,
  Star,
  BookOpen
} from 'lucide-react';

const locales = { es: es };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

export const Agenda = ({ readOnly = false }: { readOnly?: boolean }) => {
  const { state, addActivity, updateActivity, deleteActivity } = useApp();
  const { profile } = useSupabase();
  const [showModal, setShowModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [view, setView] = useState<any>('month');
  const [date, setDate] = useState(new Date());

  const userRole = profile?.role || 'student';
  const isReadOnly = readOnly || (userRole !== 'admin' && userRole !== 'coordinator');

  const [newActivity, setNewActivity] = useState({
    title: '',
    description: '',
    startTime: '08:00',
    endTime: '09:00',
    type: 'event' as 'event' | 'incident' | 'meeting' | 'pedagogical_group',
    scheduleEntryId: ''
  });

  const events = (state.activities || [])
    .filter((a) => {
      const type = a.type || 'event';
      if (userRole === 'admin' || userRole === 'coordinator') {
        return true;
      }
      if (userRole === 'teacher') {
        return type === 'event' || type === 'pedagogical_group';
      }
      return type === 'event';
    })
    .map((a) => {
      try {
        const startH =
          a.startTime?.includes(':') && a.startTime.split(':').length === 2
            ? `${a.startTime}:00`
            : a.startTime;
        const endH =
          a.endTime?.includes(':') && a.endTime.split(':').length === 2
            ? `${a.endTime}:00`
            : a.endTime;
        const start = new Date(`${a.date}T${startH || '00:00:00'}`);
        const end = new Date(`${a.date}T${endH || '23:59:59'}`);
        if (isNaN(start.getTime())) throw new Error('Invalid');
        return {
          id: a.id,
          title: a.title,
          start,
          end,
          desc: a.description,
          type: a.type || 'event',
          raw: a
        };
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);

  const handleSelectSlot = (slotInfo: any) => {
    if (isReadOnly) return;
    setSelectedEventId(null);
    setSelectedDate(slotInfo.start);
    setNewActivity({
      title: '',
      description: '',
      startTime: '08:00',
      endTime: '09:00',
      type: 'event',
      scheduleEntryId: ''
    });
    setShowModal(true);
  };

  const handleSelectEvent = (event: any) => {
    if (isReadOnly) return;
    const a = event.raw;
    setSelectedEventId(a.id);
    setSelectedDate(new Date(`${a.date}T12:00:00`));
    setNewActivity({
      title: a.title,
      description: a.description || '',
      startTime: a.startTime,
      endTime: a.endTime,
      type: a.type || 'event',
      scheduleEntryId: a.scheduleEntryId || ''
    });
    setShowModal(true);
  };

  const handleSaveActivity = async () => {
    if (!selectedDate || !newActivity.title || !profile?.center_id) {
      alert('Faltan datos obligatorios');
      return;
    }

    setIsSaving(true);
    try {
      const activityData = {
        title: newActivity.title,
        description: newActivity.description,
        date: format(selectedDate, 'yyyy-MM-dd'),
        startTime: newActivity.startTime,
        endTime: newActivity.endTime,
        type: newActivity.type,
        scheduleEntryId: newActivity.scheduleEntryId || undefined,
        center_id: profile.center_id
      };

      if (selectedEventId) {
        await updateActivity(selectedEventId, activityData);
      } else {
        await addActivity(activityData);
      }
      setShowModal(false);
    } catch (error: any) {
      console.error('Error saving activity:', error);
      alert(
        'Error al guardar: ' +
          (error.message || 'La tabla "activities" no existe o hay error de conexión')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (selectedEventId && window.confirm('¿Eliminar este evento permanentemente?')) {
      setIsSaving(true);
      await deleteActivity(selectedEventId);
      setIsSaving(false);
      setShowModal(false);
    }
  };

  return (
    <div className="h-[750px] bg-white p-4 md:p-8 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <CalendarIcon className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
              Agenda Institucional
            </h2>
            <p className="text-slate-500 text-sm">Gestiona y consulta los eventos del centro</p>
          </div>
        </div>
        {!isReadOnly && (
          <button
            onClick={() => handleSelectSlot({ start: new Date() })}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center gap-2"
          >
            <Plus size={20} /> Nueva Actividad
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-4 mb-6 px-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#4f46e5]"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Evento Público
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#e11d48]"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Incidencia
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#0891b2]"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            R. Equipo Gestión
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#7c3aed]"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Reunión Pedagógica
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-slate-50/50 rounded-[2rem] border border-slate-100 p-4 relative z-10">
        <style>
          {`
            .rbc-btn-group button { border-radius: 12px !important; margin: 2px !important; border: 1px solid #e2e8f0 !important; font-weight: 700 !important; font-size: 12px !important; text-transform: uppercase !important; padding: 8px 16px !important; color: #64748b !important; transition: all 0.2s !important; }
            .rbc-btn-group button:hover { background: #f8fafc !important; color: #4f46e5 !important; }
            .rbc-btn-group button.rbc-active { background: #4f46e5 !important; color: white !important; border-color: #4f46e5 !important; }
            .rbc-toolbar-label { font-weight: 900 !important; text-transform: uppercase !important; color: #1e293b !important; font-size: 14px !important; letter-spacing: 0.05em !important; }
            .rbc-header { padding: 12px !important; font-weight: 900 !important; text-transform: uppercase !important; font-size: 10px !important; color: #94a3b8 !important; }
            .rbc-event { border: none !important; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1) !important; }
          `}
        </style>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          selectable={!isReadOnly}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          date={date}
          view={view}
          onNavigate={(d) => setDate(d)}
          onView={(v) => setView(v)}
          messages={{
            next: 'Sig.',
            previous: 'Ant.',
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
            day: 'Día'
          }}
          eventPropGetter={(event: any) => {
            let color = '#4f46e5'; // Evento General (Indigo)
            if (event.type === 'incident') color = '#e11d48'; // Incidencia (Rose)
            if (event.type === 'meeting') color = '#0891b2'; // Reunión (Cyan)
            if (event.type === 'pedagogical_group') color = '#7c3aed'; // Grupo Pedagógico (Violet)

            return {
              style: {
                backgroundColor: color,
                borderRadius: '10px',
                border: 'none',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: '700'
              }
            };
          }}
        />
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-3 sm:p-4 text-left animate-fade-in">
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl relative border border-white">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 transition-colors z-10"
            >
              <X size={24} />
            </button>

            <div className="flex items-center gap-3 shrink-0 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedEventId ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}
              >
                {selectedEventId ? <Pencil size={20} /> : <Plus size={20} />}
              </div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                {selectedEventId ? 'Editar Evento' : 'Nuevo Evento'}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin my-2">
              <div>
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Tipo de Registro
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => setNewActivity({ ...newActivity, type: 'event' })}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-2xl border transition-all ${newActivity.type === 'event' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                  >
                    <Star size={18} />
                    <span className="text-[8px] font-black uppercase">Evento</span>
                  </button>
                  <button
                    onClick={() => setNewActivity({ ...newActivity, type: 'incident' })}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-2xl border transition-all ${newActivity.type === 'incident' ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                  >
                    <AlertTriangle size={18} />
                    <span className="text-[8px] font-black uppercase">Incidencia</span>
                  </button>
                  <button
                    onClick={() => setNewActivity({ ...newActivity, type: 'meeting' })}
                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-2xl border transition-all ${newActivity.type === 'meeting' ? 'bg-cyan-50 border-cyan-200 text-cyan-600' : 'bg-slate-50 border-slate-100 text-slate-400'} h-14 w-full`}
                  >
                    <UsersIcon size={16} />
                    <span className="text-[7px] font-black uppercase text-center leading-none">
                      R. Equipo Gestión
                    </span>
                  </button>
                  <button
                    onClick={() => setNewActivity({ ...newActivity, type: 'pedagogical_group' })}
                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-2xl border transition-all ${newActivity.type === 'pedagogical_group' ? 'bg-violet-50 border-violet-200 text-violet-600' : 'bg-slate-50 border-slate-100 text-slate-400'} h-14 w-full`}
                  >
                    <BookOpen size={16} />
                    <span className="text-[7px] font-black uppercase text-center leading-none">
                      R. Pedagógicas
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  <FileText size={12} /> Título
                </label>
                <input
                  type="text"
                  value={newActivity.title}
                  onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 p-3.5 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                  placeholder="Título del evento"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  <FileText size={12} /> Descripción
                </label>
                <textarea
                  value={newActivity.description}
                  onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 p-3.5 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 h-24 sm:h-28 resize-none font-medium text-sm"
                  placeholder="Detalles adicionales..."
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    <Clock size={12} /> Inicio
                  </label>
                  <input
                    type="time"
                    value={newActivity.startTime}
                    onChange={(e) => setNewActivity({ ...newActivity, startTime: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 p-3.5 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    <Clock size={12} /> Fin
                  </label>
                  <input
                    type="time"
                    value={newActivity.endTime}
                    onChange={(e) => setNewActivity({ ...newActivity, endTime: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 p-3.5 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  <LinkIcon size={12} /> Vínculo (Opcional)
                </label>
                <select
                  value={newActivity.scheduleEntryId}
                  onChange={(e) =>
                    setNewActivity({ ...newActivity, scheduleEntryId: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-100 p-3.5 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  <option value="">Ninguno</option>
                  {state.schedule.map((s) => {
                    const subject = state.subjects.find((sub) => sub.id === s.subjectId);
                    const course = state.courses.find((c) => c.id === s.courseId);
                    return (
                      <option key={s.id} value={s.id}>
                        {subject?.name} - {course?.grade} {course?.section}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100 mt-2 shrink-0">
              {selectedEventId && (
                <button
                  onClick={handleDelete}
                  className="w-12 h-12 flex items-center justify-center bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-100 shrink-0"
                >
                  <Trash2 size={20} />
                </button>
              )}
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-3.5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveActivity}
                disabled={isSaving}
                className="flex-[2] px-4 py-3.5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all disabled:opacity-50"
              >
                {isSaving ? 'Guardando...' : selectedEventId ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
