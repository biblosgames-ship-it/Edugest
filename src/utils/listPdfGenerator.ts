import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const generateListPDF = (
  students: any[],
  centerData: any,
  courseInfo: any,
  schoolYear: string
) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.width;
  const margin = 12;

  // ENCABEZADO MINIMALISTA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(centerData?.name || 'CENTRO EDUCATIVO', pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`AÑO ESCOLAR: ${schoolYear} | NIVEL: ${courseInfo?.level || ''} | TANDA: ${(courseInfo?.tanda || 'Matutina').toUpperCase()}`, pageWidth / 2, 20, {
    align: 'center'
  });
  doc.setFont('helvetica', 'bold');
  doc.text(
    `${courseInfo?.grade || ''} - SECCIÓN: ${courseInfo?.section || ''} (${courseInfo?.tanda || 'Matutina'})`,
    pageWidth / 2,
    24,
    { align: 'center' }
  );

  // TABLA ULTRA COMPACTA
  const tableData = students
    .sort((a, b) => (a.orderNumber || a.order_number || 99) - (b.orderNumber || b.order_number || 99))
    .map((s, index) => [
      s.orderNumber || s.order_number || index + 1,
      `${s.first_surname || s.lastName || ''} ${s.second_surname || ''}, ${s.names || s.firstName || ''}`.toUpperCase(),
      s.sex || '',
      '' // ESPACIO LIMPIO PARA OBSERVACIONES
    ]);

  autoTable(doc, {
    startY: 30,
    head: [['#', 'APELLIDOS Y NOMBRES', 'SEXO', 'OBSERVACIONES']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 7.5, // Letra más pequeña para que quepa todo
      cellPadding: 0.8, // Espacio mínimo entre líneas
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
      textColor: [0, 0, 0]
    },
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      2: { halign: 'center', cellWidth: 12 },
      3: { cellWidth: 30 }
    },
    margin: { left: margin, right: margin }
  });

  doc.save(`Listado_${courseInfo?.grade || 'Oficial'}_${courseInfo?.section || ''}_${courseInfo?.tanda || 'Matutina'}.pdf`);
};

const calculateAge = (birthDateStr?: string): string => {
  if (!birthDateStr) return '';
  const today = new Date();
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return '';
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age.toString() : '';
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('T')[0].split('-');
    if (year && month && day) return `${day}/${month}/${year}`;
    return dateStr;
  } catch {
    return dateStr || '';
  }
};

/**
 * Exporta el listado de estudiantes a un archivo Excel (.xlsx) con formato y columnas auto-ajustadas.
 */
export const exportStudentsToExcel = ({
  students,
  courseInfo,
  centerName = 'Centro Educativo',
  schoolYear = '2026-2027',
  fileName
}: {
  students: any[];
  courseInfo?: { level?: string; grade?: string; section?: string; tanda?: string } | null;
  centerName?: string;
  schoolYear?: string;
  fileName?: string;
}) => {
  const isSingleCourse = !!courseInfo;
  const courseTitle = isSingleCourse
    ? `${courseInfo?.level || ''} ${courseInfo?.grade || ''} "${courseInfo?.section || ''}" - ${courseInfo?.tanda || 'Matutina'}`.trim()
    : 'Todos los Cursos';

  const rows: any[] = [];

  // Título e información institucional
  rows.push([centerName.toUpperCase()]);
  rows.push([`LISTADO OFICIAL DE ESTUDIANTES - AÑO ESCOLAR: ${schoolYear}`]);
  rows.push([`CURSO / GRADO: ${courseTitle.toUpperCase()}`]);
  rows.push([`FECHA DE EXPORTACIÓN: ${new Date().toLocaleDateString('es-DO')}   |   TOTAL ALUMNOS: ${students.length}`]);
  rows.push([]); // Espacio en blanco

  // Cabeceras de tabla
  const headers = [
    'Nº',
    ...(isSingleCourse ? [] : ['NIVEL', 'GRADO', 'SECCIÓN', 'TANDA']),
    'APELLIDOS',
    'NOMBRES',
    'SEXO',
    'FECHA NACIMIENTO',
    'EDAD',
    'CÉDULA / RNC / ID',
    'TELÉFONO ALUMNO',
    'DIRECCIÓN'
  ];
  rows.push(headers);

  // Filas de datos
  const sortedStudents = [...students].sort((a, b) => {
    const ordA = a.order_number || a.orderNumber;
    const ordB = b.order_number || b.orderNumber;
    if (ordA && ordB) return Number(ordA) - Number(ordB);
    const surA = `${a.first_surname || a.lastName || ''} ${a.second_surname || ''}`.trim().toLowerCase();
    const surB = `${b.first_surname || b.lastName || ''} ${b.second_surname || ''}`.trim().toLowerCase();
    return surA.localeCompare(surB);
  });

  sortedStudents.forEach((s: any, idx) => {
    const surnames = `${s.first_surname || s.lastName || ''} ${s.second_surname || ''}`.trim().toUpperCase();
    const names = (s.names || s.firstName || '').trim().toUpperCase();
    const bDate = s.birth_date || s.birthDate || '';
    const address = [s.address_street, s.address_number, s.address_sector].filter(Boolean).join(', ').toUpperCase();

    const row = [
      s.order_number || s.orderNumber || idx + 1,
      ...(isSingleCourse ? [] : [s.level || '', s.grade || '', s.section || '', s.tanda || 'Matutina']),
      surnames || '---',
      names || '---',
      s.sex || '-',
      formatDate(bDate),
      calculateAge(bDate),
      s.id_card || s.idCard || s.birth_certificate_number || '---',
      s.phone || '---',
      address || '---'
    ];
    rows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Calcular anchos de columna automáticos
  const colWidths = headers.map((header, colIdx) => {
    let maxLen = header.length;
    for (let r = 5; r < rows.length; r++) {
      const cellVal = rows[r]?.[colIdx];
      if (cellVal !== undefined && cellVal !== null) {
        const len = String(cellVal).length;
        if (len > maxLen) maxLen = len;
      }
    }
    return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  const sheetName = isSingleCourse
    ? `${courseInfo?.grade}_${courseInfo?.section}_${courseInfo?.tanda || ''}`.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 25)
    : 'Estudiantes';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const defaultFileName = isSingleCourse
    ? `Listado_Estudiantes_${courseInfo?.grade || ''}_${courseInfo?.section || ''}_${courseInfo?.tanda || 'Matutina'}_${schoolYear}.xlsx`
    : `Listado_General_Estudiantes_${schoolYear}.xlsx`;

  XLSX.writeFile(wb, (fileName || defaultFileName).replace(/\s+/g, '_'));
};

/**
 * Exporta el listado de personal / colaboradores a Excel
 */
export const exportStaffToExcel = ({
  staff,
  centerName = 'Centro Educativo',
  schoolYear = '2026-2027',
  filterRole
}: {
  staff: any[];
  centerName?: string;
  schoolYear?: string;
  filterRole?: string;
}) => {
  const rows: any[] = [];
  rows.push([centerName.toUpperCase()]);
  rows.push([`LISTADO DE PERSONAL Y COLABORADORES - AÑO ESCOLAR: ${schoolYear}`]);
  rows.push([`CATEGORÍA: ${filterRole ? filterRole.toUpperCase() : 'TODOS'}   |   TOTAL: ${staff.length} MIEMBROS`]);
  rows.push([]);

  const headers = ['Nº', 'NOMBRE COMPLETO', 'ROL / CARGO', 'SEXO', 'TELÉFONO', 'CORREO ELECTRÓNICO', 'DIGITADO NOTAS'];
  rows.push(headers);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'management_teacher': return 'Docente y Gestión';
      case 'teacher': return 'Docente';
      case 'management': return 'Gestión / Directivo';
      case 'administrative': return 'Administrativo';
      case 'cashier': return 'Caja / Finanzas';
      case 'support': return 'Apoyo / Conserjería';
      default: return role || 'Docente';
    }
  };

  staff.forEach((p: any, idx) => {
    rows.push([
      idx + 1,
      (p.full_name || p.name || '').toUpperCase(),
      getRoleLabel(p.role || p.team),
      p.sex || 'M',
      p.phone || '---',
      p.email || '---',
      p.grades_editable === false ? 'Bloqueado' : 'Habilitado'
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 8 },
    { wch: 35 },
    { wch: 25 },
    { wch: 10 },
    { wch: 18 },
    { wch: 30 },
    { wch: 18 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Personal');
  XLSX.writeFile(wb, `Listado_Personal_${schoolYear}.xlsx`);
};

/**
 * Exporta el Directorio Maestro (Estudiantes + Tutores) a Excel
 */
export const exportMasterDirectoryToExcel = ({
  directoryData,
  centerName = 'Centro Educativo',
  schoolYear = '2026-2027'
}: {
  directoryData: any[];
  centerName?: string;
  schoolYear?: string;
}) => {
  const rows: any[] = [];
  rows.push([centerName.toUpperCase()]);
  rows.push([`DIRECTORIO MAESTRO DE ESTUDIANTES Y TUTORES - ${schoolYear}`]);
  rows.push([`TOTAL REGISTROS: ${directoryData.length}`]);
  rows.push([]);

  const headers = ['Nº', 'ESTUDIANTE', 'CURSO / GRADO', 'TUTOR / ENCARGADO', 'PARENTESCO', 'TELÉFONO TUTOR', 'TELÉFONO SECUNDARIO', 'DIRECCIÓN'];
  rows.push(headers);

  directoryData.forEach((item: any, idx) => {
    rows.push([
      idx + 1,
      (item.name || '').toUpperCase(),
      (item.courseName || '').toUpperCase(),
      (item.tutorName || '').toUpperCase(),
      (item.tutorRelation || '').toUpperCase(),
      item.tutorPhone || '---',
      item.tutorSecondaryPhone || '---',
      (item.address || '').toUpperCase()
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 35 },
    { wch: 25 },
    { wch: 30 },
    { wch: 15 },
    { wch: 18 },
    { wch: 18 },
    { wch: 40 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Directorio');
  XLSX.writeFile(wb, `Directorio_Maestro_${schoolYear}.xlsx`);
};

/**
 * Exportador genérico de tablas a Excel
 */
export const exportGenericTableToExcel = ({
  title,
  subtitle,
  headers,
  data,
  sheetName = 'Datos',
  fileName = 'Exportacion.xlsx',
  centerName = 'Centro Educativo'
}: {
  title: string;
  subtitle?: string;
  headers: string[];
  data: (string | number | boolean | null | undefined)[][];
  sheetName?: string;
  fileName?: string;
  centerName?: string;
}) => {
  const rows: any[] = [];
  rows.push([centerName.toUpperCase()]);
  rows.push([title.toUpperCase()]);
  if (subtitle) rows.push([subtitle]);
  rows.push([`FECHA: ${new Date().toLocaleDateString('es-DO')}   |   TOTAL: ${data.length} REGISTROS`]);
  rows.push([]);

  rows.push(headers);
  data.forEach((row) => rows.push(row));

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Auto column widths
  const colWidths = headers.map((header, colIdx) => {
    let maxLen = header.length;
    data.forEach((r) => {
      const cellVal = r[colIdx];
      if (cellVal !== undefined && cellVal !== null) {
        const len = String(cellVal).length;
        if (len > maxLen) maxLen = len;
      }
    });
    return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 25));
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
};

