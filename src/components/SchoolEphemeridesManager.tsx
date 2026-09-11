import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import {
  Calendar as CalendarIcon,
  Sparkles,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Edit2,
  Share2,
  CheckCircle2,
  Flag,
  BookOpen,
  Coffee,
  Building2,
  Layers,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface EphemerisItem {
  id?: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  category: 'civic' | 'educational' | 'holiday' | 'institutional';
  is_global?: boolean;
}

// Catálogo Base Oficial del Calendario Escolar Dominicano (MINERD)
export const getDefaultMinerdEphemerides = (schoolYear: string = '2026-2027'): EphemerisItem[] => {
  const [startYearStr, endYearStr] = (schoolYear || '2026-2027').split('-');
  const y1 = startYearStr ? parseInt(startYearStr, 10) : 2026;
  const y2 = endYearStr ? parseInt(endYearStr, 10) : y1 + 1;

  return [
    // --- PRIMER PERÍODO (Agosto - Diciembre) ---
    {
      title: 'Día de la Restauración de la República',
      date: `${y1}-08-16`,
      description: 'Conmemoración del Grito de Capotillo y el inicio de la Guerra de la Restauración (1863). Feriado Nacional.',
      category: 'civic'
    },
    {
      title: 'Apertura del Año Escolar / Inicio de Docencia',
      date: `${y1}-08-24`,
      description: 'Apertura oficial de las actividades formativas y docentes en todos los centros educativos.',
      category: 'educational'
    },
    {
      title: 'Día Internacional de la Alfabetización',
      date: `${y1}-09-08`,
      description: 'Promoción del derecho a la educación, la lectura y la erradicación del analfabetismo.',
      category: 'educational'
    },
    {
      title: 'Día Internacional de la Paz',
      date: `${y1}-09-21`,
      description: 'Jornada escolar dedicada al fomento de la no violencia, la convivencia pacífica y el diálogo.',
      category: 'educational'
    },
    {
      title: 'Día de los Derechos de la Niñez',
      date: `${y1}-09-29`,
      description: 'Conmemoración de la protección integral de los derechos fundamentales de niños, niñas y adolescentes.',
      category: 'educational'
    },
    {
      title: 'Día Mundial de los Docentes',
      date: `${y1}-10-05`,
      description: 'Reconocimiento a la labor transformadora y dedicación del magisterio escolar.',
      category: 'educational'
    },
    {
      title: 'Día del Encuentro entre Culturas',
      date: `${y1}-10-12`,
      description: 'Reflexión histórica sobre la diversidad y el encuentro de las culturas del continente americano.',
      category: 'civic'
    },
    {
      title: 'Día Mundial de la Alimentación Escolar',
      date: `${y1}-10-16`,
      description: 'Concienciación sobre una nutrición adecuada y hábitos saludables en los centros escolares.',
      category: 'educational'
    },
    {
      title: 'Día Nacional del Poeta / Natalicio de Salomé Ureña',
      date: `${y1}-10-21`,
      description: 'Homenaje a la excelsa educadora y poeta dominicana Salomé Ureña de Henríquez.',
      category: 'civic'
    },
    {
      title: 'Día de las Naciones Unidas (ONU)',
      date: `${y1}-10-24`,
      description: 'Celebración de la cooperación internacional, la fraternidad universal y los derechos humanos.',
      category: 'educational'
    },
    {
      title: 'Día de la Constitución Dominicana',
      date: `${y1}-11-06`,
      description: 'Firma de la primera Carta Magna dominicana en San Cristóbal en 1844. Fiesta Nacional.',
      category: 'civic'
    },
    {
      title: 'Día de la No Violencia contra la Mujer (Hermanas Mirabal)',
      date: `${y1}-11-25`,
      description: 'Homenaje histórico al valor de Patria, Minerva y María Teresa Mirabal. Reflexión escolar.',
      category: 'civic'
    },
    {
      title: 'Día Internacional de los Derechos Humanos',
      date: `${y1}-12-10`,
      description: 'Conmemoración de la Declaración Universal de los Derechos Humanos proclamada en 1948.',
      category: 'educational'
    },
    {
      title: 'Cierre del Primer Período / Vacaciones de Navidad',
      date: `${y1}-12-22`,
      description: 'Conclusión de la primera etapa del año lectivo e inicio del receso escolar navideño.',
      category: 'holiday'
    },

    // --- SEGUNDO PERÍODO (Enero - Junio) ---
    {
      title: 'Día de los Santos Reyes',
      date: `${y2}-01-06`,
      description: 'Celebración de la Epifanía y festividad tradicional de los Reyes Magos. Feriado.',
      category: 'holiday'
    },
    {
      title: 'Reanudación de la Docencia (Segundo Período)',
      date: `${y2}-01-07`,
      description: 'Reinicio de las labores docentes y formativas en el segundo período del calendario escolar.',
      category: 'educational'
    },
    {
      title: 'Día Nacional de la Educación',
      date: `${y2}-01-11`,
      description: 'Homenaje al natalicio del gran educador antillano Eugenio María de Hostos.',
      category: 'educational'
    },
    {
      title: 'Día de Nuestra Señora de la Altagracia',
      date: `${y2}-01-21`,
      description: 'Festividad de la protectora del pueblo dominicano. Feriado Nacional.',
      category: 'holiday'
    },
    {
      title: 'Natalicio de Juan Pablo Duarte',
      date: `${y2}-01-26`,
      description: 'Conmemoración del nacimiento del Padre Fundador de la República Dominicana. Inicio del Mes de la Patria.',
      category: 'civic'
    },
    {
      title: 'Día Nacional de la Juventud',
      date: `${y2}-01-31`,
      description: 'Celebración en honor a San Juan Bosco, patrono de la juventud trabajadora y estudiante.',
      category: 'educational'
    },
    {
      title: 'Día del Amor y la Amistad',
      date: `${y2}-02-14`,
      description: 'Actividades de integración escolar orientadas a la fraternidad, el respeto y la empatía.',
      category: 'educational'
    },
    {
      title: 'Natalicio de Matías Ramón Mella',
      date: `${y2}-02-25`,
      description: 'Homenaje al prócer de la independencia y autor del trabucazo glorioso de la Puerta de la Misericordia.',
      category: 'civic'
    },
    {
      title: 'Día de la Independencia Nacional',
      date: `${y2}-02-27`,
      description: '1844: Proclamación de la Independencia de la República Dominicana. Fiesta Patria Nacional.',
      category: 'civic'
    },
    {
      title: 'Día Internacional de la Mujer',
      date: `${y2}-03-08`,
      description: 'Reconocimiento al liderazgo, igualdad y contribución de la mujer en la sociedad y la escuela.',
      category: 'educational'
    },
    {
      title: 'Natalicio de Francisco del Rosario Sánchez',
      date: `${y2}-03-09`,
      description: 'Homenaje al prócer de la Patria, mártir de El Cercado y defensor de la soberanía nacional.',
      category: 'civic'
    },
    {
      title: 'Batalla del 19 de Marzo (Azua)',
      date: `${y2}-03-19`,
      description: 'Conmemoración de la primera gran batalla en defensa de la soberanía e independencia nacional (1844).',
      category: 'civic'
    },
    {
      title: 'Batalla del 30 de Marzo (Santiago)',
      date: `${y2}-03-30`,
      description: 'Heroica victoria en Santiago comandada por José María Imbert que afianzó la República (1844).',
      category: 'civic'
    },
    {
      title: 'Día de la Atención a la Diversidad Escolar',
      date: `${y2}-04-13`,
      description: 'Sensibilización e impulso a la educación inclusiva y el respeto a todas las capacidades.',
      category: 'educational'
    },
    {
      title: 'Día Mundial del Libro y del Derecho de Autor',
      date: `${y2}-04-23`,
      description: 'Feria escolar de lectura, literatura y fomento de las bibliotecas de centro.',
      category: 'educational'
    },
    {
      title: 'Día Internacional del Trabajo',
      date: `${y2}-05-01`,
      description: 'Homenaje a la clase trabajadora y al valor social del trabajo honrado. Feriado.',
      category: 'holiday'
    },
    {
      title: 'Día de las Madres Dominicanas',
      date: `${y2}-05-30`,
      description: 'Celebración escolar en honor a las madres y al pilar de amor en las familias.',
      category: 'civic'
    },
    {
      title: 'Día Mundial del Medio Ambiente',
      date: `${y2}-06-05`,
      description: 'Jornadas escolares de reforestación, reciclaje y cuidado de los recursos naturales.',
      category: 'educational'
    },
    {
      title: 'Día Nacional del Maestro Dominicano',
      date: `${y2}-06-29`,
      description: 'Reconocimiento y agasajo oficial a los maestros en la fecha de natalicio del Prof. Juan Bosch.',
      category: 'civic'
    },
    {
      title: 'Cierre del Año Escolar / Evaluaciones Finales',
      date: `${y2}-06-30`,
      description: 'Conclusión formal del calendario docente, graduaciones y entrega de informes de evaluación.',
      category: 'educational'
    }
  ];
};

export const SchoolEphemeridesManager: React.FC = () => {
  const { selectedYear, refreshData } = useApp();
  const [ephemerides, setEphemerides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImportingDefault, setIsImportingDefault] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formCategory, setFormCategory] = useState<'civic' | 'educational' | 'holiday' | 'institutional'>('civic');
  const [formDescription, setFormDescription] = useState('');
  const [formIsGlobal, setFormIsGlobal] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchEphemerides = async () => {
    setLoading(true);
    try {
      // Intentar cargar actividades con is_global=true o type='ephemeris'
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .or('is_global.eq.true,type.eq.ephemeris')
        .order('date', { ascending: true });

      if (error) {
        // Si la columna is_global aún no existe en PostgREST, consultar por type='ephemeris'
        const fallback = await supabase
          .from('activities')
          .select('*')
          .eq('type', 'ephemeris')
          .order('date', { ascending: true });
        setEphemerides(fallback.data || []);
      } else {
        setEphemerides(data || []);
      }
    } catch (e: any) {
      console.error('Error al cargar efemérides:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEphemerides();
  }, [selectedYear]);

  // Cargar Catálogo Oficial MINERD con 1 Clic
  const handleImportDefaultMinerd = async () => {
    if (!window.confirm(`¿Deseas precargar el listado oficial de efemérides del Calendario Escolar MINERD (${selectedYear || '2026-2027'})? Estas fechas quedarán disponibles para todos los centros.`)) {
      return;
    }

    setIsImportingDefault(true);
    try {
      const defaultList = getDefaultMinerdEphemerides(selectedYear || '2026-2027');
      const payload = defaultList.map((item) => ({
        title: item.title,
        description: item.description,
        date: item.date,
        start_time: '08:00',
        end_time: '14:00',
        type: 'ephemeris',
        is_global: true,
        center_id: null
      }));

      // Inserción en supabase
      const { error } = await supabase.from('activities').insert(payload);
      if (error) {
        // Fallback si is_global aún no se ha migrado en DB: guardar con type='ephemeris'
        const payloadNoGlobal = defaultList.map((item) => ({
          title: item.title,
          description: item.description,
          date: item.date,
          start_time: '08:00',
          end_time: '14:00',
          type: 'ephemeris'
        }));
        const retry = await supabase.from('activities').insert(payloadNoGlobal);
        if (retry.error) throw retry.error;
      }

      toast.success('¡Calendario Escolar MINERD precargado con éxito!');
      await fetchEphemerides();
      await refreshData(undefined, true);
    } catch (err: any) {
      console.error('Error al precargar efemérides:', err);
      toast.error('Error al precargar: ' + (err.message || 'Verifica la conexión'));
    } finally {
      setIsImportingDefault(false);
    }
  };

  // Sincronizar / Replicar efemérides a cada centro registrado
  const handleSyncToAllCenters = async () => {
    if (ephemerides.length === 0) {
      toast.error('Primero debes tener al menos una efeméride registrada para sincronizar.');
      return;
    }

    if (!window.confirm('¿Confirmas sincronizar y asegurar estas efemérides en el calendario de TODOS los centros educativos registrados en EduGest?')) {
      return;
    }

    setIsSyncing(true);
    try {
      // 1. Obtener todos los centros registrados
      const { data: centers, error: centersError } = await supabase.from('centers').select('id, name');
      if (centersError || !centers || centers.length === 0) {
        throw new Error('No se encontraron centros registrados.');
      }

      let insertedCount = 0;

      // 2. Para cada centro, insertar las efemérides
      for (const c of centers) {
        const centerPayload = ephemerides.map((e) => ({
          title: e.title,
          description: e.description,
          date: e.date,
          start_time: e.start_time || '08:00',
          end_time: e.end_time || '14:00',
          type: 'ephemeris',
          center_id: c.id,
          is_global: true
        }));

        // Inserción en bloques tolerante a fallos
        const { error: insErr } = await supabase.from('activities').upsert(centerPayload, {
          onConflict: 'center_id,title,date' as any,
          ignoreDuplicates: true
        });

        if (!insErr) {
          insertedCount++;
        }
      }

      toast.success(`¡Sincronización completada! ${ephemerides.length} fechas actualizadas en ${insertedCount} centros.`);
      await refreshData(undefined, true);
    } catch (err: any) {
      console.error('Error al sincronizar centros:', err);
      toast.error('Error al sincronizar: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSyncing(false);
    }
  };

  // Abrir modal de creación o edición
  const handleOpenModal = (item?: any) => {
    if (item) {
      setEditingItem(item);
      setFormTitle(item.title || '');
      setFormDate(item.date || '');
      setFormCategory(
        item.description?.toLowerCase().includes('feriado') || item.description?.toLowerCase().includes('fiesta')
          ? 'holiday'
          : item.description?.toLowerCase().includes('patria') || item.description?.toLowerCase().includes('duarte') || item.description?.toLowerCase().includes('independencia')
          ? 'civic'
          : 'educational'
      );
      setFormDescription(item.description || '');
      setFormIsGlobal(item.is_global ?? true);
    } else {
      setEditingItem(null);
      setFormTitle('');
      setFormDate('');
      setFormCategory('civic');
      setFormDescription('');
      setFormIsGlobal(true);
    }
    setShowModal(true);
  };

  // Guardar efeméride
  const handleSaveEphemeris = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDate) {
      toast.error('Por favor completa el título y la fecha.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        title: formTitle.trim(),
        date: formDate,
        description: formDescription.trim(),
        type: 'ephemeris',
        is_global: formIsGlobal,
        start_time: '08:00',
        end_time: '14:00'
      };

      if (editingItem?.id) {
        const { error } = await supabase
          .from('activities')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        toast.success('Efeméride actualizada correctamente');
      } else {
        const { error } = await supabase
          .from('activities')
          .insert([payload]);
        if (error) throw error;
        toast.success('Efeméride registrada correctamente');
      }

      setShowModal(false);
      await fetchEphemerides();
      await refreshData(undefined, true);
    } catch (err: any) {
      console.error('Error al guardar efeméride:', err);
      toast.error('Error al guardar: ' + (err.message || 'Verifica los datos'));
    } finally {
      setIsSaving(false);
    }
  };

  // Eliminar efeméride
  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar la efeméride "${title}"?`)) return;

    try {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;
      toast.success('Efeméride eliminada');
      setEphemerides((prev) => prev.filter((x) => x.id !== id));
      await refreshData(undefined, true);
    } catch (err: any) {
      console.error('Error al eliminar:', err);
      toast.error('Error al eliminar efeméride');
    }
  };

  // Filtrado de efemérides
  const filteredList = useMemo(() => {
    return ephemerides.filter((item) => {
      // Búsqueda por texto
      const matchQuery =
        !searchQuery.trim() ||
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());

      // Filtro por mes
      let matchMonth = true;
      if (selectedMonth !== 'all' && item.date) {
        const parts = item.date.split('-');
        if (parts.length >= 2) {
          const m = parseInt(parts[1], 10);
          matchMonth = String(m) === selectedMonth;
        }
      }

      return matchQuery && matchMonth;
    });
  }, [ephemerides, searchQuery, selectedMonth]);

  const months = [
    { num: 'all', label: 'Todos los meses' },
    { num: '8', label: 'Agosto' },
    { num: '9', label: 'Septiembre' },
    { num: '10', label: 'Octubre' },
    { num: '11', label: 'Noviembre' },
    { num: '12', label: 'Diciembre' },
    { num: '1', label: 'Enero' },
    { num: '2', label: 'Febrero' },
    { num: '3', label: 'Marzo' },
    { num: '4', label: 'Abril' },
    { num: '5', label: 'Mayo' },
    { num: '6', label: 'Junio' }
  ];

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden border border-white/10">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-wider text-blue-200 border border-white/10">
              <span>🇩🇴</span> Calendario Escolar Oficial MINERD
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              Efemérides y Fechas Oficiales
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed font-medium">
              Gestiona el calendario de efemérides patrias, días conmemorativos y asuetos oficiales. Las fechas publicadas aquí se reflejarán de manera automática en el calendario de <strong>todos los centros registrados en EduGest</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleImportDefaultMinerd}
              disabled={isImportingDefault}
              className="flex items-center gap-2 px-4 py-3 bg-white hover:bg-slate-100 text-indigo-900 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Precargar automáticamente las efemérides oficiales del MINERD para el año escolar"
            >
              <Sparkles size={16} className="text-amber-500" />
              {isImportingDefault ? 'Cargando Catálogo...' : 'Cargar Calendario MINERD'}
            </button>

            <button
              onClick={handleSyncToAllCenters}
              disabled={isSyncing || ephemerides.length === 0}
              className="flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Asegurar y replicar estas efemérides a cada colegio de la base de datos"
            >
              <Share2 size={16} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar a Todos los Centros'}
            </button>

            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={16} />
              Nueva Efeméride
            </button>
          </div>
        </div>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="bg-surface p-4 rounded-3xl border border-border-main shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por título o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-brand-bg border border-border-main rounded-2xl text-xs font-bold text-text-main outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1">
          {months.map((m) => (
            <button
              key={m.num}
              onClick={() => setSelectedMonth(m.num)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 transition-all cursor-pointer ${
                selectedMonth === m.num
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-brand-bg text-text-muted hover:text-text-main border border-border-main'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* TABLA DE EFEMÉRIDES */}
      <div className="bg-surface rounded-3xl border border-border-main shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-border-main flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-text-muted flex items-center gap-2">
            <CalendarIcon size={16} className="text-indigo-600" />
            Efemérides Registradas ({filteredList.length})
          </span>
          <span className="text-[10px] font-bold text-text-muted">
            Año Escolar: <span className="text-indigo-600 font-black">{selectedYear || '2026-2027'}</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4 w-32">Fecha</th>
                <th className="py-3 px-4">Efeméride / Evento</th>
                <th className="py-3 px-4 w-32 text-center">Alcance</th>
                <th className="py-3 px-4 text-right w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center animate-pulse text-text-muted font-bold text-xs">
                    Cargando efemérides...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-text-muted">
                    <p className="font-black text-sm">No se encontraron efemérides.</p>
                    <p className="text-xs mt-1">Haz clic en <strong>"Cargar Calendario MINERD"</strong> para llenar automáticamente todas las fechas patrias y escolares oficiales.</p>
                  </td>
                </tr>
              ) : (
                filteredList.map((item, index) => {
                  let formattedDate = item.date;
                  try {
                    const [y, m, d] = item.date.split('-');
                    formattedDate = `${d}/${m}/${y}`;
                  } catch {}

                  const isPatria =
                    item.title?.toLowerCase().includes('duarte') ||
                    item.title?.toLowerCase().includes('independencia') ||
                    item.title?.toLowerCase().includes('restauración') ||
                    item.title?.toLowerCase().includes('mella') ||
                    item.title?.toLowerCase().includes('sánchez') ||
                    item.title?.toLowerCase().includes('constitución');

                  return (
                    <tr key={item.id || index} className="hover:bg-brand-bg transition-colors">
                      <td className="py-3 px-4 text-center font-mono font-bold text-text-muted text-[11px]">
                        {index + 1}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        {formattedDate}
                      </td>
                      <td className="py-3 px-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-text-main uppercase text-xs">
                            {item.title}
                          </span>
                          {isPatria && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 text-[9px] font-black uppercase flex items-center gap-1">
                              🇩🇴 Patria
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed font-medium">
                            {item.description}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 text-[10px] font-black uppercase">
                          <CheckCircle2 size={11} /> Global (Todos)
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenModal(item)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"
                            title="Editar efeméride"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.title)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar efeméride"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CREAR / EDITAR */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface rounded-3xl border border-border-main p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-border-main pb-4">
              <h3 className="text-lg font-black text-text-main flex items-center gap-2">
                <CalendarIcon size={20} className="text-indigo-600" />
                {editingItem ? 'Editar Efeméride Oficial' : 'Nueva Efeméride Oficial'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEphemeris} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-text-muted mb-1">
                  Título de la Efeméride *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Natalicio de Juan Pablo Duarte"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-brand-bg border border-border-main rounded-xl text-xs font-bold text-text-main outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-text-muted mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-brand-bg border border-border-main rounded-xl text-xs font-bold text-text-main outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-text-muted mb-1">
                    Categoría
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e: any) => setFormCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-brand-bg border border-border-main rounded-xl text-xs font-bold text-text-main outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="civic">🇩🇴 Patria / Cívica</option>
                    <option value="educational">📚 Educativa / Académica</option>
                    <option value="holiday">🏖️ Feriado / Asueto</option>
                    <option value="institutional">🏫 Institucional</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-text-muted mb-1">
                  Descripción o Reseña Histórica
                </label>
                <textarea
                  rows={3}
                  placeholder="Escribe brevemente el contexto histórico o instrucciones formativas para los centros..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-brand-bg border border-border-main rounded-xl text-xs font-medium text-text-main outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-indigo-900 dark:text-indigo-200">
                    Visible en todos los centros
                  </p>
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400">
                    Aparecerá en el calendario de cada colegio de la plataforma.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formIsGlobal}
                  onChange={(e) => setFormIsGlobal(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-main">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-border-main text-text-muted hover:text-text-main text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'Guardando...' : editingItem ? 'Actualizar' : 'Registrar Efeméride'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
