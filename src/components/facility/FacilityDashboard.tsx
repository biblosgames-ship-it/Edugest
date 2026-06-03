import React, { useState, useEffect } from 'react';
import {
  Wrench,
  CheckSquare,
  AlertTriangle,
  Package,
  Settings,
  Map,
  Activity,
  PlusCircle,
  ClipboardCheck,
  Camera,
  CheckCircle,
  Edit2,
  Trash2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { facilityService } from '../../services/facilityService';
import toast from 'react-hot-toast';
import { SEO } from '../SEO';
import { AreaModal, TaskModal, IncidentModal, InventoryModal } from './FacilityModals';

export const FacilityDashboard = ({ userData }: { userData: any }) => {
  const { state, profile } = useApp();
  const [activeTab, setActiveTab] = useState('tasks');
  const [loading, setLoading] = useState(true);

  // Data states
  const [areas, setAreas] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);

  // Modals state
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [editingArea, setEditingArea] = useState<any>(null);

  const isSupportStaff = userData?.role === 'support' || userData?.role === 'conserje';
  const isAdminOrSupervisor = ['admin', 'coordinator', 'supervisor', 'superAdmin'].includes(
    userData?.role || ''
  );

  const userFullName = (profile?.full_name || userData?.full_name || '').trim().toLowerCase();

  const displayAreas = isSupportStaff
    ? areas.filter((a) => (a.assignee_name || '').trim().toLowerCase() === userFullName)
    : areas;

  const displayTasks = isSupportStaff
    ? tasks.filter(
        (t) =>
          (t.assignee_name || '').trim().toLowerCase() === userFullName ||
          displayAreas.some((a) => a.id === t.area_id)
      )
    : tasks;

  useEffect(() => {
    if (profile) {
      if (profile.center_id) {
        loadData();
      } else {
        setLoading(false);
      }
    }
  }, [profile?.id, profile?.center_id]);

  const loadData = async () => {
    if (!profile?.center_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const centerId = profile.center_id;

      const safeFetch = async (promise: Promise<any>) => {
        try {
          return await promise;
        } catch (e) {
          return [];
        }
      };

      const [areasData, tasksData, incidentsData, inventoryData, assetsData] = await Promise.all([
        safeFetch(facilityService.getAreas(centerId)),
        safeFetch(facilityService.getTasks(centerId)),
        safeFetch(facilityService.getIncidents(centerId)),
        safeFetch(facilityService.getInventory(centerId)),
        safeFetch(facilityService.getAssets(centerId))
      ]);

      setAreas(areasData);
      setTasks(tasksData);
      setIncidents(incidentsData);
      setInventory(inventoryData);
      setAssets(assetsData);
    } catch (error) {
      console.error('Error loading facility data:', error);
      toast.error('Error al cargar datos del plantel. Verifica si las tablas existen.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveArea = async (formData: any) => {
    try {
      const centerId = profile?.center_id || userData?.center_id;
      if (!centerId) throw new Error('No se encontró el ID del centro.');
      if (formData.id) {
        // Mode: Edit
        const areaPayload = { ...formData, center_id: centerId };
        await facilityService.updateArea(formData.id, areaPayload);
        setAreas(areas.map((a) => (a.id === formData.id ? { ...a, ...areaPayload } : a)));
        toast.success('Área actualizada exitosamente');
      } else {
        // Mode: Create
        const newArea = await facilityService.createArea({ ...formData, center_id: centerId });
        setAreas([...areas, newArea]);
        toast.success('Área registrada exitosamente');
      }
    } catch (e: any) {
      console.error('Error saving facility area:', e);
      toast.error(formData.id ? 'Error al actualizar área' : 'Error al registrar área');
    }
  };

  const handleDeleteArea = async (id: string) => {
    if (
      !window.confirm(
        '¿Estás seguro de que deseas eliminar esta área? Esta acción no se puede deshacer.'
      )
    ) {
      return;
    }
    try {
      await facilityService.deleteArea(id);
      setAreas(areas.filter((a) => a.id !== id));
      toast.success('Área eliminada exitosamente');
    } catch (e) {
      toast.error('Error al eliminar área');
    }
  };

  const handleSaveTask = async (formData: any) => {
    try {
      const centerId = profile?.center_id || userData?.center_id;
      if (!centerId) throw new Error('No se encontró el ID del centro.');
      const newTask = await facilityService.createTask({ ...formData, center_id: centerId });
      setTasks([...tasks, newTask]);
      toast.success('Tarea asignada exitosamente');
    } catch (e: any) {
      console.error('Error saving facility task:', e);
      toast.error('Error al asignar tarea');
    }
  };

  const handleSaveIncident = async (formData: any) => {
    try {
      const centerId = profile?.center_id || userData?.center_id;
      if (!centerId) throw new Error('No se encontró el ID del centro.');
      const newIncident = await facilityService.createIncident({
        ...formData,
        center_id: centerId
      });
      setIncidents([newIncident, ...incidents]);
      toast.success('Reporte enviado exitosamente');
    } catch (e: any) {
      console.error('Error saving incident:', e);
      toast.error('Error al enviar reporte');
    }
  };

  const handleSaveInventory = async (formData: any) => {
    try {
      const centerId = profile?.center_id || userData?.center_id;
      if (!centerId) throw new Error('No se encontró el ID del centro.');
      const newItem = await facilityService.createInventoryItem({
        ...formData,
        center_id: centerId
      });
      setInventory([...inventory, newItem]);
      toast.success('Insumo registrado exitosamente');
    } catch (e: any) {
      console.error('Error saving inventory item:', e);
      toast.error('Error al registrar insumo');
    }
  };

  const completeTask = async (id: string) => {
    try {
      await facilityService.updateTask(id, { status: 'completada' });
      setTasks(tasks.map((t) => (t.id === id ? { ...t, status: 'completada' } : t)));
      toast.success('¡Excelente! Tarea completada.');
    } catch (e) {
      toast.error('Error al completar la tarea');
    }
  };

  const resolveIncident = async (id: string) => {
    try {
      await facilityService.updateIncident(id, { status: 'resuelto' });
      setIncidents(incidents.map((i) => (i.id === id ? { ...i, status: 'resuelto' } : i)));
      toast.success('Problema marcado como resuelto.');
    } catch (e) {
      toast.error('Error al actualizar el reporte');
    }
  };

  const getAreaName = (areaId: string) => {
    const area = areas.find((a) => a.id === areaId);
    return area ? area.name : 'Área Desconocida';
  };

  // ---------------------------------------------------------------------------
  // RENDERIZADO DE TABS PARA CONSERJES / SOPORTE (Mobile First)
  // ---------------------------------------------------------------------------
  const renderSupportTabs = () => (
    <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar">
      <button
        onClick={() => setActiveTab('tasks')}
        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[11px] tracking-widest whitespace-nowrap transition-all ${
          activeTab === 'tasks'
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
            : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
        }`}
      >
        <CheckSquare size={16} /> Mis Tareas
      </button>
      <button
        onClick={() => setActiveTab('incidents')}
        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[11px] tracking-widest whitespace-nowrap transition-all ${
          activeTab === 'incidents'
            ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
            : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
        }`}
      >
        <AlertTriangle size={16} /> Reportar Daño
      </button>
      <button
        onClick={() => setActiveTab('inventory')}
        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[11px] tracking-widest whitespace-nowrap transition-all ${
          activeTab === 'inventory'
            ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
            : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
        }`}
      >
        <Package size={16} /> Insumos
      </button>
    </div>
  );

  // ---------------------------------------------------------------------------
  // RENDERIZADO DE TABS PARA ADMINISTRADORES / SUPERVISORES
  // ---------------------------------------------------------------------------
  const renderAdminTabs = () => (
    <div className="flex flex-wrap gap-2 pb-4">
      <button
        onClick={() => setActiveTab('metrics')}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
          activeTab === 'metrics'
            ? 'bg-indigo-600 text-white shadow-md'
            : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
        }`}
      >
        <Activity size={14} /> Métricas
      </button>
      <button
        onClick={() => setActiveTab('areas')}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
          activeTab === 'areas'
            ? 'bg-indigo-600 text-white shadow-md'
            : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
        }`}
      >
        <Map size={14} /> Áreas del Plantel
      </button>
      <button
        onClick={() => setActiveTab('tasks')}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
          activeTab === 'tasks'
            ? 'bg-indigo-600 text-white shadow-md'
            : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
        }`}
      >
        <ClipboardCheck size={14} /> Mantenimiento & Tareas
      </button>
      <button
        onClick={() => setActiveTab('incidents')}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
          activeTab === 'incidents'
            ? 'bg-rose-600 text-white shadow-md'
            : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
        }`}
      >
        <AlertTriangle size={14} /> Incidencias
      </button>
      <button
        onClick={() => setActiveTab('inventory')}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
          activeTab === 'inventory'
            ? 'bg-amber-500 text-white shadow-md'
            : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
        }`}
      >
        <Package size={14} /> Inventario e Insumos
      </button>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <SEO
        title="Gestión de Plantel"
        description="Gestión de infraestructura, mantenimiento y limpieza del centro educativo."
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2 opacity-50"></div>

        <div className="flex items-center gap-5">
          <div className="p-4 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/30 text-white">
            <Wrench size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">
              {isSupportStaff ? 'Mi Panel Operativo' : 'Gestión de Plantel'}
            </h1>
            <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">
              Control de Infraestructura y Mantenimiento
            </p>
          </div>
        </div>

        {isAdminOrSupervisor && (
          <button
            onClick={loadData}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-colors shadow-lg"
          >
            Sincronizar Datos
          </button>
        )}
      </div>

      {/* Tabs */}
      {isSupportStaff ? renderSupportTabs() : renderAdminTabs()}

      {/* Content Area */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl p-6 md:p-8 min-h-[500px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-4">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="font-bold uppercase tracking-widest text-xs">
              Cargando datos del plantel...
            </p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* VISTA: TAREAS */}
            {activeTab === 'tasks' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-slate-800">Tareas y Mantenimiento</h2>
                  {isAdminOrSupervisor && (
                    <button
                      onClick={() => setShowTaskModal(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-colors shadow-lg"
                    >
                      <PlusCircle size={16} /> Nueva Tarea
                    </button>
                  )}
                </div>

                {displayTasks.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <CheckSquare size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-bold">No hay tareas registradas.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displayTasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-6 border border-slate-200 rounded-[2rem] bg-white shadow-sm flex flex-col justify-between hover:shadow-lg transition-shadow"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <span className="text-xs font-black uppercase px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl">
                              {task.task_type}
                            </span>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
                                task.status === 'pendiente'
                                  ? 'bg-amber-50 text-amber-600'
                                  : task.status === 'completada'
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {task.status}
                            </span>
                          </div>
                          <h3 className="font-black text-slate-800 text-xl mb-1">
                            {getAreaName(task.area_id)}
                          </h3>
                          <p className="text-sm font-bold text-slate-500 mb-2 capitalize">
                            Frecuencia: {task.frequency}
                          </p>
                          {task.assignee_name && (
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-4">
                              Asignado a: {task.assignee_name}
                            </p>
                          )}
                        </div>

                        {task.status === 'pendiente' && (
                          <button
                            onClick={() => completeTask(task.id)}
                            className="w-full py-3.5 mt-4 bg-emerald-500 text-white rounded-xl font-black uppercase text-[11px] tracking-widest hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                          >
                            <CheckCircle size={16} /> Marcar como Completada
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VISTA: INCIDENCIAS */}
            {activeTab === 'incidents' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-slate-800">Reporte de Daños y Averías</h2>
                  <button
                    onClick={() => setShowIncidentModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/20"
                  >
                    <AlertTriangle size={16} /> Reportar Daño
                  </button>
                </div>

                {incidents.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <AlertTriangle size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-bold text-lg">
                      No hay incidencias reportadas actualmente.
                    </p>
                    <p className="text-slate-400">Todo el plantel está en orden.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {incidents.map((inc) => (
                      <div
                        key={inc.id}
                        className="p-6 border border-slate-200 rounded-[2rem] bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                      >
                        <div className="flex gap-4 items-start">
                          <div
                            className={`p-4 rounded-2xl ${inc.status === 'resuelto' ? 'bg-emerald-100 text-emerald-600' : inc.urgency === 'alta' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}
                          >
                            {inc.status === 'resuelto' ? (
                              <CheckCircle size={24} />
                            ) : (
                              <AlertTriangle size={24} />
                            )}
                          </div>
                          <div>
                            <div className="flex gap-2 items-center mb-1">
                              <h3 className="font-black text-slate-800 text-xl">
                                {getAreaName(inc.area_id)}
                              </h3>
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${inc.status === 'resuelto' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}
                              >
                                {inc.status}
                              </span>
                            </div>
                            <p className="text-slate-600 font-medium">{inc.description}</p>
                            <div className="flex gap-3 mt-2 text-xs font-black uppercase tracking-widest text-slate-400">
                              <span className="capitalize text-indigo-500">
                                {inc.incident_type}
                              </span>
                              <span>•</span>
                              <span
                                className={
                                  inc.urgency === 'alta' ? 'text-rose-500' : 'text-amber-500'
                                }
                              >
                                Urgencia: {inc.urgency}
                              </span>
                            </div>
                          </div>
                        </div>

                        {inc.status !== 'resuelto' && isAdminOrSupervisor && (
                          <button
                            onClick={() => resolveIncident(inc.id)}
                            className="w-full md:w-auto px-6 py-3 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                          >
                            <CheckCircle size={16} /> Resolver
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VISTA: AREAS */}
            {activeTab === 'areas' && isAdminOrSupervisor && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-slate-800">Áreas de Infraestructura</h2>
                  <button
                    onClick={() => {
                      setEditingArea(null);
                      setShowAreaModal(true);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-colors shadow-lg"
                  >
                    <PlusCircle size={16} /> Agregar Área
                  </button>
                </div>

                {areas.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <Map size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-bold">
                      Configura las aulas, baños y áreas del plantel.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {areas.map((a) => (
                      <div
                        key={a.id}
                        className="p-6 border border-slate-200 rounded-[2rem] bg-white shadow-sm flex flex-col justify-between hover:border-indigo-200 transition-colors"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <span className="text-xs font-black uppercase px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl">
                              {a.code}
                            </span>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${a.status === 'bueno' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}
                            >
                              {a.status}
                            </span>
                          </div>
                          <h3 className="font-black text-slate-800 text-xl mb-1">{a.name}</h3>
                          <p className="text-sm font-bold text-slate-500 capitalize">{a.type}</p>

                          {a.assignee_name && (
                            <div className="mt-4 p-3 bg-indigo-50 rounded-xl">
                              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">
                                Responsable
                              </p>
                              <p className="text-sm font-bold text-indigo-700">{a.assignee_name}</p>
                            </div>
                          )}
                        </div>

                        {isAdminOrSupervisor && (
                          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 justify-end">
                            <button
                              onClick={() => {
                                setEditingArea(a);
                                setShowAreaModal(true);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 size={14} /> Editar
                            </button>
                            <button
                              onClick={() => handleDeleteArea(a.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} /> Borrar
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VISTA: INVENTARIO */}
            {activeTab === 'inventory' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-slate-800">Insumos y Materiales</h2>
                  {(isAdminOrSupervisor || isSupportStaff) && (
                    <button
                      onClick={() => setShowInventoryModal(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-600 transition-colors shadow-lg"
                    >
                      <PlusCircle size={16} /> Agregar Insumo
                    </button>
                  )}
                </div>

                {inventory.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <Package size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-bold">
                      No hay materiales de limpieza registrados.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {inventory.map((item) => (
                      <div
                        key={item.id}
                        className={`p-6 border rounded-[2rem] shadow-sm text-center ${item.quantity <= item.min_stock ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}
                      >
                        <h3 className="font-black text-slate-800 text-lg mb-4">{item.name}</h3>
                        <div className="flex flex-col items-center justify-center">
                          <span
                            className={`text-5xl font-black tracking-tighter ${item.quantity <= item.min_stock ? 'text-rose-600' : 'text-slate-700'}`}
                          >
                            {item.quantity}
                          </span>
                          <span className="text-xs font-black uppercase tracking-widest text-slate-400 mt-2">
                            {item.unit}
                          </span>
                        </div>
                        {item.quantity <= item.min_stock && (
                          <p className="text-xs font-bold text-rose-500 mt-4 bg-rose-100 py-1.5 px-3 rounded-lg inline-block">
                            ¡Stock Bajo!
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VISTA: METRICAS */}
            {activeTab === 'metrics' && isAdminOrSupervisor && (
              <div>
                <div className="flex items-center gap-4 mb-8">
                  <Activity size={24} className="text-indigo-600" />
                  <h2 className="text-2xl font-black text-slate-800 tracking-tighter">
                    Métricas de Plantel
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2.5rem]">
                    <h3 className="text-emerald-800 font-black uppercase tracking-widest text-[10px] mb-2">
                      Tareas Completadas
                    </h3>
                    <p className="text-5xl font-black text-emerald-600 tracking-tighter">
                      {
                        tasks.filter((t) => t.status === 'completada' || t.status === 'aprobada')
                          .length
                      }
                      <span className="text-xl text-emerald-400"> / {tasks.length}</span>
                    </p>
                  </div>

                  <div className="bg-rose-50 border border-rose-100 p-8 rounded-[2.5rem]">
                    <h3 className="text-rose-800 font-black uppercase tracking-widest text-[10px] mb-2">
                      Incidencias Activas
                    </h3>
                    <p className="text-5xl font-black text-rose-600 tracking-tighter">
                      {incidents.filter((i) => i.status !== 'resuelto').length}
                    </p>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 p-8 rounded-[2.5rem]">
                    <h3 className="text-amber-800 font-black uppercase tracking-widest text-[10px] mb-2">
                      Alertas de Inventario
                    </h3>
                    <p className="text-5xl font-black text-amber-600 tracking-tighter">
                      {inventory.filter((i) => i.quantity <= i.min_stock).length}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <AreaModal
        isOpen={showAreaModal}
        onClose={() => {
          setShowAreaModal(false);
          setEditingArea(null);
        }}
        onSave={handleSaveArea}
        initialData={editingArea}
        staff={state.teachers}
      />
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onSave={handleSaveTask}
        areas={areas}
        staff={state.teachers}
      />
      <IncidentModal
        isOpen={showIncidentModal}
        onClose={() => setShowIncidentModal(false)}
        onSave={handleSaveIncident}
        areas={areas}
      />
      <InventoryModal
        isOpen={showInventoryModal}
        onClose={() => setShowInventoryModal(false)}
        onSave={handleSaveInventory}
      />
    </div>
  );
};
