import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dataService } from '../services/dataService';
import {
  Plus,
  Megaphone,
  CheckCircle2,
  Link,
  Youtube,
  Image as ImageIcon,
  Globe,
  GraduationCap,
  Play,
  AlertCircle,
  X,
  Layers
} from 'lucide-react';
import { parseTextWithLinks } from './LinkifiedText';

export const TeacherTaskAnnouncement = ({
  userData: profile,
  initialCourseId,
  taskToEdit,
  announcementToEdit,
  onClose
}: {
  userData: any;
  initialCourseId?: string;
  taskToEdit?: any;
  announcementToEdit?: any;
  onClose?: () => void;
}) => {
  const { state } = useApp();
  const [title, setTitle] = useState(taskToEdit?.title || announcementToEdit?.title || '');
  const [content, setContent] = useState(taskToEdit?.description || announcementToEdit?.content || '');
  const [courseId, setCourseId] = useState(initialCourseId || taskToEdit?.course_id || announcementToEdit?.course_id || '');
  const [type, setType] = useState<'task' | 'announcement'>(announcementToEdit ? 'announcement' : 'task');
  const [dueDate, setDueDate] = useState(
    taskToEdit?.due_date ? new Date(taskToEdit.due_date).toISOString().slice(0, 16) : ''
  );
  const [subjectId, setSubjectId] = useState(taskToEdit?.subject_id || announcementToEdit?.subject_id || '');
  const [mediaUrl, setMediaUrl] = useState(taskToEdit?.media_url || announcementToEdit?.media_url || '');
  const [linkUrl, setLinkUrl] = useState(taskToEdit?.link_url || announcementToEdit?.link_url || '');
  const [classroomUrl, setClassroomUrl] = useState(taskToEdit?.classroom_url || '');
  const [additionalCourseIds, setAdditionalCourseIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Extraer ID de YouTube para vista previa
  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const youtubeId = getYoutubeId(mediaUrl);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content || !courseId || !profile?.center_id) {
      alert('Por favor, rellena todos los campos obligatorios.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        center_id: profile.center_id,
        course_id: courseId,
        subject_id: subjectId || null,
        title,
        media_url: mediaUrl || null,
        link_url: linkUrl || null
      };

      if (taskToEdit?.id) {
        await dataService.updateTask(taskToEdit.id, {
          ...payload,
          description: content,
          classroom_url: classroomUrl || null,
          due_date: dueDate ? new Date(dueDate).toISOString() : null
        });
        alert('¡Tarea actualizada con éxito!');
      } else if (announcementToEdit?.id) {
        await dataService.updateAnnouncement(announcementToEdit.id, {
          ...payload,
          content: content
        });
        alert('¡Comunicado actualizado con éxito!');
      } else if (type === 'task') {
        await dataService.addTask({
          ...payload,
          teacher_id: profile.teacher_id || profile.id,
          description: content,
          classroom_url: classroomUrl || null,
          due_date: dueDate ? new Date(dueDate).toISOString() : null
        });

        if (additionalCourseIds.length > 0) {
          const promises = additionalCourseIds.map((cId) =>
            dataService.addTask({
              ...payload,
              course_id: cId,
              teacher_id: profile.teacher_id || profile.id,
              description: content,
              classroom_url: classroomUrl || null,
              due_date: dueDate ? new Date(dueDate).toISOString() : null
            })
          );
          await Promise.allSettled(promises);
          alert(`¡Tarea publicada con éxito en ${additionalCourseIds.length + 1} cursos!`);
        } else {
          alert('¡Tarea publicada con éxito!');
        }
      } else {
        await dataService.addAnnouncement({
          ...payload,
          sender_id: profile.id,
          sender_role: profile.role,
          content: content
        });

        if (additionalCourseIds.length > 0) {
          const promises = additionalCourseIds.map((cId) =>
            dataService.addAnnouncement({
              ...payload,
              course_id: cId,
              sender_id: profile.id,
              sender_role: profile.role,
              content: content
            })
          );
          await Promise.allSettled(promises);
          alert(`¡Comunicado publicado con éxito en ${additionalCourseIds.length + 1} cursos!`);
        } else {
          alert('¡Comunicado publicado con éxito!');
        }
      }

      // Reset Form
      setTitle('');
      setContent('');
      setDueDate('');
      setSubjectId('');
      setMediaUrl('');
      setLinkUrl('');
      setClassroomUrl('');
      setAdditionalCourseIds([]);
      if (onClose) onClose();
    } catch (error: any) {
      console.error('Error saving task/announcement:', error);
      const errMsg = error.message || error.details || JSON.stringify(error);
      alert(`Error al guardar: ${errMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    'w-full p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-xs sm:text-sm font-medium';
  const labelClass =
    'block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1';

  return (
    <div className="max-w-3xl mx-auto animate-fade-in pb-8 px-2 sm:px-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
        {/* Header con gradiente */}
        <div className="bg-indigo-600 p-5 sm:p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full -mr-20 -mt-20"></div>
          <div className="relative z-10 flex items-center gap-3.5 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center shadow-inner shrink-0">
              {type === 'task' ? <GraduationCap size={24} className="text-white" /> : <Megaphone size={24} className="text-white" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight truncate">Crear Asignación</h2>
              <p className="text-indigo-100 font-medium opacity-90 text-xs sm:text-sm truncate">
                Publica contenido multimedia para tus estudiantes
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-7">
          {/* Selector de Tipo y Clase */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2">
              <label className={labelClass}>Tipo de Publicación</label>
              <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setType('task')}
                  className={`flex-1 py-2 sm:py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${type === 'task' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Plus size={14} /> Tarea
                </button>
                <button
                  type="button"
                  onClick={() => setType('announcement')}
                  className={`flex-1 py-2 sm:py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${type === 'announcement' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Megaphone size={14} /> Comunicado
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Clase / Curso Destino (Principal)</label>
              <div className="relative">
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">-- SELECCIONAR CURSO --</option>
                  {state.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.level} {c.grade} {c.section} {c.tanda ? `(${c.tanda})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* PUBLICAR EN MÚLTIPLES CURSOS AL MISMO TIEMPO */}
          {!taskToEdit && !announcementToEdit && courseId && state.courses.length > 1 && (
            <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-indigo-600 shrink-0" />
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-800 block">
                      ¿Publicar también en otros cursos simultáneamente?
                    </label>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Asigna este {type === 'task' ? 'trabajo' : 'comunicado'} al mismo tiempo en otras secciones o grados.
                    </p>
                  </div>
                </div>
                {additionalCourseIds.length > 0 && (
                  <span className="px-2.5 py-0.5 bg-indigo-600 text-white rounded-full text-[10px] font-black shrink-0">
                    +{additionalCourseIds.length} {additionalCourseIds.length === 1 ? 'adicional' : 'adicionales'}
                  </span>
                )}
              </div>

              {/* Botones de acción rápida */}
              <div className="space-y-2 pt-1 border-t border-indigo-100">
                <div className="flex flex-wrap items-center gap-1.5 pb-1">
                  <button
                    type="button"
                    onClick={() => {
                      const curCourse = state.courses.find((c) => c.id === courseId);
                      if (curCourse) {
                        const sameLevelOrGrade = state.courses
                          .filter((c) => c.id !== courseId && (c.grade === curCourse.grade || c.level === curCourse.level))
                          .map((c) => c.id);
                        setAdditionalCourseIds(sameLevelOrGrade);
                      }
                    }}
                    className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer"
                  >
                    + Mismo Nivel / Grado
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const allOthers = state.courses.filter((c) => c.id !== courseId).map((c) => c.id);
                      setAdditionalCourseIds(allOthers);
                    }}
                    className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Seleccionar Todos
                  </button>
                  {additionalCourseIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAdditionalCourseIds([])}
                      className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 bg-white border border-rose-200 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {state.courses
                    .filter((c) => c.id !== courseId)
                    .map((c) => {
                      const isChecked = additionalCourseIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate pr-2">
                            {c.level} — {c.grade} &quot;{c.section}&quot; {c.tanda ? `(${c.tanda})` : ''}
                          </span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setAdditionalCourseIds(additionalCourseIds.filter((id) => id !== c.id));
                              } else {
                                setAdditionalCourseIds([...additionalCourseIds, c.id]);
                              }
                            }}
                            className="rounded accent-indigo-600 w-4 h-4 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* Materia y Fecha */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2">
              <label className={labelClass}>Materia Asociada</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className={inputClass}
              >
                <option value="">TODAS LAS MATERIAS / GENERAL</option>
                {state.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            {type === 'task' && (
              <div className="space-y-2 animate-in slide-in-from-right-4 duration-300">
                <label className={labelClass}>Fecha de Entrega</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={inputClass}
                  required={type === 'task'}
                />
              </div>
            )}
          </div>

          {/* Título y Contenido */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className={labelClass}>Título de la Asignación</label>
              <input
                type="text"
                placeholder="Ej: Análisis de la Segunda Guerra Mundial"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Instrucciones / Descripción</label>
              <textarea
                placeholder={
                  type === 'task'
                    ? 'Escribe aquí los pasos a seguir, recursos y criterios de evaluación... Puedes escribir enlaces (https://... o www....) y se detectarán como enlaces clicables.'
                    : 'Escribe aquí el anuncio importante para el grupo... Puedes escribir enlaces (https://... o www....) y se detectarán como enlaces clicables.'
                }
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className={`${inputClass} h-28 sm:h-32 resize-none leading-relaxed`}
                required
              />
              {content && parseTextWithLinks(content).some((p) => p.type === 'link') && (
                <p className="text-[10px] font-bold text-indigo-600 bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-100 flex items-center gap-1.5">
                  <span>🔗 Enlaces detectados en el texto. Se presentarán automáticamente como enlaces directos para los alumnos.</span>
                </p>
              )}
            </div>
          </div>

          {/* SECCIÓN MULTIMEDIA (NUEVO) */}
          {/* SECCIÓN MULTIMEDIA - OPTIMIZADA PARA NUBE */}
          <div className="space-y-4 sm:space-y-6 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
              <div className="flex items-center gap-3">
                <Globe size={20} className="text-indigo-600" />
                <h3 className="text-sm font-black uppercase text-slate-800 tracking-tighter">
                  Recursos en la Nube (Google Drive / Enlaces)
                </h3>
              </div>
              <a
                href="https://drive.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase text-indigo-600 hover:shadow-md transition-all"
              >
                <Plus size={14} /> Subir archivo a mi Drive
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className={labelClass}>
                  <Youtube size={12} className="inline mr-1" /> Vídeo de YouTube o Foto de Pizarra
                  (Link)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Pegue aquí el link de YouTube o de la foto..."
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    className={`${inputClass} pr-12 bg-white`}
                  />
                  {mediaUrl && (
                    <button
                      onClick={() => setMediaUrl('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                <p className="text-[9px] text-slate-400 font-medium px-1">
                  Tip: Toma la foto con tu celular, súbela a Drive/Google Photos y pega aquí el
                  "Link compartido".
                </p>
              </div>
              <div className="space-y-3">
                <label className={labelClass}>
                  <Link size={12} className="inline mr-1" /> Enlace de Google Drive / PDF / Web
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="https://drive.google.com/file/..."
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className={`${inputClass} pr-12 bg-white`}
                  />
                  {linkUrl && (
                    <button
                      onClick={() => setLinkUrl('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                <p className="text-[9px] text-slate-400 font-medium px-1">
                  Usar enlaces mantiene la plataforma rápida y ligera.
                </p>
              </div>
            </div>

            {type === 'task' && (
              <div className="space-y-3">
                <label className={labelClass}>
                  <GraduationCap size={12} className="inline mr-1" /> Acceso Directo a Google
                  Classroom (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Link de la tarea en Classroom..."
                  value={classroomUrl}
                  onChange={(e) => setClassroomUrl(e.target.value)}
                  className={`${inputClass} bg-white`}
                />
              </div>
            )}

            {/* VISTAS PREVIAS DINÁMICAS */}
            <div className="space-y-4">
              {youtubeId && (
                <div className="animate-in zoom-in-95 duration-500">
                  <div className="flex items-center gap-2 text-indigo-600 text-[10px] font-black uppercase mb-3">
                    <Play size={14} /> Reproductor de Vídeo Detectado
                  </div>
                  <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-white bg-slate-900">
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${youtubeId}`}
                      title="YouTube video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                </div>
              )}

              {/* Detector de Google Drive */}
              {(mediaUrl.includes('drive.google.com') || linkUrl.includes('drive.google.com')) && (
                <div className="bg-indigo-600 p-4 rounded-2xl text-white flex items-center justify-between animate-in slide-in-from-left-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Globe size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">
                        Documento Detectado
                      </p>
                      <p className="text-xs font-bold">Vínculo seguro a Google Drive activo</p>
                    </div>
                  </div>
                  <div className="text-[9px] font-black uppercase border border-white/30 px-3 py-1 rounded-full">
                    Protegido en la Nube
                  </div>
                </div>
              )}

              {/* Vista previa de imagen genérica */}
              {!youtubeId &&
                mediaUrl &&
                (mediaUrl.includes('.jpg') ||
                  mediaUrl.includes('.png') ||
                  mediaUrl.includes('.webp') ||
                  mediaUrl.includes('images.unsplash.com')) && (
                  <div className="animate-in zoom-in-95 duration-500">
                    <div className="flex items-center gap-2 text-indigo-600 text-[10px] font-black uppercase mb-3">
                      <ImageIcon size={14} /> Vista previa de la imagen
                    </div>
                    <img
                      src={mediaUrl}
                      alt="Preview"
                      className="w-full max-h-72 object-contain rounded-2xl border-4 border-white shadow-xl bg-slate-100"
                    />
                  </div>
                )}
            </div>
          </div>

          <div className="flex items-center gap-3 bg-amber-50 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-amber-200 text-amber-800">
            <AlertCircle size={20} className="shrink-0 text-amber-600" />
            <div className="space-y-0.5">
              <p className="text-[10px] font-black uppercase tracking-wider">
                Aviso de Privacidad y Almacenamiento
              </p>
              <p className="text-xs font-medium opacity-90 leading-relaxed">
                Esta plataforma prioriza el uso de enlaces externos para garantizar la máxima
                velocidad. Las tareas se publicarán en el muro del estudiante de inmediato.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {onClose && (
              <button
                type="button"
                onClick={() => {
                  if (title.trim() || content.trim()) {
                    if (window.confirm('¿Deseas cancelar? Los cambios no guardados se perderán.')) {
                      onClose();
                    }
                  } else {
                    onClose();
                  }
                }}
                className="w-full sm:w-auto px-6 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-black uppercase tracking-wider text-xs cursor-pointer transition-colors"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full flex-1 bg-slate-900 text-white py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2.5 hover:bg-black active:scale-95 transition-all shadow-xl disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Publicando...
                </div>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  Publicar {type === 'task' ? 'Tarea' : 'Comunicado'} Ahora
                  {additionalCourseIds.length > 0 && ` (+${additionalCourseIds.length} cursos)`}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
