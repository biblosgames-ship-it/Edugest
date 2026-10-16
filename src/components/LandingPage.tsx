import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  WifiOff,
  Clock,
  BookOpen,
  Calendar,
  Users,
  CheckCircle2,
  DollarSign,
  PlayCircle,
  HelpCircle,
  ChevronDown,
  Layers,
  Award,
  Zap,
  Lock,
  MessageCircle,
  Smartphone,
  ExternalLink,
  X,
  FileSpreadsheet,
  Activity,
  GraduationCap,
  Building2,
  Star,
  Quote,
  Video,
  School,
  Play,
  PhoneCall,
  Check
} from 'lucide-react';
import { Logo } from './Logo';
import { supabase } from '../lib/supabase';

interface LandingPageProps {
  onBackToLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onBackToLogin }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [activeModuleTab, setActiveModuleTab] = useState<'academico' | 'horarios' | 'alumnos' | 'finanzas' | 'offline'>('academico');
  const [selectedTutorial, setSelectedTutorial] = useState<any | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeRoleView, setActiveRoleView] = useState<'gestion' | 'docentes' | 'padres' | 'alumnos'>('gestion');
  
  // Teléfono del asesor comercial / soporte
  const ADVISOR_PHONE = '829-410-8036';
  const WHATSAPP_NUMBER = '18294108036';

  // ID del video de YouTube para testimonios
  const [youtubeVideoId, setYoutubeVideoId] = useState<string>('dQw4w9WgXcQ');
  const [isPlayingVideo, setIsPlayingVideo] = useState<boolean>(false);

  // Desplazamiento suave al montar
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Logos Oficiales de los Centros Vinculados a EduGest (Extraídos de Storage Oficial)
  const officialCenterLogos = [
    {
      name: 'Centro Educativo Cristiano Génesis',
      src: '/192x192 logo.jpeg'
    },
    {
      name: 'Liceo Prof. Antonio Desí',
      src: '/center-logos/d0621bbf-3d51-488b-915d-da0caa6d3b3a-0.45385004745117496.jpeg'
    },
    {
      name: 'Colegio Evangélico Betuel',
      src: '/center-logos/fec113df-2fb2-4888-bfdf-01b33b4f21c6-0.2751029210569045.jpg'
    },
    {
      name: 'Liceo Secundario Juan Pablo Duarte (Higüey)',
      src: '/center-logos/3ef0b515-592e-4fe8-9252-d8b5be488255-0.6054536390038939.png'
    },
    {
      name: 'Colegio Los Serafines',
      src: '/center-logos/9410d965-311b-49b2-9d5e-d4975200f9ea-0.30538160898575895.png'
    },
    {
      name: 'Entidad Educativa Ramírez AM. "SHADDAI"',
      src: '/center-logos/aab786d7-b2bd-4dd2-849a-c8c2a9943a5a-0.4940092184286047.jpeg'
    },
    {
      name: 'Centro Materno Infantil La Milagrosa',
      src: '/center-logos/eadbc5c9-0022-4ddc-8786-76ae1b4f607e-0.6091858344531844.png'
    },
    {
      name: 'Colegio Cristiano Casita de Amor',
      src: '/center-logos/77e5ec85-30c5-4356-a9e4-5dd48fa641e3-0.6898420260092065.jpg'
    },
    {
      name: 'Centro Educativo Piaget',
      src: '/center-logos/500607f1-1c0e-4683-9fa9-794fad971c39-0.17646599843726718.png'
    }
  ];

  // Testimonios de la Comunidad Educativa con fotos y cargos
  const testimonials = [
    {
      name: 'Lic. Ramona Mercedes',
      role: 'Directora Académica',
      center: 'Centro Educativo Cristiano Génesis',
      photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
      quote: 'EduGest transformó por completo nuestro centro. Pasamos de tardar semanas consolidando notas en papel a emitir los boletines oficiales del MINERD en apenas una tarde. La tranquilidad que nos da no tiene precio.',
      stars: 5,
      highlight: 'Boletines listos en 1 tarde'
    },
    {
      name: 'Prof. Carlos Mendoza',
      role: 'Coordinador Pedagógico',
      center: 'Liceo Prof. Antonio Desí',
      photo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=300&q=80',
      quote: 'El generador de horarios y el panel en vivo resolvieron los eternos choques de aulas en la Jornada Extendida. Ahora sabemos con total exactitud qué docente está en cada aula y quién está disponible para suplencias.',
      stars: 5,
      highlight: 'Cero choques en Jornada Extendida'
    },
    {
      name: 'Licda. Yokasta Peña',
      role: 'Docente de Nivel Secundario',
      center: 'Colegio Evangélico Betuel',
      photo: 'https://images.unsplash.com/photo-1580894732454-defbe4d78881?auto=format&fit=crop&w=300&q=80',
      quote: 'Lo que más amo como docente es que si se va el internet o la luz en el aula, sigo pasando lista y digitando las calificaciones P1 y P2 en mi celular. Cuando regreso a casa, todo se sincroniza solo sin perder una sola nota.',
      stars: 5,
      highlight: 'Funciona 100% sin internet'
    },
    {
      name: 'Ing. Marcos Rivas',
      role: 'Encargado de Registro y Secretaría',
      center: 'Instituto Politécnico Moderno',
      photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      quote: 'El soporte multi-año es impecable. Cuando abrimos el año 2026-2027 pudimos consultar actas y expedientes de 2025 sin que se alterara ningún dato histórico. La importación desde Excel es ultra rápida.',
      stars: 5,
      highlight: 'Historial multi-año protegido'
    }
  ];

  // Planes sincronizados con la arquitectura de SaaS Admin Panel
  const defaultPlans = [
    {
      id: 'basico',
      name: 'Básico',
      subtitle: 'Para colegios pequeños o centros en etapa inicial',
      price_monthly: 50,
      price_yearly: 500,
      max_students: 100,
      max_teachers: 10,
      max_managers: 3,
      max_support: 3,
      max_users: 350,
      features: [
        'Hasta 100 Estudiantes matriculados',
        'Hasta 10 Docentes con aulas activas',
        'Hasta 3 Gestores y 3 de Apoyo',
        'Registro Digital de Calificaciones MINERD',
        'Toma de Asistencia diaria y boletines PDF',
        'Importación de estudiantes desde Excel',
        'Soporte Técnico Estándar'
      ],
      popular: false
    },
    {
      id: 'pro',
      name: 'Pro',
      subtitle: 'El plan más elegido por liceos y colegios consolidados',
      price_monthly: 100,
      price_yearly: 1000,
      max_students: 500,
      max_teachers: 30,
      max_managers: 10,
      max_support: 10,
      max_users: 1500,
      features: [
        'Hasta 500 Estudiantes matriculados',
        'Hasta 30 Docentes con aulas activas',
        'Hasta 10 Gestores y 10 de Apoyo (1,500 usuarios)',
        'Generador Inteligente de Horarios Anti-Choques',
        'Panel de Control en Vivo en Tiempo Real',
        'Modo Offline Seguro con Sincronización PWA',
        'Portal para Familias y Estudiantes',
        'Gestión Multi-Año Histórica Segregada',
        'Soporte Prioritario por WhatsApp'
      ],
      popular: true
    },
    {
      id: 'premium',
      name: 'Premium',
      subtitle: 'Para instituciones grandes de alta demanda y múltiples tandas',
      price_monthly: 200,
      price_yearly: 2000,
      max_students: 1500,
      max_teachers: 100,
      max_managers: 30,
      max_support: 30,
      max_users: 5000,
      features: [
        'Hasta 1,500 Estudiantes matriculados',
        'Hasta 100 Docentes con aulas activas',
        'Hasta 30 Gestores y 30 de Apoyo (5,000 usuarios)',
        'Módulo Completo de Finanzas y Cobranzas',
        'Carnets de Estudiantes y Códigos QR',
        'Tandas combinadas (Matutina, Vespertina y JEE)',
        'Capacitación Virtual para Todo el Personal',
        'Copias de seguridad diarias en la nube',
        'Soporte Dedicado 24/7'
      ],
      popular: false
    },
    {
      id: 'ilimitado',
      name: 'Ilimitado',
      subtitle: 'Redes de centros, politécnicos o distritos educativos',
      price_monthly: 500,
      price_yearly: 5000,
      max_students: 99999,
      max_teachers: 9999,
      max_managers: 9999,
      max_support: 9999,
      max_users: 999999,
      features: [
        'Estudiantes y Docentes Ilimitados',
        'Usuarios y Personal de Apoyo Ilimitados',
        'Múltiples Centros Educativos Centralizados',
        'Personalizaciones de Actas y Reportes MINERD',
        'Servidor y Dominio Personalizado Exclusivo',
        'Gerente de Cuenta Asignado',
        'SLA de Disponibilidad 99.9%'
      ],
      popular: false
    }
  ];

  const [saasPlans, setSaasPlans] = useState(defaultPlans);

  // Cargar planes dinámicos de saas_plans si están disponibles en base de datos
  useEffect(() => {
    supabase
      .from('saas_plans')
      .select('*')
      .order('price_monthly', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const merged = defaultPlans.map((dp) => {
            const dbMatch = data.find((p: any) => p.name.toLowerCase() === dp.name.toLowerCase());
            if (dbMatch) {
              return {
                ...dp,
                price_monthly: dbMatch.price_monthly,
                price_yearly: dbMatch.price_yearly || dbMatch.price_monthly * 10,
                max_students: dbMatch.max_students,
                max_teachers: dbMatch.max_teachers,
                max_managers: dbMatch.max_managers,
                max_support: dbMatch.max_support,
                max_users: dbMatch.max_users
              };
            }
            return dp;
          });
          setSaasPlans(merged);
        }
      })
      .catch(() => {});
  }, []);

  const modulesData = {
    academico: {
      title: 'Registro Digital de Calificaciones (MINERD)',
      tag: 'Alineado a la Normativa Dominicana',
      description: 'Plataforma adaptada a las 4 evaluaciones parciales (P1, P2, P3, P4), Recuperación Pedagógica (RP), Cálculo de Calificación Final (CF) y emisión de boletines automáticos sin errores humanos.',
      highlights: [
        'Cálculo de promedios instantáneo y bloqueo de notas fuera de rango.',
        'Manejo completo para Nivel Inicial, Primario y Secundario (Académico y Técnico).',
        'Boletines oficiales de calificaciones en PDF listos para imprimir en 1 clic.',
        'Auditoría y control de permisos de edición por docente y fechas límite.'
      ],
      icon: BookOpen,
      badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
    },
    horarios: {
      title: 'Generador Inteligente de Horarios & Panel en Vivo',
      tag: 'Cero Choques Horarios',
      description: 'Distribución algorítmica de cargas docentes por asignatura y aula para tandas Matutina, Vespertina y Jornada Escolar Extendida (JEE). Conoce qué sucede en cada aula en tiempo real.',
      highlights: [
        'Algoritmo anti-choques docentes y de aulas físicas.',
        'Panel de Control en Vivo: visualiza al instante qué maestro está en qué aula hoy.',
        'Detección inmediata de personal docente libre para suplencias de emergencia.',
        'Proyector de horas futuras y soporte para tandas combinadas.'
      ],
      icon: Clock,
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    },
    alumnos: {
      title: 'Gestión de Alumnos & Preservación Multi-Año',
      tag: 'Historial Sagrado e Intacto',
      description: 'El único sistema donde el cambio de año escolar (2024-2025, 2025-2026, 2026-2027) jamás altera, borra ni sobreescribe el pasado. Consulta historiales y actas en cualquier momento.',
      highlights: [
        'Importación masiva de estudiantes y personal docente desde Excel en segundos.',
        'Promoción automática de grado y conservación de estudiantes egresados.',
        'Generación de códigos de estudiante, carnets y fichas acumulativas.',
        'Búsqueda ultra-rápida por cédula, código SIGERD o nombres sin importar acentos.'
      ],
      icon: Users,
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    },
    finanzas: {
      title: 'Módulo de Finanzas, Colegiaturas & Facturación',
      tag: 'Control Económico Total',
      description: 'Administración de pagos, cuotas escolares, balances pendientes, emisión de recibos y reportes financieros para colegios privados y centros subvencionados.',
      highlights: [
        'Registro ágil de cobros por estudiante y cálculo automático de mora.',
        'Estados de cuenta individuales descargables para padres de familia.',
        'Reportes de cierre de caja diario, mensual y conciliaciones bancarias.',
        'Permisos especiales de acceso restringidos para el área de tesorería.'
      ],
      icon: DollarSign,
      badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    },
    offline: {
      title: 'Arquitectura Offline-First con Sincronización',
      tag: 'Trabaja Sin Internet',
      description: 'Diseñado pensando en la realidad de los centros educativos. Si se cae la red eléctrica o el internet, los docentes siguen pasando asistencia y digitando notas sin perder ni un solo dato.',
      highlights: [
        'Base de datos local segura mediante IndexedDB y Stale-While-Revalidate.',
        'Sincronización en segundo plano tan pronto se restablece la conexión.',
        'Aplicación web progresiva (PWA): instálala en computadoras, tablets o celulares.',
        'Máxima velocidad: las pantallas abren en milisegundos gracias a la caché inteligente.'
      ],
      icon: WifiOff,
      badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/20'
    }
  };

  const tutorials = [
    {
      id: 'docentes',
      role: 'Docentes',
      title: 'Cómo Asentar Notas y Pasar Lista en 3 Minutos',
      description: 'Guía paso a paso para maestros: acceso a Mi Aula Virtual, toma de asistencia diaria, ingreso de calificaciones P1-P4 y recuperación pedagógica.',
      duration: '4:15 min',
      steps: [
        'Inicia sesión con tu correo institucional asignado.',
        'Entra a "Registro Digital" o "Mi Aula Virtual".',
        'Selecciona el grado y materia asignada.',
        'Digita las calificaciones numéricas: el sistema valida el rango 0-100 automáticamente.',
        'Haz clic en "Guardar Calificaciones" o sigue en modo local si estás sin red.'
      ]
    },
    {
      id: 'horarios',
      role: 'Directores & Coordinadores',
      title: 'Generación Automática de Horarios y Control en Vivo',
      description: 'Aprende a configurar bloques horarios, asignar docentes a materias y generar el horario escolar sin choques, monitoreando el liceo en vivo.',
      duration: '6:30 min',
      steps: [
        'Ingresa al módulo "Horario Escolar".',
        'Configura los períodos de tu tanda (Matutina, Vespertina o Jornada Extendida).',
        'Importa o ingresa la carga horaria por docente.',
        'Presiona "Generar Horario Inteligente" y revisa la matriz visual sin conflictos.',
        'Utiliza el "Panel de Control" para ver en tiempo real quién imparte clases en este minuto.'
      ]
    },
    {
      id: 'matricula',
      role: 'Secretaría & Registro',
      title: 'Importación Masiva desde Excel y Cambio de Año Escolar',
      description: 'Cómo subir listados de 500+ estudiantes en 30 segundos, gestionar secciones y realizar el traspaso al nuevo año escolar manteniendo el historial intacto.',
      duration: '5:45 min',
      steps: [
        'Ve a "Gestión de Estudiantes".',
        'Descarga la plantilla oficial en Excel.',
        'Pega la lista de alumnos con nombres, apellidos y fecha de nacimiento.',
        'Arrastra el archivo al importador para verificación automática de duplicados.',
        'Promociona alumnos de grado al finalizar el año sin alterar registros pasados.'
      ]
    },
    {
      id: 'padres',
      role: 'Padres y Familias',
      title: 'Consulta de Boletines y Tareas desde el Teléfono',
      description: 'Acceso transparente para tutores: cómo revisar el boletín de notas de sus hijos, avisos de conducta y circulares desde cualquier smartphone.',
      duration: '3:20 min',
      steps: [
        'Accede con el enlace oficial de EduGest de tu centro educativo.',
        'Ingresa con la cuenta autorizada por la secretaría escolar.',
        'Visualiza el resumen académico del estudiante en tiempo real.',
        'Descarga el boletín oficial en formato PDF con 1 toque.',
        'Recibe comunicados urgentes del director o docente titular.'
      ]
    }
  ];

  const faqs = [
    {
      q: '¿Qué ocurre si el centro se queda sin internet o sin energía eléctrica?',
      a: 'EduGest cuenta con arquitectura Offline-First exclusiva. Los docentes y secretarios pueden seguir pasando asistencia y asentando calificaciones normalmente en sus laptops o celulares sin conexión a internet. Tan pronto regresa la señal o la energía, el sistema sincroniza todo en segundo plano sin duplicar registros.'
    },
    {
      q: '¿Las calificaciones y boletines se ajustan a la escala y formato del MINERD?',
      a: 'Sí. EduGest fue construido 100% alineado a la normativa dominicana: contempla los períodos P1, P2, P3 y P4, el cálculo automático de Recuperación Pedagógica (RP), los criterios de aprobación (calificación mínima 70 puntos para secundaria) y genera los boletines oficiales en PDF listos para imprimir o enviar por WhatsApp.'
    },
    {
      q: '¿Cómo protege EduGest las notas de años anteriores cuando inicia un nuevo año escolar?',
      a: 'EduGest utiliza una arquitectura de aislamiento por ciclo lectivo. El año 2024-2025 o 2025-2026 queda blindado como histórico: los listados de alumnos, asignaturas y calificaciones de esos ciclos jamás se sobreescriben ni se mezclan con el año en curso (2026-2027), permitiendo emitir certificados de años pasados con total exactitud.'
    },
    {
      q: '¿Podemos importar todos los alumnos y docentes desde nuestros archivos de Excel?',
      a: 'Completamente. EduGest incluye asistentes de importación en 1 clic que leen archivos Excel con nombres, matrículas, grados y secciones. En menos de 2 minutos puedes tener un centro con 800 alumnos completamente cargado y listo para operar.'
    },
    {
      q: '¿Cuánto tiempo toma capacitar al cuerpo docente?',
      a: 'La interfaz es ultra-intuitiva y limpia. Un docente promedio domina la toma de lista y la carga de calificaciones en menos de 10 minutos de inducción. Además, ofrecemos tutoriales interactivos en video paso a paso.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-brand-blue selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Estilos CSS para el carrusel infinito continuo (Marquee) */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee-infinite {
          display: flex;
          width: max-content;
          animation: marquee 32s linear infinite;
        }
        .animate-marquee-infinite:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Barra de Navegación Superior Fija */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/85 backdrop-blur-xl border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="bg-gradient-to-br from-brand-blue to-brand-accent p-2.5 rounded-2xl shadow-lg shadow-brand-blue/30">
              <Logo className="w-8 h-8 text-white" />
            </div>
            <div>
              <span className="text-xl font-black text-white tracking-tight flex items-center gap-1.5">
                EduGest <Sparkles className="text-brand-accent w-4 h-4" />
              </span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block -mt-1">
                Gestión Educativa Inteligente
              </span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-7 text-xs font-bold text-slate-300">
            <a href="#modulos" className="hover:text-white transition-colors">Funcionalidades</a>
            <a href="#ventajas" className="hover:text-white transition-colors">Ventajas</a>
            <a href="#testimonios" className="hover:text-white transition-colors">Testimonios</a>
            <a href="#video-testimonios" className="hover:text-white transition-colors">Video</a>
            <a href="#tutoriales" className="hover:text-white transition-colors">Tutoriales</a>
            <a href="#planes" className="hover:text-white transition-colors">Planes</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hola,%20me%20gustaria%20recibir%20asesoria%20sobre%20EduGest%20para%20mi%20centro.`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-[11px] font-black uppercase tracking-wider transition-colors whitespace-nowrap"
            >
              <MessageCircle size={13} />
              <span>CONTACTO</span>
            </a>

            <button
              type="button"
              onClick={onBackToLogin}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-950 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all shadow-md shadow-white/10 active:scale-95 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <span>INICIAR SESIÓN</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-36 pb-20 px-6 overflow-hidden">
        {/* Glows de fondo */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-brand-blue/30 to-brand-accent/20 blur-[140px] pointer-events-none rounded-full" />
        <div className="absolute top-20 right-10 w-[300px] h-[300px] bg-emerald-500/10 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-8">
          {/* Logo EduGest Grande Arriba + Frase Oficial Centralizada en 2 Líneas */}
          <div className="flex flex-col items-center justify-center space-y-4">
            {/* Logo EduGest Mucho Más Grande */}
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[2.2rem] bg-gradient-to-br from-brand-blue via-indigo-600 to-brand-accent p-5 flex items-center justify-center shadow-2xl shadow-brand-blue/50 border border-white/20 ring-4 ring-white/10 hover:scale-105 transition-all duration-300">
              <Logo className="w-full h-full text-white filter drop-shadow-xl" />
            </div>

            {/* Texto en dos líneas centralizado */}
            <div className="flex flex-col items-center justify-center space-y-1.5 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs sm:text-sm font-black uppercase tracking-widest shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>EduGest Cloud v6.0</span>
              </div>
              <p className="text-sm sm:text-base font-bold text-slate-200 tracking-tight">
                La evolución tecnológica de los centros educativos
              </p>
            </div>
          </div>

          {/* Slogan Oficial */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08]">
            El Futuro de la Gestión <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-brand-blue via-indigo-400 to-brand-accent bg-clip-text text-transparent">
              Escolar Optimizada
            </span>
          </h1>

          {/* Frase Oficial de Inicio */}
          <div className="space-y-5 max-w-3xl mx-auto">
            <p className="text-base sm:text-lg text-slate-300 font-medium leading-relaxed">
              EduGest es una plataforma de gestión educativa que permite el manejo digital de escuelas públicas y privadas a través de diversas herramientas que optimizan, automatizan o simplifican procesos complejos del sector educativo.
            </p>

            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-brand-blue/15 via-indigo-500/10 to-brand-accent/15 border border-brand-blue/25 backdrop-blur-sm shadow-inner">
              <p className="text-sm sm:text-base font-bold text-indigo-200 italic tracking-wide">
                “Automatiza horarios, simplifica el control académico y conecta a toda la comunidad educativa en una sola plataforma premium”.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              type="button"
              onClick={onBackToLogin}
              className="px-8 py-4 bg-gradient-to-r from-brand-blue to-indigo-600 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-brand-blue/30 active:scale-95 flex items-center gap-3 cursor-pointer"
            >
              <span>Acceder a Mi Centro</span>
              <ArrowRight size={18} />
            </button>

            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hola,%20me%20gustaria%20hablar%20con%20un%20asesor%20sobre%20EduGest.`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-wider rounded-2xl border border-emerald-500/40 transition-all flex items-center gap-3 shadow-lg shadow-emerald-950/40 active:scale-95 cursor-pointer"
            >
              <MessageCircle size={18} />
              <span>Hablar con un Asesor por WhatsApp</span>
            </a>
          </div>

          {/* Estadísticas de Confianza */}
          <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto text-left">
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <p className="text-3xl font-black text-white">100%</p>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Alineado al MINERD</p>
              <p className="text-[11px] text-slate-500 mt-0.5">P1, P2, P3, P4, RP y Final</p>
            </div>
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <p className="text-3xl font-black text-emerald-400">Offline</p>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Resistente a Caídas</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Sigue trabajando sin luz ni red</p>
            </div>
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <p className="text-3xl font-black text-indigo-400">0%</p>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Choques Horarios</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Matutina, Vesp. y Extendida</p>
            </div>
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <p className="text-3xl font-black text-amber-400">Multi-Año</p>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Historial Intacto</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Audita ciclos pasados sin alteración</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN: ECOSISTEMA CONECTADO (UNA APP PARA CADA ROL, 100% VINCULADA EN TIEMPO REAL) */}
      <section id="ecosistema" className="py-24 px-6 border-t border-white/10 bg-gradient-to-b from-slate-950 via-slate-900/60 to-slate-950 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-brand-blue/10 blur-[150px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto space-y-16 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20">
              <Layers size={14} /> Conectividad Institucional Total
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Una app especializada para cada rol, <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-brand-blue via-indigo-400 to-brand-accent bg-clip-text text-transparent">
                100% vinculadas en tiempo real
              </span>
            </h2>
            <p className="text-slate-300 font-medium text-sm sm:text-base leading-relaxed">
              EduGest interconecta a todo el centro educativo en un único ecosistema cloud. Cada actor accede a una interfaz optimizada para sus tareas, pero compartiendo la misma información al instante sin intermediarios ni papeleo.
            </p>
          </div>

          {/* Selector interactivo de roles */}
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto bg-slate-950/80 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
            {[
              { id: 'gestion', label: 'Equipo de Gestión', icon: Building2, color: 'text-amber-400' },
              { id: 'docentes', label: 'Docentes', icon: BookOpen, color: 'text-blue-400' },
              { id: 'padres', label: 'Padres y Familias', icon: Users, color: 'text-emerald-400' },
              { id: 'alumnos', label: 'Estudiantes', icon: GraduationCap, color: 'text-purple-400' }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeRoleView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveRoleView(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-brand-blue to-indigo-600 text-white shadow-lg shadow-brand-blue/30 scale-102'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-white' : tab.color} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tarjetas de los 4 Pilares Interconectados */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1. EQUIPO DE GESTIÓN */}
            <div
              onClick={() => setActiveRoleView('gestion')}
              className={`p-7 rounded-3xl transition-all duration-300 flex flex-col justify-between border cursor-pointer relative overflow-hidden group ${
                activeRoleView === 'gestion'
                  ? 'bg-gradient-to-b from-amber-500/15 via-slate-900 to-slate-950 border-amber-500/40 shadow-2xl shadow-amber-500/10 scale-[1.02]'
                  : 'bg-slate-950/70 hover:bg-slate-900/90 border-white/10 hover:border-amber-500/30'
              }`}
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md">
                  <Building2 size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                    App de Dirección
                  </span>
                  <h3 className="text-xl font-black text-white mt-1">Equipo de Gestión</h3>
                  <p className="text-xs text-slate-400 mt-1">Directores, Coordinadores y Orientación</p>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-white/5">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Control en Vivo:</strong> Monitorea en tiempo real qué docente está impartiendo clase en cada aula.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Horarios Anti-Choques:</strong> Generación algorítmica para matutina, vespertina y extendida.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Historial Multi-Año:</strong> Consulta ciclos pasados sin alterar calificaciones presentes.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Boletines MINERD:</strong> Emisión de actas, informes de rendimiento y nómina escolar.</span>
                  </li>
                </ul>
              </div>
              <div className="pt-6 mt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-bold text-amber-300">
                <span>Supervisión 360°</span>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              </div>
            </div>

            {/* 2. DOCENTES */}
            <div
              onClick={() => setActiveRoleView('docentes')}
              className={`p-7 rounded-3xl transition-all duration-300 flex flex-col justify-between border cursor-pointer relative overflow-hidden group ${
                activeRoleView === 'docentes'
                  ? 'bg-gradient-to-b from-blue-500/15 via-slate-900 to-slate-950 border-blue-500/40 shadow-2xl shadow-blue-500/10 scale-[1.02]'
                  : 'bg-slate-950/70 hover:bg-slate-900/90 border-white/10 hover:border-blue-500/30'
              }`}
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-md">
                  <BookOpen size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                    App de Aula
                  </span>
                  <h3 className="text-xl font-black text-white mt-1">Cuerpo Docente</h3>
                  <p className="text-xs text-slate-400 mt-1">Maestros y Profesores por Asignatura</p>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-white/5">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-blue-400 shrink-0 mt-0.5" />
                    <span><strong>Registro Digital Oficial:</strong> Asienta notas P1, P2, P3, P4 y Recuperación Pedagógica en segundos.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-blue-400 shrink-0 mt-0.5" />
                    <span><strong>Pase de Lista Inteligente:</strong> Asistencia diaria con 1 clic y cálculo de porcentajes automáticos.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-blue-400 shrink-0 mt-0.5" />
                    <span><strong>Modo Offline Exclusivo:</strong> Trabaja sin internet ni luz; todo se sincroniza solo al volver la red.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-blue-400 shrink-0 mt-0.5" />
                    <span><strong>Tareas & Anecdotario:</strong> Publica deberes escolares y registra observaciones pedagógicas.</span>
                  </li>
                </ul>
              </div>
              <div className="pt-6 mt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-bold text-blue-300">
                <span>Ahorro de 20h/mes</span>
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              </div>
            </div>

            {/* 3. PADRES Y FAMILIAS */}
            <div
              onClick={() => setActiveRoleView('padres')}
              className={`p-7 rounded-3xl transition-all duration-300 flex flex-col justify-between border cursor-pointer relative overflow-hidden group ${
                activeRoleView === 'padres'
                  ? 'bg-gradient-to-b from-emerald-500/15 via-slate-900 to-slate-950 border-emerald-500/40 shadow-2xl shadow-emerald-500/10 scale-[1.02]'
                  : 'bg-slate-950/70 hover:bg-slate-900/90 border-white/10 hover:border-emerald-500/30'
              }`}
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
                  <Smartphone size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    App Móvil Familiar
                  </span>
                  <h3 className="text-xl font-black text-white mt-1">Padres & Familias</h3>
                  <p className="text-xs text-slate-400 mt-1">Tutores, Madres y Padres de Familia</p>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-white/5">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Boletín en el Celular:</strong> Descarga notas oficiales en PDF con 1 toque sin tener que ir al centro.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Avisos de Inasistencia:</strong> Notificación inmediata si su hijo no ha entrado al aula de clases.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Excusas en Línea:</strong> Justifica faltas médicas o familiares directo a la dirección y profesor.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Cero Papelería:</strong> Circulares, avisos institucionales y conducta sin intermediarios.</span>
                  </li>
                </ul>
              </div>
              <div className="pt-6 mt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-bold text-emerald-300">
                <span>Tranquilidad Total</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            </div>

            {/* 4. ESTUDIANTES */}
            <div
              onClick={() => setActiveRoleView('alumnos')}
              className={`p-7 rounded-3xl transition-all duration-300 flex flex-col justify-between border cursor-pointer relative overflow-hidden group ${
                activeRoleView === 'alumnos'
                  ? 'bg-gradient-to-b from-purple-500/15 via-slate-900 to-slate-950 border-purple-500/40 shadow-2xl shadow-purple-500/10 scale-[1.02]'
                  : 'bg-slate-950/70 hover:bg-slate-900/90 border-white/10 hover:border-purple-500/30'
              }`}
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-md">
                  <GraduationCap size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">
                    Portal del Alumno
                  </span>
                  <h3 className="text-xl font-black text-white mt-1">Estudiantes</h3>
                  <p className="text-xs text-slate-400 mt-1">Nivel Inicial, Primaria y Secundaria</p>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-white/5">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-purple-400 shrink-0 mt-0.5" />
                    <span><strong>Horario de Clases al Día:</strong> Consulta qué materia y aula te corresponde en cada período.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-purple-400 shrink-0 mt-0.5" />
                    <span><strong>Gestor de Tareas:</strong> Revisa instrucciones de proyectos y fechas de entrega sin olvidos.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-purple-400 shrink-0 mt-0.5" />
                    <span><strong>Cuadro de Honor:</strong> Conoce tu índice académico y progreso por período evaluativo.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-purple-400 shrink-0 mt-0.5" />
                    <span><strong>Agenda & Eventos:</strong> Efemérides escolares, olimpiadas del saber y actividades deportivas.</span>
                  </li>
                </ul>
              </div>
              <div className="pt-6 mt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-bold text-purple-300">
                <span>Excelencia Estudiantil</span>
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Banner Central de Sincronización Automática */}
          <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 shadow-2xl relative overflow-hidden backdrop-blur-xl">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-blue to-brand-accent flex items-center justify-center text-white shadow-xl shadow-brand-blue/30 shrink-0">
                  <Activity size={32} className="animate-pulse" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      Flujo de Datos en Tiempo Real
                    </span>
                  </div>
                  <h4 className="text-lg sm:text-2xl font-black text-white">
                    Un solo clic en el aula actualiza al Director y a la Familia
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                    Cuando el maestro pasa la lista o califica en su tablet, el Equipo de Gestión ve las métricas en su panel en vivo de inmediato, y la familia recibe la notificación en su móvil. Sin papeleos, sin cruces erróneos y con total transparencia.
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex flex-col sm:flex-row items-center gap-3">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hola,%20me%20gustaria%20conocer%20mas%20sobre%20el%20ecosistema%20conectado%20de%20EduGest.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-950/40 flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <MessageCircle size={15} />
                  <span>Solicitar Demo por WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN: RED DE CENTROS (CARRUSEL INFINITO EN UNA SOLA LÍNEA HORIZONTAL SIN DETALLES) */}
      <section id="centros" className="py-20 border-t border-b border-white/10 bg-slate-900/60 relative overflow-hidden">
        <div className="max-w-5xl mx-auto text-center px-6 mb-12 space-y-3">
          <span className="text-xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3.5 py-1 rounded-full border border-emerald-500/20">
            Red de Excelencia
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            La familia EduGest sigue creciendo
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium max-w-2xl mx-auto">
            Únete a la red de centros que han pasado a un siguiente nivel usando las herramientas que te ofrecemos.
          </p>
        </div>

        {/* Carrusel Continuo Infinito (Marquee Horizontal) */}
        <div className="relative w-full overflow-hidden py-3">
          {/* Difuminados en los bordes para transición suave */}
          <div className="absolute top-0 bottom-0 left-0 w-24 sm:w-44 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent z-10 pointer-events-none" />
          <div className="absolute top-0 bottom-0 right-0 w-24 sm:w-44 bg-gradient-to-l from-slate-950 via-slate-950/80 to-transparent z-10 pointer-events-none" />

          {/* Cinta giratoria de logos duplicada para bucle continuo */}
          <div className="animate-marquee-infinite items-center gap-8 py-4">
            {[...officialCenterLogos, ...officialCenterLogos].map((center, index) => (
              <div
                key={index}
                className="shrink-0 w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-white/95 hover:bg-white p-3.5 shadow-xl border border-white/20 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:shadow-brand-blue/20 group cursor-default"
                title={center.name}
              >
                <img
                  src={center.src}
                  alt={center.name}
                  className="max-w-full max-h-full object-contain filter drop-shadow-sm select-none pointer-events-none group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Botón sutil para contactar al asesor y unirse a la red */}
        <div className="text-center pt-8">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hola,%20me%20gustaria%20vincular%20mi%20centro%20educativo%20a%20la%20red%20de%20EduGest.`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer group"
          >
            <span>¿Quieres vincular tu centro a la red? <strong>Habla de inmediato con nuestro asesor por WhatsApp</strong></span>
            <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform text-emerald-400" />
          </a>
        </div>
      </section>

      {/* SECCIÓN: TESTIMONIOS DE PERSONAS CON FOTOS */}
      <section id="testimonios" className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20">
              <Star size={14} /> Voces de la Comunidad
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Lo que dicen directores, coordinadores y docentes
            </h2>
            <p className="text-slate-400 font-medium text-sm sm:text-base">
              Experiencias reales de quienes usan EduGest cada día para dirigir sus instituciones y evaluar a sus estudiantes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {testimonials.map((item, idx) => (
              <div
                key={idx}
                className="p-8 sm:p-10 rounded-[2.5rem] bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 hover:border-amber-400/30 transition-all shadow-2xl relative flex flex-col justify-between space-y-6"
              >
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-amber-400">
                      {[...Array(item.stars)].map((_, i) => (
                        <Star key={i} size={16} fill="currentColor" />
                      ))}
                    </div>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/5 text-slate-300 border border-white/10">
                      {item.highlight}
                    </span>
                  </div>

                  <p className="text-sm sm:text-base text-slate-200 font-medium italic leading-relaxed">
                    "{item.quote}"
                  </p>
                </div>

                <div className="pt-6 border-t border-white/5 flex items-center gap-4">
                  <img
                    src={item.photo}
                    alt={item.name}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-brand-accent/40 shadow-md shrink-0"
                  />
                  <div>
                    <h4 className="text-base font-black text-white">{item.name}</h4>
                    <p className="text-xs font-bold text-brand-accent">{item.role}</p>
                    <p className="text-[11px] text-slate-400 font-medium">{item.center}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECCIÓN: VIDEO DE YOUTUBE CON TESTIMONIOS Y DEMOSTRACIÓN */}
      <section id="video-testimonios" className="py-24 px-6 border-t border-white/5 bg-slate-900/40 relative">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest text-brand-accent bg-brand-accent/10 border border-brand-accent/20">
              <Video size={14} /> Demostración Audiovisual
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Historias de éxito y EduGest en acción
            </h2>
            <p className="text-slate-400 font-medium text-sm sm:text-base">
              Mira cómo funciona la plataforma en video, con testimonios y recorrido por las herramientas que facilitan el trabajo escolar.
            </p>
          </div>

          {/* Contenedor del Video de YouTube Estilizado y Responsivo */}
          <div className="relative rounded-[2.5rem] overflow-hidden border border-white/15 bg-slate-950 shadow-2xl p-2 sm:p-4 group">
            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-900 relative">
              {!isPlayingVideo ? (
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent flex flex-col items-center justify-center p-6 text-center space-y-6">
                  {/* Botón Central Play */}
                  <button
                    type="button"
                    onClick={() => setIsPlayingVideo(true)}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-brand-blue to-brand-accent text-white flex items-center justify-center shadow-2xl shadow-brand-blue/50 hover:scale-110 active:scale-95 transition-all cursor-pointer group"
                    aria-label="Reproducir Video"
                  >
                    <Play size={36} className="ml-1 text-white fill-white group-hover:scale-110 transition-transform" />
                  </button>

                  <div className="space-y-2 max-w-lg">
                    <h3 className="text-xl sm:text-2xl font-black text-white">
                      EduGest: Presentación Oficial y Testimonios
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 font-medium">
                      Descubre cómo los centros optimizan su tiempo y eliminan el estrés del fin de período evaluativo.
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 bg-white/10 px-4 py-1.5 rounded-full backdrop-blur-md">
                    <span>Duración estimada: 3:30 min</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-bold">HD 1080p</span>
                  </div>
                </div>
              ) : (
                <iframe
                  className="w-full h-full rounded-2xl"
                  src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&rel=0`}
                  title="EduGest Video de Testimonios"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>

            {/* Barra inferior del reproductor con opción de personalizar o contactar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-brand-accent" />
                <span>EduGest Dominicana • Canal Oficial de Capacitación</span>
              </div>
              <div className="flex items-center gap-4">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hola,%20vi%20el%20video%20de%20EduGest%20y%20me%20gustaria%20agendar%20una%20demostracion.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5"
                >
                  <MessageCircle size={13} />
                  <span>Chatear por WhatsApp</span>
                </a>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setIsPlayingVideo(!isPlayingVideo)}
                  className="text-xs font-bold text-white hover:text-brand-accent transition-colors cursor-pointer"
                >
                  {isPlayingVideo ? 'Cerrar Reproductor' : 'Reproducir Video'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN: MÓDULOS Y LO QUE OFRECEMOS */}
      <section id="modulos" className="py-24 px-6 border-t border-white/5 relative bg-slate-900/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-brand-accent bg-brand-accent/10 px-3 py-1 rounded-full border border-brand-accent/20">
              Ecosistema Integral
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Todo lo que tu institución necesita en un solo lugar
            </h2>
            <p className="text-slate-400 font-medium text-sm sm:text-base">
              Elimina los cuadernos de notas en papel, las hojas de cálculo desordenadas y los reportes inconsistentes.
            </p>
          </div>

          {/* Selector interactivo de módulos */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
            {[
              { id: 'academico', label: 'Registro Digital', icon: BookOpen },
              { id: 'horarios', label: 'Horarios & Panel en Vivo', icon: Clock },
              { id: 'alumnos', label: 'Alumnos & Multi-Año', icon: Users },
              { id: 'finanzas', label: 'Finanzas & Cobros', icon: DollarSign },
              { id: 'offline', label: 'Modo Offline PWA', icon: WifiOff }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeModuleTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveModuleTab(tab.id as any)}
                  className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-brand-blue to-brand-accent text-white shadow-xl shadow-brand-blue/25 scale-105'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/5'
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tarjeta de Detalle del Módulo Activo */}
          {(() => {
            const current = modulesData[activeModuleTab];
            const CurrentIcon = current.icon;
            return (
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-8 sm:p-12 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                  <div className="lg:col-span-7 space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border border-white/10 bg-white/5">
                      <CurrentIcon size={14} className="text-brand-accent" />
                      <span className="text-slate-300">{current.tag}</span>
                    </div>

                    <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                      {current.title}
                    </h3>

                    <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                      {current.description}
                    </p>

                    <div className="space-y-3 pt-2">
                      {current.highlights.map((h, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                          <span className="text-xs sm:text-sm text-slate-300 font-medium">{h}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={onBackToLogin}
                        className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-950 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2"
                      >
                        <span>Probar Este Módulo Ahora</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Panel visual interactivo de demostración */}
                  <div className="lg:col-span-5 bg-slate-950/80 p-6 rounded-3xl border border-white/10 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                        <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">edugest-preview-live</span>
                    </div>

                    <div className="p-4 bg-slate-900 rounded-2xl border border-white/5 space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                        <span>Estado de Sincronización</span>
                        <span className="text-emerald-400 font-black flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Activo & Protegido
                        </span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-brand-blue to-emerald-400 w-full" />
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-white/5 rounded-xl flex items-center justify-between">
                        <span className="text-slate-400">Nivel de Centro</span>
                        <span className="font-bold text-white">Inicial • Primario • Secundario (JEE)</span>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl flex items-center justify-between">
                        <span className="text-slate-400">Ciclo Lectivo Activo</span>
                        <span className="font-bold text-brand-accent">2026-2027</span>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl flex items-center justify-between">
                        <span className="text-slate-400">Historiales Protegidos</span>
                        <span className="font-bold text-emerald-400">2024-2025, 2025-2026 (Intactos)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* SECCIÓN: ¿POR QUÉ EDUGEST ES ÚNICO? */}
      <section id="ventajas" className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              Diferenciadores Clave
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              ¿Por qué los mejores centros eligen EduGest?
            </h2>
            <p className="text-slate-400 font-medium text-sm sm:text-base">
              Compara las ventajas que ninguna otra plataforma en el mercado ofrece para la educación dominicana.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-[2rem] bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 space-y-4 hover:border-brand-blue/50 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center text-brand-accent">
                <WifiOff size={24} />
              </div>
              <h3 className="text-xl font-black text-white">No se detiene si no hay internet</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Otros sistemas quedan completamente bloqueados sin conexión. En EduGest el maestro continúa digitando notas y pasando lista sin pausa; la sincronización es automática al restablecerse el WiFi.
              </p>
            </div>

            <div className="p-8 rounded-[2rem] bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 space-y-4 hover:border-brand-blue/50 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-xl font-black text-white">Historial de Años Anteriores Sagrado</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Al iniciar un nuevo año (como 2026-2027 o 2027-2028), las notas pasadas quedan blindadas e inmutables. Puedes consultar los expedientes de 2025 o 2024 sin peligro de sobrescritura accidental.
              </p>
            </div>

            <div className="p-8 rounded-[2rem] bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 space-y-4 hover:border-brand-blue/50 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Activity size={24} />
              </div>
              <h3 className="text-xl font-black text-white">Monitoreo en Tiempo Real del Liceo</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                El Director y Coordinador Pedagógico pueden abrir el Panel de Control y ver exactamente qué maestro está en qué aula a las 9:15 AM o a las 2:30 PM, y qué docentes están libres para suplencias.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN: TUTORIALES Y VIDEOS GUIADOS */}
      <section id="tutoriales" className="py-24 px-6 border-t border-white/5 bg-slate-900/30">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
              Aprende en Minutos
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Tutoriales y Demostraciones por Perfil
            </h2>
            <p className="text-slate-400 font-medium text-sm sm:text-base">
              Capacitación directa y clara para directores, docentes, secretarios y familias.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tutorials.map((t) => (
              <div
                key={t.id}
                className="p-8 rounded-[2rem] bg-slate-900/90 border border-white/10 hover:border-brand-accent/50 transition-all space-y-6 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-blue/20 text-brand-blue border border-brand-blue/30">
                      {t.role}
                    </span>
                    <span className="text-xs font-mono text-slate-500 flex items-center gap-1.5">
                      <Clock size={13} /> {t.duration}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-white">
                    {t.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {t.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedTutorial(t)}
                    className="px-5 py-2.5 bg-brand-accent/20 hover:bg-brand-accent text-brand-accent hover:text-white rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <PlayCircle size={15} />
                    <span>Ver Paso a Paso</span>
                  </button>
                  <span className="text-[11px] font-bold text-slate-500">5 pasos clave</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MODAL DETALLE DE TUTORIAL */}
      {selectedTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 max-w-2xl w-full p-8 rounded-[2.5rem] shadow-2xl space-y-6 relative">
            <button
              onClick={() => setSelectedTutorial(null)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-accent/20 text-brand-accent border border-brand-accent/30">
                Tutorial para {selectedTutorial.role}
              </span>
              <h3 className="text-2xl font-black text-white">{selectedTutorial.title}</h3>
              <p className="text-xs text-slate-400">{selectedTutorial.description}</p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 space-y-3">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Flujo de Trabajo Recomendado:</p>
              {selectedTutorial.steps.map((st: string, idx: number) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-brand-blue/20 text-brand-blue text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-xs text-slate-300 font-medium leading-relaxed">{st}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => setSelectedTutorial(null)}
                className="px-5 py-2.5 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedTutorial(null);
                  onBackToLogin();
                }}
                className="px-6 py-2.5 bg-white text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-2"
              >
                <span>Acceder y Aplicar</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN: PLANES Y PRECIOS (SINCRONIZADOS CON SAAS ADMIN PANEL) */}
      <section id="planes" className="py-24 px-6 border-t border-white/5 relative">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-black uppercase tracking-widest text-brand-orange bg-brand-orange/10 px-3 py-1 rounded-full border border-brand-orange/20">
              Inversión Transparente
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Planes configurados a la medida de tu centro
            </h2>
            <p className="text-slate-400 font-medium text-sm sm:text-base">
              Sin costos ocultos. Diseñados con las capacidades exactas de gestión para tu plantilla docente y estudiantil.
            </p>

            {/* Switch Mensual / Anual */}
            <div className="inline-flex items-center gap-3 p-1.5 rounded-2xl bg-slate-900 border border-white/10 mt-6">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  billingCycle === 'monthly' ? 'bg-white text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                  billingCycle === 'yearly' ? 'bg-gradient-to-r from-brand-blue to-brand-accent text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Anual</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-400 text-slate-950 font-black">
                  2 Meses Gratis
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {saasPlans.map((p) => {
              const price = billingCycle === 'yearly' ? Math.round(p.price_yearly / 12) : p.price_monthly;
              return (
                <div
                  key={p.name}
                  className={`p-8 rounded-[2rem] flex flex-col justify-between transition-all relative ${
                    p.popular
                      ? 'bg-gradient-to-b from-slate-900 to-indigo-950/40 border-2 border-brand-blue shadow-2xl shadow-brand-blue/20 scale-105'
                      : 'bg-slate-900/60 border border-white/10 hover:border-white/20'
                  }`}
                >
                  {p.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-brand-blue to-brand-accent text-white text-[9px] font-black uppercase tracking-widest shadow-md">
                      Más Elegido
                    </div>
                  )}

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-black text-white">{p.name}</h3>
                      <p className="text-[11px] text-slate-400 mt-1 min-h-[32px]">{p.subtitle}</p>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-white">${price}</span>
                      <span className="text-xs font-bold text-slate-400">USD / mes</span>
                    </div>
                    {billingCycle === 'yearly' && (
                      <p className="text-[10px] text-emerald-400 font-bold -mt-3">Facturado ${p.price_yearly} al año</p>
                    )}

                    {/* Especificaciones de SaaS Admin */}
                    <div className="p-3.5 bg-white/5 rounded-2xl space-y-1.5 text-xs border border-white/5">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Estudiantes:</span>
                        <span className="font-bold text-white">{p.max_students > 10000 ? 'Ilimitados' : p.max_students}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Docentes:</span>
                        <span className="font-bold text-white">{p.max_teachers > 1000 ? 'Ilimitados' : p.max_teachers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Gestores:</span>
                        <span className="font-bold text-white">{p.max_managers > 1000 ? 'Ilimitados' : p.max_managers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Equipo Apoyo:</span>
                        <span className="font-bold text-white">{p.max_support > 1000 ? 'Ilimitados' : p.max_support}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-white/5 text-brand-blue-light font-bold">
                        <span>Usuarios Totales:</span>
                        <span>{p.max_users > 10000 ? 'Ilimitados' : p.max_users}</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-white/5">
                      {p.features.map((f, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                          <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                          <span className="font-medium leading-tight">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-8">
                    <a
                      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hola, me interesa solicitar información sobre el Plan ${p.name} de EduGest para mi centro educativo.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        p.popular
                          ? 'bg-brand-blue hover:bg-brand-blue-dark text-white shadow-lg shadow-brand-blue/30'
                          : 'bg-white hover:bg-slate-100 text-slate-950'
                      }`}
                    >
                      <MessageCircle size={15} />
                      <span>Cotizar por WhatsApp</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECCIÓN: PREGUNTAS FRECUENTES (FAQ) */}
      <section id="faq" className="py-24 px-6 border-t border-white/5 bg-slate-900/30">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <span className="text-xs font-black uppercase tracking-widest text-sky-400 bg-sky-500/10 px-3 py-1 rounded-full border border-sky-500/20">
              Respuestas Claras
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Preguntas Frecuentes
            </h2>
            <p className="text-slate-400 font-medium text-sm">
              Resolvemos tus dudas sobre seguridad, compatibilidad y funcionamiento diario.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-slate-900 border border-white/10 overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 font-black text-sm sm:text-base text-white hover:text-brand-blue transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      size={18}
                      className={`text-slate-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-brand-blue' : ''}`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-6 pt-1 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-white/5">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FOOTER & CTA FINAL CON NÚMERO DE TELÉFONO DEL ASESOR */}
      <footer className="py-20 px-6 border-t border-white/10 bg-slate-950 relative overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-12 relative z-10">
          <div className="p-10 sm:p-16 rounded-[3rem] bg-gradient-to-r from-brand-blue/30 via-indigo-900/30 to-brand-accent/30 border border-white/10 text-center space-y-6 backdrop-blur-xl">
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              ¿Listo para transformar tu centro educativo?
            </h2>
            <p className="max-w-2xl mx-auto text-slate-300 text-sm sm:text-base font-medium">
              Habla directamente con nuestro asesor educativo o accede ahora mismo al sistema.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={onBackToLogin}
                className="px-8 py-4 bg-white hover:bg-slate-100 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-xl active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <span>Entrar a la Plataforma</span>
                <ArrowRight size={16} />
              </button>
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hola,%20me%20gustaria%20hablar%20con%20un%20asesor%20sobre%20EduGest.`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center gap-2.5 cursor-pointer"
              >
                <MessageCircle size={18} />
                <span>Hablar con un Asesor por WhatsApp</span>
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-white/5 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <Logo className="w-6 h-6 text-slate-400" />
              <span className="font-bold text-slate-400">EduGest Dominicana Cloud • Soporte y Asesoría Oficial vía WhatsApp</span>
            </div>
            <p className="text-[11px] font-bold">
              © 2026 EduGest SaaS. Todos los derechos reservados. Compatible con la normativa MINERD.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
