import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { usePreferences } from '../hooks/usePreferences';
import { useTeachers } from '../hooks/useTeachers';
import { Day, Level } from '../types';
import {
  Calendar,
  Clock,
  Trash2,
  Save,
  UserCheck,
  Coffee,
  ThermometerSnowflake,
  Pencil,
  Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export const PreferencesForm = () => {
  const {
    teacherPreferences,
    breakPreferences,
    winterPreference,
    isLoading,
    addTeacherPreference,
    deleteTeacherPreference,
    addBreakPreference,
    deleteBreakPreference,
    setWinterSchedulePreference
  } = usePreferences();

  const { teachers: allTeachers } = useTeachers();
  const { state, profile, refreshData, addPriorityPreference, deletePriorityPreference } = useApp();

  // Estado para Preferencias de Docente
  const [teacherPref, setTeacherPref] = useState({
    id: '',
    teacherId: '',
    workingDays: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] as Day[],
    morningStart: '08:00',
    morningEnd: '12:00',
    afternoonStart: '14:00',
    afternoonEnd: '18:15'
  });

  const [breakPref, setBreakPref] = useState({
    id: '',
    startTime: '10:00',
    durationMinutes: 30,
    level: 'Inicial' as Level,
    cycle: 'General' as any
  });
  const [winterPref, setWinterPref] = useState({
    reductionFactor: 0.9,
    startDate: '',
    endDate: ''
  });

  const daysOfWeek: Day[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const [dailyConfig, setDailyConfig] = useState<Record<string, any>>({});
  const [activeDaySettings, setActiveDaySettings] = useState<Day | null>(null);

  useEffect(() => {
    if (winterPreference) {
      setWinterPref(winterPreference);
    }
  }, [winterPreference]);

  const toggleDay = (day: Day) => {
    if (teacherPref.workingDays.includes(day)) {
      setTeacherPref({
        ...teacherPref,
        workingDays: teacherPref.workingDays.filter((d) => d !== day)
      });
    } else {
      setTeacherPref({ ...teacherPref, workingDays: [...teacherPref.workingDays, day] });
    }
  };

  const updateDailyRange = (day: string, field: string, value: string) => {
    setDailyConfig((prev) => ({
      ...prev,
      [day]: {
        ...(prev[day] || {
          mStart: teacherPref.morningStart,
          mEnd: teacherPref.morningEnd,
          aStart: teacherPref.afternoonStart,
          aEnd: teacherPref.afternoonEnd
        }),
        [field]: value
      }
    }));
  };

  const handleAddTeacherPref = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherPref.teacherId) return alert('Seleccione un docente');
    try {
      await addTeacherPreference({ ...teacherPref, dailyConfig });
      alert('Preferencia guardada');
      setTeacherPref({
        id: '',
        teacherId: '',
        workingDays: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
        morningStart: '08:00',
        morningEnd: '12:00',
        afternoonStart: '14:00',
        afternoonEnd: '18:15'
      });
      setDailyConfig({});
      setActiveDaySettings(null);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const inputClass =
    'w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white shadow-sm';
  const labelClass =
    'text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1';

  return (
    <div className="space-y-12 w-full pb-20">
      {/* SECCIÓN 1: DISPONIBILIDAD DOCENTE */}
      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl space-y-8">
        <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <UserCheck size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">
              Consola de Disponibilidad Docente
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              Configura días y rangos por tanda
            </p>
          </div>
        </div>

        <form onSubmit={handleAddTeacherPref} className="grid grid-cols-1 xl:grid-cols-2 gap-10">
          {/* Lado Izquierdo: Docente y Días */}
          <div className="space-y-6">
            <div>
              <label className={labelClass}>Seleccionar Docente</label>
              <select
                value={teacherPref.teacherId}
                onChange={(e) => setTeacherPref({ ...teacherPref, teacherId: e.target.value })}
                className={inputClass}
                required
              >
                <option value="">Buscar docente...</option>
                {(allTeachers || [])
                  .filter((t: any) => t.role === 'teacher' || t.role === 'management_teacher')
                  .map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Días Laborables</label>
              <p className="text-[9px] text-slate-400 mb-2 flex items-center gap-1">
                <Clock size={10} /> Clic en el reloj para horario especial
              </p>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map((day) => (
                  <div key={day} className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                        teacherPref.workingDays.includes(day)
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100'
                          : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                    {teacherPref.workingDays.includes(day) && (
                      <button
                        type="button"
                        onClick={() => setActiveDaySettings(activeDaySettings === day ? null : day)}
                        className={`p-2 rounded-xl border transition-all ${
                          activeDaySettings === day || dailyConfig[day]
                            ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-100'
                            : 'bg-slate-50 text-slate-400 border-slate-100'
                        }`}
                      >
                        <Clock size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Ajustes Especiales para el Día Seleccionado */}
            {activeDaySettings && (
              <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-100 duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-black text-amber-600 uppercase tracking-widest">
                    Horario Especial: {activeDaySettings}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setActiveDaySettings(null)}
                    className="text-amber-400 hover:text-amber-600 font-bold text-[10px] uppercase"
                  >
                    Cerrar
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">
                      Mañana
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={dailyConfig[activeDaySettings]?.mStart || teacherPref.morningStart}
                        onChange={(e) =>
                          updateDailyRange(activeDaySettings, 'mStart', e.target.value)
                        }
                        className="w-full bg-white border-amber-100 rounded-lg text-[10px] p-2"
                      />
                      <input
                        type="time"
                        value={dailyConfig[activeDaySettings]?.mEnd || teacherPref.morningEnd}
                        onChange={(e) =>
                          updateDailyRange(activeDaySettings, 'mEnd', e.target.value)
                        }
                        className="w-full bg-white border-amber-100 rounded-lg text-[10px] p-2"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">
                      Tarde
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={dailyConfig[activeDaySettings]?.aStart || teacherPref.afternoonStart}
                        onChange={(e) =>
                          updateDailyRange(activeDaySettings, 'aStart', e.target.value)
                        }
                        className="w-full bg-white border-amber-100 rounded-lg text-[10px] p-2"
                      />
                      <input
                        type="time"
                        value={dailyConfig[activeDaySettings]?.aEnd || teacherPref.afternoonEnd}
                        onChange={(e) =>
                          updateDailyRange(activeDaySettings, 'aEnd', e.target.value)
                        }
                        className="w-full bg-white border-amber-100 rounded-lg text-[10px] p-2"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[8px] text-amber-400 mt-4 italic font-medium">
                  * Si no modificas un campo, se usará el horario general.
                </p>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl flex items-center justify-center gap-2"
            >
              <Save size={18} /> Guardar Disponibilidad
            </button>
          </div>

          {/* Lado Derecho: Tanda Matutina y Vespertina */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
            {/* Tanda Matutina */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-indigo-600 mb-2">
                <Clock size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Tanda Matutina
                </span>
              </div>
              <div>
                <label className={labelClass}>Entrada</label>
                <input
                  type="time"
                  value={teacherPref.morningStart}
                  onChange={(e) => setTeacherPref({ ...teacherPref, morningStart: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Salida</label>
                <input
                  type="time"
                  value={teacherPref.morningEnd}
                  onChange={(e) => setTeacherPref({ ...teacherPref, morningEnd: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Tanda Vespertina */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-orange-500 mb-2">
                <Clock size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Tanda Vespertina
                </span>
              </div>
              <div>
                <label className={labelClass}>Entrada</label>
                <input
                  type="time"
                  value={teacherPref.afternoonStart}
                  onChange={(e) =>
                    setTeacherPref({ ...teacherPref, afternoonStart: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Salida</label>
                <input
                  type="time"
                  value={teacherPref.afternoonEnd}
                  onChange={(e) => setTeacherPref({ ...teacherPref, afternoonEnd: e.target.value })}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setTeacherPref({ ...teacherPref, afternoonEnd: '18:15' })}
                  className="mt-2 w-full py-1.5 bg-orange-100 text-orange-600 rounded-lg text-[9px] font-black uppercase hover:bg-orange-200 transition-colors"
                >
                  Fijar 6:15 PM (Oficial)
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* LISTA DE PREFERENCIAS ACTUALES */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-slate-100">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                <th className="px-6 py-4">Docente</th>
                <th className="px-6 py-4">Días</th>
                <th className="px-6 py-4">Horarios (M / V)</th>
                <th className="px-6 py-4">Horas Disponibles</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(teacherPreferences || []).map((p: any) => {
                const teacher = (allTeachers || []).find((t: any) => t.id === p.teacherId);
                const calculateShiftHours = (shift: 'morning' | 'afternoon') => {
                  let totalPeriods = 0;
                  const days =
                    (p.workingDays || []).length > 0
                      ? p.workingDays
                      : ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
                  const periodDuration = shift === 'morning' ? 45 : 40;
                  const maxPeriods = shift === 'morning' ? 5 : 6;

                  days.forEach((day: string) => {
                    const config = p.dailyConfig?.[day] || {};
                    const start =
                      shift === 'morning'
                        ? config.mStart || p.morningStart
                        : config.aStart || p.afternoonStart;
                    const end =
                      shift === 'morning'
                        ? config.mEnd || p.morningEnd
                        : config.aEnd || p.afternoonEnd;

                    if (start && end && start !== end) {
                      const [h1, m1] = start.split(':').map(Number);
                      const [h2, m2] = end.split(':').map(Number);
                      const diff = h2 * 60 + m2 - (h1 * 60 + m1);
                      if (diff > 0) {
                        const dailyPeriods = Math.floor(diff / periodDuration);
                        totalPeriods += Math.min(maxPeriods, dailyPeriods);
                      }
                    }
                  });
                  return totalPeriods || (shift === 'morning' ? days.length * 5 : 0);
                };

                const mHours = calculateShiftHours('morning');
                const vHours = calculateShiftHours('afternoon');
                const displayCapacity = `M: ${mHours}h | V: ${vHours}h`;

                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800 text-sm">
                      {teacher?.name || 'Desconocido'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {(p.workingDays || []).map((d: string) => (
                          <span
                            key={d}
                            className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded uppercase"
                          >
                            {d.slice(0, 2)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-500">
                      <span className="text-indigo-600">
                        M: {p.morningStart}-{p.morningEnd}
                      </span>
                      <span className="mx-2 text-slate-300">|</span>
                      <span className="text-orange-500">
                        V: {p.afternoonStart}-{p.afternoonEnd}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
                        {displayCapacity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setTeacherPref({
                            id: p.id,
                            teacherId: p.teacherId,
                            workingDays: p.workingDays || [],
                            morningStart: p.morningStart || '08:00',
                            morningEnd: p.morningEnd || '12:00',
                            afternoonStart: p.afternoonStart || '14:00',
                            afternoonEnd: p.afternoonEnd || '18:15'
                          });
                          setDailyConfig(p.dailyConfig || {});
                        }}
                        className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() =>
                          confirm('¿Borrar esta preferencia?') && deleteTeacherPreference(p.id)
                        }
                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* OTRAS SECCIONES: RECREO E INVIERNO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* RECREOS */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <Coffee className="text-indigo-600" />
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
              Configurar Recreos
            </h3>
          </div>
          <form className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nivel</label>
              <select
                value={breakPref.level}
                onChange={(e) => setBreakPref({ ...breakPref, level: e.target.value as Level })}
                className={inputClass}
              >
                <option value="Inicial">Inicial</option>
                <option value="Primario">Primario</option>
                <option value="Secundario">Secundario</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Inicio Recreo</label>
              <input
                type="time"
                value={breakPref.startTime}
                onChange={(e) => setBreakPref({ ...breakPref, startTime: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Duración (Minutos)</label>
              <input
                type="number"
                value={breakPref.durationMinutes}
                onChange={(e) =>
                  setBreakPref({ ...breakPref, durationMinutes: parseInt(e.target.value) })
                }
                className={inputClass}
              />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Ciclo</label>
              <select
                value={breakPref.cycle}
                onChange={(e) => setBreakPref({ ...breakPref, cycle: e.target.value as any })}
                className={inputClass}
                disabled={breakPref.level === 'Inicial'}
              >
                <option value="General">General (Todo el Nivel)</option>
                <option value="Primer Ciclo">Primer Ciclo</option>
                <option value="Segundo Ciclo">Segundo Ciclo</option>
              </select>
            </div>
            <div className="col-span-2 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await addBreakPreference(breakPref);
                    alert(breakPref.id ? 'Recreo actualizado' : 'Recreo añadido correctamente');
                    setBreakPref({
                      id: '',
                      startTime: '10:00',
                      durationMinutes: 30,
                      level: 'Inicial' as Level,
                      cycle: 'General' as any
                    });
                  } catch (err: any) {
                    console.error('Error guardando recreo:', err);
                    alert('No se pudo guardar el recreo. Error: ' + (err.message || 'Error desconocido'));
                  }
                }}
                className={`flex-1 py-3 ${breakPref.id ? 'bg-orange-500 hover:bg-orange-600' : 'bg-slate-900 hover:bg-black'} text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all`}
              >
                {breakPref.id ? 'Actualizar Recreo' : 'Añadir Recreo'}
              </button>
              {breakPref.id && (
                <button
                  type="button"
                  onClick={() =>
                    setBreakPref({
                      id: '',
                      startTime: '10:00',
                      durationMinutes: 30,
                      level: 'Inicial' as Level,
                      cycle: 'General' as any
                    })
                  }
                  className="px-4 py-3 bg-slate-100 text-slate-400 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                >
                  X
                </button>
              )}
            </div>
          </form>

          {/* LISTA DE RECREOS */}
          {(breakPreferences || []).length > 0 && (
            <div className="mt-6 border-t border-slate-50 pt-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                Recreos Registrados
              </h4>
              <div className="space-y-2">
                {(breakPreferences || []).map((b: any) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm text-indigo-600 font-bold text-[10px]">
                        {b.level[0]}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800">
                          {b.level} - {b.cycle}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                          {b.startTime} • {b.durationMinutes} min
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setBreakPref({ ...b })}
                        className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"
                        title="Editar recreo"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deleteBreakPreference(b.id)}
                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                        title="Eliminar recreo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SECCIÓN 3: CONFIGURACIÓN DE INVIERNO */}
        <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-2xl space-y-10 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-50/50 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/3"></div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-50 pb-8">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                <ThermometerSnowflake size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  Horario de Invierno
                </h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Ajuste automático de salida temporada
                </p>
              </div>
            </div>
            {winterPreference && (
              <div className="self-start md:self-center px-5 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[11px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-2 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                Modo Invierno Activo
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                Fecha de Inicio
              </label>
              <input
                type="date"
                value={winterPref.startDate}
                onChange={(e) => setWinterPref({ ...winterPref, startDate: e.target.value })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all outline-none shadow-inner"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                Fecha de Finalización
              </label>
              <input
                type="date"
                value={winterPref.endDate}
                onChange={(e) => setWinterPref({ ...winterPref, endDate: e.target.value })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all outline-none shadow-inner"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                Reducción (Minutos)
              </label>
              <div className="relative group">
                <input
                  type="number"
                  placeholder="Ej: 5"
                  value={Math.round((1 - winterPref.reductionFactor) * 45)}
                  onChange={(e) => {
                    const mins = parseInt(e.target.value) || 0;
                    const factor = (45 - mins) / 45;
                    setWinterPref({ ...winterPref, reductionFactor: factor });
                  }}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all outline-none shadow-inner pr-16"
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">
                  Min
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await setWinterSchedulePreference(winterPref);
                  alert('✓ Configuración de invierno guardada correctamente');
                } catch (err: any) {
                  alert('Error: ' + err.message);
                }
              }}
              className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-black transition-all shadow-2xl shadow-slate-200 flex items-center justify-center gap-3"
            >
              <Save size={18} /> Guardar Configuración Permanente
            </button>
            {winterPreference && (
              <button
                type="button"
                onClick={async () => {
                  if (confirm('¿Desactivar el horario de invierno?')) {
                    await setWinterSchedulePreference(null);
                    setWinterPref({ reductionFactor: 1, startDate: '', endDate: '' });
                  }
                }}
                className="flex-1 py-5 bg-white text-rose-600 border-2 border-rose-100 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-rose-50 hover:border-rose-200 transition-all"
              >
                Desactivar
              </button>
            )}
          </div>

          <div className="bg-indigo-50/50 p-8 rounded-[2.5rem] border border-indigo-100/30 flex items-start gap-5">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm shrink-0 border border-indigo-100">
              <Clock size={20} />
            </div>
            <p className="text-[12px] font-medium text-slate-600 leading-relaxed">
              <span className="font-black text-indigo-900 mr-2 italic tracking-tight">
                CÁLCULO AUTOMÁTICO:
              </span>
              Si configuras{' '}
              <span className="font-black text-indigo-600 mx-1 underline decoration-2 underline-offset-4">
                5 minutos
              </span>{' '}
              de reducción, el sistema restará ese tiempo a cada periodo de clase. En un horario de
              7 periodos, los alumnos saldrán{' '}
              <span className="font-black text-indigo-600 mx-1 underline decoration-2 underline-offset-4">
                35 minutos antes
              </span>{' '}
              sin necesidad de modificar el horario base.
            </p>
          </div>
        </section>
      </div>
      {/* SECCIÓN 4: HORARIO OFICIAL POR NIVELES */}
      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl space-y-8">
        <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
          <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
            <Clock size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">
              Horario Oficial por Niveles
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              Define la jornada límite de cada nivel
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nivel</label>
                <select id="official-level" className={inputClass}>
                  <option value="Inicial">Inicial</option>
                  <option value="Primario">Primario</option>
                  <option value="Secundario">Secundario</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Tanda</label>
                <select id="official-shift" className={inputClass}>
                  <option value="Matutina">Matutina</option>
                  <option value="Vespertina">Vespertina</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Entrada Oficial</label>
                <input
                  type="time"
                  id="official-start"
                  defaultValue="07:30"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Salida Oficial</label>
                <input type="time" id="official-end" defaultValue="12:00" className={inputClass} />
              </div>
            </div>
            <button
              onClick={async () => {
                const level = (document.getElementById('official-level') as HTMLSelectElement)
                  .value;
                const shift = (document.getElementById('official-shift') as HTMLSelectElement)
                  .value;
                const start = (document.getElementById('official-start') as HTMLInputElement).value;
                const end = (document.getElementById('official-end') as HTMLInputElement).value;

                try {
                  const { error } = await supabase.from('level_schedules').upsert(
                    {
                      center_id: profile?.center_id,
                      level,
                      shift,
                      start_time: start,
                      end_time: end
                    },
                    { onConflict: 'center_id,level,shift' }
                  );

                  if (error) throw error;
                  alert('Horario oficial guardado correctamente');
                  await refreshData(undefined, true);
                } catch (e: any) {
                  alert('Error: ' + e.message);
                }
              }}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl flex items-center justify-center gap-2"
            >
              <Save size={18} /> Guardar Horario Nivel
            </button>
          </div>

          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
              Límites Registrados
            </h4>
            <div className="space-y-3">
              {(state.levelSchedules || []).length > 0 ? (
                (state.levelSchedules || []).map((ls: any) => (
                  <div
                    key={ls.id}
                    className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-100"
                  >
                    <div>
                      <p className="text-xs font-black text-slate-800">
                        {ls.level} - {ls.shift}
                      </p>
                      <p className="text-[10px] font-bold text-indigo-600 uppercase">
                        {ls.start_time} - {ls.end_time}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm('¿Borrar este horario oficial?')) {
                          await supabase.from('level_schedules').delete().eq('id', ls.id);
                          await refreshData(undefined, true);
                        }
                      }}
                      className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-slate-400 italic">
                  Configure los horarios arriba para verlos aquí.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
      {/* SECCIÓN 5: EVENTOS FIJOS INSTITUCIONALES */}
      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl space-y-8">
        <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <Calendar size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">
              Eventos Fijos Institucionales
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              Bloquea tiempos para Bandera, Capilla, etc.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div>
              <label className={labelClass}>Nombre del Evento</label>
              <input
                type="text"
                id="fixed-name"
                placeholder="Ej: Acto de Bandera"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className={labelClass}>Día</label>
                <select id="fixed-day" className={inputClass}>
                  <option value="Todos">Todos los días</option>
                  <option value="Lunes">Lunes</option>
                  <option value="Martes">Martes</option>
                  <option value="Miércoles">Miércoles</option>
                  <option value="Jueves">Jueves</option>
                  <option value="Viernes">Viernes</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Inicio</label>
                <input type="time" id="fixed-start" defaultValue="07:30" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Fin</label>
                <input type="time" id="fixed-end" defaultValue="08:00" className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nivel</label>
                <select id="fixed-level" className={inputClass}>
                  <option value="General">Todo el Centro</option>
                  <option value="Inicial">Inicial</option>
                  <option value="Primaria">Primaria</option>
                  <option value="Secundaria">Secundaria</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Ciclo</label>
                <select id="fixed-cycle" className={inputClass}>
                  <option value="General">General (Todo el Nivel)</option>
                  <option value="Primer Ciclo">Primer Ciclo (1ro-3ro)</option>
                  <option value="Segundo Ciclo">Segundo Ciclo (4to-6to)</option>
                </select>
              </div>
            </div>
            <button
              onClick={async () => {
                const nameInput = document.getElementById('fixed-name') as HTMLInputElement;
                const dayInput = document.getElementById('fixed-day') as HTMLSelectElement;
                const startInput = document.getElementById('fixed-start') as HTMLInputElement;
                const endInput = document.getElementById('fixed-end') as HTMLInputElement;
                const levelInput = document.getElementById('fixed-level') as HTMLSelectElement;
                const cycleInput = document.getElementById('fixed-cycle') as HTMLSelectElement;

                if (!nameInput.value) return alert('Por favor, asigne un nombre al evento (ej. Acto de Bandera)');

                try {
                  const { error } = await supabase.from('fixed_events').insert({
                    center_id: profile?.center_id,
                    name: nameInput.value,
                    day: dayInput.value,
                    start_time: startInput.value,
                    end_time: endInput.value,
                    level: levelInput.value,
                    cycle: cycleInput.value
                  });

                  if (error) throw error;
                  
                  alert('✓ Evento institucional guardado correctamente');
                  nameInput.value = '';
                  await refreshData(undefined, true);
                } catch (e: any) {
                  console.error('Error saving event:', e);
                  alert('Error al guardar: ' + (e.message || 'Error de conexión'));
                }
              }}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl flex items-center justify-center gap-2"
            >
              <Save size={18} /> Registrar Evento
            </button>
          </div>

          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
              Eventos Registrados
            </h4>
            <div className="space-y-3">
              {(state.fixedEvents || []).length > 0 ? (
                (state.fixedEvents || []).map((fe: any) => (
                  <div
                    key={fe.id}
                    className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-100"
                  >
                    <div>
                      <p className="text-xs font-black text-slate-800">{fe.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        {fe.day} | {fe.start_time} - {fe.end_time}
                      </p>
                      <p className="text-[9px] font-black text-indigo-500 uppercase mt-1">
                        📍 {fe.level} - {fe.cycle}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm('¿Borrar este evento institucional?')) {
                          await supabase.from('fixed_events').delete().eq('id', fe.id);
                          await refreshData(undefined, true);
                        }
                      }}
                      className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-slate-400 italic">
                  No hay eventos fijos registrados.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 6: PRIORIDADES DINÁMICAS (GUARDADO LOCALMENTE) */}
      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl space-y-8">
        <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
          <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-100">
            <span className="font-black text-2xl">★</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">
              Prioridades de Generación
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              Asigna prioridad VIP a materias o docentes por ciclo
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nivel</label>
                <select id="priority-level" className={inputClass} defaultValue="Primario">
                  <option value="Primario">Primario</option>
                  <option value="Secundario">Secundario</option>
                  <option value="General">General</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Ciclo</label>
                <select id="priority-cycle" className={inputClass} defaultValue="Primer Ciclo">
                  <option value="Primer Ciclo">Primer Ciclo</option>
                  <option value="Segundo Ciclo">Segundo Ciclo</option>
                  <option value="General">General (Todo el Nivel)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>¿A qué le darás prioridad?</label>
                <select
                  id="priority-target-type"
                  className={inputClass}
                  onChange={(e) => {
                    const subjectDiv = document.getElementById('priority-subject-div');
                    const teacherDiv = document.getElementById('priority-teacher-div');
                    if (e.target.value === 'subject') {
                      subjectDiv?.classList.remove('hidden');
                      teacherDiv?.classList.add('hidden');
                    } else {
                      subjectDiv?.classList.add('hidden');
                      teacherDiv?.classList.remove('hidden');
                    }
                  }}
                >
                  <option value="subject">Una Materia</option>
                  <option value="teacher">Un Docente</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Nivel de Prioridad</label>
                <select id="priority-score" className={inputClass}>
                  <option value="100">🔥 Muy Alta (Se asigna de primero)</option>
                  <option value="80">⭐ Alta</option>
                  <option value="60">✅ Media</option>
                </select>
              </div>
            </div>

            <div id="priority-subject-div">
              <label className={labelClass}>Selecciona la Materia</label>
              <select id="priority-subject" className={inputClass}>
                <option value="">Seleccione...</option>
                {(state.subjects || []).map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.level})
                  </option>
                ))}
              </select>
            </div>

            <div id="priority-teacher-div" className="hidden">
              <label className={labelClass}>Selecciona el Docente</label>
              <select id="priority-teacher" className={inputClass}>
                <option value="">Seleccione...</option>
                {(allTeachers || [])
                  .filter((t: any) => t.role === 'teacher' || t.role === 'management_teacher')
                  .map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>

            <button
              type="button"
              onClick={async () => {
                const level = (document.getElementById('priority-level') as HTMLSelectElement)
                  .value;
                const cycle = (document.getElementById('priority-cycle') as HTMLSelectElement)
                  .value;
                const targetType = (
                  document.getElementById('priority-target-type') as HTMLSelectElement
                ).value;
                const score = parseInt(
                  (document.getElementById('priority-score') as HTMLSelectElement).value
                );

                const targetId =
                  targetType === 'subject'
                    ? (document.getElementById('priority-subject') as HTMLSelectElement).value
                    : (document.getElementById('priority-teacher') as HTMLSelectElement).value;

                if (!targetId) return alert('Debes seleccionar la materia o docente');

                try {
                  await addPriorityPreference({
                    level,
                    cycle,
                    targetType,
                    targetId,
                    score
                  });
                  alert('Prioridad configurada exitosamente');
                } catch (e: any) {
                  alert('Error: ' + e.message);
                }
              }}
              className="w-full py-4 bg-amber-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-xl flex items-center justify-center gap-2"
            >
              <Save size={18} /> Añadir Prioridad VIP
            </button>
            <p className="text-[10px] text-slate-400 italic leading-relaxed">
              * Nota: El sistema prioriza automáticamente a los profesores con más horas, pero las
              reglas que añadas aquí sumarán puntos extra para forzar que ciertas materias (ej.
              Arte) se acomoden antes. <br />
              (Se guarda localmente en este dispositivo).
            </p>
          </div>

          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
              Reglas de Prioridad Actuales
            </h4>
            <div className="space-y-3">
              {(state.priorityPreferences || []).length > 0 ? (
                (state.priorityPreferences || []).map((p: any) => {
                  const targetName =
                    p.targetType === 'subject'
                      ? (state.subjects || []).find((s: any) => s.id === p.targetId)?.name
                      : (allTeachers || []).find((t: any) => t.id === p.targetId)?.name;

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-100"
                    >
                      <div>
                        <p className="text-xs font-black text-slate-800">
                          {p.targetType === 'subject' ? '📚 Materia:' : '👨‍🏫 Docente:'}{' '}
                          <span className="text-amber-600">{targetName || 'Desconocido'}</span>
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                          {p.level} • {p.cycle}
                        </p>
                        <p className="text-[9px] font-black text-indigo-500 uppercase mt-1">
                          Fuerza: {p.score} PTS
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          if (confirm('¿Borrar esta regla de prioridad?')) {
                            await deletePriorityPreference(p.id);
                          }
                        }}
                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className="text-[10px] text-slate-400 italic">
                  Aún no has configurado prioridades manuales.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
