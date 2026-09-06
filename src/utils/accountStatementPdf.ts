import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface GenerateAccountStatementParams {
  student: any;
  course: any;
  center: any;
  invoices: any[];
  transactions: any[];
  stats: { total: number; paid: number; balance: number };
}

export const generateAccountStatementPDF = ({
  student,
  course,
  center,
  invoices,
  transactions,
  stats
}: GenerateAccountStatementParams) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;

  const centerName = (center?.name || 'CENTRO EDUCATIVO').toUpperCase();
  const centerAddress = center?.address || 'República Dominicana';
  const centerPhone = center?.phone || '';

  // 1. ENCABEZADO INSTITUCIONAL
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(centerName, pageWidth / 2, 16, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const contactText = [centerAddress, centerPhone].filter(Boolean).join('  |  Tel: ');
  doc.text(contactText, pageWidth / 2, 21, { align: 'center' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, 25, pageWidth - margin, 25);

  // 2. TÍTULO DEL DOCUMENTO
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('ESTADO DE CUENTA ESTUDIANTIL', pageWidth / 2, 32, { align: 'center' });

  const printDateStr = format(new Date(), 'dd/MM/yyyy hh:mm a');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Fecha de Emisión: ${printDateStr}`, pageWidth - margin, 32, { align: 'right' });

  // 3. DATOS DEL ESTUDIANTE Y GRADO
  const studentFullName = `${student?.names || ''} ${student?.first_surname || ''} ${student?.second_surname || ''}`.trim().toUpperCase();
  const idNumber = student?.id_number || student?.student_code || 'S/N';
  const courseName = course ? `${course.level || ''} ${course.grade || ''} "${course.section || ''}"`.trim() : 'Grado no asignado';
  const studentType = (student?.student_type || 'antiguo').toLowerCase() === 'nuevo' ? 'Nuevo Ingreso' : 'Antiguo / Reinscripción';
  const schoolYear = student?.school_year || course?.school_year || 'Ciclo Activo';

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, 36, pageWidth - margin * 2, 22, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, 36, pageWidth - margin * 2, 22, 2, 2, 'S');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Estudiante:', margin + 4, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(studentFullName, margin + 22, 42);

  doc.setFont('helvetica', 'bold');
  doc.text('Matrícula / ID:', margin + 115, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(idNumber, margin + 137, 42);

  doc.setFont('helvetica', 'bold');
  doc.text('Grado / Curso:', margin + 4, 49);
  doc.setFont('helvetica', 'normal');
  doc.text(courseName, margin + 24, 49);

  doc.setFont('helvetica', 'bold');
  doc.text('Condición:', margin + 115, 49);
  doc.setFont('helvetica', 'normal');
  doc.text(studentType, margin + 132, 49);

  doc.setFont('helvetica', 'bold');
  doc.text('Año Escolar:', margin + 4, 55);
  doc.setFont('helvetica', 'normal');
  doc.text(schoolYear, margin + 22, 55);

  // 4. RESUMEN DE BALANCES (TARJETAS)
  const cardWidth = (pageWidth - margin * 2 - 8) / 3;
  const cardY = 62;

  // Total Facturado
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, cardY, cardWidth, 14, 1.5, 1.5, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL FACTURADO', margin + 4, cardY + 5);
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`RD$ ${stats.total.toLocaleString()}`, margin + 4, cardY + 11);

  // Total Pagado
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(margin + cardWidth + 4, cardY, cardWidth, 14, 1.5, 1.5, 'F');
  doc.setFontSize(7);
  doc.setTextColor(5, 150, 105);
  doc.text('TOTAL PAGADO', margin + cardWidth + 8, cardY + 5);
  doc.setFontSize(10);
  doc.text(`RD$ ${stats.paid.toLocaleString()}`, margin + cardWidth + 8, cardY + 11);

  // Balance Pendiente
  const isPending = stats.balance > 0;
  if (isPending) {
    doc.setFillColor(254, 242, 242);
  } else {
    doc.setFillColor(240, 253, 244);
  }
  doc.roundedRect(margin + (cardWidth + 4) * 2, cardY, cardWidth, 14, 1.5, 1.5, 'F');
  if (isPending) {
    doc.setTextColor(225, 29, 72);
  } else {
    doc.setTextColor(22, 101, 52);
  }
  doc.text('BALANCE PENDIENTE', margin + (cardWidth + 4) * 2 + 4, cardY + 5);
  doc.setFontSize(10);
  doc.text(`RD$ ${stats.balance.toLocaleString()}`, margin + (cardWidth + 4) * 2 + 4, cardY + 11);

  // 5. TABLA DE FACTURAS Y CUOTAS
  const tableData = invoices.map((inv) => {
    const paidForInv = transactions
      .filter((t) => t.invoice_id === inv.id)
      .reduce((acc, t) => acc + Number(t.amount_paid), 0);
    const balance = Math.max(0, Number(inv.amount_final) - paidForInv);

    let statusText = 'Pendiente';
    if (inv.status === 'paid' || balance === 0) statusText = 'Pagado';
    else if (paidForInv > 0) statusText = 'Parcial';
    else if (new Date(inv.due_date) < new Date() && !String(inv.concept).toLowerCase().includes('inscrib')) {
      statusText = 'En Mora';
    }

    let formattedDueDate = inv.due_date;
    try {
      formattedDueDate = format(new Date(inv.due_date), 'dd/MM/yyyy');
    } catch (e) {}

    const conceptDesc = inv.description ? `${inv.concept} (${inv.description})` : inv.concept;

    return [
      conceptDesc,
      formattedDueDate,
      `RD$ ${Number(inv.amount_final).toLocaleString()}`,
      `RD$ ${paidForInv.toLocaleString()}`,
      `RD$ ${balance.toLocaleString()}`,
      statusText
    ];
  });

  autoTable(doc, {
    startY: 81,
    margin: { left: margin, right: margin },
    head: [['Concepto / Cuota', 'Vence', 'Facturado', 'Cobrado', 'Balance', 'Estado']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [51, 65, 85]
    },
    columnStyles: {
      0: { cellWidth: 'auto', fontStyle: 'bold' },
      1: { halign: 'center', cellWidth: 24 },
      2: { halign: 'right', cellWidth: 26 },
      3: { halign: 'right', cellWidth: 26 },
      4: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
      5: { halign: 'center', cellWidth: 22 }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const val = String(data.cell.raw);
        if (val === 'Pagado') data.cell.styles.textColor = [5, 150, 105];
        else if (val === 'En Mora') data.cell.styles.textColor = [225, 29, 72];
        else if (val === 'Parcial') data.cell.styles.textColor = [217, 119, 6];
        else data.cell.styles.textColor = [100, 116, 139];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  // 6. HISTORIAL DE RECIBOS DE PAGO
  let currentY = (doc as any).lastAutoTable?.finalY || 180;

  if (transactions.length > 0 && currentY < pageHeight - 50) {
    currentY += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('ÚLTIMOS RECIBOS DE PAGO REGISTRADOS', margin, currentY);

    const transRows = transactions.slice(0, 8).map((t) => {
      let tDate = t.created_at;
      try {
        tDate = format(new Date(t.created_at), 'dd/MM/yyyy');
      } catch (e) {}

      return [
        `Recibo #${t.receipt_number || 'S/N'}`,
        tDate,
        (t.payment_method || 'efectivo').toUpperCase(),
        `RD$ ${Number(t.amount_paid).toLocaleString()}`,
        t.notes || 'Pago de cuota'
      ];
    });

    autoTable(doc, {
      startY: currentY + 3,
      margin: { left: margin, right: margin },
      head: [['Recibo', 'Fecha', 'Método', 'Monto Pagado', 'Detalle']],
      body: transRows,
      theme: 'plain',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontSize: 7.5,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [71, 85, 105]
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 30 },
        1: { halign: 'center', cellWidth: 24 },
        2: { halign: 'center', cellWidth: 28 },
        3: { halign: 'right', cellWidth: 30, fontStyle: 'bold', textColor: [5, 150, 105] },
        4: { cellWidth: 'auto' }
      }
    });

    currentY = (doc as any).lastAutoTable?.finalY || currentY + 30;
  }

  // 7. FIRMA Y PIE DE PÁGINA
  const footerY = Math.max(currentY + 18, pageHeight - 25);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 40, footerY - 5, pageWidth / 2 + 40, footerY - 5);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('DEPTO. DE ADMINISTRACIÓN Y FINANZAS', pageWidth / 2, footerY, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Documento oficial emitido por el sistema Edugest', pageWidth / 2, footerY + 4, { align: 'center' });

  // Guardar archivo
  const cleanName = (student?.names || 'Estudiante').trim().replace(/[^a-zA-Z0-9]/g, '_');
  const cleanSurname = (student?.first_surname || '').trim().replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Estado_de_Cuenta_${cleanName}_${cleanSurname}.pdf`);
};
