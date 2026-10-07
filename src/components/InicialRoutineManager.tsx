import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Save,
  Printer,
  Download,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Baby,
  Users,
  CheckCircle2,
  Calendar,
  RotateCcw,
  BookOpen
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { supabase } from '../lib/supabase';

export interface RoutineMoment {
  id: string;
  start: string; // "07:30"
  end: string;   // "07:50"
  name: string;  // "Recibimiento de los Niños"
  description: string;
  isSpecialist?: boolean; // Para Actividad Grupal o Talleres
  specialists?: {
    lunes?: string;
    martes?: string;
    miercoles?: string;
    jueves?: string;
    viernes?: string;
  };
}

interface InicialRoutineManagerProps {
  course: any;
  teachers?: any[];
  subjects?: any[];
  centerName?: string;
  selectedYear?: string;
  profile?: any;
}

// Plantillas estándar según directrices oficiales del Nivel Inicial del MINERD
export const DEFAULT_EXTENDED_ROUTINE: RoutineMoment[] = [
  {
    id: 'm-1',
    start: '07:30',
    end: '07:50',
    name: 'Recibimiento de los Niños',
    description: 'Saludar a cada niño y niña, invitar a colocar sus pertenencias en el lugar indicado.'
  },
  {
    id: 'm-2',
    start: '07:50',
    end: '08:10',
    name: 'Ceremonia de Entrada',
    description: 'Cantar himno nacional, izar la bandera, orar, celebrar conmemoraciones y cumpleaños.'
  },
  {
    id: 'm-3',
    start: '08:10',
    end: '08:45',
    name: 'Encuentro de Grupo',
    description: 'Saludos, canciones, asistencia, cartel del tiempo, diálogo, poesías y tema del día.'
  },
  {
    id: 'm-4',
    start: '08:45',
    end: '09:00',
    name: 'Higiene',
    description: 'Ir al baño, lavado correcto de manos.'
  },
  {
    id: 'm-5',
    start: '09:00',
    end: '09:20',
    name: 'Merienda',
    description: 'Ingerir desayuno escolar, ordenar y limpiar el espacio.'
  },
  {
    id: 'm-6',
    start: '09:20',
    end: '10:00',
    name: 'Grupo Grande y Pequeño',
    description: 'Grupo pequeño: fortalecimiento de conceptos y destrezas. Grupo grande: actividades autónomas guiadas.'
  },
  {
    id: 'm-7',
    start: '10:00',
    end: '10:20',
    name: 'Juego Libre',
    description: 'Juego libre o dirigido en el patio de recreo.'
  },
  {
    id: 'm-8',
    start: '10:20',
    end: '10:35',
    name: 'Higiene y Descanso',
    description: 'Lavado de manos, tomar agua, descansar en las mesitas.'
  },
  {
    id: 'm-9',
    start: '10:35',
    end: '11:10',
    name: 'Actividad Grupal',
    description: 'Expresión artística, psicomotricidad, literatura, música o formación integral.',
    isSpecialist: true,
    specialists: {
      lunes: 'Música',
      martes: 'Literatura',
      miercoles: 'Formación',
      jueves: 'Plástica con Ramona',
      viernes: 'Gimnasia con Julia Vásquez'
    }
  },
  {
    id: 'm-10',
    start: '11:10',
    end: '11:20',
    name: 'Evaluación de la Mañana',
    description: 'Los niños expresan lo aprendido durante las actividades de la mañana.'
  },
  {
    id: 'm-11',
    start: '11:20',
    end: '11:40',
    name: 'Higiene',
    description: 'Lavado de manos y preparación para el almuerzo escolar.'
  },
  {
    id: 'm-12',
    start: '11:40',
    end: '12:10',
    name: 'Almuerzo',
    description: 'Ingerir alimentos, colaborar con el orden y limpieza del área.'
  },
  {
    id: 'm-13',
    start: '12:10',
    end: '12:25',
    name: 'Higiene',
    description: 'Lavado de manos, higiene bucal y tomar agua.'
  },
  {
    id: 'm-14',
    start: '12:25',
    end: '13:25',
    name: 'Descanso',
    description: 'Acostados en colcha y escuchando música suave, descansan supervisados por su educadora.'
  },
  {
    id: 'm-15',
    start: '13:25',
    end: '13:40',
    name: 'Higiene y Merienda',
    description: 'Ir al baño, lavado de manos y merienda de la tarde.'
  },
  {
    id: 'm-16',
    start: '13:40',
    end: '14:15',
    name: 'Juego-Trabajo',
    description: 'Planeamiento, desarrollo en zonas de juego, evaluación y orden.'
  },
  {
    id: 'm-17',
    start: '14:15',
    end: '15:15',
    name: 'Talleres',
    description: 'Actividades artísticas, inglés, teatro, títeres, música y manualidades.',
    isSpecialist: true,
    specialists: {
      lunes: 'Taller de Inglés (Julia Vásquez)',
      martes: 'Actividades Socioemocionales',
      miercoles: 'Teatro y Títeres',
      jueves: 'Manualidades y Medio Ambiente',
      viernes: 'Taller de Arte (Ramona)'
    }
  },
  {
    id: 'm-18',
    start: '15:15',
    end: '15:30',
    name: 'Evaluación y Organización',
    description: 'Expresan lo que aprendieron y sintieron; arreglo de pertenencias.'
  },
  {
    id: 'm-19',
    start: '15:30',
    end: '16:00',
    name: 'Despedida y Entrega',
    description: 'Despedida afectuosa y entrega individual de cada niño y niña a sus familias.'
  }
];

export const DEFAULT_HALFDAY_ROUTINE: RoutineMoment[] = [
  {
    id: 'hd-1',
    start: '07:30',
    end: '07:50',
    name: 'Recibimiento de los Niños',
    description: 'Saludar a cada niño y niña, invitar a colocar sus pertenencias en el lugar indicado.'
  },
  {
    id: 'hd-2',
    start: '07:50',
    end: '08:10',
    name: 'Ceremonia de Entrada',
    description: 'Cantar himno nacional, izar la bandera, orar, celebrar conmemoraciones.'
  },
  {
    id: 'hd-3',
    start: '08:10',
    end: '08:50',
    name: 'Encuentro de Grupo',
    description: 'Saludos, canciones, asistencia, cartel del tiempo, diálogo y tema del día.'
  },
  {
    id: 'hd-4',
    start: '08:50',
    end: '09:05',
    name: 'Higiene',
    description: 'Ir al baño, lavado correcto de manos.'
  },
  {
    id: 'hd-5',
    start: '09:05',
    end: '09:25',
    name: 'Merienda',
    description: 'Ingerir desayuno escolar, ordenar y limpiar el área.'
  },
  {
    id: 'hd-6',
    start: '09:25',
    end: '10:05',
    name: 'Grupo Grande y Pequeño',
    description: 'Grupo pequeño: fortalecimiento de competencias. Grupo grande: actividades guiadas.'
  },
  {
    id: 'hd-7',
    start: '10:05',
    end: '10:25',
    name: 'Juego Libre',
    description: 'Juego libre o dirigido en el patio de recreo.'
  },
  {
    id: 'hd-8',
    start: '10:25',
    end: '10:40',
    name: 'Higiene y Descanso',
    description: 'Lavado de manos, tomar agua, descansar en las mesitas.'
  },
  {
    id: 'hd-9',
    start: '10:40',
    end: '11:20',
    name: 'Actividad Grupal',
    description: 'Expresión artística, psicomotricidad, literatura, música o formación integral.',
    isSpecialist: true,
    specialists: {
      lunes: 'Gimnasia / Psicomotricidad',
      martes: 'Literatura Infantil',
      miercoles: 'Plástica y Creatividad',
      jueves: 'Formación en Valores',
      viernes: 'Educación Musical'
    }
  },
  {
    id: 'hd-10',
    start: '11:20',
    end: '11:45',
    name: 'Juego-Trabajo y Evaluación',
    description: 'Planeamiento, desarrollo en zonas, evaluación de lo aprendido y orden.'
  },
  {
    id: 'hd-11',
    start: '11:45',
    end: '12:00',
    name: 'Organización y Despedida',
    description: 'Arreglo de los niños, entrega de pertenencias y despedida a sus padres.'
  }
];

export const InicialRoutineManager: React.FC<InicialRoutineManagerProps> = ({
  course,
  teachers = [],
  subjects = [],
  centerName = 'Centro Educativo',
  selectedYear = '2026-2027',
  profile
}) => {
  const [startTime, setStartTime] = useState<string>('07:30');
  const [endTime, setEndTime] = useState<string>('16:00');
  const [moments, setMoments] = useState<RoutineMoment[]>(DEFAULT_EXTENDED_ROUTINE);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [teacherName, setTeacherName] = useState<string>('');
  const printAreaRef = useRef<HTMLDivElement>(null);

  const courseId = course?.id || 'default_course';
  const centerId = profile?.center_id || course?.center_id;
  const storageKey = `edugest_inicial_routine_${centerId || 'local'}_${courseId}_${selectedYear}`;

  // Determinar docente titular del curso
  useEffect(() => {
    if (course?.titular_teacher_id) {
      const t = teachers.find((tc) => tc.id === course.titular_teacher_id);
      if (t) {
        setTeacherName(t.name || t.full_name || '');
        return;
      }
    }
    // Si no está asignado explícitamente en titular_teacher_id, buscar docente con rol teacher para este curso
    if (course?.teacher_name) {
      setTeacherName(course.teacher_name);
    }
  }, [course, teachers]);

  // Cargar configuración guardada al montar o cambiar de curso
  useEffect(() => {
    const loadSavedRoutine = async () => {
      try {
        const local = localStorage.getItem(storageKey);
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed.moments && parsed.moments.length > 0) {
            setMoments(parsed.moments);
            if (parsed.startTime) setStartTime(parsed.startTime);
            if (parsed.endTime) setEndTime(parsed.endTime);
            if (parsed.teacherName) setTeacherName(parsed.teacherName);
            return;
          }
        }

        // Si no hay en localStorage, consultar en Supabase (time_blocks)
        if (centerId && courseId) {
          const { data } = await supabase
            .from('time_blocks')
            .select('*')
            .eq('center_id', centerId)
            .ilike('day', `INICIAL::${courseId}::%`);

          if (data && data.length > 0) {
            const loadedMoments: RoutineMoment[] = data
              .map((row: any) => {
                const parts = (row.day || '').split('::');
                // formato: INICIAL::courseId::idx::name::description::isSpecialist::jsonSpecialists
                const idx = Number(parts[2]) || 0;
                const name = parts[3] || 'Momento';
                const description = parts[4] || '';
                const isSpecialist = parts[5] === '1';
                let specialists;
                try {
                  specialists = parts[6] ? JSON.parse(parts[6]) : undefined;
                } catch {}

                return {
                  id: row.id || `m-${idx}`,
                  start: (row.start_time || '07:30').substring(0, 5),
                  end: (row.end_time || '08:00').substring(0, 5),
                  name,
                  description,
                  isSpecialist,
                  specialists,
                  _idx: idx
                };
              })
              .sort((a, b) => a._idx - b._idx);

            if (loadedMoments.length > 0) {
              setMoments(loadedMoments);
              setStartTime(loadedMoments[0].start);
              setEndTime(loadedMoments[loadedMoments.length - 1].end);
              return;
            }
          }
        }

        // Por defecto según la tanda del curso
        const tStr = (course?.tanda || '').toLowerCase();
        if (tStr.includes('ext') || tStr.includes('com')) {
          setMoments(DEFAULT_EXTENDED_ROUTINE);
          setStartTime('07:30');
          setEndTime('16:00');
        } else {
          setMoments(DEFAULT_HALFDAY_ROUTINE);
          setStartTime('07:30');
          setEndTime('12:00');
        }
      } catch (err) {
        console.warn('Error loading inicial routine:', err);
      }
    };

    loadSavedRoutine();
  }, [courseId, centerId, selectedYear, storageKey]);

  // Convertir HH:MM a minutos
  const toMins = (t: string) => {
    const [h, m] = (t || '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // Convertir minutos a HH:MM
  const fromMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Auto-encadenar momentos a partir de sus duraciones
  const handleRechain = () => {
    if (moments.length === 0) return;
    let curr = toMins(startTime);
    const updated = moments.map((m) => {
      const sMins = toMins(m.start);
      const eMins = toMins(m.end);
      const dur = eMins > sMins ? eMins - sMins : 20;
      const newStart = fromMins(curr);
      const newEnd = fromMins(curr + dur);
      curr += dur;
      return {
        ...m,
        start: newStart,
        end: newEnd
      };
    });
    setMoments(updated);
    setEndTime(fromMins(curr));
  };

  // Cargar plantilla rápida
  const handleApplyTemplate = (type: 'extended' | 'halfday_1145' | 'halfday_1200' | 'halfday_1230' | 'halfday_1300') => {
    if (type === 'extended') {
      setStartTime('07:30');
      setEndTime('16:00');
      setMoments(DEFAULT_EXTENDED_ROUTINE);
    } else {
      let targetEnd = '12:00';
      if (type === 'halfday_1145') targetEnd = '11:45';
      if (type === 'halfday_1230') targetEnd = '12:30';
      if (type === 'halfday_1300') targetEnd = '13:00';

      setStartTime('07:30');
      setEndTime(targetEnd);

      // Adaptar la plantilla de medio día escalando tiempos para terminar en targetEnd
      const totalAvailable = toMins(targetEnd) - toMins('07:30');
      let curr = toMins('07:30');

      const adapted = DEFAULT_HALFDAY_ROUTINE.map((m, idx) => {
        // En el último momento asegurar que cierre exactamente en targetEnd
        const isLast = idx === DEFAULT_HALFDAY_ROUTINE.length - 1;
        const origDur = toMins(m.end) - toMins(m.start);
        // Factor de escala suave si totalAvailable es distinto a 270 (4h 30m)
        const scale = totalAvailable / 270;
        const dur = isLast ? toMins(targetEnd) - curr : Math.max(10, Math.round(origDur * scale));
        const sStr = fromMins(curr);
        const eStr = isLast ? targetEnd : fromMins(curr + dur);
        curr += dur;
        return {
          ...m,
          start: sStr,
          end: eStr
        };
      });

      setMoments(adapted);
    }
  };

  // Modificar campo de un momento
  const handleUpdateMoment = (id: string, field: string, value: any) => {
    setMoments((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        return { ...m, [field]: value };
      })
    );
  };

  // Modificar especialista diario
  const handleUpdateSpecialist = (id: string, day: 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes', value: string) => {
    setMoments((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        return {
          ...m,
          specialists: {
            ...(m.specialists || {}),
            [day]: value
          }
        };
      })
    );
  };

  // Mover momento arriba o abajo
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= moments.length) return;
    const copy = [...moments];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    setMoments(copy);
  };

  // Añadir nuevo momento
  const handleAddMoment = (indexAfter?: number) => {
    const prevMoment = indexAfter !== undefined ? moments[indexAfter] : moments[moments.length - 1];
    const prevEnd = prevMoment ? prevMoment.end : startTime;
    const [h, m] = prevEnd.split(':').map(Number);
    const newEndMins = (h || 0) * 60 + (m || 0) + 20;
    const newEnd = fromMins(newEndMins);

    const newM: RoutineMoment = {
      id: `m-custom-${Date.now()}`,
      start: prevEnd,
      end: newEnd,
      name: 'Nuevo Momento',
      description: 'Descripción de las actividades para este momento pedagógico.'
    };

    if (indexAfter !== undefined) {
      const copy = [...moments];
      copy.splice(indexAfter + 1, 0, newM);
      setMoments(copy);
    } else {
      setMoments([...moments, newM]);
    }
  };

  // Eliminar momento
  const handleDeleteMoment = (id: string) => {
    if (moments.length <= 1) {
      alert('Debe existir al menos un momento en la rutina.');
      return;
    }
    setMoments((prev) => prev.filter((m) => m.id !== id));
  };

  // Guardar en almacenamiento local y remoto
  const handleSaveRoutine = async () => {
    setIsSaving(true);
    try {
      const payload = {
        startTime,
        endTime,
        teacherName,
        moments,
        updatedAt: new Date().toISOString()
      };

      // Guardado local
      localStorage.setItem(storageKey, JSON.stringify(payload));

      // Guardado en Supabase (time_blocks)
      if (centerId && courseId) {
        const prefix = `INICIAL::${courseId}::`;
        const { data: existing } = await supabase
          .from('time_blocks')
          .select('id, day')
          .eq('center_id', centerId)
          .ilike('day', `${prefix}%`);

        if (existing && existing.length > 0) {
          const idsToDelete = existing.map((r: any) => r.id);
          await supabase.from('time_blocks').delete().in('id', idsToDelete);
        }

        const rowsToInsert = moments.map((m, idx) => ({
          center_id: centerId,
          day: `INICIAL::${courseId}::${idx}::${m.name}::${m.description || ''}::${m.isSpecialist ? '1' : '0'}::${JSON.stringify(m.specialists || {})}`,
          start_time: m.start.length === 5 ? m.start + ':00' : m.start,
          end_time: m.end.length === 5 ? m.end + ':00' : m.end
        }));

        if (rowsToInsert.length > 0) {
          await supabase.from('time_blocks').insert(rowsToInsert);
        }
      }

      setIsEditing(false);
      alert('✅ ¡Rutina Diaria de Nivel Inicial guardada exitosamente!');
    } catch (err: any) {
      console.error('Error saving routine:', err);
      alert('Error guardando la rutina: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSaving(false);
    }
  };

  // Exportar como imagen PNG
  const handleExportPNG = async () => {
    if (!printAreaRef.current) return;
    try {
      const canvas = await html2canvas(printAreaRef.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Rutina_${course?.grade || 'Inicial'}_${course?.section || ''}_${selectedYear}.png`.replace(/\s+/g, '_');
      link.href = dataUrl;
      link.click();
    } catch (err: any) {
      alert('Error exportando imagen: ' + err.message);
    }
  };

  // Imprimir ficha oficial
  const handlePrint = () => {
    window.print();
  };

  const isExtended = toMins(endTime) >= toMins('15:00');

  return (
    <div className="space-y-6">
      {/* Barra de Control y Acciones */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
            <Baby size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                Modelo Oficial MINERD
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                {isExtended ? 'Jornada Extendida' : 'Medio Día'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900 mt-1">
              Rutina Diaria de {course?.grade || 'Nivel Inicial'} &quot;{course?.section || 'A'}&quot;
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Horario por Momentos Pedagógicos • Docente: <span className="font-bold text-slate-800">{teacherName || 'No asignada'}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleRechain}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer"
                title="Ajusta automáticamente las horas consecutivas según su duración"
              >
                <RotateCcw size={14} /> Auto-Ajustar Horas
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveRoutine}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save size={16} /> {isSaving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Sparkles size={16} /> Personalizar / Editar
              </button>
              <button
                type="button"
                onClick={handleExportPNG}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer"
              >
                <Download size={15} /> Exportar Imagen
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Printer size={16} /> Imprimir Ficha
              </button>
            </>
          )}
        </div>
      </div>

      {/* Panel de Configuración de Horas de Entrada, Salida y Plantillas Rápidas (Visible en Modo Edición) */}
      {isEditing && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-6 space-y-6 animate-fade-in no-print">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-amber-200/80 pb-4">
            <div>
              <h3 className="text-sm font-black text-amber-950 uppercase tracking-tight flex items-center gap-2">
                <Clock size={18} className="text-amber-700" /> Horario de Entrada y Salida del Centro
              </h3>
              <p className="text-xs text-amber-800 font-medium mt-0.5">
                Configura los límites de tu jornada. El sistema adaptará los momentos a este rango.
              </p>
            </div>

            {/* Presets de 1 Clic */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-amber-900 mr-1">Plantillas rápidas:</span>
              <button
                type="button"
                onClick={() => handleApplyTemplate('extended')}
                className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg text-[10px] font-black uppercase text-amber-950 transition-all cursor-pointer shadow-2xs"
              >
                Extendida (7:30 - 4:00)
              </button>
              <button
                type="button"
                onClick={() => handleApplyTemplate('halfday_1200')}
                className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg text-[10px] font-black uppercase text-amber-950 transition-all cursor-pointer shadow-2xs"
              >
                Medio Día (Hasta 12:00)
              </button>
              <button
                type="button"
                onClick={() => handleApplyTemplate('halfday_1230')}
                className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg text-[10px] font-black uppercase text-amber-950 transition-all cursor-pointer shadow-2xs"
              >
                Medio Día (Hasta 12:30)
              </button>
              <button
                type="button"
                onClick={() => handleApplyTemplate('halfday_1145')}
                className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg text-[10px] font-black uppercase text-amber-950 transition-all cursor-pointer shadow-2xs"
              >
                Salida 11:45
              </button>
              <button
                type="button"
                onClick={() => handleApplyTemplate('halfday_1300')}
                className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg text-[10px] font-black uppercase text-amber-950 transition-all cursor-pointer shadow-2xs"
              >
                Salida 1:00 PM
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-amber-900 block">
                Hora de Entrada (Mañana)
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-amber-900 block">
                Hora de Salida / Despedida
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-amber-900 block">
                Profesora Titular del Aula
              </label>
              <input
                type="text"
                placeholder="Nombre de la maestra..."
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Ficha Imprimible e Institucional */}
      <div
        ref={printAreaRef}
        className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-6 sm:p-10 space-y-6 print:p-0 print:border-none print:shadow-none"
      >
        {/* Encabezado Oficial */}
        <div className="border-b-2 border-slate-900 pb-5 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">
              {centerName.toUpperCase()}
            </p>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-slate-900 mt-0.5">
              Horario de {course?.grade || 'Nivel Inicial'} &quot;{course?.section || 'A'}&quot;
            </h1>
            <p className="text-xs font-bold text-slate-600 mt-1 uppercase">
              Profesora: <span className="text-slate-950 font-black">{teacherName || 'Docente Titular'}</span>
            </p>
          </div>
          <div className="text-left md:text-right space-y-1">
            <span className="inline-block px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-black uppercase tracking-wider">
              Año Escolar {selectedYear}
            </span>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
              Jornada: {startTime} - {endTime} ({isExtended ? 'Jornada Extendida' : 'Medio Día'})
            </p>
          </div>
        </div>

        {/* Tabla de Momentos de la Rutina */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-900 text-white border border-slate-900 uppercase tracking-wider text-[11px] font-black">
                <th className="p-3 w-28 sm:w-32 border-r border-slate-700 text-center">Horario</th>
                <th className="p-3 w-56 sm:w-64 border-r border-slate-700">Momento / Actividad</th>
                <th className="p-3">Descripción Pedagógica y Docentes Especialistas</th>
                {isEditing && <th className="p-3 w-28 text-center no-print">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 border border-slate-300">
              {moments.map((m, index) => {
                const sMins = toMins(m.start);
                const eMins = toMins(m.end);
                const dur = eMins > sMins ? eMins - sMins : 0;

                const isFoodOrRest =
                  m.name.toLowerCase().includes('almuerzo') ||
                  m.name.toLowerCase().includes('descanso') ||
                  m.name.toLowerCase().includes('merienda');

                return (
                  <tr
                    key={m.id}
                    className={`transition-colors ${
                      isFoodOrRest
                        ? 'bg-amber-50/50 hover:bg-amber-50'
                        : m.isSpecialist
                        ? 'bg-indigo-50/40 hover:bg-indigo-50/70'
                        : index % 2 === 0
                        ? 'bg-white hover:bg-slate-50'
                        : 'bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    {/* Columna Horario */}
                    <td className="p-3 border-r border-slate-200 font-bold text-center align-top whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex flex-col gap-1 items-center">
                          <input
                            type="time"
                            value={m.start}
                            onChange={(e) => handleUpdateMoment(m.id, 'start', e.target.value)}
                            className="p-1 bg-white border border-slate-300 rounded text-[11px] font-bold text-center w-20"
                          />
                          <span className="text-[10px] text-slate-400 font-medium">hasta</span>
                          <input
                            type="time"
                            value={m.end}
                            onChange={(e) => handleUpdateMoment(m.id, 'end', e.target.value)}
                            className="p-1 bg-white border border-slate-300 rounded text-[11px] font-bold text-center w-20"
                          />
                          <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {dur} min
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-xs font-black text-slate-900 block">
                            {m.start} - {m.end}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                            ({dur} min)
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Columna Momento */}
                    <td className="p-3 border-r border-slate-200 align-top">
                      {isEditing ? (
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={m.name}
                            onChange={(e) => handleUpdateMoment(m.id, 'name', e.target.value)}
                            className="w-full p-2 bg-white border border-slate-300 rounded-lg font-black text-xs text-slate-900"
                          />
                          <label className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!m.isSpecialist}
                              onChange={(e) => handleUpdateMoment(m.id, 'isSpecialist', e.target.checked)}
                              className="rounded accent-indigo-600 w-3.5 h-3.5"
                            />
                            Rotan especialistas (Arte / Gimnasia / Inglés)
                          </label>
                        </div>
                      ) : (
                        <div>
                          <span className="font-black text-slate-900 uppercase text-xs block">
                            {m.name}
                          </span>
                          {m.isSpecialist && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md text-[9px] font-black uppercase tracking-wider">
                              Rotación de Especialistas
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Columna Descripción Pedagógica y Especialistas */}
                    <td className="p-3 align-top leading-relaxed">
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={m.description}
                            onChange={(e) => handleUpdateMoment(m.id, 'description', e.target.value)}
                            rows={2}
                            className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
                            placeholder="Descripción de la actividad..."
                          />

                          {m.isSpecialist && (
                            <div className="p-3 bg-white border border-indigo-200 rounded-xl space-y-2 shadow-2xs">
                              <p className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">
                                Asignación Diaria de Especialistas:
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 text-[10px]">
                                {(['lunes', 'martes', 'miercoles', 'jueves', 'viernes'] as const).map((day) => (
                                  <div key={day} className="space-y-1">
                                    <span className="font-black uppercase text-slate-500 block">
                                      {day}:
                                    </span>
                                    <input
                                      type="text"
                                      placeholder={`Materia o docente...`}
                                      value={m.specialists?.[day] || ''}
                                      onChange={(e) => handleUpdateSpecialist(m.id, day, e.target.value)}
                                      className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-bold"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <p className="text-slate-700 text-xs font-medium leading-relaxed">
                            {m.description}
                          </p>

                          {m.isSpecialist && m.specialists && (
                            <div className="mt-2 pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-1.5 text-[11px]">
                              {Object.entries(m.specialists).map(([dayKey, val]) => {
                                if (!val) return null;
                                return (
                                  <div
                                    key={dayKey}
                                    className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs"
                                  >
                                    <span className="text-[9px] font-black uppercase text-indigo-600 block">
                                      {dayKey}:
                                    </span>
                                    <span className="font-bold text-slate-800 text-[10px] block leading-tight">
                                      {val}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Columna Acciones en Edición */}
                    {isEditing && (
                      <td className="p-3 align-middle text-center border-l border-slate-200 no-print">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMove(index, 'up')}
                            disabled={index === 0}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded disabled:opacity-30 cursor-pointer"
                            title="Subir momento"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMove(index, 'down')}
                            disabled={index === moments.length - 1}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded disabled:opacity-30 cursor-pointer"
                            title="Bajar momento"
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddMoment(index)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded cursor-pointer"
                            title="Insertar momento debajo"
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMoment(m.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                            title="Eliminar momento"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Botón para añadir momento al final (Modo Edición) */}
        {isEditing && (
          <div className="pt-2 no-print">
            <button
              type="button"
              onClick={() => handleAddMoment()}
              className="w-full py-3 border-2 border-dashed border-indigo-300 hover:border-indigo-500 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={16} /> Añadir Momento a la Rutina
            </button>
          </div>
        )}

        {/* Pie de Firma Institucional para Impresión */}
        <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center print:block print:pt-12">
          <div className="space-y-1">
            <div className="w-48 border-b border-slate-900 mx-auto"></div>
            <p className="text-[11px] font-black uppercase text-slate-800">
              {teacherName || 'Docente Titular'}
            </p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              Docente del Nivel Inicial
            </p>
          </div>
          <div className="space-y-1">
            <div className="w-48 border-b border-slate-900 mx-auto"></div>
            <p className="text-[11px] font-black uppercase text-slate-800">
              Dirección / Coordinación Pedagógica
            </p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              Visto Bueno Oficial
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
