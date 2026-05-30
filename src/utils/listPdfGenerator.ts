import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  doc.text(`AÑO ESCOLAR: ${schoolYear} | NIVEL: ${courseInfo?.level || ''}`, pageWidth / 2, 20, {
    align: 'center'
  });
  doc.setFont('helvetica', 'bold');
  doc.text(
    `${courseInfo?.grade || ''} - SECCIÓN: ${courseInfo?.section || ''}`,
    pageWidth / 2,
    24,
    { align: 'center' }
  );

  // TABLA ULTRA COMPACTA
  const tableData = students
    .sort((a, b) => (a.orderNumber || 99) - (b.orderNumber || 99))
    .map((s, index) => [
      s.orderNumber || index + 1,
      `${s.first_surname || ''} ${s.second_surname || ''}, ${s.names || ''}`.toUpperCase(),
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

  doc.save(`Listado_${courseInfo?.grade || 'Oficial'}.pdf`);
};
