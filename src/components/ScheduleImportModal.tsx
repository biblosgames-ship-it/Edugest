import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  Loader2,
  BookOpen,
  Users,
  Clock,
  Layers,
  ArrowRight,
  Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { getStandardExtendedDaySlots } from '../services/scheduleService';
import { areTeacherNamesMatching } from '../utils/teacherUtils';
import { sortCourses } from '../utils/courseSorter';

interface ScheduleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeShift: 'Matutina' | 'Vespertina';
  schoolYear: string;
  state: any;
  profile: any;
  refreshData: (centerId?: string, force?: boolean) => Promise<void>;
  initialCourseId?: string;
}

export const ScheduleImportModal: React.FC<ScheduleImportModalProps> = ({
  isOpen,
  onClose,
  activeShift,
  schoolYear,
  state,
  profile,
  refreshData,
  initialCourseId
}) => {
  // Modo de alcance: Un grado/curso específico o Toda la tanda del centro
  const [importScope, setImportScope] = useState<'all' | 'single'>(() => {
    return initialCourseId ? 'single' : 'all';
  });

  const sortedCenterCourses = useMemo(() => {
    return sortCourses(state.courses || []);
  }, [state.courses]);

  const [targetCourseId, setTargetCourseId] = useState<string>(() => {
    if (initialCourseId) return initialCourseId;
    return (state.courses || [])[0]?.id || '';
  });

  // Sincronizar si cambia initialCourseId al abrir el modal
  useEffect(() => {
    if (initialCourseId) {
      setImportScope('single');
      setTargetCourseId(initialCourseId);
    }
  }, [initialCourseId, isOpen]);

  const selectedTargetCourse = useMemo(() => {
    return (state.courses || []).find((c: any) => c.id === targetCourseId);
  }, [state.courses, targetCourseId]);

  const [selectedShift, setSelectedShift] = useState<'Matutina' | 'Vespertina' | 'Extendida'>(() => {
    if (selectedTargetCourse?.tanda) {
      const t = selectedTargetCourse.tanda.toLowerCase();
      if (t.includes('ext') || t.includes('jor')) return 'Extendida';
      if (t.includes('ves') || t.includes('tar')) return 'Vespertina';
      return 'Matutina';
    }
    const hasExt = (state.courses || []).some((c: any) => {
      const t = (c.tanda || '').toLowerCase();
      return t.includes('ext') || t.includes('jor');
    });
    return hasExt ? 'Extendida' : activeShift;
  });

  // Sincronizar automáticamente la tanda si se selecciona un curso específico con tanda asignada
  useEffect(() => {
    if (importScope === 'single' && selectedTargetCourse?.tanda) {
      const t = selectedTargetCourse.tanda.toLowerCase();
      if (t.includes('ext') || t.includes('jor')) setSelectedShift('Extendida');
      else if (t.includes('ves') || t.includes('tar')) setSelectedShift('Vespertina');
      else setSelectedShift('Matutina');
    }
  }, [importScope, selectedTargetCourse]);

  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedEntries, setParsedEntries] = useState<any[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [previewTab, setPreviewTab] = useState<'summary' | 'details' | 'reference'>('summary');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');

  const centerId = profile?.center_id || state.courses?.[0]?.center_id;
  const backupKey =
    importScope === 'single' && targetCourseId
      ? `edugens_schedule_backup_${centerId}_course_${targetCourseId}_${schoolYear || '2026-2027'}`
      : `edugens_schedule_backup_${centerId}_${schoolYear || '2026-2027'}`;

  const [hasBackup, setHasBackup] = useState(() => {
    try {
      const cId = profile?.center_id || state.courses?.[0]?.center_id;
      const bKey = initialCourseId
        ? `edugens_schedule_backup_${cId}_course_${initialCourseId}_${schoolYear || '2026-2027'}`
        : `edugens_schedule_backup_${cId}_${schoolYear || '2026-2027'}`;
      return Boolean(localStorage.getItem(bKey));
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      setHasBackup(Boolean(localStorage.getItem(backupKey)));
    } catch {
      setHasBackup(false);
    }
  }, [backupKey]);

  const handleRestoreBackup = async () => {
    try {
      const raw = localStorage.getItem(backupKey);
      if (!raw) {
        toast.error('No hay ninguna copia de respaldo guardada para este centro o curso.');
        return;
      }
      const bData = JSON.parse(raw);
      if (
        !confirm(
          `¿Deseas restaurar la copia de respaldo de ${bData.entries?.length || 0} clases guardada el ${new Date(
            bData.timestamp
          ).toLocaleString()}?\n\nEsta acción revertirá las asignaciones de los cursos afectados a su estado previo.`
        )
      ) {
        return;
      }
      setIsSaving(true);
      await supabase
        .from('schedule_entries')
        .delete()
        .eq('center_id', centerId)
        .eq('school_year', bData.schoolYear)
        .in('course_id', bData.courseIds);

      const chunkSize = 200;
      for (let i = 0; i < (bData.entries || []).length; i += chunkSize) {
        const chunk = bData.entries.slice(i, i + chunkSize);
        let { error: insErr } = await supabase.from('schedule_entries').insert(chunk);
        if (insErr && (insErr.message?.includes('is_locked') || insErr.code === 'PGRST204')) {
          const fallbackChunk = chunk.map(({ is_locked, ...rest }: any) => rest);
          insErr = (await supabase.from('schedule_entries').insert(fallbackChunk)).error;
        }
        if (insErr) throw insErr;
      }

      toast.success('✅ ¡Horario restaurado exitosamente desde la copia de respaldo!');
      await refreshData(undefined, true);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Error al restaurar respaldo: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  // Cursos del centro para la tanda o curso individual
  const relevantCourses = useMemo(() => {
    if (importScope === 'single') {
      return selectedTargetCourse ? [selectedTargetCourse] : [];
    }
    return (state.courses || []).filter((c: any) => {
      const t = (c.tanda || '').toLowerCase();
      if (selectedShift === 'Vespertina') {
        return t.includes('ves') || t.includes('tar');
      }
      // Matutina / Extendida
      return !t.includes('ves') && !t.includes('tar');
    });
  }, [state.courses, selectedShift, importScope, selectedTargetCourse]);

  // Bloques horarios estándar
  const standardSlots = useMemo(() => {
    if (selectedShift === 'Extendida') {
      return getStandardExtendedDaySlots().filter((s) => !s.isBreak);
    }
    // Regular mañana (08:00 a 12:30) o tarde (14:00 a 18:15)
    const isMorn = selectedShift === 'Matutina';
    const cleanDuration = isMorn ? 45 : 40;
    const count = isMorn ? 5 : 6;
    const startMins = isMorn ? 480 : 840;
    const slots = [];
    let cur = startMins;
    for (let i = 0; i < count; i++) {
      if (i === 3) {
        // Pausa recreo
        cur += isMorn ? 30 : 20;
      }
      const sH = Math.floor(cur / 60).toString().padStart(2, '0');
      const sM = (cur % 60).toString().padStart(2, '0');
      const endMins = cur + cleanDuration;
      const eH = Math.floor(endMins / 60).toString().padStart(2, '0');
      const eM = (endMins % 60).toString().padStart(2, '0');
      slots.push({
        start: `${sH}:${sM}:00`,
        end: `${eH}:${eM}:00`,
        label: `${i + 1}ra Hora`
      });
      cur = endMins;
    }
    return slots;
  }, [selectedShift]);

  // Normalizador de texto para comparaciones
  const norm = (str: string) =>
    (str || '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  // 1. DESCARGAR PLANTILLA EXCEL
  const handleDownloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();

      // HOJA 1: MATRIZ SEMANAL POR CURSO (El formato más visual y cómodo)
      const matrixRows: any[] = [];
      relevantCourses.forEach((c: any) => {
        const courseLabel = `${c.grade} "${c.section || 'A'}"`.trim();
        standardSlots.forEach((slot, idx) => {
          matrixRows.push({
            Curso: courseLabel,
            Nivel: c.level || 'Secundario',
            Bloque: `${idx + 1}ra Hora (${slot.start.substring(0, 5)} - ${slot.end.substring(0, 5)})`,
            Lunes: '',
            Martes: '',
            Miércoles: '',
            Jueves: '',
            Viernes: ''
          });
        });
      });

      const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);
      XLSX.utils.book_append_sheet(wb, wsMatrix, 'Horario_Matriz');

      // HOJA 2: FORMATO LISTA PLANA (Fila por clase)
      const listRows: any[] = [];
      relevantCourses.slice(0, 2).forEach((c: any) => {
        const courseLabel = `${c.grade} "${c.section || 'A'}"`.trim();
        listRows.push({
          Curso: courseLabel,
          Dia: 'Lunes',
          Bloque_o_Hora: '1ra Hora',
          Materia: 'Lengua Española',
          Docente: 'Idaliza Peña'
        });
        listRows.push({
          Curso: courseLabel,
          Dia: 'Lunes',
          Bloque_o_Hora: '2da Hora',
          Materia: 'Lengua Española',
          Docente: 'Idaliza Peña'
        });
      });

      const wsList = XLSX.utils.json_to_sheet(listRows);
      XLSX.utils.book_append_sheet(wb, wsList, 'Horario_Lista');

      // HOJA 3: REFERENCIA DE ASIGNACIONES DOCENTES (Para copiar y pegar con exactitud)
      const assignmentsPool =
        importScope === 'single' && selectedTargetCourse
          ? (state.assignments || []).filter(
              (a: any) => String(a.course_id || a.courseId) === String(selectedTargetCourse.id)
            )
          : (state.assignments || []);

      let refRows = assignmentsPool.map((a: any) => {
        const c = state.courses.find((x: any) => x.id === a.course_id || x.id === a.courseId);
        const s = state.subjects.find((x: any) => x.id === a.subject_id || x.id === a.subjectId);
        const t = state.teachers.find((x: any) => x.id === a.teacher_id || x.id === a.teacherId);
        return {
          Curso: c ? `${c.grade} "${c.section || ''}"`.trim() : '---',
          Nivel: c?.level || '---',
          Materia: s?.name || '---',
          Docente: t?.name || '---',
          Horas_Semanales: a.hours_per_week || 4,
          Texto_Sugerido_Para_Pegar: `${s?.name || ''} (${t?.name || ''})`.trim()
        };
      });

      // Si es un curso específico y aún no tiene asignaciones configuradas, listar materias de su nivel
      if (importScope === 'single' && selectedTargetCourse && refRows.length === 0) {
        const cLvl = (selectedTargetCourse.level || '').toLowerCase().substring(0, 5);
        const matchingSubs = (state.subjects || []).filter((s: any) =>
          cLvl ? (s.level || '').toLowerCase().includes(cLvl) : true
        );
        refRows = matchingSubs.map((s: any) => ({
          Curso: `${selectedTargetCourse.grade} "${selectedTargetCourse.section || ''}"`.trim(),
          Nivel: selectedTargetCourse.level || '---',
          Materia: s.name,
          Docente: 'Por asignar',
          Horas_Semanales: 4,
          Texto_Sugerido_Para_Pegar: s.name
        }));
      }

      const wsRef = XLSX.utils.json_to_sheet(refRows);
      XLSX.utils.book_append_sheet(wb, wsRef, 'Referencia_Asignaciones');

      // HOJA 4: CATÁLOGO DE BLOQUES Y HORAS
      const blocksRows = standardSlots.map((s, idx) => ({
        Numero_Hora: idx + 1,
        Nombre_Bloque: s.label,
        Hora_Inicio: s.start.substring(0, 5),
        Hora_Fin: s.end.substring(0, 5)
      }));
      const wsBlocks = XLSX.utils.json_to_sheet(blocksRows);
      XLSX.utils.book_append_sheet(wb, wsBlocks, 'Horas_y_Bloques');

      const cleanCourseName = selectedTargetCourse
        ? `${selectedTargetCourse.grade}_${selectedTargetCourse.section || 'A'}`.replace(/[^a-zA-Z0-9_-]/g, '_')
        : 'Grado';

      const fileName =
        importScope === 'single' && selectedTargetCourse
          ? `Edugest_Plantilla_Horario_${cleanCourseName}_${schoolYear || '2026-2027'}.xlsx`
          : `Edugest_Plantilla_Horario_${selectedShift}_${schoolYear || '2026-2027'}.xlsx`;

      XLSX.writeFile(wb, fileName);
      toast.success(
        importScope === 'single' && selectedTargetCourse
          ? `Plantilla para ${selectedTargetCourse.grade} "${selectedTargetCourse.section || ''}" descargada con éxito`
          : 'Plantilla de horario descargada con éxito'
      );
    } catch (e: any) {
      console.error(e);
      toast.error('Error al generar plantilla: ' + (e.message || e));
    }
  };

  // 2. PARSEAR Y VALIDAR ARCHIVO EXCEL SUBIDO
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    processExcel(f);
  };

  const processExcel = (f: File) => {
    setIsProcessing(true);
    setParseErrors([]);
    setParseWarnings([]);
    setParsedEntries([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        const entries: any[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];

        // Detectar si tiene la hoja "Horario_Matriz" o si la primera hoja es Matriz
        const sheetName =
          wb.SheetNames.find((s) => s.toLowerCase().includes('matriz')) ||
          wb.SheetNames.find((s) => !s.toLowerCase().includes('ref') && !s.toLowerCase().includes('bloque')) ||
          wb.SheetNames[0];

        const ws = wb.Sheets[sheetName];
        if (!ws) {
          errors.push('No se encontró ninguna hoja con datos válidos en el archivo.');
          setParseErrors(errors);
          setIsProcessing(false);
          return;
        }

        const rawData: any[] = XLSX.utils.sheet_to_json(ws);
        if (rawData.length === 0) {
          errors.push('La hoja seleccionada está vacía.');
          setParseErrors(errors);
          setIsProcessing(false);
          return;
        }

        // Inspeccionar cabeceras para saber si es Formato Matriz o Formato Lista
        const firstRow = rawData[0];
        const keys = Object.keys(firstRow).map((k) => k.toLowerCase().trim());
        const isMatrix = keys.some((k) => k.includes('lunes')) && keys.some((k) => k.includes('martes'));

        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

        // Función para resolver curso con alta tolerancia
        const resolveCourse = (courseStr: string) => {
          if (!courseStr) return null;
          const clean = norm(courseStr);
          const allCourses = state.courses || [];

          // 1. Coincidencia directa o por inclusión
          const direct = allCourses.find((c: any) => {
            const cGradeSec = norm(`${c.grade} ${c.section || ''}`);
            const cGrade = norm(c.grade);
            return (
              clean === cGradeSec ||
              clean.includes(cGradeSec) ||
              cGradeSec.includes(clean) ||
              clean === cGrade
            );
          });
          if (direct) return direct;

          // 2. Extracción inteligente de grado y sección tolerando comillas y modalidades (ej. "4to Sec. Matematicas \"B\"")
          const sanitized = clean.replace(/[\"\'\.\,\(\)\-]/g, ' ').replace(/\s+/g, ' ').trim();
          const gradeMatch = sanitized.match(/(\d+)\s*(?:ro|ero|do|to|er|no)?/i);
          const gradeNum = gradeMatch ? parseInt(gradeMatch[1], 10) : null;

          // Buscar sección (letra única A-Z)
          const secMatch = sanitized.match(/\b([a-z])\b/i);
          const section = secMatch ? secMatch[1].toUpperCase() : null;

          if (gradeNum && section) {
            const match = allCourses.find((c: any) => {
              const cGradeNumMatch = norm(c.grade).match(/(\d+)/);
              const cGradeNum = cGradeNumMatch ? parseInt(cGradeNumMatch[1], 10) : null;
              const cSec = (c.section || '').toUpperCase().trim();
              return cGradeNum === gradeNum && cSec === section;
            });
            if (match) return match;
          }

          // 3. Tolerancia de "1ero" vs "1ro", "2do", "3ero" vs "3ro" con sección
          if (section) {
            const match = allCourses.find((c: any) => {
              const cSec = (c.section || '').toUpperCase().trim();
              if (cSec !== section) return false;
              const cGradeNorm = norm(c.grade);
              if (gradeNum === 1) return cGradeNorm.includes('1') || cGradeNorm.includes('primero') || cGradeNorm.includes('1ero') || cGradeNorm.includes('1ro');
              if (gradeNum === 2) return cGradeNorm.includes('2') || cGradeNorm.includes('segundo') || cGradeNorm.includes('2do');
              if (gradeNum === 3) return cGradeNorm.includes('3') || cGradeNorm.includes('tercero') || cGradeNorm.includes('3ero') || cGradeNorm.includes('3ro');
              if (gradeNum === 4) return cGradeNorm.includes('4') || cGradeNorm.includes('cuarto') || cGradeNorm.includes('4to');
              if (gradeNum === 5) return cGradeNorm.includes('5') || cGradeNorm.includes('quinto') || cGradeNorm.includes('5to');
              if (gradeNum === 6) return cGradeNorm.includes('6') || cGradeNorm.includes('sexto') || cGradeNorm.includes('6to');
              return false;
            });
            if (match) return match;
          }

          return null;
        };

        // Función para resolver materia con precisión quirúrgica y soporte de optativas
        const resolveSubject = (subStr: string, courseId?: string) => {
          if (!subStr) return null;
          const clean = norm(subStr);
          const allSubs = state.subjects || [];

          // 1. Si se proporciona courseId, buscar prioritariamente en las materias asignadas a este curso
          let courseSubjects: any[] = [];
          if (courseId) {
            const courseAssigns = (state.assignments || []).filter(
              (a: any) => String(a.course_id || a.courseId) === String(courseId)
            );
            const courseSubIds = new Set(courseAssigns.map((a: any) => String(a.subject_id)));
            courseSubjects = allSubs.filter((s: any) => courseSubIds.has(String(s.id)));

            // 1A. Coincidencia exacta en materias del curso
            const exactCourse = courseSubjects.find((s: any) => {
              const sName = norm(s.name);
              const sCode = norm(s.code || '');
              return clean === sName || (sCode && clean === sCode);
            });
            if (exactCourse) return exactCourse;

            // 1B. Si busca 'ingles', preferir la materia de inglés del curso (Lengua Extranjera Inglés) y descartar 'apreciacion literaria'
            if (clean === 'ingles' || clean === 'ingle' || clean.includes('ingles') || clean.includes('english')) {
              const inglesCourse = courseSubjects.find((s: any) => {
                const sName = norm(s.name);
                return (sName.includes('ingle') || sName.includes('english')) && !sName.includes('aprec') && !sName.includes('literari');
              });
              if (inglesCourse) return inglesCourse;
            }

            // 1C. Coincidencia parcial dentro de materias del curso
            const partialCourse = courseSubjects.find((s: any) => {
              const sName = norm(s.name);
              if (clean.includes('espanol') || clean.includes('lenguaespanola')) {
                return (sName.includes('espanol') || sName.includes('lengua')) && !sName.includes('extranjera');
              }
              return sName.includes(clean) || clean.includes(sName);
            });
            if (partialCourse) return partialCourse;
          }

          // 2. Mapeo inteligente de Aliases Curriculares (Optativas / Módulos de Modalidad)
          // A) Matemática Financiera / Tecnología -> Opt. Matemática
          if ((clean.includes('financiera') || clean.includes('tecnologia')) && clean.includes('mate')) {
            const optMate = courseSubjects.find((s: any) => norm(s.name).includes('opt') && norm(s.name).includes('mate')) ||
                            allSubs.find((s: any) => norm(s.name).includes('opt') && norm(s.name).includes('mate'));
            if (optMate) return optMate;
          }
          // B) Química y Computación / Biología y Computación / Física y Computación -> Opt. Naturales
          if ((clean.includes('quimica') || clean.includes('biologia') || clean.includes('fisica')) && (clean.includes('computacion') || clean.includes('comp'))) {
            const optNat = courseSubjects.find((s: any) => norm(s.name).includes('opt') && (norm(s.name).includes('nat') || norm(s.name).includes('cien'))) ||
                           allSubs.find((s: any) => norm(s.name).includes('opt') && (norm(s.name).includes('nat') || norm(s.name).includes('cien')));
            if (optNat) return optNat;
          }
          // C) Filosofía Social y Pensamiento Dominicano -> Opt. Sociales
          if (clean.includes('filosofia')) {
            const optSoc = courseSubjects.find((s: any) => norm(s.name).includes('opt') && norm(s.name).includes('soc')) ||
                           allSubs.find((s: any) => norm(s.name).includes('opt') && norm(s.name).includes('soc'));
            if (optSoc) return optSoc;
          }
          // D) Ciudadanía y Democracia
          if (clean.includes('ciudadania') || clean.includes('democracia')) {
            const ciu = courseSubjects.find((s: any) => norm(s.name).includes('ciudadania') || norm(s.name).includes('democracia')) ||
                        allSubs.find((s: any) => norm(s.name).includes('ciudadania') || norm(s.name).includes('democracia'));
            if (ciu) return ciu;
          }
          // E) Geografía Humana y Demografía
          if (clean.includes('geografia') || clean.includes('demografia')) {
            const geo = courseSubjects.find((s: any) => norm(s.name).includes('geografia') || norm(s.name).includes('demografia')) ||
                        allSubs.find((s: any) => norm(s.name).includes('geografia') || norm(s.name).includes('demografia'));
            if (geo) return geo;
          }
          // F) Apreciación Literaria y Producción Literaria e Inglés / Apreciación y Producción Literaria
          if (clean.includes('apreciacion') || clean.includes('literaria')) {
            const aprec = courseSubjects.find((s: any) => norm(s.name).includes('aprec') || norm(s.name).includes('literar')) ||
                          allSubs.find((s: any) => norm(s.name).includes('aprec') || norm(s.name).includes('literar'));
            if (aprec) return aprec;
          }
          // G) Moral y Cívica
          if (clean.includes('moral') || clean.includes('civica')) {
            const moral = courseSubjects.find((s: any) => norm(s.name).includes('moral') || norm(s.name).includes('civic')) ||
                          allSubs.find((s: any) => norm(s.name).includes('moral') || norm(s.name).includes('civic'));
            if (moral) return moral;
          }

          // 3. Coincidencia EXACTA a nivel general de todo el centro
          const exactCenter = allSubs.find((s: any) => {
            const sName = norm(s.name);
            const sCode = norm(s.code || '');
            return clean === sName || (sCode && clean === sCode);
          });
          if (exactCenter) return exactCenter;

          // 4. Regla específica para 'inglés': evitar falsos positivos con 'apreciación literaria'
          if (clean === 'ingles' || clean === 'ingle' || clean.includes('ingles') || clean.includes('english')) {
            const pureIngles = allSubs.find((s: any) => {
              const sName = norm(s.name);
              return (sName.includes('ingle') || sName.includes('english')) && !sName.includes('aprec') && !sName.includes('literari');
            });
            if (pureIngles) return pureIngles;
          }

          // 5. Regla específica para 'francés'
          if (clean === 'frances' || clean === 'francés' || clean.includes('france')) {
            const pureFrances = allSubs.find((s: any) => {
              const sName = norm(s.name);
              return sName.includes('france') && !sName.includes('aprec');
            });
            if (pureFrances) return pureFrances;
          }

          // 6. Regla específica para 'español'
          if (clean.includes('espanol') || clean.includes('lenguaespanola')) {
            const pureLengua = allSubs.find((s: any) => {
              const sName = norm(s.name);
              return (sName.includes('espanol') || sName.includes('lengua')) && !sName.includes('extranjera');
            });
            if (pureLengua) return pureLengua;
          }

          // 7. Si no coincide, buscar por palabras clave educativas estándar
          let match = allSubs.find((s: any) => {
            const sNorm = norm(s.name);
            if (clean.includes('mate')) return sNorm.includes('mate');
            if (clean.includes('social')) return sNorm.includes('social');
            if (clean.includes('natural')) return sNorm.includes('natural');
            if (clean.includes('fisica') || clean.includes('edufis')) {
              return sNorm.includes('fisica') || sNorm.includes('edufis');
            }
            if (clean.includes('art')) return sNorm.includes('art');
            if (clean.includes('formacion') || clean.includes('integral')) {
              return sNorm.includes('formacion') || sNorm.includes('integral') || sNorm.includes('relig');
            }
            return sNorm.includes(clean) || clean.includes(sNorm);
          });

          return match || null;
        };

        // Función para resolver docente con precisión quirúrgica y fallback a asignaciones
        const resolveTeacher = (tStr: string, courseId?: string, subjectId?: string) => {
          const clean = norm(tStr);
          const teachers = state.teachers || [];

          if (clean && clean !== 'sindocente' && clean !== 'desconocido' && clean !== '--') {
            // 1. Coincidencia exacta
            const exact = teachers.find((t: any) => norm(t.name) === clean);
            if (exact) return exact;

            // 2. Coincidencia inteligente usando areTeacherNamesMatching (distingue I vs II, 1 vs 2, etc.)
            const smart = teachers.find((t: any) => areTeacherNamesMatching(t.name, tStr));
            if (smart) return smart;
          }

          // 3. Fallback inteligente primordial: Si no viene nombre de docente en la celda
          // o no coincidió, buscar automáticamente en las asignaciones de carga docente del centro
          if (courseId && subjectId) {
            const assign = (state.assignments || []).find(
              (a: any) =>
                (String(a.course_id || a.courseId) === String(courseId)) &&
                (String(a.subject_id || a.subjectId) === String(subjectId))
            );
            if (assign) {
              const targetTeacherId = assign.teacher_id || assign.teacherId;
              const tFromAssign = teachers.find((t: any) => String(t.id) === String(targetTeacherId));
              if (tFromAssign) return tFromAssign;
            }
          }
          return null;
        };

        // Función para resolver bloque/hora
        const resolveSlot = (slotStr: string, rowIdx: number) => {
          if (slotStr) {
            const clean = slotStr.toLowerCase();
            // Buscar número de bloque 1ra, 2da, 1, 2, etc.
            const matchNum = clean.match(/(\d+)/);
            if (matchNum) {
              const num = parseInt(matchNum[1], 10);
              if (num >= 1 && num <= standardSlots.length) {
                return standardSlots[num - 1];
              }
            }
            // Buscar coincidencia de hora (ej. 08:15)
            const matchSlot = standardSlots.find((s) => clean.includes(s.start.substring(0, 5)));
            if (matchSlot) return matchSlot;
          }

          // Por defecto tomar según el índice relativo
          const slotIdx = rowIdx % standardSlots.length;
          return standardSlots[slotIdx];
        };

        // A) PROCESAR FORMATO MATRIZ
        if (isMatrix) {
          let currentCourse: any = null;

          rawData.forEach((row, rowIdx) => {
            const courseVal =
              row['Curso'] ||
              row['curso'] ||
              row['Grado'] ||
              row['grado'] ||
              row['CURSO'] ||
              '';

            // Detectar y omitir cabeceras secundarias o tablas anexadas (ej. formato lista o carga docente pegada abajo)
            const courseValNorm = norm(String(courseVal));
            if (courseValNorm === 'curso' || courseValNorm === 'numerohora' || courseValNorm === 'dia') {
              return;
            }

            if (importScope === 'single' && selectedTargetCourse) {
              if (courseVal) {
                const matched = resolveCourse(String(courseVal));
                currentCourse = matched || selectedTargetCourse;
              } else {
                currentCourse = selectedTargetCourse;
              }
            } else {
              if (courseVal) {
                const matched = resolveCourse(String(courseVal));
                if (matched) {
                  currentCourse = matched;
                } else {
                  currentCourse = null;
                  warnings.push(`Fila ${rowIdx + 2}: No se pudo determinar el curso "${courseVal}".`);
                }
              }
            }

            if (!currentCourse) {
              return;
            }

            const slotVal =
              row['Bloque'] ||
              row['bloque'] ||
              row['Hora'] ||
              row['hora'] ||
              row['Horario'] ||
              '';
            const slot = resolveSlot(String(slotVal), rowIdx);

            days.forEach((dayName) => {
              // Buscar clave del día (tolerar acentos y mayúsculas)
              const dayKey = Object.keys(row).find((k) => norm(k).startsWith(norm(dayName).substring(0, 3)));
              if (!dayKey) return;

              const cellVal = String(row[dayKey] || '').trim();
              if (!cellVal || norm(cellVal) === 'libre' || norm(cellVal).includes('recreo') || norm(cellVal).includes('almuerzo')) {
                return;
              }

              // Extraer materia y docente del texto
              let subjectText = cellVal;
              let teacherText = '';

              if (cellVal.includes('(') && cellVal.includes(')')) {
                const parts = cellVal.split('(');
                subjectText = parts[0].trim();
                teacherText = parts[1].replace(')', '').trim();
              } else if (cellVal.includes('-')) {
                const parts = cellVal.split('-');
                subjectText = parts[0].trim();
                teacherText = parts[1].trim();
              } else if (cellVal.includes('/')) {
                const parts = cellVal.split('/');
                subjectText = parts[0].trim();
                teacherText = parts[1].trim();
              }

              const subject = resolveSubject(subjectText, currentCourse.id);
              if (!subject) {
                warnings.push(
                  `[${currentCourse.grade} ${currentCourse.section || ''} - ${dayName} ${slot.label}]: Materia "${subjectText}" no encontrada.`
                );
                return;
              }

              const teacher = resolveTeacher(teacherText, currentCourse.id, subject.id);

              entries.push({
                course_id: currentCourse.id,
                courseName: `${currentCourse.grade} "${currentCourse.section || ''}"`.trim(),
                subject_id: subject.id,
                subjectName: subject.name,
                teacher_id: teacher?.id || null,
                teacherName: teacher?.name || teacherText || '(Sin docente)',
                day: dayName,
                start_time: slot.start,
                end_time: slot.end,
                slotLabel: slot.label,
                shift: selectedShift === 'Vespertina' ? 'Vespertina' : (currentCourse.tanda || selectedShift)
              });
            });
          });
        }
        // B) PROCESAR FORMATO LISTA PLANA
        else {
          rawData.forEach((row, rowIdx) => {
            const courseVal = row['Curso'] || row['curso'] || row['Grado'] || '';
            let course = resolveCourse(String(courseVal));
            if (!course && importScope === 'single' && selectedTargetCourse) {
              course = selectedTargetCourse;
            }
            if (!course) {
              warnings.push(`Fila ${rowIdx + 2}: Curso "${courseVal}" no reconocido.`);
              return;
            }

            const dayVal = row['Dia'] || row['dia'] || row['Día'] || 'Lunes';
            const matchedDay = days.find((d) => norm(d).startsWith(norm(String(dayVal)).substring(0, 3))) || 'Lunes';

            const slotVal = row['Bloque_o_Hora'] || row['Bloque'] || row['Hora'] || '';
            const slot = resolveSlot(String(slotVal), rowIdx);

            const subjectVal = row['Materia'] || row['materia'] || row['Asignatura'] || '';
            const subject = resolveSubject(String(subjectVal), course.id);
            if (!subject) {
              warnings.push(`Fila ${rowIdx + 2}: Materia "${subjectVal}" no reconocida.`);
              return;
            }

            const teacherVal = row['Docente'] || row['docente'] || row['Profesor'] || '';
            const teacher = resolveTeacher(String(teacherVal), course.id, subject.id);

            entries.push({
              course_id: course.id,
              courseName: `${course.grade} "${course.section || ''}"`.trim(),
              subject_id: subject.id,
              subjectName: subject.name,
              teacher_id: teacher?.id || null,
              teacherName: teacher?.name || teacherVal || '(Sin docente)',
              day: matchedDay,
              start_time: slot.start,
              end_time: slot.end,
              slotLabel: slot.label,
              shift: selectedShift === 'Vespertina' ? 'Vespertina' : (course.tanda || selectedShift)
            });
          });
        }

        // Si estamos en modo de grado/curso específico, filtrar para asegurar que solo se procesen clases de ese grado
        const finalEntries =
          importScope === 'single' && selectedTargetCourse
            ? entries.filter((e) => e.course_id === selectedTargetCourse.id)
            : entries;

        if (finalEntries.length === 0) {
          errors.push(
            importScope === 'single' && selectedTargetCourse
              ? `No se encontraron clases válidas para ${selectedTargetCourse.grade} "${selectedTargetCourse.section || ''}". Revisa que los nombres de materias coincidan.`
              : 'No se pudieron extraer clases válidas del archivo. Revisa que los nombres de los cursos y materias coincidan.'
          );
        }

        setParsedEntries(finalEntries);
        setParseErrors(errors);
        setParseWarnings(warnings);
      } catch (err: any) {
        console.error(err);
        setParseErrors(['Error al leer el archivo Excel: ' + (err.message || err)]);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(f);
  };

  // 3. GUARDAR HORARIO IMPORTADO EN LA BASE DE DATOS
  const handleSaveToDatabase = async () => {
    if (parsedEntries.length === 0) {
      toast.error('No hay clases válidas para guardar');
      return;
    }

    const targetYear = schoolYear || '2026-2027';
    const isSingle = importScope === 'single' && selectedTargetCourse;
    const courseLabel = selectedTargetCourse ? `${selectedTargetCourse.grade} "${selectedTargetCourse.section || ''}"` : '';
    const affectedCourseIds =
      isSingle && selectedTargetCourse
        ? [selectedTargetCourse.id]
        : Array.from(new Set(parsedEntries.map((e) => e.course_id)));

    if (
      !confirm(
        isSingle
          ? `¿Deseas aplicar e importar el horario de ${parsedEntries.length} clases exclusivamente para el curso ${courseLabel} (Año Escolar ${targetYear})?\n\n` +
            `🔒 Solo se reemplazará el horario de este grado/curso. Todos los demás cursos del centro permanecerán intactos.`
          : `¿Deseas aplicar e importar ${parsedEntries.length} clases para ${affectedCourseIds.length} cursos en el Año Escolar ${targetYear}?\n\n` +
            `🔒 Todas las materias quedarán blindadas con candado y listas para usarse inmediatamente.`
      )
    ) {
      return;
    }

    setIsSaving(true);
    try {
      // A) Asegurar que todos los docentes nombrados en el Excel existan en tabla teachers
      const missingTeacherNames = new Set<string>();
      parsedEntries.forEach((e) => {
        const rawName = (e.teacherName || '').trim();
        if (!e.teacher_id && rawName && rawName !== '(Sin docente)' && rawName !== '--') {
          missingTeacherNames.add(rawName);
        }
      });

      if (missingTeacherNames.size > 0 && centerId) {
        for (const rawName of missingTeacherNames) {
          const { data: foundT } = await supabase
            .from('teachers')
            .select('id, name')
            .eq('center_id', centerId)
            .ilike('name', rawName)
            .maybeSingle();

          let targetId = foundT?.id;
          if (!targetId) {
            const { data: newT, error: newErr } = await supabase
              .from('teachers')
              .insert([{ center_id: centerId, name: rawName, hours_available: 40 }])
              .select('id')
              .single();
            if (!newErr && newT) {
              targetId = newT.id;
            }
          }

          if (targetId) {
            parsedEntries.forEach((e) => {
              if ((e.teacherName || '').trim() === rawName) {
                e.teacher_id = targetId;
              }
            });
          }
        }
      }

      const uniqueTeacherIds = Array.from(
        new Set(parsedEntries.map((e) => e.teacher_id).filter(Boolean))
      );
      if (uniqueTeacherIds.length > 0 && centerId) {
        const teachersToUpsert = uniqueTeacherIds.map((tId) => {
          const tObj = state.teachers?.find((t: any) => t.id === tId);
          const tName = tObj?.name || parsedEntries.find((e) => e.teacher_id === tId)?.teacherName || 'Docente';
          return {
            id: tId,
            center_id: centerId,
            name: tName,
            hours_available: 40
          };
        });
        await supabase.from('teachers').upsert(teachersToUpsert, { onConflict: 'id' });
      }

      // B) CREAR BACKUP DE SEGURIDAD PREVIO (Snapshot Undo)
      let previousEntries: any[] = [];
      try {
        const { data: prevData } = await supabase
          .from('schedule_entries')
          .select('*')
          .eq('center_id', centerId)
          .eq('school_year', targetYear)
          .in('course_id', affectedCourseIds);
        if (prevData && prevData.length > 0) {
          previousEntries = prevData;
          localStorage.setItem(
            backupKey,
            JSON.stringify({
              timestamp: new Date().toISOString(),
              centerId,
              schoolYear: targetYear,
              courseIds: affectedCourseIds,
              entries: prevData
            })
          );
          setHasBackup(true);
        }
      } catch (bErr) {
        console.warn('Nota sobre creación de respaldo previo:', bErr);
      }

      // C) Eliminar horarios previos ÚNICAMENTE de los cursos afectados en este centro y año escolar
      // (AISLAMIENTO TOTAL: otros cursos y otros centros nunca son afectados)
      await supabase
        .from('schedule_entries')
        .delete()
        .eq('center_id', centerId)
        .eq('school_year', targetYear)
        .in('course_id', affectedCourseIds);

      // D) Insertar en lotes (chunks) de 200 registros con candado activado
      const entriesToInsert = parsedEntries.map((e) => ({
        center_id: centerId,
        school_year: targetYear,
        course_id: e.course_id,
        subject_id: e.subject_id,
        teacher_id: e.teacher_id,
        day: e.day,
        shift: e.shift || selectedShift,
        start_time: e.start_time,
        end_time: e.end_time,
        is_locked: true
      }));

      const chunkSize = 200;
      for (let i = 0; i < entriesToInsert.length; i += chunkSize) {
        const chunk = entriesToInsert.slice(i, i + chunkSize);
        let { error: insErr } = await supabase.from('schedule_entries').insert(chunk);
        if (insErr && (insErr.message?.includes('is_locked') || insErr.code === 'PGRST204')) {
          const fallbackChunk = chunk.map(({ is_locked, ...rest }: any) => rest);
          insErr = (await supabase.from('schedule_entries').insert(fallbackChunk)).error;
        }
        if (insErr) {
          // Rollback automático de emergencia: restaurar previousEntries para que ningún curso quede vacío
          if (previousEntries.length > 0) {
            try {
              await supabase.from('schedule_entries').upsert(previousEntries, { onConflict: 'id' });
            } catch {}
          }
          throw new Error('Error al insertar horario: ' + insErr.message);
        }
      }

      // E) Guardar backup local en localStorage para carga offline
      try {
        const storageKey = centerId ? `edugens_custom_schedule_${centerId}` : 'edugens_custom_schedule_entries';
        const existingLocal = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const filteredLocal = existingLocal.filter((s: any) => !affectedCourseIds.includes(s.course_id));
        const updatedLocal = [...filteredLocal, ...entriesToInsert];
        localStorage.setItem(storageKey, JSON.stringify(updatedLocal));
      } catch {}

      toast.success(
        isSingle
          ? `✅ ¡Horario de ${courseLabel} importado con éxito (${entriesToInsert.length} clases)!`
          : `✅ ¡${entriesToInsert.length} clases importadas con éxito para ${affectedCourseIds.length} cursos!`
      );
      await refreshData(undefined, true);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Error al guardar horario: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  // Conteo por curso para el resumen
  const courseSummary = useMemo(() => {
    const map: Record<string, { count: number; name: string }> = {};
    parsedEntries.forEach((e) => {
      if (!map[e.course_id]) {
        map[e.course_id] = { count: 0, name: e.courseName };
      }
      map[e.course_id].count++;
    });
    return Object.values(map);
  }, [parsedEntries]);

  const filteredPreviewEntries = useMemo(() => {
    if (selectedCourseFilter === 'all') return parsedEntries;
    return parsedEntries.filter((e) => e.course_id === selectedCourseFilter);
  }, [parsedEntries, selectedCourseFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-up">
        {/* Cabecera */}
        <div className="p-6 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
              <FileSpreadsheet className="text-emerald-400" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">
                {importScope === 'single' && selectedTargetCourse
                  ? `Subir Horario de ${selectedTargetCourse.grade} "${selectedTargetCourse.section || ''}" desde Excel`
                  : 'Carga de Horarios desde Excel'}
              </h2>
              <p className="text-xs text-indigo-200">
                {importScope === 'single' && selectedTargetCourse
                  ? `Actualiza o reemplaza únicamente el horario de este grado sin afectar los demás cursos`
                  : 'Replica el horario exacto del centro o de un grado específico en segundos'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Barra de Controles y Selector de Modo / Alcance */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 space-y-3.5">
          {/* Fila 1: Selector de Modo (Un Grado Específico vs Tanda Completa) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                Alcance:
              </span>
              <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    setImportScope('single');
                    if (parsedEntries.length > 0) {
                      setParsedEntries([]);
                      setFile(null);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    importScope === 'single'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers size={13} />
                  Un Grado / Curso Específico
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportScope('all');
                    if (parsedEntries.length > 0) {
                      setParsedEntries([]);
                      setFile(null);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    importScope === 'all'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen size={13} />
                  Tanda Completa (Todos)
                </button>
              </div>
            </div>

            {/* Acciones de Respaldo y Descarga de Plantilla */}
            <div className="flex items-center gap-2">
              {hasBackup && (
                <button
                  type="button"
                  onClick={handleRestoreBackup}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                  title="Restaura la copia de seguridad previa de horarios"
                >
                  <Clock size={13} className="text-amber-700" />
                  Restaurar Respaldo
                </button>
              )}
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                title={
                  importScope === 'single'
                    ? 'Descarga la plantilla Excel exclusiva para este grado'
                    : 'Descarga la plantilla con todos los cursos del centro'
                }
              >
                <Download size={14} className="text-indigo-600" />
                {importScope === 'single' ? 'Descargar Plantilla del Grado' : 'Descargar Plantilla Excel'}
              </button>
            </div>
          </div>

          {/* Fila 2: Selector contextual según el modo elegido */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200/60">
            {importScope === 'single' ? (
              <div className="flex flex-wrap items-center gap-2 w-full">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Grado / Curso a subir:
                </span>
                <select
                  value={targetCourseId}
                  onChange={(e) => {
                    setTargetCourseId(e.target.value);
                    if (parsedEntries.length > 0) {
                      setParsedEntries([]);
                      setFile(null);
                    }
                  }}
                  className="px-3 py-1.5 bg-white border-2 border-indigo-200 focus:border-indigo-600 rounded-xl text-xs font-black text-slate-800 shadow-2xs outline-none cursor-pointer"
                >
                  {sortedCenterCourses.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.grade} "{c.section || ''}" • {c.level || ''} ({c.tanda || 'Matutina'})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                  ✓ Aislamiento Total: Solo se modificará este curso. Los demás no se tocan.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Tanda:
                </span>
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                  {(['Extendida', 'Matutina', 'Vespertina'] as const).map((sh) => (
                    <button
                      key={sh}
                      type="button"
                      onClick={() => setSelectedShift(sh)}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        selectedShift === sh
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {sh === 'Extendida' ? 'Jornada Extendida (8h)' : sh}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Zona de Subida o Previsualización */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {parsedEntries.length === 0 ? (
            <div className="space-y-6">
              {/* Instrucciones Rápidas */}
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 flex items-start gap-3 text-sky-950">
                <Info size={20} className="text-sky-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold">
                    {importScope === 'single'
                      ? `¿Cómo subir el horario para ${selectedTargetCourse?.grade || 'este curso'} "${selectedTargetCourse?.section || ''}"?`
                      : '¿Cómo funciona la carga rápida del horario escolar?'}
                  </p>
                  <ul className="list-disc list-inside text-sky-800 space-y-0.5 text-[11px]">
                    {importScope === 'single' ? (
                      <>
                        <li>
                          Haz clic en <strong>Descargar Plantilla del Grado</strong> para obtener la matriz exclusiva de este curso y su lista de asignaturas docentes.
                        </li>
                        <li>
                          Llena las casillas de cada día (Lunes a Viernes) escribiendo solo el nombre de la materia (ej. <em>"Español"</em>, <em>"Matemáticas"</em>) o materia y profesor (ej. <em>"Español (Idaliza)"</em>).
                        </li>
                        <li>
                          Al subir el archivo, <strong>solo se actualizará este grado</strong> sin afectar ningún otro curso de la escuela.
                        </li>
                      </>
                    ) : (
                      <>
                        <li>
                          Descarga la plantilla: contiene la hoja <strong>Horario_Matriz</strong> con todos los cursos y la hoja <strong>Referencia_Asignaciones</strong> con tus docentes y materias exactas.
                        </li>
                        <li>
                          Puedes escribir solo la materia (ej. <em>"Español"</em>) y el sistema asignará automáticamente al docente que ya tienes registrado.
                        </li>
                        <li>
                          Al subir el archivo, todo se guardará con candado 🔒 y respaldo automático previo.
                        </li>
                      </>
                    )}
                  </ul>
                </div>
              </div>

              {/* Dropzone */}
              <label className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-3xl p-10 flex flex-col items-center justify-center gap-3 bg-slate-50/50 hover:bg-indigo-50/30 transition-all cursor-pointer group">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-16 h-16 bg-white shadow-md rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                  <Upload size={28} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-slate-700">
                    Selecciona o arrastra el archivo de Horario en Excel
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Formatos compatibles: .xlsx o .xls</p>
                </div>
              </label>

              {isProcessing && (
                <div className="flex items-center justify-center gap-2 p-4 text-xs font-bold text-indigo-600">
                  <Loader2 size={16} className="animate-spin" />
                  Analizando y validando horario escolar...
                </div>
              )}

              {parseErrors.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl text-xs text-rose-800 space-y-1">
                  <p className="font-black flex items-center gap-2 text-rose-900">
                    <AlertTriangle size={15} /> Errores detectados:
                  </p>
                  {parseErrors.map((err, i) => (
                    <p key={i}>• {err}</p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Barra de Resumen Exitoso */}
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-emerald-950 uppercase">
                      Horario Reconocido con Éxito
                    </h4>
                    <p className="text-[11px] text-emerald-700 font-bold">
                      {parsedEntries.length} horas de clase listas para {courseSummary.length} cursos
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Ver Curso:</label>
                  <select
                    value={selectedCourseFilter}
                    onChange={(e) => setSelectedCourseFilter(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="all">Todos los cursos ({courseSummary.length})</option>
                    {courseSummary.map((c) => (
                      <option key={c.name} value={parsedEntries.find((e) => e.courseName === c.name)?.course_id}>
                        {c.name} ({c.count}h)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pestañas de Previsualización */}
              <div className="flex border-b border-slate-200 text-xs font-black uppercase tracking-wider">
                <button
                  type="button"
                  onClick={() => setPreviewTab('summary')}
                  className={`pb-2 px-3 border-b-2 transition-all ${
                    previewTab === 'summary' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent'
                  }`}
                >
                  Resumen por Grado
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('details')}
                  className={`pb-2 px-3 border-b-2 transition-all ${
                    previewTab === 'details' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent'
                  }`}
                >
                  Detalle de Clases ({filteredPreviewEntries.length})
                </button>
              </div>

              {/* Vista A: Resumen de Cursos */}
              {previewTab === 'summary' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {courseSummary.map((c) => {
                      const isComplete = c.count >= 38;
                      const isPartial = c.count >= 20 && c.count < 38;
                      return (
                        <div
                          key={c.name}
                          className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                            isComplete
                              ? 'bg-slate-50 border-slate-200'
                              : isPartial
                              ? 'bg-amber-50/60 border-amber-200'
                              : 'bg-rose-50/60 border-rose-200'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-black text-slate-800">{c.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{selectedShift}</p>
                          </div>
                          <span
                            className={`px-2.5 py-1 font-black text-xs rounded-lg flex items-center gap-1 ${
                              isComplete
                                ? 'bg-indigo-100 text-indigo-700'
                                : isPartial
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {c.count} horas {!isComplete && '⚠️'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Vista B: Tabla Detallada */}
              {previewTab === 'details' && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-500 sticky top-0">
                      <tr>
                        <th className="p-2.5">Curso</th>
                        <th className="p-2.5">Día</th>
                        <th className="p-2.5">Hora</th>
                        <th className="p-2.5">Materia</th>
                        <th className="p-2.5">Docente</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPreviewEntries.map((e, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-800">{e.courseName}</td>
                          <td className="p-2.5 font-bold text-indigo-600">{e.day}</td>
                          <td className="p-2.5 text-slate-500">{e.start_time.substring(0, 5)} - {e.end_time.substring(0, 5)}</td>
                          <td className="p-2.5 font-bold text-slate-700">{e.subjectName}</td>
                          <td className="p-2.5 text-slate-600">{e.teacherName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {parseWarnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-800 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-amber-900">
                    <AlertTriangle size={13} /> {parseWarnings.length} advertencias menores:
                  </p>
                  <div className="max-h-20 overflow-y-auto space-y-0.5 text-[11px]">
                    {parseWarnings.slice(0, 5).map((w, i) => (
                      <p key={i}>• {w}</p>
                    ))}
                    {parseWarnings.length > 5 && (
                      <p className="italic">... y {parseWarnings.length - 5} más.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie de Página con Botones de Acción */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {parsedEntries.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setParsedEntries([]);
                setFile(null);
              }}
              className="px-4 py-2 text-slate-500 hover:text-slate-800 font-bold text-xs cursor-pointer"
            >
              Cambiar Archivo
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl font-bold text-xs cursor-pointer transition-all"
            >
              Cancelar
            </button>

            {parsedEntries.length > 0 && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveToDatabase}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/20 cursor-pointer transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    {importScope === 'single' && selectedTargetCourse
                      ? `Guardando Horario de ${selectedTargetCourse.grade}...`
                      : 'Guardando Horario...'}
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    {importScope === 'single' && selectedTargetCourse
                      ? `Guardar Horario de ${selectedTargetCourse.grade} "${selectedTargetCourse.section || ''}" 🔒`
                      : 'Guardar Horario en el Sistema 🔒'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
