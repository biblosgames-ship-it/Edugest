import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useApp, useSupabase } from '../context/AppContext';
import { useStats } from '../hooks/useStats';
import { Dashboard } from '../components/Dashboard';
import { StudentManagement } from '../components/StudentManagement';
import { GeneralReports } from '../components/GeneralReports';
import { DigitalRegister } from '../components/DigitalRegister';
import { GradeReports } from '../components/GradeReports';
import { ScheduleViewer } from '../components/ScheduleViewer';
import { ControlDashboard } from '../components/ControlDashboard';
import { TeacherPerformanceModule } from '../components/TeacherPerformanceModule';
import { ComplianceDashboard } from '../components/ComplianceDashboard';
import { Agenda } from '../components/Agenda';
import { CommunicationGenerator } from '../components/CommunicationGenerator';
import { AdminDashboard } from '../components/AdminDashboard';
import { CourseForm } from '../components/CourseForm';
import { TeacherForm } from '../components/TeacherForm';
import { SubjectForm } from '../components/SubjectForm';
import { AssignmentForm } from '../components/AssignmentForm';
import { AcademicRequirementForm } from '../components/AcademicRequirementForm';
import { PreferencesForm } from '../components/PreferencesForm';
import { MainLayout } from '../components/layout/MainLayout';
import { BookOpen, Book, Users, Link, Sliders } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const AppRoutes = () => {
  const { profile, user } = useSupabase();
  const { selectedYear } = useApp();
  const { data: stats } = useStats();
  const [dataView, setDataView] = useState('course');
  const navigate = useNavigate();

  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="students" element={<StudentManagement />} />
        <Route path="reports" element={<GeneralReports />} />
        <Route
          path="register"
          element={
            <DigitalRegister
              onViewChange={(v: string) => navigate(v === 'dashboard' ? '/' : `/${v}`)}
            />
          }
        />
        <Route
          path="grade-reports"
          element={
            <GradeReports
              onViewChange={(v: string) => navigate(v === 'dashboard' ? '/' : `/${v}`)}
            />
          }
        />
        <Route path="schedule" element={<ScheduleViewer />} />
        <Route path="control" element={<ControlDashboard />} />
        <Route path="teacher-performance" element={<TeacherPerformanceModule />} />
        <Route path="compliance" element={<ComplianceDashboard />} />
        <Route path="agenda" element={<Agenda readOnly={false} />} />
        <Route path="communications" element={<CommunicationGenerator userData={profile} />} />
        <Route path="admin" element={<AdminDashboard />} />

        {/* Gestión de Datos con pestañas internas (manteniendo lógica original por ahora) */}
        <Route
          path="data"
          element={
            <div className="card p-8 bg-surface rounded-[2.5rem] border border-border-main shadow-xl">
              <div className="flex gap-4 mb-10 border-b border-border-main overflow-x-auto pb-2 text-[10px] font-black uppercase tracking-widest">
                {[
                  { id: 'course', label: 'Cursos', icon: BookOpen },
                  { id: 'subject', label: 'Materias', icon: Book },
                  { id: 'teacher', label: 'Docentes', icon: Users },
                  { id: 'assignment', label: 'Asignaciones', icon: Link },
                  { id: 'requirement', label: 'Requisitos', icon: Sliders },
                  { id: 'preferences', label: 'Preferencias', icon: Sliders }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setDataView(item.id as any)}
                    className={`flex items-center gap-2 pb-4 px-2 border-b-2 transition-all ${dataView === item.id ? 'text-brand-blue border-brand-blue' : 'border-transparent text-text-muted'}`}
                  >
                    <item.icon size={18} /> {item.label}
                  </button>
                ))}
              </div>
              <div className="w-full">
                {dataView === 'course' && <CourseForm />}
                {dataView === 'teacher' && <TeacherForm />}
                {dataView === 'subject' && <SubjectForm />}
                {dataView === 'assignment' && <AssignmentForm />}
                {dataView === 'requirement' && <AcademicRequirementForm />}
                {dataView === 'preferences' && <PreferencesForm />}
              </div>
            </div>
          }
        />

        {/* Redirección por defecto */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};
