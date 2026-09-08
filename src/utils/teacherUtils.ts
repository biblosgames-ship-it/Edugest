import { useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';

export const normalizeTeacherName = (name: string | null | undefined): string => {
  return (name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
};

export const areTeacherNamesMatching = (name1?: string | null, name2?: string | null): boolean => {
  if (!name1 || !name2) return false;
  const n1 = normalizeTeacherName(name1);
  const n2 = normalizeTeacherName(name2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;

  const t1 = n1.split(' ').filter(Boolean);
  const t2 = n2.split(' ').filter(Boolean);

  if (t1.length === 0 || t2.length === 0) return false;

  // Comparación sin espacios
  if (n1.replace(/\s+/g, '') === n2.replace(/\s+/g, '')) return true;

  // Si el primer nombre coincide
  if (t1[0] === t2[0]) {
    if (t1.length === 1 && t2.length === 1) return true;

    const sur1 = t1.slice(1);
    const sur2 = t2.slice(1);

    // Comparten al menos un apellido
    if (sur1.length > 0 && sur2.length > 0) {
      const hasCommonSurname = sur1.some((s) => sur2.includes(s));
      if (hasCommonSurname) return true;
    }

    // Todas las palabras del nombre más corto están en el más largo
    const shorter = t1.length <= t2.length ? t1 : t2;
    const longer = t1.length <= t2.length ? t2 : t1;
    if (shorter.length >= 2 && shorter.every((tok) => longer.includes(tok))) {
      return true;
    }
  }

  return false;
};

export const createTeacherKeyMap = (
  teachers: any[] = [],
  staff: any[] = [],
  profiles: any[] = []
): Map<string, string> => {
  const map = new Map<string, string>();

  // Agrupación de identidades de docentes/personal por similitud y enlaces
  const clusters: Array<{
    ids: Set<string>;
    names: string[];
    canonicalId: string;
  }> = [];

  const addRecord = (item: any) => {
    if (!item) return;
    const candidateIds = [item.id, item.teacher_id, item.user_id]
      .filter(Boolean)
      .map((id) => String(id).trim());
    const name = item.name || item.full_name || '';
    if (candidateIds.length === 0 && !name) return;

    // Buscar si pertenece a un cluster existente
    let match = clusters.find((c) => {
      // Coincidencia de algún ID
      const hasSharedId = candidateIds.some((id) => c.ids.has(id));
      if (hasSharedId) return true;

      // Coincidencia inteligente por nombre
      if (name) {
        return c.names.some((clusterName) => areTeacherNamesMatching(clusterName, name));
      }
      return false;
    });

    const preferredId = String(item.teacher_id || item.id || candidateIds[0] || '').trim();

    if (match) {
      candidateIds.forEach((id) => match!.ids.add(id));
      if (name && !match.names.includes(name)) match.names.push(name);
      // Priorizar teacher_id real sobre user_id de auth
      if (item.teacher_id && !match.canonicalId) {
        match.canonicalId = String(item.teacher_id).trim();
      }
    } else {
      clusters.push({
        ids: new Set(candidateIds),
        names: name ? [name] : [],
        canonicalId: preferredId
      });
    }
  };

  (teachers || []).forEach(addRecord);
  (staff || []).forEach(addRecord);
  (profiles || []).forEach(addRecord);

  // Mapear cada ID conocido al ID canónico de su grupo
  clusters.forEach((c) => {
    const canonical = c.canonicalId || Array.from(c.ids)[0];
    c.ids.forEach((id) => {
      map.set(id, canonical);
    });
  });

  return map;
};

export const checkIsSameTeacher = (
  t1: string | null | undefined,
  t2: string | null | undefined,
  teacherKeyMap?: Map<string, string>
): boolean => {
  if (!t1 || !t2) return false;
  const s1 = String(t1).trim();
  const s2 = String(t2).trim();
  if (s1 === s2) return true;

  if (teacherKeyMap) {
    const k1 = teacherKeyMap.get(s1) || s1;
    const k2 = teacherKeyMap.get(s2) || s2;
    if (k1 && k2 && k1 === k2) return true;
    if (k1 === s2 || k2 === s1) return true;
  }

  const n1 = normalizeTeacherName(s1);
  const n2 = normalizeTeacherName(s2);
  if (n1 && n2 && areTeacherNamesMatching(n1, n2)) return true;

  return false;
};

export const useTeacherIdentity = () => {
  const { state, profile } = useApp();

  const teacherKeyMap = useMemo(() => {
    return createTeacherKeyMap(
      state.teachers,
      state.staff,
      profile ? [profile] : []
    );
  }, [state.teachers, state.staff, profile]);

  const isSameTeacher = useCallback(
    (t1: string | null | undefined, t2: string | null | undefined) => {
      return checkIsSameTeacher(t1, t2, teacherKeyMap);
    },
    [teacherKeyMap]
  );

  return { isSameTeacher, teacherKeyMap };
};
