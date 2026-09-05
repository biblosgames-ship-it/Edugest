import React, { useState, useEffect } from 'react';
import { Logo } from '../Logo';
import { LogOut, Sun, Moon, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SchoolYearSelector } from '../SchoolYearSelector';

export const Sidebar = ({
  navItems,
  activeView,
  onViewChange,
  userData,
  isOpen,
  onClose
}: {
  navItems: any[];
  activeView?: string;
  onViewChange?: (id: any) => void;
  userData: any;
  isOpen?: boolean;
  onClose?: () => void;
}) => {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      // Preserve dismissed communication IDs across logouts
      const dismissedKeys: { key: string; val: string }[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('edugens_dismissed_comms_') || k.startsWith('edugens_hide_'))) {
          const val = localStorage.getItem(k);
          if (val) dismissedKeys.push({ key: k, val });
        }
      }
      localStorage.clear();
      dismissedKeys.forEach((item) => localStorage.setItem(item.key, item.val));
      window.location.href = '/';
    }
  };

  return (
    <>
      {/* Backdrop overlay for mobile screens */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300"
        />
      )}

      <aside
        className={
          isOpen
            ? 'fixed inset-y-0 left-0 w-[280px] p-6 h-screen z-50 bg-brand-bg transition-transform duration-300 translate-x-0 block'
            : 'hidden md:block md:sticky md:top-0 w-[280px] p-6 h-screen flex-shrink-0 bg-brand-bg transition-colors duration-300'
        }
      >
        <div className="bg-[#0f172a] rounded-[2rem] h-full flex flex-col p-6 shadow-xl shadow-slate-900/10 border border-slate-800/50 text-white relative overflow-hidden">
          {/* Close button for mobile screens */}
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden absolute top-4 right-4 z-20 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              <X size={16} />
            </button>
          )}

          {/* Decorative gradient blur in background */}
          <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-brand-accent/20 to-transparent blur-2xl pointer-events-none rounded-t-[2rem]"></div>

          <div className="flex items-center gap-3 mb-3 relative z-10 px-2 mt-2">
            <div className="relative bg-gradient-to-br from-brand-blue to-brand-accent p-1.5 rounded-lg shadow-lg shadow-brand-blue/30 flex-shrink-0">
              <Logo className="w-6 h-6 text-white" />
              {navItems.some((i) => i.badge && Number(i.badge) > 0) && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-md animate-pulse border border-slate-900">
                  {(() => {
                    const total = navItems.reduce((acc, i) => acc + (Number(i.badge) || 0), 0);
                    return total > 9 ? '9+' : total;
                  })()}
                </span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300 leading-none">
                EduGest
              </h1>
              <span className="text-[9px] text-brand-accent font-black uppercase tracking-wider mt-0.5 truncate">
                Gestión Educativa
              </span>
            </div>
          </div>

          <div className="relative z-10 mb-2">
            <SchoolYearSelector />
          </div>

          <nav className="space-y-2 flex-1 overflow-y-auto relative z-10 pr-2 custom-scrollbar">
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              const hasBadge = item.badge !== undefined && Number(item.badge) > 0;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onViewChange?.(item.id);
                    onClose?.();
                  }}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all duration-300 group ${
                    isActive
                      ? 'bg-white/10 text-white shadow-inner border border-white/10 backdrop-blur-md'
                      : 'text-slate-300 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <div
                    className={`relative transition-transform duration-300 ${isActive ? 'scale-110 text-brand-accent' : 'group-hover:scale-110 group-hover:text-white'}`}
                  >
                    <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                    {hasBadge && (
                      <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-md animate-pulse border border-slate-900">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={`font-semibold text-sm tracking-wide flex-1 text-left truncate ${isActive ? 'opacity-100' : 'opacity-80'}`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-2 pt-2 border-t border-white/10 relative z-10 space-y-1.5">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl transition-all duration-300 text-slate-300 hover:bg-white/5 border border-transparent hover:border-white/10 group"
            >
              <div className="flex items-center gap-2.5">
                {isDark ? (
                  <Sun size={16} className="text-amber-400" />
                ) : (
                  <Moon size={16} className="text-indigo-300" />
                )}
                <span className="font-semibold text-xs">
                  {isDark ? 'Modo Claro' : 'Modo Oscuro'}
                </span>
              </div>
              <div
                className={`w-7 h-3.5 rounded-full p-0.5 transition-colors ${isDark ? 'bg-amber-400' : 'bg-slate-700'} flex items-center`}
              >
                <div
                  className={`w-2 h-2 bg-white rounded-full transition-transform ${isDark ? 'translate-x-3.5' : 'translate-x-0'}`}
                ></div>
              </div>
            </button>

            {/* Tarjeta de Usuario Logueado */}
            <div className="relative z-10 bg-white/5 border border-white/10 rounded-xl p-2 flex items-center gap-2.5 shadow-inner">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-blue to-brand-accent flex items-center justify-center font-bold text-white text-xs shadow-md uppercase flex-shrink-0">
                {userData?.full_name
                  ? userData.full_name.substring(0, 2)
                  : userData?.email
                    ? userData.email.substring(0, 2)
                    : 'US'}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-xs font-semibold text-slate-200 truncate"
                  title={userData?.full_name || userData?.email || 'Usuario'}
                >
                  {userData?.full_name || userData?.email || 'Usuario'}
                </p>
                <p className="text-[9px] text-brand-accent font-black uppercase tracking-wider">
                  {userData?.role === 'admin'
                    ? 'Administrador'
                    : userData?.role === 'superAdmin'
                      ? 'Super Admin'
                      : userData?.role === 'teacher'
                        ? 'Docente'
                        : userData?.role === 'management_teacher'
                          ? 'Docente y Gestión'
                          : userData?.role === 'student'
                            ? 'Estudiante'
                            : userData?.role === 'finance'
                              ? 'Finanzas'
                              : userData?.role === 'coordinator'
                                ? 'Coordinador'
                                : userData?.role || 'Usuario'}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 border border-transparent hover:border-rose-500/20 group"
            >
              <LogOut
                size={16}
                className="transform group-hover:-translate-x-1 transition-transform"
              />
              <span className="font-semibold text-xs">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
