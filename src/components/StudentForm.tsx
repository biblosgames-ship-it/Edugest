import React, { useState, useEffect } from 'react';
import {
  User,
  Users,
  HeartPulse,
  GraduationCap,
  ClipboardCheck,
  Save,
  Plus,
  X,
  Phone,
  IdCard,
  MapPin,
  Briefcase,
  Pencil,
  Printer,
  ChevronRight,
  ChevronLeft,
  ShieldAlert,
  Search as SearchIcon,
  Link as LinkIcon
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useSupabase } from '../context/AppContext';
import { dataService } from '../services/dataService';
import { generateStudentPDF } from '../utils/pdfGenerator';
import { format, differenceInYears } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { sortCourses } from '../utils/courseSorter';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';


interface StudentFormProps {
  gradeId?: string;
  studentId?: string;
  initialData?: any;
  siblingSource?: any;
  onSave?: () => void;
}

export const StudentForm = ({
  gradeId,
  studentId,
  initialData,
  siblingSource,
  onSave
}: StudentFormProps) => {
  const { state, selectedYear, refreshData } = useApp() as any;
  const { profile } = useSupabase();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingFull, setIsLoadingFull] = useState(false);
  const [customSchoolYear, setCustomSchoolYear] = useState(
    initialData?.school_year || selectedYear || '2025-2026'
  );
  const [canEditSchoolYear, setCanEditSchoolYear] = useState(false);

  // ESTADO MAESTRO
  const [selectedGradeId, setSelectedGradeId] = useState(gradeId || initialData?.course_id || '');
  const selectedCourse = state.courses.find((c: any) => c.id === selectedGradeId);

  const [student, setStudent] = useState({
    firstSurname: initialData?.first_surname || '',
    secondSurname: initialData?.second_surname || '',
    names: initialData?.names || initialData?.first_name || '',
    sex: initialData?.sex || 'M',
    birthDate: initialData?.birth_date || '',
    placeOfBirth: initialData?.place_of_birth || '',
    nationality: initialData?.nationality || 'Dominicana',
    birthCertificateFolio: initialData?.birth_certificate_folio || '',
    idCard: initialData?.id_card || '',
    sigerdCode: initialData?.sigerd_code || '',
    student_code: initialData?.student_code || '',
    shift: initialData?.shift || 'Mañana',
    addressSector: initialData?.address_sector || '',
    addressStreet: initialData?.address_street || '',
    addressNumber: initialData?.address_number || '',
    municipality: initialData?.municipality || '',
    province: initialData?.province || '',
    homePhone: initialData?.home_phone || '',
    personalPhone: initialData?.personal_phone || '',
    email: initialData?.email || '',
    livesWith: initialData?.lives_with || 'Padres',
    parentsCivilStatus: initialData?.parents_civil_status || 'Casados',
    authorizedPerson: initialData?.authorized_person || '',
    legalRestrictions: initialData?.legal_restrictions || '',
    familyId: initialData?.family_id || ''
  });

  const [family, setFamily] = useState({
    padre: { name: '', id_card: '', phone: '', occupation: '', address: '' },
    madre: { name: '', id_card: '', phone: '', occupation: '', address: '' },
    tutor: { name: '', relation: '', id_card: '', phone: '', address: '' }
  });

  const [medical, setMedical] = useState({
    insurance_ars: '',
    medical_conditions: '',
    allergies: '',
    permanent_medication: '',
    blood_type: '',
    special_observations: ''
  });

  const [history, setHistory] = useState({
    previous_school: '',
    repeating_grade: false,
    performance_observations: '',
    pedagogical_diagnosis: '',
    special_needs: ''
  });

  const [documents, setDocuments] = useState({
    has_birth_certificate: false,
    has_previous_grades: false,
    has_grades_record: false,
    has_parents_id_copy: false,
    has_medical_insurance_copy: false,
    has_photo_2x2: false,
    has_vaccine_card: false,
    has_medical_certification: false
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSiblingSearch, setShowSiblingSearch] = useState(false);
  const [siblingLinkType, setSiblingLinkType] = useState<'full' | 'link_only'>('full');

  const [currentStudentId, setCurrentStudentId] = useState(studentId || initialData?.id || '');
  const [siblings, setSiblings] = useState<any[]>([]);

  // Sincronizar el id si los props cambian
  useEffect(() => {
    setCurrentStudentId(studentId || initialData?.id || '');
  }, [studentId, initialData?.id]);

  // Cargar hermanos vinculados por family_id
  useEffect(() => {
    const fetchSiblings = async () => {
      if (!student.familyId) {
        setSiblings([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('students')
          .select('id, names, first_surname, second_surname, school_year, course_id')
          .eq('family_id', student.familyId);
        
        if (error) throw error;
        
        const filtered = (data || []).filter((s: any) => s.id !== currentStudentId);
        setSiblings(filtered);
      } catch (err) {
        console.error('Error fetching siblings:', err);
      }
    };
    
    fetchSiblings();
  }, [student.familyId, currentStudentId]);

  // Sugerencias para campos inteligentes
  const [suggestions, setSuggestions] = useState({
    sectors: [] as string[],
    municipalities: [] as string[],
    provinces: [] as string[],
    nationalities: [] as string[]
  });

  // EFECTO PARA CARGAR DATOS COMPLETOS
  useEffect(() => {
    const loadData = async () => {
      const id = currentStudentId || siblingSource?.id;
      if (!id) return;

      setIsLoadingFull(true);
      try {
        const full = await dataService.getFullStudent(id);

        // Mapear Familia
        const familyList = full.family || [];
        const getRole = (f: any) => (f.relation || f.role || '').toLowerCase().trim();
        const dbPadre = familyList.find((f: any) => getRole(f) === 'padre');
        const dbMadre = familyList.find((f: any) => getRole(f) === 'madre');
        const dbTutor = familyList.find((f: any) => getRole(f) === 'tutor');

        setFamily({
          padre: {
            name: '',
            phone: '',
            occupation: '',
            address: '',
            ...dbPadre,
            id_card: dbPadre?.secondary_phone || dbPadre?.id_card || ''
          },
          madre: {
            name: '',
            phone: '',
            occupation: '',
            address: '',
            ...dbMadre,
            id_card: dbMadre?.secondary_phone || dbMadre?.id_card || ''
          },
          tutor: {
            name: dbTutor?.name || '',
            relation: dbTutor?.occupation || dbTutor?.relation || dbTutor?.role || '',
            phone: dbTutor?.phone || '',
            address: dbTutor?.address || '',
            id_card: dbTutor?.secondary_phone || dbTutor?.id_card || ''
          }
        });

        if (!siblingSource) {
          if (full.medical) setMedical((prev) => ({ ...prev, ...full.medical }));
          if (full.history) setHistory((prev) => ({ ...prev, ...full.history }));
          if (full.documents) setDocuments((prev) => ({ ...prev, ...full.documents }));

          setStudent((prev) => ({
            ...prev,
            firstSurname: full.first_surname || prev.firstSurname,
            secondSurname: full.second_surname || prev.secondSurname,
            names: full.names || full.first_name || prev.names,
            sex: full.sex || prev.sex,
            birthDate: full.birth_date || prev.birthDate,
            placeOfBirth: full.place_of_birth || prev.placeOfBirth,
            nationality: full.nationality || prev.nationality,
            birthCertificateFolio: full.birth_certificate_folio || prev.birthCertificateFolio,
            idCard: full.id_card || prev.idCard,
            sigerdCode: full.sigerd_code || prev.sigerdCode,
            student_code: full.student_code || prev.student_code,
            shift: full.shift || prev.shift,
            addressSector: full.address_sector || prev.addressSector,
            addressStreet: full.address_street || prev.addressStreet,
            addressNumber: full.address_number || prev.addressNumber,
            municipality: full.municipality || prev.municipality,
            province: full.province || prev.province,
            homePhone: full.home_phone || prev.homePhone,
            personalPhone: full.personal_phone || prev.personalPhone,
            email: full.email || prev.email,
            livesWith: full.lives_with || prev.livesWith,
            parentsCivilStatus: full.parents_civil_status || prev.parentsCivilStatus,
            authorizedPerson: full.authorized_person || prev.authorizedPerson,
            legalRestrictions: full.legal_restrictions || prev.legalRestrictions,
            familyId: full.family_id || prev.familyId
          }));
          if (full.course_id) setSelectedGradeId(full.course_id);
        } else {
          setStudent((prev) => ({
            ...prev,
            firstSurname: full.first_surname || prev.firstSurname,
            addressSector: full.address_sector || prev.addressSector,
            addressStreet: full.address_street || prev.addressStreet,
            addressNumber: full.address_number || prev.addressNumber,
            municipality: full.municipality || prev.municipality,
            province: full.province || prev.province,
            homePhone: full.home_phone || prev.homePhone,
            livesWith: full.lives_with || prev.livesWith,
            parentsCivilStatus: full.parents_civil_status || prev.parentsCivilStatus,
            authorizedPerson: full.authorized_person || prev.authorizedPerson,
            familyId: full.family_id || prev.familyId
          }));
        }
      } catch (error) {
        console.error('Error al cargar datos:', error);
      } finally {
        setIsLoadingFull(false);
      }
    };

    const loadSuggestions = () => {
      const allStudents = state.students || [];
      const getUnique = (field: string): string[] => {
        const values = allStudents
          .map((s: any) => s[field] as string)
          .filter((v) => v && v.trim().length > 0)
          .map((v) => v.trim());
        return (Array.from(new Set(values)) as string[]).sort();
      };

      setSuggestions({
        sectors: getUnique('address_sector'),
        municipalities: getUnique('municipality'),
        provinces: getUnique('province'),
        nationalities: getUnique('nationality')
      });
    };

    loadData();
    loadSuggestions();
  }, [currentStudentId, siblingSource?.id, state.students]);

  useEffect(() => {
    if (selectedCourse) {
      setStudent((s) => ({ ...s, shift: selectedCourse.tanda || s.shift }));
    }
  }, [selectedCourse]);

  useEffect(() => {
    if (activeTab === 'family') {
      setFamily((prev) => {
        const updates: any = {};
        if (!prev.padre.name && student.firstSurname) {
          updates.padre = { ...prev.padre, name: student.firstSurname };
        }
        if (!prev.madre.name && student.secondSurname) {
          updates.madre = { ...prev.madre, name: student.secondSurname };
        }
        if (Object.keys(updates).length > 0) {
          return { ...prev, ...updates };
        }
        return prev;
      });
    }
  }, [activeTab, student.firstSurname, student.secondSurname]);

  const [age, setAge] = useState<number | null>(null);
  useEffect(() => {
    if (student.birthDate) {
      const years = differenceInYears(new Date(), new Date(student.birthDate));
      setAge(years);
    }
  }, [student.birthDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGradeId) {
      alert('Por favor seleccione un grado');
      return;
    }
    setIsSaving(true);

    // Validar si ya existe un alumno con el mismo nombre y apellido en el ciclo seleccionado
    if (!currentStudentId && student.names && student.firstSurname) {
      try {
        const { data: existing, error: checkErr } = await supabase
          .from('students')
          .select('id')
          .eq('center_id', profile.center_id)
          .eq('school_year', selectedYear)
          .eq('names', student.names.trim())
          .eq('first_surname', student.firstSurname.trim());

        if (checkErr) throw checkErr;

        if (existing && existing.length > 0) {
          const confirmSave = window.confirm(
            `⚠️ Ya existe un alumno registrado con el nombre "${student.names} ${student.firstSurname}" en el ciclo ${selectedYear}.\n\n¿Estás seguro de que deseas registrar este duplicado?`
          );
          if (!confirmSave) {
            setIsSaving(false);
            return;
          }
        }
      } catch (err) {
        console.error('Error checking duplicate student:', err);
      }
    }

    const normalize = (val: string) => {
      if (!val) return '';
      // Eliminar espacios extras y poner en formato Titulo (Opcional, pero ayuda)
      const clean = val.trim();
      return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    };

    try {
      const studentData = {
        center_id: profile.center_id,
        first_surname: student.firstSurname,
        second_surname: student.secondSurname,
        names: student.names,
        first_name: student.names,
        last_name: `${student.firstSurname} ${student.secondSurname}`.trim(),
        sex: student.sex,
        birth_date: student.birthDate,
        course_id: selectedGradeId,
        status: 'Active',
        school_year: selectedYear,
        place_of_birth: student.placeOfBirth,
        nationality: normalize(student.nationality),
        birth_certificate_folio: student.birthCertificateFolio,
        id_card: student.idCard,
        sigerd_code: student.sigerdCode,
        shift: student.shift || selectedCourse?.tanda,
        address_sector: normalize(student.addressSector),
        address_street: student.addressStreet,
        address_number: student.addressNumber,
        municipality: normalize(student.municipality),
        province: normalize(student.province),
        home_phone: student.homePhone,
        personal_phone: student.personalPhone,
        email: student.email,
        lives_with: student.livesWith,
        parents_civil_status: student.parentsCivilStatus,
        authorized_person: student.authorizedPerson,
        legal_restrictions: student.legalRestrictions,
        family_id: student.familyId || undefined
      };

      const extraData = {
        family: [
          { ...family.padre, role: 'Padre' },
          { ...family.madre, role: 'Madre' },
          {
            name: family.tutor.name,
            id_card: family.tutor.id_card,
            phone: family.tutor.phone,
            occupation: family.tutor.relation,
            role: 'Tutor'
          }
        ].filter((f) => f.name),
        medical,
        history,
        documents
      };
      const sid = currentStudentId;
      if (sid) {
        await dataService.updateStudent(sid, studentData, extraData, customSchoolYear);
        alert('¡Expediente actualizado exitosamente!');
      } else {
        const savedStudent = await dataService.addStudent(studentData, extraData, customSchoolYear);
        alert('¡Alumno registrado exitosamente!');

        // Si el usuario quiere registrar un hermano inmediatamente
        if ((e.nativeEvent as any).submitter?.name === 'save-and-sibling') {
          // Limpiar solo datos personales, mantener familia y dirección
          setStudent((prev) => ({
            ...prev,
            names: '',
            secondSurname: '',
            sex: 'M',
            birthDate: '',
            idCard: '',
            sigerdCode: '',
            student_code: '', // Se generará nuevo
            familyId: savedStudent.family_id // Vincular con el que acabamos de guardar
          }));
          setActiveTab('general');
          return; // No cerrar ni llamar a onSave aún
        }
      }

      // Invalidar caché de React Query para refrescar la lista de alumnos de inmediato
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['center-stats'] });

      if (refreshData) {
        await refreshData(undefined, true);
      }

      if (onSave) {
        onSave();
      }
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error al guardar: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = async () => {
    if (!student.names || !student.firstSurname) {
      alert('Complete los datos básicos primero.');
      return;
    }

    setIsLoadingFull(true);
    try {
      const centerData = await dataService.getCenter(profile.center_id);
      generateStudentPDF(student, family, medical, history, documents, centerData, selectedCourse);
    } catch (error) {
      console.error('Error al generar PDF:', error);
      alert('Error al obtener datos del centro para el PDF');
    } finally {
      setIsLoadingFull(false);
    }
  };

  const handleSearchSiblings = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 3) {
      setSearchResults([]);
      return;
    }
    const results = await dataService.searchStudents(profile.center_id, q);
    // Excluir al propio estudiante si estamos editando
    setSearchResults(results.filter((r: any) => r.id !== studentId));
  };

  const importSibling = async (sibling: any) => {
    setIsLoadingFull(true);
    try {
      const full = await dataService.getFullStudent(sibling.id);

      let finalFamilyId = full.family_id || sibling.family_id || student.familyId;
      if (!finalFamilyId) {
        finalFamilyId = crypto.randomUUID();
      }

      // 1. Asegurar que el hermano importado tenga este family_id en la base de datos de inmediato
      await supabase
        .from('students')
        .update({ family_id: finalFamilyId })
        .eq('id', sibling.id);

      // 2. Si el alumno actual ya existe, guardarlo en la base de datos de inmediato
      const currentId = currentStudentId;
      if (currentId) {
        await supabase
          .from('students')
          .update({ family_id: finalFamilyId })
          .eq('id', currentId);
      }

      if (siblingLinkType === 'link_only') {
        setStudent((prev) => ({ ...prev, familyId: finalFamilyId }));
        setShowSiblingSearch(false);
        alert(`✅ Vínculo familiar establecido con éxito.\n\nSe ha enlazado a ${full.names} como hermano(a), pero NO se han modificado los datos de padres ni la dirección de ${student.names}.`);
        return;
      }

      // Importar Familia
      const familyList = full.family || [];
      const getRole = (f: any) => (f.relation || f.role || '').toLowerCase().trim();
      const dbPadre = familyList.find((f: any) => getRole(f) === 'padre');
      const dbMadre = familyList.find((f: any) => getRole(f) === 'madre');
      const dbTutor = familyList.find((f: any) => getRole(f) === 'tutor');

      setFamily({
        padre: { name: '', id_card: '', phone: '', occupation: '', address: '', ...dbPadre },
        madre: { name: '', id_card: '', phone: '', occupation: '', address: '', ...dbMadre },
        tutor: {
          name: dbTutor?.name || '',
          relation: dbTutor?.relation || '',
          id_card: dbTutor?.id_card || '',
          phone: dbTutor?.phone || '',
          address: dbTutor?.address || ''
        }
      });

      // Importar datos comunes
      setStudent((prev) => ({
        ...prev,
        firstSurname: full.first_surname || prev.firstSurname,
        addressSector: full.address_sector || prev.addressSector,
        addressStreet: full.address_street || prev.addressStreet,
        addressNumber: full.address_number || prev.addressNumber,
        municipality: full.municipality || prev.municipality,
        province: full.province || prev.province,
        homePhone: full.home_phone || prev.homePhone,
        livesWith: full.lives_with || prev.livesWith,
        parentsCivilStatus: full.parents_civil_status || prev.parentsCivilStatus,
        familyId: finalFamilyId
      }));

      setShowSiblingSearch(false);
      alert(`✅ Vínculo familiar establecido con éxito.\n\nSe han importado la dirección y los datos familiares de ${full.names} ${full.first_surname}.\n\n⚠️ RECUERDA: Sigues editando el expediente de ${student.names}. No modifiques su nombre o apellidos a menos que realmente desees cambiar los datos de este alumno.`);
    } catch (e) {
      console.error(e);
      alert('Error al importar datos del hermano');
    } finally {
      setIsLoadingFull(false);
    }
  };

  const inputClass =
    'w-full px-4 py-2.5 rounded-xl border border-border-main focus:ring-2 focus:ring-indigo-500 bg-brand-bg transition-all text-sm font-bold outline-none text-text-main placeholder:text-text-muted/30';
  const labelClass =
    'block text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1';

  const TabButton = ({ id, icon: Icon, label }: { id: string; icon: any; label: string }) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-all whitespace-nowrap ${activeTab === id ? 'border-brand-blue text-brand-blue bg-brand-blue/5' : 'border-transparent text-text-muted hover:text-text-main'}`}
    >
      <Icon size={18} />
      <span className="text-xs font-black uppercase tracking-widest">{label}</span>
    </button>
  );

  if (isLoadingFull) {
    return (
      <div className="p-20 flex flex-col items-center justify-center gap-4 bg-surface rounded-[3rem] shadow-2xl border border-border-main">
        <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
        <p className="text-text-muted font-black uppercase text-xs tracking-widest">
          {siblingSource ? 'Importando datos del hermano...' : 'Cargando expediente completo...'}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="bg-surface text-left">
        <div className="bg-brand-bg/50 flex overflow-x-auto no-scrollbar border-b border-border-main">
          <TabButton id="general" icon={User} label="General" />
          <TabButton id="family" icon={Users} label="Familia" />
          <TabButton id="medical" icon={HeartPulse} label="Salud" />
          <TabButton id="history" icon={GraduationCap} label="Historial" />
          <TabButton id="docs" icon={ClipboardCheck} label="Documentos" />
        </div>

        <div className="p-10">
          {activeTab === 'general' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-black text-text-main uppercase tracking-widest">
                  Información Básica
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => { setSiblingLinkType('full'); setShowSiblingSearch(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100"
                  >
                    <LinkIcon size={14} /> Vincular con Hermano
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSiblingLinkType('link_only'); setShowSiblingSearch(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all border border-amber-100"
                    title="Vincula al hermano pero mantiene los padres y la dirección actual intactos"
                  >
                    <LinkIcon size={14} /> Vincular (Padres Separados)
                  </button>
                  {currentStudentId && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`¿Deseas iniciar el registro de un nuevo hermano/a compartiendo la dirección y datos familiares de ${student.names}?`)) {
                          setStudent((prev) => ({
                            ...prev,
                            names: '',
                            secondSurname: '',
                            sex: 'M',
                            birthDate: '',
                            placeOfBirth: '',
                            birthCertificateFolio: '',
                            idCard: '',
                            sigerdCode: '',
                            student_code: ''
                          }));
                          setCurrentStudentId('');
                          setMedical({
                            insurance_ars: '',
                            medical_conditions: '',
                            allergies: '',
                            permanent_medication: '',
                            blood_type: '',
                            special_observations: ''
                          });
                          setHistory({
                            previous_school: '',
                            repeating_grade: false,
                            performance_observations: '',
                            pedagogical_diagnosis: '',
                            special_needs: ''
                          });
                          setDocuments({
                            has_birth_certificate: false,
                            has_previous_grades: false,
                            has_grades_record: false,
                            has_parents_id_copy: false,
                            has_medical_insurance_copy: false,
                            has_photo_2x2: false,
                            has_vaccine_card: false,
                            has_medical_certification: false
                          });
                          toast.success('Modo Registro de Hermano activado. Introduce los datos del nuevo alumno.');
                          setActiveTab('general');
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100 cursor-pointer"
                    >
                      <Plus size={14} /> Registrar Hermano
                    </button>
                  )}
                </div>
              </div>

              {siblings.length > 0 && (
                <div className="p-4 bg-indigo-50/50 border border-indigo-100/80 rounded-2xl space-y-2">
                  <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest flex items-center gap-1.5 font-bold">
                    <Users size={12} /> Hermanos Vinculados ({siblings.length})
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {siblings.map((sib) => {
                      const course = (state.courses || []).find((c: any) => c.id === sib.course_id);
                      const courseLabel = course ? `${course.grade} "${course.section}"` : 'Sin curso';
                      return (
                        <button
                          key={sib.id}
                          type="button"
                          onClick={() => {
                            if (window.confirm(`¿Estás seguro de que deseas abrir el expediente de ${sib.names}? Guarda los cambios del alumno actual primero para no perderlos.`)) {
                              setCurrentStudentId(sib.id);
                              toast.success(`Cargando expediente de ${sib.names}`);
                            }
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-indigo-100 text-indigo-700 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100/50 transition-all shadow-sm cursor-pointer"
                        >
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                          {sib.names} ({courseLabel} - {sib.school_year})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {siblingSource && (
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white">
                    <Users size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">
                      Modo Hermano Activo
                    </p>
                    <p className="text-xs font-bold text-amber-700">
                      Se han importado los datos de la familia de:{' '}
                      <span className="uppercase">
                        {siblingSource.names} {siblingSource.first_surname}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <label className={labelClass}>Primer Apellido</label>
                  <input
                    type="text"
                    value={student.firstSurname}
                    onChange={(e) => setStudent({ ...student, firstSurname: e.target.value })}
                    className={inputClass}
                    placeholder="Pérez"
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Segundo Apellido</label>
                  <input
                    type="text"
                    value={student.secondSurname}
                    onChange={(e) => setStudent({ ...student, secondSurname: e.target.value })}
                    className={inputClass}
                    placeholder="García"
                  />
                </div>
                <div>
                  <label className={labelClass}>Nombre(s)</label>
                  <input
                    type="text"
                    value={student.names}
                    onChange={(e) => setStudent({ ...student, names: e.target.value })}
                    className={inputClass}
                    placeholder="Juan Alberto"
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-6">
                <div>
                  <label className={labelClass}>Sexo</label>
                  <select
                    value={student.sex}
                    onChange={(e) => setStudent({ ...student, sex: e.target.value })}
                    className={inputClass}
                  >
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>
                <div className="relative">
                  <label className={labelClass}>Fecha Nacimiento</label>
                  <input
                    type="date"
                    value={student.birthDate}
                    onChange={(e) => setStudent({ ...student, birthDate: e.target.value })}
                    className={inputClass}
                    required
                  />
                  {age !== null && (
                    <span className="absolute right-2 bottom-2 text-[10px] font-black bg-brand-blue text-white px-2 py-0.5 rounded-full">
                      {age} años
                    </span>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Lugar de Nacimiento</label>
                  <input
                    type="text"
                    value={student.placeOfBirth}
                    onChange={(e) => setStudent({ ...student, placeOfBirth: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Nacionalidad</label>
                  <input
                    list="list-nationalities"
                    type="text"
                    value={student.nationality}
                    onChange={(e) => setStudent({ ...student, nationality: e.target.value })}
                    className={inputClass}
                  />
                  <datalist id="list-nationalities">
                    {suggestions.nationalities.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <label className={labelClass}>ID Institucional (Auto)</label>
                  <input
                    type="text"
                    value={student.student_code}
                    className={`${inputClass} bg-brand-bg font-black text-brand-blue`}
                    placeholder="Pendiente..."
                    readOnly
                  />
                </div>
                <div>
                  <label className={labelClass}>Cédula (Si aplica)</label>
                  <input
                    type="text"
                    value={student.idCard}
                    onChange={(e) => setStudent({ ...student, idCard: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Código SIGERD</label>
                  <input
                    type="text"
                    value={student.sigerdCode}
                    onChange={(e) => setStudent({ ...student, sigerdCode: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="bg-brand-primary-light/30 p-8 rounded-[2rem] border border-brand-primary-light/50 space-y-6">
                <h4 className="text-[10px] font-black text-brand-blue uppercase tracking-widest border-b border-brand-blue/20 pb-2 flex items-center gap-2">
                  <GraduationCap size={14} /> Información Académica
                </h4>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>Seleccionar Grado / Sección / Tanda</label>
                      <select
                        value={selectedGradeId}
                        onChange={(e) => setSelectedGradeId(e.target.value)}
                        className={`${inputClass} border-brand-blue/30 font-black text-brand-blue bg-surface`}
                      >
                        <option value="">-- Seleccione el Grado --</option>
                        {sortCourses(state.courses || []).map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.level} {c.grade} "{c.section}" - {c.tanda || 'Matutina'}
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedCourse && (
                      <div className="bg-surface p-4 rounded-2xl border-2 border-brand-blue/10 shadow-sm animate-fade-in flex flex-wrap gap-4">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                            Tanda
                          </span>
                          <span className="text-sm font-black text-brand-blue">
                            {selectedCourse.tanda || 'N/A'}
                          </span>
                        </div>
                        <div className="w-px h-8 bg-border-main"></div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                            Sección
                          </span>
                          <span className="text-sm font-black text-text-main">
                            {selectedCourse.section || 'Única'}
                          </span>
                        </div>
                        <div className="w-px h-8 bg-slate-100"></div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                            Nivel
                          </span>
                          <span className="text-sm font-black text-text-muted uppercase">
                            {selectedCourse.level || 'Primario'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Año Escolar</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={customSchoolYear}
                        onChange={(e) => setCustomSchoolYear(e.target.value)}
                        className={`${inputClass} ${canEditSchoolYear ? 'border-amber-400 bg-amber-50/10 focus:ring-amber-500' : 'bg-brand-bg font-bold opacity-75 cursor-not-allowed'}`}
                        readOnly={!canEditSchoolYear}
                      />
                      {currentStudentId && !canEditSchoolYear && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                '⚠️ ADVERTENCIA: Modificar el año escolar de un alumno ya registrado puede desvincular sus notas históricas de los boletines del año pasado.\n\n¿Realmente necesitas cambiar este año por un error de registro inicial? (Para promover un alumno al nuevo año utiliza el botón Promover)'
                              )
                            ) {
                               setCanEditSchoolYear(true);
                            }
                          }}
                          className="px-3 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all"
                        >
                          Modificar
                        </button>
                      )}
                    </div>
                    {currentStudentId && (
                      <p className="mt-2 text-[10px] text-amber-600 font-bold leading-normal flex items-start gap-1">
                        <span>💡</span>
                        <span>
                          Para inscribir en el año siguiente, no cambies el año aquí. Cancela y usa
                          el botón <strong>"Promover Alumno"</strong>.
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-6">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-2">
                  <MapPin size={14} /> Dirección y Contacto
                </h4>
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <label className={labelClass}>Sector</label>
                    <input
                      list="list-sectors"
                      type="text"
                      value={student.addressSector}
                      onChange={(e) => setStudent({ ...student, addressSector: e.target.value })}
                      className={inputClass}
                    />
                    <datalist id="list-sectors">
                      {suggestions.sectors.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className={labelClass}>Calle</label>
                    <input
                      type="text"
                      value={student.addressStreet}
                      onChange={(e) => setStudent({ ...student, addressStreet: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Casa/Apto #</label>
                    <input
                      type="text"
                      value={student.addressNumber}
                      onChange={(e) => setStudent({ ...student, addressNumber: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <label className={labelClass}>Municipio</label>
                    <input
                      list="list-municipalities"
                      type="text"
                      value={student.municipality}
                      onChange={(e) => setStudent({ ...student, municipality: e.target.value })}
                      className={inputClass}
                    />
                    <datalist id="list-municipalities">
                      {suggestions.municipalities.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className={labelClass}>Provincia</label>
                    <input
                      list="list-provinces"
                      type="text"
                      value={student.province}
                      onChange={(e) => setStudent({ ...student, province: e.target.value })}
                      className={inputClass}
                    />
                    <datalist id="list-provinces">
                      {suggestions.provinces.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className={labelClass}>Teléfono Hogar</label>
                    <input
                      type="tel"
                      value={student.homePhone}
                      onChange={(e) => setStudent({ ...student, homePhone: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <label className={labelClass}>Teléfono Personal</label>
                    <input
                      type="tel"
                      value={student.personalPhone}
                      onChange={(e) => setStudent({ ...student, personalPhone: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Correo Electrónico</label>
                    <input
                      type="email"
                      value={student.email}
                      onChange={(e) => setStudent({ ...student, email: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Vive con:</label>
                    <select
                      value={student.livesWith}
                      onChange={(e) => setStudent({ ...student, livesWith: e.target.value })}
                      className={inputClass}
                    >
                      <option value="Padres">Ambos Padres</option>
                      <option value="Madre">Solo Madre</option>
                      <option value="Padre">Solo Padre</option>
                      <option value="Abuelos">Abuelos</option>
                      <option value="Tutor">Tutor Legal</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'family' && (
            <div className="space-y-10 animate-fade-in">
              <div className="p-6 border border-slate-100 rounded-3xl relative space-y-4">
                <span className="absolute -top-3 left-6 bg-white px-3 text-[10px] font-black text-indigo-600 uppercase tracking-widest border border-slate-100 rounded-full">
                  Información del Padre
                </span>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className={labelClass}>Nombre Completo</label>
                      {student.firstSurname && !family.padre.name.includes(student.firstSurname) && (
                        <button
                          type="button"
                          onClick={() =>
                            setFamily({
                              ...family,
                              padre: {
                                ...family.padre,
                                name: family.padre.name
                                  ? `${family.padre.name} ${student.firstSurname}`.trim()
                                  : student.firstSurname
                              }
                            })
                          }
                          className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded hover:bg-indigo-100 transition-all cursor-pointer"
                        >
                          + Apellido ({student.firstSurname})
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={family.padre.name}
                      onChange={(e) =>
                        setFamily({ ...family, padre: { ...family.padre, name: e.target.value } })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Cédula</label>
                    <input
                      type="text"
                      value={family.padre.id_card}
                      onChange={(e) =>
                        setFamily({
                          ...family,
                          padre: { ...family.padre, id_card: e.target.value }
                        })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Teléfono</label>
                    <input
                      type="tel"
                      value={family.padre.phone}
                      onChange={(e) =>
                        setFamily({ ...family, padre: { ...family.padre, phone: e.target.value } })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Ocupación</label>
                    <input
                      type="text"
                      value={family.padre.occupation}
                      onChange={(e) =>
                        setFamily({
                          ...family,
                          padre: { ...family.padre, occupation: e.target.value }
                        })
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border border-slate-100 rounded-3xl relative space-y-4">
                <span className="absolute -top-3 left-6 bg-white px-3 text-[10px] font-black text-pink-600 uppercase tracking-widest border border-slate-100 rounded-full">
                  Información de la Madre
                </span>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className={labelClass}>Nombre Completo</label>
                      {student.secondSurname && !family.madre.name.includes(student.secondSurname) && (
                        <button
                          type="button"
                          onClick={() =>
                            setFamily({
                              ...family,
                              madre: {
                                ...family.madre,
                                name: family.madre.name
                                  ? `${family.madre.name} ${student.secondSurname}`.trim()
                                  : student.secondSurname
                              }
                            })
                          }
                          className="text-[9px] font-black uppercase text-pink-600 bg-pink-50 px-2 py-0.5 rounded hover:bg-pink-100 transition-all cursor-pointer"
                        >
                          + Apellido ({student.secondSurname})
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={family.madre.name}
                      onChange={(e) =>
                        setFamily({ ...family, madre: { ...family.madre, name: e.target.value } })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Cédula</label>
                    <input
                      type="text"
                      value={family.madre.id_card}
                      onChange={(e) =>
                        setFamily({
                          ...family,
                          madre: { ...family.madre, id_card: e.target.value }
                        })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Teléfono</label>
                    <input
                      type="tel"
                      value={family.madre.phone}
                      onChange={(e) =>
                        setFamily({ ...family, madre: { ...family.madre, phone: e.target.value } })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Ocupación</label>
                    <input
                      type="text"
                      value={family.madre.occupation}
                      onChange={(e) =>
                        setFamily({
                          ...family,
                          madre: { ...family.madre, occupation: e.target.value }
                        })
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 text-white p-8 rounded-3xl space-y-6 relative">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Tutor o Encargado Legal (Si aplica)
                </h4>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>Nombre Completo</label>
                    <input
                      type="text"
                      value={family.tutor.name}
                      onChange={(e) =>
                        setFamily({ ...family, tutor: { ...family.tutor, name: e.target.value } })
                      }
                      className="w-full bg-slate-800 border-none rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Cédula</label>
                    <input
                      type="text"
                      value={family.tutor.id_card}
                      onChange={(e) =>
                        setFamily({
                          ...family,
                          tutor: { ...family.tutor, id_card: e.target.value }
                        })
                      }
                      className="w-full bg-slate-800 border-none rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Teléfono</label>
                    <input
                      type="tel"
                      value={family.tutor.phone}
                      onChange={(e) =>
                        setFamily({ ...family, tutor: { ...family.tutor, phone: e.target.value } })
                      }
                      className="w-full bg-slate-800 border-none rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Relación</label>
                    <input
                      type="text"
                      value={family.tutor.relation}
                      onChange={(e) =>
                        setFamily({
                          ...family,
                          tutor: { ...family.tutor, relation: e.target.value }
                        })
                      }
                      className="w-full bg-slate-800 border-none rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <div>
                  <label className={labelClass}>Estado Civil de Padres</label>
                  <select
                    value={student.parentsCivilStatus}
                    onChange={(e) => setStudent({ ...student, parentsCivilStatus: e.target.value })}
                    className={inputClass}
                  >
                    <option value="Casados">Casados</option>
                    <option value="Unión Libre">Unión Libre</option>
                    <option value="Separados">Separados</option>
                    <option value="Divorciados">Divorciados</option>
                    <option value="Viudo/a">Viudo/a</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Persona Autorizada Retiro</label>
                  <input
                    type="text"
                    value={student.authorizedPerson}
                    onChange={(e) => setStudent({ ...student, authorizedPerson: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Restricciones Legales</label>
                  <input
                    type="text"
                    value={student.legalRestrictions}
                    onChange={(e) => setStudent({ ...student, legalRestrictions: e.target.value })}
                    className={inputClass}
                    placeholder="Ej: No entregar al padre"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('general')}
                  className="flex items-center gap-2 px-8 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold"
                >
                  <ChevronLeft size={18} /> Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('medical')}
                  className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg"
                >
                  Siguiente: Salud <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'medical' && (
            <div className="space-y-8 animate-fade-in">
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <label className={labelClass}>ARS / Seguro Médico</label>
                  <input
                    type="text"
                    value={medical.insurance_ars}
                    onChange={(e) => setMedical({ ...medical, insurance_ars: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Tipo de Sangre</label>
                  <select
                    value={medical.blood_type}
                    onChange={(e) => setMedical({ ...medical, blood_type: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">No sabe</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Medicamentos Permanentes</label>
                  <input
                    type="text"
                    value={medical.permanent_medication}
                    onChange={(e) =>
                      setMedical({ ...medical, permanent_medication: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>Condiciones Médicas / Discapacidades</label>
                  <textarea
                    value={medical.medical_conditions}
                    onChange={(e) => setMedical({ ...medical, medical_conditions: e.target.value })}
                    className={inputClass}
                    rows={3}
                  />
                </div>
                <div>
                  <label className={labelClass}>Alergias</label>
                  <textarea
                    value={medical.allergies}
                    onChange={(e) => setMedical({ ...medical, allergies: e.target.value })}
                    className={inputClass}
                    rows={3}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Observaciones Especiales</label>
                <textarea
                  value={medical.special_observations}
                  onChange={(e) => setMedical({ ...medical, special_observations: e.target.value })}
                  className={inputClass}
                  rows={2}
                />
              </div>
              <div className="flex justify-between pt-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('family')}
                  className="flex items-center gap-2 px-8 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold"
                >
                  <ChevronLeft size={18} /> Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg"
                >
                  Siguiente: Historial <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-8 animate-fade-in">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>Centro Educativo Anterior</label>
                  <input
                    type="text"
                    value={history.previous_school}
                    onChange={(e) => setHistory({ ...history, previous_school: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <input
                    type="checkbox"
                    checked={history.repeating_grade}
                    onChange={(e) => setHistory({ ...history, repeating_grade: e.target.checked })}
                    className="w-6 h-6 text-indigo-600 rounded-lg"
                  />
                  <span className="font-black text-slate-700 text-xs uppercase">
                    ¿Repite Grado?
                  </span>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>Diagnóstico Pedagógico</label>
                  <textarea
                    value={history.pedagogical_diagnosis}
                    onChange={(e) =>
                      setHistory({ ...history, pedagogical_diagnosis: e.target.value })
                    }
                    className={inputClass}
                    rows={3}
                  />
                </div>
                <div>
                  <label className={labelClass}>Necesidades Especiales (NEE)</label>
                  <textarea
                    value={history.special_needs}
                    onChange={(e) => setHistory({ ...history, special_needs: e.target.value })}
                    className={inputClass}
                    rows={3}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Observaciones de Rendimiento</label>
                <textarea
                  value={history.performance_observations}
                  onChange={(e) =>
                    setHistory({ ...history, performance_observations: e.target.value })
                  }
                  className={inputClass}
                  rows={2}
                />
              </div>
              <div className="flex justify-between pt-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('medical')}
                  className="flex items-center gap-2 px-8 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold"
                >
                  <ChevronLeft size={18} /> Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('docs')}
                  className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg"
                >
                  Siguiente: Documentos <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-slate-900 text-white p-10 rounded-[2.5rem]">
                <h4 className="text-xl font-black mb-6 flex items-center gap-2">
                  <ClipboardCheck size={24} className="text-indigo-400" /> Documentos Entregados
                </h4>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { key: 'has_birth_certificate', label: 'Acta de Nacimiento Original' },
                    { key: 'has_previous_grades', label: 'Certificado Grado Anterior' },
                    { key: 'has_grades_record', label: 'Récord de Notas Oficial' },
                    { key: 'has_parents_id_copy', label: 'Copia Cédula Padres' },
                    { key: 'has_medical_insurance_copy', label: 'Copia Seguro Médico' },
                    { key: 'has_photo_2x2', label: 'Foto 2x2' },
                    { key: 'has_vaccine_card', label: 'Tarjeta Vacunas' },
                    { key: 'has_medical_certification', label: 'Certificación Médica' }
                  ].map((doc) => (
                    <label
                      key={doc.key}
                      className="flex items-center gap-3 bg-white/10 p-4 rounded-2xl cursor-pointer hover:bg-white/20 transition-all"
                    >
                      <input
                        type="checkbox"
                        checked={(documents as any)[doc.key]}
                        onChange={(e) =>
                          setDocuments({ ...documents, [doc.key]: e.target.checked })
                        }
                        className="w-5 h-5 rounded text-indigo-500"
                      />
                      <span className="text-sm font-bold uppercase tracking-tight">
                        {doc.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-start pt-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="flex items-center gap-2 px-8 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold"
                >
                  <ChevronLeft size={18} /> Anterior
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-10 bg-brand-bg/50 border-t border-border-main flex justify-between items-center gap-4">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-surface border border-border-main text-text-main font-black text-sm uppercase tracking-widest hover:bg-brand-bg transition-all shadow-sm"
          >
            <Printer size={20} /> Imprimir PDF
          </button>

          <div className="flex items-center gap-4">
            {!currentStudentId && (
              <button
                type="submit"
                name="save-and-sibling"
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100"
              >
                <Users size={18} /> Guardar y Añadir Hermano
              </button>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className={`flex items-center gap-3 px-12 py-5 rounded-[1.5rem] font-black text-lg uppercase tracking-widest shadow-2xl transition-all ${isSaving ? 'bg-text-muted cursor-wait' : 'bg-slate-900 dark:bg-brand-blue text-white hover:scale-105 active:scale-95'}`}
            >
              <Save size={24} />{' '}
              {isSaving
                ? 'Guardando...'
                : currentStudentId
                  ? 'Actualizar'
                  : 'Guardar Alumno'}
            </button>
          </div>
        </div>
      </form>

      {/* Sibling Search Modal */}
      {showSiblingSearch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[1000] p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                  <SearchIcon size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                    Vincular Hermano
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Busca para importar datos familiares
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSiblingSearch(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="relative">
                <SearchIcon
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  autoFocus
                  type="text"
                  placeholder="Escribe apellido o nombre del hermano..."
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                  onChange={(e) => handleSearchSiblings(e.target.value)}
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                {searchResults.length === 0 ? (
                  <p className="text-center py-10 text-slate-400 text-xs font-bold uppercase tracking-widest">
                    {searchQuery.length < 3
                      ? 'Escribe al menos 3 letras...'
                      : 'No se encontraron resultados'}
                  </p>
                ) : (
                  searchResults.map((res) => (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => importSibling(res)}
                      className="w-full flex items-center justify-between p-4 bg-white hover:bg-indigo-50 border border-slate-100 rounded-2xl transition-all group"
                    >
                      <div className="text-left">
                        <p className="text-sm font-black text-slate-800 uppercase tracking-tight group-hover:text-indigo-600">
                          {res.first_surname} {res.second_surname}, {res.names}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                          {state.courses.find((c: any) => c.id === res.course_id)?.grade ||
                            'Sin Grado'}
                        </p>
                      </div>
                      <ChevronRight
                        size={18}
                        className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all"
                      />
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowSiblingSearch(false)}
                className="px-6 py-3 bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-300 transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
