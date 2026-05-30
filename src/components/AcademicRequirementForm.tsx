import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Cycle, Modality, Output } from '../types';

export const AcademicRequirementForm = () => {
  const { addAcademicRequirement } = useApp();
  const [formData, setFormData] = useState({
    cycle: 'Primer Ciclo' as Cycle,
    modality: 'Académica' as Modality,
    output: 'N/A' as Output,
    weeklyHours: 0,
    classDurationMinutes: 45
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addAcademicRequirement({ id: Date.now().toString(), ...formData });
    setFormData({
      cycle: 'Primer Ciclo',
      modality: 'Académica',
      output: 'N/A',
      weeklyHours: 0,
      classDurationMinutes: 45
    });
  };

  const inputClass =
    'w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div>
        <label className={labelClass}>Ciclo</label>
        <select
          value={formData.cycle}
          onChange={(e) => setFormData({ ...formData, cycle: e.target.value as Cycle })}
          className={inputClass}
        >
          <option value="Primer Ciclo">Primer Ciclo</option>
          <option value="Segundo Ciclo">Segundo Ciclo</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Modalidad</label>
        <select
          value={formData.modality}
          onChange={(e) => setFormData({ ...formData, modality: e.target.value as Modality })}
          className={inputClass}
        >
          <option value="Académica">Académica</option>
          <option value="Técnico-Profesional">Técnico-Profesional</option>
          <option value="Artes">Artes</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Salida</label>
        <select
          value={formData.output}
          onChange={(e) => setFormData({ ...formData, output: e.target.value as Output })}
          className={inputClass}
        >
          <option value="N/A">N/A (Inicial/Primario)</option>
          <option value="General">General (1ro-3ro Sec)</option>
          <option value="Ciencias y Tecnología">Ciencias y Tecnología</option>
          <option value="Humanidades y Lenguas Modernas">Humanidades y Lenguas Modernas</option>
          <option value="Ciencias Sociales y Humanidades">Ciencias Sociales y Humanidades</option>
          <option value="Ciencias Económicas y Financieras">
            Ciencias Económicas y Financieras
          </option>
          <option value="Artes">Artes</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Horas Semanales</label>
        <input
          type="number"
          value={formData.weeklyHours}
          onChange={(e) => setFormData({ ...formData, weeklyHours: parseInt(e.target.value) })}
          className={inputClass}
          required
        />
      </div>
      <div>
        <label className={labelClass}>Duración Clase (minutos)</label>
        <input
          type="number"
          value={formData.classDurationMinutes}
          onChange={(e) =>
            setFormData({ ...formData, classDurationMinutes: parseInt(e.target.value) })
          }
          className={inputClass}
          required
        />
      </div>
      <button
        type="submit"
        className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
      >
        Guardar Requisito
      </button>
    </form>
  );
};
