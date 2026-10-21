import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Download,
  Volume2,
  VolumeX,
  Maximize2,
  Sparkles,
  Building2,
  BookOpen,
  GraduationCap,
  Users,
  CheckCircle2,
  RotateCcw,
  Film,
  Network
} from 'lucide-react';

interface RoleNodeData {
  id: 'gestores' | 'docentes' | 'alumnos' | 'padres';
  title: string;
  subtitle: string;
  badge: string;
  color: string;
  borderColor: string;
  bgGlow: string;
  textColor: string;
  strokeColor: string;
  icon: React.ElementType;
  coords: { x: number; y: number };
  features: { title: string; desc: string }[];
}

const ROLES_DATA: RoleNodeData[] = [
  {
    id: 'gestores',
    title: 'Gestores y Dirección',
    subtitle: 'Control Institucional 360° • Automatización Total',
    badge: 'Equipo Directivo',
    color: 'from-amber-500 to-orange-600',
    borderColor: 'border-amber-500/50',
    bgGlow: 'bg-amber-500/15',
    textColor: 'text-amber-400',
    strokeColor: '#f59e0b',
    icon: Building2,
    coords: { x: 20, y: 22 },
    features: [
      { title: 'Gestión de Alumnos', desc: 'Matrícula digital, expedientes e importación Excel en 1 clic' },
      { title: 'Gestión de Personal', desc: 'Control de nómina docente, administrativa y permisos por rol' },
      { title: 'Gestión de Calificaciones', desc: 'Emisión de boletines oficiales MINERD (P1-P4, RP y CF)' },
      { title: 'Gestión del Plantel', desc: 'Modo Control en Vivo: qué maestro está en cada aula hoy' },
      { title: 'Reportes Multi-Año', desc: 'Actas, estadísticas e historial multi-año 100% blindado' },
      { title: 'Generador de Horarios', desc: 'Algoritmo inteligente con 0% choques (Matutina, Vesp. y JEE)' },
      { title: 'Gestión de Comunicación', desc: 'Circulares digitales, avisos y alertas a toda la comunidad' },
      { title: 'Gestión Financiera', desc: 'Control de colegiaturas, pagos, recibos, becas y finanzas' }
    ]
  },
  {
    id: 'docentes',
    title: 'Cuerpo Docente',
    subtitle: 'Mi Aula Digital • Ahorro de Tiempo y Modo Offline',
    badge: 'Maestros y Profesores',
    color: 'from-blue-500 to-indigo-600',
    borderColor: 'border-blue-500/50',
    bgGlow: 'bg-blue-500/15',
    textColor: 'text-blue-400',
    strokeColor: '#3b82f6',
    icon: BookOpen,
    coords: { x: 80, y: 22 },
    features: [
      { title: 'Manejo de Aulas', desc: 'Mi Aula Virtual organizada por grado, sección y asignatura' },
      { title: 'Horario Inteligente', desc: 'Bloques horarios claros, alertas de cambio y suplencias' },
      { title: 'Control de Asistencia', desc: 'Pase de lista diario en 1 clic y porcentajes automáticos' },
      { title: 'Cuadernillo Anecdótico', desc: 'Observaciones pedagógicas, méritos e incidencias diarias' },
      { title: 'Registro de Calificaciones', desc: 'Asienta P1-P4 y Recuperación con cálculo instantáneo' },
      { title: 'Gestor de Tareas', desc: 'Publicación de deberes y control de correcciones por curso' },
      { title: 'Comunicación con Familias', desc: 'Mensajería directa con padres y recepción de excusas' },
      { title: 'Modo Offline-First (PWA)', desc: 'Trabaja sin luz ni internet; sincroniza solo al volver la red' }
    ]
  },
  {
    id: 'alumnos',
    title: 'Alumnos y Estudiantes',
    subtitle: 'Portal Estudiantil • Organización y Excelencia',
    badge: 'Comunidad Estudiantil',
    color: 'from-purple-500 to-fuchsia-600',
    borderColor: 'border-purple-500/50',
    bgGlow: 'bg-purple-500/15',
    textColor: 'text-purple-400',
    strokeColor: '#a855f7',
    icon: GraduationCap,
    coords: { x: 80, y: 78 },
    features: [
      { title: 'Manejo de Horarios', desc: 'Consulta actualizada de asignaturas, bloques horarios y aulas' },
      { title: 'Comunicación Directa', desc: 'Avisos de profesores, orientaciones y calendario escolar' },
      { title: 'Gestión de Tareas', desc: 'Control de asignaciones pendientes, entregas y materias corregidas' },
      { title: 'Avance Académico', desc: 'Monitoreo de calificaciones por período y Cuadro de Honor' }
    ]
  },
  {
    id: 'padres',
    title: 'Padres y Familias',
    subtitle: 'App Móvil Familiar • Supervisión y Tranquilidad 24/7',
    badge: 'Madres, Padres y Tutores',
    color: 'from-emerald-500 to-teal-600',
    borderColor: 'border-emerald-500/50',
    bgGlow: 'bg-emerald-500/15',
    textColor: 'text-emerald-400',
    strokeColor: '#10b981',
    icon: Users,
    coords: { x: 20, y: 78 },
    features: [
      { title: 'Supervisión Directa', desc: 'Monitoreo desde el celular de asistencia, puntualidad y tareas' },
      { title: 'Rendimiento en Tiempo Real', desc: 'Boletines oficiales en PDF descargables con 1 solo toque' },
      { title: 'Comunicación Efectiva', desc: 'Envío de excusas médicas en línea y circulares sin papelería' },
      { title: 'Seguimiento a Todas Horas', desc: 'Acceso 24/7 al progreso académico, conducta y estado de cuenta' }
    ]
  }
];

export const EdugestPromoVideo: React.FC = () => {
  const [viewMode, setViewMode] = useState<'video' | 'interactive'>('video');
  const [selectedRoleIdx, setSelectedRoleIdx] = useState<number>(0);
  const [autoTour, setAutoTour] = useState<boolean>(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Recorrido automático en el modo interactivo
  useEffect(() => {
    if (viewMode !== 'interactive' || !autoTour) return;
    const timer = setInterval(() => {
      setSelectedRoleIdx((prev) => (prev + 1) % ROLES_DATA.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [viewMode, autoTour]);

  const handleTogglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const handleToggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  const handleFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.requestFullscreen) {
      v.requestFullscreen();
    }
  };

  const currentRole = ROLES_DATA[selectedRoleIdx];
  const CurrentRoleIcon = currentRole.icon;

  return (
    <div className="space-y-6">
      {/* Selector superior: Video Oficial vs Recorrido Interactivo + Botón de Descarga discreto */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 p-2.5 rounded-2xl border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('video')}
            className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              viewMode === 'video'
                ? 'bg-gradient-to-r from-brand-blue to-brand-accent text-white shadow-lg shadow-brand-blue/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Film size={15} />
            <span>Video Oficial</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('interactive')}
            className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              viewMode === 'interactive'
                ? 'bg-gradient-to-r from-brand-blue to-brand-accent text-white shadow-lg shadow-brand-blue/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Network size={15} />
            <span>Recorrido Interactivo</span>
          </button>
        </div>

        <a
          href="/edugest-promo.mp4"
          download="Edugest_Video_Oficial.mp4"
          title="Descargar video"
          className="p-1.5 text-slate-600 hover:text-slate-400 opacity-35 hover:opacity-80 transition-opacity flex items-center gap-1 text-[10px] rounded-lg"
        >
          <Download size={12} />
        </a>
      </div>

      {/* MODO 1: REPRODUCTOR DE VIDEO OFICIAL */}
      {viewMode === 'video' && (
        <div className="relative rounded-[2.5rem] overflow-hidden border border-white/15 bg-slate-950 shadow-2xl p-2 sm:p-4 group">
          <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 relative">
            <video
              ref={videoRef}
              src="/edugest-promo.mp4"
              className="w-full h-full object-contain bg-slate-950"
              controls
              playsInline
              preload="metadata"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />

            {/* Overlay limpio antes de iniciar reproducción */}
            {!isPlaying && (
              <div
                onClick={handleTogglePlay}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center space-y-5 cursor-pointer transition-opacity hover:bg-slate-950/50"
              >
                <div className="relative flex items-center justify-center">
                  <div className="absolute -inset-4 rounded-full bg-brand-blue/30 blur-xl animate-pulse" />
                  <div className="w-20 h-20 sm:w-24 sm:h-24 relative group-hover:scale-110 transition-transform duration-300">
                    <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl border-2 border-white/30 bg-slate-950 flex items-center justify-center">
                      <img
                        src="/icono 512x512.jpeg"
                        alt="Edugest Icon"
                        className="w-full h-full object-cover scale-[1.08]"
                      />
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg border-2 border-slate-950 z-10">
                      <Play size={18} className="fill-white ml-0.5" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 max-w-xl">
                  <h3 className="text-xl sm:text-3xl font-black text-white tracking-tight">
                    Conectando a Gestores, Docentes, Padres y Alumnos
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 font-medium">
                    Descubre cómo Edugest enlaza a toda tu comunidad educativa en un solo ecosistema en tiempo real.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Barra inferior de controles rápidos */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
              </button>
              <button
                type="button"
                onClick={handleToggleMute}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer transition-colors"
                title="Silenciar / Activar Audio"
              >
                {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              <button
                type="button"
                onClick={handleFullscreen}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer transition-colors"
                title="Pantalla Completa"
              >
                <Maximize2 size={15} />
              </button>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
              <Sparkles size={13} className="text-brand-accent" />
              <span>Gestores • Docentes • Alumnos • Padres — Conectados en Tiempo Real</span>
            </div>
          </div>
        </div>
      )}

      {/* MODO 2: RECORRIDO INTERACTIVO */}
      {viewMode === 'interactive' && (
        <div className="rounded-[2.5rem] border border-white/15 bg-slate-950 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <style>{`
            @keyframes dashFlow {
              to {
                stroke-dashoffset: -48;
              }
            }
            .animate-connection-line {
              stroke-dasharray: 12 12;
              animation: dashFlow 1.2s linear infinite;
            }
          `}</style>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Columna Izquierda: Red de Conectividad con el Icono de Edugest en el Centro */}
            <div className="lg:col-span-5 relative h-[420px] bg-slate-900/70 rounded-3xl border border-white/10 p-4 flex items-center justify-center overflow-hidden">
              {/* Líneas SVG de conexión desde el centro (50%, 50%) hacia los 4 nodos */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                {ROLES_DATA.map((role, idx) => {
                  const isSelected = idx === selectedRoleIdx;
                  return (
                    <g key={role.id}>
                      <line
                        x1="50"
                        y1="50"
                        x2={role.coords.x}
                        y2={role.coords.y}
                        stroke={role.strokeColor}
                        strokeWidth={isSelected ? '1.4' : '0.6'}
                        strokeOpacity={isSelected ? '0.45' : '0.2'}
                      />
                      <line
                        x1="50"
                        y1="50"
                        x2={role.coords.x}
                        y2={role.coords.y}
                        stroke={role.strokeColor}
                        strokeWidth={isSelected ? '1.8' : '0.9'}
                        className="animate-connection-line"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Nodos de los 4 Roles */}
              {ROLES_DATA.map((role, idx) => {
                const RoleIcon = role.icon;
                const isSelected = idx === selectedRoleIdx;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      setAutoTour(false);
                      setSelectedRoleIdx(idx);
                    }}
                    style={{ left: `${role.coords.x}%`, top: `${role.coords.y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 transition-all duration-300 cursor-pointer z-10 ${
                      isSelected ? 'scale-115' : 'opacity-80 hover:opacity-100 hover:scale-105'
                    }`}
                  >
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 shadow-xl transition-all ${
                        isSelected
                          ? `bg-gradient-to-br ${role.color} text-white border-white shadow-brand-blue/40`
                          : 'bg-slate-950 text-slate-300 border-white/20'
                      }`}
                    >
                      <RoleIcon size={24} />
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        isSelected
                          ? 'bg-white text-slate-950 border-white shadow-md'
                          : 'bg-slate-950/90 text-slate-300 border-white/15'
                      }`}
                    >
                      {role.id}
                    </span>
                  </button>
                );
              })}

              {/* Icono Central de Edugest */}
              <div className="relative z-20 flex flex-col items-center">
                <div className="absolute -inset-6 rounded-full bg-brand-blue/30 blur-2xl animate-pulse" />
                <div className="w-24 h-24 rounded-[1.8rem] bg-slate-950 overflow-hidden border-2 border-indigo-400 shadow-2xl shadow-brand-blue/50 flex items-center justify-center relative">
                  <img
                    src="/icono 512x512.jpeg"
                    alt="Edugest Icon"
                    className="w-full h-full object-cover scale-[1.08]"
                  />
                </div>
                <span className="mt-2 px-3 py-0.5 rounded-full bg-brand-blue text-white text-[9px] font-black uppercase tracking-widest shadow-md">
                  Edugest
                </span>
              </div>
            </div>

            {/* Columna Derecha: Funciones Destacadas del Rol en el Recorrido */}
            <div className="lg:col-span-7 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${currentRole.color} text-white flex items-center justify-center shadow-lg`}>
                    <CurrentRoleIcon size={24} />
                  </div>
                  <div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${currentRole.textColor}`}>
                      {currentRole.badge} • Conectado en Vivo
                    </span>
                    <h3 className="text-2xl font-black text-white">{currentRole.title}</h3>
                    <p className="text-xs text-slate-400">{currentRole.subtitle}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAutoTour(!autoTour)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                    autoTour
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  <RotateCcw size={12} className={autoTour ? 'animate-spin' : ''} />
                  <span>{autoTour ? 'Recorrido Automático Activo' : 'Activar Recorrido Automático'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentRole.features.map((feat, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl bg-slate-900/90 border ${currentRole.borderColor} hover:bg-slate-900 transition-all flex items-start gap-3`}
                  >
                    <CheckCircle2 size={18} className={`${currentRole.textColor} shrink-0 mt-0.5`} />
                    <div>
                      <h4 className="text-xs font-black text-white">{feat.title}</h4>
                      <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{feat.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
