/**
 * Retorna la fecha local en formato YYYY-MM-DD sin desfase horario de medianoche (UTC).
 * Esto evita que después de las 8:00 PM (hora dominicana) las transacciones o facturas
 * se guarden con la fecha del día siguiente.
 */
export const getLocalDateString = (input?: Date | string | number | null): string => {
  const d = input ? new Date(input) : new Date();
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
