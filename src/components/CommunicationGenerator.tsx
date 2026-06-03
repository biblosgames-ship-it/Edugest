import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dataService } from '../services/dataService';
import {
  Send,
  Users,
  UserPlus,
  Info,
  ClipboardList,
  History,
  Trash2,
  Calendar
} from 'lucide-react';

export const CommunicationGenerator = ({ userData: profile }: { userData: any }) => {
  const { state } = useApp();
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [motives, setMotives] = useState<string[]>([
    'Excusa',
    'Acompañamiento Docente',
    'Comunicado General',
    'Recordatorio de Pago'
  ]);
  const [newMotive, setNewMotive] = useState('');
  const [selectedMotive, setSelectedMotive] = useState(motives[0]);

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [isSending, setIsSending] = useState(false);

  const fetchHistory = async () => {
    if (!profile?.id) return;
    try {
      setIsLoadingHistory(true);
      const data = await dataService.getCommunications(profile.id, 'admin'); // Pass admin to see all center comms
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching communications history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [profile?.id]);

  const addMotive = () => {
    if (newMotive && !motives.includes(newMotive)) {
      setMotives([...motives, newMotive]);
      setSelectedMotive(newMotive);
      setNewMotive('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      selectedRoles.length === 0 &&
      selectedCourses.length === 0 &&
      selectedTeachers.length === 0
    ) {
      alert('Por favor selecciona al menos un destinatario.');
      return;
    }

    if (!profile?.center_id) {
      alert('Error: No se encontró el ID del centro en tu perfil.');
      return;
    }

    setIsSending(true);
    try {
      await dataService.saveCommunication({
        center_id: profile.center_id,
        sender_id: profile.id,
        sender_name: profile.full_name || 'Personal Administrativo',
        motive: selectedMotive,
        message: reason,
        target_roles: selectedRoles,
        target_courses: selectedCourses,
        target_teachers: selectedTeachers
      });

      alert('Comunicación enviada y registrada correctamente.');
      setReason('');
      setSelectedRoles([]);
      setSelectedCourses([]);
      setSelectedTeachers([]);
      fetchHistory();
    } catch (error) {
      console.error('Error sending communication:', error);
      alert('Error al enviar la comunicación.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta comunicación/excusa?')) return;
    try {
      await dataService.deleteCommunication(id);
      alert('Comunicación eliminada correctamente.');
      fetchHistory();
    } catch (error) {
      console.error('Error deleting communication:', error);
      alert('Error al eliminar la comunicación.');
    }
  };

  const getCourseName = (id: string) => {
    const course = state.courses.find((c) => c.id === id);
    return course ? `${course.level} ${course.grade} ${course.section}` : id;
  };

  const renderTargets = (comm: any) => {
    const targets: string[] = [];
    if (comm.target_roles && comm.target_roles.length > 0) {
      targets.push(`Roles: ${comm.target_roles.join(', ')}`);
    }
    if (comm.target_courses && comm.target_courses.length > 0) {
      const courseNames = comm.target_courses.map(getCourseName);
      targets.push(`Cursos: ${courseNames.join(', ')}`);
    }
    if (comm.target_teachers && comm.target_teachers.length > 0) {
      targets.push(`Docentes: ${comm.target_teachers.length} seleccionados`);
    }
    return targets.join(' | ') || 'Ninguno';
  };

  const sectionClass = 'bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-4';
  const labelClass = 'text-sm font-bold text-slate-700 flex items-center gap-2 mb-3';
  const checkboxClass =
    'w-5 h-5 rounded-md border-slate-300 text-brand-blue focus:ring-brand-blue transition-all cursor-pointer';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-brand-blue/10 rounded-2xl flex items-center justify-center text-brand-blue">
          <Send size={28} />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800">Generador de Comunicaciones</h2>
          <p className="text-slate-500">
            Envía mensajes masivos o dirigidos a la comunidad educativa y administra el historial
          </p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-4 border-b border-slate-100 pb-1">
        <button
          onClick={() => setActiveTab('form')}
          className={`pb-3 font-bold text-sm transition-all border-b-2 px-1 flex items-center gap-2 ${
            activeTab === 'form'
              ? 'border-brand-blue text-brand-blue'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Send size={16} />
          Nueva Comunicación / Excusa
        </button>
        <button
          onClick={() => {
            setActiveTab('history');
            fetchHistory();
          }}
          className={`pb-3 font-bold text-sm transition-all border-b-2 px-1 flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-brand-blue text-brand-blue'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <History size={16} />
          Historial y Registro ({history.length})
        </button>
      </div>

      {activeTab === 'form' ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* MOTIVO */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <label className={labelClass}>
              <Info size={18} className="text-brand-blue" />
              Motivo de la Comunicación
            </label>
            <div className="flex gap-3 mb-4">
              <input
                value={newMotive}
                onChange={(e) => setNewMotive(e.target.value)}
                placeholder="Añadir otro motivo personalizado..."
                className="flex-1 p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-blue transition-all"
              />
              <button
                type="button"
                onClick={addMotive}
                className="bg-slate-100 px-6 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-all flex items-center gap-2"
              >
                <UserPlus size={18} />
                Añadir
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {motives.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedMotive(m)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
                    selectedMotive === m
                      ? 'bg-brand-blue text-white border-brand-blue shadow-md'
                      : 'bg-white text-slate-500 border-slate-100 hover:border-brand-blue/30'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* DESTINATARIOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* POR ROL */}
            <div className={sectionClass}>
              <label className={labelClass}>
                <Users size={18} className="text-brand-blue" />
                Enviar por Rol
              </label>
              <div className="grid grid-cols-1 gap-3">
                {['Docentes', 'Padres', 'Alumnos', 'Toda la comunidad'].map((role) => (
                  <label
                    key={role}
                    className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:border-brand-blue/30 transition-all cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role)}
                      className={checkboxClass}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedRoles([...selectedRoles, role]);
                        else setSelectedRoles(selectedRoles.filter((r) => r !== role));
                      }}
                    />
                    <span className="text-sm font-medium text-slate-700">{role}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* POR CURSO */}
            <div className={sectionClass}>
              <label className={labelClass}>
                <ClipboardList size={18} className="text-brand-blue" />
                Enviar por Cursos
              </label>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                <label className="flex items-center gap-3 p-3 bg-brand-blue/5 rounded-xl border border-brand-blue/10 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      selectedCourses.length === state.courses.length && state.courses.length > 0
                    }
                    className={checkboxClass}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedCourses(state.courses.map((c) => c.id));
                      else setSelectedCourses([]);
                    }}
                  />
                  <span className="text-sm font-bold text-brand-blue">Todos los cursos</span>
                </label>
                {state.courses.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:border-brand-blue/30 transition-all cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCourses.includes(c.id)}
                      className={checkboxClass}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedCourses([...selectedCourses, c.id]);
                        else setSelectedCourses(selectedCourses.filter((id) => id !== c.id));
                      }}
                    />
                    <span className="text-sm font-medium text-slate-700">
                      {c.level} {c.grade} {c.section}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* MENSAJE */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <label className={labelClass}>Contenido del Mensaje</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Escribe aquí el cuerpo del comunicado o motivo de excusa..."
              className="w-full h-48 p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue transition-all resize-none"
              required
            />
            <button
              type="submit"
              disabled={isSending}
              className="w-full bg-brand-blue text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-brand-blue/90 transition-all shadow-xl shadow-brand-blue/20 disabled:opacity-50"
            >
              {isSending ? (
                'Enviando...'
              ) : (
                <>
                  <Send size={20} />
                  Emitir Comunicación Oficial
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          {isLoadingHistory ? (
            <div className="text-center py-12 text-slate-400">Cargando historial...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No hay ninguna comunicación o excusa registrada aún en este centro.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((comm) => (
                <div
                  key={comm.id}
                  className="py-6 first:pt-0 last:pb-0 flex flex-col md:flex-row gap-4 justify-between items-start"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-brand-blue/10 text-brand-blue text-[10px] font-black uppercase px-3 py-1 rounded-full">
                        {comm.motive}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(comm.created_at).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400">
                      <strong className="text-slate-600">Enviado por:</strong> {comm.sender_name}
                    </p>

                    <p className="text-xs text-slate-400">
                      <strong className="text-slate-600">Destinatarios:</strong>{' '}
                      {renderTargets(comm)}
                    </p>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/50 mt-2">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {comm.message}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(comm.id)}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 p-3 rounded-xl transition-all flex items-center justify-center self-end md:self-start"
                    title="Eliminar comunicación"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
