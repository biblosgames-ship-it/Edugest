/**
 * Utilidad unificada para ordenamiento y número de orden de estudiantes
 * Garantiza coincidencia 100% entre Gestión de Alumnos, Mi Aula, Calificaciones y Reportes
 */

export const getStudentSortKey = (s: any): string => {
  if (!s) return 'zzz';
  const surname = (s.first_surname || s.lastName || s.last_name || s.apellidos || '').trim();
  const secondSurname = (s.second_surname || '').trim();
  const names = (s.names || s.firstName || s.first_name || s.name || '').trim();
  const fullSurname = `${surname} ${secondSurname}`.trim();
  return `${fullSurname} ${names}`.trim().toLowerCase();
};

export const getStudentOrderNumber = (s: any): number | null => {
  if (!s) return null;
  const raw = s.order_number != null && s.order_number !== '' ? s.order_number : s.orderNumber;
  if (raw != null && raw !== '' && !isNaN(Number(raw))) {
    return Number(raw);
  }
  return null;
};

export const sortStudents = <T extends any>(students: T[]): T[] => {
  if (!students || !Array.isArray(students)) return [];
  return [...students].sort((a: any, b: any) => {
    const numA = getStudentOrderNumber(a);
    const numB = getStudentOrderNumber(b);

    if (numA !== null && numB !== null) {
      return numA - numB;
    }
    if (numA !== null) return -1;
    if (numB !== null) return 1;

    return getStudentSortKey(a).localeCompare(getStudentSortKey(b));
  });
};
