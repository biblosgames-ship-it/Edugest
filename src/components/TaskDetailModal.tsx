import React from 'react';
import {
  X,
  Calendar,
  BookOpen,
  User,
  Video,
  Link as LinkIcon,
  GraduationCap,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { LinkifiedText } from './LinkifiedText';

interface TaskDetailModalProps {
  task: any | null;
  subjectName?: string;
  teacherName?: string;
  onClose: () => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  subjectName = 'General',
  teacherName,
  onClose
}) => {
  if (!task) return null;

  const isLate = task.due_date && new Date(task.due_date) < new Date();
  const cleanDescription = (task.description || '')
    .replace(/<!--period:P[1-4]-->\s*/gi, '')
    .trim();

  // Formato amigable de fecha de entrega
  const getDueDateLabel = () => {
    if (!task.due_date) return 'Sin fecha límite especificada';
    try {
      const date = new Date(task.due_date);
      return date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return task.due_date;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado del Modal */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-gradient-to-r from-slate-50 to-indigo-50/30">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm">
                {subjectName}
              </span>
              {task.period && (
                <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest">
                  Período {task.period.replace('P', '')}
                </span>
              )}
              <span
                className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                  isLate
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {isLate ? (
                  <>
                    <AlertCircle size={12} /> Tarea Vencida
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={12} /> Tarea Pendiente
                  </>
                )}
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
              {task.title}
            </h3>

            {teacherName && (
              <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <User size={13} className="text-indigo-600" />
                Docente: <span className="text-slate-800">{teacherName}</span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-sm"
            title="Cerrar ventana"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del Modal: Descripción Completa y Recursos */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          {/* Fecha de Entrega */}
          <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Calendar size={16} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Fecha límite de entrega
              </p>
              <p className="font-black text-slate-800 capitalize">
                {getDueDateLabel()}
              </p>
            </div>
          </div>

          {/* Instrucciones Completas (Sin recortar) */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <BookOpen size={14} className="text-indigo-600" />
              Indicaciones e Instrucciones de la Tarea:
            </h4>
            <div className="p-5 bg-slate-50/70 rounded-2xl border border-slate-200/80 text-slate-700 text-sm leading-relaxed">
              {cleanDescription ? (
                <LinkifiedText text={cleanDescription} className="text-sm" />
              ) : (
                <p className="italic text-slate-400 text-xs">
                  No se agregaron instrucciones adicionales para esta asignación.
                </p>
              )}
            </div>
          </div>

          {/* Enlaces y Recursos Adjuntos */}
          {(task.media_url || task.link_url || task.classroom_url) && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Recursos y Enlaces Adjuntos
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {task.media_url && (
                  <a
                    href={task.media_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center gap-3 transition-all group shadow-sm"
                  >
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Video size={18} />
                    </div>
                    <div className="overflow-hidden">
                      <span className="text-xs font-black text-slate-900 block truncate group-hover:text-indigo-600">
                        Recurso Multimedia / Video
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium block truncate">
                        Abrir video explicativo
                      </span>
                    </div>
                  </a>
                )}

                {task.link_url && (
                  <a
                    href={task.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center gap-3 transition-all group shadow-sm"
                  >
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <LinkIcon size={18} />
                    </div>
                    <div className="overflow-hidden">
                      <span className="text-xs font-black text-slate-900 block truncate group-hover:text-indigo-600">
                        Drive / Documento
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium block truncate">
                        Ver archivo de la tarea
                      </span>
                    </div>
                  </a>
                )}

                {task.classroom_url && (
                  <a
                    href={task.classroom_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-2xl flex items-center gap-3 transition-all group shadow-sm sm:col-span-2"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <GraduationCap size={18} />
                    </div>
                    <div className="overflow-hidden">
                      <span className="text-xs font-black text-slate-900 block truncate group-hover:text-emerald-600">
                        Abrir en Google Classroom
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium block truncate">
                        Ir al aula virtual para entregar o comentar
                      </span>
                    </div>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
