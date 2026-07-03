import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { sortCourses } from '../utils/courseSorter';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Download,
  Loader2,
  X,
  Play,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { dataService } from '../services/dataService';
import { useApp, useSupabase } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

const formatToISODate = (dateStr: any) => {
  if (!dateStr) return null;
  try {
    const str = String(dateStr).trim();
    if (!str) return null;

    // Manejar números de Excel (seriales) e.g. "43920"
    if (/^\d{5}$/.test(str)) {
      const num = Number(str);
      const date = new Date((num - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }

    // Formato DD/MM/AAAA o D/M/AAAA o DD-MM-AAAA o D-M-AAAA
    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // AAAA/MM/DD
        const y = parts[0];
        const m = parts[1].padStart(2, '0');
        const d = parts[2].padStart(2, '0');
        const iso = `${y}-${m}-${d}`;
        if (!isNaN(Date.parse(iso))) return iso;
      } else {
        // DD/MM/AAAA
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        const iso = `${y}-${m}-${d}`;
        if (!isNaN(Date.parse(iso))) return iso;
      }
    }

    const parsed = Date.parse(str);
    if (!isNaN(parsed)) {
      return new Date(parsed).toISOString().split('T')[0];
    }
  } catch (e) {
    console.warn('Error formateando fecha:', dateStr);
  }
  return null;
};

interface MasterImportWizardProps {
  onClose: () => void;
}

export const MasterImportWizard = ({ onClose }: MasterImportWizardProps) => {
  const { state, center, selectedYear, refreshData } = useApp();
  const { profile } = useSupabase();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'preview' | 'importing' | 'success'>(
    'upload'
  );
  const [progressMsg, setProgressMsg] = useState('');
  const [progressValue, setProgressValue] = useState(0);
  const [parsedData, setParsedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // EXPORTAR DATOS ACTUALES A EXCEL
  const handleExportData = async () => {
    try {
      const centerId = profile?.center_id;
      if (!centerId) return;

      // Cargar tutores desde Supabase (no están en AppContext)
      const { data: parents } = await supabase
        .from('parents')
        .select('*')
        .eq('center_id', centerId);

      // Pestaña 1: Centro
      const sheetCentro = [
        {
          Nombre: center?.name || '',
          Eslogan: center?.slogan || '',
          Telefono: center?.phone || '',
          Correo: center?.email || '',
          Direccion: center?.address || '',
          Distrito: center?.district || '',
          Regional: center?.regional || '',
          Director_Nombre: center?.director_name || '',
          Director_Sexo_M_F: center?.director_sex || 'F'
        }
      ];

      // Pestaña 2: Cursos
      const sheetCursos = sortCourses(state.courses || []).map((c: any) => ({
        Nivel: c.level || 'Secundario',
        Grado: c.grade || '',
        Seccion: c.section || '',
        Tanda: c.tanda || c.shift || 'Matutina'
      }));
      // Si está vacío, agregar un ejemplo
      if (sheetCursos.length === 0) {
        sheetCursos.push({ Nivel: 'Secundario', Grado: '1ero', Seccion: 'A', Tanda: 'Matutina' });
      }

      // Pestaña 3: Materias
      const sheetMaterias = (state.subjects || []).map((s: any) => ({
        Nombre: s.name || '',
        Nivel: s.level || 'Secundario',
        Area: s.area || 'General',
        Horas_Semanales: s.hours_per_week || s.weekly_hours || 4
      }));
      if (sheetMaterias.length === 0) {
        sheetMaterias.push({
          Nombre: 'Lengua Española',
          Nivel: 'Secundario',
          Area: 'Lengua Española',
          Horas_Semanales: 6
        });
      }

      // Pestaña 4: Personal
      const sheetPersonal = (state.teachers || []).map((p: any) => {
        let displayRole = 'Docente';
        if (p.role === 'management') displayRole = 'Gestión';
        else if (p.role === 'administrative') displayRole = 'Administrativo';
        else if (p.role === 'support') displayRole = 'Apoyo';
        else if (p.role === 'finance') displayRole = 'Finanzas';
        return {
          Nombre_Completo: p.name || '',
          Rol: displayRole,
          Sexo_M_F: p.sex || 'M',
          Telefono: p.phone || '',
          Email: p.email || ''
        };
      });
      if (sheetPersonal.length === 0) {
        sheetPersonal.push({
          Nombre_Completo: 'Juan Pérez',
          Rol: 'Docente',
          Sexo_M_F: 'M',
          Telefono: '809-555-0101',
          Email: 'juan.perez@edu.do'
        });
      }

      // Pestaña 5: Alumnos
      const sheetAlumnos = (state.students || []).map((s: any) => {
        const course = (state.courses || []).find((c: any) => c.id === s.course_id);
        const parent = (parents || []).find((p: any) => p.student_id === s.id);
        return {
          Nombres: s.names || s.first_name || '',
          Primer_Apellido: s.first_surname || s.last_name || '',
          Segundo_Apellido: s.second_surname || '',
          Sexo_M_F: s.sex || 'M',
          Fecha_Nacimiento: s.birth_date || '',
          Nivel_Curso: course?.level || '',
          Grado_Curso: course?.grade || '',
          Seccion_Curso: course?.section || '',
          Tanda_Curso: course?.tanda || 'Matutina',
          Tutor_Nombre: parent?.name || '',
          Tutor_Parentesco: parent?.relation || '',
          Tutor_Telefono: parent?.phone || '',
          Direccion_Calle: s.address_street || '',
          Direccion_Sector: s.address_sector || '',
          Codigo_SIGERD: s.sigerd_code || ''
        };
      });
      if (sheetAlumnos.length === 0) {
        sheetAlumnos.push({
          Nombres: 'Carlos Alberto',
          Primer_Apellido: 'Gómez',
          Segundo_Apellido: 'Santos',
          Sexo_M_F: 'M',
          Fecha_Nacimiento: '10/05/2012',
          Nivel_Curso: 'Secundario',
          Grado_Curso: '1ero',
          Seccion_Curso: 'A',
          Tanda_Curso: 'Matutina',
          Tutor_Nombre: 'Ana Santos',
          Tutor_Parentesco: 'Madre',
          Tutor_Telefono: '809-555-0202',
          Direccion_Calle: 'Calle Duarte #15',
          Direccion_Sector: 'Centro Ciudad',
          Codigo_SIGERD: '12345678'
        });
      }

      // Pestaña 6: Asignaciones
      const sheetAsignaciones = (state.assignments || []).map((a: any) => {
        const teacher = (state.teachers || []).find((t: any) => t.id === a.teacher_id);
        const subject = (state.subjects || []).find((s: any) => s.id === a.subject_id);
        const course = (state.courses || []).find((c: any) => c.id === a.course_id);
        return {
          Nombre_Docente: teacher?.name || '',
          Nombre_Materia: subject?.name || '',
          Nivel_Curso: course?.level || '',
          Grado_Curso: course?.grade || '',
          Seccion_Curso: course?.section || '',
          Tanda_Curso: course?.tanda || 'Matutina',
          Horas_Semanales: a.hours_per_week || 4
        };
      });
      if (sheetAsignaciones.length === 0) {
        sheetAsignaciones.push({
          Nombre_Docente: 'Juan Pérez',
          Nombre_Materia: 'Lengua Española',
          Nivel_Curso: 'Secundario',
          Grado_Curso: '1ero',
          Seccion_Curso: 'A',
          Tanda_Curso: 'Matutina',
          Horas_Semanales: 6
        });
      }

      // Generar libro
      const wb = XLSX.utils.book_new();

      const wsCentro = XLSX.utils.json_to_sheet(sheetCentro);
      const wsCursos = XLSX.utils.json_to_sheet(sheetCursos);
      const wsMaterias = XLSX.utils.json_to_sheet(sheetMaterias);
      const wsPersonal = XLSX.utils.json_to_sheet(sheetPersonal);
      const wsAlumnos = XLSX.utils.json_to_sheet(sheetAlumnos);
      const wsAsignaciones = XLSX.utils.json_to_sheet(sheetAsignaciones);

      const addValidation = (ws: any, sqref: string, values: string) => {
        if (!ws['!dataValidation']) ws['!dataValidation'] = [];
        ws['!dataValidation'].push({
          sqref,
          type: 'list',
          formula1: `"${values}"`
        });
      };

      // Agregar listas desplegables (dropdowns) en español
      addValidation(wsCursos, 'A2:A500', 'Inicial,Primario,Secundario');
      addValidation(wsCursos, 'D2:D500', 'Matutina,Vespertina,Nocturna,Extendida');

      addValidation(wsMaterias, 'B2:B500', 'Inicial,Primario,Secundario');

      addValidation(wsPersonal, 'B2:B500', 'Docente,Gestión,Administrativo,Apoyo,Finanzas');
      addValidation(wsPersonal, 'C2:C500', 'M,F');

      addValidation(wsAlumnos, 'D2:D1000', 'M,F');
      addValidation(wsAlumnos, 'F2:F1000', 'Inicial,Primario,Secundario');
      addValidation(wsAlumnos, 'J2:J1000', 'Madre,Padre,Tutor,Tía,Tío,Abuela,Abuelo');

      addValidation(wsAsignaciones, 'C2:C500', 'Inicial,Primario,Secundario');

      XLSX.utils.book_append_sheet(wb, wsCentro, 'Centro');
      XLSX.utils.book_append_sheet(wb, wsCursos, 'Cursos');
      XLSX.utils.book_append_sheet(wb, wsMaterias, 'Materias');
      XLSX.utils.book_append_sheet(wb, wsPersonal, 'Personal');
      XLSX.utils.book_append_sheet(wb, wsAlumnos, 'Alumnos');
      XLSX.utils.book_append_sheet(wb, wsAsignaciones, 'Asignaciones');

      XLSX.writeFile(wb, `Edugest_Carga_${center?.name?.replace(/ /g, '_') || 'Centro'}.xlsx`);
      toast.success('Excel exportado correctamente');
    } catch (err) {
      console.error(err);
      toast.error('Error al exportar plantilla');
    }
  };

  // LEER Y PROCESAR EL ARCHIVO EXCEL SUBIDO
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        const getSheetData = (name: string) => {
          const ws = wb.Sheets[name];
          return ws ? XLSX.utils.sheet_to_json(ws) : [];
        };

        const rawCentro = getSheetData('Centro');
        const rawCursos = getSheetData('Cursos');
        const rawMaterias = getSheetData('Materias');
        const rawPersonal = getSheetData('Personal');
        const rawAlumnos = getSheetData('Alumnos');
        const rawAsignaciones = getSheetData('Asignaciones');

        if (rawCursos.length === 0 && rawPersonal.length === 0 && rawAlumnos.length === 0) {
          setError(
            'El archivo Excel no parece contener datos en las hojas requeridas ("Cursos", "Personal", "Alumnos").'
          );
          setIsProcessing(false);
          return;
        }

        // Mapeo flexible de Centro
        let centerPayload: any = null;
        if (rawCentro.length > 0) {
          const c = rawCentro[0] as any;
          const findVal = (row: any, keys: string[]) => {
            const matchK = Object.keys(row).find((k) =>
              keys.some((tk) => k.toLowerCase().replace(/_/g, '').includes(tk.toLowerCase()))
            );
            return matchK ? String(row[matchK]).trim() : '';
          };
          centerPayload = {
            name: findVal(c, ['nombre']),
            slogan: findVal(c, ['eslogan', 'lema']),
            phone: findVal(c, ['telefono', 'phone']),
            email: findVal(c, ['correo', 'email']),
            address: findVal(c, ['direccion', 'address']),
            district: findVal(c, ['distrito']),
            regional: findVal(c, ['regional']),
            director_name: findVal(c, ['directorname', 'directornombre']),
            director_sex: findVal(c, ['directorsexo', 'directorsex']).toUpperCase().startsWith('M')
              ? 'M'
              : 'F'
          };
        }

        // Mapeo flexible de Cursos
        const coursesPayload = rawCursos
          .map((row: any) => {
            const findVal = (keys: string[]) => {
              const k = Object.keys(row).find((key) =>
                keys.some((tk) => key.toLowerCase().includes(tk))
              );
              return k ? String(row[k]).trim() : '';
            };
            return {
              level: findVal(['nivel', 'level']) || 'Secundario',
              grade: findVal(['grado', 'grade']),
              section: findVal(['seccion', 'section']) || 'A',
              shift: findVal(['tanda', 'shift']) || 'Matutina'
            };
          })
          .filter((c: any) => c.grade && c.grade.trim() !== '');

        // Mapeo de Materias
        const subjectsPayload = rawMaterias
          .map((row: any) => {
            const findVal = (keys: string[]) => {
              const k = Object.keys(row).find((key) =>
                keys.some((tk) => key.toLowerCase().includes(tk))
              );
              return k ? String(row[k]).trim() : '';
            };
            return {
              name: findVal(['nombre', 'name']),
              level: findVal(['nivel', 'level']) || 'Secundario',
              area: findVal(['area', 'academic']) || 'General',
              weekly_hours: Number(findVal(['horas', 'weekly'])) || 4
            };
          })
          .filter((s: any) => s.name && s.name.trim() !== '');

        // Mapeo de Personal
        const staffPayload = rawPersonal
          .map((row: any) => {
            const findVal = (keys: string[]) => {
              const k = Object.keys(row).find((key) =>
                keys.some((tk) => key.toLowerCase().includes(tk))
              );
              return k ? String(row[k]).trim() : '';
            };
            const rawRol = findVal(['rol', 'role', 'team']).toLowerCase();
            let finalTeam = 'teacher';
            if (
              rawRol.includes('gest') ||
              rawRol.includes('director') ||
              rawRol.includes('coord')
            ) {
              finalTeam = 'management';
            } else if (rawRol.includes('admin') || rawRol.includes('secret')) {
              finalTeam = 'administrative';
            } else if (
              rawRol.includes('apoy') ||
              rawRol.includes('cons') ||
              rawRol.includes('support')
            ) {
              finalTeam = 'support';
            } else if (rawRol.includes('finan') || rawRol.includes('caja')) {
              finalTeam = 'finance';
            }
            return {
              name: findVal(['nombre', 'name']),
              team: finalTeam,
              sex: findVal(['sexo', 'gender', 'sex']).toUpperCase().startsWith('M') ? 'M' : 'F',
              phone: findVal(['telefono', 'phone']),
              email: findVal(['email', 'correo'])
            };
          })
          .filter((p: any) => p.name && p.name.trim() !== '');

        // Mapeo de Alumnos
        const studentsPayload = rawAlumnos
          .map((row: any) => {
            const findVal = (keys: string[]) => {
              const k = Object.keys(row).find((key) =>
                keys.some((tk) => key.toLowerCase().replace(/_/g, '').includes(tk))
              );
              return k ? String(row[k]).trim() : '';
            };
            return {
              names: findVal(['nombres', 'firstname', 'names']),
              first_surname: findVal(['primerapellido', 'lastname', 'surname', 'apellido']),
              second_surname: findVal(['segundoapellido', 'middlename']),
              sex: findVal(['sexo', 'gender']).toUpperCase().startsWith('M') ? 'M' : 'F',
              birth_date: formatToISODate(findVal(['fecha', 'nacimiento', 'birth'])),
              level_course: findVal(['nivel', 'level']) || 'Secundario',
              grade_course: findVal(['grado', 'grade']) || '1ero',
              seccion_course: findVal(['seccion', 'section']) || 'A',
              tanda_course: findVal(['tanda', 'shift', 'jornada']) || 'Matutina',
              tutor_name: findVal(['tutor', 'padre', 'encargado']),
              tutor_parentesco: findVal(['parentesco', 'relation']),
              tutor_telefono: findVal(['telefono', 'phone']),
              address_street: findVal(['calle', 'street', 'direccion']),
              address_sector: findVal(['sector', 'barrio'])
            };
          })
          .filter((s) => s.names && s.first_surname); // Filtro estricto: requiere nombre y apellido

        // Mapeo de Asignaciones
        const assignmentsPayload = rawAsignaciones
          .map((row: any) => {
            const findVal = (keys: string[]) => {
              const k = Object.keys(row).find((key) =>
                keys.some((tk) => key.toLowerCase().replace(/_/g, '').includes(tk))
              );
              return k ? String(row[k]).trim() : '';
            };
            return {
              docente: findVal(['docente', 'profesor', 'teacher']),
              materia: findVal(['materia', 'asignatura', 'subject']),
              nivel: findVal(['nivel', 'level']) || 'Secundario',
              grade: findVal(['grado', 'grade']) || '1ero',
              section: findVal(['seccion', 'section']) || 'A',
              tanda: findVal(['tanda', 'shift', 'jornada']) || 'Matutina',
              hours_per_week: Number(findVal(['horas', 'weekly'])) || 4
            };
          })
          .filter(
            (a: any) => a.docente && a.docente.trim() !== '' && a.materia && a.materia.trim() !== ''
          );

        setParsedData({
          center: centerPayload,
          courses: coursesPayload,
          subjects: subjectsPayload,
          staff: staffPayload,
          students: studentsPayload,
          assignments: assignmentsPayload
        });
        setCurrentStep('preview');
      } catch (err: any) {
        console.error(err);
        setError('Ocurrió un error leyendo el Excel. Verifique que no esté dañado.');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // SUBIR E INGESTIONAR EN SUPABASE
  const handleImport = async () => {
    if (!parsedData || !profile?.center_id) return;

    setCurrentStep('importing');
    setProgressMsg('Preparando base de datos...');
    setProgressValue(10);

    try {
      const centerId = profile.center_id;

      // Paso 1: Actualizar Centro
      if (parsedData.center) {
        setProgressMsg('Actualizando Perfil del Centro...');
        setProgressValue(20);
        await supabase.from('centers').update(parsedData.center).eq('id', centerId);
      }

      // Paso 2: Importación completa
      setProgressMsg('Procesando Cursos, Materias, Profesores, Alumnos y Asignaciones...');
      setProgressValue(50);

      await dataService.importCompleteCenter(centerId, selectedYear, parsedData);

      setProgressMsg('Sincronizando Estado de la Aplicación...');
      setProgressValue(85);
      queryClient.invalidateQueries({ queryKey: ['students', centerId, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['center-stats', centerId] });
      await refreshData(centerId, true);

      setProgressValue(100);
      setCurrentStep('success');
      toast.success('¡Importación masiva completada con éxito!');
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message || 'Error durante la sincronización de base de datos. Operación revertida.'
      );
      setCurrentStep('preview');
    }
  };

  return (
    <div className="text-left space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase text-slate-900">
              Configuración Rápida de Colegio
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Importador Integrado Maestro (Excel)
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-3 text-xs font-bold animate-pulse">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {currentStep === 'upload' && (
        <div className="space-y-6">
          <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2rem] flex flex-col md:flex-row items-center gap-6 justify-between">
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                Paso 1: Descarga la plantilla pre-rellenada
              </h4>
              <p className="text-xs text-slate-500 font-medium max-w-md">
                Este Excel contendrá toda la estructura vacía y los datos que ya estén ingresados en
                tu centro escolar para que puedas modificarlos o agregar nuevos filas sin empezar de
                cero.
              </p>
            </div>
            <button
              onClick={handleExportData}
              className="flex items-center gap-2 px-6 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all flex-shrink-0"
            >
              <Download size={16} /> Descargar Plantilla
            </button>
          </div>

          <div className="p-10 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center text-center group hover:border-indigo-500 transition-colors relative cursor-pointer min-h-[220px]">
            <Upload
              className="text-slate-300 group-hover:text-indigo-600 mb-4 transition-colors"
              size={48}
            />
            <h4 className="text-xs font-black uppercase text-slate-700 mb-1">
              Paso 2: Sube el Excel modificado
            </h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">
              Arrastra el archivo o haz clic para examinar
            </p>

            <input
              type="file"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
              accept=".xlsx, .xls"
              disabled={isProcessing}
            />

            {isProcessing && (
              <div className="absolute inset-0 bg-white/95 rounded-[2.5rem] flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
                <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest animate-pulse">
                  Analizando documento...
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {currentStep === 'preview' && parsedData && (
        <div className="space-y-6 animate-in zoom-in-95 duration-200">
          <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100/50">
            <h4 className="text-xs font-black uppercase text-indigo-700 tracking-wider mb-4">
              Resumen de Contenido Detectado
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Información de Centro
                </p>
                <p className="text-sm font-black text-slate-700 uppercase mt-1">
                  {parsedData.center ? 'Modificado' : 'Sin Cambios'}
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Cursos y Grados
                </p>
                <p className="text-sm font-black text-slate-700 mt-1">
                  {parsedData.courses.length} Cursos
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Materias / Asignaturas
                </p>
                <p className="text-sm font-black text-slate-700 mt-1">
                  {parsedData.subjects.length} Materias
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Colaboradores / Personal
                </p>
                <p className="text-sm font-black text-slate-700 mt-1">
                  {parsedData.staff.length} Personas
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Alumnos Registrados
                </p>
                <p className="text-sm font-black text-slate-700 mt-1">
                  {parsedData.students.length} Estudiantes
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Asignaciones Docentes
                </p>
                <p className="text-sm font-black text-slate-700 mt-1">
                  {parsedData.assignments.length} Cargados
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-[10px] font-bold uppercase leading-relaxed flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>
              Nota: Al proceder, el sistema creará los nuevos registros y actualizará los
              existentes. Las asignaciones de materias y profesores se re-estructurarán de acuerdo a
              este Excel. Asegúrate de verificar los datos antes de continuar.
            </span>
          </div>

          <div className="flex gap-4 pt-4 border-t border-slate-100">
            <button
              onClick={() => setCurrentStep('upload')}
              className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
            >
              Volver a Subir
            </button>
            <button
              onClick={handleImport}
              className="flex-2 px-12 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Play size={14} /> Iniciar Configuración Masiva
            </button>
          </div>
        </div>
      )}

      {currentStep === 'importing' && (
        <div className="p-12 flex flex-col items-center justify-center text-center gap-6 min-h-[300px] animate-in fade-in duration-300">
          <div className="relative flex items-center justify-center">
            <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <FileText className="absolute text-indigo-600 animate-pulse" size={28} />
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Cargando centro educativo...
            </h4>
            <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest animate-pulse">
              {progressMsg}
            </p>
          </div>
          {/* Progress Bar */}
          <div className="w-full max-w-xs bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full transition-all duration-300"
              style={{ width: `${progressValue}%` }}
            ></div>
          </div>
        </div>
      )}

      {currentStep === 'success' && (
        <div className="p-12 flex flex-col items-center justify-center text-center gap-6 min-h-[300px] animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-50">
            <CheckCircle2 size={44} />
          </div>
          <div className="space-y-2">
            <h4 className="text-lg font-black uppercase text-slate-900">
              ¡Configuración Completada!
            </h4>
            <p className="text-xs text-slate-500 font-medium max-w-sm">
              Toda la información del centro educativo ha sido sincronizada e importada con éxito en
              la base de datos de producción.
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-10 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95"
          >
            Cerrar Asistente
          </button>
        </div>
      )}
    </div>
  );
};

export default MasterImportWizard;
