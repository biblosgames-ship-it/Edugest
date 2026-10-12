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

interface ScheduleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeShift: 'Matutina' | 'Vespertina';
  schoolYear: string;
  state: any;
  profile: any;
  refreshData: (centerId?: string, force?: boolean) => Promise<void>;
}

export const ScheduleImportModal: React.FC<ScheduleImportModalProps> = ({
  isOpen,
  onClose,
  activeShift,
  schoolYear,
  state,
  profile,
  refreshData
}) => {
  const [selectedShift, setSelectedShift] = useState<'Matutina' | 'Vespertina' | 'Extendida'>(() => {
    const hasExt = (state.courses || []).some((c: any) => {
      const t = (c.tanda || '').toLowerCase();
      return t.includes('ext') || t.includes('jor');
    });
    return hasExt ? 'Extendida' : activeShift;
  });

  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedEntries, setParsedEntries] = useState<any[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [previewTab, setPreviewTab] = useState<'summary' | 'details' | 'reference'>('summary');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');

  const centerId = profile?.center_id || state.courses?.[0]?.center_id;

  // Cursos del centro para la tanda
  const relevantCourses = useMemo(() => {
    return (state.courses || []).filter((c: any) => {
      const t = (c.tanda || '').toLowerCase();
      if (selectedShift === 'Vespertina') {
        return t.includes('ves') || t.includes('tar');
      }
      // Matutina / Extendida
      return !t.includes('ves') && !t.includes('tar');
    });
  }, [state.courses, selectedShift]);

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
      const refRows = (state.assignments || []).map((a: any) => {
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

      const fileName = `Edugest_Plantilla_Horario_${selectedShift}_${schoolYear || '2026-2027'}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Plantilla de horario descargada con éxito');
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

        // Función para resolver curso
        const resolveCourse = (courseStr: string) => {
          if (!courseStr) return null;
          const clean = norm(courseStr);
          return (state.courses || []).find((c: any) => {
            const cGradeSec = norm(`${c.grade} ${c.section || ''}`);
            const cGrade = norm(c.grade);
            return (
              clean === cGradeSec ||
              clean.includes(cGradeSec) ||
              cGradeSec.includes(clean) ||
              clean === cGrade
            );
          });
        };

        // Función para resolver materia
        const resolveSubject = (subStr: string, courseId?: string) => {
          if (!subStr) return null;
          const clean = norm(subStr);

          // 1. Coincidencia exacta o directa con materias del centro
          let match = (state.subjects || []).find((s: any) => {
            const sName = norm(s.name);
            const sCode = norm(s.code || '');
            return (
              clean === sName ||
              (sCode && clean === sCode) ||
              clean.includes(sName) ||
              sName.includes(clean)
            );
          });

          // 2. Si no coincide, buscar por palabras clave educativas dominicanas
          if (!match) {
            match = (state.subjects || []).find((s: any) => {
              const sNorm = norm(s.name);
              if (clean.includes('espanol') || clean.includes('lengua')) {
                return sNorm.includes('espanol') || sNorm.includes('lengua');
              }
              if (clean.includes('mate')) return sNorm.includes('mate');
              if (clean.includes('social')) return sNorm.includes('social');
              if (clean.includes('natural')) return sNorm.includes('natural');
              if (clean.includes('fisica') || clean.includes('edufis')) {
                return sNorm.includes('fisica') || sNorm.includes('edufis');
              }
              if (clean.includes('ingle')) return sNorm.includes('ingle');
              if (clean.includes('france')) return sNorm.includes('france');
              if (clean.includes('art')) return sNorm.includes('art');
              if (clean.includes('formacion') || clean.includes('integral')) {
                return sNorm.includes('formacion') || sNorm.includes('integral') || sNorm.includes('relig');
              }
              return false;
            });
          }
          return match;
        };

        // Función para resolver docente
        const resolveTeacher = (tStr: string, courseId?: string, subjectId?: string) => {
          if (tStr) {
            const clean = norm(tStr);
            const direct = (state.teachers || []).find((t: any) => {
              const tName = norm(t.name);
              return clean === tName || clean.includes(tName) || tName.includes(clean);
            });
            if (direct) return direct;
          }

          // Fallback inteligente: buscar en las asignaciones previas del curso y materia
          if (courseId && subjectId) {
            const assign = (state.assignments || []).find(
              (a: any) =>
                (a.course_id === courseId || a.courseId === courseId) &&
                (a.subject_id === subjectId || a.subjectId === subjectId)
            );
            if (assign) {
              const tFromAssign = (state.teachers || []).find(
                (t: any) => t.id === assign.teacher_id || t.id === assign.teacherId
              );
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
            if (courseVal) {
              const matched = resolveCourse(String(courseVal));
              if (matched) currentCourse = matched;
            }

            if (!currentCourse) {
              warnings.push(`Fila ${rowIdx + 2}: No se pudo determinar el curso.`);
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
            const course = resolveCourse(String(courseVal));
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

        if (entries.length === 0) {
          errors.push('No se pudieron extraer clases válidas del archivo. Revisa que los nombres de los cursos y materias coincidan.');
        }

        setParsedEntries(entries);
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
    const affectedCourseIds = Array.from(new Set(parsedEntries.map((e) => e.course_id)));

    if (
      !confirm(
        `¿Deseas aplicar e importar ${parsedEntries.length} clases para ${affectedCourseIds.length} cursos en el Año Escolar ${targetYear}?\n\n` +
          `🔒 Todas las materias quedarán blindadas con candado y listas para usarse inmediatamente.`
      )
    ) {
      return;
    }

    setIsSaving(true);
    try {
      // A) Asegurar que los docentes existan en tabla teachers para evitar violación de FK
      const uniqueTeacherIds = Array.from(
        new Set(parsedEntries.map((e) => e.teacher_id).filter(Boolean))
      );
      if (uniqueTeacherIds.length > 0 && centerId) {
        const teachersToUpsert = uniqueTeacherIds.map((tId) => {
          const tName = state.teachers?.find((t: any) => t.id === tId)?.name || 'Docente';
          return {
            id: tId,
            center_id: centerId,
            name: tName,
            hours_available: 40
          };
        });
        await supabase.from('teachers').upsert(teachersToUpsert, { onConflict: 'id' });
      }

      // B) Eliminar horarios previos ÚNICAMENTE de los cursos afectados en este centro y año escolar
      // (AISLAMIENTO TOTAL: otros cursos y otros centros nunca son afectados)
      await supabase
        .from('schedule_entries')
        .delete()
        .eq('center_id', centerId)
        .eq('school_year', targetYear)
        .in('course_id', affectedCourseIds);

      // C) Insertar en lotes (chunks) de 200 registros con candado activado
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
          throw new Error('Error al insertar horario: ' + insErr.message);
        }
      }

      // D) Guardar backup local en localStorage para carga offline
      try {
        const storageKey = centerId ? `edugens_custom_schedule_${centerId}` : 'edugens_custom_schedule_entries';
        const existingLocal = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const filteredLocal = existingLocal.filter((s: any) => !affectedCourseIds.includes(s.course_id));
        const updatedLocal = [...filteredLocal, ...entriesToInsert];
        localStorage.setItem(storageKey, JSON.stringify(updatedLocal));
      } catch {}

      toast.success(`✅ ¡${parsedEntries.length} clases importadas con éxito!`);
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
              <h2 className="text-lg font-black tracking-tight">Carga Masiva de Horarios desde Excel</h2>
              <p className="text-xs text-indigo-200">
                Replica el horario exacto del centro sin subir hora por hora
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

        {/* Barra de Controles y Selector de Tanda */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Tanda de Trabajo:</span>
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

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
              title="Descarga la plantilla con tus cursos y docentes precargados"
            >
              <Download size={14} className="text-indigo-600" />
              Descargar Plantilla Excel
            </button>
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
                  <p className="font-bold">¿Cómo funciona la carga rápida?</p>
                  <ul className="list-disc list-inside text-sky-800 space-y-0.5 text-[11px]">
                    <li>
                      Descarga la plantilla: contiene la hoja <strong>Horario_Matriz</strong> (cuadrícula por curso) y la hoja <strong>Referencia_Asignaciones</strong> con tus docentes y materias exactas.
                    </li>
                    <li>
                      Puedes escribir solo la materia (ej. <em>"Español"</em>) y el sistema asignará automáticamente al docente que ya tienes en el sistema.
                    </li>
                    <li>
                      O puedes escribir <em>"Español (Idaliza)"</em> para especificarlo directamente.
                    </li>
                    <li>
                      Al subir el archivo, todo se guardará con candado 🔒 sin modificar los demás centros.
                    </li>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {courseSummary.map((c) => (
                    <div
                      key={c.name}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-black text-slate-800">{c.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{selectedShift}</p>
                      </div>
                      <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 font-black text-xs rounded-lg">
                        {c.count} horas
                      </span>
                    </div>
                  ))}
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
                    Guardando Horario...
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    Guardar Horario en el Sistema 🔒
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
