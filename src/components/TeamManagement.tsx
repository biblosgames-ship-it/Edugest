import { useState } from 'react';
import { useApp, useSupabase } from '../context/AppContext';
import { useTeachers } from '../hooks/useTeachers';
import {
  Users,
  UserPlus,
  Star,
  Briefcase,
  UserCheck,
  Shield,
  Pencil,
  Trash2,
  X,
  Save
} from 'lucide-react';
import { supabase } from '../lib/supabase';

import { toast } from 'react-hot-toast';

import { Search } from 'lucide-react';

export const TeamManagement = () => {
  const {
    teachers: allPersonnel,
    isLoading: loading,
    addTeacher,
    updateTeacher,
    deleteTeacher
  } = useTeachers();
  const [activeTab, setActiveTab] = useState<
    'all' | 'management' | 'administrative' | 'cashier' | 'support' | 'teacher'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const filteredUsers = (allPersonnel || []).filter((u) => {
    const matchesTab =
      activeTab === 'all' ||
      u.role === activeTab ||
      (u.role === 'management_teacher' && (activeTab === 'teacher' || activeTab === 'management'));

    if (!matchesTab) return false;
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase().trim();
    const name = (u.full_name || u.name || '').toLowerCase();
    const phone = (u.phone || '').toLowerCase();
    const role = (u.role || '').toLowerCase();
    return name.includes(query) || phone.includes(query) || role.includes(query);
  });

  const tabCounts = {
    all: (allPersonnel || []).length,
    management: (allPersonnel || []).filter(
      (u) => u.role === 'management' || u.role === 'management_teacher'
    ).length,
    administrative: (allPersonnel || []).filter((u) => u.role === 'administrative').length,
    cashier: (allPersonnel || []).filter((u) => u.role === 'cashier').length,
    support: (allPersonnel || []).filter((u) => u.role === 'support').length,
    teacher: (allPersonnel || []).filter(
      (u) => u.role === 'teacher' || u.role === 'management_teacher'
    ).length
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const roleSaved = editingUser.role || 'teacher';
      const dataToSave = {
        name: editingUser.full_name,
        full_name: editingUser.full_name,
        team: roleSaved,
        role: roleSaved,
        sex: editingUser.sex || 'M',
        phone: editingUser.phone || '',
        grades_editable: editingUser.grades_editable !== false
      };

      if (isCreating) {
        await addTeacher(dataToSave);
        toast.success(`¡Colaborador "${editingUser.full_name}" añadido correctamente!`);
      } else {
        await updateTeacher({ id: editingUser.id, updates: dataToSave });
        toast.success(`¡Colaborador "${editingUser.full_name}" actualizado correctamente!`);
      }

      // Si el rol guardado no coincide con la pestaña actual, cambiar la pestaña para que sea visible de inmediato
      if (activeTab !== 'all' && activeTab !== roleSaved) {
        if (roleSaved === 'management_teacher' && (activeTab === 'management' || activeTab === 'teacher')) {
          // Permanece visible
        } else {
          setActiveTab(roleSaved as any);
        }
      }

      setEditingUser(null);
      setIsCreating(false);
    } catch (err: any) {
      console.error('Error al guardar personal:', err);
      toast.error(err.message || 'Error al guardar el colaborador');
    }
  };

  const openCreateModal = () => {
    const defaultRole = activeTab !== 'all' ? activeTab : 'teacher';
    setEditingUser({
      full_name: '',
      role: defaultRole,
      sex: 'M',
      phone: '',
      grades_editable: true
    });
    setIsCreating(true);
  };

  return (
    <div className="space-y-3 animate-fade-in text-text-main">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-2">
        <h2 className="text-lg font-black uppercase text-text-main tracking-tighter flex items-center gap-2">
          <span>Personal del Centro</span>
          <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
            {(allPersonnel || []).length} miembros
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar colaborador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl border border-border-main bg-brand-bg text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500 w-40 sm:w-48"
            />
          </div>
          <button
            onClick={openCreateModal}
            className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl font-black uppercase text-[9px] shadow-sm hover:bg-indigo-700 flex items-center gap-1 active:scale-95 transition-all"
          >
            <UserPlus size={12} /> Nuevo
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 bg-brand-bg p-1 rounded-xl w-fit ml-2 shadow-inner border border-border-main">
        {[
          { id: 'all', label: 'Todos', count: tabCounts.all },
          { id: 'management', label: 'Gestión', count: tabCounts.management },
          { id: 'administrative', label: 'Admin', count: tabCounts.administrative },
          { id: 'cashier', label: 'Caja', count: tabCounts.cashier },
          { id: 'support', label: 'Apoyo', count: tabCounts.support },
          { id: 'teacher', label: 'Docentes', count: tabCounts.teacher }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1.5 ${
              activeTab === t.id
                ? 'bg-surface text-indigo-600 shadow-sm'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <span>{t.label}</span>
            <span
              className={`text-[8px] px-1.5 py-0.2 rounded-full ${
                activeTab === t.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-surface rounded-2xl border border-border-main shadow-sm overflow-hidden mx-2">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="px-4 py-2 text-[9px] font-black uppercase tracking-widest">
                Empleado
              </th>
              <th className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-center">
                Sexo
              </th>
              <th className="px-4 py-2 text-[9px] font-black uppercase tracking-widest">
                Teléfono
              </th>
              <th className="px-4 py-2 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-main">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-brand-bg transition-colors">
                <td className="px-4 py-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] ${user.sex === 'F' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}`}
                    >
                      {user.full_name[0]}
                    </div>
                    <div>
                      <div className="font-black text-text-main text-[11px] uppercase leading-none">
                        {user.full_name}
                      </div>
                      <div className="text-text-muted text-[8px] font-bold uppercase mt-0.5">
                        {user.role === 'management_teacher'
                          ? 'Docente y Gestión'
                          : user.role === 'teacher'
                            ? 'Docente'
                            : user.role === 'management'
                              ? 'Gestión'
                              : user.role === 'administrative'
                                ? 'Administrativo'
                                : user.role === 'cashier'
                                  ? 'Caja / Finanzas'
                                  : user.role === 'support'
                                    ? 'Apoyo'
                                    : user.role}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-1.5 text-center">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[8px] font-black ${user.sex === 'F' ? 'bg-pink-50 text-pink-600' : 'bg-blue-50 text-blue-600'}`}
                  >
                    {user.sex}
                  </span>
                </td>
                <td className="px-4 py-1.5 text-[10px] font-bold text-text-muted">
                  {user.phone || '---'}
                </td>
                <td className="px-4 py-1.5 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => {
                        setEditingUser(user);
                        setIsCreating(false);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        document.querySelectorAll('.overflow-y-auto').forEach((c) => c.scrollTo({ top: 0, behavior: 'smooth' }));
                      }}
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('¿Eliminar?')) deleteTeacher(user.id);
                      }}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-surface w-full max-w-xs rounded-2xl shadow-2xl p-5 space-y-3 border border-border-main"
          >
            <h3 className="text-xs font-black uppercase flex justify-between">
              {isCreating ? 'Nuevo Personal' : 'Editar Personal'}
              <X
                size={16}
                className="cursor-pointer"
                onClick={() => {
                  setEditingUser(null);
                  setIsCreating(false);
                }}
              />
            </h3>
            <div className="space-y-2">
              <input
                placeholder="Nombre completo"
                value={editingUser.full_name}
                onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 text-[11px] font-black uppercase border border-slate-100"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={editingUser.sex}
                  onChange={(e) => setEditingUser({ ...editingUser, sex: e.target.value })}
                  className="w-full px-2 py-1.5 rounded-lg border text-[10px] font-bold"
                >
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
                <input
                  value={editingUser.phone}
                  onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  className="w-full px-2 py-1.5 rounded-lg border text-[10px] font-bold"
                />
              </div>
              <select
                value={editingUser.role}
                onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                className="w-full px-2 py-1.5 rounded-lg border-2 border-indigo-100 text-[10px] font-black uppercase bg-indigo-50/30"
              >
                <option value="teacher">Docente</option>
                <option value="management_teacher">Docente y Gestión</option>
                <option value="management">Gestión</option>
                <option value="administrative">Admin</option>
                <option value="cashier">Caja / Finanzas</option>
                <option value="support">Apoyo</option>
              </select>

              {(editingUser.role === 'teacher' || editingUser.role === 'management_teacher') && (
                <div className="flex items-center gap-2 p-2 bg-indigo-50/30 border border-indigo-100/50 rounded-lg">
                  <input
                    type="checkbox"
                    id="grades_editable"
                    checked={editingUser.grades_editable !== false}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, grades_editable: e.target.checked })
                    }
                    className="w-3.5 h-3.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <label
                    htmlFor="grades_editable"
                    className="text-[9px] font-black text-slate-600 uppercase tracking-wider cursor-pointer select-none"
                  >
                    Permitir Digitar Notas
                  </label>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] shadow-md"
            >
              {loading ? 'Aplicando...' : 'Guardar'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
