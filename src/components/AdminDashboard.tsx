import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { updateUserStatus, updateUserAllowedPanels } from '../services/userService';
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
import {
  FileSpreadsheet,
  Upload,
  Copy,
  ShieldCheck,
  KeyRound,
  Check,
  X,
  Sparkles,
  RotateCcw,
  Layers,
  Search
} from 'lucide-react';
import toast from 'react-hot-toast';

const AVAILABLE_PANELS = [
  {
    id: 'dashboard',
    label: 'Panel Principal',
    desc: 'Panel de métricas y vista general del centro.'
  },
  {
    id: 'classroom',
    label: 'Gestión de Aulas',
    desc: 'Control de clases, materias asignadas y asistencias.'
  },
  {
    id: 'students',
    label: 'Gestión de Alumnos',
    desc: 'Matrícula de alumnos, expedientes y certificados.'
  },
  {
    id: 'digital-register',
    label: 'Calificaciones',
    desc: 'Registro digital de notas por períodos y grados.'
  },
  {
    id: 'data',
    label: 'Gestión de Datos',
    desc: 'Configuración de cursos, asignaturas y ciclo escolar.'
  },
  {
    id: 'schedule',
    label: 'Horarios',
    desc: 'Visualización y creador automático de horarios.'
  },
  {
    id: 'agenda',
    label: 'Calendario Escolar',
    desc: 'Planificador de eventos y efemérides.'
  },
  {
    id: 'tasks',
    label: 'Tareas',
    desc: 'Asignación, seguimiento y envío de tareas escolares.'
  },
  {
    id: 'communications',
    label: 'Comunicaciones',
    desc: 'Envío de comunicados oficiales y justificación de excusas.'
  },
  {
    id: 'control',
    label: 'Modo Control',
    desc: 'Seguimiento en tiempo real de actividades del centro.'
  },
  {
    id: 'general-reports',
    label: 'Reportes',
    desc: 'Reportes académicos, demográficos y consolidados.'
  },
  {
    id: 'finances',
    label: 'Gestión Financiera',
    desc: 'Control de nómina, gastos, becas y cuentas de estudiantes.'
  },
  {
    id: 'facility',
    label: 'Planta Física / Mantenimiento',
    desc: 'Gestión de instalaciones, inventario y solicitudes.'
  },
  {
    id: 'admin',
    label: 'Administración',
    desc: 'Control de usuarios, configuración del centro y auditoría.'
  }
];

const ROLE_PANEL_DEFAULTS: Record<string, string[]> = {
  admin: [
    'dashboard',
    'classroom',
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
    'classroom',
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
    'classroom',
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
  teacher: ['dashboard', 'classroom', 'agenda', 'digital-register', 'tasks', 'communications'],
  student: ['dashboard', 'schedule', 'agenda'],
  parent: ['dashboard', 'schedule', 'agenda'],
  support: ['dashboard', 'facility', 'agenda'],
  supervisor: ['dashboard', 'facility', 'agenda'],
  conserje: ['dashboard', 'facility', 'agenda'],
  pending: []
};

export const AdminDashboard = () => {
  const [users, setUsers] = useState<any[]>([]);
  const { state, setAppState, center, refreshData } = useApp();
  const { user, profile } = useSupabase();
  const [tab, setTab] = useState<'users' | 'performance' | 'compliance' | 'data' | 'settings'>(
    'users'
  );
  const [subTab, setSubTab] = useState<'personal' | 'directory' | 'invitations'>('personal');
  const [showWizard, setShowWizard] = useState(false);
  const [showCloneWizard, setShowCloneWizard] = useState(false);
  const isSuperAdmin = !!profile?.is_superadmin;
  const [filterCurrentCenter, setFilterCurrentCenter] = useState(true);

  // Estados para el Modal de Permisos y Módulos
  const [editingPermissionsUser, setEditingPermissionsUser] = useState<any | null>(null);
  const [selectedUserPanels, setSelectedUserPanels] = useState<string[]>([]);
  const [isSavingPanels, setIsSavingPanels] = useState(false);
  const [permissionFilter, setPermissionFilter] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  useEffect(() => {
    if (profile) {
      fetchUsers();
    }
  }, [profile, isSuperAdmin, filterCurrentCenter]);

  const fetchUsers = async () => {
    let query = supabase.from('profiles').select('*');
    if ((!isSuperAdmin || filterCurrentCenter) && profile?.center_id) {
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

  const handleRoleChange = async (uid: string, newRole: string) => {
    try {
      const targetUser = users.find((u) => u.id === uid);
      const updates: any = { role: newRole };

      // Si el usuario es nuevo/pendiente (no tiene center_id) y lo estamos asignando a un rol real,
      // lo vinculamos al centro del administrador actual y lo activamos automáticamente.
      if (!targetUser?.center_id && newRole !== 'pending' && profile?.center_id) {
        updates.center_id = profile.center_id;
        updates.is_active = true;
      }

      const { error } = await supabase.from('profiles').update(updates).eq('id', uid);
      if (error) throw error;

      setUsers(
        users.map((u) =>
          u.id === uid
            ? { ...u, ...updates }
            : u
        )
      );
      alert('Rol actualizado correctamente');
    } catch (error: any) {
      console.error('Error updating user role:', error);
      alert('Error al actualizar el rol: ' + (error.message || error));
    }
  };


  const handleOpenPermissionsModal = (targetUser: any) => {
    setEditingPermissionsUser(targetUser);
    const existing =
      targetUser.allowed_panels && targetUser.allowed_panels.length > 0
        ? targetUser.allowed_panels
        : ROLE_PANEL_DEFAULTS[targetUser.role || 'teacher'] || [];
    setSelectedUserPanels(existing);
    setPermissionFilter('');
  };

  const handleToggleUserPanel = (panelId: string) => {
    setSelectedUserPanels((prev) =>
      prev.includes(panelId) ? prev.filter((id) => id !== panelId) : [...prev, panelId]
    );
  };

  const handleSelectAllPanels = () => {
    setSelectedUserPanels(AVAILABLE_PANELS.map((p) => p.id));
  };

  const handleClearAllPanels = () => {
    setSelectedUserPanels([]);
  };

  const handleResetToRolePanels = () => {
    if (!editingPermissionsUser) return;
    const defaults = ROLE_PANEL_DEFAULTS[editingPermissionsUser.role || 'teacher'] || [];
    setSelectedUserPanels(defaults);
  };

  const handleSaveUserPermissions = async () => {
    if (!editingPermissionsUser) return;
    setIsSavingPanels(true);
    try {
      await updateUserAllowedPanels(editingPermissionsUser.id, selectedUserPanels);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingPermissionsUser.id ? { ...u, allowed_panels: selectedUserPanels } : u
        )
      );
      toast.success(`Permisos de ${editingPermissionsUser.email} actualizados correctamente.`);
      if (editingPermissionsUser.id === user?.id) {
        await refreshData(undefined, true);
      }
      setEditingPermissionsUser(null);
    } catch (err: any) {
      console.error('Error saving user panels:', err);
      toast.error('Error al actualizar permisos: ' + (err.message || err));
    } finally {
      setIsSavingPanels(false);
    }
  };

  const filteredDirectoryUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return users;
    const q = userSearchQuery.toLowerCase().trim();
    return users.filter(
      (u) =>
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.role && u.role.toLowerCase().includes(q))
    );
  }, [users, userSearchQuery]);

  const filteredPanels = useMemo(() => {
    if (!permissionFilter.trim()) return AVAILABLE_PANELS;
    const q = permissionFilter.toLowerCase().trim();
    return AVAILABLE_PANELS.filter(
      (p) => p.label.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    );
  }, [permissionFilter]);

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
            ].map((sub) => (
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
            <div className="bg-surface p-8 rounded-[2.5rem] border border-border-main shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-text-main uppercase tracking-tight">
                    Directorio General de Usuarios
                  </h2>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mt-0.5">
                    Administra roles, accesos a módulos y estado de vinculación
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                    />
                    <input
                      type="text"
                      placeholder="Buscar por email, nombre..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-brand-bg rounded-xl border border-border-main text-xs text-text-main font-bold outline-none focus:border-indigo-500 w-64"
                    />
                  </div>

                  {isSuperAdmin && (
                    <label className="flex items-center gap-2 cursor-pointer bg-brand-bg border border-border-main px-4 py-2 rounded-xl text-xs font-bold text-text-main hover:bg-surface transition-colors">
                      <input
                        type="checkbox"
                        checked={filterCurrentCenter}
                        onChange={(e) => setFilterCurrentCenter(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>Solo centro actual ({center?.name || 'Cargando...'})</span>
                    </label>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-main">
                      <th className="py-4 px-2 font-black text-[9px] text-text-muted uppercase tracking-widest">
                        Usuario / Correo
                      </th>
                      <th className="py-4 px-2 font-black text-[9px] text-text-muted uppercase tracking-widest">
                        Rol Base
                      </th>
                      <th className="py-4 px-2 font-black text-[9px] text-text-muted uppercase tracking-widest">
                        Módulos / Permisos
                      </th>
                      <th className="py-4 px-2 font-black text-[9px] text-text-muted uppercase tracking-widest">
                        Estado
                      </th>
                      <th className="py-4 px-2 font-black text-[9px] text-text-muted uppercase tracking-widest text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDirectoryUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs font-bold text-text-muted uppercase">
                          No se encontraron usuarios
                        </td>
                      </tr>
                    ) : (
                      filteredDirectoryUsers.map((u) => {
                        const userRole = u.role || 'pending';
                        const effectivePanels =
                          u.allowed_panels && u.allowed_panels.length > 0
                            ? u.allowed_panels
                            : ROLE_PANEL_DEFAULTS[userRole] || [];

                        return (
                          <tr
                            key={u.id}
                            className="border-b border-border-main hover:bg-brand-bg transition-colors"
                          >
                            <td className="py-4 px-2">
                              <div className="flex flex-col">
                                <span className="text-text-main font-bold text-xs">{u.email}</span>
                                {u.full_name && (
                                  <span className="text-[10px] font-bold text-text-muted uppercase">
                                    {u.full_name}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-2">
                              <select
                                value={u.role || 'pending'}
                                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                disabled={u.id === user?.id}
                                className="bg-brand-bg rounded-lg text-[9px] font-black text-text-muted uppercase tracking-widest px-2.5 py-1.5 border border-border-main focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <option value="pending">PENDING</option>
                                <option value="teacher">TEACHER</option>
                                <option value="coordinator">COORDINATOR</option>
                                <option value="finance">FINANCE</option>
                                <option value="admin">ADMIN</option>
                                <option value="student">STUDENT</option>
                                <option value="parent">PARENT</option>
                                <option value="creator">CREATOR</option>
                                <option value="support">SUPPORT</option>
                                <option value="conserje">CONSERJE</option>
                              </select>
                            </td>
                            <td className="py-4 px-2">
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
                                  <Layers size={11} /> {effectivePanels.length} Módulos
                                </span>
                                <button
                                  onClick={() => handleOpenPermissionsModal(u)}
                                  className="px-2.5 py-1 bg-surface border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-2xs hover:border-indigo-400"
                                >
                                  Personalizar
                                </button>
                              </div>
                            </td>
                            <td className="py-4 px-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                ></div>
                                <span
                                  className={`text-[10px] font-black uppercase tracking-widest ${u.is_active ? 'text-emerald-600' : 'text-amber-600'}`}
                                >
                                  {u.is_active ? 'Activo' : 'Inactivo'}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-2 text-right space-x-1 whitespace-nowrap">
                              <button
                                onClick={() => handleOpenPermissionsModal(u)}
                                title="Editar permisos de acceso a módulos"
                                className="text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1"
                              >
                                <KeyRound size={11} /> Permisos
                              </button>
                              <button
                                onClick={() => handleToggleActive(u.id, u.is_active)}
                                className="text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-indigo-600 px-2 py-1.5"
                              >
                                Estado
                              </button>
                              <button
                                onClick={() => handleResetPassword(u.email)}
                                className="text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-indigo-600 px-2 py-1.5"
                              >
                                Reset
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-700 px-2 py-1.5"
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
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
                <h3 className="text-xl font-black uppercase text-text-main">
                  Sincronización y Carga Inicial Completa (Excel)
                </h3>
                <p className="text-xs text-text-muted font-medium mt-1">
                  Exporta la base de datos actual del centro a Excel, edítala o añade información
                  masiva y vuelve a subirla para configurar de inmediato cursos, materias, personal
                  y estudiantes.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-slate-600 text-xs font-bold leading-relaxed">
              <span className="text-indigo-600 font-black">IMPORTANTE:</span> El asistente de
              importación interpretará los cambios automáticamente. Si un registro ya existe,
              actualizará sus datos; si no existe, lo creará. Las asignaciones de materias y
              profesores se volverán a mapear conforme a lo indicado en el archivo de Excel.
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
                <h3 className="text-xl font-black uppercase text-text-main">
                  Clonación y Traspaso de Ciclo Escolar
                </h3>
                <p className="text-xs text-text-muted font-medium mt-1">
                  Copia los grados, secciones y materias del año anterior al nuevo año escolar.
                  Permite también clonar la carga horaria y asignaciones docentes para no empezar de
                  cero.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-slate-600 text-xs font-bold leading-relaxed">
              <span className="text-indigo-600 font-black">INFORMACIÓN:</span> Esta operación solo
              crea los cursos y asignaciones en el ciclo escolar de destino. No copia a los alumnos
              matriculados, ya que estos se deben inscribir y registrar individualmente en el nuevo
              año.
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

      {/* Modal de Gestión de Permisos por Usuario */}
      {editingPermissionsUser && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 w-full max-w-2xl shadow-2xl border border-slate-100 my-auto animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Cabecera del Modal */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner flex-shrink-0">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black uppercase text-slate-800 tracking-tight">
                      Permisos y Módulos de Acceso
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {editingPermissionsUser.role || 'Sin Rol'}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-500 truncate max-w-md">
                    {editingPermissionsUser.email}{' '}
                    {editingPermissionsUser.full_name && `(${editingPermissionsUser.full_name})`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingPermissionsUser(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                title="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Barra de Acciones Rápidas y Búsqueda */}
            <div className="space-y-3 mb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={handleSelectAllPanels}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Seleccionar Todos ({AVAILABLE_PANELS.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllPanels}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Desmarcar Todos
                  </button>
                  <button
                    type="button"
                    onClick={handleResetToRolePanels}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={10} /> Por Defecto ({editingPermissionsUser.role || 'Rol'})
                  </button>
                </div>

                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50/80 px-2.5 py-1 rounded-xl border border-indigo-100 uppercase">
                  {selectedUserPanels.length} Módulos Activos
                </span>
              </div>

              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Filtrar módulos (ej: Finanzas, Calificaciones...)"
                  value={permissionFilter}
                  onChange={(e) => setPermissionFilter(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Lista de Módulos Seleccionables */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {filteredPanels.map((panel) => {
                  const isChecked = selectedUserPanels.includes(panel.id);
                  return (
                    <button
                      key={panel.id}
                      type="button"
                      onClick={() => handleToggleUserPanel(panel.id)}
                      className={`flex items-start text-left p-3.5 rounded-2xl border-2 transition-all gap-3 cursor-pointer ${
                        isChecked
                          ? 'bg-indigo-50/40 border-indigo-500/80 shadow-xs'
                          : 'bg-slate-50/60 border-slate-100 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div
                        className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center transition-all flex-shrink-0 ${
                          isChecked
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check size={11} strokeWidth={4} />}
                      </div>
                      <div className="min-w-0">
                        <div
                          className={`text-xs font-black uppercase leading-tight ${
                            isChecked ? 'text-indigo-900' : 'text-slate-700'
                          }`}
                        >
                          {panel.label}
                        </div>
                        <div className="text-[9px] font-semibold text-slate-400 uppercase mt-0.5 leading-snug">
                          {panel.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pie del Modal con Guardar */}
            <div className="border-t border-slate-100 pt-4 mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingPermissionsUser(null)}
                disabled={isSavingPanels}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveUserPermissions}
                disabled={isSavingPanels}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-100 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isSavingPanels ? (
                  'Guardando...'
                ) : (
                  <>
                    <Check size={14} strokeWidth={3} /> Guardar Permisos
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

