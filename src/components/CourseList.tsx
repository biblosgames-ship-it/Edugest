import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, BookOpen, Users, Clock, Pencil, Trash2, X, Save } from 'lucide-react';

export const CourseList = () => {
  const { state, addCourse, deleteCourse } = useApp();
  const [showForm, setShowForm] = useState(false);

  const courses = state.courses || [];

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-900 uppercase">Cursos y Secciones</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] shadow-lg"
        >
          <Plus size={14} /> Nuevo
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {courses.map((course) => (
          <div
            key={course.id}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-lg hover:shadow-xl transition-all group relative"
          >
            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <button className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                <Pencil size={12} />
              </button>
              <button
                onClick={() => deleteCourse(course.id)}
                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
              >
                <Trash2 size={12} />
              </button>
            </div>

            <div className="bg-slate-50 w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 mb-3">
              <BookOpen size={18} />
            </div>

            <h3 className="text-sm font-black text-slate-900 uppercase leading-tight">
              {course.grade} "{course.section}"
            </h3>
            <p className="text-[8px] font-black uppercase tracking-widest text-indigo-500 mb-3">
              {course.level}
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-slate-50">
              <div className="flex items-center gap-1.5">
                <Users size={12} className="text-slate-300" />
                <span className="text-[9px] font-bold text-slate-600 uppercase">
                  {course.student_count || 0} Est.
                </span>
              </div>
              <div className="text-[8px] font-black text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded-md">
                {course.tanda}
              </div>
            </div>
          </div>
        ))}
      </div>

      {courses.length === 0 && (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center">
          <p className="text-slate-300 font-black uppercase text-[10px] tracking-widest">
            No hay cursos registrados
          </p>
        </div>
      )}
    </div>
  );
};
