import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { dataService } from '../services/dataService';
import { supabase } from '../lib/supabase';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Users,
  CheckSquare,
  Square
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface BulkPromoteModalProps {
  sourceCourseId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const BulkPromoteModal = ({ sourceCourseId, onClose, onSuccess }: BulkPromoteModalProps) => {
  const { state, selectedYear } = useApp();

  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [targetYear, setTargetYear] = useState('');
  const [targetCourseId, setTargetCourseId] = useState('');
  const [targetCourses, setTargetCourses] = useState<any[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [currentPromotingName, setCurrentPromotingName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resultsReport, setResultsReport] = useState<{ success: number; failed: number; details: string[] }>({
    success: 0,
    failed: 0,
    details: []
  });

  // Buscar el curso de origen
  const sourceCourse = useMemo(() => {
    return (state.courses || []).find((c: any) => c.id === sourceCourseId);
  }, [state.courses, sourceCourseId]);

  // Lista de años escolares disponibles
  const schoolYears = useMemo(() => {
    return state.schoolYears || [];
  }, [state.schoolYears]);

  // Cargar estudiantes del curso de origen
  useEffect(() => {
    const fetchStudents = async () => {
      if (!sourceCourseId) return;
      setIsLoadingStudents(true);
      try {
        const { data, error: sErr } = await supabase
          .from('students')
          .select('*')
          .eq('course_id', sourceCourseId)
          .eq('school_year', selectedYear);

        if (sErr) throw sErr;
        const sorted = (data || []).sort((a: any, b: any) => {
          const nameA = `${a.first_surname || ''} ${a.second_surname || ''} ${a.names || ''}`.toLowerCase();
          const nameB = `${b.first_surname || ''} ${b.second_surname || ''} ${b.names || ''}`.toLowerCase();
          return nameA.localeCompare(nameB);
        });
        setStudents(sorted);
        // Pre-seleccionar todos por defecto
        setSelectedStudentIds(sorted.map((s: any) => s.id));
      } catch (err: any) {
        console.error(err);
        setError('Error al cargar la lista de estudiantes de origen.');
      } finally {
        setIsLoadingStudents(false);
      }
    };
    fetchStudents();
  }, [sourceCourseId, selectedYear]);

  // Al abrir, sugerir el año escolar siguiente
  useEffect(() => {
    if (selectedYear && schoolYears.length > 0) {
      const sorted = [...schoolYears].sort((a: any, b: any) => a.name.localeCompare(b.name));
      const idx = sorted.findIndex((y: any) => y.name === selectedYear);
      if (idx !== -1 && idx + 1 < sorted.length) {
        setTargetYear(sorted[idx + 1].name);
      } else {
        setTargetYear(selectedYear);
      }
    }
  }, [selectedYear, schoolYears]);

  // Cargar cursos del año destino
  useEffect(() => {
    const fetchTargetCourses = async () => {
      if (!targetYear || !sourceCourse?.center_id) {
        setTargetCourses([]);
        setTargetCourseId('');
        return;
      }

      setIsLoadingCourses(true);
      try {
        const { data, error: cErr } = await supabase
          .from('courses')
          .select('*')
          .eq('center_id', sourceCourse.center_id)
          .eq('school_year', targetYear);

        if (cErr) throw cErr;
        const sorted = (data || []).sort((a: any, b: any) => {
          return `${a.level} ${a.grade} ${a.section}`.localeCompare(`${b.level} ${b.grade} ${b.section}`);
        });
        setTargetCourses(sorted);

        // Sugerir curso destino basado en el curso actual
        if (sourceCourse) {
          const nextGrade = getNextGradeName(sourceCourse.grade);
          const nextLevel = getNextLevelName(sourceCourse.level, sourceCourse.grade);

          const suggested = sorted.find(
            (tc: any) =>
              tc.level.toLowerCase().trim() === nextLevel.toLowerCase().trim() &&
              tc.grade.toLowerCase().trim() === nextGrade.toLowerCase().trim() &&
              tc.section.toLowerCase().trim() === sourceCourse.section.toLowerCase().trim()
          );

          if (suggested) {
            setTargetCourseId(suggested.id);
          } else {
            const sameSection = sorted.find((tc: any) => tc.section === sourceCourse.section);
            setTargetCourseId(sameSection ? sameSection.id : sorted[0]?.id || '');
          }
        } else {
          setTargetCourseId(sorted[0]?.id || '');
        }
      } catch (err: any) {
        console.error(err);
        setError('Error al cargar los cursos de destino.');
      } finally {
        setIsLoadingCourses(false);
      }
    };

    fetchTargetCourses();
  }, [targetYear, sourceCourse]);

  const getNextGradeName = (grade: string) => {
    const g = (grade || '').toLowerCase().trim();
    if (g.includes('1')) return '2do';
    if (g.includes('2')) return '3ero';
    if (g.includes('3')) return '4to';
    if (g.includes('4')) return '5to';
    if (g.includes('5')) return '6to';
    if (g.includes('6')) return '1ero'; // Primaria -> Secundaria
    return grade;
  };

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

  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === students.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(students.map((s) => s.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter((sid) => sid !== id));
    } else {
      setSelectedStudentIds([...selectedStudentIds, id]);
    }
  };

  const handleBulkPromote = async () => {
    if (selectedStudentIds.length === 0) {
      setError('Por favor selecciona al menos un alumno para promover.');
      return;
    }
    if (!targetYear || !targetCourseId) {
      setError('Por favor selecciona el ciclo y curso de destino.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgressIndex(0);

    let successCount = 0;
    let failedCount = 0;
    const details: string[] = [];

    const studentMap = new Map(students.map((s) => [s.id, s]));

    for (let i = 0; i < selectedStudentIds.length; i++) {
      const sId = selectedStudentIds[i];
      const currentStudent: any = studentMap.get(sId);
      const studentName = `${currentStudent?.first_surname} ${currentStudent?.names}`.toUpperCase();

      setCurrentPromotingName(studentName);
      setProgressIndex(i + 1);

      try {
        await dataService.promoteStudent(sId, targetYear, targetCourseId);
        successCount++;
        details.push(`✅ ${studentName} - Reinscrito con éxito`);
      } catch (err: any) {
        console.error(err);
        failedCount++;
        details.push(`❌ ${studentName} - Falló: ${err?.message || 'Error desconocido'}`);
      }
    }

    setResultsReport({
      success: successCount,
      failed: failedCount,
      details: details
    });
    setIsProcessing(false);
    setSuccess(true);
    toast.success(`Promoción completada. Éxito: ${successCount}, Errores: ${failedCount}`);
    if (onSuccess) onSuccess();
  };

  return (
    <div className="text-left space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase text-slate-900">Promoción Masiva de Alumnos</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Matricular un grupo de alumnos al nuevo año escolar
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
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-3 text-xs font-bold animate-fade-in">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!isProcessing && !success && (
        <div className="space-y-6 animate-fade-in">
          {/* Ficha origen */}
          <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-2xl flex flex-wrap gap-4 items-center justify-between">
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Curso Origen</span>
              <h4 className="text-sm font-black text-slate-800 uppercase mt-0.5">
                {sourceCourse ? `${sourceCourse.level} ${sourceCourse.grade} "${sourceCourse.section}"` : 'Sin Curso'}
              </h4>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                Año Escolar: {selectedYear}
              </p>
            </div>
            <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Alumnos cargados</span>
              <h4 className="text-sm font-black text-slate-800 uppercase mt-0.5">
                {students.length} estudiantes
              </h4>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                Año Escolar Destino
              </label>
              <select
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                className="w-full px-4 py-3.5 border-2 border-slate-100 rounded-xl bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
              >
                <option value="">-- Seleccionar año --</option>
                {schoolYears.map((y: any) => (
                  <option key={y.id} value={y.name}>
                    {y.name} ({y.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                Curso / Grado Destino
              </label>
              <select
                value={targetCourseId}
                onChange={(e) => setTargetCourseId(e.target.value)}
                disabled={isLoadingCourses}
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

          {/* Tabla de Selección */}
          <div className="border border-slate-200/60 rounded-2xl overflow-hidden bg-surface">
            <div className="flex items-center justify-between bg-slate-900 text-white py-3 px-4">
              <span className="text-[10px] font-black uppercase tracking-widest">
                Selecciona los alumnos a promover
              </span>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
              >
                {selectedStudentIds.length === students.length ? 'Desmarcar Todos' : 'Marcar Todos'}
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
              {isLoadingStudents ? (
                <p className="p-8 text-center text-slate-400 font-bold uppercase text-[9px] animate-pulse">
                  Cargando alumnos...
                </p>
              ) : students.length === 0 ? (
                <p className="p-8 text-center text-slate-400 font-bold uppercase text-[9px]">
                  No hay alumnos matriculados en este curso.
                </p>
              ) : (
                students.map((s, idx) => {
                  const isSelected = selectedStudentIds.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleToggleSelect(s.id)}
                      className={`flex items-center gap-3 py-2.5 px-4 cursor-pointer hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/20' : ''}`}
                    >
                      <button type="button" className="text-indigo-600 shrink-0">
                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} className="text-slate-300" />}
                      </button>
                      <span className="text-[10px] font-black text-slate-500 w-6 text-center border-r border-slate-100">
                        {idx + 1}
                      </span>
                      <span className="text-[11px] font-bold text-slate-800 uppercase">
                        {s.first_surname} {s.second_surname || ''}, {s.names}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            <div className="bg-slate-50 border-t border-slate-100 py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wide">
              Seleccionados: {selectedStudentIds.length} / {students.length} alumnos.
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t border-slate-100">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleBulkPromote}
              disabled={selectedStudentIds.length === 0 || !targetYear || !targetCourseId}
              className="flex-2 px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={14} /> Iniciar Promoción Masiva
            </button>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="py-12 flex flex-col items-center justify-center text-center gap-6 min-h-[300px] animate-fade-in">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <Users className="absolute text-indigo-600" size={24} />
          </div>
          <div className="space-y-2 w-full max-w-sm">
            <h4 className="text-base font-black uppercase text-slate-900">Promoviendo Alumnos</h4>
            <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider animate-pulse">
              {currentPromotingName}
            </p>
            <p className="text-[10px] text-slate-400 font-bold uppercase">
              Procesando: {progressIndex} de {selectedStudentIds.length} ({Math.round((progressIndex / selectedStudentIds.length) * 100)}%)
            </p>
            {/* Barra de progreso visual */}
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-4 border border-slate-200/50">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${(progressIndex / selectedStudentIds.length) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col items-center justify-center text-center gap-4 py-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-50">
              <CheckCircle2 size={36} />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-black uppercase text-slate-900">¡Promoción Masiva Completada!</h4>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                Año Destino: {targetYear}  |  Curso: {targetCourses.find(c => c.id === targetCourseId)?.grade} "{targetCourses.find(c => c.id === targetCourseId)?.section}"
              </p>
            </div>
          </div>

          {/* Reporte de resultados */}
          <div className="border border-slate-200/60 rounded-2xl overflow-hidden bg-slate-50">
            <div className="bg-slate-900 text-white py-2 px-4 flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
              <span>Reporte de Operación</span>
              <div className="flex gap-3">
                <span className="text-emerald-400">Éxito: {resultsReport.success}</span>
                <span className="text-rose-400">Error: {resultsReport.failed}</span>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto p-4 space-y-1.5 font-mono text-[9px] font-bold text-slate-700 bg-white">
              {resultsReport.details.map((line, idx) => (
                <div key={idx} className="border-b border-slate-50 pb-1 last:border-0">{line}</div>
              ))}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all"
          >
            Cerrar Ventana
          </button>
        </div>
      )}
    </div>
  );
};
