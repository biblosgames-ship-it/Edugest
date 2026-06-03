import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { dataService } from '../services/dataService';
import {
  Building2,
  Phone,
  MapPin,
  Mail,
  Image as ImageIcon,
  Save,
  Info,
  Upload,
  CheckCircle2,
  Users,
  FileSpreadsheet
} from 'lucide-react';

export const CenterSettingsForm = () => {
  const { profile, refreshData } = useApp();
  const [center, setCenter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin =
    profile?.role === 'admin' || profile?.role === 'creator' || !!profile?.is_superadmin;

  useEffect(() => {
    const fetchCenter = async () => {
      if (!profile?.center_id) {
        setLoading(false);
        return;
      }
      try {
        const data = await dataService.getCenter(profile.center_id);
        setCenter(data);
      } catch (error) {
        console.error('Error fetching center:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCenter();
  }, [profile]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.center_id) return;

    setUploading(true);
    try {
      const publicUrl = await dataService.uploadLogo(profile.center_id, file);
      setCenter({ ...center, logo_url: publicUrl });
      alert('¡Logo subido exitosamente!');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      alert('Error al subir el logo. Asegúrate de que el bucket "center-logos" sea público.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.center_id || saving) return;

    setSaving(true);
    try {
      await dataService.updateCenter(profile.center_id, center);
      await refreshData(profile.center_id, true);
      alert('¡Configuración institucional actualizada exitosamente!');
    } catch (error: any) {
      console.error('Error saving center settings:', error);
      alert('Error al guardar: Asegúrese de haber ejecutado el script SQL para añadir los campos.');
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-4 text-slate-400">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="font-black uppercase text-[10px] tracking-widest">
          Cargando perfil institucional...
        </span>
      </div>
    );

  const inputClass =
    'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm font-medium';
  const labelClass =
    'block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1';

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden text-left"
      >
        <div className="bg-slate-900 p-10 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl font-black mb-2 flex items-center gap-3">
              <Building2 className="text-indigo-400" size={32} />
              Perfil Institucional
            </h2>
            <p className="text-slate-400 text-sm font-medium">
              Actualice su identidad oficial y cargue su logo institucional.
            </p>
          </div>
          <div className="absolute -right-10 -bottom-10 opacity-10">
            <Building2 size={200} />
          </div>
        </div>

        <div className="p-10 space-y-10">
          <div className="grid md:grid-cols-3 gap-8 items-start">
            <div className="md:col-span-1 flex flex-col items-center gap-4">
              <div className="relative group w-full aspect-square bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-indigo-400">
                {center?.logo_url ? (
                  <img
                    src={center.logo_url}
                    alt="Logo"
                    className="w-full h-full object-contain p-4"
                  />
                ) : (
                  <div className="flex flex-col items-center text-slate-300">
                    <ImageIcon size={48} className="mb-2" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Sin Logo
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-indigo-600/90 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Upload size={32} className="mb-2" />
                  <span className="text-xs font-black uppercase">Cambiar Logo</span>
                </button>

                {uploading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*"
              />
              <p className="text-[10px] text-slate-400 font-bold text-center uppercase tracking-tighter">
                JPG, PNG o SVG. Recomendado: 512x512px
              </p>
            </div>

            <div className="md:col-span-2 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nombre Oficial del Centro</label>
                  <input
                    type="text"
                    value={center?.name || ''}
                    onChange={(e) => setCenter({ ...center, name: e.target.value })}
                    className={`${inputClass} text-lg font-black text-indigo-700`}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Código del Centro (MINERD)</label>
                  <input
                    type="text"
                    placeholder="Ej: 00123"
                    value={center?.center_code || ''}
                    onChange={(e) => setCenter({ ...center, center_code: e.target.value })}
                    className={`${inputClass} text-lg font-black text-amber-600`}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Eslogan / Lema Institucional</label>
                <input
                  type="text"
                  placeholder="Ej: Compromiso con la excelencia"
                  value={center?.slogan || ''}
                  onChange={(e) => setCenter({ ...center, slogan: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500 mb-4 flex items-center gap-2">
                <Phone size={14} /> Contacto
              </h3>
              <div>
                <label className={labelClass}>Teléfono Principal</label>
                <input
                  type="text"
                  value={center?.phone || ''}
                  onChange={(e) => setCenter({ ...center, phone: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Correo Electrónico</label>
                <input
                  type="email"
                  value={center?.email || ''}
                  onChange={(e) => setCenter({ ...center, email: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500 mb-4 flex items-center gap-2">
                <MapPin size={14} /> Ubicación
              </h3>
              <div>
                <label className={labelClass}>Dirección Completa</label>
                <input
                  type="text"
                  value={center?.address || ''}
                  onChange={(e) => setCenter({ ...center, address: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Distrito</label>
                  <input
                    type="text"
                    value={center?.district || ''}
                    onChange={(e) => setCenter({ ...center, district: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Regional</label>
                  <input
                    type="text"
                    value={center?.regional || ''}
                    onChange={(e) => setCenter({ ...center, regional: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Sección de Autoridades y Firmantes Oficiales */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500 flex items-center gap-2">
                <Users size={14} /> Autoridades y Firmantes Oficiales (Actas y Certificaciones)
              </h3>
              <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full uppercase print:hidden">
                Adaptable por Sexo y Distrito
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Director(a) del Centro */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                    {center?.director_sex === 'M' ? 'Director del Centro' : 'Directora del Centro'}
                  </span>
                  <select
                    value={center?.director_sex || 'F'}
                    onChange={(e) => setCenter({ ...center, director_sex: e.target.value })}
                    className="text-[10px] font-black uppercase bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600 outline-none"
                  >
                    <option value="F">Mujer (Directora)</option>
                    <option value="M">Hombre (Director)</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Nombre completo"
                  value={center?.director_name || ''}
                  onChange={(e) => setCenter({ ...center, director_name: e.target.value })}
                  className={`${inputClass} py-2 text-xs font-bold text-slate-800`}
                />
              </div>

              {/* Secretario(a) Docente */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                    {center?.secretary_sex === 'M' ? 'Secretario Docente' : 'Secretaria Docente'}
                  </span>
                  <select
                    value={center?.secretary_sex || 'F'}
                    onChange={(e) => setCenter({ ...center, secretary_sex: e.target.value })}
                    className="text-[10px] font-black uppercase bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600 outline-none"
                  >
                    <option value="F">Mujer (Secretaria)</option>
                    <option value="M">Hombre (Secretario)</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Nombre completo"
                  value={center?.secretary_name || ''}
                  onChange={(e) => setCenter({ ...center, secretary_name: e.target.value })}
                  className={`${inputClass} py-2 text-xs font-bold text-slate-800`}
                />
              </div>

              {/* Director(a) Distrital */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                    {center?.district_director_sex === 'M'
                      ? 'Director del Distrito'
                      : 'Directora del Distrito'}
                  </span>
                  <select
                    value={center?.district_director_sex || 'F'}
                    onChange={(e) =>
                      setCenter({ ...center, district_director_sex: e.target.value })
                    }
                    className="text-[10px] font-black uppercase bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600 outline-none"
                  >
                    <option value="F">Mujer (Directora)</option>
                    <option value="M">Hombre (Director)</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Nombre completo"
                  value={center?.district_director_name || ''}
                  onChange={(e) => setCenter({ ...center, district_director_name: e.target.value })}
                  className={`${inputClass} py-2 text-xs font-bold text-slate-800`}
                />
              </div>

              {/* Encargado(a) de Certificación */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                    {center?.certification_officer_sex === 'M'
                      ? 'Encargado de Certificación'
                      : 'Encargada de Certificación'}
                  </span>
                  <select
                    value={center?.certification_officer_sex || 'F'}
                    onChange={(e) =>
                      setCenter({ ...center, certification_officer_sex: e.target.value })
                    }
                    className="text-[10px] font-black uppercase bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600 outline-none"
                  >
                    <option value="F">Mujer (Encargada)</option>
                    <option value="M">Hombre (Encargado)</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Nombre completo"
                  value={center?.certification_officer_name || ''}
                  onChange={(e) =>
                    setCenter({ ...center, certification_officer_name: e.target.value })
                  }
                  className={`${inputClass} py-2 text-xs font-bold text-slate-800`}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={saving || uploading}
            className={`flex items-center gap-3 px-12 py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all ${saving ? 'bg-slate-300' : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105 active:scale-95'}`}
          >
            <Save size={20} />
            {saving ? 'Guardando...' : 'Guardar Cambios Oficiales'}
          </button>
        </div>
      </form>
    </div>
  );
};
