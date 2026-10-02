import React, { useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useApp } from '../context/AppContext';
import { useSupabase } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { Activity } from '../types';
import toast from 'react-hot-toast';
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
  Ban,
  Building2,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';

import {
  SchoolEphemeridesManager,
  parseEphemerisDescription,
  formatEphemerisDescription
} from './SchoolEphemeridesManager';

const locales = { es: es };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const CustomCalendarEvent = ({ event }: any) => {
  const isEphem = event.is_global || event.type === 'ephemeris';
  const isPatriotic = event.is_patriotic;
  const isNoClasses = !!event.suspends_classes;
  const isIncident = event.type === 'incident';
  const isMeeting = event.type === 'meeting';
  const isPedagogical = event.type === 'pedagogical_group';
  const hasCenterDetails = !!event.centerDetails;

  const timeText = event.raw?.startTime
    ? event.raw.endTime && event.raw.endTime !== event.raw.startTime
      ? `${event.raw.startTime} - ${event.raw.endTime}`
      : event.raw.startTime
    : null;

  return (
    <div
      className="flex flex-col w-full h-full text-left overflow-hidden select-none p-0.5 leading-tight text-white"
      title={`${isNoClasses ? '🚫 NO HAY DOCENCIA\n' : ''}${event.title}${timeText ? ` (${timeText})` : ''}${event.centerDetails ? `\n\n📍 Actividad del Centro:\n${event.centerDetails}` : ''}${event.officialDesc ? `\n\n📖 Reseña:\n${event.officialDesc}` : event.desc ? `\n\n📝 ${event.desc}` : ''}`}
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
        ) : isIncident ? (
          <AlertTriangle size={12} className="text-white shrink-0 mt-0.5" />
        ) : isMeeting ? (
          <UsersIcon size={12} className="text-white shrink-0 mt-0.5" />
        ) : isPedagogical ? (
          <BookOpen size={12} className="text-white shrink-0 mt-0.5" />
        ) : (
          <Star size={11} className="text-white shrink-0 mt-0.5" />
        )}
        <span className="font-black text-[10px] md:text-[11px] leading-tight break-words line-clamp-2 text-white">
          {event.title}
        </span>
      </div>

      {/* Badge si tiene actividades organizadas por el centro */}
      {hasCenterDetails && (
        <div className="inline-flex items-center gap-1 px-1 py-0.5 rounded bg-amber-400 text-amber-950 font-black text-[7.5px] uppercase tracking-wider shadow-2xs mt-1 w-fit">
          <Building2 size={8} className="shrink-0 text-amber-900" />
          <span>Actividad Centro</span>
        </div>
      )}

      {/* Descripción abajo junto a la hora */}
      {(timeText || event.centerDetails || event.desc) && (
        <div className="mt-1 pt-0.5 flex flex-col gap-0.5 border-t border-white/25">
          {timeText && (
            <div className="flex items-center gap-1 text-[8.5px] font-bold text-white/90">
              <Clock size={10} className="shrink-0" />
              <span>{timeText}</span>
            </div>
          )}
          {event.centerDetails ? (
            <p className="text-[8.5px] font-bold leading-snug line-clamp-2 break-words whitespace-normal text-amber-200">
              📍 {event.centerDetails}
            </p>
          ) : event.desc ? (
            <p className="text-[8.5px] font-medium leading-snug line-clamp-2 break-words whitespace-normal text-white/95">
              {event.desc}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
};

export const Agenda = ({ readOnly = false }: { readOnly?: boolean }) => {
  const { state, center, addActivity, updateActivity, deleteActivity, refreshData } = useApp();
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
  const isStaffAdmin = userRole === 'admin' || userRole === 'coordinator' || isSuperAdmin;
  const isReadOnly = readOnly || !isStaffAdmin;
  const canManageEphemerides = isStaffAdmin;
  const centerColor = center?.primary_color || '#4f46e5';

  const [editingEphemeris, setEditingEphemeris] = useState<{
    id?: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    officialDesc: string;
    centerDetails: string;
    suspendsClasses: boolean;
  } | null>(null);

  // Solo administradores/coordinadores en PC pueden ver la vista de calendario mensual/semanal
  const [mobileViewMode, setMobileViewMode] = useState<'calendar' | 'list'>(() => {
    return isStaffAdmin ? 'calendar' : 'list';
  });
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [newActivity, setNewActivity] = useState({
    title: '',
    description: '',
    startTime: '08:00',
    endTime: '09:00',
    type: 'event' as 'event' | 'incident' | 'meeting' | 'pedagogical_group',
    scheduleEntryId: '',
    suspends_classes: false
  });

  // Filtrar estrictamente por privacidad de rol
  const events = (state.activities || [])
    .filter((a) => {
      const type = a.type || 'event';
      const isEphem = a.is_global || type === 'ephemeris';

      // Efemérides y feriados son siempre visibles para todos
      if (isEphem) return true;

      // Administradores ven todo
      if (isStaffAdmin) return true;

      // Incidencias, reuniones pedagógicas y de equipo de gestión son PRIVADAS y NO deben salir a alumnos, padres o terceros
      if (type === 'incident' || type === 'meeting' || type === 'pedagogical_group') {
        return false;
      }

      // Solo actividades y eventos institucionales públicos
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

        const { officialDesc, centerDetails } = parseEphemerisDescription(a.description || '');

        return {
          id: a.id,
          title: a.title,
          start,
          end,
          desc: a.description?.replace(/\[NO_DOCENCIA\]\s*/g, '').trim(),
          officialDesc,
          centerDetails,
          type: a.type || 'event',
          is_global: !!isEphem,
          is_patriotic: isPatriotic,
          suspends_classes: isNoClasses,
          centerColor,
          raw: {
            ...a,
            suspends_classes: isNoClasses,
            officialDesc,
            centerDetails
          }
        };
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);

  const filteredEvents = React.useMemo(() => {
    let list = [...events];
    if (categoryFilter === 'no_classes') {
      list = list.filter((e: any) => e.suspends_classes);
    } else if (categoryFilter === 'patriotic') {
      list = list.filter((e: any) => e.is_patriotic);
    } else if (categoryFilter === 'ephemeris') {
      list = list.filter((e: any) => (e.is_global || e.type === 'ephemeris') && !e.is_patriotic);
    } else if (categoryFilter === 'activities') {
      list = list.filter((e: any) => !e.is_global && e.type !== 'ephemeris');
    }
    return list.sort((a: any, b: any) => a.start.getTime() - b.start.getTime());
  }, [events, categoryFilter]);

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

  const handleOpenEditEphemeris = (event: any) => {
    const raw = event?.raw || event || {};
    const { officialDesc, centerDetails } = parseEphemerisDescription(raw.description || event?.desc || '');

    let dateStr = raw.date;
    if (!dateStr && event?.start) {
      dateStr = format(new Date(event.start), 'yyyy-MM-dd');
    }

    setEditingEphemeris({
      id: raw.id || event?.id,
      title: raw.title || event?.title || '',
      date: dateStr || format(new Date(), 'yyyy-MM-dd'),
      startTime: raw.startTime || raw.start_time || '08:00',
      endTime: raw.endTime || raw.end_time || '14:00',
      officialDesc: raw.officialDesc || officialDesc || '',
      centerDetails: raw.centerDetails || centerDetails || '',
      suspendsClasses: !!(raw.suspends_classes ?? event?.suspends_classes)
    });
    setViewingEvent(null);
  };

  const handleSaveEphemerisDetails = async () => {
    if (!editingEphemeris) return;
    if (!editingEphemeris.title.trim() || !editingEphemeris.date) {
      toast.error('Por favor completa el título y la fecha.');
      return;
    }

    setIsSaving(true);
    try {
      const targetCid = profile?.center_id || center?.id;
      if (!targetCid) {
        toast.error('No se encontró el centro educativo asociado a tu usuario.');
        return;
      }

      const finalDescription = formatEphemerisDescription(
        editingEphemeris.officialDesc,
        editingEphemeris.centerDetails,
        editingEphemeris.suspendsClasses
      );

      const payload: any = {
        title: editingEphemeris.title.trim(),
        date: editingEphemeris.date,
        description: finalDescription,
        type: 'ephemeris',
        start_time: editingEphemeris.startTime || '08:00',
        end_time: editingEphemeris.endTime || '14:00',
        suspends_classes: editingEphemeris.suspendsClasses,
        center_id: targetCid,
        is_global: false
      };

      const isVirtual = !editingEphemeris.id || String(editingEphemeris.id).startsWith('minerd_');

      if (!isVirtual) {
        let { error } = await supabase
          .from('activities')
          .update(payload)
          .eq('id', editingEphemeris.id);
        if (error && error.message?.includes('suspends_classes')) {
          const { suspends_classes, ...fallback } = payload;
          const retryRes = await supabase.from('activities').update(fallback).eq('id', editingEphemeris.id);
          error = retryRes.error;
        }
        if (error) throw error;
      } else {
        const { data: existing } = await supabase
          .from('activities')
          .select('id')
          .eq('center_id', targetCid)
          .eq('date', editingEphemeris.date)
          .eq('type', 'ephemeris')
          .limit(1);

        if (existing && existing.length > 0) {
          let { error } = await supabase
            .from('activities')
            .update(payload)
            .eq('id', existing[0].id);
          if (error) throw error;
        } else {
          let { error } = await supabase
            .from('activities')
            .insert([payload]);
          if (error && error.message?.includes('suspends_classes')) {
            const { suspends_classes, ...fallback } = payload;
            const retryRes = await supabase.from('activities').insert([fallback]);
            error = retryRes.error;
          }
          if (error) throw error;
        }
      }

      toast.success('¡Efeméride y detalles del centro guardados con éxito!');
      setEditingEphemeris(null);
      await refreshData(undefined, true);
    } catch (err: any) {
      console.error('Error al guardar efeméride:', err);
      toast.error('Error al guardar: ' + (err.message || 'Error de conexión'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetEphemerisToDefault = async (eventId: string, title: string) => {
    if (!window.confirm(`¿Deseas restablecer "${title}" a la efeméride oficial del MINERD y quitar los detalles del centro?`)) {
      return;
    }
    setIsSaving(true);
    try {
      if (eventId && !String(eventId).startsWith('minerd_')) {
        const { error } = await supabase.from('activities').delete().eq('id', eventId);
        if (error) throw error;
      }
      toast.success('Efeméride restablecida al catálogo oficial MINERD');
      setViewingEvent(null);
      await refreshData(undefined, true);
    } catch (err: any) {
      console.error('Error al restablecer efeméride:', err);
      toast.error('Error al restablecer: ' + (err.message || 'Error de conexión'));
    } finally {
      setIsSaving(false);
    }
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
    <div className="min-h-[820px] bg-white p-4 md:p-8 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col pb-8">
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
        {isStaffAdmin && (
          <>
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
          </>
        )}
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

      {/* SELECTOR VISTA MÓVIL / ESCRITORIO: CALENDARIO VS LISTA DE ACTIVIDADES */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 flex-wrap">
        {isStaffAdmin ? (
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl w-full sm:w-fit">
            <button
              type="button"
              onClick={() => setMobileViewMode('calendar')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                mobileViewMode === 'calendar'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarIcon size={14} /> Calendario Mensual
            </button>
            <button
              type="button"
              onClick={() => setMobileViewMode('list')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                mobileViewMode === 'list'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock size={14} /> Lista ({events.length})
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl">
              <Clock size={14} className="text-indigo-600" /> Listado de Actividades y Efemérides ({events.length})
            </span>
          </div>
        )}

        <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 custom-scrollbar">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'no_classes', label: '🚫 Sin Docencia' },
            { id: 'patriotic', label: '🇩🇴 Fechas Patrias' },
            { id: 'ephemeris', label: '🏫 MINERD' },
            { id: 'activities', label: '⭐ Centro' }
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setCategoryFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                categoryFilter === f.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {mobileViewMode === 'list' ? (
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
          {filteredEvents.length === 0 ? (
            <div className="py-20 text-center text-slate-400 font-bold italic bg-slate-50 rounded-2xl text-xs">
              No hay actividades registradas en esta categoría.
            </div>
          ) : (
            filteredEvents.map((event: any) => {
              const a = event.raw || {};
              const isNoClasses = !!event.suspends_classes;
              const isPatriotic = event.is_patriotic;
              const isEphem = event.is_global || event.type === 'ephemeris';
              const isIncident = event.type === 'incident';
              const isMeeting = event.type === 'meeting';
              const isPedagogical = event.type === 'pedagogical_group';

              const cardBg = isNoClasses
                ? 'bg-rose-50/70 border-rose-200 border-l-rose-600'
                : isPatriotic
                ? 'bg-blue-50/70 border-blue-200 border-l-blue-800'
                : isEphem
                ? 'bg-sky-50/70 border-sky-200 border-l-sky-600'
                : isIncident
                ? 'bg-pink-50/70 border-pink-200 border-l-pink-600'
                : isMeeting
                ? 'bg-cyan-50/70 border-cyan-200 border-l-cyan-600'
                : isPedagogical
                ? 'bg-purple-50/70 border-purple-200 border-l-purple-600'
                : 'bg-indigo-50/50 border-indigo-200 border-l-indigo-600';

              const badgeColor = isNoClasses
                ? 'bg-red-100 text-red-700'
                : isPatriotic
                ? 'bg-blue-100 text-blue-800'
                : isEphem
                ? 'bg-sky-100 text-sky-800'
                : isIncident
                ? 'bg-pink-100 text-pink-700'
                : isMeeting
                ? 'bg-cyan-100 text-cyan-800'
                : isPedagogical
                ? 'bg-purple-100 text-purple-800'
                : 'bg-indigo-100 text-indigo-800';

              const categoryTitle = isNoClasses
                ? '🚫 Suspensión de Docencia'
                : isPatriotic
                ? '🇩🇴 Fecha Patria Oficial'
                : isEphem
                ? '🏫 Efeméride MINERD'
                : isIncident
                ? '⚠️ Incidencia'
                : isMeeting
                ? '👥 R. Equipo Gestión'
                : isPedagogical
                ? '📖 R. Pedagógica'
                : '⭐ Actividad Institucional';

              const dateText = format(event.start, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
              const capDate = dateText.charAt(0).toUpperCase() + dateText.slice(1);

              return (
                <div
                  key={event.id}
                  onClick={() => handleSelectEvent(event)}
                  className={`p-4 rounded-2xl border border-l-4 transition-all cursor-pointer shadow-xs hover:shadow-md hover:scale-[1.005] ${cardBg}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 ${badgeColor}`}
                    >
                      {categoryTitle}
                    </span>
                    <span className="text-[10px] font-black text-slate-500 bg-white/90 border border-slate-200/80 px-2.5 py-1 rounded-lg">
                      📅 {capDate}
                    </span>
                  </div>

                  <h4 className="text-base font-black text-slate-900 tracking-tight leading-snug">
                    {event.title}
                  </h4>

                  {event.officialDesc && (
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-medium">
                      {event.officialDesc}
                    </p>
                  )}

                  {!event.officialDesc && event.desc && (
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-medium">
                      {event.desc}
                    </p>
                  )}

                  {event.centerDetails && (
                    <div className="mt-2.5 p-3 rounded-xl bg-indigo-50/80 border border-indigo-200/80 text-xs text-indigo-950 font-semibold flex items-start gap-2">
                      <Building2 size={15} className="text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900 block">
                          📍 Actividades / Organización del Centro:
                        </span>
                        <p className="mt-0.5 whitespace-pre-wrap leading-relaxed font-medium">
                          {event.centerDetails}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                      <Clock size={12} className="text-indigo-600" />
                      {a.startTime && a.endTime ? `${a.startTime} - ${a.endTime}` : 'Todo el día'}
                    </span>
                    <div className="flex items-center gap-3">
                      {canManageEphemerides && (event.is_global || event.type === 'ephemeris') && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditEphemeris(event);
                          }}
                          className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-indigo-50 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          <Pencil size={11} />
                          <span>{event.centerDetails ? 'Editar Detalles Centro' : 'Agregar Detalles'}</span>
                        </button>
                      )}
                      <span className="text-[9px] font-black uppercase text-slate-600 hover:underline">
                        Ver Ficha →
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-[660px] bg-slate-50/50 rounded-[2rem] border border-slate-100 p-3 sm:p-5 relative z-10 flex flex-col">
        <style>
          {`
            .rbc-calendar {
              min-height: 660px !important;
              height: 100% !important;
            }
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
            .rbc-month-view {
              min-height: 580px !important;
              height: auto !important;
              border-bottom: 1px solid #e2e8f0 !important;
            }
            .rbc-month-row {
              min-height: 105px !important;
              overflow: visible !important;
            }
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
            .rbc-agenda-view table.rbc-agenda-table tbody > tr > td {
              padding: 8px 10px !important;
              vertical-align: middle !important;
              font-weight: 600 !important;
            }
            .rbc-agenda-date-cell {
              font-weight: 900 !important;
              color: #1e293b !important;
              font-size: 11px !important;
              text-transform: uppercase !important;
              background-color: #f8fafc !important;
            }
            .rbc-agenda-time-cell {
              font-size: 10px !important;
              font-weight: 800 !important;
              color: #475569 !important;
            }
            .rbc-agenda-event-cell {
              font-size: 11px !important;
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

            if (event.type === 'incident') {
              return {
                style: {
                  backgroundColor: '#e11d48',
                  borderRadius: '8px',
                  border: '1px solid #fda4af',
                  padding: '3px 6px',
                  color: '#ffffff'
                }
              };
            }

            if (event.type === 'meeting') {
              return {
                style: {
                  backgroundColor: '#0891b2',
                  borderRadius: '8px',
                  border: '1px solid #67e8f9',
                  padding: '3px 6px',
                  color: '#ffffff'
                }
              };
            }

            if (event.type === 'pedagogical_group') {
              return {
                style: {
                  backgroundColor: '#7c3aed',
                  borderRadius: '8px',
                  border: '1px solid #c4b5fd',
                  padding: '3px 6px',
                  color: '#ffffff'
                }
              };
            }

            // Actividad propia del centro con color institucional
            const actColor = event.centerColor || centerColor || '#4f46e5';
            return {
              style: {
                backgroundColor: actColor,
                border: `1px solid ${actColor}`,
                boxShadow: '0 2px 5px rgba(0, 0, 0, 0.15)',
                borderRadius: '8px',
                padding: '3px 6px',
                color: '#ffffff'
              }
            };
          }}
        />
      </div>
    )}

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

              {viewingEvent.officialDesc ? (
                <div className="pt-3 border-t border-slate-200/60">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Reseña Histórica / Descripción Oficial MINERD:
                  </span>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                    {viewingEvent.officialDesc}
                  </p>
                </div>
              ) : viewingEvent.desc ? (
                <div className="pt-3 border-t border-slate-200/60">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Descripción / Detalles:
                  </span>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                    {viewingEvent.desc}
                  </p>
                </div>
              ) : null}

              {viewingEvent.centerDetails ? (
                <div className="p-4 rounded-2xl bg-indigo-50/90 border border-indigo-200 shadow-2xs">
                  <div className="flex items-center gap-2 text-indigo-900 font-black text-xs uppercase tracking-wider mb-1.5">
                    <Building2 size={16} className="text-indigo-600 shrink-0" />
                    <span>Actividades y Organización de Nuestro Centro:</span>
                  </div>
                  <p className="text-xs text-indigo-950 font-semibold leading-relaxed whitespace-pre-wrap">
                    {viewingEvent.centerDetails}
                  </p>
                </div>
              ) : canManageEphemerides && (viewingEvent.is_global || viewingEvent.type === 'ephemeris') ? (
                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs">
                  <p className="font-bold flex items-center gap-1.5 mb-1">
                    <Building2 size={14} className="text-amber-700 shrink-0" />
                    <span>¿Deseas agregar detalles de tu centro?</span>
                  </p>
                  <p className="text-[11px] text-amber-800 leading-snug">
                    Puedes especificar el programa de actos cívicos, asignación de cursos, poesías o vestimenta escolar pulsando en <strong>"Agregar Detalles del Centro"</strong>.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {canManageEphemerides && (viewingEvent.is_global || viewingEvent.type === 'ephemeris') && !String(viewingEvent.id || viewingEvent.raw?.id).startsWith('minerd_') && (
                  <button
                    type="button"
                    onClick={() => handleResetEphemerisToDefault(viewingEvent.raw?.id || viewingEvent.id, viewingEvent.title)}
                    className="w-full sm:w-auto px-3.5 py-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Restablecer efeméride a la versión predeterminada oficial"
                  >
                    <RotateCcw size={13} />
                    <span>Restablecer</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setViewingEvent(null)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cerrar
                </button>
                {canManageEphemerides && (viewingEvent.is_global || viewingEvent.type === 'ephemeris') && (
                  <button
                    type="button"
                    onClick={() => handleOpenEditEphemeris(viewingEvent)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                  >
                    <Pencil size={13} />
                    <span>{viewingEvent.centerDetails ? 'Editar Detalles' : 'Agregar Detalles del Centro'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR EFEMÉRIDE Y DETALLES DEL CENTRO */}
      {editingEphemeris && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[120] p-3 sm:p-4 text-left animate-fade-in">
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl relative border border-white">
            <button
              onClick={() => setEditingEphemeris(null)}
              className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 transition-colors p-1 rounded-xl cursor-pointer"
            >
              <X size={22} />
            </button>

            <div className="flex items-center gap-3 shrink-0 mb-4 border-b border-slate-100 pb-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shadow-xs">
                <Building2 size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 tracking-tight">
                  Editar Efeméride y Detalles del Centro
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Organiza actos, notas y especificaciones para tu centro educativo
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Título de la Efeméride *
                </label>
                <input
                  type="text"
                  required
                  value={editingEphemeris.title}
                  onChange={(e) => setEditingEphemeris({ ...editingEphemeris, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    required
                    value={editingEphemeris.date}
                    onChange={(e) => setEditingEphemeris({ ...editingEphemeris, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Hora Inicio
                  </label>
                  <input
                    type="time"
                    value={editingEphemeris.startTime}
                    onChange={(e) => setEditingEphemeris({ ...editingEphemeris, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Hora Fin
                  </label>
                  <input
                    type="time"
                    value={editingEphemeris.endTime}
                    onChange={(e) => setEditingEphemeris({ ...editingEphemeris, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* CAMPO DESTACADO: DETALLES Y ACTIVIDADES DEL CENTRO */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border-2 border-indigo-200 shadow-xs">
                <label className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-indigo-900 mb-1.5">
                  <Building2 size={16} className="text-indigo-600" />
                  <span>Detalles y Organización de Nuestro Centro</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Ej: Acto cívico en el patio a las 8:30 AM. Izamiento solemne con 6to de secundaria, poesías a cargo de 4to grado y palabras de la directora. Vestimenta de gala escolar..."
                  value={editingEphemeris.centerDetails}
                  onChange={(e) => setEditingEphemeris({ ...editingEphemeris, centerDetails: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-indigo-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                />
                <p className="text-[10px] text-indigo-700/80 mt-1 font-medium">
                  Estos detalles aparecerán destacados en el calendario institucional y la ficha del evento para toda la comunidad escolar.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Reseña Histórica / Descripción Oficial MINERD
                </label>
                <textarea
                  rows={2}
                  placeholder="Contexto histórico de la fecha..."
                  value={editingEphemeris.officialDesc}
                  onChange={(e) => setEditingEphemeris({ ...editingEphemeris, officialDesc: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* SUSPENDER DOCENCIA */}
              <div
                onClick={() => setEditingEphemeris({ ...editingEphemeris, suspendsClasses: !editingEphemeris.suspendsClasses })}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                  editingEphemeris.suspendsClasses
                    ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${editingEphemeris.suspendsClasses ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    <Ban size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider">
                      Suspender Docencia (No hay clases)
                    </p>
                    <p className="text-[10px] opacity-80">
                      Alerta roja en el calendario para padres, docentes y alumnos
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={editingEphemeris.suspendsClasses}
                  onChange={(e) => setEditingEphemeris({ ...editingEphemeris, suspendsClasses: e.target.checked })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 shrink-0 mt-3">
              <button
                type="button"
                onClick={() => setEditingEphemeris(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveEphemerisDetails}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 size={15} />
                <span>{isSaving ? 'Guardando...' : 'Guardar para el Centro'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
