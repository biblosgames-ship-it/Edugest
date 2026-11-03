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

/**
 * Retorna el período académico oficial según el mes del calendario escolar dominicano:
 * - P1: Agosto a Octubre
 * - P2: Noviembre a Enero (cambia automáticamente en Noviembre)
 * - P3: Febrero a Abril (cambia automáticamente en Febrero)
 * - P4: Mayo a Julio (cambia automáticamente en Mayo)
 *
 * @param format 'uppercase' ('P1') o 'lowercase' ('p1')
 * @param inputDate Fecha opcional a evaluar (por defecto: fecha actual)
 */
export const getCurrentPeriod = (
  format: 'uppercase' | 'lowercase' = 'uppercase',
  inputDate?: Date | string | number | null
): string => {
  const d = inputDate ? new Date(inputDate) : new Date();
  const m = isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth();

  let period = 'P1';
  if (m >= 10 || m === 0) {
    // Noviembre (10), Diciembre (11), Enero (0)
    period = 'P2';
  } else if (m >= 1 && m <= 3) {
    // Febrero (1), Marzo (2), Abril (3)
    period = 'P3';
  } else if (m >= 4 && m <= 6) {
    // Mayo (4), Junio (5), Julio (6)
    period = 'P4';
  } else {
    // Agosto (7), Septiembre (8), Octubre (9)
    period = 'P1';
  }

  return format === 'lowercase' ? period.toLowerCase() : period;
};
