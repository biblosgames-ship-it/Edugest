import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Download,
  UserPlus,
  Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { dataService } from '../services/dataService';
import { useApp } from '../context/AppContext';
import { useSupabase } from '../context/AppContext';

interface BulkImportProps {
  gradeId: string;
  selectedYear: string;
  onComplete: () => void;
}

export const BulkImport = ({ gradeId, selectedYear, onComplete }: BulkImportProps) => {
  const { profile } = useSupabase();
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const downloadTemplate = () => {
    const template = [
      {
        Nombres: 'Juan Alberto',
        'Primer Apellido': 'Pérez',
        'Segundo Apellido': 'García',
        'Sexo (M/F)': 'M',
        'Fecha Nacimiento (DD/MM/AAAA)': '15/05/2015',
        'Lugar de Nacimiento': 'Santo Domingo',
        Nacionalidad: 'Dominicana',
        'ID / Cédula': '',
        'Código SIGERD': ''
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Importación');
    XLSX.writeFile(wb, 'Plantilla_Importacion_Edugest.xlsx');
  };

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
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          setError('El archivo está vacío.');
          setIsProcessing(false);
          return;
        }

        // MAPEADO ULTRA-FLEXIBLE
        const mapped = data
          .map((row: any) => {
            const findVal = (keys: string[]) => {
              const key = Object.keys(row).find((k) => {
                const cleanK = k
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .trim();
                return keys.some((target) => cleanK.includes(target));
              });
              return key ? String(row[key]).trim() : '';
            };

            const names = findVal(['nombre']);
            const firstSurname = findVal(['primer apellido', 'apellido paterno']);
            const secondSurname = findVal(['segundo apellido', 'apellido materno']);
            const combinedSurnames = findVal(['apellidos', 'last name', 'surname']);

            return {
              names: names,
              // Si hay apellidos combinados y no hay primer apellido separado, usar el combinado
              first_surname: firstSurname || combinedSurnames || '',
              second_surname: secondSurname || '',
              sex: (findVal(['sexo', 'genero', 'sex']) || 'M').toUpperCase().startsWith('M')
                ? 'M'
                : 'F',
              birth_date: findVal(['fecha', 'nacimiento', 'birth']),
              place_of_birth: findVal(['lugar', 'nacimiento', 'place']),
              nationality: findVal(['nacionalidad', 'pais', 'nation']) || 'Dominicana',
              id_card: findVal(['cedula', 'documento', 'ident']),
              sigerd_code: findVal(['sigerd', 'codigo', 'siger'])
            };
          })
          .filter((r) => r.names && r.first_surname);

        if (mapped.length === 0) {
          setError(
            'No se detectaron alumnos. Verifique que las columnas tengan nombres claros (Nombres, Apellidos).'
          );
        } else {
          setPreviewData(mapped);
        }
      } catch (err) {
        setError('Error al leer el archivo. Asegúrese de que sea un Excel válido.');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const formatToISODate = (dateStr: any) => {
    if (!dateStr) return null;
    try {
      // Manejar números de Excel (seriales)
      if (!isNaN(Number(dateStr)) && typeof dateStr !== 'string') {
        const date = new Date((Number(dateStr) - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0];
      }

      const str = String(dateStr).trim();
      // Formato DD/MM/AAAA o D/M/AAAA
      const parts = str.split('/');
      if (parts.length === 3) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        const iso = `${y}-${m}-${d}`;
        if (!isNaN(Date.parse(iso))) return iso;
      }

      if (!isNaN(Date.parse(str))) return str.split('T')[0];
    } catch (e) {
      console.warn('Error formateando fecha:', dateStr);
    }
    return null;
  };

  const handleImport = async () => {
    if (previewData.length === 0 || !gradeId || !profile?.center_id) return;

    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    try {
      for (const student of previewData) {
        try {
          const studentData = {
            center_id: profile.center_id,
            names: student.names,
            first_name: student.names,
            first_surname: student.first_surname,
            second_surname: student.second_surname,
            last_name: `${student.first_surname} ${student.second_surname}`.trim(),
            sex: student.sex,
            birth_date: formatToISODate(student.birth_date),
            course_id: gradeId,
            status: 'Active',
            place_of_birth: student.place_of_birth,
            nationality: student.nationality,
            id_card: student.id_card,
            sigerd_code: student.sigerd_code
          };

          await dataService.addStudent(studentData, null, selectedYear);
          successCount++;
        } catch (err: any) {
          failCount++;
          const errorMsg = err.message || 'Error desconocido';
          if (!errors.includes(errorMsg)) errors.push(errorMsg);
          console.error('Error importing student:', student.names, err);
        }
      }

      let finalMessage = `¡Proceso terminado!\n\n✅ Exitosos: ${successCount}\n❌ Fallidos: ${failCount}`;
      if (errors.length > 0) {
        finalMessage += `\n\nMotivos de fallo detectados:\n- ${errors.join('\n- ')}`;
      }

      alert(finalMessage);
      setPreviewData([]);
      onComplete();
    } catch (err) {
      alert('Ocurrió un error general durante la importación.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
              <FileSpreadsheet size={32} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                Importación Masiva
              </h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Carga alumnos desde Excel o CSV
              </p>
            </div>
          </div>

          <button
            onClick={downloadTemplate}
            className="flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all shadow-lg"
          >
            <Download size={16} />
            Descargar Plantilla
          </button>
        </div>

        {!previewData.length ? (
          <div className="relative group">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="border-4 border-dashed border-slate-100 group-hover:border-emerald-200 rounded-[2rem] p-16 flex flex-col items-center justify-center text-center transition-all bg-slate-50/30 group-hover:bg-emerald-50/30">
              <div className="w-20 h-20 bg-white rounded-full shadow-xl flex items-center justify-center text-emerald-500 mb-6 group-hover:scale-110 transition-transform">
                <Upload size={32} />
              </div>
              <h4 className="text-xl font-black text-slate-800 mb-2">Arrastra tu archivo aquí</h4>
              <p className="text-slate-400 font-medium max-w-sm">
                El sistema reconocerá automáticamente tus columnas (Nombre, Apellido, etc.)
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-500" size={24} />
                <span className="font-black text-emerald-700 text-sm">
                  Se detectaron {previewData.length} alumnos listos para importar
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setPreviewData([])}
                  className="px-4 py-2 text-slate-500 font-bold text-xs hover:text-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImport}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <UserPlus size={14} />
                  )}
                  Confirmar Importación
                </button>
              </div>
            </div>

            <div className="overflow-hidden border border-slate-100 rounded-2xl shadow-sm">
              <table className="w-full text-left border-collapse bg-white">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Nombres
                    </th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Apellidos
                    </th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Sexo
                    </th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      F. Nacimiento
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 10).map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-4 font-bold text-slate-700">{row.names}</td>
                      <td className="p-4 font-bold text-slate-700">
                        {row.first_surname} {row.second_surname}
                      </td>
                      <td className="p-4 text-sm text-slate-500">{row.sex}</td>
                      <td className="p-4 text-sm text-slate-500">{row.birth_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 p-4 bg-rose-50 text-rose-700 rounded-2xl border border-rose-100">
            <AlertCircle size={20} />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};
