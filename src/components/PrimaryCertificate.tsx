import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  ArrowLeft,
  Printer,
  Edit3,
  CheckCircle2,
  ShieldCheck,
  User,
  MapPin,
  Calendar,
  X,
  Loader2,
  ScrollText,
  Building2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dataService } from '../services/dataService';
import jsPDF from 'jspdf';

interface PrimaryCertificateProps {
  studentId: string;
  onClose: () => void;
}

const PrimaryCertificate: React.FC<PrimaryCertificateProps> = ({ studentId, onClose }) => {
  const { state, center, selectedYear, profile } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Datos editables
  const [formData, setFormData] = useState({
    studentName: '',
    rne: '',
    schoolName: '',
    centerCode: '',
    tanda: '',
    section: '',
    district: '',
    municipality: 'Higüey',
    regional: '',
    schoolYear: selectedYear || '2025-2026',
    issuePlace: 'Higüey, La Altagracia',
    issueDate: new Date().toLocaleDateString('es-DO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }),
    issueDay: '10',
    issueMonth: 'Marzo',
    issueYear: '2026',
    directorName: '',
    certificationOfficerName: '',
    districtDirectorName: ''
  });

  useEffect(() => {
    const loadData = async () => {
      // 1. Obtener datos base del centro (Desde el contexto global o BD)
      const centerData =
        center || (profile?.center_id ? await dataService.getCenter(profile.center_id) : null);

      const today = new Date();
      // Extraer el año de término del año escolar seleccionado (ej: "2025-2026" -> "2026")
      const endingYear =
        selectedYear && selectedYear.includes('-')
          ? selectedYear.split('-')[1].trim()
          : today.getFullYear().toString();

      const baseData = {
        schoolName: centerData?.name?.toUpperCase() || '',
        centerCode: centerData?.center_code || '',
        district: centerData?.district || '12-01',
        regional: centerData?.regional || '12',
        municipality: centerData?.municipality || 'Higüey',
        directorName: centerData?.director_name || '',
        certificationOfficerName: centerData?.certification_officer_name || '',
        districtDirectorName: centerData?.district_director_name || '',
        schoolYear: selectedYear || '2025-2026',
        issuePlace: centerData?.municipality
          ? `${centerData.municipality}, R.D.`
          : 'Higüey, La Altagracia',
        issueDay: today.getDate().toString(),
        issueMonth: today
          .toLocaleString('es-DO', { month: 'long' })
          .replace(/^\w/, (c) => c.toUpperCase()),
        issueYear: endingYear
      };

      if (!studentId) {
        setFormData((prev) => ({ ...prev, ...baseData }));
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // 2. Obtener datos del estudiante
        const student = await dataService.getFullStudent(studentId);
        // 3. Obtener curso para Tanda/Sección
        const course = state.courses.find((c) => c.id === student.course_id);

        setFormData((prev) => ({
          ...prev,
          ...baseData,
          studentName:
            `${student.names || ''} ${student.first_surname || ''} ${student.second_surname || ''}`
              .trim()
              .toUpperCase(),
          rne: student.sigerd_code || student.student_code || student.rne || '',
          tanda: course?.tanda || '',
          section: course?.section || ''
        }));
      } catch (error) {
        console.error('Error loading certificate data:', error);
        // Fallback a solo datos del centro
        setFormData((prev) => ({ ...prev, ...baseData }));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [studentId, center, state.courses, profile, selectedYear]);

  const generatePDF = () => {
    setIsGenerating(true);
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    const centerX = 107.95; // Centro de Letter (215.9mm / 2)

    // 1. Logo del Ministerio (desde la carpeta public) - Un poco más ancho/grande
    const logoUrl = '/Logo_del_Ministerio_de_Educación_(República_Dominicana).svg.png';
    doc.addImage(logoUrl, 'PNG', centerX - 15, 12, 30, 30);

    // 2. Distrito y Regional (Datos del Centro) - Agrandado y Espaciado
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.text(
      `Distrito Educativo: ${formData.district}  |  Regional: ${formData.regional}`,
      centerX,
      46,
      { align: 'center' }
    );

    // 3. Centro Educativo
    doc.setFontSize(12);
    doc.text(`Centro Educativo: ${formData.schoolName}`, centerX, 54, { align: 'center' });

    // 4. Título (En Negrita y Agrandado)
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.text('CERTIFICACIÓN DE CONCLUSIÓN DEL NIVEL PRIMARIO', centerX, 70, { align: 'center' });

    // 5. Nombre del Alumno (Agrandado)
    doc.setFont('times', 'bold italic');
    doc.setFontSize(22);
    doc.text(formData.studentName, centerX, 88, { align: 'center' });
    doc.line(centerX - 70, 90, centerX + 70, 90);

    // Etiqueta pequeña bajo el nombre
    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.text('nombre y apellidos del estudiante', centerX, 95, { align: 'center' });

    // 6. ID Estudiante e Inscripción
    doc.setFontSize(12);
    doc.text(
      `ID de estudiante No. ${formData.rne} Inscrito(a) en el Centro Educativo`,
      centerX,
      108,
      { align: 'center' }
    );

    // Nombre del Centro (Solo nombre, en negrita y agrandado)
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.text(formData.schoolName, centerX, 116, { align: 'center' });

    // 7. Código, Tanda y Sección (Agrandado)
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.text(
      `Código del centro educativo: ${formData.centerCode} ,  Tanda / Sección: ${formData.tanda} / ${formData.section}`,
      centerX,
      126,
      { align: 'center' }
    );

    // 8. Párrafo de Aprobación (Espaciado mejorado)
    doc.setFontSize(12);
    doc.text(
      `Distrito Educativo No: ${formData.district} de: ${formData.municipality}, Regional No.: ${formData.regional} de: ${formData.municipality}`,
      centerX,
      138,
      { align: 'center' }
    );
    doc.text(
      'quien cursó y aprobó los estudios correspondientes al 6to. grado del Nivel Primario,',
      centerX,
      145,
      { align: 'center' }
    );
    doc.text(`en el año académico ${formData.schoolYear}`, centerX, 152, { align: 'center' });

    // 9. Mensaje Final Formateado exactamente como se solicitó
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.text(
      `Se expide la presente Certificación en _____${formData.municipality}______, República Dominicana, a los ${formData.issueDay}`,
      centerX,
      168,
      { align: 'center' }
    );
    doc.text(
      `días del mes de ${formData.issueMonth} del año______${formData.issueYear}______.`,
      centerX,
      175,
      { align: 'center' }
    );

    // Firmas
    const footerY = 220;

    // Firma Director Centro (Izquierda)
    doc.line(25, footerY, 90, footerY);
    doc.setFontSize(9);
    doc.setFont('times', 'bold');
    doc.text(formData.directorName, 57.5, footerY + 5, { align: 'center' });
    doc.setFont('times', 'normal');
    doc.text('Director (a) del Centro Educativo', 57.5, footerY + 10, { align: 'center' });
    doc.text('(Sello y Firma)', 57.5, footerY + 15, { align: 'center' });

    // Firma Encargado Certificaciones (Centro)
    doc.line(125, footerY, 190, footerY);
    doc.setFont('times', 'bold');
    doc.text(formData.certificationOfficerName, 157.5, footerY + 5, { align: 'center' });
    doc.setFont('times', 'normal');
    doc.text('Encargado (a) de Certificaciones', 157.5, footerY + 10, { align: 'center' });
    doc.text('del Distrito Educativo', 157.5, footerY + 15, { align: 'center' });

    // Firma Directora Distrital (Abajo Centro)
    doc.line(centerX - 35, footerY + 35, centerX + 35, footerY + 35);
    doc.setFont('times', 'bold');
    doc.text(formData.districtDirectorName, centerX, footerY + 40, { align: 'center' });
    doc.setFont('times', 'normal');
    doc.text(
      `Directora del Distrito Educativo ${formData.district}, ${formData.municipality}`,
      centerX,
      footerY + 45,
      { align: 'center' }
    );

    doc.save(`Certificacion_6to_${formData.studentName.replace(/ /g, '_')}.pdf`);
    setIsGenerating(false);
  };

  if (isLoading) {
    return (
      <div className="p-20 flex flex-col items-center justify-center gap-4 bg-white rounded-[2rem] shadow-2xl">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-black uppercase text-xs tracking-widest">
          Preparando certificación...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="p-6 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-2xl">
            <ScrollText size={24} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight">
              Configurar Certificación
            </h3>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              Nivel Primario - 6to Grado
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="p-8 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Editor Form */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-indigo-600 mb-2">
            <Edit3 size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Datos del Documento
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5">
            {/* Alumno Section */}
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                  <User size={14} />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Información del Estudiante
                </span>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                  Nombre completo del Alumno
                </label>
                <input
                  type="text"
                  value={formData.studentName}
                  onChange={(e) =>
                    setFormData({ ...formData, studentName: e.target.value.toUpperCase() })
                  }
                  className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl font-black text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="NOMBRE APELLIDO APELLIDO"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                    Código del SIGERD
                  </label>
                  <input
                    type="text"
                    value={formData.rne}
                    onChange={(e) =>
                      setFormData({ ...formData, rne: e.target.value.toUpperCase() })
                    }
                    className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl font-black text-sm text-slate-700"
                    placeholder="RNE12345"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                    Año Académico
                  </label>
                  <input
                    type="text"
                    value={formData.schoolYear}
                    onChange={(e) => setFormData({ ...formData, schoolYear: e.target.value })}
                    className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl font-black text-sm text-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* Centro Section */}
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                  <Building2 size={14} />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Información del Centro
                </span>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                  Nombre del Centro Educativo
                </label>
                <input
                  type="text"
                  value={formData.schoolName}
                  onChange={(e) =>
                    setFormData({ ...formData, schoolName: e.target.value.toUpperCase() })
                  }
                  className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl font-black text-sm text-slate-700"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                    Código
                  </label>
                  <input
                    type="text"
                    value={formData.centerCode}
                    onChange={(e) => setFormData({ ...formData, centerCode: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs text-slate-700"
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                    Tanda
                  </label>
                  <input
                    type="text"
                    value={formData.tanda}
                    onChange={(e) => setFormData({ ...formData, tanda: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs text-slate-700"
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                    Sección
                  </label>
                  <input
                    type="text"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs text-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* Fecha de Expedición Section */}
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center">
                  <Calendar size={14} />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Fecha de Expedición
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                    Día
                  </label>
                  <input
                    type="text"
                    value={formData.issueDay}
                    onChange={(e) => setFormData({ ...formData, issueDay: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs text-slate-700 text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                    Mes
                  </label>
                  <input
                    type="text"
                    value={formData.issueMonth}
                    onChange={(e) => setFormData({ ...formData, issueMonth: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs text-slate-700 text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                    Año
                  </label>
                  <input
                    type="text"
                    value={formData.issueYear}
                    onChange={(e) => setFormData({ ...formData, issueYear: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs text-slate-700 text-center"
                  />
                </div>
              </div>
            </div>

            {/* Autoridades Section */}
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                  <ShieldCheck size={14} />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Autoridades Firmantes
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                    Director(a) del Centro
                  </label>
                  <input
                    type="text"
                    value={formData.directorName}
                    onChange={(e) => setFormData({ ...formData, directorName: e.target.value })}
                    className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs text-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                    Encargado(a) de Certificaciones (Distrito)
                  </label>
                  <input
                    type="text"
                    value={formData.certificationOfficerName}
                    onChange={(e) =>
                      setFormData({ ...formData, certificationOfficerName: e.target.value })
                    }
                    className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs text-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                    Director(a) Distrital
                  </label>
                  <input
                    type="text"
                    value={formData.districtDirectorName}
                    onChange={(e) =>
                      setFormData({ ...formData, districtDirectorName: e.target.value })
                    }
                    className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs text-slate-700"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button
              onClick={generatePDF}
              disabled={isGenerating}
              className="flex-1 flex items-center justify-center gap-3 px-8 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : <Printer size={18} />}
              Descargar Certificación PDF
            </button>
          </div>
        </div>

        {/* Preview Card */}
        <div className="bg-slate-50 rounded-[3rem] p-8 border border-slate-100 flex flex-col items-center justify-center relative group overflow-hidden">
          <div className="absolute inset-0 bg-indigo-600 opacity-0 group-hover:opacity-[0.02] transition-opacity pointer-events-none rounded-[3rem]"></div>

          <div className="w-full max-w-[360px] aspect-[1/1.41] bg-white shadow-2xl border border-slate-200 rounded-lg p-7 flex flex-col items-center text-center scale-95 group-hover:scale-100 transition-transform duration-500 overflow-y-auto relative custom-scrollbar">
            {/* Header Logo */}
            <img
              src="/Logo_del_Ministerio_de_Educación_(República_Dominicana).svg.png"
              alt="Logo MINERD"
              className="w-20 mb-3 grayscale group-hover:grayscale-0 transition-all"
            />

            <p className="text-[7px] font-bold text-slate-500 uppercase tracking-tighter mb-1">
              Distrito Educativo: {formData.district} | Regional: {formData.regional}
            </p>
            <p className="text-[7px] font-bold text-slate-500 uppercase tracking-tighter mb-4">
              Centro Educativo: {formData.schoolName}
            </p>

            <p className="text-[11px] font-black uppercase text-slate-900 leading-tight mb-8">
              CERTIFICACIÓN DE CONCLUSIÓN DEL NIVEL PRIMARIO
            </p>

            <div className="w-full px-2 mb-2">
              <p className="text-[14px] font-black text-indigo-600 uppercase italic leading-none truncate">
                {formData.studentName || 'NOMBRE DEL ALUMNO'}
              </p>
              <div className="w-full h-[0.75px] bg-slate-400 mt-1"></div>
              <p className="text-[6px] text-slate-400 mt-1 uppercase tracking-wider">
                nombre y apellidos del estudiante
              </p>
            </div>

            <div className="mt-4 space-y-1">
              <p className="text-[7px] text-slate-600">
                ID de estudiante No. <span className="font-bold">{formData.rne || '_______'}</span>
              </p>
              <p className="text-[7px] text-slate-600">Inscrito(a) en el Centro Educativo</p>
              <p className="text-[9px] font-black text-slate-900 uppercase tracking-wide">
                {formData.schoolName}
              </p>
            </div>

            <div className="mt-4 px-2">
              <p className="text-[7px] text-slate-500 leading-relaxed">
                Código del centro educativo: {formData.centerCode} , Tanda / Sección:{' '}
                {formData.tanda} / {formData.section}
              </p>
            </div>

            <div className="mt-4 px-4 space-y-1">
              <p className="text-[7px] text-slate-500 text-center leading-[10px]">
                Distrito Educativo No: {formData.district} de: {formData.municipality}, Regional
                No.: {formData.regional} de: {formData.municipality} quien cursó y aprobó los
                estudios correspondientes al 6to. grado del Nivel Primario, en el año académico{' '}
                {formData.schoolYear}
              </p>
            </div>

            <div className="mt-6 px-3">
              <p className="text-[7px] text-slate-600 text-center leading-[11px] italic">
                Se expide la presente Certificación en _____{formData.municipality}______, República
                Dominicana, a los {formData.issueDay} días del mes de {formData.issueMonth} del
                año______{formData.issueYear}______.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full mt-auto pt-10">
              <div className="border-t border-slate-200 pt-1">
                <p className="text-[4px] font-black text-slate-800 truncate">
                  {formData.directorName || 'Director(a)'}
                </p>
                <p className="text-[3px] text-slate-400 uppercase">Director Centro</p>
              </div>
              <div className="border-t border-slate-200 pt-1">
                <p className="text-[4px] font-black text-slate-800 truncate">
                  {formData.districtDirectorName || 'Distrital'}
                </p>
                <p className="text-[3px] text-slate-400 uppercase">Director Distrital</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-6 text-slate-400">
            <div className="flex flex-col items-center gap-1.5">
              <CheckCircle2 size={18} className="text-emerald-500" />
              <span className="text-[8px] font-black uppercase tracking-widest">Validado</span>
            </div>
            <div className="w-px h-10 bg-slate-200"></div>
            <div className="flex flex-col items-center gap-1.5">
              <ShieldCheck size={18} className="text-indigo-500" />
              <span className="text-[8px] font-black uppercase tracking-widest">Oficial</span>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Area */}
      <div className="bg-amber-50 p-6 flex items-center gap-5 border-t border-amber-100 flex-shrink-0">
        <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/20">
          <ShieldCheck size={20} />
        </div>
        <div>
          <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">
            Aviso de Seguridad
          </p>
          <p className="text-[9px] font-bold text-amber-700/80 leading-relaxed max-w-2xl">
            Asegúrese de que el nombre coincida exactamente con el acta de nacimiento. Una vez
            impreso, este documento tiene validez oficial ante el MINERD.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrimaryCertificate;
