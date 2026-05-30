import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, Package, Map } from 'lucide-react';
import toast from 'react-hot-toast';

export const ModalWrapper = ({ isOpen, onClose, title, children, icon: Icon }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                <Icon size={20} />
              </div>
            )}
            <h3 className="text-xl font-black text-slate-800 tracking-tight">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-rose-100 hover:text-rose-600 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export const AreaModal = ({ isOpen, onClose, onSave, initialData = null, staff = [] }: any) => {
  const [formData, setFormData] = useState({ 
    name: '', code: '', type: 'aula', location: '', priority: 'media', status: 'bueno', assignee_name: '', assignee_id: '' 
  });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (initialData && isOpen) {
      setFormData({
        name: initialData.name || '',
        code: initialData.code || '',
        type: initialData.type || 'aula',
        location: initialData.location || '',
        priority: initialData.priority || 'media',
        status: initialData.status || 'bueno',
        assignee_name: initialData.assignee_name || '',
        assignee_id: initialData.assignee_id || ''
      });
    } else if (isOpen) {
      setFormData({ name: '', code: '', type: 'aula', location: '', priority: 'media', status: 'bueno', assignee_name: '', assignee_id: '' });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const cleanedData = {
      ...formData,
      assignee_id: formData.assignee_id ? formData.assignee_id : null
    };
    await onSave(initialData?.id ? { ...cleanedData, id: initialData.id } : cleanedData);
    setLoading(false);
    onClose();
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title={initialData ? "Editar Área" : "Agregar Área del Plantel"} icon={Map}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Nombre del Área</label>
          <input required type="text" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="Ej. Aula 1A" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Código</label>
            <input required type="text" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200" placeholder="Ej. AUL-1A" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Tipo</label>
            <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
              <option value="aula">Aula</option>
              <option value="baño">Baño</option>
              <option value="oficina">Oficina</option>
              <option value="patio">Patio/Cancha</option>
              <option value="pasillo">Pasillo</option>
              <option value="comedor">Comedor</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Personal Asignado (Responsable)</label>
          <select 
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 h-[52px]" 
            value={formData.assignee_name || ''} 
            onChange={e => {
              const selectedName = e.target.value;
              const matched = staff.find((s: any) => s.full_name === selectedName);
              setFormData({
                ...formData,
                assignee_name: selectedName,
                assignee_id: matched ? matched.id : ''
              });
            }}
          >
            <option value="">-- Sin asignar --</option>
            {staff.map((s: any) => (
              <option key={s.id} value={s.full_name}>
                {s.full_name} ({s.role === 'support' ? 'Personal de Apoyo' : s.role === 'teacher' ? 'Docente' : s.role === 'management' ? 'Gestión' : s.role === 'management_teacher' ? 'Docente y Gestión' : s.role})
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Prioridad</label>
            <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Estado</label>
            <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
              <option value="bueno">Bueno</option>
              <option value="regular">Regular</option>
              <option value="critico">Crítico</option>
            </select>
          </div>
        </div>
        <button disabled={loading} type="submit" className="w-full py-4 mt-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg shadow-indigo-200 transition-all">
          {loading ? 'Guardando...' : (initialData ? 'Guardar Cambios' : 'Guardar Área')}
        </button>
      </form>
    </ModalWrapper>
  );
};

export const IncidentModal = ({ isOpen, onClose, onSave, areas = [] }: any) => {
  const [formData, setFormData] = useState({ 
    area_id: '', incident_type: 'daño', description: '', urgency: 'media', status: 'abierto'
  });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setFormData({ area_id: areas.length > 0 ? areas[0].id : '', incident_type: 'daño', description: '', urgency: 'media', status: 'abierto' });
    }
  }, [isOpen, areas]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!formData.area_id) {
      toast.error('Debe seleccionar un área.');
      return;
    }
    setLoading(true);
    await onSave(formData);
    setLoading(false);
    onClose();
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Reportar Daño o Avería" icon={AlertTriangle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">¿Dónde ocurrió?</label>
          <select required className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-lg font-bold text-slate-700" value={formData.area_id} onChange={e => setFormData({...formData, area_id: e.target.value})}>
            {areas.length === 0 && <option value="">No hay áreas registradas</option>}
            {areas.map((area: any) => (
              <option key={area.id} value={area.id}>{area.name} ({area.type})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">¿Qué pasó?</label>
          <textarea required rows={3} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200" placeholder="Ej. El tubo de agua del lavabo está roto y botando agua." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Tipo de Problema</label>
            <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200" value={formData.incident_type} onChange={e => setFormData({...formData, incident_type: e.target.value})}>
              <option value="plomeria">Plomería / Agua</option>
              <option value="electricidad">Electricidad</option>
              <option value="mobiliario">Mobiliario Roto</option>
              <option value="limpieza">Falta Limpieza Profunda</option>
              <option value="daño">Otro Daño Físico</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Urgencia</label>
            <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200" value={formData.urgency} onChange={e => setFormData({...formData, urgency: e.target.value})}>
              <option value="alta">🚨 Alta (Atender Ya)</option>
              <option value="media">⚠️ Media (Atender Hoy)</option>
              <option value="baja">🟢 Baja (Cuando se pueda)</option>
            </select>
          </div>
        </div>
        <button disabled={loading} type="submit" className="w-full py-4 mt-6 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg shadow-rose-200 transition-all">
          {loading ? 'Enviando Reporte...' : 'Enviar Reporte'}
        </button>
      </form>
    </ModalWrapper>
  );
};

export const TaskModal = ({ isOpen, onClose, onSave, areas = [], staff = [] }: any) => {
  const [formData, setFormData] = useState({ 
    area_id: '', task_type: 'limpieza', frequency: 'diaria', status: 'pendiente', assignee_name: '', assignee_id: ''
  });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setFormData({ 
        area_id: areas.length > 0 ? areas[0].id : '', 
        task_type: 'limpieza', 
        frequency: 'diaria', 
        status: 'pendiente', 
        assignee_name: '',
        assignee_id: ''
      });
    }
  }, [isOpen, areas]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!formData.area_id) {
      toast.error('Debe seleccionar un área.');
      return;
    }
    setLoading(true);
    const cleanedData = {
      ...formData,
      assignee_id: formData.assignee_id ? formData.assignee_id : null
    };
    await onSave(cleanedData);
    setLoading(false);
    onClose();
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Asignar Nueva Tarea" icon={CheckCircle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Área a Mantener</label>
          <select required className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-lg font-bold text-slate-700" value={formData.area_id} onChange={e => setFormData({...formData, area_id: e.target.value})}>
            {areas.length === 0 && <option value="">No hay áreas registradas</option>}
            {areas.map((area: any) => (
              <option key={area.id} value={area.id}>{area.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Tipo de Tarea</label>
            <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200" value={formData.task_type} onChange={e => setFormData({...formData, task_type: e.target.value})}>
              <option value="limpieza">Limpieza General</option>
              <option value="mantenimiento">Mantenimiento Preventivo</option>
              <option value="inspeccion">Inspección de Área</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Frecuencia</label>
            <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200" value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value})}>
              <option value="diaria">Diaria</option>
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
              <option value="unica">Una sola vez</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Asignar a (Nombre del Conserje)</label>
          <select 
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 h-[52px]" 
            value={formData.assignee_name || ''} 
            onChange={e => {
              const selectedName = e.target.value;
              const matched = staff.find((s: any) => s.full_name === selectedName);
              setFormData({
                ...formData,
                assignee_name: selectedName,
                assignee_id: matched ? matched.id : ''
              });
            }}
          >
            <option value="">-- Sin asignar --</option>
            {staff.map((s: any) => (
              <option key={s.id} value={s.full_name}>
                {s.full_name} ({s.role === 'support' ? 'Personal de Apoyo' : s.role === 'teacher' ? 'Docente' : s.role === 'management' ? 'Gestión' : s.role === 'management_teacher' ? 'Docente y Gestión' : s.role})
              </option>
            ))}
          </select>
        </div>
        <button disabled={loading} type="submit" className="w-full py-4 mt-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg shadow-indigo-200 transition-all">
          {loading ? 'Creando Tarea...' : 'Crear Tarea'}
        </button>
      </form>
    </ModalWrapper>
  );
};

export const InventoryModal = ({ isOpen, onClose, onSave }: any) => {
  const [formData, setFormData] = useState({ 
    name: '', quantity: 0, min_stock: 5, unit: 'unidades'
  });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setFormData({ name: '', quantity: 0, min_stock: 5, unit: 'unidades' });
    }
  }, [isOpen]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    await onSave(formData);
    setLoading(false);
    onClose();
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Agregar Insumo" icon={Package}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Nombre del Insumo</label>
          <input required type="text" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-lg font-bold" placeholder="Ej. Escoba, Cloro, Papel Higiénico" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Cantidad Actual</label>
            <input required type="number" min="0" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-center text-xl font-black text-slate-800" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})} />
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Mínimo Ideal</label>
            <input required type="number" min="0" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-center text-xl font-black text-slate-800" value={formData.min_stock} onChange={e => setFormData({...formData, min_stock: parseInt(e.target.value) || 0})} />
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Unidad</label>
            <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 h-[52px]" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}>
              <option value="unidades">Unidades</option>
              <option value="litros">Litros</option>
              <option value="galones">Galones</option>
              <option value="paquetes">Paquetes</option>
              <option value="cajas">Cajas</option>
            </select>
          </div>
        </div>
        <button disabled={loading} type="submit" className="w-full py-4 mt-6 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg shadow-amber-200 transition-all">
          {loading ? 'Guardando...' : 'Guardar Insumo'}
        </button>
      </form>
    </ModalWrapper>
  );
};
