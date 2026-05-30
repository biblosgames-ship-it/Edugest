import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useSupabase } from '../../context/AppContext';
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
  ShieldCheck
} from 'lucide-react';

export const MainLayout = () => {
  const { user, profile } = useSupabase();

  const navItems = [
    { id: 'dashboard', label: 'Panel Principal', icon: LayoutDashboard, path: '/' },
    { id: 'students', label: 'Gestión de Alumnos', icon: Users, path: '/students' },
    { id: 'general-reports', label: 'Reportes Generales', icon: FileBarChart, path: '/reports' },
    { id: 'digital-register', label: 'Calificaciones', icon: FileSpreadsheet, path: '/register' },
    { id: 'schedule', label: 'Generador de Horarios', icon: CalendarDays, path: '/schedule' },
    { id: 'control', label: 'Modo Control', icon: Monitor, path: '/control' },
    { id: 'data', label: 'Gestión de Datos', icon: PlusCircle, path: '/data' },
    {
      id: 'teacher-performance',
      label: 'Seguimiento Docente',
      icon: Activity,
      path: '/teacher-performance'
    },
    { id: 'compliance', label: 'Monitor Cumplimiento', icon: ClipboardCheck, path: '/compliance' },
    { id: 'agenda', label: 'Agenda Escolar', icon: Calendar, path: '/agenda' },
    {
      id: 'communications',
      label: 'Excusas y Reportes',
      icon: MessageSquare,
      path: '/communications'
    },
    { id: 'admin', label: 'Administración', icon: ShieldCheck, path: '/admin' }
  ];

  return (
    <div className="flex h-screen bg-brand-bg overflow-hidden transition-colors duration-300">
      <Sidebar navItems={navItems} userData={profile || { email: user?.email, role: 'admin' }} />
      <main className="flex-1 overflow-y-auto p-4 md:p-10">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
