import React, { useState } from 'react';
import { useSupabase } from '../context/AppContext';
import {
  validateInvitationCode,
  registerMemberWithCode,
  getStaffForInvitation,
  createUserProfile
} from '../services/userService';
import { supabase } from '../lib/supabase';

export const InvitationForm = () => {
  const { user } = useSupabase();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // States for detected course code flow (Students/Parents)
  const [isCourseCode, setIsCourseCode] = useState(false);
  const [detectedCourse, setDetectedCourse] = useState<any>(null);
  const [role, setRole] = useState<'student' | 'parent'>('student');
  const [studentName, setStudentName] = useState('');

  // States for administrative staff/conserje verification flow
  const [isStaffCode, setIsStaffCode] = useState(false);
  const [detectedStaffRole, setDetectedStaffRole] = useState('');
  const [detectedCenterId, setDetectedCenterId] = useState('');
  const [detectedAllowedPanels, setDetectedAllowedPanels] = useState<string[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [manualStaffName, setManualStaffName] = useState('');

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;

    setIsLoading(true);
    setError('');

    const sanitizedCode = code.trim().toUpperCase().replace(/\s+/g, '');

    if (!sanitizedCode) {
      setError('Por favor ingresa un código.');
      setIsLoading(false);
      return;
    }

    try {
      // 1. Validar el código de forma segura mediante el RPC de validación
      const codeData = await validateInvitationCode(sanitizedCode);

      if (codeData.type === 'invitation') {
        // Fetch existing staff for this center using the secure RPC (which bypasses RLS safely)
        const fetchedStaff = await getStaffForInvitation(sanitizedCode);

        // Try to auto-match by email (case-insensitive)
        const autoMatched = fetchedStaff.find(
          (s: any) => s.email && s.email.trim().toLowerCase() === user.email?.trim().toLowerCase()
        );

        if (autoMatched) {
          // Direct login / match! Complete profile immediately using the secure RPC
          await registerMemberWithCode(
            sanitizedCode,
            autoMatched.name,
            undefined,
            undefined,
            autoMatched.id
          );

          window.location.reload();
          return;
        }

        // No auto-match: Prepare the selector dropdown
        const normalizedRole = codeData.role.toLowerCase();
        let targetTeam = '';
        if (normalizedRole.includes('support') || normalizedRole.includes('conserje')) {
          targetTeam = 'support';
        } else if (normalizedRole.includes('teacher') || normalizedRole.includes('docente')) {
          targetTeam = 'teacher';
        } else if (
          normalizedRole.includes('coord') ||
          normalizedRole.includes('admin') ||
          normalizedRole.includes('finance')
        ) {
          targetTeam = 'management';
        }

        const filteredStaff = fetchedStaff.filter((s: any) => {
          // Exclude if already linked to another email
          if (s.email && s.email.trim().toLowerCase() !== user.email?.trim().toLowerCase()) {
            return false;
          }
          const t = (s.team || '').toLowerCase();
          if (targetTeam === 'support') {
            return t.includes('support') || t.includes('apoyo') || t.includes('cons');
          } else if (targetTeam === 'teacher') {
            return (
              t.includes('teacher') || t.includes('docente') || t.includes('management_teacher')
            );
          } else if (targetTeam === 'management') {
            return (
              t.includes('management') ||
              t.includes('gest') ||
              t.includes('admin') ||
              t.includes('secret') ||
              t.includes('coord') ||
              t.includes('management_teacher')
            );
          }
          return true;
        });

        setStaffList(filteredStaff);
        setDetectedStaffRole(codeData.role);
        setDetectedCenterId(codeData.center_id);
        setDetectedAllowedPanels(codeData.allowed_panels || []);
        setIsStaffCode(true);
      } else if (codeData.type === 'course') {
        // Si es un código de curso válido, mostramos las opciones para Alumno / Padre
        setIsCourseCode(true);
        setDetectedCourse(codeData);
      } else {
        throw new Error('Tipo de código no reconocido.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar el código');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email || !detectedCourse) return;

    setIsLoading(true);
    setError('');

    const sanitizedCode = code.trim().toUpperCase().replace(/\s+/g, '');

    try {
      // 1. Obtener la cantidad de alumnos registrados en el curso
      const { count: studentCount, error: countErr } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', detectedCourse.course_id);

      if (countErr) throw countErr;

      // 2. Obtener la cantidad de perfiles ya registrados para este curso (roles student y parent)
      const { count: profilesCount, error: profilesErr } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('course_code', detectedCourse.course_id)
        .in('role', ['student', 'parent'])
        .neq('id', user.id);

      if (profilesErr) throw profilesErr;

      // 3. Validar límite (3 usuarios por alumno registrado en el curso)
      const maxAllowed = (studentCount || 0) * 3;
      if ((profilesCount || 0) >= maxAllowed) {
        throw new Error(
          `Límite de registros alcanzado. El límite es de 3 cuentas (padres/alumnos) por cada alumno registrado en la lista oficial del curso. Actualmente hay ${studentCount || 0} alumnos registrados en la lista.`
        );
      }

      // 4. Validar límite general de usuarios según el plan SaaS
      const { data: license, error: licErr } = await supabase
        .from('saas_licenses')
        .select('*, plan:saas_plans(*)')
        .eq('used_by_center', detectedCourse.center_id)
        .maybeSingle();

      if (licErr) console.error('Error fetching license in handleActivateCourse:', licErr);

      if (license?.plan) {
        const maxUsers = license.plan.max_users;
        if (maxUsers !== undefined && maxUsers !== null) {
          const { count: centerUsersCount, error: usersErr } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('center_id', detectedCourse.center_id)
            .neq('id', user.id);

          if (usersErr) throw usersErr;

          if (centerUsersCount !== null && centerUsersCount >= maxUsers) {
            throw new Error(
              `Se ha alcanzado el límite de usuarios creados permitido por el plan SaaS de este centro (${centerUsersCount} de ${maxUsers} permitidos).`
            );
          }
        }
      }

      const finalFullName =
        role === 'parent' ? `${studentName.trim()} (Padre/Madre)` : studentName.trim();

      // Completar el registro de forma segura usando el RPC
      await registerMemberWithCode(sanitizedCode, finalFullName, undefined, role);

      // Si es un padre, actualizamos campos adicionales en su perfil (como parent_course_ids)
      if (role === 'parent') {
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({
            parent_course_ids: [detectedCourse.course_id]
          })
          .eq('id', user.id);

        if (updateErr) throw updateErr;
      }

      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Error al activar acceso al curso');
      setIsLoading(false);
    }
  };

  const handleActivateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;
    if (!selectedStaffId) {
      setError('Por favor selecciona tu nombre o elige la opción manual.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      let finalName = '';
      let matchedStaffObj = null;

      if (selectedStaffId === 'manual') {
        finalName = manualStaffName.trim();
        if (!finalName) throw new Error('Debes escribir un nombre válido.');
      } else {
        matchedStaffObj = staffList.find((s) => s.id === selectedStaffId);
        if (!matchedStaffObj) throw new Error('El empleado seleccionado no es válido.');
        finalName = matchedStaffObj.name;
      }

      // Validar límite general de usuarios según el plan SaaS
      if (detectedCenterId) {
        const { data: license, error: licErr } = await supabase
          .from('saas_licenses')
          .select('*, plan:saas_plans(*)')
          .eq('used_by_center', detectedCenterId)
          .maybeSingle();

        if (licErr) console.error('Error fetching license in handleActivateStaff:', licErr);

        if (license?.plan) {
          const maxUsers = license.plan.max_users;
          if (maxUsers !== undefined && maxUsers !== null) {
            const { count: centerUsersCount, error: usersErr } = await supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .eq('center_id', detectedCenterId)
              .neq('id', user.id);

            if (usersErr) throw usersErr;

            if (centerUsersCount !== null && centerUsersCount >= maxUsers) {
              throw new Error(
                `Se ha alcanzado el límite de usuarios creados permitido por el plan SaaS de este centro (${centerUsersCount} de ${maxUsers} permitidos).`
              );
            }
          }
        }
      }

      const sanitizedCode = code.trim().toUpperCase().replace(/\s+/g, '');

      // Completar el registro de forma segura usando el RPC (que vincula/crea el staff automáticamente)
      await registerMemberWithCode(
        sanitizedCode,
        finalName,
        undefined,
        undefined,
        matchedStaffObj ? matchedStaffObj.id : undefined
      );

      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Error al vincular el perfil');
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      {!isCourseCode && !isStaffCode ? (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">
              Ingresa el código
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ej: DOCENTE2026 o GEN-5A"
              className="w-full px-4 py-3.5 border-2 border-slate-100 rounded-2xl bg-slate-50 font-mono font-bold uppercase text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all text-center"
            />
          </div>
          {error && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-2xl animate-pulse">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-150 disabled:opacity-50"
          >
            {isLoading ? 'Verificando...' : 'Verificar Código'}
          </button>
        </form>
      ) : isStaffCode ? (
        <form onSubmit={handleActivateStaff} className="space-y-5 animate-in fade-in duration-300">
          <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-2xl">
            <span className="text-[8px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
              Invitación Confirmada
            </span>
            <h3 className="text-base font-black text-indigo-950 uppercase mt-2">
              Rol:{' '}
              {detectedStaffRole === 'support' || detectedStaffRole === 'conserje'
                ? 'Personal de Apoyo (Conserje)'
                : detectedStaffRole === 'teacher'
                  ? 'Docente'
                  : detectedStaffRole}
            </h3>
            <p className="text-[10px] text-indigo-700 font-bold uppercase mt-1">
              Vincular perfil de usuario
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
              Selecciona tu Nombre Registrado
            </label>
            <select
              required
              className="w-full px-4 py-3.5 border-2 border-slate-100 rounded-xl bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all"
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
            >
              <option value="">-- Selecciona tu nombre --</option>
              {staffList.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.position || s.team})
                </option>
              ))}
              <option value="manual">Mi nombre no está en la lista (Escribir manualmente)</option>
            </select>
          </div>

          {selectedStaffId === 'manual' && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                Escribe tu Nombre Completo
              </label>
              <input
                type="text"
                value={manualStaffName}
                onChange={(e) => setManualStaffName(e.target.value)}
                placeholder="Nombre completo"
                className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                required
              />
            </div>
          )}

          {error && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-2xl">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIsStaffCode(false);
                setStaffList([]);
                setSelectedStaffId('');
                setManualStaffName('');
                setError('');
              }}
              className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-4 rounded-[2rem] font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Atrás
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-100 disabled:opacity-50"
            >
              {isLoading ? 'Vinculando...' : 'Confirmar y Entrar'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleActivateCourse} className="space-y-5 animate-in fade-in duration-300">
          <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-2xl">
            <span className="text-[8px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
              Curso Encontrado
            </span>
            <h3 className="text-base font-black text-indigo-950 uppercase mt-2">
              {detectedCourse.grade} "{detectedCourse.section}"
            </h3>
            <p className="text-[10px] text-indigo-700 font-bold uppercase mt-1">
              Nivel: {detectedCourse.level}
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
              ¿Quién se registra?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${
                  role === 'student'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                    : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                }`}
              >
                Soy Alumno
              </button>
              <button
                type="button"
                onClick={() => setRole('parent')}
                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${
                  role === 'parent'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                    : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                }`}
              >
                Soy Padre/Madre
              </button>
            </div>
          </div>

          {role === 'parent' && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                Nombre de tu Hijo(a)
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Nombre completo del estudiante"
                className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                required
              />
            </div>
          )}

          {error && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-2xl">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIsCourseCode(false);
                setDetectedCourse(null);
                setError('');
              }}
              className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-4 rounded-[2rem] font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Atrás
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-100 disabled:opacity-50"
            >
              {isLoading ? 'Activando...' : 'Confirmar y Entrar'}
            </button>
          </div>
        </form>
      )}

      {/* Cerrar sesión */}
      <div className="border-t border-slate-100 pt-4">
        <button
          onClick={() => supabase.auth.signOut()}
          className="w-full text-slate-400 hover:text-slate-600 font-bold uppercase text-[9px] tracking-wider py-2 text-center"
        >
          Cerrar sesión y volver
        </button>
      </div>
    </div>
  );
};
