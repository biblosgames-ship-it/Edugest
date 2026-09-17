import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { dataService } from '../services/dataService';
import {
  Send,
  Users,
  Inbox,
  SendHorizontal,
  Info,
  Trash2,
  Calendar,
  Reply,
  Search,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  MessageSquare,
  Clock,
  X
} from 'lucide-react';

export const CommunicationGenerator = ({ userData: profile }: { userData: any }) => {
  const { state, center, selectedYear } = useApp();
  const [activeTab, setActiveTab] = useState<'inbox' | 'compose' | 'sent'>('inbox');
  const [communications, setCommunications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMotiveFilter] = useState('ALL');

  // Role helpers
  const userRole = (profile?.role || '').toLowerCase();
  const isParent = ['parent', 'padre', 'madre', 'tutor', 'familiar'].includes(userRole);
  const isTeacher = userRole === 'teacher';
  const isAdminOrManagement = [
    'admin',
    'management_teacher',
    'coordinator',
    'director',
    'directora',
    'secretaria',
    'secretario',
    'secretaría',
    'psicologia',
    'orientacion',
    'finance',
    'management'
  ].includes(userRole);
  const isStudent = userRole === 'student';

  // Inline quick reply state for Inbox
  const [replyingCommId, setReplyingCommId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyMotive, setReplyMotive] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Form State
  const [motives, setMotives] = useState<string[]>([
    'Excusa Médica / Ausencia',
    'Rendimiento Académico',
    'Seguimiento / Conducta',
    'Aviso Importante',
    'Convocatoria a Reunión',
    'Tarea o Asignación',
    'Felicitación / Reconocimiento',
    'Comunicado General'
  ]);
  const [newMotiveCustom, setNewMotiveCustom] = useState('');
  const [selectedMotive, setSelectedMotive] = useState(motives[0]);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Excuse specific states
  const [excuseDurationType, setExcuseDurationType] = useState<'12h' | '24h' | '48h' | '3d' | '5d' | 'custom'>('12h');
  const [excuseCustomHours, setExcuseCustomHours] = useState<number>(12);
  const [excuseCustomUntilDate, setExcuseCustomUntilDate] = useState<string>('');
  const [excuseColor, setExcuseColor] = useState<string>('amber'); // 'amber', 'indigo', 'emerald', 'rose', 'purple'


  // Recipient modes for different roles
  const [teacherTargetMode, setTeacherTargetMode] = useState<'student_parent' | 'entire_course' | 'management'>('student_parent');
  const [adminTargetMode, setAdminTargetMode] = useState<'teachers' | 'student_parent' | 'courses' | 'roles'>('teachers');

  // Form selections
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [studentSearch] = useState('');

  // Parent specific states: children list
  const [parentChildren, setParentChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [parentTeacherTarget, setParentTeacherTarget] = useState<string>('');

  // Success / Feedback notification
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Load communications
  const fetchCommunications = async () => {
    const targetCid = profile?.center_id || center?.id;
    if (!profile?.id || !targetCid) return;
    try {
      setIsLoading(true);
      const data = await dataService.getCommunications(profile.id, profile.role || 'student', targetCid);
      setCommunications(data || []);
    } catch (error) {
      console.error('Error al cargar comunicaciones:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunications();
  }, [profile?.id, profile?.center_id, center?.id]);

  // Load parent linked children
  useEffect(() => {
    const loadParentChildren = async () => {
      if (!isParent || !profile?.id || !profile?.center_id) return;
      try {
        const candidateStudentIds = new Set<string>();
        if (profile.student_id) candidateStudentIds.add(profile.student_id);

        const { data: pLinks } = await supabase
          .from('parents')
          .select('student_id')
          .eq('profile_id', profile.id);
        (pLinks || []).forEach((p: any) => {
          if (p.student_id) candidateStudentIds.add(p.student_id);
        });

        let foundStudents: any[] = [];
        if (candidateStudentIds.size > 0) {
          const { data: dbStudents } = await supabase
            .from('students')
            .select('*')
            .in('id', Array.from(candidateStudentIds));
          if (dbStudents && dbStudents.length > 0) {
            foundStudents = dbStudents;
          }
        }

        if (foundStudents.length === 0 && (state.students || []).length > 0) {
          let cleanName = (profile.full_name || '').toLowerCase();
          cleanName = cleanName.replace('(padre/madre)', '').replace('(tutor)', '').trim();
          const match = state.students.find((s: any) => {
            const sName = `${s.names || ''} ${s.first_surname || ''} ${s.second_surname || ''}`.toLowerCase();
            return (
              sName.includes(cleanName) ||
              (s.tutor_name && s.tutor_name.toLowerCase().includes(cleanName))
            );
          });
          if (match) {
            if (match.family_id) {
              foundStudents = state.students.filter((s: any) => s.family_id === match.family_id);
            } else {
              foundStudents = [match];
            }
          }
        }

        if (foundStudents.length === 0 && profile.parent_course_ids?.length > 0) {
          const inCourse = state.students.filter((s: any) =>
            profile.parent_course_ids.includes(s.course_id)
          );
          if (inCourse.length > 0) foundStudents = inCourse.slice(0, 5);
        }

        setParentChildren(foundStudents);
        if (foundStudents.length > 0 && !selectedChildId) {
          setSelectedChildId(foundStudents[0].id);
        }
      } catch (err) {
        console.error('Error al obtener hijos vinculados:', err);
      }
    };

    loadParentChildren();
  }, [isParent, profile?.id, profile?.center_id, profile?.parent_course_ids, state.students]);

  // Split into inbox (received) and sent
  const inboxComms = useMemo(() => {
    return communications.filter((c) => c.sender_id !== profile?.id);
  }, [communications, profile?.id]);

  const sentComms = useMemo(() => {
    return communications.filter((c) => c.sender_id === profile?.id);
  }, [communications, profile?.id]);

  // Course name lookup
  const getCourseName = (id: string) => {
    const course = state.courses.find((c) => c.id === id);
    return course
      ? `${course.level} ${course.grade} "${course.section}" (${course.tanda || 'Matutina'})`
      : 'Curso General';
  };

  // Teacher name lookup
  const getTeacherName = (id: string) => {
    const teacher = state.teachers.find((t) => t.id === id || t.user_id === id || t.teacher_id === id);
    return teacher ? teacher.full_name : id;
  };

  // Available courses for the current user
  const availableCourses = useMemo(() => {
    if (isAdminOrManagement) return state.courses;
    if (isTeacher) {
      const teacherId = profile?.teacher_id || profile?.id;
      const assignedCourseIds = new Set<string>();
      (state.assignments || []).forEach((a) => {
        if (a.teacher_id === teacherId || a.teacher_id === profile?.id) {
          assignedCourseIds.add(a.course_id);
        }
      });
      state.courses.forEach((c) => {
        if (c.titular_teacher_id === teacherId || c.titular_teacher_id === profile?.id) {
          assignedCourseIds.add(c.id);
        }
      });
      const filtered = state.courses.filter((c) => assignedCourseIds.has(c.id));
      return filtered.length > 0 ? filtered : state.courses;
    }
    return state.courses;
  }, [isAdminOrManagement, isTeacher, profile?.teacher_id, profile?.id, state.courses, state.assignments]);

  // Auto-select initial course if empty
  useEffect(() => {
    if (!selectedCourseId && availableCourses.length > 0) {
      setSelectedCourseId(availableCourses[0].id);
    }
  }, [availableCourses, selectedCourseId]);

  // Students in selected course
  const studentsInCourse = useMemo(() => {
    if (!selectedCourseId) return [];
    return (state.students || [])
      .filter((s) => s.course_id === selectedCourseId)
      .sort((a, b) => (a.names || '').localeCompare(b.names || ''));
  }, [selectedCourseId, state.students]);

  // Filtered students for quick search
  const filteredStudentsInCourse = useMemo(() => {
    if (!studentSearch.trim()) return studentsInCourse;
    const q = studentSearch.toLowerCase();
    return studentsInCourse.filter((s) => {
      const full = `${s.names || ''} ${s.first_surname || ''} ${s.second_surname || ''}`.toLowerCase();
      const tutor = (s.tutor_name || '').toLowerCase();
      return full.includes(q) || tutor.includes(q);
    });
  }, [studentsInCourse, studentSearch]);

  // Selected student object
  const selectedStudentObj = useMemo(() => {
    return state.students.find((s) => s.id === selectedStudentId);
  }, [selectedStudentId, state.students]);

  // Selected child object for parent
  const selectedChildObj = useMemo(() => {
    return parentChildren.find((c) => c.id === selectedChildId);
  }, [selectedChildId, parentChildren]);

  // Teachers of the selected child's course
  const childCourseTeachers = useMemo(() => {
    if (!selectedChildObj || !selectedChildObj.course_id) return [];
    const course = state.courses.find((c) => c.id === selectedChildObj.course_id);
    const teacherMap = new Map<string, { id: string; name: string; roleDesc: string }>();

    // Titular teacher
    if (course?.titular_teacher_id) {
      const titular = state.teachers.find(
        (t) => t.id === course.titular_teacher_id || t.teacher_id === course.titular_teacher_id
      );
      if (titular) {
        teacherMap.set(titular.id, {
          id: titular.id,
          name: titular.full_name,
          roleDesc: 'Profesor(a) Titular'
        });
      }
    }

    // Subject assignments
    (state.assignments || [])
      .filter((a) => a.course_id === selectedChildObj.course_id)
      .forEach((a) => {
        const teacher = state.teachers.find((t) => t.id === a.teacher_id || t.teacher_id === a.teacher_id);
        const subject = state.subjects.find((s) => s.id === a.subject_id);
        if (teacher && !teacherMap.has(teacher.id)) {
          teacherMap.set(teacher.id, {
            id: teacher.id,
            name: teacher.full_name,
            roleDesc: subject ? `Docente de ${subject.name}` : 'Docente de Asignatura'
          });
        }
      });

    // Fallback: If map is empty, list all teachers in the center
    if (teacherMap.size === 0) {
      state.teachers.slice(0, 10).forEach((t) => {
        teacherMap.set(t.id, {
          id: t.id,
          name: t.full_name,
          roleDesc: 'Docente'
        });
      });
    }

    return Array.from(teacherMap.values());
  }, [selectedChildObj, state.courses, state.assignments, state.teachers, state.subjects]);

  // Auto-select first teacher for parent
  useEffect(() => {
    if (isParent && childCourseTeachers.length > 0 && !parentTeacherTarget) {
      setParentTeacherTarget(childCourseTeachers[0].id);
    }
  }, [isParent, childCourseTeachers, parentTeacherTarget]);

  // Reply handler from Inbox
  const handleReply = (comm: any) => {
    handleToggleReply(comm);
  };

  // Toggle inline reply directly in Inbox without navigating away to compose panel
  const handleToggleReply = (comm: any) => {
    if (replyingCommId === comm.id) {
      setReplyingCommId(null);
      setReplyText('');
      setReplyMotive('');
    } else {
      setReplyingCommId(comm.id);
      setReplyMotive(`Re: ${comm.motive || 'Comunicado'}`);
      setReplyText('');
    }
  };

  // Send inline reply directly back to sender without leaving inbox
  const handleSendInlineReply = async (comm: any) => {
    if (!replyText.trim()) {
      alert('Por favor escribe el contenido de la respuesta.');
      return;
    }

    const centerId = profile?.center_id || center?.id;
    if (!centerId) {
      alert('Error: Identificador del centro no disponible.');
      return;
    }

    setIsSendingReply(true);
    try {
      let targetRoles: string[] = [];
      let targetCourses: string[] = comm.target_courses || [];
      let targetTeachers: string[] = [];
      let targetStudentIds: string[] = comm.target_student_ids || [];
      let targetParentIds: string[] = comm.target_parent_ids || [];
      let targetUserIds: string[] = [];

      if (comm.sender_id) {
        targetUserIds.push(comm.sender_id);
      }

      // Check if original sender was a teacher
      const teacherObj = (state.teachers || []).find(
        (t: any) =>
          t.id === comm.sender_id ||
          t.teacher_id === comm.sender_id ||
          (t.user_id && t.user_id === comm.sender_id)
      );

      if (teacherObj) {
        targetTeachers.push(teacherObj.id);
        targetRoles.push('Docentes');
      } else if (comm.target_student_ids && comm.target_student_ids.length > 0) {
        if (comm.sender_id) targetParentIds.push(comm.sender_id);
        targetRoles.push('Padres');
      } else {
        if (comm.sender_id) targetParentIds.push(comm.sender_id);
      }

      const roleSuffix =
        profile?.role === 'secretaria' || profile?.role === 'secretario'
          ? ' (Secretaría)'
          : isAdminOrManagement
            ? ' (Dirección/Gestión)'
            : isTeacher
              ? ' (Docente)'
              : isParent
                ? ' (Tutor)'
                : '';

      await dataService.saveCommunication({
        center_id: centerId,
        sender_id: profile.id,
        sender_name: `${profile.full_name || 'Personal'}${roleSuffix}`,
        motive: replyMotive.trim() || `Re: ${comm.motive || 'Comunicado'}`,
        message: replyText.trim(),
        target_roles: targetRoles,
        target_courses: targetCourses,
        target_teachers: Array.from(new Set(targetTeachers)),
        target_student_ids: Array.from(new Set(targetStudentIds)),
        target_student_name: comm.target_student_name,
        target_parent_ids: Array.from(new Set(targetParentIds)),
        target_user_ids: Array.from(new Set(targetUserIds))
      });

      setSuccessNotice(`Respuesta enviada exitosamente a ${comm.sender_name}`);
      setReplyingCommId(null);
      setReplyText('');
      setReplyMotive('');
      await fetchCommunications();

      setTimeout(() => {
        setSuccessNotice(null);
      }, 3500);
    } catch (error: any) {
      console.error('Error enviando respuesta directa:', error);
      alert('Hubo un error al enviar la respuesta: ' + (error?.message || 'Intente nuevamente'));
    } finally {
      setIsSendingReply(false);
    }
  };

  // Add custom motive
  const addCustomMotive = () => {
    if (newMotiveCustom.trim() && !motives.includes(newMotiveCustom.trim())) {
      const added = newMotiveCustom.trim();
      setMotives([added, ...motives]);
      setSelectedMotive(added);
      setNewMotiveCustom('');
    }
  };

  // Submit message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageText.trim()) {
      alert('Por favor escribe el contenido del mensaje.');
      return;
    }

    const centerId = profile?.center_id || center?.id;
    if (!centerId) {
      alert('Error: No se encontró el identificador del centro educativo.');
      return;
    }

    let targetRoles: string[] = [];
    let targetCourses: string[] = [];
    let targetTeachers: string[] = [];
    let targetStudentIds: string[] = [];
    let targetStudentName: string | undefined = undefined;

    if (isParent) {
      if (!selectedChildObj) {
        alert('Por favor selecciona el estudiante/hijo relacionado a este mensaje.');
        return;
      }
      targetStudentIds = [selectedChildObj.id];
      targetStudentName = `${selectedChildObj.names || ''} ${selectedChildObj.first_surname || ''}`.trim();
      if (selectedChildObj.course_id) {
        targetCourses = [selectedChildObj.course_id];
      }

      if (parentTeacherTarget === 'MANAGEMENT') {
        targetRoles = ['Equipo de Gestión', 'Dirección'];
      } else if (parentTeacherTarget === 'PSYCHOLOGY') {
        targetRoles = ['Orientación y Psicología'];
      } else if (parentTeacherTarget) {
        targetTeachers = [parentTeacherTarget];
      } else {
        targetRoles = ['Docentes'];
      }
    } else if (isTeacher) {
      if (teacherTargetMode === 'student_parent') {
        if (!selectedStudentId) {
          alert('Por favor selecciona el alumno/tutor destinatario.');
          return;
        }
        targetStudentIds = [selectedStudentId];
        if (selectedStudentObj) {
          targetStudentName = `${selectedStudentObj.names || ''} ${selectedStudentObj.first_surname || ''}`.trim();
        }
        if (selectedCourseId) {
          targetCourses = [selectedCourseId];
        }
        targetRoles = ['Padres'];
      } else if (teacherTargetMode === 'entire_course') {
        if (!selectedCourseId) {
          alert('Por favor selecciona el curso.');
          return;
        }
        targetCourses = [selectedCourseId];
        targetRoles = selectedRoles.length > 0 ? selectedRoles : ['Padres', 'Alumnos'];
      } else if (teacherTargetMode === 'management') {
        targetRoles = ['Equipo de Gestión', 'Dirección', 'Coordinación'];
      }
    } else if (isAdminOrManagement) {
      if (adminTargetMode === 'teachers') {
        if (selectedTeacherIds.length === 0) {
          alert('Por favor selecciona al menos un docente.');
          return;
        }
        targetTeachers = selectedTeacherIds;
        targetRoles = ['Docentes'];
      } else if (adminTargetMode === 'student_parent') {
        if (!selectedStudentId) {
          alert('Por favor selecciona el estudiante/tutor.');
          return;
        }
        targetStudentIds = [selectedStudentId];
        if (selectedStudentObj) {
          targetStudentName = `${selectedStudentObj.names || ''} ${selectedStudentObj.first_surname || ''}`.trim();
        }
        if (selectedCourseId) targetCourses = [selectedCourseId];
        targetRoles = ['Padres'];
      } else if (adminTargetMode === 'courses') {
        if (selectedCourses.length === 0) {
          alert('Por favor selecciona al menos un curso.');
          return;
        }
        targetCourses = selectedCourses;
        targetRoles = selectedRoles.length > 0 ? selectedRoles : ['Toda la comunidad'];
      } else if (adminTargetMode === 'roles') {
        if (selectedRoles.length === 0) {
          alert('Por favor selecciona al menos un rol.');
          return;
        }
        targetRoles = selectedRoles;
      }
    } else if (isStudent) {
      if (selectedTeacherIds.length === 0 && !parentTeacherTarget) {
        targetRoles = ['Docentes'];
      } else {
        targetTeachers = selectedTeacherIds.length > 0 ? selectedTeacherIds : [parentTeacherTarget];
      }
      if (profile?.course_id) {
        targetCourses = [profile.course_id];
      }
      if (profile?.student_id) {
        targetStudentIds = [profile.student_id];
      }
      targetStudentName = profile?.full_name;
    }

    setIsSending(true);
    try {
      const isExcuseMotive = (selectedMotive || '').toLowerCase().includes('excus') || (selectedMotive || '').toLowerCase().includes('ausenc');
      let calculatedValidUntil: string | undefined = undefined;
      let calculatedDurationHours: number | undefined = undefined;

      if (isExcuseMotive) {
        let hours = 12;
        if (excuseDurationType === '12h') hours = 12;
        else if (excuseDurationType === '24h') hours = 24;
        else if (excuseDurationType === '48h') hours = 48;
        else if (excuseDurationType === '3d') hours = 72;
        else if (excuseDurationType === '5d') hours = 120;
        else if (excuseDurationType === 'custom') {
          if (excuseCustomUntilDate) {
            calculatedValidUntil = new Date(excuseCustomUntilDate).toISOString();
          } else {
            hours = Math.max(1, excuseCustomHours || 12);
          }
        }
        calculatedDurationHours = hours;
        if (!calculatedValidUntil) {
          calculatedValidUntil = new Date(Date.now() + hours * 3600 * 1000).toISOString();
        }
      }

      const senderSuffix = isParent ? ' (Tutor)' : isTeacher ? ' (Docente)' : '';
      await dataService.saveCommunication({
        center_id: centerId,
        sender_id: profile.id,
        sender_name: (profile.full_name || 'Usuario') + senderSuffix,
        motive: selectedMotive,
        message: messageText.trim(),
        target_roles: targetRoles,
        target_courses: targetCourses,
        target_teachers: targetTeachers,
        target_student_ids: targetStudentIds,
        target_student_name: targetStudentName,
        valid_until: calculatedValidUntil,
        excuse_color: isExcuseMotive ? excuseColor : undefined,
        duration_hours: calculatedDurationHours
      });

      setSuccessNotice('¡Mensaje enviado y registrado exitosamente!');
      setMessageText('');
      setSelectedStudentId('');
      setSelectedTeacherIds([]);
      fetchCommunications();

      setTimeout(() => {
        setSuccessNotice(null);
        setActiveTab('sent');
      }, 1500);
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      alert('Hubo un error al enviar el mensaje. Por favor intenta nuevamente.');
    } finally {
      setIsSending(false);
    }
  };

  // Delete message
  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este mensaje?')) return;
    try {
      await dataService.deleteCommunication(id);
      fetchCommunications();
    } catch (error) {
      console.error('Error al eliminar mensaje:', error);
      alert('No se pudo eliminar el mensaje.');
    }
  };

  // Filter messages based on search query and motive
  const filterList = (list: any[]) => {
    return list.filter((comm) => {
      const matchesMotive = selectedMotiveFilter === 'ALL' || comm.motive === selectedMotiveFilter;
      if (!matchesMotive) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const sName = (comm.sender_name || '').toLowerCase();
      const stName = (comm.target_student_name || '').toLowerCase();
      const msg = (comm.message || '').toLowerCase();
      const mot = (comm.motive || '').toLowerCase();
      return sName.includes(q) || stName.includes(q) || msg.includes(q) || mot.includes(q);
    });
  };

  const displayedInbox = useMemo(() => filterList(inboxComms), [inboxComms, searchQuery, selectedMotiveFilter]);
  const displayedSent = useMemo(() => filterList(sentComms), [sentComms, searchQuery, selectedMotiveFilter]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fade-in">
      {/* HEADER */}
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-150 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 shrink-0">
            <MessageSquare size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Mensajería Interna
              </h1>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-full tracking-wider border border-indigo-150">
                {isParent ? 'Familia / Tutor' : isTeacher ? 'Docente' : isAdminOrManagement ? 'Gestión' : 'Estudiante'}
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">
              Canal oficial y directo de comunicación escrita para la comunidad educativa.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setActiveTab('compose');
            setMessageText('');
          }}
          className="w-full md:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
        >
          <Send size={16} />
          Redactar Mensaje
        </button>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('inbox')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'inbox'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-150'
            }`}
          >
            <Inbox size={16} />
            <span>Bandeja de Entrada</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'inbox' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {inboxComms.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('compose')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'compose'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-150'
            }`}
          >
            <SendHorizontal size={16} />
            <span>Nuevo Mensaje</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sent')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'sent'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-150'
            }`}
          >
            <Clock size={16} />
            <span>Enviados</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'sent' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {sentComms.length}
            </span>
          </button>
        </div>

        {activeTab !== 'compose' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar remitente, motivo o texto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>
        )}
      </div>

      {/* SUCCESS NOTICE BANNER */}
      {successNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-bold animate-fade-in shadow-sm">
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* TAB 1: BANDEJA DE ENTRADA (INBOX) */}
      {activeTab === 'inbox' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-150 text-center text-slate-400">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-bold uppercase tracking-wider">Cargando mensajes recibidos...</p>
            </div>
          ) : displayedInbox.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-150 text-center space-y-3">
              <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 mx-auto">
                <Inbox size={32} />
              </div>
              <h3 className="text-base font-black text-slate-700">No hay mensajes recibidos</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {searchQuery
                  ? 'No se encontraron mensajes que coincidan con la búsqueda.'
                  : 'Tu bandeja de entrada está al día. Cuando un docente, padre o directivo te envíe un mensaje, aparecerá aquí.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedInbox.map((comm) => (
                <div
                  key={comm.id}
                  className="bg-white p-6 rounded-3xl border border-slate-150 shadow-xs hover:border-indigo-200 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-full tracking-wider border border-indigo-150">
                        {comm.motive || 'Comunicado'}
                      </span>
                      {comm.target_student_name && (
                        <span className="px-3 py-1 bg-amber-50 text-amber-800 text-[10px] font-black uppercase rounded-full tracking-wider border border-amber-200 flex items-center gap-1">
                          <GraduationCap size={12} />
                          Alumno: {comm.target_student_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
                      <Calendar size={13} />
                      <span>{new Date(comm.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 font-semibold flex items-center gap-2">
                      <span className="text-slate-400">De:</span>
                      <strong className="text-slate-800 font-bold text-sm">{comm.sender_name}</strong>
                    </p>
                  </div>

                  <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs md:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {comm.message}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => handleToggleReply(comm)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                        replyingCommId === comm.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      <Reply size={14} />
                      {replyingCommId === comm.id ? 'Ocultar respuesta' : 'Responder'}
                    </button>

                    {isAdminOrManagement && (
                      <button
                        type="button"
                        onClick={() => handleDelete(comm.id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                        title="Eliminar mensaje"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {/* CAJA DE RESPUESTA DIRECTA EN LA MISMA BANDEJA */}
                  {replyingCommId === comm.id && (
                    <div className="mt-3 pt-4 border-t border-indigo-100 bg-indigo-50/50 -mx-6 -mb-6 p-6 rounded-b-3xl space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                            <Reply size={14} />
                          </div>
                          <div>
                            <span className="text-xs font-black text-indigo-950 uppercase tracking-tight">
                              Respuesta para: <span className="text-indigo-600 font-extrabold">{comm.sender_name}</span>
                            </span>
                            {comm.target_student_name && (
                              <p className="text-[10px] font-bold text-amber-700">
                                🎓 Estudiante relacionado: {comm.target_student_name}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplyingCommId(null)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors cursor-pointer"
                          title="Cerrar"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          Asunto / Motivo
                        </label>
                        <input
                          type="text"
                          value={replyMotive}
                          onChange={(e) => setReplyMotive(e.target.value)}
                          className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          placeholder="Asunto de la respuesta..."
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          Tu Mensaje de Respuesta
                        </label>
                        <textarea
                          rows={3}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={`Escribe aquí tu respuesta para ${comm.sender_name}...`}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none leading-relaxed"
                          autoFocus
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingCommId(null);
                            setReplyText('');
                          }}
                          className="px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={isSendingReply || !replyText.trim()}
                          onClick={() => handleSendInlineReply(comm)}
                          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                        >
                          {isSendingReply ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <SendHorizontal size={14} />
                          )}
                          <span>Enviar Respuesta</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: NUEVO MENSAJE (COMPOSE) */}
      {activeTab === 'compose' && (
        <form onSubmit={handleSendMessage} className="space-y-6">
          {/* BANNER INFORMATIVO PARA PADRES (SOLO MENSAJE, NO LLAMADAS) */}
          {isParent && (
            <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-3xl flex items-start gap-4 shadow-sm">
              <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center shrink-0">
                <AlertCircle size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
                  Canal Oficial por Mensajería Escrita
                </h4>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Para respetar la docencia activa de los maestros en el aula y los horarios pedagógicos,
                  la comunicación se realiza <strong>exclusivamente vía mensaje escrito</strong> dentro de la plataforma.
                  El docente recibirá tu notificación y podrá responderte a través de este mismo buzón.
                </p>
              </div>
            </div>
          )}

          {/* SELECTOR DE DESTINATARIO SEGÚN EL ROL */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-150 shadow-sm space-y-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Users size={18} className="text-indigo-600" />
              Destinatario del Mensaje
            </h3>

            {/* CASO 1: ES PADRE / TUTOR */}
            {isParent && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* HIJO / ALUMNO */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase text-slate-500">
                    Hijo / Estudiante Relacionado *
                  </label>
                  {parentChildren.length > 0 ? (
                    <select
                      value={selectedChildId}
                      onChange={(e) => setSelectedChildId(e.target.value)}
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      {parentChildren.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.names} {c.first_surname || ''} ({getCourseName(c.course_id)})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-150 rounded-2xl text-xs text-amber-800 font-semibold">
                      Hijo vinculado a la cuenta del tutor
                    </div>
                  )}
                </div>

                {/* DOCENTE O EQUIPO DESTINATARIO */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase text-slate-500">
                    Destinatario *
                  </label>
                  <select
                    value={parentTeacherTarget}
                    onChange={(e) => setParentTeacherTarget(e.target.value)}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <optgroup label="Docentes del Aula">
                      {childCourseTeachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.roleDesc})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Equipo Institucional">
                      <option value="MANAGEMENT">Dirección / Equipo de Gestión</option>
                      <option value="PSYCHOLOGY">Orientación y Psicología</option>
                    </optgroup>
                  </select>
                </div>
              </div>
            )}

            {/* CASO 2: ES DOCENTE */}
            {isTeacher && (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTeacherTargetMode('student_parent')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      teacherTargetMode === 'student_parent'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    👤 Al Padre/Tutor de un Alumno
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherTargetMode('entire_course')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      teacherTargetMode === 'entire_course'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    🏫 A un Curso Completo
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherTargetMode('management')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      teacherTargetMode === 'management'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    🏛️ A Dirección / Equipo de Gestión
                  </button>
                </div>

                {teacherTargetMode === 'student_parent' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black uppercase text-slate-500">
                        Selecciona el Curso
                      </label>
                      <select
                        value={selectedCourseId}
                        onChange={(e) => {
                          setSelectedCourseId(e.target.value);
                          setSelectedStudentId('');
                        }}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        {availableCourses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.level} {c.grade} "{c.section}" - {c.tanda || 'Matutina'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black uppercase text-slate-500">
                        Selecciona el Alumno / Tutor ({studentsInCourse.length})
                      </label>
                      <select
                        value={selectedStudentId}
                        onChange={(e) => setSelectedStudentId(e.target.value)}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="">-- Selecciona un alumno --</option>
                        {filteredStudentsInCourse.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.names} {s.first_surname || ''} {s.tutor_name ? `(Tutor: ${s.tutor_name})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedStudentObj && (
                      <div className="md:col-span-2 p-3 bg-indigo-50/60 border border-indigo-150 rounded-xl flex items-center justify-between text-xs">
                        <span className="text-indigo-900 font-semibold">
                          Tutor registrado: <strong>{selectedStudentObj.tutor_name || 'Tutor Familiar'}</strong>
                        </span>
                        {selectedStudentObj.tutor_phone && (
                          <span className="font-mono text-indigo-700 font-bold">
                            WhatsApp: {selectedStudentObj.tutor_phone}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {teacherTargetMode === 'entire_course' && (
                  <div className="space-y-4 p-5 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black uppercase text-slate-500">
                        Selecciona el Curso
                      </label>
                      <select
                        value={selectedCourseId}
                        onChange={(e) => setSelectedCourseId(e.target.value)}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        {availableCourses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.level} {c.grade} "{c.section}" - {c.tanda || 'Matutina'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-4">
                      {['Padres', 'Alumnos'].map((role) => (
                        <label key={role} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                          <input
                            type="checkbox"
                            checked={selectedRoles.includes(role)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedRoles([...selectedRoles, role]);
                              else setSelectedRoles(selectedRoles.filter((r) => r !== role));
                            }}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{role}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {teacherTargetMode === 'management' && (
                  <div className="p-4 bg-indigo-50/60 border border-indigo-150 rounded-2xl text-xs text-indigo-900 font-medium">
                    🏛️ El mensaje será enviado al <strong>Equipo Directivo, Coordinación y Dirección</strong> del centro.
                  </div>
                )}
              </div>
            )}

            {/* CASO 3: ES ADMINISTRADOR O EQUIPO DE GESTIÓN */}
            {isAdminOrManagement && (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAdminTargetMode('teachers')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      adminTargetMode === 'teachers'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    👨‍🏫 A Docentes Específicos
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminTargetMode('student_parent')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      adminTargetMode === 'student_parent'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    👤 Alumno / Tutor Específico
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminTargetMode('courses')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      adminTargetMode === 'courses'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    🏫 Por Cursos
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminTargetMode('roles')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      adminTargetMode === 'roles'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    📢 Masivo por Rol
                  </button>
                </div>

                {adminTargetMode === 'teachers' && (
                  <div className="space-y-3 p-5 bg-slate-50 rounded-2xl border border-slate-200">
                    <label className="block text-[10px] font-black uppercase text-slate-500">
                      Selecciona Docente(s) ({selectedTeacherIds.length} seleccionados)
                    </label>
                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-2">
                      <label className="flex items-center gap-2 p-2 bg-indigo-50/50 rounded-lg text-xs font-bold text-indigo-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTeacherIds.length === state.teachers.length && state.teachers.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedTeacherIds(state.teachers.map((t) => t.id));
                            else setSelectedTeacherIds([]);
                          }}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Todos los docentes del plantel</span>
                      </label>
                      {state.teachers.map((t) => (
                        <label
                          key={t.id}
                          className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTeacherIds.includes(t.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedTeacherIds([...selectedTeacherIds, t.id]);
                              else setSelectedTeacherIds(selectedTeacherIds.filter((id) => id !== t.id));
                            }}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{t.full_name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {adminTargetMode === 'student_parent' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black uppercase text-slate-500">
                        Selecciona el Curso
                      </label>
                      <select
                        value={selectedCourseId}
                        onChange={(e) => {
                          setSelectedCourseId(e.target.value);
                          setSelectedStudentId('');
                        }}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        {state.courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.level} {c.grade} "{c.section}"
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black uppercase text-slate-500">
                        Selecciona el Alumno / Tutor
                      </label>
                      <select
                        value={selectedStudentId}
                        onChange={(e) => setSelectedStudentId(e.target.value)}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="">-- Selecciona un alumno --</option>
                        {studentsInCourse.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.names} {s.first_surname || ''} {s.tutor_name ? `(Tutor: ${s.tutor_name})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {adminTargetMode === 'courses' && (
                  <div className="space-y-3 p-5 bg-slate-50 rounded-2xl border border-slate-200">
                    <label className="block text-[10px] font-black uppercase text-slate-500">
                      Selecciona los Cursos
                    </label>
                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-2">
                      <label className="flex items-center gap-2 p-2 bg-indigo-50/50 rounded-lg text-xs font-bold text-indigo-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCourses.length === state.courses.length && state.courses.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedCourses(state.courses.map((c) => c.id));
                            else setSelectedCourses([]);
                          }}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Todos los cursos</span>
                      </label>
                      {state.courses.map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCourses.includes(c.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedCourses([...selectedCourses, c.id]);
                              else setSelectedCourses(selectedCourses.filter((id) => id !== c.id));
                            }}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>
                            {c.level} {c.grade} "{c.section}" ({c.tanda || 'Matutina'})
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {adminTargetMode === 'roles' && (
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <label className="block text-[10px] font-black uppercase text-slate-500">
                      Selecciona Roles Destinatarios
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {['Docentes', 'Padres', 'Alumnos', 'Toda la comunidad'].map((role) => (
                        <label
                          key={role}
                          className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRoles.includes(role)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedRoles([...selectedRoles, role]);
                              else setSelectedRoles(selectedRoles.filter((r) => r !== role));
                            }}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{role}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CASO 4: ES ALUMNO */}
            {isStudent && (
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <label className="block text-[10px] font-black uppercase text-slate-500">
                  Selecciona Docente Destinatario
                </label>
                <select
                  value={parentTeacherTarget}
                  onChange={(e) => setParentTeacherTarget(e.target.value)}
                  className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">-- Docentes de mi aula --</option>
                  {state.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* MOTIVO Y CUERPO DEL MENSAJE */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-150 shadow-sm space-y-6">
            <div className="space-y-3">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Info size={16} className="text-indigo-600" />
                Motivo / Asunto
              </label>

              <div className="flex flex-wrap gap-2">
                {motives.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMotive(m)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer ${
                      selectedMotive === m
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Otro motivo personalizado..."
                  value={newMotiveCustom}
                  onChange={(e) => setNewMotiveCustom(e.target.value)}
                  className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={addCustomMotive}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase transition-all cursor-pointer"
                >
                  Añadir
                </button>
              </div>

              {/* OPCIONES ESPECÍFICAS DE VIGENCIA Y COLOR PARA EXCUSAS MÉDICAS / AUSENCIAS */}
              {((selectedMotive || '').toLowerCase().includes('excus') || (selectedMotive || '').toLowerCase().includes('ausenc')) && (
                <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50/50 border-2 border-amber-200 rounded-2xl space-y-3.5 mt-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-amber-600" />
                      <span className="text-xs font-black uppercase tracking-wider text-amber-900">
                        Vigencia y Visibilidad en "Mi Aula"
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-lg uppercase">
                      Por defecto: 12 Horas
                    </span>
                  </div>

                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Esta justificación resaltará automáticamente al alumno en el pase de lista y en la lista de aula con una nota visible, evitando tener que registrarla a diario si la ausencia abarca varias jornadas.
                  </p>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-amber-900">
                      Tiempo de Permanencia:
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {[
                        { id: '12h', label: '12 Horas (Default)' },
                        { id: '24h', label: '24 Horas (1 Día)' },
                        { id: '48h', label: '48 Horas (2 Días)' },
                        { id: '3d', label: '3 Días' },
                        { id: '5d', label: '5 Días (Semana)' },
                        { id: 'custom', label: 'Personalizado' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setExcuseDurationType(opt.id as any)}
                          className={`py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border text-center cursor-pointer ${
                            excuseDurationType === opt.id
                              ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                              : 'bg-white text-amber-900 border-amber-200 hover:bg-amber-100/60'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {excuseDurationType === 'custom' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase text-amber-900">
                          Horas de duración:
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={720}
                          value={excuseCustomHours}
                          onChange={(e) => setExcuseCustomHours(Math.max(1, Number(e.target.value)))}
                          placeholder="Ej. 36"
                          className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase text-amber-900">
                          O fecha y hora límite de fin:
                        </label>
                        <input
                          type="datetime-local"
                          value={excuseCustomUntilDate}
                          onChange={(e) => setExcuseCustomUntilDate(e.target.value)}
                          className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 pt-1">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-amber-900">
                      Color Distintivo del Alumno en Aula:
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      {[
                        { id: 'amber', label: 'Ámbar (Clásico)', bg: 'bg-amber-500', ring: 'ring-amber-500' },
                        { id: 'rose', label: 'Rosa / Urgencia', bg: 'bg-rose-500', ring: 'ring-rose-500' },
                        { id: 'indigo', label: 'Índigo Institucional', bg: 'bg-indigo-600', ring: 'ring-indigo-600' },
                        { id: 'emerald', label: 'Esmeralda', bg: 'bg-emerald-600', ring: 'ring-emerald-600' },
                        { id: 'purple', label: 'Púrpura', bg: 'bg-purple-600', ring: 'ring-purple-600' },
                      ].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setExcuseColor(c.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                            excuseColor === c.id
                              ? 'bg-white border-amber-400 ring-2 ' + c.ring + ' text-slate-900 shadow-sm'
                              : 'bg-white/80 border-amber-200 text-slate-600 hover:bg-white'
                          }`}
                        >
                          <span className={`w-3 h-3 rounded-full ${c.bg}`} />
                          <span>{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                Contenido del Mensaje *
              </label>
              <textarea
                rows={5}
                required
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Escribe de manera respetuosa y detallada el mensaje..."
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs md:text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={isSending || !messageText.trim()}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSending ? (
                <span>Enviando mensaje...</span>
              ) : (
                <>
                  <Send size={18} />
                  <span>Enviar Mensaje</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: MENSAJES ENVIADOS (SENT) */}
      {activeTab === 'sent' && (
        <div className="space-y-4">
          {displayedSent.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-150 text-center space-y-3">
              <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 mx-auto">
                <SendHorizontal size={32} />
              </div>
              <h3 className="text-base font-black text-slate-700">No hay mensajes enviados</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Todos los mensajes que envíes quedarán registrados en esta sección con su detalle y fecha.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedSent.map((comm) => (
                <div
                  key={comm.id}
                  className="bg-white p-6 rounded-3xl border border-slate-150 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-full tracking-wider border border-indigo-150">
                        {comm.motive || 'Mensaje'}
                      </span>
                      {comm.target_student_name && (
                        <span className="px-3 py-1 bg-amber-50 text-amber-800 text-[10px] font-black uppercase rounded-full tracking-wider border border-amber-200 flex items-center gap-1">
                          <GraduationCap size={12} />
                          Alumno: {comm.target_student_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
                      <Clock size={13} />
                      <span>{new Date(comm.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-slate-500 font-semibold">
                    <p>
                      <span className="text-slate-400">Destinatarios:</span>{' '}
                      <span className="text-slate-700 font-bold">
                        {comm.target_student_name
                          ? `Tutor de ${comm.target_student_name}`
                          : comm.target_teachers && comm.target_teachers.length > 0
                          ? `Docentes: ${comm.target_teachers.map(getTeacherName).join(', ')}`
                          : comm.target_courses && comm.target_courses.length > 0
                          ? `Cursos: ${comm.target_courses.map(getCourseName).join(', ')}`
                          : comm.target_roles && comm.target_roles.length > 0
                          ? `Roles: ${comm.target_roles.join(', ')}`
                          : 'Comunidad'}
                      </span>
                    </p>
                  </div>

                  <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs md:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {comm.message}
                    </p>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => handleDelete(comm.id)}
                      className="px-3 py-1.5 text-rose-500 hover:bg-rose-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Trash2 size={14} />
                      Eliminar del registro
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
