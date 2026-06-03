import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { dataService } from '../services/dataService';
import { supabase } from '../lib/supabase';
import { Sparkles, ArrowRight, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface PromoteStudentModalProps {
  student: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PromoteStudentModal = ({ student, onClose, onSuccess }: PromoteStudentModalProps) => {
  const { state, selectedYear } = useApp();

  const [targetYear, setTargetYear] = useState('');
  const [targetCourseId, setTargetCourseId] = useState('');
  const [targetCourses, setTargetCourses] = useState<any[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Obtener cursos actuales del estudiante
  const currentCourse = useMemo(() => {
    return (state.courses || []).find((c: any) => c.id === student.course_id);
  }, [state.courses, student.course_id]);

  // Lista de años escolares
  const schoolYears = useMemo(() => {
    return state.schoolYears || [];
  }, [state.schoolYears]);

  // Al abrir el modal, pre-seleccionar el año escolar siguiente
  useEffect(() => {
    if (student.school_year && schoolYears.length > 0) {
      // Intentar buscar el año escolar siguiente al del alumno
      const sorted = [...schoolYears].sort((a: any, b: any) => a.name.localeCompare(b.name));
      const idx = sorted.findIndex((y: any) => y.name === student.school_year);
      if (idx !== -1 && idx + 1 < sorted.length) {
        setTargetYear(sorted[idx + 1].name);
      } else {
        // Fallback al año activo actual o el primero
        setTargetYear(selectedYear || sorted[sorted.length - 1]?.name || '');
      }
    }
  }, [student.school_year, schoolYears, selectedYear]);

  // Cargar cursos del año destino
  useEffect(() => {
    const fetchTargetCourses = async () => {
      if (!targetYear || !student.center_id) {
        setTargetCourses([]);
        setTargetCourseId('');
        return;
      }

      setIsLoadingCourses(true);
      try {
        const { data, error: cErr } = await supabase
          .from('courses')
          .select('*')
          .eq('center_id', student.center_id)
          .eq('school_year', targetYear);

        if (cErr) throw cErr;
        const sorted = (data || []).sort((a: any, b: any) => {
          return `${a.level} ${a.grade} ${a.section}`.localeCompare(
            `${b.level} ${b.grade} ${b.section}`
          );
        });
        setTargetCourses(sorted);

        // Intentar adivinar el siguiente curso
        if (currentCourse) {
          const nextGrade = getNextGradeName(currentCourse.grade);
          const nextLevel = getNextLevelName(currentCourse.level, currentCourse.grade);

          const suggested = sorted.find(
            (tc: any) =>
              tc.level.toLowerCase().trim() === nextLevel.toLowerCase().trim() &&
              tc.grade.toLowerCase().trim() === nextGrade.toLowerCase().trim() &&
              tc.section.toLowerCase().trim() === currentCourse.section.toLowerCase().trim()
          );

          if (suggested) {
            setTargetCourseId(suggested.id);
          } else {
            // Sugerir uno con misma sección y grado similar, o el primero
            const sameSection = sorted.find((tc: any) => tc.section === currentCourse.section);
            setTargetCourseId(sameSection ? sameSection.id : sorted[0]?.id || '');
          }
        } else {
          setTargetCourseId(sorted[0]?.id || '');
        }
      } catch (err: any) {
        console.error(err);
        setError('Error al cargar los cursos del año escolar de destino.');
      } finally {
        setIsLoadingCourses(false);
      }
    };

    fetchTargetCourses();
  }, [targetYear, student.center_id, currentCourse]);

  // Reglas simples para sugerir el grado siguiente
  const getNextGradeName = (grade: string) => {
    const g = (grade || '').toLowerCase().trim();
    if (g.includes('1')) return '2do';
    if (g.includes('2')) return '3ero';
    if (g.includes('3')) return '4to';
    if (g.includes('4')) return '5to';
    if (g.includes('5')) return '6to';
    if (g.includes('6')) return '1ero'; // Transición Primaria -> Secundaria
    return grade;
  };

  // Reglas para sugerir el nivel siguiente (por si hay transición)
  const getNextLevelName = (level: string, grade: string) => {
    const l = (level || '').toLowerCase().trim();
    const g = (grade || '').toLowerCase().trim();
    if (l === 'primario' && g.includes('6')) {
      return 'Secundario';
    }
    if (l === 'inicial') {
      return 'Primario';
    }
    return level;
  };

  const handlePromote = async () => {
    if (!targetYear || !targetCourseId) {
      setError('Por favor selecciona el ciclo y el curso de destino.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      await dataService.promoteStudent(student.id, targetYear, targetCourseId);
      setSuccess(true);
      toast.success('Alumno reinscrito exitosamente');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Error durante la reinscripción del estudiante.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="text-left space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase text-slate-900">
              Reinscribir / Promover Alumno
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Promoción individual y generación de expediente para nuevo ciclo
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
          disabled={isProcessing}
        >
          <X size={20} />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-3 text-xs font-bold">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!success ? (
        <div className="space-y-6">
          {/* Ficha rápida del estudiante */}
          <div className="p-5 bg-slate-50 border border-slate-200/50 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Estudiante Seleccionado
              </p>
              <h4 className="text-sm font-black text-slate-800 uppercase mt-0.5">
                {student.first_surname} {student.second_surname || ''}, {student.names}
              </h4>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                Año Actual: {student.school_year} | Curso:{' '}
                {currentCourse
                  ? `${currentCourse.level} ${currentCourse.grade} "${currentCourse.section}"`
                  : 'Sin Curso'}
              </p>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 text-[10px] font-black uppercase tracking-wider shrink-0">
              Expediente Activo
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                Ciclo Escolar de Destino
              </label>
              <select
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                disabled={isProcessing}
                className="w-full px-4 py-3.5 border-2 border-slate-100 rounded-xl bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
              >
                <option value="">-- Seleccionar ciclo destino --</option>
                {schoolYears.map((y: any) => (
                  <option key={y.id} value={y.name}>
                    {y.name} ({y.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                Curso / Grado de Destino
              </label>
              <select
                value={targetCourseId}
                onChange={(e) => setTargetCourseId(e.target.value)}
                disabled={isProcessing || isLoadingCourses}
                className="w-full px-4 py-3.5 border-2 border-slate-100 rounded-xl bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
              >
                <option value="">-- Seleccionar curso destino --</option>
                {targetCourses.map((tc: any) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.level} {tc.grade} "{tc.section}" ({tc.shift})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {currentCourse && targetCourseId && (
            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full justify-center text-xs font-black uppercase text-indigo-950">
                <span>
                  {currentCourse.grade} "{currentCourse.section}"
                </span>
                <ArrowRight className="text-indigo-500 shrink-0" size={16} />
                <span>
                  {targetCourses.find((tc: any) => tc.id === targetCourseId)?.grade || ''} "
                  {targetCourses.find((tc: any) => tc.id === targetCourseId)?.section || ''}"
                </span>
              </div>
            </div>
          )}

          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-[9px] font-bold uppercase leading-relaxed flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>
              Nota: La promoción creará una nueva matrícula para el ciclo escolar {targetYear} y
              copiará automáticamente los datos de contacto y tutores asociados a su perfil. Esto
              permite facturar y gestionar pagos del ciclo nuevo de forma independiente sin alterar
              el año pasado.
            </span>
          </div>

          <div className="flex gap-4 pt-4 border-t border-slate-100">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 px-6 py-4 bg-slate-150 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handlePromote}
              disabled={isProcessing || !targetYear || !targetCourseId}
              className="flex-2 px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={14} /> Procesando Reinscripción...
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} /> Confirmar Reinscripción
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-12 flex flex-col items-center justify-center text-center gap-6 min-h-[300px] animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-50">
            <CheckCircle2 size={44} />
          </div>
          <div className="space-y-2">
            <h4 className="text-lg font-black uppercase text-slate-900">¡Promoción Completada!</h4>
            <p className="text-xs text-slate-500 font-medium max-w-sm">
              El alumno{' '}
              <strong>
                {student.first_surname} {student.names}
              </strong>{' '}
              ha sido reinscrito con éxito en el ciclo {targetYear} en su grado correspondiente.
            </p>
          </div>
          <button
            onClick={() => {
              onClose();
            }}
            className="px-10 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all"
          >
            Cerrar Ventana
          </button>
        </div>
      )}
    </div>
  );
};
