import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { updateUserStatus } from '../services/userService';
import * as XLSX from 'xlsx';
import { useApp, AppState } from '../context/AppContext';
import { useSupabase } from '../context/AppContext';
import { AdminReports } from './AdminReports';
import { InvitationGenerator } from './InvitationGenerator';
import { CenterSettingsForm } from './CenterSettingsForm';
import { TeamManagement } from './TeamManagement';
import { TeacherPerformanceModule } from './TeacherPerformanceModule';
import { ComplianceDashboard } from './ComplianceDashboard';
import { WinterSchedulePreference } from '../types';
import { MasterImportWizard } from './MasterImportWizard';
import { CloneYearWizard } from './CloneYearWizard';
import { FileSpreadsheet, Upload, Copy } from 'lucide-react';

export const AdminDashboard = () => {
  const [users, setUsers] = useState<any[]>([]);
  const { state, setAppState } = useApp();
  const { user, profile } = useSupabase();
  const [tab, setTab] = useState<'users' | 'performance' | 'compliance' | 'data' | 'settings'>(
    'users'
  );
  const [subTab, setSubTab] = useState<'personal' | 'directory' | 'invitations'>('personal');
  const [showWizard, setShowWizard] = useState(false);
  const [showCloneWizard, setShowCloneWizard] = useState(false);
  const isSuperAdmin = !!profile?.is_superadmin;

  useEffect(() => {
    if (profile) {
      fetchUsers();
    }
  }, [profile, isSuperAdmin]);

  const fetchUsers = async () => {
    let query = supabase.from('profiles').select('*');
    if (!isSuperAdmin && profile?.center_id) {
      query = query.eq('center_id', profile.center_id);
    }
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
    } else {
      setUsers(data || []);
    }
  };

  const stats = useMemo(() => {
    const roles = ['teacher', 'student', 'parent'];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return roles.map((role) => {
      const roleUsers = users.filter((u) => u.role === role);
      const activeUsers = roleUsers.filter(
        (u) => u.last_login && new Date(u.last_login) > sevenDaysAgo
      );
      return {
        role,
        total: roleUsers.length,
        active: activeUsers.length,
        inactive: roleUsers.length - activeUsers.length
      };
    });
  }, [users]);

  const handleToggleActive = async (uid: string, isActive: boolean) => {
    try {
      await updateUserStatus(uid, !isActive);
      setUsers(users.map((u) => (u.id === uid ? { ...u, is_active: !isActive } : u)));
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (uid === user?.id) {
      alert('No puedes eliminar tu propio usuario.');
      return;
    }
    if (
      !confirm(
        '¿Estás seguro de eliminar este usuario del directorio? Esta acción no se puede deshacer.'
      )
    )
      return;

    const { error } = await supabase.from('profiles').delete().eq('id', uid);
    if (error) {
      console.error('Error deleting user:', error);
      alert('Error al eliminar el usuario');
    } else {
      setUsers(users.filter((u) => u.id !== uid));
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      alert(`Se ha enviado un enlace de recuperación a ${email}`);
    } catch (error) {
      console.error('Error al enviar el correo de recuperación:', error);
      alert('Error al enviar el correo de recuperación');
    }
  };

  const exportDatabase = () => {
    const wb = XLSX.utils.book_new();
    Object.keys(state).forEach((key) => {
      const data = Array.isArray(state[key as keyof typeof state])
        ? state[key as keyof typeof state]
        : [state[key as keyof typeof state]];
      const ws = XLSX.utils.json_to_sheet(data as any[]);
      XLSX.utils.book_append_sheet(wb, ws, key);
    });
    XLSX.writeFile(wb, 'base_de_datos.xlsx');
  };

  const exportJsonBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respaldo_${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const newState: AppState = {
        courses: XLSX.utils.sheet_to_json(wb.Sheets['courses'] || {}),
        subjects: XLSX.utils.sheet_to_json(wb.Sheets['subjects'] || {}),
        teachers: XLSX.utils.sheet_to_json(wb.Sheets['teachers'] || {}),
        rooms: XLSX.utils.sheet_to_json(wb.Sheets['rooms'] || {}),
        timeBlocks: XLSX.utils.sheet_to_json(wb.Sheets['timeBlocks'] || {}),
        schedule: XLSX.utils.sheet_to_json(wb.Sheets['schedule'] || {}),
        assignments: XLSX.utils.sheet_to_json(wb.Sheets['assignments'] || {}),
        academicRequirements: XLSX.utils.sheet_to_json(wb.Sheets['academicRequirements'] || {}),
        teacherPreferences: XLSX.utils.sheet_to_json(wb.Sheets['teacherPreferences'] || {}),
        breakPreferences: XLSX.utils.sheet_to_json(wb.Sheets['breakPreferences'] || {}),
        winterSchedulePreference:
          (XLSX.utils.sheet_to_json(
            wb.Sheets['winterSchedulePreference'] || {}
          )[0] as WinterSchedulePreference) || null,
        attendanceRecords: XLSX.utils.sheet_to_json(wb.Sheets['attendanceRecords'] || {}),
        performanceAlerts: XLSX.utils.sheet_to_json(wb.Sheets['performanceAlerts'] || []),
        teacherPerformanceStats: XLSX.utils.sheet_to_json(
          wb.Sheets['teacherPerformanceStats'] || []
        ),
        activities: XLSX.utils.sheet_to_json(wb.Sheets['activities'] || []),
        priorityPreferences: XLSX.utils.sheet_to_json(wb.Sheets['priorityPreferences'] || []),
        levelSchedules: XLSX.utils.sheet_to_json(wb.Sheets['levelSchedules'] || []),
        fixedEvents: XLSX.utils.sheet_to_json(wb.Sheets['fixedEvents'] || []),
        schoolYears: XLSX.utils.sheet_to_json(wb.Sheets['schoolYears'] || []),
        students: XLSX.utils.sheet_to_json(wb.Sheets['students'] || []),
        grades: XLSX.utils.sheet_to_json(wb.Sheets['grades'] || []),
        loading: false,
        error: null
      };

      setAppState(newState);
      alert(
        'Datos importados correctamente. Nota: Estos cambios son locales hasta que se guarden en la base de datos.'
      );
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-8 text-text-main">
      <div className="bg-brand-bg p-2 rounded-[3rem] border border-border-main shadow-inner">
        <div className="flex gap-2 p-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <button
            onClick={() => setTab('users')}
            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'users' ? 'bg-surface text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'}`}
          >
            Gestión de Personal
          </button>
          <button
            onClick={() => setTab('performance')}
            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'performance' ? 'bg-surface text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'}`}
          >
            Seguimiento de Personal
          </button>
          <button
            onClick={() => setTab('compliance')}
            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'compliance' ? 'bg-surface text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'}`}
          >
            Monitor de Cumplimiento
          </button>
          <button
            onClick={() => setTab('data')}
            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'data' ? 'bg-surface text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'}`}
          >
            Datos y Respaldos
          </button>
          <button
            onClick={() => setTab('settings')}
            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'settings' ? 'bg-surface text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'}`}
          >
            Configuración Centro
          </button>
        </div>
      </div>

      {tab === 'users' && (
        <div className="space-y-8">
          <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit ml-2 border border-slate-200 shadow-inner">
            {[
              { id: 'personal', label: 'Gestión de Personal' },
              { id: 'directory', label: 'Directorio de Usuarios' },
              { id: 'invitations', label: 'Códigos de Acceso' }
            ].map(sub => (
              <button
                key={sub.id}
                onClick={() => setSubTab(sub.id as any)}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${subTab === sub.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {subTab === 'personal' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <TeamManagement />
            </div>
          )}

          {subTab === 'directory' && (
            <div className="bg-surface p-8 rounded-[2.5rem] border border-border-main shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h2 className="text-xl font-black mb-6 text-text-main">
                Directorio General de Usuarios
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-main">
                      <th className="py-4 font-black text-[9px] text-text-muted uppercase tracking-widest">
                        Email
                      </th>
                      <th className="py-4 font-black text-[9px] text-text-muted uppercase tracking-widest">
                        Rol/Equipo
                      </th>
                      <th className="py-4 font-black text-[9px] text-text-muted uppercase tracking-widest">
                        Estado
                      </th>
                      <th className="py-4 font-black text-[9px] text-text-muted uppercase tracking-widest text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-border-main hover:bg-brand-bg transition-colors"
                      >
                        <td className="py-4 text-text-main font-bold">{u.email}</td>
                        <td className="py-4">
                          <span className="px-3 py-1 bg-brand-bg rounded-lg text-[9px] font-black text-text-muted uppercase tracking-widest">
                            {u.role}
                          </span>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            ></div>
                            <span
                              className={`text-[10px] font-black uppercase tracking-widest ${u.is_active ? 'text-emerald-600' : 'text-amber-600'}`}
                            >
                              {u.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 text-right space-x-2">
                          <button
                            onClick={() => handleToggleActive(u.id, u.is_active)}
                            className="text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-indigo-600 px-3 py-2"
                          >
                            Estado
                          </button>
                          <button
                            onClick={() => handleResetPassword(u.email)}
                            className="text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-indigo-600 px-3 py-2"
                          >
                            Reset
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-700 px-3 py-2"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {subTab === 'invitations' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <InvitationGenerator />
            </div>
          )}
        </div>
      )}

      {tab === 'performance' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <TeacherPerformanceModule />
        </div>
      )}

      {tab === 'compliance' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ComplianceDashboard />
        </div>
      )}

      {tab === 'data' && (
        <div className="space-y-8">
          <div className="bg-surface p-8 rounded-[2.5rem] border border-border-main shadow-sm">
            <h2 className="text-xl font-black mb-6 text-text-main">Exportación e Importación</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={exportDatabase}
                className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all shadow-xl"
              >
                Descargar Excel
              </button>
              <button
                onClick={exportJsonBackup}
                className="bg-surface border border-border-main text-text-main px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-brand-bg transition-all shadow-sm"
              >
                Respaldo JSON
              </button>
              <div className="relative">
                <input
                  type="file"
                  onChange={importData}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="bg-brand-bg border-2 border-dashed border-border-main text-text-muted px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-center">
                  Importar Archivo
                </div>
              </div>
            </div>
          </div>
          {/* SECCIÓN DE CARGA MASIVA INTEGRADA MAESTRA (EXCEL) */}
          <div className="bg-surface p-8 rounded-[2.5rem] border border-border-main shadow-sm space-y-6 text-left">
            <div className="flex items-center gap-4 text-slate-900">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase text-text-main">Sincronización y Carga Inicial Completa (Excel)</h3>
                <p className="text-xs text-text-muted font-medium mt-1">
                  Exporta la base de datos actual del centro a Excel, edítala o añade información masiva y vuelve a subirla para configurar de inmediato cursos, materias, personal y estudiantes.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-slate-600 text-xs font-bold leading-relaxed">
              <span className="text-indigo-600 font-black">IMPORTANTE:</span> El asistente de importación interpretará los cambios automáticamente. Si un registro ya existe, actualizará sus datos; si no existe, lo creará. Las asignaciones de materias y profesores se volverán a mapear conforme a lo indicado en el archivo de Excel.
            </div>

            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => setShowWizard(true)}
                className="flex items-center gap-3 px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95"
              >
                <Upload size={16} /> Abrir Asistente de Carga Masiva
              </button>
            </div>
          </div>

          {/* SECCIÓN DE CLONACIÓN Y TRASPASO DE CICLO ESCOLAR */}
          <div className="bg-surface p-8 rounded-[2.5rem] border border-border-main shadow-sm space-y-6 text-left">
            <div className="flex items-center gap-4 text-slate-900">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Copy size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase text-text-main">Clonación y Traspaso de Ciclo Escolar</h3>
                <p className="text-xs text-text-muted font-medium mt-1">
                  Copia los grados, secciones y materias del año anterior al nuevo año escolar. Permite también clonar la carga horaria y asignaciones docentes para no empezar de cero.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-slate-600 text-xs font-bold leading-relaxed">
              <span className="text-indigo-600 font-black">INFORMACIÓN:</span> Esta operación solo crea los cursos y asignaciones en el ciclo escolar de destino. No copia a los alumnos matriculados, ya que estos se deben inscribir y registrar individualmente en el nuevo año.
            </div>

            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => setShowCloneWizard(true)}
                className="flex items-center gap-3 px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95"
              >
                <Copy size={16} /> Clonar Cursos del Año Anterior
              </button>
            </div>
          </div>

          <AdminReports />
        </div>
      )}

      {tab === 'settings' && <CenterSettingsForm />}

      {showWizard && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 lg:pl-[280px] overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-4xl shadow-2xl my-auto animate-in zoom-in-95 duration-200">
            <MasterImportWizard onClose={() => setShowWizard(false)} />
          </div>
        </div>
      )}

      {showCloneWizard && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 lg:pl-[280px] overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-4xl shadow-2xl my-auto animate-in zoom-in-95 duration-200">
            <CloneYearWizard onClose={() => setShowCloneWizard(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

