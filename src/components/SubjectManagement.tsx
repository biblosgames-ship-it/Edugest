import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dataService } from '../services/dataService';
import { useSupabase } from '../context/AppContext';
import { BookOpen, CheckCircle2, AlertCircle, Plus } from 'lucide-react';

export const SubjectManagement = () => {
  const { state, addAssignment, selectedYear } = useApp() as any;
  const { profile } = useSupabase();
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-8 p-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
            <BookOpen size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Currículo por Grado</h2>
            <p className="text-slate-500">Gestión de materias y asignaciones académicas</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-lg">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
              Configurando Año:
            </span>
            <span className="text-sm font-black text-brand-accent tracking-tight">
              {selectedYear}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {state.courses.map((course) => {
          // Buscamos qué materias tiene este curso asignadas
          const courseAssignments = state.assignments.filter((a) => a.courseId === course.id);
          const assignedSubjectIds = courseAssignments.map((a) => a.subjectId);

          return (
            <div
              key={course.id}
              className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">
                    {course.grade} {course.section}
                  </h3>
                  <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">
                    {course.level}
                  </p>
                </div>
                <span className="bg-slate-50 text-slate-400 text-[10px] font-bold px-3 py-1 rounded-full border border-slate-100">
                  {courseAssignments.length} MATERIAS
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {state.subjects.map((subject) => {
                  const isAssigned = assignedSubjectIds.includes(subject.id);
                  const assignment = courseAssignments.find((a) => a.subjectId === subject.id);
                  const teacher = assignment
                    ? state.teachers.find((t) => t.id === assignment.teacherId)
                    : null;

                  return (
                    <div
                      key={subject.id}
                      className={`group relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                        isAssigned
                          ? 'bg-indigo-50 border-indigo-100 text-indigo-700'
                          : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200'
                      }`}
                    >
                      {isAssigned ? (
                        <CheckCircle2 size={14} className="text-indigo-500" />
                      ) : (
                        <Plus size={14} className="text-slate-300" />
                      )}
                      {subject.name}

                      {isAssigned && teacher && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 w-48">
                          <div className="bg-slate-800 text-white text-[10px] p-2 rounded-lg shadow-xl">
                            <p className="font-bold opacity-70">DOCENTE:</p>
                            <p>{teacher.name}</p>
                          </div>
                          <div className="w-2 h-2 bg-slate-800 rotate-45 mx-auto -mt-1"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {courseAssignments.length === 0 && (
                <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-2xl border border-amber-100 mt-4 text-amber-700">
                  <AlertCircle size={18} />
                  <p className="text-xs font-medium">
                    Este curso aún no tiene materias ni docentes asignados.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
