import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSupabase } from '../context/AppContext';

export const CourseCodeEntry = ({ onCodeEntered }: { onCodeEntered: () => void }) => {
  const [code, setCode] = useState('');
  const [role, setRole] = useState<'student' | 'parent'>('student');
  const [studentName, setStudentName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useSupabase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const sanitizedCode = code.trim().toUpperCase().replace(/\s+/g, '');
      // 1. Verificar si el curso existe por su código amigable
      const { data: course } = await supabase
        .from('courses')
        .select('id, code, center_id')
        .ilike('code', sanitizedCode)
        .maybeSingle();

      let targetCourseId = course?.id;
      let targetCenterId = course?.center_id;

      if (!targetCourseId) {
        const { data: invMatch } = await supabase
          .from('invitation_codes')
          .select('course_id, center_id')
          .ilike('code', sanitizedCode)
          .maybeSingle();
        if (invMatch) {
          targetCourseId = invMatch.course_id;
          targetCenterId = invMatch.center_id;
        }
      }

      if (!targetCourseId) {
        setError('Código de curso inválido o no encontrado.');
        setIsLoading(false);
        return;
      }

      // 2. Actualizar el perfil del usuario con el curso y el rol
      if (user) {
        const updates: any = {
          course_code: sanitizedCode,
          course_id: targetCourseId,
          role: role,
          full_name: role === 'parent' ? `${studentName} (Padre/Madre)` : undefined,
          is_active: true
        };

        if (targetCenterId) updates.center_id = targetCenterId;
        if (role === 'parent') {
          updates.parent_course_ids = [targetCourseId];
          localStorage.setItem('parent_course_ids', JSON.stringify([targetCourseId]));
        }
        localStorage.setItem('selected_course_id', targetCourseId);
        localStorage.setItem('course_code', sanitizedCode);

        const { error: updateError } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id);

        if (updateError) throw updateError;
        onCodeEntered();
      }
    } catch (err: any) {
      console.error('Error validating course code:', err);
      setError('Error al validar el código.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-md mx-auto bg-white rounded-2xl border border-slate-100 shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-slate-800">Acceso al Curso</h2>
      <p className="text-slate-600 mb-6 text-sm">
        Introduce el código proporcionado por tu centro educativo para acceder al horario y tareas.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
            Código del Curso
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ej: GEN-5A"
            className="w-full p-3 border rounded-xl bg-slate-50 focus:ring-2 focus:ring-brand-blue outline-none transition-all uppercase"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
            Tipo de Usuario
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            className="w-full p-3 border rounded-xl bg-slate-50"
          >
            <option value="student">Soy Alumno</option>
            <option value="parent">Soy Padre/Madre</option>
          </select>
        </div>

        {role === 'parent' && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
              Nombre del Estudiante
            </label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Nombre completo"
              className="w-full p-3 border rounded-xl bg-slate-50 focus:ring-2 focus:ring-brand-blue outline-none"
              required
            />
          </div>
        )}

        {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded-lg">{error}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-brand-blue text-white py-3 rounded-xl font-bold hover:bg-brand-blue/90 transition-all shadow-md shadow-brand-blue/20 disabled:opacity-50"
        >
          {isLoading ? 'Verificando...' : 'Acceder al curso'}
        </button>
      </form>
    </div>
  );
};
