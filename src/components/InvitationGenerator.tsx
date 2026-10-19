import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  createInvitationCode,
  getActiveInvitationCodes,
  deleteInvitationCode,
  createBulkTeacherInvitationCodes
} from '../services/userService';
import { useApp } from '../context/AppContext';
import { useCourses } from '../hooks/useCourses';
import * as XLSX from 'xlsx';
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
  BookOpen,
  Download,
  FileSpreadsheet,
  Printer,
  Sparkles,
  X,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  School,
  AlertCircle
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
  const [activeTab, setActiveTab] = useState<'admin' | 'courses'>('courses');

  // Estados para invitaciones individuales (Docentes y Administrativos)
  const [code, setCode] = useState('');
  const [selectedRole, setSelectedRole] = useState(role || 'teacher');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedPanels, setSelectedPanels] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isBulkGeneratingTeachers, setIsBulkGeneratingTeachers] = useState(false);
  const [isBulkAssigningCourseCodes, setIsBulkAssigningCourseCodes] = useState(false);
  const [activeCodes, setActiveCodes] = useState<any[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Estados para códigos de cursos
  const { courses: allCourses, updateCourse } = useCourses();
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editCodeValue, setEditCodeValue] = useState('');

  // Modal para Fichas Imprimibles
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printModalTab, setPrintModalTab] = useState<'courses' | 'teachers'>('courses');

  // Inicializar iniciales del centro y año
  const centerInitials = useMemo(() => {
    const rawName = center?.name || profile?.center_name || 'EDU';
    const stopWords = new Set([
      'de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'para', 'por', 'a',
      'san', 'santa', 'colegio', 'escuela', 'instituto', 'liceo', 'centro', 'educativo'
    ]);
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

  // Métricas de estado
  const teachersWithCodeCount = useMemo(() => {
    return sortedTeachers.filter((t: any) => {
      const slug = getTeacherSlug(t.name || t.full_name || '');
      return activeCodes.some(
        (c: any) =>
          c.teacher_id === t.id ||
          (c.role === 'teacher' && c.code && c.code.endsWith(slug))
      );
    }).length;
  }, [sortedTeachers, activeCodes]);

  const coursesWithCodeCount = useMemo(() => {
    return allCourses.filter((c: any) => c.code && c.code.trim()).length;
  }, [allCourses]);

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

  const handleSaveCourseCode = async (targetCourseId: string) => {
    try {
      const trimmedCode = editCodeValue.trim().toUpperCase().replace(/\s+/g, '');
      await updateCourse({
        id: targetCourseId,
        updates: { code: trimmedCode || null }
      });
      toast.success('Código de acceso actualizado');
      setEditingCourseId(null);
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar el código');
    }
  };

  // 1. AUTO-GENERAR CÓDIGOS PARA CURSOS QUE NO TIENEN
  const handleBulkAssignCourseCodes = async () => {
    const missing = allCourses.filter((c: any) => !c.code || !c.code.trim());
    if (missing.length === 0) {
      toast('Todos los cursos ya cuentan con un código de acceso asignado.', { icon: 'ℹ️' });
      return;
    }

    setIsBulkAssigningCourseCodes(true);
    try {
      let assigned = 0;
      const existingCodes = new Set(
        allCourses
          .map((c: any) => (c.code || '').trim().toUpperCase())
          .filter(Boolean)
      );

      for (const c of missing) {
        const rawGrade = (c.grade || '').trim();
        let cleanGrade = rawGrade.replace(/[^0-9]/g, '');
        if (!cleanGrade) {
          const lower = rawGrade.toLowerCase();
          if (lower.includes('pre-prim') || lower.includes('preprim')) cleanGrade = 'PP';
          else if (lower.includes('kind') || lower.includes('kínd')) cleanGrade = 'KIN';
          else if (lower.includes('parv') || lower.includes('párv')) cleanGrade = 'PAR';
          else if (lower.includes('mat')) cleanGrade = 'MAT';
          else cleanGrade = rawGrade.substring(0, 3).toUpperCase();
        }

        const cleanSec = (c.section || 'A').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        let candidate = `${centerInitials}-${cleanGrade}${cleanSec}`;

        if (existingCodes.has(candidate)) {
          const lvl = (c.level || '').toLowerCase();
          const lvlPrefix = lvl.includes('sec') ? 'S' : lvl.includes('prim') ? 'P' : 'I';
          candidate = `${centerInitials}-${lvlPrefix}${cleanGrade}${cleanSec}`;
        }

        existingCodes.add(candidate);
        await updateCourse({
          id: c.id,
          updates: { code: candidate }
        });
        assigned++;
      }

      toast.success(`¡Listo! Se asignaron códigos a ${assigned} cursos exitosamente.`);
    } catch (error) {
      console.error('Error auto-generating course codes:', error);
      toast.error('Ocurrió un error al asignar los códigos de curso.');
    } finally {
      setIsBulkAssigningCourseCodes(false);
    }
  };

  // 2. GENERAR CÓDIGOS PARA TODOS LOS DOCENTES FALTANTES EN 1 CLIC
  const handleBulkGenerateTeacherCodes = async () => {
    const cId = center?.id || profile?.center_id;
    if (!cId) {
      toast.error('No se detectó el identificador del centro educativo.');
      return;
    }

    const missingTeachers = sortedTeachers.filter((t: any) => {
      const slug = getTeacherSlug(t.name || t.full_name || '');
      return !activeCodes.some(
        (c: any) =>
          c.teacher_id === t.id ||
          (c.role === 'teacher' && c.code && c.code.endsWith(slug))
      );
    });

    if (missingTeachers.length === 0) {
      toast('Todos los docentes ya cuentan con un código de invitación activo.', { icon: 'ℹ️' });
      return;
    }

    setIsBulkGeneratingTeachers(true);
    try {
      const existingCodeStrings = new Set(activeCodes.map((c) => (c.code || '').toUpperCase()));
      const recordsToCreate: any[] = [];

      for (const t of missingTeachers) {
        const tName = t.name || t.full_name || 'DOC';
        const baseSlug = getTeacherSlug(tName);
        let finalCode = `${defaultPrefix}${baseSlug}`;
        let counter = 2;
        while (existingCodeStrings.has(finalCode)) {
          finalCode = `${defaultPrefix}${baseSlug}${counter}`;
          counter++;
        }
        existingCodeStrings.add(finalCode);

        recordsToCreate.push({
          code: finalCode,
          role: 'teacher',
          center_id: cId,
          allowed_panels: ROLE_DEFAULTS.teacher || ['dashboard', 'classroom', 'digital-register', 'tasks'],
          teacher_id: t.id
        });
      }

      await createBulkTeacherInvitationCodes(recordsToCreate);
      toast.success(`¡Éxito! Se generaron ${recordsToCreate.length} códigos de invitación para docentes.`);
      await loadCodes();
    } catch (error) {
      console.error('Error generating bulk teacher codes:', error);
      toast.error('Error al generar los códigos de docentes.');
    } finally {
      setIsBulkGeneratingTeachers(false);
    }
  };

  // 3. DESCARGAR CÓDIGOS DE CURSOS EN EXCEL (1 CLIC)
  const handleDownloadCourseCodesExcel = () => {
    if (allCourses.length === 0) {
      toast.error('No hay cursos registrados para exportar.');
      return;
    }

    const sortedCourses = [...allCourses].sort((a: any, b: any) => {
      const lvlDiff = (a.level || '').localeCompare(b.level || '');
      if (lvlDiff !== 0) return lvlDiff;
      const gradeDiff = (a.grade || '').localeCompare(b.grade || '', undefined, { numeric: true });
      if (gradeDiff !== 0) return gradeDiff;
      return (a.section || '').localeCompare(b.section || '');
    });

    const courseRows = sortedCourses.map((c: any) => ({
      'Nivel Educativo': c.level || 'No especificado',
      'Grado': c.grade || '',
      'Sección': c.section || '',
      'Tanda / Jornada': c.tanda || 'Jornada Regular',
      'Código de Acceso': c.code || 'SIN CÓDIGO',
      'Destinatarios': 'Alumnos y Familias (Padres / Tutores)',
      'Tipo de Código': 'Permanente para todo el curso',
      'Instrucciones de Registro':
        '1. Entrar a www.edugest.net -> 2. Clic en "Registrarse" -> 3. Seleccionar "Alumno" o "Padre" -> 4. Ingresar este código de acceso.'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(courseRows);
    ws['!cols'] = [
      { wch: 18 },
      { wch: 12 },
      { wch: 10 },
      { wch: 22 },
      { wch: 20 },
      { wch: 38 },
      { wch: 32 },
      { wch: 70 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Códigos de Cursos');
    XLSX.writeFile(wb, `Codigos_Cursos_${centerInitials}_${selectedYear}.xlsx`);
    toast.success('Listado de códigos de cursos descargado en Excel.');
  };

  // 4. DESCARGAR CÓDIGOS DE DOCENTES EN EXCEL (1 CLIC)
  const handleDownloadTeacherCodesExcel = () => {
    if (sortedTeachers.length === 0) {
      toast.error('No hay docentes registrados para exportar.');
      return;
    }

    const teacherRows = sortedTeachers.map((t: any) => {
      const tSlug = getTeacherSlug(t.name || t.full_name || '');
      const teacherCodeObj = activeCodes.find(
        (c: any) =>
          c.teacher_id === t.id ||
          (c.role === 'teacher' && c.code && c.code.endsWith(tSlug))
      );

      const tAssignments = (state.assignments || []).filter(
        (a: any) => (a.teacher_id || a.teacherId) === t.id
      );

      const uniqueSubjects = Array.from(
        new Set(
          tAssignments
            .map((a: any) => {
              const sObj = (state.subjects || []).find(
                (s: any) => s.id === (a.subject_id || a.subjectId)
              );
              return sObj?.name || a.subject_name;
            })
            .filter(Boolean)
        )
      ).join(', ');

      const uniqueCourseNames = Array.from(
        new Set(
          tAssignments
            .map((a: any) => {
              const cObj = allCourses.find((c: any) => c.id === (a.course_id || a.courseId));
              return cObj ? `${cObj.grade} "${cObj.section}"` : null;
            })
            .filter(Boolean)
        )
      ).join(', ');

      return {
        'Docente': t.name || t.full_name || 'Sin nombre',
        'Área / Especialidad': t.area || t.specialty || 'General',
        'Asignaturas que Imparte': uniqueSubjects || 'Sin asignaturas asignadas',
        'Cursos Asignados': uniqueCourseNames || 'Sin cursos asignados',
        'Código de Acceso': teacherCodeObj ? teacherCodeObj.code : 'PENDIENTE DE GENERAR',
        'Estado del Código': teacherCodeObj
          ? teacherCodeObj.is_used
            ? 'Ya Registrado (Usado)'
            : 'Disponible (Sin usar)'
          : 'Sin Código',
        'Fecha Creación': teacherCodeObj?.created_at
          ? new Date(teacherCodeObj.created_at).toLocaleDateString('es-DO')
          : '-',
        'Instrucciones de Acceso':
          '1. Entrar a www.edugest.net -> 2. Clic en "Registrarse" -> 3. Seleccionar "Docente" -> 4. Ingresar este código de acceso.'
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(teacherRows);
    ws['!cols'] = [
      { wch: 30 },
      { wch: 22 },
      { wch: 35 },
      { wch: 25 },
      { wch: 25 },
      { wch: 22 },
      { wch: 16 },
      { wch: 70 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Códigos de Docentes');
    XLSX.writeFile(wb, `Codigos_Docentes_${centerInitials}_${selectedYear}.xlsx`);
    toast.success('Listado de códigos de docentes descargado en Excel.');
  };

  // 5. DESCARGAR TODOS LOS CÓDIGOS (CURSOS + DOCENTES + PERSONAL) EN 1 CLIC
  const handleDownloadMasterCodesExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Cursos
    const sortedCourses = [...allCourses].sort((a: any, b: any) => {
      const lvlDiff = (a.level || '').localeCompare(b.level || '');
      if (lvlDiff !== 0) return lvlDiff;
      const gradeDiff = (a.grade || '').localeCompare(b.grade || '', undefined, { numeric: true });
      if (gradeDiff !== 0) return gradeDiff;
      return (a.section || '').localeCompare(b.section || '');
    });

    const courseRows = sortedCourses.map((c: any) => ({
      'Nivel Educativo': c.level || 'No especificado',
      'Grado': c.grade || '',
      'Sección': c.section || '',
      'Tanda / Jornada': c.tanda || 'Jornada Regular',
      'Código de Acceso': c.code || 'SIN CÓDIGO',
      'Destinatarios': 'Alumnos y Familias (Padres / Tutores)',
      'Uso': 'Código permanente para todo el curso',
      'Instrucciones': 'Entrar a www.edugest.net -> Registrarse -> Ingresar código'
    }));
    const wsCourses = XLSX.utils.json_to_sheet(courseRows);
    wsCourses['!cols'] = [
      { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 20 }, { wch: 38 }, { wch: 32 }, { wch: 55 }
    ];
    XLSX.utils.book_append_sheet(wb, wsCourses, 'Codigos_Cursos_Familias');

    // 2. Docentes
    const teacherRows = sortedTeachers.map((t: any) => {
      const tSlug = getTeacherSlug(t.name || t.full_name || '');
      const teacherCodeObj = activeCodes.find(
        (c: any) =>
          c.teacher_id === t.id ||
          (c.role === 'teacher' && c.code && c.code.endsWith(tSlug))
      );
      const tAssignments = (state.assignments || []).filter(
        (a: any) => (a.teacher_id || a.teacherId) === t.id
      );
      const uniqueSubjects = Array.from(
        new Set(
          tAssignments
            .map((a: any) => {
              const sObj = (state.subjects || []).find((s: any) => s.id === (a.subject_id || a.subjectId));
              return sObj?.name || a.subject_name;
            })
            .filter(Boolean)
        )
      ).join(', ');
      const uniqueCourseNames = Array.from(
        new Set(
          tAssignments
            .map((a: any) => {
              const cObj = allCourses.find((c: any) => c.id === (a.course_id || a.courseId));
              return cObj ? `${cObj.grade} "${cObj.section}"` : null;
            })
            .filter(Boolean)
        )
      ).join(', ');

      return {
        'Docente': t.name || t.full_name || 'Sin nombre',
        'Área': t.area || t.specialty || 'General',
        'Asignaturas': uniqueSubjects || 'Sin asignaturas',
        'Cursos': uniqueCourseNames || 'Sin cursos',
        'Código de Acceso': teacherCodeObj ? teacherCodeObj.code : 'PENDIENTE',
        'Estado': teacherCodeObj ? (teacherCodeObj.is_used ? 'Ya Registrado' : 'Disponible') : 'Sin Código'
      };
    });
    const wsTeachers = XLSX.utils.json_to_sheet(teacherRows);
    wsTeachers['!cols'] = [
      { wch: 28 }, { wch: 20 }, { wch: 32 }, { wch: 22 }, { wch: 24 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, wsTeachers, 'Codigos_Docentes');

    // 3. Personal Administrativo y Otros
    const otherCodes = activeCodes.filter((c: any) => c.role !== 'teacher');
    if (otherCodes.length > 0) {
      const adminRows = otherCodes.map((c: any) => ({
        'Código': c.code,
        'Rol Asignado': c.role,
        'Estado': c.is_used ? 'Ya Utilizado' : 'Disponible',
        'Fecha de Creación': new Date(c.created_at).toLocaleDateString('es-DO'),
        'Paneles Permitidos': (c.allowed_panels || []).join(', ')
      }));
      const wsAdmin = XLSX.utils.json_to_sheet(adminRows);
      wsAdmin['!cols'] = [
        { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 45 }
      ];
      XLSX.utils.book_append_sheet(wb, wsAdmin, 'Personal_Administrativo');
    }

    // 4. Guía
    const guideRows = [
      {
        'Tipo de Usuario': 'Alumnos',
        'Cómo se Asigna': '1 Código por Curso (Permanente)',
        'Ejemplo de Código': `${centerInitials}-1E`,
        'Pasos para Ingresar': '1. Entrar a www.edugest.net -> 2. Clic en Registrarse -> 3. Seleccionar Alumno -> 4. Ingresar código de su curso.'
      },
      {
        'Tipo de Usuario': 'Padres / Tutores',
        'Cómo se Asigna': 'Mismo Código del Curso del hijo',
        'Ejemplo de Código': `${centerInitials}-1E`,
        'Pasos para Ingresar': '1. Entrar a www.edugest.net -> 2. Clic en Registrarse -> 3. Seleccionar Padre/Madre -> 4. Ingresar código del curso de su hijo.'
      },
      {
        'Tipo de Usuario': 'Docentes',
        'Cómo se Asigna': 'Código individual por profesor',
        'Ejemplo de Código': `${defaultPrefix}NOMBREP`,
        'Pasos para Ingresar': '1. Entrar a www.edugest.net -> 2. Clic en Registrarse -> 3. Seleccionar Docente -> 4. Ingresar su código personal.'
      }
    ];
    const wsGuide = XLSX.utils.json_to_sheet(guideRows);
    wsGuide['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 24 }, { wch: 75 }];
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Guia_de_Acceso');

    XLSX.writeFile(wb, `Codigos_Acceso_Completos_${centerInitials}_${selectedYear}.xlsx`);
    toast.success('Reporte maestro de códigos descargado en Excel.');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Barra Superior con Acciones Maestras de Descarga */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-850 to-slate-900 text-white p-6 sm:p-8 rounded-[2.5rem] shadow-xl border border-indigo-700/30 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-indigo-400" />
              Gestión de Accesos e Invitaciones
            </span>
            <span className="text-slate-400 text-xs font-bold font-mono">
              Centro: {centerInitials} • {selectedYear || '2026'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2.5">
            Códigos de Acceso al Centro
          </h2>
          <p className="text-xs text-indigo-200/80 font-medium leading-relaxed">
            Descarga en un clic los códigos de cursos para familias y alumnos, y genera los accesos directos de todos los docentes vinculados a su horario.
          </p>
        </div>

        {/* Botones de Acción Global */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <button
            onClick={handleDownloadMasterCodesExcel}
            className="flex-1 sm:flex-initial bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider px-5 py-3.5 rounded-2xl shadow-lg shadow-emerald-900/40 hover:shadow-emerald-900/60 transition-all flex items-center justify-center gap-2 cursor-pointer"
            title="Descarga un Excel completo con Cursos, Docentes, Personal y Guía"
          >
            <Download size={16} />
            Descargar Todos en Excel
          </button>

          <button
            onClick={() => {
              setPrintModalTab(activeTab === 'courses' ? 'courses' : 'teachers');
              setShowPrintModal(true);
            }}
            className="flex-1 sm:flex-initial bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-wider px-5 py-3.5 rounded-2xl border border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer backdrop-blur-sm"
          >
            <Printer size={16} />
            Fichas Imprimibles
          </button>
        </div>
      </div>

      {/* Selector de Pestañas Principales y Resúmenes */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit border border-slate-200 shadow-inner">
          <button
            onClick={() => setActiveTab('courses')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'courses'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Users size={16} /> Códigos de Cursos (Alumnos y Padres)
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === 'courses' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {coursesWithCodeCount}/{allCourses.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <KeyRound size={16} /> Códigos de Docentes y Personal
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === 'admin' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {teachersWithCodeCount}/{sortedTeachers.length}
            </span>
          </button>
        </div>

        {/* Resumen de Estado */}
        <div className="text-right text-xs font-bold text-slate-500 hidden sm:block">
          {activeTab === 'courses' ? (
            <span>
              {allCourses.length - coursesWithCodeCount > 0 ? (
                <span className="text-amber-600 flex items-center gap-1.5 justify-end">
                  <AlertCircle size={14} /> {allCourses.length - coursesWithCodeCount} cursos sin código
                </span>
              ) : (
                <span className="text-emerald-600 flex items-center gap-1.5 justify-end">
                  <CheckCircle2 size={14} /> Todos los cursos tienen código
                </span>
              )}
            </span>
          ) : (
            <span>
              {sortedTeachers.length - teachersWithCodeCount > 0 ? (
                <span className="text-amber-600 flex items-center gap-1.5 justify-end">
                  <AlertCircle size={14} /> {sortedTeachers.length - teachersWithCodeCount} docentes sin código generado
                </span>
              ) : (
                <span className="text-emerald-600 flex items-center gap-1.5 justify-end">
                  <CheckCircle2 size={14} /> Todos los docentes tienen código
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* 1. PESTAÑA ALUMNOS Y PADRES (POR CURSO) */}
      {activeTab === 'courses' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Banner de Acciones y Guía */}
          <div className="bg-amber-50 border border-amber-200/80 p-5 rounded-[2rem] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase text-amber-950 flex items-center gap-2">
                <HelpCircle size={16} className="text-amber-600 shrink-0" />
                ¿Cómo funcionan los Códigos de Curso?
              </h4>
              <p className="text-[11px] text-amber-900 font-semibold leading-relaxed">
                Los alumnos y padres <strong>no necesitan códigos individuales</strong>. Se asigna un código permanente por sección (ej: <code className="bg-amber-200/70 px-1.5 py-0.5 rounded font-mono font-black">{centerInitials}-1E</code>) que sirve para todas las familias y estudiantes del aula.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto">
              {allCourses.some((c: any) => !c.code || !c.code.trim()) && (
                <button
                  onClick={handleBulkAssignCourseCodes}
                  disabled={isBulkAssigningCourseCodes}
                  className="flex-1 md:flex-initial bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  title="Asigna automáticamente códigos limpios a los cursos que no tienen"
                >
                  <Sparkles size={14} />
                  {isBulkAssigningCourseCodes ? 'Asignando...' : 'Asignar Códigos Faltantes'}
                </button>
              )}

              <button
                onClick={handleDownloadCourseCodesExcel}
                className="flex-1 md:flex-initial bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Download size={14} /> Descargar Cursos en Excel
              </button>
            </div>
          </div>

          {/* Grilla de Cursos por Nivel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(() => {
              const standardLevels = ['Inicial', 'Primario', 'Secundario'];
              const customLevels = Array.from(
                new Set(
                  allCourses.map((c: any) => {
                    const l = (c.level || '').trim();
                    if (!l) return 'General';
                    const lower = l.toLowerCase();
                    if (
                      lower.includes('inic') ||
                      lower.includes('matern') ||
                      lower.includes('parv') ||
                      lower.includes('kind') ||
                      lower.includes('preprim')
                    )
                      return 'Inicial';
                    if (lower.includes('prim')) return 'Primario';
                    if (lower.includes('secun')) return 'Secundario';
                    return l;
                  })
                )
              );
              const allUniqueLevels = Array.from(new Set([...standardLevels, ...customLevels]));

              return allUniqueLevels.map((lvl) => {
                const levelCourses = allCourses.filter((c: any) => {
                  const cLvl = (c.level || '').trim();
                  if (cLvl === lvl) return true;
                  const cLower = cLvl.toLowerCase();
                  if (
                    lvl === 'Inicial' &&
                    (cLower.includes('inic') ||
                      cLower.includes('matern') ||
                      cLower.includes('parv') ||
                      cLower.includes('kind') ||
                      cLower.includes('preprim'))
                  )
                    return true;
                  if (lvl === 'Primario' && (cLower.includes('prim') || cLower.includes('basic')))
                    return true;
                  if (lvl === 'Secundario' && (cLower.includes('secun') || cLower.includes('medio')))
                    return true;
                  return false;
                });
                if (levelCourses.length === 0) return null;

                return (
                  <div
                    key={lvl}
                    className="bg-white rounded-[2rem] border border-slate-200/80 overflow-hidden shadow-sm flex flex-col animate-in fade-in duration-200"
                  >
                    {/* Cabecera del Nivel */}
                    <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <School size={15} className="text-indigo-600" />
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
                                  placeholder="Ej: DEC-1E"
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
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono font-black text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                      {c.code}
                                    </span>
                                    <button
                                      onClick={() => handleCopy(c.code)}
                                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                      title="Copiar código"
                                    >
                                      {copiedCode === c.code ? (
                                        <Check size={12} className="text-emerald-500" />
                                      ) : (
                                        <Copy size={12} />
                                      )}
                                    </button>
                                  </div>
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
              });
            })()}
          </div>
        </div>
      )}

      {/* 2. PESTAÑA CÓDIGOS INDIVIDUALES (DOCENTES Y PERSONAL) */}
      {activeTab === 'admin' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Banner de Generación Rápida de Docentes */}
          <div className="bg-gradient-to-r from-indigo-50 via-white to-indigo-50/50 border border-indigo-100 p-5 rounded-[2rem] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase text-indigo-950 flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-600 shrink-0" />
                Generación Masiva de Accesos para Docentes
              </h4>
              <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                {teachersWithCodeCount} de {sortedTeachers.length} docentes ya tienen código generado.
                {sortedTeachers.length - teachersWithCodeCount > 0
                  ? ` Hay ${sortedTeachers.length - teachersWithCodeCount} docentes pendientes de código.`
                  : ' Todos tus docentes ya tienen código activo.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto">
              {sortedTeachers.length - teachersWithCodeCount > 0 && (
                <button
                  onClick={handleBulkGenerateTeacherCodes}
                  disabled={isBulkGeneratingTeachers}
                  className="flex-1 md:flex-initial bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  title="Genera automáticamente códigos para todos los docentes faltantes"
                >
                  <Sparkles size={14} />
                  {isBulkGeneratingTeachers ? 'Generando...' : 'Generar Códigos Faltantes (1 Clic)'}
                </button>
              )}

              <button
                onClick={handleDownloadTeacherCodesExcel}
                className="flex-1 md:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Download size={14} /> Descargar Docentes en Excel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Columna Izquierda: Generador Individual Manual */}
            <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase text-slate-800 tracking-tighter">
                    Generador Manual de Invitación Individual
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                    Genera o personaliza invitaciones específicas vinculadas con un docente o rol administrativo
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
                        className="text-[9px] font-bold text-rose-600 hover:text-rose-800 uppercase cursor-pointer"
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
                      const hasActiveCode = activeCodes.some(
                        (c: any) =>
                          c.teacher_id === t.id ||
                          (c.role === 'teacher' && c.code && c.code.endsWith(getTeacherSlug(t.name || t.full_name || '')))
                      );
                      return (
                        <option key={t.id} value={t.id}>
                          {t.name || t.full_name} ({tAssignments.length} asignaciones) {hasActiveCode ? '✓ [Código Existente]' : '⚡ [Sin Código]'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Paneles Permitidos */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">
                  Módulos y Permisos Habilitados para este Rol
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1 custom-scrollbar">
                  {AVAILABLE_PANELS.map((p) => {
                    const isChecked = selectedPanels.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleTogglePanel(p.id)}
                        className={`flex items-start text-left p-3 rounded-2xl border-2 transition-all gap-3 cursor-pointer ${
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
                      Códigos Activos ({activeCodes.length})
                    </h3>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                      Invitaciones creadas del centro
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
        </div>
      )}

      {/* MODAL DE FICHAS IMPRIMIBLES */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Cabecera del Modal (No se imprime) */}
            <div className="no-print p-6 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                  <Printer size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase text-slate-800">
                    Fichas Imprimibles de Acceso
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Formato de credenciales listas para recortar y distribuir
                  </p>
                </div>
              </div>

              {/* Selector de Tipo de Ficha */}
              <div className="flex items-center gap-2 bg-slate-200/80 p-1 rounded-xl">
                <button
                  onClick={() => setPrintModalTab('courses')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                    printModalTab === 'courses' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Cursos ({allCourses.length})
                </button>
                <button
                  onClick={() => setPrintModalTab('teachers')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                    printModalTab === 'teachers' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Docentes ({sortedTeachers.length})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md cursor-pointer transition-all"
                >
                  <Printer size={15} /> Imprimir Fichas
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Contenido Imprimible */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100/60 custom-scrollbar">
              <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                  body * {
                    visibility: hidden;
                  }
                  #printable-access-cards, #printable-access-cards * {
                    visibility: visible;
                  }
                  #printable-access-cards {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    margin: 0;
                    padding: 0;
                    background: white !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                }
              `}} />

              <div id="printable-access-cards" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {printModalTab === 'courses' ? (
                  allCourses.map((c: any) => (
                    <div
                      key={c.id}
                      className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-sm break-inside-avoid"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                            {center?.name || profile?.center_name || 'CENTRO EDUCATIVO'}
                          </div>
                          <div className="text-[8px] font-bold text-slate-400 uppercase">
                            Acceso Familiar y Estudiantil • EduGest
                          </div>
                        </div>
                        <span className="text-[9px] font-mono font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                          {c.level || 'Curso'}
                        </span>
                      </div>

                      <div className="text-center py-1">
                        <div className="text-xs font-bold text-slate-500 uppercase">
                          Curso y Sección
                        </div>
                        <div className="text-lg font-black text-slate-900 uppercase">
                          {c.grade} "{c.section}"
                        </div>
                        <div className="text-[9px] font-medium text-slate-400">
                          Tanda: {c.tanda || 'Jornada Regular'}
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                          Código de Acceso
                        </div>
                        <div className="font-mono font-black text-lg text-indigo-600 tracking-wider">
                          {c.code || 'SIN CÓDIGO'}
                        </div>
                      </div>

                      <div className="text-[8px] text-slate-500 space-y-0.5 border-t border-slate-100 pt-2 leading-tight">
                        <p className="font-bold text-slate-700">Cómo ingresar:</p>
                        <p>1. Entra a <strong className="text-indigo-600">www.edugest.net</strong></p>
                        <p>2. Haz clic en "Registrarse" y selecciona Alumno o Padre.</p>
                        <p>3. Pega este código para vincularte de inmediato.</p>
                      </div>
                    </div>
                  ))
                ) : (
                  sortedTeachers.map((t: any) => {
                    const slug = getTeacherSlug(t.name || t.full_name || '');
                    const tCode = activeCodes.find(
                      (c: any) =>
                        c.teacher_id === t.id ||
                        (c.role === 'teacher' && c.code && c.code.endsWith(slug))
                    );

                    return (
                      <div
                        key={t.id}
                        className="bg-white border-2 border-dashed border-indigo-200 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-sm break-inside-avoid"
                      >
                        <div className="flex items-center justify-between border-b border-indigo-50 pb-2">
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                              {center?.name || profile?.center_name || 'CENTRO EDUCATIVO'}
                            </div>
                            <div className="text-[8px] font-bold text-slate-400 uppercase">
                              Credencial de Acceso Docente
                            </div>
                          </div>
                          <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded uppercase">
                            Docente
                          </span>
                        </div>

                        <div className="text-center py-1">
                          <div className="text-xs font-bold text-slate-500 uppercase">
                            Profesor / Docente
                          </div>
                          <div className="text-base font-black text-slate-900 uppercase">
                            {t.name || t.full_name}
                          </div>
                          <div className="text-[9px] font-medium text-slate-400">
                            Área: {t.area || t.specialty || 'General'}
                          </div>
                        </div>

                        <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-2.5 text-center">
                          <div className="text-[8px] font-black uppercase tracking-widest text-indigo-400">
                            Código Personal de Docente
                          </div>
                          <div className="font-mono font-black text-base text-indigo-700 tracking-wider">
                            {tCode ? tCode.code : 'PENDIENTE'}
                          </div>
                        </div>

                        <div className="text-[8px] text-slate-500 space-y-0.5 border-t border-slate-100 pt-2 leading-tight">
                          <p className="font-bold text-slate-700">Instrucciones:</p>
                          <p>1. Entra a <strong className="text-indigo-600">www.edugest.net</strong></p>
                          <p>2. Clic en "Registrarse" y selecciona "Docente".</p>
                          <p>3. Ingresa tu código para cargar tus aulas y horarios.</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
