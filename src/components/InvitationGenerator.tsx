import React, { useState, useEffect } from 'react';
import { createInvitationCode, getActiveInvitationCodes, deleteInvitationCode } from '../services/userService';
import { useSupabase } from '../context/AppContext';
import { useCourses } from '../hooks/useCourses';
import { 
  KeyRound, 
  UserPlus, 
  CheckCircle2, 
  Trash2, 
  Copy, 
  Check, 
  Lock, 
  Unlock, 
  Layers, 
  ShieldAlert,
  Pencil,
  X,
  Sparkles,
  Users,
  GraduationCap
} from 'lucide-react';
import toast from 'react-hot-toast';

const AVAILABLE_PANELS = [
  { id: 'dashboard', label: 'Panel Principal', desc: 'Panel de métricas y vista general del centro.' },
  { id: 'students', label: 'Gestión de Alumnos', desc: 'Matrícula de alumnos, expedientes y certificados.' },
  { id: 'digital-register', label: 'Calificaciones', desc: 'Registro digital de notas por períodos y grados.' },
  { id: 'data', label: 'Gestión de Datos', desc: 'Configuración de cursos, asignaturas y ciclo escolar.' },
  { id: 'schedule', label: 'Horarios', desc: 'Visualización y creador automático de horarios.' },
  { id: 'agenda', label: 'Calendario Escolar', desc: 'Planificador de eventos y efemérides.' },
  { id: 'tasks', label: 'Tareas', desc: 'Asignación, seguimiento y envío de tareas escolares.' },
  { id: 'communications', label: 'Comunicaciones', desc: 'Envío de comunicados oficiales y justificación de excusas.' },
  { id: 'control', label: 'Modo Control', desc: 'Seguimiento en tiempo real de actividades del centro.' },
  { id: 'general-reports', label: 'Reportes', desc: 'Reportes académicos, demográficos y consolidados.' },
  { id: 'finances', label: 'Gestión Financiera', desc: 'Control de nómina, gastos, becas y cuentas de estudiantes.' },
  { id: 'admin', label: 'Administración', desc: 'Control de usuarios, configuración del centro y auditoría.' },
];

const ROLE_DEFAULTS: Record<string, string[]> = {
  admin: ['dashboard', 'students', 'digital-register', 'data', 'schedule', 'agenda', 'tasks', 'communications', 'control', 'general-reports', 'finances', 'admin'],
  finance: ['dashboard', 'students', 'digital-register', 'data', 'schedule', 'agenda', 'tasks', 'communications', 'control', 'general-reports', 'finances'],
  coordinator: ['dashboard', 'students', 'digital-register', 'data', 'schedule', 'agenda', 'tasks', 'communications', 'control', 'general-reports'],
  teacher: ['dashboard', 'schedule', 'agenda', 'digital-register', 'tasks', 'communications'],
  conserje: ['dashboard', 'facility', 'agenda'],
  support: ['dashboard', 'facility', 'agenda'],
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
  const [activeTab, setActiveTab] = useState<'admin' | 'courses'>('admin');
  
  // States for administrative invitations
  const [code, setCode] = useState('');
  const [selectedRole, setSelectedRole] = useState(role || 'teacher');
  const [selectedPanels, setSelectedPanels] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [activeCodes, setActiveCodes] = useState<any[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { profile } = useSupabase();

  // States for course codes
  const { courses: allCourses, updateCourse } = useCourses();
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editCodeValue, setEditCodeValue] = useState('');

  // Cambiar checkboxes predeterminados al elegir rol
  useEffect(() => {
    const defaults = ROLE_DEFAULTS[selectedRole] || [];
    setSelectedPanels(defaults);
  }, [selectedRole]);

  // Cargar códigos activos del centro
  useEffect(() => {
    loadCodes();
  }, [profile]);

  const loadCodes = async () => {
    if (profile?.center_id) {
      const data = await getActiveInvitationCodes(profile.center_id);
      setActiveCodes(data);
    }
  };

  const handleTogglePanel = (panelId: string) => {
    setSelectedPanels(prev => 
      prev.includes(panelId) 
        ? prev.filter(id => id !== panelId) 
        : [...prev, panelId]
    );
  };

  const handleCreateCode = async () => {
    if (!code || !profile) return;

    setIsCreating(true);
    try {
      const sanitizedCode = code.trim().toUpperCase().replace(/\s+/g, '');
      await createInvitationCode(sanitizedCode, selectedRole, courseId, profile.center_id, selectedPanels);

      toast.success(`Código de acceso "${sanitizedCode}" generado exitosamente.`);
      setCode('');
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
      {/* Selector de Sección */}
      <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit border border-slate-200 shadow-inner">
        <button
          onClick={() => setActiveTab('admin')}
          className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'admin' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <span className="flex items-center gap-1.5">
            <KeyRound size={11} /> Personal del Centro
          </span>
        </button>
        <button
          onClick={() => setActiveTab('courses')}
          className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'courses' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <span className="flex items-center gap-1.5">
            <Users size={11} /> Alumnos y Padres (Por Curso)
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {activeTab === 'admin' ? (
          <>
            {/* Columna Izquierda: Generador */}
            <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase text-slate-800 tracking-tighter">Generador de Invitaciones</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Configura códigos y limita el acceso a la plataforma</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                    Código Personalizado
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: DOCENTEDIGITAL2026"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 px-4 py-3 rounded-2xl outline-none focus:border-indigo-500 transition-all font-mono font-bold uppercase text-xs text-slate-700"
                  />
                </div>

                {!role && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                      Asignar Rol Inicial
                    </label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
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
              </div>

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
                        className={`flex items-start text-left p-3 rounded-2xl border-2 transition-all gap-3 ${isChecked ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50 hover:border-slate-200'}`}
                      >
                        <div className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center transition-all ${isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>
                          {isChecked && <Check size={10} strokeWidth={4} />}
                        </div>
                        <div>
                          <div className={`text-[10px] font-black uppercase leading-tight ${isChecked ? 'text-indigo-900' : 'text-slate-700'}`}>
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
                className="w-full bg-indigo-600 text-white px-6 py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all disabled:opacity-50 disabled:grayscale"
              >
                {isCreating ? (
                  'Procesando...'
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <UserPlus size={16} /> Generar Código de Invitación con Permisos
                  </span>
                )}
              </button>
            </div>

            {/* Columna Derecha: Códigos Activos */}
            <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col h-[520px]">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Layers size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-700 tracking-tighter">Códigos Generados</h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Invitaciones activas del centro</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {activeCodes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <Lock size={32} className="opacity-20 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-center">No hay códigos activos</p>
                    <p className="text-[8px] font-medium text-center uppercase mt-1 leading-tight px-6">Genera códigos personalizados para compartir con el personal</p>
                  </div>
                ) : (
                  activeCodes.map((c) => (
                    <div 
                      key={c.code}
                      className={`p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col space-y-3 relative group transition-all ${c.is_used ? 'opacity-60 bg-slate-50/50' : 'hover:border-indigo-100'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-indigo-600 tracking-wide uppercase">{c.code}</span>
                          <button 
                            onClick={() => handleCopy(c.code)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                            title="Copiar Código"
                          >
                            {copiedCode === c.code ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          </button>
                        </div>
                        
                        <span className={`px-2 py-0.5 text-[8px] font-black rounded-full uppercase tracking-wider ${c.is_used ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'}`}>
                          {c.is_used ? 'Usado' : 'Disponible'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[9px] border-t border-slate-50 pt-2">
                        <div>
                          <span className="text-[8px] font-black text-slate-400 uppercase block leading-none">Rol Inicial</span>
                          <span className="font-black text-slate-700 uppercase">{c.role}</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-black text-slate-400 uppercase block leading-none">Creado</span>
                          <span className="font-bold text-slate-500">{new Date(c.created_at).toLocaleDateString('es-DO')}</span>
                        </div>
                      </div>

                      <div className="text-[8px] bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span className="font-black text-slate-400 uppercase block mb-1">Módulos ({c.allowed_panels?.length || 0})</span>
                        <div className="flex flex-wrap gap-1">
                          {c.allowed_panels && c.allowed_panels.length > 0 ? (
                            c.allowed_panels.map((pId: string) => (
                              <span key={pId} className="bg-white border border-slate-200/60 text-slate-600 font-bold px-1.5 py-0.5 rounded uppercase text-[7px]">
                                {pId}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 font-bold uppercase text-[7px]">Ninguno</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteCode(c.code)}
                        className="absolute right-3 top-2 p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Eliminar Código"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="lg:col-span-3 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-amber-50 border border-amber-200 p-5 rounded-[2.5rem] text-[10px] text-amber-800 font-bold leading-relaxed uppercase">
              💡 INSTRUCCIONES: Los alumnos y padres no requieren códigos individuales.
              Asigna un código único por curso (ej: <code>GEN-5A</code>) y compártelo con todos los alumnos y padres de esa sección.
              Ellos lo ingresarán al registrarse para vincularse automáticamente a su curso correspondiente.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['Inicial', 'Primario', 'Secundario'].map((lvl) => {
                const levelCourses = allCourses.filter((c: any) => c.level === lvl);
                if (levelCourses.length === 0) return null;

                return (
                  <div
                    key={lvl}
                    className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-md flex flex-col animate-in fade-in duration-200"
                  >
                    {/* Cabecera del Nivel */}
                    <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                        Nivel {lvl}
                      </h4>
                      <span className="text-[8px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-black px-2 py-0.5 rounded-full uppercase">
                        {levelCourses.length} {levelCourses.length === 1 ? 'Curso' : 'Cursos'}
                      </span>
                    </div>

                    {/* Lista de Cursos del Nivel */}
                    <div className="divide-y divide-slate-100 flex-1">
                      {levelCourses.map((course: any) => {
                        const isEditing = editingCourseId === course.id;

                        return (
                          <div
                            key={course.id}
                            className="p-4 hover:bg-slate-50/50 transition-colors flex flex-col gap-3"
                          >
                            {/* Grado y Sección */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs uppercase">
                                  {course.section}
                                </div>
                                <div>
                                  <span className="text-xs font-black text-slate-700 uppercase leading-none block">
                                    {course.grade}
                                  </span>
                                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                                    Tanda: {course.tanda} | {course.studentCount || course.student_count || 0} Alum.
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Código de Acceso */}
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-2.5 flex items-center justify-between gap-2">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">
                                Código:
                              </span>

                              {isEditing ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={editCodeValue}
                                    onChange={(e) => setEditCodeValue(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                                    className="bg-white border border-indigo-300 rounded-xl px-2 py-0.5 font-mono font-black text-[11px] text-indigo-700 outline-none w-24 uppercase text-center"
                                    placeholder="CÓDIGO"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => {
                                      const cleanGrade = course.grade.trim().replace(/[^a-zA-Z0-9]/g, '');
                                      setEditCodeValue(`${cleanGrade}-${course.section.trim()}`.toUpperCase());
                                    }}
                                    className="p-1 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all"
                                    title="Sugerir Código"
                                  >
                                    <Sparkles size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleSaveCourseCode(course.id)}
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                    title="Guardar"
                                  >
                                    <Check size={14} strokeWidth={3} />
                                  </button>
                                  <button
                                    onClick={() => setEditingCourseId(null)}
                                    className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg transition-all"
                                    title="Cancelar"
                                  >
                                    <X size={14} strokeWidth={3} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  {course.code ? (
                                    <code className="font-mono text-[11px] text-indigo-600 font-black tracking-wide bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100">
                                      {course.code}
                                    </code>
                                  ) : (
                                    <span className="text-[8px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100 uppercase tracking-widest animate-pulse">
                                      Sin Código
                                    </span>
                                  )}
                                  <button
                                    onClick={() => {
                                      setEditingCourseId(course.id);
                                      setEditCodeValue(course.code || '');
                                    }}
                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                                    title="Editar Código"
                                  >
                                    <Pencil size={11} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
