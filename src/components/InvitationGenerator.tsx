import React, { useState, useEffect, useMemo } from 'react';
import {
  createInvitationCode,
  getActiveInvitationCodes,
  deleteInvitationCode
} from '../services/userService';
import { useApp } from '../context/AppContext';
import { useCourses } from '../hooks/useCourses';
import {
  KeyRound,
  UserPlus,
  CheckCircle2,
  Trash2,
  Copy,
  Check,
  Lock,
  Layers,
  Users,
  GraduationCap,
  BookOpen
} from 'lucide-react';
import toast from 'react-hot-toast';

const AVAILABLE_PANELS = [
  {
    id: 'dashboard',
    label: 'Panel Principal / Resumen',
    desc: 'Vista de bienvenida, métricas y resumen general.'
  },
  {
    id: 'classroom',
    label: 'Mi Aula (Asistencia y Parciales)',
    desc: 'Toma de lista diaria MINERD, anecdotario y parciales.'
  },
  {
    id: 'digital-register',
    label: 'Registro Digital de Calificaciones',
    desc: 'Calificaciones de períodos oficiales P1-P4 y recuperación.'
  },
  {
    id: 'agenda',
    label: 'Calendario Escolar',
    desc: 'Planificador de eventos, efemérides y actividades.'
  },
  {
    id: 'tasks',
    label: 'Tareas y Asignaciones',
    desc: 'Publicación de deberes y recepción de trabajos escolares.'
  },
  {
    id: 'communications',
    label: 'Comunicaciones y Excusas',
    desc: 'Recepción de avisos de dirección y justificación de faltas.'
  },
  {
    id: 'schedule',
    label: 'Horarios',
    desc: 'Diseño y generación de horarios del centro (Coordinación y Dirección).'
  },
  {
    id: 'students',
    label: 'Alumnos',
    desc: 'Matrícula de alumnos, expedientes y certificados.'
  },
  {
    id: 'general-reports',
    label: 'Reportes e Informes MINERD',
    desc: 'Boletines de notas e informe diario de asistencia.'
  },
  {
    id: 'data',
    label: 'Datos',
    desc: 'Configuración de cursos, asignaturas y ciclo escolar.'
  },
  {
    id: 'control',
    label: 'Modo Control y Monitoreo',
    desc: 'Seguimiento en tiempo real de actividades del centro.'
  },
  {
    id: 'finances',
    label: 'Finanzas',
    desc: 'Control de nómina, gastos, becas y pagos.'
  },
  {
    id: 'admin',
    label: 'Administración del Centro',
    desc: 'Control de usuarios, configuración del centro y licencias.'
  }
];

const ROLE_DEFAULTS: Record<string, string[]> = {
  admin: [
    'dashboard',
    'classroom',
    'students',
    'digital-register',
    'data',
    'schedule',
    'agenda',
    'tasks',
    'communications',
    'control',
    'general-reports',
    'finances',
    'admin'
  ],
  finance: [
    'dashboard',
    'students',
    'digital-register',
    'data',
    'schedule',
    'agenda',
    'tasks',
    'communications',
    'control',
    'general-reports',
    'finances'
  ],
  coordinator: [
    'dashboard',
    'classroom',
    'students',
    'digital-register',
    'data',
    'schedule',
    'agenda',
    'tasks',
    'communications',
    'control',
    'general-reports'
  ],
  teacher: ['dashboard', 'classroom', 'digital-register', 'tasks'],
  conserje: ['dashboard', 'agenda'],
  support: ['dashboard', 'agenda']
};

export const InvitationGenerator = ({
  role,
  schoolId,
  courseId
}: {
  role?: string;
  schoolId?: string;
  courseId?: string;
}) => {
  const { state, center, selectedYear, profile } = useApp();
  const [activeTab, setActiveTab] = useState<'admin' | 'courses'>('admin');

  // Estados para invitaciones individuales (Docentes y Administrativos)
  const [code, setCode] = useState('');
  const [selectedRole, setSelectedRole] = useState(role || 'teacher');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedPanels, setSelectedPanels] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [activeCodes, setActiveCodes] = useState<any[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Estados para códigos de cursos
  const { courses: allCourses, updateCourse } = useCourses();
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editCodeValue, setEditCodeValue] = useState('');

  // Inicializar iniciales del centro y año
  const centerInitials = useMemo(() => {
    const rawName = center?.name || profile?.center_name || 'EDU';
    const stopWords = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'para', 'por', 'a', 'san', 'santa', 'colegio', 'escuela', 'instituto', 'liceo', 'centro', 'educativo']);
    const words = rawName.trim().split(/\s+/).filter((w) => !stopWords.has(w.toLowerCase()));
    if (words.length >= 2) {
      const inits = words.map((w) => w[0].toUpperCase()).join('').substring(0, 4);
      if (inits.length >= 2) return inits;
    }
    const filtered = rawName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return filtered.substring(0, 4) || 'EDU';
  }, [center?.name, profile?.center_name]);

  const yearSuffix = useMemo(() => {
    const digits = (selectedYear || '2026').replace(/\D/g, '');
    if (digits.length >= 4) {
      return digits.substring(2, 4);
    }
    return '26';
  }, [selectedYear]);

  const defaultPrefix = useMemo(() => {
    return `${centerInitials}-${yearSuffix}-DOC-`;
  }, [centerInitials, yearSuffix]);

  // Cambiar checkboxes predeterminados al elegir rol administrativo
  useEffect(() => {
    const defaults = ROLE_DEFAULTS[selectedRole] || [];
    setSelectedPanels(defaults);
  }, [selectedRole]);

  // Cargar códigos activos del centro
  const loadCodes = async () => {
    const cId = center?.id || profile?.center_id;
    if (cId) {
      const data = await getActiveInvitationCodes(cId);
      setActiveCodes(data || []);
    }
  };

  useEffect(() => {
    loadCodes();
  }, [center?.id, profile?.center_id]);

  const handleTogglePanel = (panelId: string) => {
    setSelectedPanels((prev) =>
      prev.includes(panelId) ? prev.filter((id) => id !== panelId) : [...prev, panelId]
    );
  };

  // Helper para generar slug limpio del maestro
  const getTeacherSlug = (teacherName: string) => {
    if (!teacherName) return 'DOC';
    const norm = teacherName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .trim();

    const parts = norm.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const firstName = parts[0].substring(0, 6);
      const lastInitial = parts[parts.length - 1].substring(0, 1);
      return `${firstName}${lastInitial}`;
    }
    return norm.substring(0, 7) || 'DOC';
  };

  // Lista ordenada de docentes del centro
  const sortedTeachers = useMemo(() => {
    return [...(state.teachers || [])].sort((a: any, b: any) =>
      (a.name || a.full_name || '').localeCompare(b.name || b.full_name || '')
    );
  }, [state.teachers]);

  // Crear código individual
  const handleCreateCode = async () => {
    if (!code || !profile) return;
    const cId = center?.id || profile?.center_id;

    setIsCreating(true);
    try {
      const sanitizedCode = code.trim().toUpperCase().replace(/\s+/g, '');
      await createInvitationCode(
        sanitizedCode,
        selectedRole,
        courseId,
        cId,
        selectedPanels,
        selectedRole === 'teacher' && selectedTeacherId ? selectedTeacherId : undefined
      );

      toast.success(`Código "${sanitizedCode}" generado exitosamente.`);
      setCode('');
      setSelectedTeacherId('');
      loadCodes();
    } catch (error) {
      console.error('Error creating code:', error);
      toast.error('Error al generar el código. Asegúrese de que no exista previamente.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCode = async (codeToDelete: string) => {
    if (!confirm(`¿Está seguro de eliminar el código de invitación "${codeToDelete}"?`)) return;

    try {
      await deleteInvitationCode(codeToDelete);
      toast.success('Código de invitación eliminado.');
      loadCodes();
    } catch (error) {
      console.error(error);
      toast.error('Error al eliminar el código.');
    }
  };

  const handleDeleteAllUnusedCodes = async () => {
    const unusedCodes = activeCodes.filter((c) => !c.is_used);
    if (unusedCodes.length === 0) {
      toast.error('No hay códigos sin usar para eliminar.');
      return;
    }
    if (
      !confirm(
        `¿Está seguro de eliminar los ${unusedCodes.length} códigos que aún no han sido utilizados?`
      )
    )
      return;

    try {
      for (const c of unusedCodes) {
        await deleteInvitationCode(c.code);
      }
      toast.success(`${unusedCodes.length} códigos no utilizados han sido eliminados.`);
      loadCodes();
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar códigos.');
    }
  };

  const handleCopy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedCode(txt);
    toast.success('Código copiado al portapapeles');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSaveCourseCode = async (courseId: string) => {
    try {
      const trimmedCode = editCodeValue.trim().toUpperCase().replace(/\s+/g, '');
      await updateCourse({
        id: courseId,
        updates: { code: trimmedCode || null }
      });
      toast.success('Código de acceso actualizado');
      setEditingCourseId(null);
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar el código');
    }
  };

  return (
    <div className="space-y-6">
      {/* Selector de Pestañas Principales */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit border border-slate-200 shadow-inner">
        <button
          onClick={() => setActiveTab('admin')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'admin'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <KeyRound size={16} /> Códigos Individuales (Docentes y Personal)
        </button>
        <button
          onClick={() => setActiveTab('courses')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'courses'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Users size={16} /> Códigos de Cursos (Alumnos y Padres)
        </button>
      </div>

      {/* 1. PESTAÑA CÓDIGOS INDIVIDUALES */}
      {activeTab === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Columna Izquierda: Generador */}
          <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                <KeyRound size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase text-slate-800 tracking-tighter">
                  Generador de Invitaciones Individuales
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                  Genera códigos uno por uno vinculados directamente con cada docente y su horario
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!role && (
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                    Rol a Asignar
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => {
                      setSelectedRole(e.target.value);
                      if (e.target.value !== 'teacher') setSelectedTeacherId('');
                    }}
                    className="w-full bg-slate-50 border-2 border-slate-100 px-4 py-3 rounded-2xl outline-none focus:border-indigo-500 transition-all font-black text-xs text-slate-700 uppercase"
                  >
                    <option value="teacher">Docente</option>
                    <option value="coordinator">Gestor Educativo / Coordinador</option>
                    <option value="finance">Gestión Financiera / Tesorero</option>
                    <option value="admin">Administrador del Centro</option>
                    <option value="conserje">Conserje / Personal de Apoyo</option>
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                  Código Personalizado
                </label>
                <input
                  type="text"
                  placeholder="Ej: GEN-26-DOC-JUANP"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 px-4 py-3 rounded-2xl outline-none focus:border-indigo-500 transition-all font-mono font-bold uppercase text-xs text-slate-700"
                />
              </div>
            </div>

            {/* Selector de Docente Registrado con Horario */}
            {selectedRole === 'teacher' && (
              <div className="space-y-2 p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-indigo-950 uppercase tracking-wider pl-1 flex items-center gap-1.5">
                    <GraduationCap size={15} className="text-indigo-600" />
                    Seleccionar Docente con Horario Creado (Vinculación Directa)
                  </label>
                  {selectedTeacherId && (
                    <button
                      type="button"
                      onClick={() => setSelectedTeacherId('')}
                      className="text-[9px] font-bold text-rose-600 hover:text-rose-800 uppercase"
                    >
                      Desvincular
                    </button>
                  )}
                </div>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => {
                    const tId = e.target.value;
                    setSelectedTeacherId(tId);
                    if (tId) {
                      const tObj = (state.teachers || []).find((t: any) => t.id === tId);
                      if (tObj) {
                        const tName = tObj.name || tObj.full_name || 'DOC';
                        const slug = getTeacherSlug(tName);
                        setCode(`${defaultPrefix}${slug}`);
                      }
                    }
                  }}
                  className="w-full bg-white border-2 border-indigo-200 px-4 py-3 rounded-xl outline-none focus:border-indigo-600 transition-all font-bold text-xs text-indigo-950 uppercase shadow-sm"
                >
                  <option value="">-- Seleccionar Docente de la Nómina / Horario --</option>
                  {sortedTeachers.map((t: any) => {
                    const tAssignments = (state.assignments || []).filter(
                      (a: any) => (a.teacher_id || a.teacherId) === t.id
                    );
                    const cSummary = Array.from(
                      new Set(
                        tAssignments.map((a: any) => {
                          const course = (state.courses || []).find((c: any) => c.id === (a.course_id || a.courseId));
                          return course ? `${course.grade} "${course.section}"` : '';
                        }).filter(Boolean)
                      )
                    ).join(', ');
                    const label = `${t.name || t.full_name} (${t.area || t.position || 'Docente'}${cSummary ? ' • ' + cSummary : ''})`;
                    return (
                      <option key={t.id} value={t.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>

                {selectedTeacherId ? (
                  <p className="text-[10px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center gap-2">
                    <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                    <span>
                      Este código quedará vinculado directamente al docente seleccionado. Al registrarse, heredará de inmediato su horario, materias y perfil.
                    </span>
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-500 font-medium pl-1">
                    💡 Selecciona al docente de la lista para enlazarlo directamente con su horario y materias.
                  </p>
                )}
              </div>
            )}

            {/* Panel de Selección de Permisos */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                  Permisos de Módulos Autorizados
                </label>
                <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full uppercase">
                  {selectedPanels.length} Módulos Activos
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                {AVAILABLE_PANELS.map((p) => {
                  const isChecked = selectedPanels.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleTogglePanel(p.id)}
                      className={`flex items-start text-left p-3 rounded-2xl border-2 transition-all gap-3 ${
                        isChecked
                          ? 'bg-indigo-50/50 border-indigo-200'
                          : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div
                        className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                          isChecked
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check size={10} strokeWidth={4} />}
                      </div>
                      <div>
                        <div
                          className={`text-[10px] font-black uppercase leading-tight ${
                            isChecked ? 'text-indigo-900' : 'text-slate-700'
                          }`}
                        >
                          {p.label}
                        </div>
                        <div className="text-[8px] font-medium text-slate-400 uppercase mt-0.5 leading-tight">
                          {p.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleCreateCode}
              disabled={isCreating || !code.trim()}
              className="w-full bg-indigo-600 text-white px-6 py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all disabled:opacity-50 disabled:grayscale cursor-pointer"
            >
              {isCreating ? (
                'Procesando...'
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <UserPlus size={16} /> Generar Código con Permisos
                </span>
              )}
            </button>
          </div>

          {/* Columna Derecha: Códigos Activos */}
          <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col h-[560px]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Layers size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-700 tracking-tighter">
                    Códigos Generados ({activeCodes.length})
                  </h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                    Invitaciones activas del centro
                  </p>
                </div>
              </div>
              {activeCodes.some((c) => !c.is_used) && (
                <button
                  type="button"
                  onClick={handleDeleteAllUnusedCodes}
                  className="text-[9px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 uppercase cursor-pointer"
                  title="Eliminar todos los códigos que no han sido utilizados"
                >
                  <Trash2 size={11} /> Limpiar sin usar
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {activeCodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Lock size={32} className="opacity-20 mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-center">
                    No hay códigos activos
                  </p>
                </div>
              ) : (
                activeCodes.map((c) => (
                  <div
                    key={c.code}
                    className={`p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col space-y-3 relative group transition-all ${
                      c.is_used ? 'opacity-60 bg-slate-50/50' : 'hover:border-indigo-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-indigo-600 tracking-wide uppercase">
                          {c.code}
                        </span>
                        <button
                          onClick={() => handleCopy(c.code)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                          title="Copiar Código"
                        >
                          {copiedCode === c.code ? (
                            <Check size={12} className="text-emerald-500" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>

                      <span
                        className={`px-2 py-0.5 text-[8px] font-black rounded-full uppercase tracking-wider ${
                          c.is_used
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-emerald-50 text-emerald-600'
                        }`}
                      >
                        {c.is_used ? 'Usado' : 'Disponible'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[9px] border-t border-slate-50 pt-2">
                      <div>
                        <span className="text-[8px] font-black text-slate-400 uppercase block leading-none">
                          Rol Inicial
                        </span>
                        <span className="font-black text-slate-700 uppercase">{c.role}</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-black text-slate-400 uppercase block leading-none">
                          Creado
                        </span>
                        <span className="font-bold text-slate-500">
                          {new Date(c.created_at).toLocaleDateString('es-DO')}
                        </span>
                      </div>
                    </div>

                    {(() => {
                      const linkedTeacher = (state.teachers || []).find(
                        (t: any) =>
                          t.id === c.teacher_id ||
                          (c.role === 'teacher' && c.code.includes(getTeacherSlug(t.name || t.full_name || '')))
                      );
                      return linkedTeacher ? (
                        <div className="text-[10px] font-bold text-indigo-700 bg-indigo-50/80 border border-indigo-100 p-1.5 rounded-lg flex items-center gap-1.5 mt-1">
                          <GraduationCap size={13} className="text-indigo-600 shrink-0" />
                          <span className="truncate">Docente: {linkedTeacher.name || linkedTeacher.full_name}</span>
                        </div>
                      ) : null;
                    })()}

                    <button
                      onClick={() => handleDeleteCode(c.code)}
                      className="absolute right-3 top-2 p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Eliminar Código"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. PESTAÑA ALUMNOS Y PADRES (POR CURSO) */}
      {activeTab === 'courses' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-[2.5rem] text-xs text-amber-900 font-bold leading-relaxed uppercase">
            💡 INSTRUCCIONES: Los alumnos y padres no requieren códigos individuales. Asigna un
            código único por curso (ej: <code>GEN-5A</code>) y compártelo con todos los alumnos y
            padres de esa sección. Ellos lo ingresarán al registrarse para vincularse
            automáticamente a su curso correspondiente.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {['Inicial', 'Primario', 'Secundario'].map((lvl) => {
              const levelCourses = allCourses.filter((c: any) => c.level === lvl);
              if (levelCourses.length === 0) return null;

              return (
                <div
                  key={lvl}
                  className="bg-white rounded-[2rem] border border-slate-200/80 overflow-hidden shadow-sm flex flex-col animate-in fade-in duration-200"
                >
                  {/* Cabecera del Nivel */}
                  <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Nivel {lvl}
                    </h4>
                    <span className="text-[10px] bg-slate-200/70 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                      {levelCourses.length} cursos
                    </span>
                  </div>

                  {/* Lista de Cursos del Nivel */}
                  <div className="divide-y divide-slate-100 p-2">
                    {levelCourses.map((c: any) => (
                      <div
                        key={c.id}
                        className="p-3 hover:bg-slate-50/80 rounded-xl transition-colors flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-xs text-slate-800 uppercase">
                            {c.grade} "{c.section}"
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            Tanda: {c.tanda || 'No especificada'}
                          </div>
                        </div>

                        {/* Input o Badge del Código */}
                        <div>
                          {editingCourseId === c.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                autoFocus
                                value={editCodeValue}
                                onChange={(e) => setEditCodeValue(e.target.value)}
                                className="w-24 px-2 py-1 bg-white border-2 border-indigo-500 rounded-lg text-xs font-mono font-bold text-indigo-700 uppercase outline-none"
                                placeholder="Ej: GEN-1A"
                              />
                              <button
                                onClick={() => handleSaveCourseCode(c.id)}
                                className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                                title="Guardar Código"
                              >
                                <Check size={12} strokeWidth={3} />
                              </button>
                              <button
                                onClick={() => setEditingCourseId(null)}
                                className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                                title="Cancelar"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {c.code ? (
                                <span className="font-mono font-black text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                  {c.code}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md uppercase">
                                  Sin Código
                                </span>
                              )}
                              <button
                                onClick={() => {
                                  setEditingCourseId(c.id);
                                  setEditCodeValue(c.code || '');
                                }}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Editar código del curso"
                              >
                                <BookOpen size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
