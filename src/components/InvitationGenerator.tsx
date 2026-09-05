import React, { useState, useEffect, useMemo } from 'react';
import {
  createInvitationCode,
  createBulkTeacherInvitationCodes,
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
  Unlock,
  Layers,
  ShieldAlert,
  Pencil,
  X,
  Sparkles,
  Users,
  GraduationCap,
  FileSpreadsheet,
  Printer,
  Share2,
  Send,
  RefreshCw,
  Search,
  Building2,
  Calendar,
  BookOpen,
  Sliders,
  CheckSquare,
  Square
} from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportGenericTableToExcel } from '../utils/listPdfGenerator';

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
    id: 'schedule',
    label: 'Horarios de Clases (Generador y Matriz)',
    desc: 'Visualización de matriz semanal de clases y motor generador de horarios.'
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
    id: 'students',
    label: 'Gestión de Alumnos',
    desc: 'Matrícula de alumnos, expedientes y certificados.'
  },
  {
    id: 'general-reports',
    label: 'Reportes e Informes MINERD',
    desc: 'Boletines de notas e informe diario de asistencia.'
  },
  {
    id: 'data',
    label: 'Gestión de Datos y Asignaciones',
    desc: 'Configuración de cursos, asignaturas y ciclo escolar.'
  },
  {
    id: 'control',
    label: 'Modo Control y Monitoreo',
    desc: 'Seguimiento en tiempo real de actividades del centro.'
  },
  {
    id: 'finances',
    label: 'Gestión Financiera',
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
  teacher: ['dashboard', 'classroom', 'schedule', 'agenda', 'digital-register', 'tasks', 'communications'],
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
  const [activeTab, setActiveTab] = useState<'teachers' | 'admin' | 'courses'>('teachers');

  // Estados para Invitación Masiva Docente
  const [teacherPanels, setTeacherPanels] = useState<string[]>(ROLE_DEFAULTS.teacher);
  const [customCenterCode, setCustomCenterCode] = useState<string>('');
  const [teacherSearch, setTeacherSearch] = useState<string>('');
  const [isGeneratingBulk, setIsGeneratingBulk] = useState<boolean>(false);
  const [staffScope, setStaffScope] = useState<'only_teachers' | 'all_staff'>('only_teachers');

  // Estados para invitaciones administrativas individuales
  const [code, setCode] = useState('');
  const [selectedRole, setSelectedRole] = useState(role || 'teacher');
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
    return `${customCenterCode.trim().toUpperCase() || centerInitials}-${yearSuffix}-DOC-`;
  }, [customCenterCode, centerInitials, yearSuffix]);

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

  const handleToggleTeacherPanel = (panelId: string) => {
    setTeacherPanels((prev) =>
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

  // Set de IDs de docentes con asignaciones de clase activas
  const assignedTeacherIds = useMemo(() => {
    return new Set(
      (state.assignments || []).map((a: any) => a.teacher_id || a.teacherId).filter(Boolean)
    );
  }, [state.assignments]);

  // Identificador de rol Docente / Profesor
  const isDocente = (t: any) => {
    if (assignedTeacherIds.has(t.id)) return true;

    const raw = `${t.role || ''} ${t.team || ''} ${t.cargo || ''} ${t.position || ''}`.toLowerCase();

    const isNonTeachingExplicit =
      raw.includes('conserje') ||
      raw.includes('porter') ||
      raw.includes('vigilant') ||
      raw.includes('secretar') ||
      raw.includes('limpieza') ||
      raw.includes('mantenimiento') ||
      raw.includes('chofer') ||
      raw.includes('cocin') ||
      raw.includes('psic') ||
      raw.includes('orientad') ||
      raw.includes('director') ||
      raw.includes('coordinad') ||
      raw.includes('caj') ||
      raw.includes('contab') ||
      raw.includes('administrative') ||
      raw.includes('support') ||
      raw.includes('cashier');

    const isTeachingExplicit =
      raw.includes('docente') ||
      raw.includes('maestr') ||
      raw.includes('prof') ||
      raw.includes('teach') ||
      raw.includes('educ') ||
      raw.includes('fisic') ||
      raw.includes('deport') ||
      raw.includes('instructor');

    if (isTeachingExplicit) return true;
    if (t.role === 'teacher' && !isNonTeachingExplicit) return true;
    if (t.role === 'management_teacher') return true;

    return false;
  };

  const totalDocentesCount = useMemo(() => {
    return (state.teachers || []).filter((t: any) => isDocente(t)).length;
  }, [state.teachers, assignedTeacherIds]);

  const totalStaffCount = (state.teachers || []).length;

  // Mapear docentes con sus códigos existentes o calculados
  const teachersWithCodes = useMemo(() => {
    const rawList = state.teachers || [];
    const targetList =
      staffScope === 'only_teachers'
        ? rawList.filter((t: any) => isDocente(t))
        : rawList;

    const usedSlugs = new Map<string, number>();

    return targetList.map((t: any) => {
      const tName = t.name || t.full_name || 'Docente';
      const isTeacherRole = isDocente(t);
      const baseSlug = getTeacherSlug(tName);
      let uniqueSlug = baseSlug;

      const currentCount = usedSlugs.get(baseSlug) || 0;
      if (currentCount > 0) {
        uniqueSlug = `${baseSlug}${currentCount + 1}`;
      }
      usedSlugs.set(baseSlug, currentCount + 1);

      const expectedCode = `${defaultPrefix}${uniqueSlug}`.toUpperCase();

      // Buscar si ya tiene un código guardado en activeCodes que coincida
      const matchingActive = activeCodes.find(
        (c) =>
          c.code.toUpperCase() === expectedCode ||
          c.code.toUpperCase().endsWith(`-${uniqueSlug}`) ||
          ((c.role === 'teacher' || !c.role) && c.code.includes(baseSlug))
      );

      // Cursos y asignaturas asignadas
      const tAssignments = (state.assignments || []).filter(
        (a: any) => (a.teacher_id || a.teacherId) === t.id
      );
      const coursesSummary = Array.from(
        new Set(
          tAssignments.map((a: any) => {
            const course = (state.courses || []).find((c: any) => c.id === (a.course_id || a.courseId));
            return course ? `${course.grade} "${course.section}"` : '';
          }).filter(Boolean)
        )
      ).join(', ');

      const positionLabel =
        t.position || t.cargo || (isTeacherRole ? 'Docente' : t.role || 'Personal');

      return {
        ...t,
        displayName: tName,
        positionLabel,
        isTeacherRole,
        generatedCode: matchingActive?.code || expectedCode,
        isCreatedInDb: !!matchingActive,
        isRegistered: matchingActive ? matchingActive.is_used : false,
        activeRecord: matchingActive,
        coursesSummary: coursesSummary || (isTeacherRole ? 'Sin asignaciones' : 'Personal No Docente')
      };
    });
  }, [state.teachers, state.assignments, state.courses, defaultPrefix, activeCodes, staffScope, assignedTeacherIds]);

  const filteredTeachers = useMemo(() => {
    if (!teacherSearch.trim()) return teachersWithCodes;
    const term = teacherSearch.toLowerCase();
    return teachersWithCodes.filter(
      (t) =>
        t.displayName.toLowerCase().includes(term) ||
        t.generatedCode.toLowerCase().includes(term) ||
        t.positionLabel.toLowerCase().includes(term) ||
        t.coursesSummary.toLowerCase().includes(term)
    );
  }, [teachersWithCodes, teacherSearch]);

  // Generar códigos masivos para todos los docentes
  const handleGenerateBulkTeacherCodes = async () => {
    const cId = center?.id || profile?.center_id;
    if (!cId) {
      toast.error('No se pudo determinar el centro educativo.');
      return;
    }

    if (teachersWithCodes.length === 0) {
      toast.error('No hay docentes registrados en la nómina del centro.');
      return;
    }

    setIsGeneratingBulk(true);
    try {
      const recordsToCreate = teachersWithCodes.map((t) => ({
        code: t.generatedCode,
        role: 'teacher',
        center_id: cId,
        allowed_panels: teacherPanels
      }));

      await createBulkTeacherInvitationCodes(recordsToCreate);
      toast.success(`¡${recordsToCreate.length} Códigos de Docentes generados y configurados con éxito!`);
      await loadCodes();
    } catch (err) {
      console.error('Error generando códigos masivos:', err);
      toast.error('Error al guardar los códigos en la base de datos.');
    } finally {
      setIsGeneratingBulk(false);
    }
  };

  // Crear código administrativo individual
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
        selectedPanels
      );

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

  const handleCopyWhatsApp = (teacher: any) => {
    const centerName = center?.name || 'nuestro centro educativo';
    const msg = `👋 Estimado/a ${teacher.displayName},\n\nLe compartimos su código oficial de acceso docente a Edugest (${centerName}):\n\n🔑 CÓDIGO: *${teacher.generatedCode}*\n\n📱 Pasos para ingresar:\n1. Entre a: https://www.edugest.net\n2. Presione "Registrarse" o "Vincularse".\n3. Ingrese su correo, contraseña y este código.\n\n¡Bienvenido/a al año escolar ${selectedYear || '2026-2027'}!`;

    navigator.clipboard.writeText(msg);
    toast.success(`Mensaje de WhatsApp copiado para ${teacher.displayName}`);
  };

  const handleCopyAllWhatsApp = () => {
    const centerName = center?.name || 'Centro Educativo';
    let text = `📋 *LISTADO OFICIAL DE CÓDIGOS DOCENTES - ${centerName.toUpperCase()}*\n`;
    text += `Año Escolar: ${selectedYear || '2026-2027'} | Acceso: https://www.edugest.net\n\n`;

    teachersWithCodes.forEach((t, i) => {
      text += `${i + 1}. *${t.displayName}*\n   🔑 Código: \`${t.generatedCode}\`\n   📚 Cursos: ${t.coursesSummary}\n\n`;
    });

    navigator.clipboard.writeText(text);
    toast.success('¡Listado completo copiado al portapapeles!');
  };

  // Exportar Excel
  const handleExportExcel = () => {
    const centerName = center?.name || 'Centro Educativo';
    const headers = ['Nº', 'Nombre del Docente', 'Código de Acceso', 'Cursos / Asignaturas', 'Módulos Autorizados', 'Estado'];
    const data = teachersWithCodes.map((t, idx) => [
      idx + 1,
      t.displayName.toUpperCase(),
      t.generatedCode,
      t.coursesSummary,
      `${teacherPanels.length} Módulos Activos`,
      t.isRegistered ? 'REGISTRADO' : 'PENDIENTE'
    ]);

    exportGenericTableToExcel({
      title: 'Directorio de Códigos de Acceso Docente',
      subtitle: `Año Escolar: ${selectedYear || '2026-2027'} | Centro: ${centerName}`,
      headers,
      data,
      fileName: `Codigos_Docentes_${centerInitials}_${yearSuffix}.xlsx`,
      centerName
    });
  };

  // Exportar PDF con tarjetas recortables para docentes
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.width;
    const centerName = center?.name || 'CENTRO EDUCATIVO';

    // Encabezado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(centerName.toUpperCase(), pageWidth / 2, 14, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DIRECTORIO DE CÓDIGOS DE ACCESO PARA DOCENTES', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Año Escolar: ${selectedYear || '2026-2027'}  |  Portal Oficial: https://www.edugest.net  |  Fecha: ${new Date().toLocaleDateString('es-DO')}`, pageWidth / 2, 25, { align: 'center' });

    const tableData = teachersWithCodes.map((t, idx) => [
      idx + 1,
      t.displayName.toUpperCase(),
      t.generatedCode,
      t.coursesSummary || 'Sin asignar',
      t.isRegistered ? 'VINCULADO' : 'PENDIENTE'
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['#', 'DOCENTE', 'CÓDIGO DE INVITACIÓN', 'CURSOS ASIGNADOS', 'ESTADO']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 64, 175],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { cellWidth: 55, fontStyle: 'bold' },
        2: { cellWidth: 50, halign: 'center', fontStyle: 'bold', textColor: [30, 64, 175] },
        3: { cellWidth: 55 },
        4: { halign: 'center', cellWidth: 20 }
      }
    });

    doc.save(`Codigos_Docentes_${centerInitials}_${yearSuffix}.pdf`);
    toast.success('Documento PDF descargado.');
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
          onClick={() => setActiveTab('teachers')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'teachers' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'}`}
        >
          <GraduationCap size={16} /> Docentes (Generación Masiva)
        </button>
        <button
          onClick={() => setActiveTab('admin')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'admin' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'}`}
        >
          <KeyRound size={16} /> Personal Individual / Apoyo
        </button>
        <button
          onClick={() => setActiveTab('courses')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'courses' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'}`}
        >
          <Users size={16} /> Alumnos y Padres (Por Curso)
        </button>
      </div>

      {/* 1. PESTAÑA DOCENTES: GENERACIÓN MASIVA Y CONTROL DE ACCESO */}
      {activeTab === 'teachers' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Tarjeta Superior: Configuración de Permisos y Formato */}
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase text-slate-800 tracking-tight flex items-center gap-2">
                    Generador Masivo de Códigos Docentes
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-full uppercase">
                      {teachersWithCodes.length} {staffScope === 'only_teachers' ? 'Docentes' : 'Colaboradores'}
                    </span>
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">
                    Configura los módulos autorizados y genera un código único para cada maestro de forma automática.
                  </p>
                </div>
              </div>

              {/* Botón Principal Generar Todo */}
              <button
                onClick={handleGenerateBulkTeacherCodes}
                disabled={isGeneratingBulk || teachersWithCodes.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:grayscale"
              >
                {isGeneratingBulk ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Generando Códigos...
                  </>
                ) : (
                  <>
                    <KeyRound size={16} /> Generar Códigos para {staffScope === 'only_teachers' ? 'Docentes' : 'Todos'} ({teachersWithCodes.length})
                  </>
                )}
              </button>
            </div>

            {/* Configuración de Formato y Permisos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Formato Inteligente */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 size={13} /> Patrón Oficial del Código
                  </span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md uppercase">
                    Automático
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col gap-1">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Formato Establecido:</span>
                  <code className="text-xs font-mono font-black text-indigo-600 tracking-wide">
                    {defaultPrefix}[NOMBRE]
                  </code>
                  <span className="text-[8px] text-slate-500 mt-1">
                    Ejemplo: <b>{defaultPrefix}CECILIAG</b>
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Prefijo:</span>
                  <input
                    type="text"
                    placeholder={centerInitials}
                    value={customCenterCode}
                    onChange={(e) => setCustomCenterCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                    className="w-20 bg-white border border-slate-300 px-2 py-1 rounded-lg text-xs font-mono font-black text-slate-800 uppercase outline-none focus:border-indigo-500"
                  />
                  <span className="text-[9px] text-slate-400 font-medium">Año: {yearSuffix} | Rol: DOC</span>
                </div>
              </div>

              {/* Módulos y Permisos Docentes */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders size={13} /> Permisos y Módulos Autorizados ({teacherPanels.length} Activos)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTeacherPanels(ROLE_DEFAULTS.teacher)}
                      className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded-lg uppercase"
                    >
                      Estándar Docente
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeacherPanels(AVAILABLE_PANELS.map((p) => p.id))}
                      className="text-[9px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 px-2 py-1 rounded-lg uppercase"
                    >
                      Marcar Todos
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                  {AVAILABLE_PANELS.map((p) => {
                    const isChecked = teacherPanels.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleToggleTeacherPanel(p.id)}
                        className={`flex items-start text-left p-2.5 rounded-xl border transition-all gap-2.5 ${isChecked ? 'bg-indigo-50/70 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'}`}
                      >
                        <div
                          className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'}`}
                        >
                          {isChecked && <Check size={10} strokeWidth={4} />}
                        </div>
                        <div className="min-w-0">
                          <div className={`text-[10px] font-bold uppercase truncate ${isChecked ? 'text-indigo-950' : 'text-slate-700'}`}>
                            {p.label}
                          </div>
                          <div className="text-[8px] text-slate-400 font-medium truncate">
                            {p.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Tarjeta Inferior: Tabla de Códigos Generados y Distribución */}
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm space-y-6">
            {/* Barra de Acciones, Filtro y Búsqueda */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                {/* Selector de Alcance */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setStaffScope('only_teachers')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                      staffScope === 'only_teachers'
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <GraduationCap size={14} /> Solo Docentes ({totalDocentesCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffScope('all_staff')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                      staffScope === 'all_staff'
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Users size={14} /> Todo el Personal ({totalStaffCount})
                  </button>
                </div>

                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar docente, cargo o código..."
                    value={teacherSearch}
                    onChange={(e) => setTeacherSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Botones de Exportación */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportPDF}
                  className="bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
                  title="Descargar PDF para imprimir"
                >
                  <Printer size={14} /> Descargar PDF
                </button>
                <button
                  onClick={handleExportExcel}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
                  title="Exportar archivo Excel"
                >
                  <FileSpreadsheet size={14} /> Exportar Excel
                </button>
                <button
                  onClick={handleCopyAllWhatsApp}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
                  title="Copiar lista para WhatsApp"
                >
                  <Copy size={14} /> Copiar Todos
                </button>
              </div>
            </div>

            {/* Aviso informativo de estado */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-600">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles size={14} />
              </div>
              <div className="space-y-0.5">
                <p className="font-bold text-slate-800">
                  ¿Cómo funciona la configuración de accesos?
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Los códigos que ves abajo son una <b>vista previa calculada</b> según el patrón oficial.
                  Para aplicar los permisos seleccionados arriba y guardarlos en la base de datos, pulsa el botón{' '}
                  <span className="text-indigo-600 font-bold">"Generar Códigos para {staffScope === 'only_teachers' ? 'Docentes' : 'Todos'}"</span>. Los códigos generados pasarán al estado <span className="text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">Activo en BD</span>.
                </p>
              </div>
            </div>

            {/* Tabla de Docentes y Códigos */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3.5 px-4 w-12 text-center">#</th>
                    <th className="py-3.5 px-4">Docente / Personal</th>
                    <th className="py-3.5 px-4">Cursos Asignados</th>
                    <th className="py-3.5 px-4 text-center">Código de Acceso</th>
                    <th className="py-3.5 px-4 text-center">Estado</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {filteredTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-bold uppercase text-[10px]">
                        No se encontraron registros con ese criterio de búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredTeachers.map((t, index) => (
                      <tr key={t.id || index} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 text-center font-bold text-slate-400 text-[11px]">
                          {index + 1}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-slate-800 uppercase">{t.displayName}</span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                t.isTeacherRole
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {t.positionLabel}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                            {t.email || t.phone || 'Sin correo registrado'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 text-[11px] max-w-xs">
                          <span className="line-clamp-2">{t.coursesSummary}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
                            <span className="font-mono font-black text-indigo-700 text-xs tracking-wider">
                              {t.generatedCode}
                            </span>
                            <button
                              onClick={() => handleCopy(t.generatedCode)}
                              className="p-1 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-100 rounded transition-colors"
                              title="Copiar Código"
                            >
                              {copiedCode === t.generatedCode ? (
                                <Check size={12} className="text-emerald-600" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              t.isRegistered
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : t.isCreatedInDb
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                  : 'bg-amber-50 text-amber-700 border border-dashed border-amber-300'
                            }`}
                          >
                            {t.isRegistered
                              ? 'Vinculado'
                              : t.isCreatedInDb
                                ? 'Activo en BD'
                                : 'Vista Previa'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleCopyWhatsApp(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold uppercase transition-colors"
                            title="Copiar mensaje personalizado para WhatsApp"
                          >
                            <Send size={11} /> WhatsApp
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. PESTAÑA PERSONAL INDIVIDUAL / APOYO */}
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
                  Configura códigos personalizados para coordinadores, administradores o personal de apoyo
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                  Código Personalizado
                </label>
                <input
                  type="text"
                  placeholder="Ej: COORD-GENESIS-2026"
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
                      <div
                        className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center transition-all ${isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'}`}
                      >
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
                  <UserPlus size={16} /> Generar Código con Permisos
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
                <h3 className="text-xs font-black uppercase text-slate-700 tracking-tighter">
                  Códigos Generados
                </h3>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                  Invitaciones activas del centro
                </p>
              </div>
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
                    className={`p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col space-y-3 relative group transition-all ${c.is_used ? 'opacity-60 bg-slate-50/50' : 'hover:border-indigo-100'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-indigo-600 tracking-wide uppercase">
                          {c.code}
                        </span>
                        <button
                          onClick={() => handleCopy(c.code)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
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
                        className={`px-2 py-0.5 text-[8px] font-black rounded-full uppercase tracking-wider ${c.is_used ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'}`}
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
        </div>
      )}

      {/* 3. PESTAÑA ALUMNOS Y PADRES (POR CURSO) */}
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
                    <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-black px-2 py-0.5 rounded-full uppercase">
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
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs uppercase shadow-inner">
                                {course.section}
                              </div>
                              <div>
                                <span className="text-xs font-black text-slate-800 uppercase leading-tight block">
                                  {course.grade}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                  Tanda: {course.tanda} | {course.studentCount || course.student_count || 0} Alum.
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Código de Acceso */}
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                              Código:
                            </span>

                            {isEditing ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={editCodeValue}
                                  onChange={(e) =>
                                    setEditCodeValue(
                                      e.target.value.toUpperCase().replace(/\s+/g, '')
                                    )
                                  }
                                  className="bg-white border border-indigo-400 rounded-lg px-2 py-1 font-mono font-black text-xs text-indigo-700 outline-none w-28 uppercase text-center"
                                  placeholder="CÓDIGO"
                                  autoFocus
                                />
                                <button
                                  onClick={() => {
                                    const cleanGrade = course.grade
                                      .trim()
                                      .replace(/[^a-zA-Z0-9]/g, '');
                                    setEditCodeValue(
                                      `${cleanGrade}-${course.section.trim()}`.toUpperCase()
                                    );
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
                                  <code className="font-mono text-xs text-indigo-600 font-black tracking-wide bg-indigo-50/70 px-2 py-0.5 rounded border border-indigo-100">
                                    {course.code}
                                  </code>
                                ) : (
                                  <span className="text-[8px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 uppercase tracking-widest">
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
                                  <Pencil size={12} />
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
  );
};
