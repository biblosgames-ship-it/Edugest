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
  X
} from 'lucide-react';

export const TeacherTaskAnnouncement = ({ 
  userData: profile, 
  initialCourseId, 
  onClose 
}: { 
  userData: any; 
  initialCourseId?: string; 
  onClose?: () => void; 
}) => {
  const { state } = useApp();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [courseId, setCourseId] = useState(initialCourseId || '');
  const [type, setType] = useState<'task' | 'announcement'>('task');
  const [dueDate, setDueDate] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [classroomUrl, setClassroomUrl] = useState('');
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

      if (type === 'task') {
        await dataService.addTask({
          ...payload,
          teacher_id: profile.teacher_id || profile.id,
          description: content,
          classroom_url: classroomUrl || null,
          due_date: dueDate ? new Date(dueDate).toISOString() : null
        });
      } else {
        await dataService.addAnnouncement({
          ...payload,
          sender_id: profile.id,
          sender_role: profile.role,
          content: content
        });
      }

      // Reset Form
      setTitle('');
      setContent('');
      setDueDate('');
      setSubjectId('');
      setMediaUrl('');
      setLinkUrl('');
      setClassroomUrl('');
      alert(`¡${type === 'task' ? 'Tarea' : 'Comunicado'} publicado con éxito!`);
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
    'w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-medium';
  const labelClass =
    'block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1';

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-10">
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden">
        {/* Header con gradiente */}
        <div className="bg-indigo-600 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full -mr-20 -mt-20"></div>
          <div className="relative z-10 flex items-center gap-6">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner">
              {type === 'task' ? <GraduationCap size={32} /> : <Megaphone size={32} />}
            </div>
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tight">Crear Asignación</h2>
              <p className="text-indigo-100 font-medium opacity-80 text-sm">
                Publica contenido multimedia para tus estudiantes
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-10">
          {/* Selector de Tipo y Clase */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className={labelClass}>Tipo de Publicación</label>
              <div className="flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setType('task')}
                  className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${type === 'task' ? 'bg-white text-indigo-600 shadow-lg scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Plus size={14} /> Tarea
                </button>
                <button
                  type="button"
                  onClick={() => setType('announcement')}
                  className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${type === 'announcement' ? 'bg-white text-indigo-600 shadow-lg scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Megaphone size={14} /> Comunicado
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <label className={labelClass}>Clase / Curso Destino</label>
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
                      {c.level} {c.grade} {c.section}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Materia y Fecha */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
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
              <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
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
          <div className="space-y-6">
            <div className="space-y-4">
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
            <div className="space-y-4">
              <label className={labelClass}>Instrucciones / Descripción</label>
              <textarea
                placeholder={
                  type === 'task'
                    ? 'Escribe aquí los pasos a seguir, recursos y criterios de evaluación...'
                    : 'Escribe aquí el anuncio importante para el grupo...'
                }
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className={`${inputClass} h-40 resize-none leading-relaxed`}
                required
              />
            </div>
          </div>

          {/* SECCIÓN MULTIMEDIA (NUEVO) */}
          {/* SECCIÓN MULTIMEDIA - OPTIMIZADA PARA NUBE */}
          <div className="space-y-8 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200">
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

          <div className="flex items-center gap-4 bg-amber-50 p-6 rounded-[2rem] border border-amber-100 text-amber-700">
            <AlertCircle size={24} className="shrink-0" />
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider">
                Aviso de Privacidad y Almacenamiento
              </p>
              <p className="text-xs font-medium opacity-90">
                Esta plataforma prioriza el uso de enlaces externos para garantizar la máxima
                velocidad. Las tareas se publicarán en el muro del estudiante de inmediato.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-4 hover:bg-black hover:scale-[1.02] active:scale-95 transition-all shadow-2xl disabled:opacity-50"
          >
            {isSaving ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                Publicando...
              </div>
            ) : (
              <>
                <CheckCircle2 size={22} />
                Publicar {type === 'task' ? 'Tarea' : 'Comunicado'} Ahora
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
