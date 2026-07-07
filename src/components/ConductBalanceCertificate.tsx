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
  Building2,
  CheckSquare,
  Square
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dataService } from '../services/dataService';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';

interface ConductBalanceCertificateProps {
  studentId: string;
  onClose: () => void;
}

const ConductBalanceCertificate: React.FC<ConductBalanceCertificateProps> = ({
  studentId,
  onClose
}) => {
  const { state, center, profile, selectedYear } = useApp();
  const [isLoading, setIsLoading] = useState(true);

  // Datos editables
  const [formData, setFormData] = useState({
    studentName: '',
    rne: '',
    courseName: '',
    schoolYear: selectedYear || '2025-2026',
    tutorName: '',

    // Conducta
    conduct: 'Excelente' as 'Excelente' | 'Muy Buena' | 'Buena' | 'Regular',
    observations:
      'El estudiante ha demostrado respeto hacia sus compañeros, docentes y personal administrativo, manteniendo una actitud responsable, participativa y acorde con los valores cristianos promovidos por la institución.',

    // Saldo
    balanceStatus: 'al-dia' as 'al-dia' | 'pendiente',
    balanceAmount: '',
    balanceConcept: 'No aplica.',

    // Fechas y Lugar
    issuePlace: 'Santo Domingo, República Dominicana',
    issueDay: '',
    issueMonth: '',
    issueYear: '',

    // Firmantes
    directorName: '',
    directorTitle: 'Directora General',
    adminName: '',
    adminTitle: 'Encargada de Administración y Caja',

    // Cotización
    enrollmentFee: '',
    monthlyFee: '',
    monthsCount: '10'
  });

  const [certificateType, setCertificateType] = useState<'conduct-balance' | 'quote'>('conduct-balance');

  useEffect(() => {
    const loadData = async () => {
      // 1. Obtener datos base del centro
      const centerData =
        center || (profile?.center_id ? await dataService.getCenter(profile.center_id) : null);

      const today = new Date();
      const currentYear = today.getFullYear().toString();
      const currentMonth = today.toLocaleString('es-DO', { month: 'long' });
      const currentDay = today.getDate().toString();

      const defaultAdminName =
        state.teachers?.find(
          (t) =>
            t.role === 'management' ||
            t.role === 'management_teacher' ||
            t.role === 'administrative'
        )?.name || 'Lic. Karina Gómez';

      const baseData = {
        issuePlace: centerData?.municipality
          ? `${centerData.municipality}, República Dominicana`
          : 'Santo Domingo, República Dominicana',
        issueDay: currentDay,
        issueMonth: currentMonth,
        issueYear: currentYear,
        directorName: centerData?.director_name || '',
        directorTitle: centerData?.director_sex === 'M' ? 'Director General' : 'Directora General',
        adminName: defaultAdminName,
        adminTitle: 'Encargada de Administración y Caja'
      };

      if (!studentId) {
        setFormData((prev) => ({ ...prev, ...baseData }));
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // 2. Obtener datos del estudiante y tutor
        const student = await dataService.getFullStudent(studentId);
        const course = state.courses.find((c) => c.id === student.course_id);

        let parentsName = '';
        if (student.family && student.family.length > 0) {
          const parents = student.family.filter(
            (f: any) =>
              f.relation?.toLowerCase().includes('madre') ||
              f.relation?.toLowerCase().includes('padre')
          );
          if (parents.length > 0) {
            parentsName = parents.map((p: any) => p.name).join(' y ');
          } else {
            parentsName = student.family[0].name;
          }
        }

        const courseDisplay = course
          ? `${course.grade} de ${course.level?.toLowerCase().includes('prim') ? 'Primaria' : course.level?.toLowerCase().includes('sec') ? 'Secundaria' : course.level}`
          : '';

        let defaultEnrollment = '';
        let defaultMonthly = '';
        let defaultMonths = '10';

        if (student.course_id) {
          const { data: planData } = await supabase
            .from('finance_payment_plans')
            .select('*')
            .eq('course_id', student.course_id)
            .maybeSingle();

          if (planData) {
            defaultEnrollment = String(planData.enrollment_fee || '');
            defaultMonthly = String(planData.monthly_fee || '');
            defaultMonths = String(planData.months_count || '10');
          }
        }

        setFormData((prev) => ({
          ...prev,
          ...baseData,
          studentName:
            `${student.names || ''} ${student.first_surname || ''} ${student.second_surname || ''}`.trim(),
          rne: student.sigerd_code || student.student_code || student.rne || '',
          courseName: courseDisplay,
          tutorName: parentsName,
          enrollmentFee: defaultEnrollment,
          monthlyFee: defaultMonthly,
          monthsCount: defaultMonths
        }));
      } catch (error) {
        console.error('Error loading certificate data:', error);
        setFormData((prev) => ({ ...prev, ...baseData }));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [studentId, center, state.courses, profile, selectedYear, state.teachers]);

  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });

      const centerX = 107.95; // Centro de Letter (215.9mm / 2)

      // 1. Logo (Para darle formalidad)
      const logoUrl = center?.logo_url;
      try {
        if (logoUrl) {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.src = logoUrl;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          doc.addImage(img, 'PNG', centerX - 15, 12, 30, 30);
        } else {
          doc.addImage('/Edugest2.png', 'PNG', centerX - 15, 12, 30, 30);
        }
      } catch (e) {
        // Fallback silencioso
      }

      // 2. Encabezado del Centro
      doc.setFont('times', 'bold');
      doc.setFontSize(16);
      const safeCenterName = centerDisplay.name
        ? centerDisplay.name.toUpperCase()
        : 'CENTRO EDUCATIVO';
      doc.text(safeCenterName, centerX, 50, { align: 'center' });

      doc.setFont('times', 'normal');
      doc.setFontSize(11);
      doc.text(`Código: ${centerDisplay.code} | Tel: ${centerDisplay.phone}`, centerX, 57, {
        align: 'center'
      });
      doc.text(`Dirección: ${centerDisplay.address}`, centerX, 63, { align: 'center' });

      doc.setLineWidth(0.5);
      doc.line(20, 68, 195.9, 68);

      // 3. Título del Documento
      doc.setFont('times', 'bold');
      doc.setFontSize(14);

      if (certificateType === 'conduct-balance') {
        doc.text('CERTIFICACIÓN DE CONDUCTA Y SALDO', centerX, 80, { align: 'center' });

        // 4. Párrafo Introductorio
        doc.setFont('times', 'normal');
        doc.setFontSize(12);

        const introText = `Quien suscribe, ${formData.directorName}, en calidad de ${formData.directorTitle} del ${centerDisplay.name}, certifica que el estudiante:`;
        const splitIntro = doc.splitTextToSize(introText, 175);
        doc.text(splitIntro, 20, 95);

        // 5. Datos del Estudiante (Párrafo fluido)
        const studentDataText = `${formData.studentName}, Código del Sigerd No.: ${formData.rne} del Grado ${formData.courseName}, Año Escolar: ${formData.schoolYear}. Hijo(a) de los señores: ${formData.tutorName}.`;
        const splitStudentData = doc.splitTextToSize(studentDataText, 175);
        doc.text(splitStudentData, 20, 105);

        // Calculamos la siguiente posición Y dinámicamente
        const studentLines = splitStudentData.length;
        let currentY = 105 + studentLines * 7 + 5;

        // 6. Conducta
        doc.setFont('times', 'bold');
        doc.text('CONDUCTA:', 20, currentY);

        doc.setFont('times', 'normal');
        doc.text(`Calificación: ${formData.conduct}`, 25, currentY + 8);

        doc.setFont('times', 'bold');
        doc.text('Observaciones:', 25, currentY + 15);
        doc.setFont('times', 'normal');
        const splitObs = doc.splitTextToSize(formData.observations, 165);
        doc.text(splitObs, 25, currentY + 22);

        // Calcular nueva Y basada en las observaciones
        const obsLines = splitObs.length;
        const nextY = currentY + 22 + obsLines * 7 + 5;

        // 7. Estado de Saldo
        doc.setFont('times', 'bold');
        doc.text('ESTADO DE SALDO:', 20, nextY);

        doc.setFont('times', 'normal');
        if (formData.balanceStatus === 'al-dia') {
          doc.text('Se encuentra al día con sus compromisos económicos.', 25, nextY + 8);
        } else {
          doc.text(`Presenta un balance pendiente de: RD$ ${formData.balanceAmount}`, 25, nextY + 8);
          doc.text(`Concepto: ${formData.balanceConcept}`, 25, nextY + 15);
        }

        // 8. Párrafo Final
        const issueY = nextY + (formData.balanceStatus === 'al-dia' ? 25 : 30);
        const issueText = `La presente certificación se expide a solicitud de la parte interesada, en la ciudad de ${formData.issuePlace}, a los ${formData.issueDay} días del mes de ${formData.issueMonth} del año ${formData.issueYear}.`;
        const splitIssue = doc.splitTextToSize(issueText, 175);
        doc.text(splitIssue, 20, issueY);
      } else {
        doc.text('COTIZACIÓN DE AÑO ESCOLAR', centerX, 80, { align: 'center' });

        // 4. Párrafo Introductorio
        doc.setFont('times', 'normal');
        doc.setFontSize(12);

        const introText = `Quien suscribe, ${formData.directorName}, en calidad de ${formData.directorTitle} del ${centerDisplay.name}, hace constar la cotización correspondiente al Año Escolar ${formData.schoolYear} para el estudiante:`;
        const splitIntro = doc.splitTextToSize(introText, 175);
        doc.text(splitIntro, 20, 95);

        // 5. Datos del Estudiante
        const studentDataText = `${formData.studentName}, del Grado ${formData.courseName}. Hijo(a) de los señores: ${formData.tutorName}.`;
        const splitStudentData = doc.splitTextToSize(studentDataText, 175);
        doc.text(splitStudentData, 20, 105);

        const studentLines = splitStudentData.length;
        let currentY = 105 + studentLines * 7 + 5;

        // 6. Detalle de Costos
        doc.setFont('times', 'bold');
        doc.text('DETALLE DE COSTOS DEL AÑO ESCOLAR:', 20, currentY);

        doc.setFont('times', 'normal');
        let itemY = currentY + 10;
        
        doc.setFont('times', 'bold');
        doc.text('Concepto', 25, itemY);
        doc.text('Monto', 150, itemY, { align: 'right' });
        doc.setLineWidth(0.2);
        doc.line(20, itemY + 2, 195.9, itemY + 2);
        
        itemY += 10;
        doc.setFont('times', 'normal');
        doc.text('Inscripción / Matrícula (Pago Único)', 25, itemY);
        doc.text(`RD$ ${Number(formData.enrollmentFee || 0).toLocaleString()}`, 150, itemY, { align: 'right' });

        itemY += 8;
        const totalMonthly = Number(formData.monthlyFee || 0) * Number(formData.monthsCount || 0);
        doc.text(`Mensualidades colegiatura (${formData.monthsCount} cuotas de RD$ ${Number(formData.monthlyFee || 0).toLocaleString()})`, 25, itemY);
        doc.text(`RD$ ${totalMonthly.toLocaleString()}`, 150, itemY, { align: 'right' });

        itemY += 4;
        doc.line(20, itemY, 195.9, itemY);

        itemY += 8;
        doc.setFont('times', 'bold');
        doc.text('VALOR TOTAL DEL AÑO ESCOLAR:', 25, itemY);
        const grandTotal = Number(formData.enrollmentFee || 0) + totalMonthly;
        doc.text(`RD$ ${grandTotal.toLocaleString()}`, 150, itemY, { align: 'right' });

        const issueY = itemY + 25;
        const issueText = `La presente cotización se expide a solicitud de la parte interesada, en la ciudad de ${formData.issuePlace}, a los ${formData.issueDay} días del mes de ${formData.issueMonth} del año ${formData.issueYear}.`;
        const splitIssue = doc.splitTextToSize(issueText, 175);
        doc.text(splitIssue, 20, issueY);
      }

      // 9. Firmas
      const sigY = 240;
      doc.setLineWidth(0.5);

      // Firma Director
      doc.line(30, sigY, 90, sigY);
      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.text(formData.directorName, 60, sigY + 5, { align: 'center' });
      doc.setFont('times', 'normal');
      doc.text(formData.directorTitle, 60, sigY + 10, { align: 'center' });

      // Firma Admin
      doc.line(125, sigY, 185, sigY);
      doc.setFont('times', 'bold');
      doc.text(formData.adminName, 155, sigY + 5, { align: 'center' });
      doc.setFont('times', 'normal');
      doc.text(formData.adminTitle, 155, sigY + 10, { align: 'center' });

      doc.save(
        `Certificacion_${certificateType === 'conduct-balance' ? 'Conducta_Saldo' : 'Cotizacion_Escolar'}_${formData.studentName ? formData.studentName.replace(/\s+/g, '_') : 'Estudiante'}.pdf`
      );
    } catch (error: any) {
      console.error('Error generando PDF:', error);
      alert(`Hubo un error al generar el PDF: ${error?.message || error}`);
    } finally {
      setIsGenerating(false);
    }
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

  const centerDisplay = {
    name: center?.name || 'CENTRO EDUCATIVO',
    code: center?.center_code || center?.code || '',
    address: center?.address || '',
    phone: center?.phone || '',
    email: center?.email || ''
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col print:h-screen print:max-h-screen print:rounded-none print:shadow-none print:border-none">
      {/* Estilos para impresión */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            background: white;
            color: black;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: letter;
            margin: 0;
          }
        }
      `}</style>

      {/* Header (No imprimible) */}
      <div className="p-6 bg-slate-900 text-white flex items-center justify-between flex-shrink-0 no-print">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-2xl">
            <ScrollText size={24} className="text-teal-400" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight">
              Certificaciones / Cotizaciones
            </h3>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              {certificateType === 'conduct-balance' ? 'Conducta y Saldo' : 'Cotización de Año Escolar'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleDownload}
            disabled={isGenerating}
            className={`flex items-center justify-center gap-2 px-6 py-3 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md ${isGenerating ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-900/20'}`}
          >
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {isGenerating ? 'Generando...' : 'Descargar PDF'}
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Editor Form (No imprimible) */}
        <div className="w-1/2 p-8 overflow-y-auto bg-slate-50 border-r border-slate-100 no-print custom-scrollbar">
          <div className="space-y-6 max-w-lg mx-auto">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-4">
              <button
                type="button"
                onClick={() => setCertificateType('conduct-balance')}
                className={`flex-1 py-2 text-center font-black text-[10px] uppercase tracking-wider rounded-xl transition-all ${certificateType === 'conduct-balance' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Conducta y Saldo
              </button>
              <button
                type="button"
                onClick={() => setCertificateType('quote')}
                className={`flex-1 py-2 text-center font-black text-[10px] uppercase tracking-wider rounded-xl transition-all ${certificateType === 'quote' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Cotización de Año
              </button>
            </div>

            <div className="flex items-center gap-2 text-indigo-600 mb-2">
              <Edit3 size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Datos del Documento
              </span>
            </div>

            <div className="grid grid-cols-1 gap-5">
              {certificateType === 'conduct-balance' ? (
                <>
              {/* Conducta Section */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                    <CheckCircle2 size={14} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Conducta
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {['Excelente', 'Muy Buena', 'Buena', 'Regular'].map((c) => (
                    <label key={c} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="conduct"
                        value={c}
                        checked={formData.conduct === c}
                        onChange={(e) =>
                          setFormData({ ...formData, conduct: e.target.value as any })
                        }
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-bold text-slate-700">{c}</span>
                    </label>
                  ))}
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                    Observaciones
                  </label>
                  <textarea
                    value={formData.observations}
                    onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24 resize-none"
                  />
                </div>
              </div>

              {/* Saldo Section */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                    <ShieldCheck size={14} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Estado de Saldo
                  </span>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="balanceStatus"
                      value="al-dia"
                      checked={formData.balanceStatus === 'al-dia'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          balanceStatus: 'al-dia',
                          balanceConcept: 'No aplica.',
                          balanceAmount: ''
                        })
                      }
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-slate-700">
                      Se encuentra al día con sus compromisos económicos.
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="balanceStatus"
                      value="pendiente"
                      checked={formData.balanceStatus === 'pendiente'}
                      onChange={(e) =>
                        setFormData({ ...formData, balanceStatus: 'pendiente', balanceConcept: '' })
                      }
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-slate-700">
                      Presenta un balance pendiente.
                    </span>
                  </label>
                </div>

                {formData.balanceStatus === 'pendiente' && (
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                        Monto (RD$)
                      </label>
                      <input
                        type="text"
                        value={formData.balanceAmount}
                        onChange={(e) =>
                          setFormData({ ...formData, balanceAmount: e.target.value })
                        }
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700"
                        placeholder="Ej. 15,000"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                        Concepto
                      </label>
                      <input
                        type="text"
                        value={formData.balanceConcept}
                        onChange={(e) =>
                          setFormData({ ...formData, balanceConcept: e.target.value })
                        }
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700"
                        placeholder="Mensualidad Abril..."
                      />
                    </div>
                  </div>
                )}
              </div>
              </>
            ) : (
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                    <ScrollText size={14} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Costos de Cotización
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                      Costo de Inscripción (RD$)
                    </label>
                    <input
                      type="number"
                      value={formData.enrollmentFee}
                      onChange={(e) => setFormData({ ...formData, enrollmentFee: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                        Cuota Mensual (RD$)
                      </label>
                      <input
                        type="number"
                        value={formData.monthlyFee}
                        onChange={(e) => setFormData({ ...formData, monthlyFee: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                        Cant. de Cuotas
                      </label>
                      <input
                        type="number"
                        value={formData.monthsCount}
                        onChange={(e) => setFormData({ ...formData, monthsCount: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

              {/* Autoridades Section */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                    <User size={14} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Firmantes
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                      Nombre Director/a
                    </label>
                    <input
                      type="text"
                      value={formData.directorName}
                      onChange={(e) => setFormData({ ...formData, directorName: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                      Cargo
                    </label>
                    <input
                      type="text"
                      value={formData.directorTitle}
                      onChange={(e) => setFormData({ ...formData, directorTitle: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                      Nombre Adm./Caja
                    </label>
                    <input
                      type="text"
                      value={formData.adminName}
                      onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                      Cargo
                    </label>
                    <input
                      type="text"
                      value={formData.adminTitle}
                      onChange={(e) => setFormData({ ...formData, adminTitle: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Area (Imprimible) */}
        <div className="w-1/2 p-8 overflow-y-auto bg-slate-200/50 flex items-start justify-center custom-scrollbar">
          <div
            id="print-area"
            className="w-full max-w-[816px] min-h-[1056px] bg-[#ffffff] shadow-2xl p-16 flex flex-col font-serif relative text-[#000000]"
          >
            {/* Header Centro */}
            <div className="text-center mb-8 pb-8 border-b-2 border-[#000000]">
              <h1 className="text-2xl font-bold uppercase mb-4 tracking-wide">
                {centerDisplay.name}
              </h1>
              <div className="text-sm space-y-1">
                <p>Código del Centro: {centerDisplay.code}</p>
                <p>Dirección: {centerDisplay.address}</p>
                <p>Teléfono: {centerDisplay.phone}</p>
                <p>Correo Electrónico: {centerDisplay.email}</p>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-center uppercase tracking-widest mb-10">
              {certificateType === 'conduct-balance' ? 'Certificación' : 'Cotización de Año Escolar'}
            </h2>

            <p className="text-justify text-[15px] leading-loose mb-8">
              Quien suscribe, <strong>{formData.directorName}</strong>, en calidad de{' '}
              {formData.directorTitle} del {centerDisplay.name}, {certificateType === 'conduct-balance' ? 'certifica que el estudiante:' : 'hace constar la cotización correspondiente al Año Escolar ' + formData.schoolYear + ' para el estudiante:'}
            </p>

            {/* Datos del Estudiante */}
            <div className="mb-8 mt-2">
              <p className="text-justify text-[15px] leading-loose">
                {certificateType === 'conduct-balance' ? (
                  <>
                    <strong>{formData.studentName}</strong>, Código del Sigerd No.:{' '}
                    <strong>{formData.rne}</strong> del Grado <strong>{formData.courseName}</strong>,
                    Año Escolar: <strong>{formData.schoolYear}</strong>. Hijo(a) de los señores:{' '}
                    <strong>{formData.tutorName}</strong>.
                  </>
                ) : (
                  <>
                    <strong>{formData.studentName}</strong>, del Grado <strong>{formData.courseName}</strong>. Hijo(a) de los señores:{' '}
                    <strong>{formData.tutorName}</strong>.
                  </>
                )}
              </p>
            </div>

            {certificateType === 'conduct-balance' ? (
              <>
                <div className="mb-8 border-t border-[#d1d5db] pt-8">
                  <h3 className="font-bold uppercase tracking-widest mb-4 border-b border-[#d1d5db] pb-1">
                    Conducta
                  </h3>
                  <p className="text-[15px] mb-4">
                    Durante su permanencia en esta institución, el estudiante ha mantenido una conducta:
                  </p>

                  <div className="space-y-2 ml-4 mb-6">
                    {['Excelente', 'Muy Buena', 'Buena', 'Regular'].map((c) => (
                      <div key={c} className="flex items-center gap-3">
                        {formData.conduct === c ? <CheckSquare size={16} /> : <Square size={16} />}
                        <span className="text-[15px]">{c}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-[15px] mb-1 font-bold">Observaciones sobre la conducta:</p>
                  <p className="text-[15px] leading-relaxed text-justify">{formData.observations}</p>
                </div>

                <div className="mb-10 border-t border-[#d1d5db] pt-8">
                  <h3 className="font-bold uppercase tracking-widest mb-4 border-b border-[#d1d5db] pb-1">
                    Estado de Saldo
                  </h3>
                  <p className="text-[15px] mb-4">
                    Luego de revisar los registros administrativos y financieros del centro, hacemos
                    constar que el estudiante:
                  </p>

                  <div className="space-y-4 ml-4 mb-6">
                    <div className="flex items-center gap-3">
                      {formData.balanceStatus === 'al-dia' ? (
                        <CheckSquare size={16} />
                      ) : (
                        <Square size={16} />
                      )}
                      <span className="text-[15px]">
                        Se encuentra al día con sus compromisos económicos.
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {formData.balanceStatus === 'pendiente' ? (
                        <CheckSquare size={16} />
                      ) : (
                        <Square size={16} />
                      )}
                      <span className="text-[15px]">
                        Presenta un balance pendiente de:{' '}
                        <strong>
                          {formData.balanceStatus === 'pendiente' && formData.balanceAmount
                            ? `RD$ ${formData.balanceAmount}`
                            : '_______________________'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <p className="text-[15px] mb-1 font-bold">Concepto(s):</p>
                  <p className="text-[15px]">{formData.balanceConcept}</p>
                </div>
              </>
            ) : (
              <div className="mb-10 border-t border-[#d1d5db] pt-8 space-y-6">
                <h3 className="font-bold uppercase tracking-widest mb-4 border-b border-[#d1d5db] pb-1">
                  Detalle de Costos del Año Escolar
                </h3>
                <div className="w-full border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-[14px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <th className="px-6 py-4">Concepto</th>
                        <th className="px-6 py-4 text-right">Monto (RD$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      <tr>
                        <td className="px-6 py-4">Inscripción / Matrícula (Pago Único)</td>
                        <td className="px-6 py-4 text-right font-bold">
                          RD$ {Number(formData.enrollmentFee || 0).toLocaleString()}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4">
                          Mensualidades colegiatura ({formData.monthsCount} cuotas de RD$ {Number(formData.monthlyFee || 0).toLocaleString()})
                        </td>
                        <td className="px-6 py-4 text-right font-bold">
                          RD$ {(Number(formData.monthlyFee || 0) * Number(formData.monthsCount || 0)).toLocaleString()}
                        </td>
                      </tr>
                      <tr className="bg-slate-50/50 font-black text-slate-900 border-t-2 border-slate-200">
                        <td className="px-6 py-4 uppercase">VALOR TOTAL DEL AÑO ESCOLAR</td>
                        <td className="px-6 py-4 text-right text-indigo-600 text-base">
                          RD$ {(Number(formData.enrollmentFee || 0) + (Number(formData.monthlyFee || 0) * Number(formData.monthsCount || 0))).toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <p className="text-justify text-[15px] leading-loose mb-16">
              La presente {certificateType === 'conduct-balance' ? 'certificación' : 'cotización'} se expide a solicitud de la parte interesada, en la ciudad
              de {formData.issuePlace}, a los {formData.issueDay} días del mes de{' '}
              {formData.issueMonth} del año {formData.issueYear}.
            </p>

            {/* Firmas */}
            <div className="mt-auto pt-10">
              <div className="grid grid-cols-2 gap-16 text-center">
                <div>
                  <div className="border-b border-[#000000] mb-2 mx-4 h-12 flex items-end justify-center pb-1">
                    <span className="font-bold">{formData.directorName}</span>
                  </div>
                  <p className="text-sm font-bold uppercase">{formData.directorTitle}</p>
                </div>
                <div>
                  <div className="border-b border-[#000000] mb-2 mx-4 h-12 flex items-end justify-center pb-1">
                    <span className="font-bold">{formData.adminName}</span>
                  </div>
                  <p className="text-sm font-bold uppercase">{formData.adminTitle}</p>
                </div>
              </div>

              <div className="mt-16 text-center">
                <div className="w-32 h-32 border-2 border-dashed border-[#9ca3af] rounded-full mx-auto flex items-center justify-center mb-2">
                  <span className="text-xs text-[#9ca3af] font-bold uppercase tracking-widest text-center px-4 leading-relaxed">
                    Sello Institucional
                  </span>
                </div>
                <p className="text-xs text-[#6b7280] uppercase tracking-widest">
                  Sello del Centro Educativo
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConductBalanceCertificate;
