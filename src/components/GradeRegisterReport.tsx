import React, { useState, useEffect, useMemo } from 'react';
import { useApp, useSupabase } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import {
  BookOpen,
  Printer,
  Download,
  FileSpreadsheet,
  Search,
  X,
  Users,
  HeartPulse,
  GraduationCap,
  CheckCircle2
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

interface GradeRegisterReportProps {
  onClose?: () => void;
  initialCourseId?: string;
}

/**
 * Función oficial para generar el RNE según requerimiento:
 * "Se crea con la primera letra del primer nombre y la primera letra de los apellidos,
 * luego se coloca el terminal del año, el mes con un 0 adelante si es del 1 al 9
 * y el día de nacimiento con 0 adelante si es menor a 10."
 */
export const generateRNE = (student: any): string => {
  if (!student) return '';

  const cleanLetters = (str: string) =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '');

  // 1. Primera letra del primer nombre
  const rawFirstName = (
    student.first_name ||
    student.names ||
    student.firstName ||
    ''
  ).trim();
  const firstNameOnly = rawFirstName.split(/\s+/)[0] || '';
  const firstLetterName = cleanLetters(firstNameOnly).charAt(0) || '';

  // 2. Primera letra de los apellidos
  let firstLetterSurname1 = '';
  let firstLetterSurname2 = '';

  const rawFirstSurname = (student.first_surname || '').trim();
  const rawSecondSurname = (student.second_surname || '').trim();

  if (rawFirstSurname || rawSecondSurname) {
    if (rawFirstSurname) {
      firstLetterSurname1 = cleanLetters(rawFirstSurname.split(/\s+/)[0]).charAt(0);
    }
    if (rawSecondSurname) {
      firstLetterSurname2 = cleanLetters(rawSecondSurname.split(/\s+/)[0]).charAt(0);
    }
  } else {
    // Si los apellidos están juntos en last_name o lastName
    const rawLastName = (student.last_name || student.lastName || '').trim();
    const surnameParts = rawLastName.split(/\s+/).filter(Boolean);
    if (surnameParts.length > 0) {
      firstLetterSurname1 = cleanLetters(surnameParts[0]).charAt(0);
    }
    if (surnameParts.length > 1) {
      firstLetterSurname2 = cleanLetters(surnameParts[1]).charAt(0);
    }
  }

  const prefixLetters = `${firstLetterName}${firstLetterSurname1}${firstLetterSurname2}`;

  // 3. Fecha de nacimiento
  const bDate = student.birth_date || student.birthDate;
  if (!bDate) {
    if (student.rne) return student.rne;
    return prefixLetters;
  }

  // Parsear fecha de nacimiento de manera segura sin saltos de huso horario
  let yearStr = '';
  let monthStr = '';
  let dayStr = '';

  try {
    const rawDatePart = String(bDate).split('T')[0];
    const parts = rawDatePart.split('-');
    if (parts.length === 3) {
      yearStr = parts[0];
      monthStr = parts[1];
      dayStr = parts[2];
    } else {
      const d = new Date(bDate);
      if (!isNaN(d.getTime())) {
        yearStr = String(d.getFullYear());
        monthStr = String(d.getMonth() + 1);
        dayStr = String(d.getDate());
      }
    }
  } catch (err) {
    console.error('Error parsing birth date:', err);
  }

  if (!yearStr || !monthStr || !dayStr) {
    return student.rne || prefixLetters;
  }

  // Terminal del año (últimos 2 dígitos del año de nacimiento)
  const yearTerminal = yearStr.slice(-2);

  // Mes con un 0 adelante si es del 1 al 9 (2 dígitos)
  const monthPadded = String(parseInt(monthStr, 10)).padStart(2, '0');

  // Día con 0 adelante si es menor a 10 (2 dígitos)
  const dayPadded = String(parseInt(dayStr, 10)).padStart(2, '0');

  return `${prefixLetters}${yearTerminal}${monthPadded}${dayPadded}`;
};

// Limpieza para detectar si un campo médico está realmente vacío
const isEmptyOrNone = (val?: string | null): boolean => {
  if (!val) return true;
  const clean = val.trim().toLowerCase();
  return (
    clean === '' ||
    clean === 'no' ||
    clean === 'no.' ||
    clean === 'no tiene' ||
    clean === 'ninguna' ||
    clean === 'ninguno' ||
    clean === 'ningun' ||
    clean === 'na' ||
    clean === 'n/a' ||
    clean === '-' ||
    clean === '--' ||
    clean === 's/n' ||
    clean === 'sin alergias' ||
    clean === 'sin enfermedades' ||
    clean === 'sin medicamentos' ||
    clean === 'ninguna enfermedad'
  );
};

export const GradeRegisterReport: React.FC<GradeRegisterReportProps> = ({
  onClose,
  initialCourseId
}) => {
  const { state, center, selectedYear } = useApp();
  const { profile } = useSupabase();

  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || 'ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [parentsData, setParentsData] = useState<any[]>([]);
  const [medicalData, setMedicalData] = useState<any[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);

  const courses = state.courses || [];
  const allStudents = state.students || [];

  // Cargar datos complementarios (padres y registros médicos) de forma robusta
  useEffect(() => {
    let isMounted = true;

    const fetchExtraData = async () => {
      setLoadingExtra(true);
      try {
        const centerId = profile?.center_id || center?.id || (courses[0] as any)?.center_id;
        const studentIds = allStudents.map((s: any) => s.id).filter(Boolean);

        // 1. CARGAR PADRES / FAMILIARES
        let allParentsAccum: any[] = [];

        // A) Intentar por center_id directo (muy rápido y sin límites de URL)
        if (centerId) {
          try {
            const { data: pByCenter, error: errC } = await supabase
              .from('parents')
              .select('*')
              .eq('center_id', centerId);
            if (!errC && pByCenter) {
              allParentsAccum = [...pByCenter];
            }
          } catch (e) {
            console.error('Error al consultar parents por center_id:', e);
          }
        }

        // B) Si faltan registros o no tenían center_id, consultar por student_id en lotes de 40
        const existingStudentIds = new Set(allParentsAccum.map((p) => p.student_id));
        const missingStudentIds = studentIds.filter((id: string) => !existingStudentIds.has(id));

        if (missingStudentIds.length > 0) {
          const batchSize = 40;
          for (let i = 0; i < missingStudentIds.length; i += batchSize) {
            const batch = missingStudentIds.slice(i, i + batchSize);
            try {
              const { data: pBatch, error: errB } = await supabase
                .from('parents')
                .select('*')
                .in('student_id', batch);
              if (!errB && pBatch) {
                pBatch.forEach((p) => {
                  if (!allParentsAccum.some((existing) => existing.id === p.id)) {
                    allParentsAccum.push(p);
                  }
                });
              }
            } catch (e) {
              console.error('Error en lote de parents:', e);
            }
          }
        }

        // C) Consultar también tabla 'student_family' por si los familiares se registraron allí
        try {
          const batchSize = 40;
          for (let i = 0; i < studentIds.length; i += batchSize) {
            const batch = studentIds.slice(i, i + batchSize);
            const { data: fBatch } = await supabase
              .from('student_family')
              .select('*')
              .in('student_id', batch);
            if (fBatch && fBatch.length > 0) {
              fBatch.forEach((f) => {
                allParentsAccum.push({
                  id: f.id,
                  student_id: f.student_id,
                  name: f.name || f.full_name || f.first_name,
                  relation: f.role || f.relation || 'Tutor',
                  phone: f.phone || f.cellphone || f.tel,
                  secondary_phone: f.secondary_phone || f.whatsapp
                });
              });
            }
          }
        } catch (e) {
          // student_family puede no existir en algunas instancias
        }

        if (isMounted) {
          setParentsData(allParentsAccum);
        }

        // 2. CARGAR FICHA MÉDICA
        if (studentIds.length > 0) {
          let medAccum: any[] = [];
          const batchSize = 40;
          for (let i = 0; i < studentIds.length; i += batchSize) {
            const batch = studentIds.slice(i, i + batchSize);
            try {
              const { data: mList, error: mErr } = await supabase
                .from('student_medical')
                .select('*')
                .in('student_id', batch);
              if (!mErr && mList) {
                medAccum = [...medAccum, ...mList];
              }
            } catch (e) {
              console.error('Error en student_medical batch:', e);
            }
          }
          if (isMounted) {
            setMedicalData(medAccum);
          }
        }
      } catch (err) {
        console.error('Error fetching extra data for GradeRegisterReport:', err);
      } finally {
        if (isMounted) {
          setLoadingExtra(false);
        }
      }
    };

    fetchExtraData();

    return () => {
      isMounted = false;
    };
  }, [profile?.center_id, center?.id, allStudents.length]);

  // Construir la lista enriquecida con los 16 datos requeridos
  const enrichedStudents = useMemo(() => {
    // 1. Mapeo de padres por student_id
    const pMap: Record<string, any[]> = {};
    parentsData.forEach((p) => {
      if (p.student_id) {
        if (!pMap[p.student_id]) pMap[p.student_id] = [];
        pMap[p.student_id].push(p);
      }
    });

    // 2. Mapeo de familiares por family_id para enlazar hermanos
    const familyIdToParentsMap: Record<string, any[]> = {};
    allStudents.forEach((student: any) => {
      if (student.family_id && pMap[student.id]) {
        if (!familyIdToParentsMap[student.family_id]) {
          familyIdToParentsMap[student.family_id] = [];
        }
        pMap[student.id].forEach((p) => {
          if (!familyIdToParentsMap[student.family_id].some((x) => x.id === p.id)) {
            familyIdToParentsMap[student.family_id].push(p);
          }
        });
      }
    });

    // 3. Mapeo de registros médicos
    const mMap: Record<string, any> = {};
    medicalData.forEach((m) => {
      if (m.student_id) {
        mMap[m.student_id] = m;
      }
    });

    return allStudents.map((s: any, idx: number) => {
      const course = courses.find((c: any) => c.id === s.course_id);

      // Obtener lista de familiares asociados al estudiante
      let sParents: any[] = pMap[s.id] || [];
      if (sParents.length === 0 && s.family_id && familyIdToParentsMap[s.family_id]) {
        sParents = familyIdToParentsMap[s.family_id];
      }
      if (sParents.length === 0 && Array.isArray(s.parents) && s.parents.length > 0) {
        sParents = s.parents;
      }

      const getRole = (p: any) => (p.relation || p.role || '').toLowerCase().trim();

      // PADRE
      const dbPadre = sParents.find((p) => {
        const r = getRole(p);
        return r.includes('padre') || r.includes('father') || r.includes('papa') || r.includes('papá');
      });
      const fatherName = (dbPadre?.name || s.father_name || s.padre_name || s.nombre_padre || '').trim();
      const fatherPhone = (
        dbPadre?.phone ||
        dbPadre?.secondary_phone ||
        s.father_phone ||
        s.padre_phone ||
        s.telefono_padre ||
        ''
      ).trim();

      // MADRE
      const dbMadre = sParents.find((p) => {
        const r = getRole(p);
        return r.includes('madre') || r.includes('mother') || r.includes('mama') || r.includes('mamá');
      });
      const motherName = (dbMadre?.name || s.mother_name || s.madre_name || s.nombre_madre || '').trim();
      const motherPhone = (
        dbMadre?.phone ||
        dbMadre?.secondary_phone ||
        s.mother_phone ||
        s.madre_phone ||
        s.telefono_madre ||
        ''
      ).trim();

      // TUTOR
      // Buscar alguien con rol de tutor o pariente no padre/madre
      const dbTutorExplicit = sParents.find((p) => {
        const r = getRole(p);
        return (
          r.includes('tutor') ||
          (!r.includes('padre') && !r.includes('madre') && !r.includes('father') && !r.includes('mother') && r !== '')
        );
      });

      // Si no hay tutor explícito, tomar el familiar principal o tutor legal autorizado
      const tutorCandidate =
        dbTutorExplicit ||
        (s.lives_with?.toLowerCase().includes('madre') ? dbMadre : null) ||
        (s.lives_with?.toLowerCase().includes('padre') ? dbPadre : null) ||
        dbMadre ||
        dbPadre ||
        sParents[0];

      const tutorName = (
        dbTutorExplicit?.name ||
        s.tutor_name ||
        s.tutorName ||
        s.authorized_person ||
        s.authorizedPerson ||
        tutorCandidate?.name ||
        ''
      ).trim();

      const tutorPhone = (
        dbTutorExplicit?.phone ||
        dbTutorExplicit?.secondary_phone ||
        s.tutor_phone ||
        tutorCandidate?.phone ||
        tutorCandidate?.secondary_phone ||
        s.personal_phone ||
        s.home_phone ||
        ''
      ).trim();

      // FICHA MÉDICA (Si está vacía, DEBE SALIR VACÍA "")
      const med = mMap[s.id] || {};
      const rawConditions = (med.medical_conditions || s.medical_conditions || '').trim();
      const rawAllergies = (med.allergies || s.allergies || '').trim();

      const conditionsList: string[] = [];
      if (!isEmptyOrNone(rawConditions)) {
        conditionsList.push(rawConditions);
      }
      if (!isEmptyOrNone(rawAllergies)) {
        conditionsList.push(
          rawAllergies.toLowerCase().startsWith('alergia') ? rawAllergies : `Alergia: ${rawAllergies}`
        );
      }
      // Vacío si no tiene
      const enfermedadesAlergias = conditionsList.length > 0 ? conditionsList.join(' | ') : '';

      const rawPermanentMed = (med.permanent_medication || s.permanent_medication || s.medication || '').trim();
      // Vacío si no tiene
      const medicamentos = !isEmptyOrNone(rawPermanentMed) ? rawPermanentMed : '';

      // Nombres y apellidos completos formateados
      const firstSur = (s.first_surname || '').trim();
      const secondSur = (s.second_surname || '').trim();
      const fullSurnames = `${firstSur} ${secondSur}`.trim() || (s.last_name || s.lastName || '').trim();
      const firstNames = (s.names || s.first_name || s.firstName || '').trim();

      // Formato oficial: APELLIDOS, NOMBRES
      const fullNameOfficial = fullSurnames ? `${fullSurnames}, ${firstNames}` : firstNames;

      // Dirección
      const addressParts = [
        s.address_street,
        s.address_number ? `#${s.address_number}` : '',
        s.address_sector,
        s.municipality,
        s.province
      ]
        .filter(Boolean)
        .map((x: string) => x.trim())
        .filter((x: string) => x.length > 0);
      const direccionCompleta = addressParts.length > 0 ? addressParts.join(', ') : (s.address || '');

      // Datos del acta de nacimiento
      const numActa = (s.birth_certificate_number || '').trim();
      const folioActa = (s.birth_certificate_folio || '').trim();
      let datosActa = '';
      if (numActa && folioActa) {
        datosActa = `Núm: ${numActa} | Folio: ${folioActa}`;
      } else if (numActa) {
        datosActa = `Núm: ${numActa}`;
      } else if (folioActa) {
        datosActa = `Folio: ${folioActa}`;
      }

      // RNE
      const rneCalculado = generateRNE(s);

      return {
        id: s.id,
        course_id: s.course_id,
        courseName: course
          ? `${course.level} - ${course.grade} "${course.section}" (${course.tanda || 'Matutina'})`
          : 'Sin Grado Asignado',
        courseShort: course ? `${course.grade} "${course.section}"` : 'S/A',
        courseLevel: course?.level || '',
        courseGrade: course?.grade || '',
        courseSection: course?.section || '',
        courseTanda: course?.tanda || 'Matutina',

        // 1. Número de orden
        orderNumber: s.order_number || s.orderNumber || idx + 1,

        // 2. Nombres y Apellidos
        fullName: fullNameOfficial.toUpperCase(),
        firstNames: firstNames.toUpperCase(),
        surnames: fullSurnames.toUpperCase(),

        // 3. Sexo
        sex: (s.sex || '').toUpperCase() === 'F' ? 'F' : 'M',

        // 4. Datos del acta de nacimiento
        birthCertificateData: datosActa,
        numActa,
        folioActa,

        // 5. No. Cédula o Pasaporte
        idCardOrPassport: s.id_card || s.passport || '',

        // 6. RNE
        rne: rneCalculado,

        // 7. Dirección donde reside
        address: direccionCompleta,

        // 8. Correo Electrónico
        email: s.email || '',

        // 9. Enfermedades o alérgico a
        conditionsAndAllergies: enfermedadesAlergias,

        // 10. Medicamentos que usa
        medications: medicamentos,

        // 11. Tutor
        tutorName,

        // 12. Teléfono del tutor
        tutorPhone,

        // 13. Nombre del padre
        fatherName,

        // 14. Teléfono del padre
        fatherPhone,

        // 15. Nombre de la madre
        motherName,

        // 16. Teléfono de la madre
        motherPhone
      };
    });
  }, [allStudents, courses, parentsData, medicalData]);

  // Filtrado por Curso y Búsqueda
  const filteredStudents = useMemo(() => {
    let result = enrichedStudents;

    if (selectedCourseId !== 'ALL') {
      result = result.filter((s) => s.course_id === selectedCourseId);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          s.rne.toLowerCase().includes(q) ||
          s.idCardOrPassport.toLowerCase().includes(q) ||
          s.tutorName.toLowerCase().includes(q) ||
          s.fatherName.toLowerCase().includes(q) ||
          s.motherName.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q)
      );
    }

    // Ordenar por número de orden o alfabéticamente
    return result.sort((a, b) => {
      if (a.course_id !== b.course_id) {
        return (a.courseName || '').localeCompare(b.courseName || '');
      }
      return (Number(a.orderNumber) || 999) - (Number(b.orderNumber) || 999);
    });
  }, [enrichedStudents, selectedCourseId, searchTerm]);

  // Agrupados por curso para impresión y reportes consolidados
  const studentsByCourse = useMemo(() => {
    const map: Record<string, { course: any; students: typeof enrichedStudents }> = {};

    filteredStudents.forEach((student) => {
      const cid = student.course_id || 'unassigned';
      if (!map[cid]) {
        const foundCourse = courses.find((c: any) => c.id === cid);
        map[cid] = {
          course: foundCourse || {
            id: 'unassigned',
            grade: 'Sin Asignar',
            section: '-',
            level: 'General',
            tanda: 'General'
          },
          students: []
        };
      }
      map[cid].students.push(student);
    });

    return Object.values(map);
  }, [filteredStudents, courses]);

  // Métricas del curso seleccionado
  const stats = useMemo(() => {
    const total = filteredStudents.length;
    const boys = filteredStudents.filter((s) => s.sex === 'M').length;
    const girls = filteredStudents.filter((s) => s.sex === 'F').length;
    const withRNE = filteredStudents.filter((s) => s.rne && s.rne.length >= 4).length;
    // Solo contar si REALMENTE tiene una condición médica o medicamento
    const withMedicalNotes = filteredStudents.filter(
      (s) => s.conditionsAndAllergies !== '' || s.medications !== ''
    ).length;
    return { total, boys, girls, withRNE, withMedicalNotes };
  }, [filteredStudents]);

  // Curso seleccionado actual (si no es ALL)
  const currentCourse = useMemo(() => {
    if (selectedCourseId === 'ALL') return null;
    return courses.find((c: any) => c.id === selectedCourseId) || null;
  }, [selectedCourseId, courses]);

  // EXPORTAR A EXCEL
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      const exportRows = filteredStudents.map((s, index) => ({
        'Nº ORDEN': s.orderNumber || index + 1,
        'APELLIDOS Y NOMBRES': s.fullName,
        'SEXO': s.sex,
        'DATOS ACTA NACIMIENTO': s.birthCertificateData,
        'NO. CÉDULA O PASAPORTE': s.idCardOrPassport,
        'RNE': s.rne,
        'DIRECCIÓN DE RESIDENCIA': s.address,
        'CORREO ELECTRÓNICO': s.email,
        'ENFERMEDADES O ALERGIAS': s.conditionsAndAllergies,
        'MEDICAMENTOS QUE USA': s.medications,
        'TUTOR': s.tutorName,
        'TELÉFONO TUTOR': s.tutorPhone,
        'NOMBRE DEL PADRE': s.fatherName,
        'TELÉFONO PADRE': s.fatherPhone,
        'NOMBRE DE LA MADRE': s.motherName,
        'TELÉFONO MADRE': s.motherPhone,
        'GRADO': s.courseGrade,
        'SECCIÓN': s.courseSection,
        'NIVEL': s.courseLevel,
        'TANDA': s.courseTanda
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);

      // Anchos de columna recomendados
      ws['!cols'] = [
        { wch: 10 }, // Nº Orden
        { wch: 35 }, // Nombres y Apellidos
        { wch: 6 },  // Sexo
        { wch: 24 }, // Acta Nacimiento
        { wch: 18 }, // Cédula/Pasaporte
        { wch: 14 }, // RNE
        { wch: 35 }, // Dirección
        { wch: 25 }, // Correo
        { wch: 25 }, // Enfermedades
        { wch: 22 }, // Medicamentos
        { wch: 26 }, // Tutor
        { wch: 16 }, // Tel. Tutor
        { wch: 26 }, // Padre
        { wch: 16 }, // Tel. Padre
        { wch: 26 }, // Madre
        { wch: 16 }, // Tel. Madre
        { wch: 12 }, // Grado
        { wch: 8 },  // Sección
        { wch: 14 }, // Nivel
        { wch: 12 }  // Tanda
      ];

      const sheetTitle = currentCourse
        ? `${currentCourse.grade}_${currentCourse.section}`.replace(/[^a-zA-Z0-9_]/g, '')
        : 'Registro_Grado';

      XLSX.utils.book_append_sheet(wb, ws, sheetTitle.substring(0, 30));

      const fileName = currentCourse
        ? `Registro_Grado_${currentCourse.grade}_${currentCourse.section}_${selectedYear || '2026'}.xlsx`
        : `Registro_Grado_Completo_${selectedYear || '2026'}.xlsx`;

      XLSX.writeFile(wb, fileName);
      toast.success('Archivo de Excel generado con éxito.');
    } catch (err) {
      console.error('Error al exportar a Excel:', err);
      toast.error('Ocurrió un error al generar el archivo Excel.');
    }
  };

  // EXPORTAR A PDF (Oficial Landscape)
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'letter'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const institutionName = (center?.name || 'CENTRO EDUCATIVO').toUpperCase();
      const subHeader = `AÑO ESCOLAR: ${selectedYear || '2026-2027'}   |   MINISTERIO DE EDUCACIÓN (MINERD)`;

      let isFirstPage = true;

      studentsByCourse.forEach((group) => {
        if (!isFirstPage) {
          doc.addPage('letter', 'landscape');
        }
        isFirstPage = false;

        const cInfo = group.course;
        const courseTitle = `${cInfo.level || ''} - ${cInfo.grade || ''} "${cInfo.section || ''}" - TANDA ${(cInfo.tanda || 'Matutina').toUpperCase()}`;

        // Encabezado
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59); // Slate 800
        doc.text(institutionName, pageWidth / 2, 12, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139); // Slate 500
        doc.text(subHeader, pageWidth / 2, 17, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(79, 70, 229); // Indigo 600
        doc.text(`DATOS PARA REGISTRO DE GRADO: ${courseTitle.toUpperCase()}`, pageWidth / 2, 23, {
          align: 'center'
        });

        // Tabla con las 16 columnas requeridas
        const head = [
          [
            '#',
            'NOMBRES Y APELLIDOS',
            'SEX',
            'ACTA NAC.',
            'CÉDULA / PAS.',
            'RNE',
            'DIRECCIÓN RESIDENCIA',
            'CORREO',
            'ENFERM. / ALERGIA',
            'MEDICAMENTOS',
            'TUTOR (TELÉFONO)',
            'PADRE (TELÉFONO)',
            'MADRE (TELÉFONO)'
          ]
        ];

        const body = group.students.map((s, idx) => [
          s.orderNumber || idx + 1,
          s.fullName,
          s.sex,
          s.birthCertificateData,
          s.idCardOrPassport,
          s.rne,
          s.address,
          s.email,
          s.conditionsAndAllergies,
          s.medications,
          s.tutorName ? `${s.tutorName}${s.tutorPhone ? '\n' + s.tutorPhone : ''}` : '',
          s.fatherName ? `${s.fatherName}${s.fatherPhone ? '\n' + s.fatherPhone : ''}` : '',
          s.motherName ? `${s.motherName}${s.motherPhone ? '\n' + s.motherPhone : ''}` : ''
        ]);

        autoTable(doc, {
          startY: 27,
          head: head,
          body: body,
          theme: 'grid',
          styles: {
            fontSize: 6.5,
            cellPadding: 1.2,
            overflow: 'linebreak',
            valign: 'middle',
            font: 'helvetica'
          },
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 6.5
          },
          columnStyles: {
            0: { cellWidth: 7, halign: 'center' },   // #
            1: { cellWidth: 38 },                   // Nombres y Apellidos
            2: { cellWidth: 7, halign: 'center' },   // Sexo
            3: { cellWidth: 20 },                   // Acta
            4: { cellWidth: 17 },                   // Cédula/Pas.
            5: { cellWidth: 18, fontStyle: 'bold' },// RNE
            6: { cellWidth: 32 },                   // Dirección
            7: { cellWidth: 20 },                   // Correo
            8: { cellWidth: 20 },                   // Enfermedades/Alergias
            9: { cellWidth: 18 },                   // Medicamentos
            10: { cellWidth: 25 },                  // Tutor + Tel
            11: { cellWidth: 23 },                  // Padre + Tel
            12: { cellWidth: 23 }                   // Madre + Tel
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          didDrawPage: (data) => {
            // Pie de página
            const pageNum = doc.getNumberOfPages();
            doc.setFontSize(7.5);
            doc.setTextColor(148, 163, 184);
            doc.text(
              `Total Estudiantes: ${group.students.length} (M: ${group.students.filter((x) => x.sex === 'M').length} | F: ${group.students.filter((x) => x.sex === 'F').length})`,
              data.settings.margin.left,
              pageHeight - 6
            );
            doc.text(
              `Página ${pageNum} | Generado el ${new Date().toLocaleDateString('es-DO')}`,
              pageWidth - data.settings.margin.right,
              pageHeight - 6,
              { align: 'right' }
            );
          }
        });
      });

      const fileName = currentCourse
        ? `Registro_Grado_${currentCourse.grade}_${currentCourse.section}.pdf`
        : `Registro_Grado_Oficial_${selectedYear || '2026'}.pdf`;

      doc.save(fileName);
      toast.success('Documento PDF generado y descargado.');
    } catch (err) {
      console.error('Error al generar PDF:', err);
      toast.error('Ocurrió un error al generar el PDF.');
    }
  };

  // IMPRESIÓN DIRECTA
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Barra de Controles y Filtros (No imprimible) */}
      <div className="print:hidden bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                Oficial MINERD
              </span>
              <span className="text-xs font-bold text-slate-400">Año Escolar {selectedYear || '2026-2027'}</span>
            </div>
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <BookOpen className="text-indigo-600" size={24} /> Datos para Llenar el Registro de Grado
            </h2>
            <p className="text-xs text-slate-500">
              Reporte por grado con los 16 campos oficiales requeridos para el Registro de Grado dominicano.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              <Printer size={15} /> Imprimir
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Download size={15} /> PDF Oficial
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <FileSpreadsheet size={15} /> Exportar Excel
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all cursor-pointer"
                title="Cerrar reporte"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Filtros: Selector de Curso y Buscador */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
          {/* Selector de Curso */}
          <div className="md:col-span-6">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
              <GraduationCap size={13} className="text-indigo-500" /> Seleccionar Grado / Curso:
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
            >
              <option value="ALL">📋 Mostrar Todos los Grados del Centro</option>
              {courses.map((course: any) => (
                <option key={course.id} value={course.id}>
                  {course.level} — {course.grade} &quot;{course.section}&quot; ({course.tanda || 'Matutina'})
                </option>
              ))}
            </select>
          </div>

          {/* Buscador en Vivo */}
          <div className="md:col-span-6">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
              <Search size={13} className="text-indigo-500" /> Buscar Alumno, RNE, Cédula o Tutor:
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Escribe para buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <Search className="absolute left-3 top-3 text-slate-400" size={14} />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Barra de Métricas y Estadísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black">
              <Users size={16} />
            </div>
            <div>
              <span className="text-[9px] font-black uppercase text-slate-400 block">Total Alumnos</span>
              <span className="text-base font-black text-slate-800">{stats.total}</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black">
              M
            </div>
            <div>
              <span className="text-[9px] font-black uppercase text-slate-400 block">Varones</span>
              <span className="text-base font-black text-blue-700">{stats.boys}</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-black">
              F
            </div>
            <div>
              <span className="text-[9px] font-black uppercase text-slate-400 block">Hembras</span>
              <span className="text-base font-black text-rose-700">{stats.girls}</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-black">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <span className="text-[9px] font-black uppercase text-slate-400 block">Con RNE Calculado</span>
              <span className="text-base font-black text-emerald-700">{stats.withRNE}</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-black">
              <HeartPulse size={16} />
            </div>
            <div>
              <span className="text-[9px] font-black uppercase text-slate-400 block">Condición Médica</span>
              <span className="text-base font-black text-amber-700">{stats.withMedicalNotes}</span>
            </div>
          </div>
        </div>

        {loadingExtra && (
          <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center gap-2 text-indigo-700 text-xs font-bold animate-pulse">
            <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            Cargando expedientes familiares y fichas médicas asociadas a los estudiantes...
          </div>
        )}
      </div>

      {/* VISTA DEL REPORTE (Para Visualización e Impresión) */}
      <div className="space-y-8 print:space-y-6">
        {studentsByCourse.length === 0 ? (
          <div className="bg-white p-12 rounded-[2rem] border border-slate-100 text-center space-y-3">
            <Users className="mx-auto text-slate-300" size={48} />
            <h3 className="text-base font-black text-slate-700 uppercase">No se encontraron estudiantes</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No hay estudiantes registrados en el curso seleccionado o que coincidan con el término de búsqueda.
            </p>
          </div>
        ) : (
          studentsByCourse.map((group) => {
            const c = group.course;
            return (
              <div
                key={c.id}
                className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-xl print:shadow-none print:border-none print:p-0 page-break-after"
              >
                {/* Membrete Institucional para Impresión y Pantalla */}
                <div className="border-b-2 border-slate-900 pb-4 mb-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-black tracking-widest text-indigo-600 uppercase block mb-1">
                        REPÚBLICA DOMINICANA — MINISTERIO DE EDUCACIÓN (MINERD)
                      </span>
                      <h1 className="text-lg md:text-2xl font-black text-slate-900 uppercase tracking-tight">
                        {center?.name || 'CENTRO EDUCATIVO'}
                      </h1>
                      <div className="text-xs font-bold text-slate-600 flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        {center?.code && <span>CÓDIGO: {center.code}</span>}
                        {center?.district && <span>DISTRITO: {center.district}</span>}
                        {center?.regional && <span>REGIONAL: {center.regional}</span>}
                        <span>AÑO ESCOLAR: {selectedYear || '2026-2027'}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-black uppercase tracking-wider block mb-1">
                        REGISTRO DE GRADO
                      </span>
                      <span className="text-[11px] font-bold text-slate-600 block">
                        {c.level} — {c.grade} &quot;{c.section}&quot;
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase block">
                        TANDA: {c.tanda || 'Matutina'} | TOTAL: {group.students.length} ALUMNOS
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tabla de los 16 Datos Oficiales */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-900 text-white uppercase text-[9px] tracking-wider font-black">
                        <th className="p-2 border border-slate-700 text-center w-8">#</th>
                        <th className="p-2 border border-slate-700 min-w-[200px]">NOMBRE(S) Y APELLIDO(S)</th>
                        <th className="p-2 border border-slate-700 text-center w-10">SEXO</th>
                        <th className="p-2 border border-slate-700 min-w-[120px]">ACTA DE NACIMIENTO</th>
                        <th className="p-2 border border-slate-700 min-w-[110px]">CÉDULA / PASAPORTE</th>
                        <th className="p-2 border border-slate-700 min-w-[100px] bg-indigo-950 text-indigo-200">
                          RNE OFICIAL
                        </th>
                        <th className="p-2 border border-slate-700 min-w-[180px]">DIRECCIÓN RESIDENCIA</th>
                        <th className="p-2 border border-slate-700 min-w-[130px]">CORREO ELECTRÓNICO</th>
                        <th className="p-2 border border-slate-700 min-w-[140px] bg-rose-950 text-rose-200">
                          ENFERMEDADES / ALÉRGICO
                        </th>
                        <th className="p-2 border border-slate-700 min-w-[120px]">MEDICAMENTOS</th>
                        <th className="p-2 border border-slate-700 min-w-[140px]">TUTOR</th>
                        <th className="p-2 border border-slate-700 min-w-[100px]">TEL. TUTOR</th>
                        <th className="p-2 border border-slate-700 min-w-[140px]">PADRE</th>
                        <th className="p-2 border border-slate-700 min-w-[100px]">TEL. PADRE</th>
                        <th className="p-2 border border-slate-700 min-w-[140px]">MADRE</th>
                        <th className="p-2 border border-slate-700 min-w-[100px]">TEL. MADRE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {group.students.map((student, idx) => (
                        <tr
                          key={student.id}
                          className={`hover:bg-slate-50 transition-colors ${
                            idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                          }`}
                        >
                          {/* 1. Número de Orden */}
                          <td className="p-2 border border-slate-200 text-center font-black text-slate-900 bg-slate-100/50">
                            {student.orderNumber || idx + 1}
                          </td>

                          {/* 2. Nombres y Apellidos */}
                          <td className="p-2 border border-slate-200 font-bold text-slate-900">
                            {student.fullName}
                          </td>

                          {/* 3. Sexo */}
                          <td className="p-2 border border-slate-200 text-center font-bold">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                                student.sex === 'F' ? 'text-rose-700 bg-rose-50 font-black' : 'text-blue-700 bg-blue-50 font-black'
                              }`}
                            >
                              {student.sex}
                            </span>
                          </td>

                          {/* 4. Datos del acta de nacimiento */}
                          <td className="p-2 border border-slate-200 text-[10px] text-slate-600">
                            {student.birthCertificateData}
                          </td>

                          {/* 5. Cédula o Pasaporte */}
                          <td className="p-2 border border-slate-200 font-mono text-[10px] text-slate-600">
                            {student.idCardOrPassport}
                          </td>

                          {/* 6. RNE */}
                          <td className="p-2 border border-slate-200 font-mono font-black text-[11px] text-indigo-700 bg-indigo-50/30">
                            {student.rne}
                          </td>

                          {/* 7. Dirección donde reside */}
                          <td className="p-2 border border-slate-200 text-[10px] text-slate-600 leading-tight">
                            {student.address}
                          </td>

                          {/* 8. Correo Electrónico */}
                          <td className="p-2 border border-slate-200 text-[10px] text-slate-600 truncate max-w-[130px]">
                            {student.email}
                          </td>

                          {/* 9. Enfermedades o Alérgico a (Vacío si no tiene) */}
                          <td
                            className={`p-2 border border-slate-200 text-[10px] ${
                              student.conditionsAndAllergies
                                ? 'text-rose-700 font-bold bg-rose-50/30'
                                : 'text-slate-500'
                            }`}
                          >
                            {student.conditionsAndAllergies}
                          </td>

                          {/* 10. Medicamentos que usa (Vacío si no tiene) */}
                          <td
                            className={`p-2 border border-slate-200 text-[10px] ${
                              student.medications
                                ? 'text-amber-700 font-bold bg-amber-50/30'
                                : 'text-slate-500'
                            }`}
                          >
                            {student.medications}
                          </td>

                          {/* 11. Tutor */}
                          <td className="p-2 border border-slate-200 text-[10px] font-medium text-slate-800">
                            {student.tutorName}
                          </td>

                          {/* 12. Teléfono del tutor */}
                          <td className="p-2 border border-slate-200 text-[10px] font-mono text-slate-600">
                            {student.tutorPhone}
                          </td>

                          {/* 13. Nombre del padre */}
                          <td className="p-2 border border-slate-200 text-[10px] font-medium text-slate-800">
                            {student.fatherName}
                          </td>

                          {/* 14. Teléfono del padre */}
                          <td className="p-2 border border-slate-200 text-[10px] font-mono text-slate-600">
                            {student.fatherPhone}
                          </td>

                          {/* 15. Nombre de la madre */}
                          <td className="p-2 border border-slate-200 text-[10px] font-medium text-slate-800">
                            {student.motherName}
                          </td>

                          {/* 16. Teléfono de la madre */}
                          <td className="p-2 border border-slate-200 text-[10px] font-mono text-slate-600">
                            {student.motherPhone}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Firmas Oficiales para Registro de Grado */}
                <div className="hidden print:grid grid-cols-2 gap-12 mt-12 pt-8 border-t border-slate-300">
                  <div className="text-center">
                    <div className="border-b border-slate-400 w-3/4 mx-auto mb-2"></div>
                    <p className="text-[10px] font-bold text-slate-700 uppercase">Docente Titular / Encargado de Curso</p>
                    <p className="text-[9px] text-slate-500">Firma y Sello</p>
                  </div>
                  <div className="text-center">
                    <div className="border-b border-slate-400 w-3/4 mx-auto mb-2"></div>
                    <p className="text-[10px] font-bold text-slate-700 uppercase">Dirección del Centro Educativo</p>
                    <p className="text-[9px] text-slate-500">Firma y Sello</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Estilos CSS para Impresión Apaisada (Landscape) y Formato Oficial */}
      <style>{`
        @media print {
          @page {
            size: letter landscape;
            margin: 8mm 6mm 8mm 6mm;
          }
          body {
            background: white !important;
            color: black !important;
            font-size: 8.5pt !important;
          }
          .page-break-after {
            page-break-after: always;
            break-after: page;
          }
        }
      `}</style>
    </div>
  );
};

export default GradeRegisterReport;
