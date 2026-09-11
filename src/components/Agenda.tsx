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
  BookOpen,
  Ban
} from 'lucide-react';

import { SchoolEphemeridesManager } from './SchoolEphemeridesManager';

const locales = { es: es };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const CustomCalendarEvent = ({ event }: any) => {
  const isEphem = event.is_global || event.type === 'ephemeris';
  const isPatriotic = event.is_patriotic;
  const isOwnActivity = !isEphem;
  const centerColor = event.centerColor || '#4f46e5';
  const isNoClasses = !!event.suspends_classes;

  const timeText = event.raw?.startTime
    ? event.raw.endTime && event.raw.endTime !== event.raw.startTime
      ? `${event.raw.startTime} - ${event.raw.endTime}`
      : event.raw.startTime
    : null;

  return (
    <div
      className="flex flex-col w-full h-full text-left overflow-hidden select-none p-0.5 leading-tight"
      title={`${isNoClasses ? '🚫 NO HAY DOCENCIA\n' : ''}${event.title}${timeText ? ` (${timeText})` : ''}${event.desc ? `\n\n📝 ${event.desc}` : ''}`}
    >
      {/* Alerta Destacada: NO HAY DOCENCIA */}
      {isNoClasses && (
        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white text-red-700 font-black text-[7.5px] uppercase tracking-wider shadow-xs mb-1 w-fit border border-red-200">
          <Ban size={9} className="text-red-600 shrink-0" />
          <span>NO HAY DOCENCIA</span>
        </div>
      )}

      {/* Título y distintivo */}
      <div className="flex items-start gap-1 min-w-0">
        {isNoClasses ? (
          <Ban size={12} className="text-white shrink-0 mt-0.5" />
        ) : isEphem ? (
          isPatriotic ? (
            <span className="text-[11px] leading-none shrink-0" title="Fecha Patria Nacional">
              🇩🇴
            </span>
          ) : (
            <img
              src="/minerd_logo.webp"
              alt="MINERD"
              className="w-3.5 h-3.5 rounded object-contain bg-white p-0.5 shrink-0 shadow-xs border border-white/40"
              title="Ministerio de Educación (MINERD)"
            />
          )
        ) : (
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0 mt-1"
            style={{ backgroundColor: centerColor }}
          />
        )}
        <span
          className="font-black text-[10px] md:text-[11px] leading-tight break-words line-clamp-2"
          style={{
            color: isNoClasses ? '#ffffff' : isOwnActivity ? centerColor : '#ffffff'
          }}
        >
          {event.title}
        </span>
      </div>

      {/* Descripción abajo junto a la hora */}
      {(timeText || event.desc) && (
        <div
          className={`mt-1 pt-0.5 flex flex-col gap-0.5 ${
            isNoClasses
              ? 'border-t border-red-400/40'
              : isOwnActivity
              ? 'border-t border-slate-200/70'
              : 'border-t border-white/20'
          }`}
        >
          {timeText && (
            <div
              className="flex items-center gap-1 text-[8.5px] font-bold"
              style={{
                color: isNoClasses
                  ? '#fee2e2'
                  : isOwnActivity
                  ? centerColor
                  : 'rgba(255,255,255,0.9)'
              }}
            >
              <Clock size={10} className="shrink-0" />
              <span>{timeText}</span>
            </div>
          )}
          {event.desc && (
            <p
              className={`text-[8.5px] font-medium leading-snug line-clamp-2 break-words whitespace-normal ${
                isNoClasses ? 'text-red-50' : isOwnActivity ? 'text-slate-600' : 'text-white/95'
              }`}
            >
              {event.desc}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export const Agenda = ({ readOnly = false }: { readOnly?: boolean }) => {
  const { state, center, addActivity, updateActivity, deleteActivity } = useApp();
  const { profile } = useSupabase();
  const [showModal, setShowModal] = useState(false);
  const [showEphemeridesModal, setShowEphemeridesModal] = useState(false);
  const [viewingEvent, setViewingEvent] = useState<any | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [view, setView] = useState<any>('month');
  const [date, setDate] = useState(new Date());

  const userRole = profile?.role || 'student';
  const isSuperAdmin = !!profile?.is_superadmin;
  const isReadOnly = readOnly || (userRole !== 'admin' && userRole !== 'coordinator' && !isSuperAdmin);
  const canManageEphemerides = userRole === 'admin' || userRole === 'coordinator' || isSuperAdmin;
  const centerColor = center?.primary_color || '#4f46e5';

  const [newActivity, setNewActivity] = useState({
    title: '',
    description: '',
    startTime: '08:00',
    endTime: '09:00',
    type: 'event' as 'event' | 'incident' | 'meeting' | 'pedagogical_group',
    scheduleEntryId: '',
    suspends_classes: false
  });

  const events = (state.activities || [])
    .filter((a) => {
      const type = a.type || 'event';
      if (a.is_global || type === 'ephemeris') return true;
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
        const isEphem = a.is_global || a.type === 'ephemeris';
        const titleLower = String(a.title || '').toLowerCase();
        const descLower = String(a.description || '').toLowerCase();
        const isPatriotic =
          titleLower.includes('duarte') ||
          titleLower.includes('mella') ||
          titleLower.includes('sánchez') ||
          titleLower.includes('sanchez') ||
          titleLower.includes('independencia') ||
          titleLower.includes('restauración') ||
          titleLower.includes('restauracion') ||
          titleLower.includes('patria') ||
          titleLower.includes('constitución') ||
          titleLower.includes('constitucion') ||
          titleLower.includes('bandera') ||
          titleLower.includes('batalla') ||
          titleLower.includes('luperón') ||
          titleLower.includes('luperon') ||
          titleLower.includes('mirabal') ||
          descLower.includes('patria') ||
          descLower.includes('independencia');

        const isNoClasses =
          a.suspends_classes !== undefined
            ? !!a.suspends_classes
            : descLower.includes('[no_docencia]') ||
              titleLower.includes('feriado') ||
              titleLower.includes('asueto') ||
              descLower.includes('feriado nacional') ||
              a.category === 'holiday';

        return {
          id: a.id,
          title: a.title,
          start,
          end,
          desc: a.description?.replace(/\[NO_DOCENCIA\]\s*/g, '').trim(),
          type: a.type || 'event',
          is_global: !!isEphem,
          is_patriotic: isPatriotic,
          suspends_classes: isNoClasses,
          centerColor,
          raw: {
            ...a,
            suspends_classes: isNoClasses
          }
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
      scheduleEntryId: '',
      suspends_classes: false
    });
    setShowModal(true);
  };

  const handleSelectEvent = (event: any) => {
    const a = event.raw;
    if (!a) return;

    const isGlobalEphem = a.is_global || a.type === 'ephemeris';

    // Si es efeméride oficial o usuario solo lectura, abrir ficha con detalles y reseña
    if (isGlobalEphem || isReadOnly) {
      setViewingEvent(event);
      return;
    }

    setSelectedEventId(a.id);
    setSelectedDate(new Date(`${a.date}T12:00:00`));
    setNewActivity({
      title: a.title,
      description: a.description?.replace(/\[NO_DOCENCIA\]\s*/g, '').trim() || '',
      startTime: a.startTime,
      endTime: a.endTime,
      type: a.type || 'event',
      scheduleEntryId: a.scheduleEntryId || '',
      suspends_classes: !!a.suspends_classes
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
        suspends_classes: !!newActivity.suspends_classes,
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
        <div className="flex items-center gap-3">
          {canManageEphemerides && (
            <button
              onClick={() => setShowEphemeridesModal(true)}
              className="bg-sky-50 text-sky-700 border border-sky-200 px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-sky-100 transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
              title="Cargar y gestionar efemérides del Calendario Escolar MINERD para todos los centros"
            >
              <img
                src="/minerd_logo.webp"
                alt="MINERD"
                className="w-4 h-4 object-contain rounded bg-white p-0.5 shadow-xs"
              />
              Efemérides MINERD
            </button>
          )}
          {!isReadOnly && (
            <button
              onClick={() => handleSelectSlot({ start: new Date() })}
              className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus size={20} /> Nueva Actividad
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-6 px-2">
        <div className="flex items-center gap-2">
          <div
            className="w-3.5 h-3.5 rounded-full border-2 bg-white"
            style={{ borderColor: centerColor }}
          ></div>
          <span
            className="text-[10px] font-black uppercase tracking-widest"
            style={{ color: centerColor }}
          >
            Actividades del Centro
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
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#1e3a8a] border border-[#60a5fa]"></div>
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
            <span>🇩🇴</span> Fecha Patria
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-[#0284c7] border border-[#7dd3fc]"></div>
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
            <img
              src="/minerd_logo.webp"
              alt="MINERD"
              className="w-3.5 h-3.5 rounded object-contain bg-white p-0.5"
            />
            Efeméride Escolar MINERD
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-[#dc2626] border-2 border-[#f87171] shadow-xs"></div>
          <span className="text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1">
            <Ban size={11} /> Sin Docencia (Alerta Roja)
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-slate-50/50 rounded-[2rem] border border-slate-100 p-4 relative z-10 flex flex-col">
        <style>
          {`
            .rbc-toolbar {
              display: flex !important;
              flex-wrap: wrap !important;
              gap: 8px !important;
              justify-content: space-between !important;
              align-items: center !important;
              margin-bottom: 16px !important;
            }
            .rbc-btn-group button { border-radius: 12px !important; margin: 2px !important; border: 1px solid #e2e8f0 !important; font-weight: 700 !important; font-size: 12px !important; text-transform: uppercase !important; padding: 8px 16px !important; color: #64748b !important; transition: all 0.2s !important; }
            .rbc-btn-group button:hover { background: #f8fafc !important; color: #4f46e5 !important; }
            .rbc-btn-group button.rbc-active { background: #4f46e5 !important; color: white !important; border-color: #4f46e5 !important; }
            .rbc-toolbar-label { font-weight: 900 !important; text-transform: uppercase !important; color: #1e293b !important; font-size: 14px !important; letter-spacing: 0.05em !important; }
            .rbc-header { padding: 12px !important; font-weight: 900 !important; text-transform: uppercase !important; font-size: 10px !important; color: #94a3b8 !important; }
            .rbc-month-view { min-height: 520px; }
            .rbc-month-row { min-height: 110px !important; overflow: visible !important; }
            .rbc-row-content { z-index: 2 !important; }
            .rbc-event {
              border: none !important;
              box-shadow: 0 2px 4px -1px rgb(0 0 0 / 0.12) !important;
              white-space: normal !important;
              height: auto !important;
              word-break: break-word !important;
              overflow-wrap: anywhere !important;
              padding: 4px 6px !important;
              margin-bottom: 2px !important;
            }
            .rbc-event-content {
              white-space: normal !important;
              word-break: break-word !important;
              overflow-wrap: anywhere !important;
              width: 100% !important;
            }
            @media (max-width: 640px) {
              .rbc-toolbar {
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 8px !important;
              }
              .rbc-toolbar .rbc-btn-group {
                display: flex !important;
                width: 100% !important;
                justify-content: center !important;
                margin: 0 !important;
              }
              .rbc-toolbar .rbc-btn-group button {
                flex: 1 !important;
                padding: 6px 4px !important;
                font-size: 10px !important;
                margin: 1px !important;
              }
              .rbc-toolbar-label {
                text-align: center !important;
                font-size: 13px !important;
                margin: 4px 0 !important;
              }
            }
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
          components={{
            event: CustomCalendarEvent
          }}
          formats={{
            agendaDateFormat: (d: Date) => {
              const dayWeek = format(d, 'EEEE', { locale: es });
              const capDay = dayWeek.charAt(0).toUpperCase() + dayWeek.slice(1);
              return `${capDay}, ${format(d, "d 'de' MMM", { locale: es })}`;
            },
            dayFormat: (d: Date) => {
              const dayWeek = format(d, 'EEE', { locale: es });
              const capDay = dayWeek.charAt(0).toUpperCase() + dayWeek.slice(1);
              return `${capDay} ${format(d, 'd/MM', { locale: es })}`;
            },
            dayHeaderFormat: (d: Date) => {
              const dayWeek = format(d, 'EEEE', { locale: es });
              const capDay = dayWeek.charAt(0).toUpperCase() + dayWeek.slice(1);
              return `${capDay}, ${format(d, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
            },
            weekdayFormat: (d: Date) => {
              const dayWeek = format(d, 'EEE', { locale: es });
              return dayWeek.charAt(0).toUpperCase() + dayWeek.slice(1);
            }
          }}
          messages={{
            next: 'Sig.',
            previous: 'Ant.',
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
            day: 'Día',
            agenda: 'Agenda'
          }}
          eventPropGetter={(event: any) => {
            const isEphem = event.is_global || event.type === 'ephemeris';

            // ALERTA ROJA: NO HAY DOCENCIA (Día destacado en rojo para suspensión de clases)
            if (event.suspends_classes) {
              return {
                style: {
                  backgroundColor: '#dc2626',
                  borderRadius: '8px',
                  border: '2px solid #f87171',
                  boxShadow: '0 3px 8px rgba(220, 38, 38, 0.35)',
                  padding: '3px 6px',
                  color: '#ffffff'
                }
              };
            }

            if (event.is_patriotic) {
              return {
                style: {
                  backgroundColor: '#1e3a8a',
                  borderRadius: '8px',
                  border: '1px solid #60a5fa',
                  padding: '3px 6px',
                  color: '#ffffff'
                }
              };
            }

            if (isEphem) {
              return {
                style: {
                  backgroundColor: '#0284c7',
                  borderRadius: '8px',
                  border: '1px solid #7dd3fc',
                  padding: '3px 6px',
                  color: '#ffffff'
                }
              };
            }

            // Actividad propia del centro:
            // Fondo blanco limpio con borde del color del centro y letras con el color oficial del centro!
            const actColor = event.centerColor || centerColor;
            return {
              style: {
                backgroundColor: '#ffffff',
                border: `1.5px solid ${actColor}`,
                boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.08)',
                borderRadius: '8px',
                padding: '3px 6px',
                color: actColor
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

              {/* Casilla de Alerta Roja: No Hay Docencia */}
              <div
                onClick={() =>
                  setNewActivity((prev) => ({
                    ...prev,
                    suspends_classes: !prev.suspends_classes
                  }))
                }
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                  newActivity.suspends_classes
                    ? 'bg-red-50/90 border-red-300 text-red-900 shadow-sm'
                    : 'bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center gap-3 pr-2">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                      newActivity.suspends_classes
                        ? 'bg-red-600 text-white shadow-md shadow-red-200'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    <Ban size={20} />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider block text-red-700">
                      Suspender Docencia (No hay clases)
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium block leading-tight mt-0.5">
                      Activa esta casilla para pintar este día en alerta roja destacada con aviso oficial de no docencia.
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={!!newActivity.suspends_classes}
                  onChange={(e) =>
                    setNewActivity({ ...newActivity, suspends_classes: e.target.checked })
                  }
                  className="w-5 h-5 rounded-md accent-red-600 cursor-pointer shrink-0"
                />
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

      {showEphemeridesModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[150] p-4 text-left animate-fade-in overflow-y-auto">
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl relative border border-white my-auto overflow-hidden">
            <button
              onClick={() => setShowEphemeridesModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors z-20 cursor-pointer"
              title="Cerrar"
            >
              <X size={24} />
            </button>
            <div className="flex-1 overflow-y-auto pr-1">
              <SchoolEphemeridesManager />
            </div>
          </div>
        </div>
      )}

      {viewingEvent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[110] p-4 text-left animate-fade-in">
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl relative border border-white">
            <button
              onClick={() => setViewingEvent(null)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-xl cursor-pointer"
            >
              <X size={22} />
            </button>

            <div className="flex items-start gap-3.5 mb-5">
              {viewingEvent.is_global || viewingEvent.type === 'ephemeris' ? (
                viewingEvent.is_patriotic ? (
                  <div className="w-12 h-12 rounded-2xl bg-blue-900 text-white flex items-center justify-center text-2xl shadow-lg shadow-blue-900/20 shrink-0">
                    🇩🇴
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center p-2 shadow-sm shrink-0">
                    <img
                      src="/minerd_logo.webp"
                      alt="MINERD"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )
              ) : (
                <div
                  className="w-12 h-12 rounded-2xl bg-white border-2 flex items-center justify-center shrink-0 shadow-sm"
                  style={{ borderColor: centerColor }}
                >
                  <CalendarIcon size={24} style={{ color: centerColor }} />
                </div>
              )}
              <div className="pr-6">
                <span
                  className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mb-1.5 border"
                  style={{
                    backgroundColor:
                      viewingEvent.is_global || viewingEvent.type === 'ephemeris'
                        ? '#f1f5f9'
                        : '#ffffff',
                    color:
                      viewingEvent.is_global || viewingEvent.type === 'ephemeris'
                        ? '#475569'
                        : centerColor,
                    borderColor:
                      viewingEvent.is_global || viewingEvent.type === 'ephemeris'
                        ? '#e2e8f0'
                        : `${centerColor}40`
                  }}
                >
                  {viewingEvent.is_patriotic
                    ? '🇩🇴 Fecha Patria Nacional'
                    : viewingEvent.is_global || viewingEvent.type === 'ephemeris'
                    ? 'Calendario Escolar Oficial MINERD'
                    : viewingEvent.type === 'incident'
                    ? 'Incidencia Institucional'
                    : viewingEvent.type === 'meeting'
                    ? 'Reunión Equipo Gestión'
                    : viewingEvent.type === 'pedagogical_group'
                    ? 'Reunión Pedagógica'
                    : 'Actividad Oficial del Centro'}
                </span>
                <h3
                  className="text-xl font-black leading-snug"
                  style={{
                    color:
                      viewingEvent.suspends_classes
                        ? '#dc2626'
                        : viewingEvent.is_global || viewingEvent.type === 'ephemeris'
                        ? '#1e293b'
                        : centerColor
                  }}
                >
                  {viewingEvent.title}
                </h3>
              </div>
            </div>

            {viewingEvent.suspends_classes && (
              <div className="p-3.5 bg-red-600 text-white rounded-2xl flex items-center gap-3 shadow-lg shadow-red-600/25 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Ban size={22} className="text-white" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider">
                    Jornada Sin Docencia Escolar
                  </h4>
                  <p className="text-[10px] text-red-100 font-medium leading-tight mt-0.5">
                    Este día no habrá docencia regular para los estudiantes.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-100 mb-6">
              <div className="flex items-center gap-2 text-slate-700 text-xs font-bold">
                <CalendarIcon
                  size={16}
                  className="shrink-0"
                  style={{
                    color:
                      viewingEvent.is_global || viewingEvent.type === 'ephemeris'
                        ? '#0284c7'
                        : centerColor
                  }}
                />
                <span className="capitalize">
                  {viewingEvent.start &&
                    format(new Date(viewingEvent.start), "EEEE, d 'de' MMMM 'de' yyyy", {
                      locale: es
                    })}
                </span>
              </div>

              {viewingEvent.raw?.startTime && (
                <div className="flex items-center gap-2 text-slate-700 text-xs font-bold">
                  <Clock
                    size={16}
                    className="shrink-0"
                    style={{
                      color:
                        viewingEvent.is_global || viewingEvent.type === 'ephemeris'
                          ? '#0284c7'
                          : centerColor
                    }}
                  />
                  <span>
                    {viewingEvent.raw.startTime}
                    {viewingEvent.raw.endTime &&
                    viewingEvent.raw.endTime !== viewingEvent.raw.startTime
                      ? ` - ${viewingEvent.raw.endTime}`
                      : ''}
                  </span>
                </div>
              )}

              {viewingEvent.desc && (
                <div className="pt-3 border-t border-slate-200/60">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Descripción / Detalles:
                  </span>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                    {viewingEvent.desc}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setViewingEvent(null)}
                className="w-full sm:w-auto px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
