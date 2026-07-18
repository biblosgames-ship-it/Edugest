import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export const generateStudentPDF = (
  student: any,
  family: any,
  medical: any,
  history: any,
  documents: any,
  centerData: any,
  courseInfo: any
) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;

  // DATOS DE RESPALDO SI FALLA LA DB
  const center = (centerData && centerData.name) ? centerData : {
    name: 'CENTRO EDUCATIVO',
    address: '---',
    phone: '---',
    logo_url: null
  };

  // 1. ENCABEZADO MÁS COMPACTO
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(center.name.toUpperCase(), pageWidth / 2, 12, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Dirección: ${center.address || '---'}   |   Teléfono: ${center.phone || '---'}`,
    pageWidth / 2,
    16,
    { align: 'center' }
  );

  doc.setDrawColor(0);
  doc.line(margin, 19, pageWidth - margin, 19);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('FICHA DE INSCRIPCIÓN Y EXPEDIENTE DEL ESTUDIANTE', pageWidth / 2, 24, {
    align: 'center'
  });

  const commonStyles = { fontSize: 8, cellPadding: 1.0 };
  const gap = 4; // Espacio ultra-reducido entre tablas

  // 1.5 INFORMACIÓN ACADÉMICA (DESTACADA)
  autoTable(doc, {
    startY: 28,
    head: [
      [
        `AÑO ESCOLAR: ${student.school_year || '2025-2026'}`,
        `GRADO: ${courseInfo?.grade || '---'}`,
        `SECCIÓN: ${courseInfo?.section || '---'}`,
        `TANDA: ${courseInfo?.tanda || '---'}`
      ]
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 1.5, halign: 'center', fontStyle: 'bold' },
    headStyles: { fillColor: [55, 48, 163], textColor: [255, 255, 255] } // Fondo destacado (Indigo oscuro)
  });

  // 2. DATOS DEL ESTUDIANTE
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + gap,
    head: [['DATOS PERSONALES DEL ESTUDIANTE', '']],
    body: [
      [
        'Nombres y Apellidos:',
        `${student.names || student.first_name || ''} ${student.firstSurname || student.first_surname || ''} ${student.secondSurname || student.second_surname || ''}`.trim().toUpperCase()
      ],
      ['Código Alumno / SIGERD:', `${student.student_code || '---'}  /  ${student.sigerdCode || student.sigerd_code || '---'}`],
      ['Fecha y Lugar de Nac.:', `${student.birthDate || student.birth_date || '---'}  |  ${student.placeOfBirth || student.place_of_birth || '---'}`],
      ['Sexo / Nacionalidad / Folio:', `${student.sex || '---'}  /  ${student.nationality || 'Dominicana'}  /  Folio: ${student.birthCertificateFolio || student.birth_certificate_folio || '---'}`],
      ['Cédula:', student.idCard || student.id_card || '---'],
      [
        'Dirección:',
        `${student.addressStreet || student.address_street || ''} ${student.addressNumber || student.address_number || ''}, ${student.addressSector || student.address_sector || ''}, ${student.municipality || student.municipality || ''}, ${student.province || student.province || ''}`.trim().toUpperCase()
      ],
      ['Teléfonos / Correo:', `Personal: ${student.personalPhone || student.personal_phone || '---'}  |  Casa: ${student.homePhone || student.home_phone || '---'}  |  ${student.email || '---'}`],
      ['Vive con / Autorizado:', `Vive con: ${student.livesWith || student.lives_with || '---'}  |  Autorizado: ${student.authorizedPerson || student.authorized_person || '---'}`],
      ['Restricciones Legales:', student.legalRestrictions || student.legal_restrictions || 'Ninguna']
    ],
    theme: 'grid',
    styles: commonStyles,
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } }
  });

  // 3. DATOS FAMILIARES
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + gap,
    head: [['INFORMACIÓN FAMILIAR', 'NOMBRE COMPLETO', 'TELÉFONO', 'OCUPACIÓN']],
    body: [
      [
        'PADRE:',
        family.padre?.name || '---',
        family.padre?.phone || '---',
        family.padre?.occupation || '---'
      ],
      [
        'MADRE:',
        family.madre?.name || '---',
        family.madre?.phone || '---',
        family.madre?.occupation || '---'
      ],
      [
        'TUTOR:',
        family.tutor?.name || '---',
        family.tutor?.phone || '---',
        family.tutor?.relation || '---'
      ]
    ],
    theme: 'grid',
    styles: commonStyles,
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 8 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 } }
  });

  // 4. DATOS DE SALUD
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + gap,
    head: [['INFORMACIÓN DE SALUD', 'DETALLES']],
    body: [
      [
        'ARS / Tipo Sangre:',
        `${medical.insurance_ars || '---'}  |  ${medical.blood_type || '---'}`
      ],
      ['Alergias:', medical.allergies || 'Ninguna'],
      ['Condiciones Médicas:', medical.medical_conditions || 'Ninguna'],
      ['Medicamentos Permanentes:', medical.permanent_medication || 'Ninguno'],
      ['Observaciones:', medical.special_observations || '---']
    ],
    theme: 'grid',
    styles: commonStyles,
    headStyles: { fillColor: [100, 116, 139], textColor: [255, 255, 255], fontSize: 8 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } }
  });

  // 5. HISTORIAL ACADÉMICO
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + gap,
    head: [['HISTORIAL ACADÉMICO', 'DETALLES']],
    body: [
      ['Colegio Anterior:', history.previous_school || '---'],
      ['¿Repite Grado?:', history.repeating_grade ? 'SÍ' : 'NO'],
      ['Necesidades Especiales:', history.special_needs || 'Ninguna'],
      ['Diagnóstico Pedagógico:', history.pedagogical_diagnosis || '---'],
      ['Obs. de Rendimiento:', history.performance_observations || '---']
    ],
    theme: 'grid',
    styles: commonStyles,
    headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontSize: 8 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } }
  });

  // FIRMAS SUPER COMPACTAS
  let finalY = (doc as any).lastAutoTable.finalY + 15;
  if (finalY > 260) {
    // Mayor tolerancia para no saltar de página a menos que sea obligatorio
    doc.addPage();
    finalY = 30;
  }

  doc.line(margin + 10, finalY, margin + 70, finalY);
  doc.setFontSize(8);
  doc.text('Firma del Padre/Tutor', margin + 40, finalY + 4, { align: 'center' });

  doc.line(pageWidth - margin - 70, finalY, pageWidth - margin - 10, finalY);
  doc.text('Firma de la Dirección', pageWidth - margin - 40, finalY + 4, { align: 'center' });

  doc.save(`Ficha_${student.names || 'Estudiante'}.pdf`);
};
