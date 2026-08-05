import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Toaster, toast } from 'react-hot-toast';
import { Dashboard } from './components/Dashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentManagement } from './components/StudentManagement';
import { GeneralReports } from './components/GeneralReports';
import { DigitalRegister } from './components/DigitalRegister';
import { GradeReports } from './components/GradeReports';
import { ScheduleViewer } from './components/ScheduleViewer';
import { ControlDashboard } from './components/ControlDashboard';
import { TeacherPerformanceModule } from './components/TeacherPerformanceModule';
import { ComplianceDashboard } from './components/ComplianceDashboard';
import { Agenda } from './components/Agenda';
import { CommunicationGenerator } from './components/CommunicationGenerator';
import { TeacherTaskAnnouncement } from './components/TeacherTaskAnnouncement';
import { AdminDashboard } from './components/AdminDashboard';
import { CourseForm } from './components/CourseForm';
import { TeacherForm } from './components/TeacherForm';
import { SubjectForm } from './components/SubjectForm';
import { AssignmentForm } from './components/AssignmentForm';
import { AcademicRequirementForm } from './components/AcademicRequirementForm';
import { PreferencesForm } from './components/PreferencesForm';
import { SchoolYearForm } from './components/SchoolYearForm';
import { SaaSAdminPanel } from './components/SaaSAdminPanel';
import { FinanceModule } from './components/finances/FinanceModule';
import { Login } from './components/Login';
import { InvitationForm } from './components/InvitationForm';
import { CenterRegistrationForm } from './components/CenterRegistrationForm';
import { FacilityDashboard } from './components/facility/FacilityDashboard';
import { AppProvider, useApp, useSupabase } from './context/AppContext';
import {
  LayoutDashboard,
  Users,
  FileBarChart,
  FileSpreadsheet,
  CalendarDays,
  Monitor,
  PlusCircle,
  Activity,
  ClipboardCheck,
  Calendar,
  MessageSquare,
  ShieldCheck,
  BookOpen,
  Book,
  Link,
  Sliders,
  Globe,
  Loader2,
  DollarSign,
  Wrench,
  Menu,
  Lock
} from 'lucide-react';
import { useStats } from './hooks/useStats';

const ROLE_FALLBACKS: Record<string, string[]> = {
  admin: [
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
    'finances',
    'admin',
    'facility'
  ],
  management_teacher: [
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
    'facility'
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
    'finances',
    'facility'
  ],
  coordinator: [
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
    'facility'
  ],
  teacher: ['dashboard', 'schedule', 'agenda', 'digital-register', 'tasks', 'communications'],
  student: ['dashboard', 'schedule', 'agenda'],
  parent: ['dashboard', 'schedule', 'agenda'],
  support: ['dashboard', 'facility', 'agenda'],
  supervisor: ['dashboard', 'facility', 'agenda'],
  conserje: ['dashboard', 'facility', 'agenda'],
  pending: []
};

import { supabase } from './lib/supabase';

function AppContent() {
  const { user, profile, isAuthReady } = useSupabase();
  const { isSubscriptionExpired } = useApp();
  const [activeView, setActiveView] = useState('dashboard');
  const [dataView, setDataView] = useState('course');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: stats } = useStats();
  const [isFinancesUnlocked, setIsFinancesUnlocked] = useState(false);
  const [pinError, setPinError] = useState('');
  const [activationMode, setActivationMode] = useState<'invitation' | 'registration'>('invitation');
  // Volver a bloquear finanzas si se cambia de vista
  useEffect(() => {
    if (activeView !== 'finances') {
      setIsFinancesUnlocked(false);
      setPinError('');
    }
  }, [activeView]);

  const studentCount = stats?.studentCount || 0;
  const totalUserCount = stats?.totalUserCount || 0;

  const isSuperAdmin = !!profile?.is_superadmin;

  // Obtener paneles permitidos (del perfil o por defecto según su rol)
  const allowed =
    profile?.allowed_panels && profile.allowed_panels.length > 0
      ? profile.allowed_panels
      : ROLE_FALLBACKS[profile?.role || 'student'] || ROLE_FALLBACKS.student;

  // Redirigir al primer panel permitido si intenta acceder a uno no autorizado
  useEffect(() => {
    if (isAuthReady && profile) {
      const isAuthorized = allowed.includes(activeView) || (activeView === 'saas' && isSuperAdmin);
      if (!isAuthorized) {
        const firstAllowed = allowed[0] || 'dashboard';
        setActiveView(firstAllowed);
      }
    }
  }, [profile, activeView, allowed, isAuthReady, isSuperAdmin]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center font-black animate-pulse bg-slate-950 text-white text-4xl tracking-widest">
        EDUGEST
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (isSubscriptionExpired && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden text-center">
        {/* Background blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-900/20 blur-[120px] rounded-full animate-pulse"></div>
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-800/20 blur-[120px] rounded-full animate-pulse"
          style={{ animationDelay: '2s' }}
        ></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none"></div>

        <div className="max-w-md w-full relative z-10 glass-premium p-12 rounded-[3.5rem] border border-white/10 backdrop-blur-3xl space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl font-black text-rose-500 uppercase tracking-tight">
              Suscripción Vencida
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              El acceso de su centro educativo a Edugest ha sido suspendido debido a la falta de
              pago o vencimiento de la licencia.
            </p>
            <p className="text-slate-500 text-xs leading-relaxed">
              Por favor, comuníquese con el administrador del servicio para renovar su suscripción y
              restaurar el acceso.
            </p>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl cursor-pointer"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  const localParentCourses = localStorage.getItem('parent_course_ids');
  const localCourseCode = localStorage.getItem('course_code') || localStorage.getItem('selected_course_id');
  let hasLocalCourse = false;
  try {
    const parsed = localParentCourses ? JSON.parse(localParentCourses) : [];
    hasLocalCourse = (Array.isArray(parsed) && parsed.length > 0) || !!localCourseCode;
  } catch {
    hasLocalCourse = !!localCourseCode;
  }

  const needsActivation =
    !profile ||
    (!profile.invitation_code &&
      !profile.course_code &&
      (!profile.parent_course_ids || profile.parent_course_ids.length === 0) &&
      !hasLocalCourse &&
      profile.role !== 'admin' &&
      profile.role !== 'superAdmin' &&
      profile.role !== 'finance' &&
      profile.role !== 'coordinator');

  if (needsActivation && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-blue/20 blur-[120px] rounded-full animate-pulse"></div>
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-accent/20 blur-[120px] rounded-full animate-pulse"
          style={{ animationDelay: '2s' }}
        ></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none"></div>

        <div className="max-w-md w-full relative z-10 glass-premium p-12 rounded-[3.5rem] border border-white/10 backdrop-blur-3xl text-center space-y-8 animate-in zoom-in-95 duration-200">
          {/* Selector de modo */}
          <div className="flex gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/10">
            <button
              onClick={() => setActivationMode('invitation')}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border-none cursor-pointer ${
                activationMode === 'invitation' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white bg-transparent'
              }`}
            >
              Unirme a un Centro
            </button>
            <button
              onClick={() => setActivationMode('registration')}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border-none cursor-pointer ${
                activationMode === 'registration' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white bg-transparent'
              }`}
            >
              Registrar Centro nuevo
            </button>
          </div>

          {activationMode === 'invitation' ? (
            <>
              <div className="space-y-4">
                <h1 className="text-3xl font-black text-white uppercase tracking-tight">
                  Activa tu Cuenta
                </h1>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Ingresa el código de invitación proporcionado por tu administrador escolar para
                  vincular tu perfil digital y habilitar tu acceso a la plataforma.
                </p>
              </div>
              <InvitationForm />
            </>
          ) : (
            <CenterRegistrationForm />
          )}
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Panel Principal', icon: LayoutDashboard },
    { id: 'students', label: 'Gestión de Alumnos', icon: Users },
    { id: 'digital-register', label: 'Calificaciones', icon: FileSpreadsheet },
    { id: 'data', label: 'Gestión de Datos', icon: PlusCircle },
    { id: 'schedule', label: 'Generador de Horarios', icon: CalendarDays },
    { id: 'agenda', label: 'Calendario Escolar', icon: Calendar },
    { id: 'tasks', label: 'Asignar Tareas', icon: BookOpen },
    { id: 'communications', label: 'Excusas y Comunicados', icon: MessageSquare },
    { id: 'facility', label: 'Gestión de Plantel', icon: Wrench },
    { id: 'control', label: 'Modo Control', icon: Monitor },
    { id: 'general-reports', label: 'Reportes', icon: FileBarChart },
    { id: 'finances', label: 'Gestión Financiera', icon: DollarSign },
    { id: 'admin', label: 'Administración', icon: ShieldCheck },
    ...(isSuperAdmin ? [{ id: 'saas', label: 'Gestión SaaS', icon: Globe }] : [])
  ];

  // Filtrar los items de navegación visibles en el Sidebar
  const filteredNavItems = navItems.filter((item) => {
    if (item.id === 'saas') return isSuperAdmin;
    return allowed.includes(item.id);
  });

  return (
    <div className="flex h-screen bg-brand-bg overflow-hidden transition-colors duration-300">
      <Sidebar
        navItems={filteredNavItems}
        activeView={activeView}
        onViewChange={setActiveView}
        userData={profile || { email: user?.email, role: 'student' }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 h-screen overflow-hidden relative">
        {/* Mobile menu trigger */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden fixed top-4 left-4 z-40 bg-slate-900/80 backdrop-blur-md text-white p-3.5 rounded-2xl border border-white/10 shadow-xl hover:bg-slate-800 transition-all active:scale-95 cursor-pointer flex items-center justify-center"
        >
          <Menu size={20} />
        </button>

        {/* VISTAS PERSISTENTES (KEEP-ALIVE) CON SCROLL INDEPENDIENTE */}
        {allowed.includes('dashboard') && (
          <div
            className={`absolute inset-0 overflow-y-auto pt-20 pb-6 px-4 md:p-10 transition-opacity duration-300 ${activeView === 'dashboard' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            <div className="max-w-7xl mx-auto">
              {profile?.role === 'student' || profile?.role === 'parent' ? (
                <StudentDashboard userData={profile} />
              ) : profile?.role === 'teacher' ? (
                <TeacherDashboard userData={profile} />
              ) : (
                <Dashboard />
              )}
            </div>
          </div>
        )}

        {allowed.includes('students') && (
          <div
            className={`absolute inset-0 overflow-y-auto pt-20 pb-6 px-4 md:p-10 transition-opacity duration-300 ${activeView === 'students' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            <div className="max-w-7xl mx-auto">
              <StudentManagement />
            </div>
          </div>
        )}

        {allowed.includes('digital-register') && (
          <div
            className={`absolute inset-0 overflow-y-auto pt-20 pb-6 px-4 md:p-10 transition-opacity duration-300 ${activeView === 'digital-register' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            <div className="max-w-7xl mx-auto">
              <DigitalRegister onViewChange={setActiveView} />
            </div>
          </div>
        )}

        {allowed.includes('schedule') && (
          <div
            className={`absolute inset-0 overflow-y-auto pt-20 pb-6 px-4 md:p-10 transition-opacity duration-300 ${activeView === 'schedule' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            <div className="max-w-7xl mx-auto">
              <ScheduleViewer />
            </div>
          </div>
        )}

        {allowed.includes('agenda') && (
          <div
            className={`absolute inset-0 overflow-y-auto pt-20 pb-6 px-4 md:p-10 transition-opacity duration-300 ${activeView === 'agenda' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            <div className="max-w-7xl mx-auto">
              <Agenda readOnly={false} />
            </div>
          </div>
        )}

        {allowed.includes('tasks') && (
          <div
            className={`absolute inset-0 overflow-y-auto pt-20 pb-6 px-4 md:p-10 transition-opacity duration-300 ${activeView === 'tasks' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            <div className="max-w-7xl mx-auto">
              <TeacherTaskAnnouncement userData={profile} />
            </div>
          </div>
        )}

        {allowed.includes('communications') && (
          <div
            className={`absolute inset-0 overflow-y-auto pt-20 pb-6 px-4 md:p-10 transition-opacity duration-300 ${activeView === 'communications' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            <div className="max-w-7xl mx-auto">
              <CommunicationGenerator userData={profile} />
            </div>
          </div>
        )}

        {allowed.includes('control') && (
          <div
            className={`absolute inset-0 overflow-y-auto pt-20 pb-6 px-4 md:p-10 transition-opacity duration-300 ${activeView === 'control' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            <div className="max-w-7xl mx-auto">
              <ControlDashboard />
            </div>
          </div>
        )}

        {allowed.includes('facility') && (
          <div
            className={`absolute inset-0 overflow-y-auto pt-20 pb-6 px-4 md:p-10 transition-opacity duration-300 ${activeView === 'facility' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            <div className="max-w-7xl mx-auto">
              <FacilityDashboard userData={profile} />
            </div>
          </div>
        )}

        {allowed.includes('admin') && (
          <div
            className={`absolute inset-0 overflow-y-auto pt-20 pb-6 px-4 md:p-10 transition-opacity duration-300 ${activeView === 'admin' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            <div className="max-w-7xl mx-auto">
              <AdminDashboard />
            </div>
          </div>
        )}

        {allowed.includes('finances') && (
          <div
            className={`absolute inset-0 overflow-y-auto pt-20 pb-6 px-4 md:p-10 transition-opacity duration-300 ${activeView === 'finances' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            <div className="max-w-7xl mx-auto">
              {profile?.role === 'admin' ||
              profile?.role === 'finance' ||
              profile?.role === 'superAdmin' ||
              isSuperAdmin ? (
                profile?.finance_pin && !isFinancesUnlocked ? (
                  <div className="max-w-md mx-auto my-12 bg-white rounded-[3rem] border border-slate-100 shadow-2xl p-10 text-center space-y-8 animate-in zoom-in-95 duration-200">
                    <div className="mx-auto w-20 h-20 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center shadow-inner animate-pulse">
                      <Lock size={40} />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800">
                        Módulo Protegido
                      </h2>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider leading-relaxed">
                        Introduce el PIN de seguridad de finanzas para acceder a los saldos, cobros e inventario.
                      </p>
                    </div>
                    
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const inputVal = (e.currentTarget.elements.namedItem('financePinInput') as HTMLInputElement).value;
                        if (inputVal === profile.finance_pin) {
                          setIsFinancesUnlocked(true);
                          setPinError('');
                          toast.success('🔓 Acceso concedido a Finanzas');
                        } else {
                          setPinError('PIN incorrecto. Inténtalo de nuevo.');
                        }
                      }}
                      className="space-y-4"
                    >
                      <input
                        name="financePinInput"
                        type="password"
                        maxLength={6}
                        required
                        autoFocus
                        placeholder="••••"
                        className="w-full text-center tracking-[1em] text-2xl font-bold p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 text-slate-800 placeholder:text-slate-250"
                        onChange={() => setPinError('')}
                      />
                      {pinError && (
                        <p className="text-xs font-black text-rose-600 uppercase tracking-wide bg-rose-50 p-3 rounded-xl animate-bounce">
                          ⚠️ {pinError}
                        </p>
                      )}
                      <button
                        type="submit"
                        className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-rose-100 cursor-pointer active:scale-95 border-none"
                      >
                        Desbloquear Módulo
                      </button>
                    </form>
                  </div>
                ) : (
                  <FinanceModule />
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                  <ShieldCheck size={64} className="mb-4 opacity-20" />
                  <p className="text-xl font-black uppercase tracking-widest">Acceso Restringido</p>
                  <p className="text-xs font-bold opacity-60">
                    Solo el personal administrativo puede acceder al módulo de finanzas.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {allowed.includes('general-reports') && (
          <div
            className={`absolute inset-0 overflow-y-auto pt-20 pb-6 px-4 md:p-10 transition-opacity duration-300 ${activeView === 'general-reports' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            <div className="max-w-7xl mx-auto">
              <GeneralReports />
            </div>
          </div>
        )}

        {isSuperAdmin && (
          <div
            className={`absolute inset-0 overflow-y-auto pt-20 pb-6 px-4 md:p-10 transition-opacity duration-300 ${activeView === 'saas' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            <div className="max-w-7xl mx-auto">
              <SaaSAdminPanel />
            </div>
          </div>
        )}

        {allowed.includes('data') && (
          <div
            className={`absolute inset-0 overflow-y-auto pt-20 pb-6 px-4 md:p-10 transition-opacity duration-300 ${activeView === 'data' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            <div className="max-w-7xl mx-auto">
              <div className="card p-8 bg-surface rounded-[2.5rem] border border-border-main shadow-xl min-h-screen">
                <div className="flex gap-4 mb-10 border-b border-border-main overflow-x-auto pb-2 text-[10px] font-black uppercase tracking-widest">
                  {[
                    { id: 'course', label: 'Cursos', icon: BookOpen },
                    { id: 'subject', label: 'Materias', icon: Book },
                    { id: 'teacher', label: 'Docentes', icon: Users },
                    { id: 'assignment', label: 'Asignaciones', icon: Link },
                    { id: 'requirement', label: 'Requisitos', icon: Sliders },
                    { id: 'preferences', label: 'Preferencias', icon: Sliders },
                    { id: 'year', label: 'Ciclo Escolar', icon: Calendar }
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setDataView(item.id)}
                      className={`flex items-center gap-2 pb-4 px-2 border-b-2 transition-all ${dataView === item.id ? 'text-brand-blue border-brand-blue' : 'border-transparent text-text-muted'}`}
                    >
                      <item.icon size={18} /> {item.label}
                    </button>
                  ))}
                </div>
                <div className="w-full">
                  {dataView === 'course' && <CourseForm />}
                  {dataView === 'teacher' && <TeacherForm />}
                  {dataView === 'subject' && <SubjectForm />}
                  {dataView === 'assignment' && <AssignmentForm />}
                  {dataView === 'requirement' && <AcademicRequirementForm />}
                  {dataView === 'preferences' && <PreferencesForm />}
                  {dataView === 'year' && <SchoolYearForm />}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Toaster position="top-right" />
      <AppContent />
    </AppProvider>
  );
}
