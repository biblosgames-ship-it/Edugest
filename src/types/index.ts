export type Level = 'Inicial' | 'Primario' | 'Secundario' | 'General';
export type Tanda = 'Matutina' | 'Vespertina' | 'Nocturna';
export type Cycle = 'Primer Ciclo' | 'Segundo Ciclo';
export type Modality = 'Académica' | 'Técnico-Profesional' | 'Artes';
export type Output =
  | 'Ciencias y Tecnología'
  | 'Humanidades y Lenguas Modernas'
  | 'Ciencias Sociales y Humanidades'
  | 'Ciencias Económicas y Financieras'
  | 'Artes'
  | 'N/A'
  | 'General';
export type Day = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo';

export interface Course {
  id: string;
  level: Level;
  grade: string;
  section: string;
  studentCount: number;
  tanda: Tanda;
  cycle: Cycle;
  modality: Modality;
  output: Output;
}

export interface AcademicRequirement {
  id: string;
  cycle: Cycle;
  modality: Modality;
  output: Output;
  weeklyHours: number;
  classDurationMinutes: number;
}

export interface TeacherPreference {
  id?: string;
  teacherId: string;
  workingDays: Day[];
  morningStart?: string;
  morningEnd?: string;
  afternoonStart?: string;
  afternoonEnd?: string;
  dailyConfig?: Record<
    string,
    {
      mStart?: string;
      mEnd?: string;
      aStart?: string;
      aEnd?: string;
    }
  >;
}

export interface BreakPreference {
  id: string;
  startTime: string;
  durationMinutes: number;
  level: Level;
  cycle: Cycle | 'General';
}

export interface PriorityPreference {
  id?: string;
  level: Level;
  cycle: Cycle | 'General';
  targetType: 'subject' | 'teacher';
  targetId: string;
  score: number;
}

export interface WinterSchedulePreference {
  reductionFactor: number; // e.g., 0.9 for 10% reduction
  startDate: string;
  endDate: string;
}

export interface Subject {
  id: string;
  name: string;
  hoursPerWeek: number;
  level: Level;
  isPedagogicalBlock: boolean; // Para Nivel Inicial
  distributionType: 'together' | 'separated' | 'divided' | 'mixed';
  area?: string;
}

export interface Teacher {
  id: string;
  name: string;
  subjectIds: string[]; // Subject IDs
  hoursAvailable: number;
  preferredDays: Day[];
  area?: string;
}

export interface Assignment {
  id: string;
  courseId: string;
  subjectId: string;
  teacherId: string;
  hoursPerWeek: number;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  type: 'normal' | 'laboratory' | 'computer' | 'other';
}

export interface TimeBlock {
  id: string;
  day: 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo';
  startTime: string; // e.g., "08:00"
  endTime: string; // e.g., "09:00"
}

export interface ScheduleEntry {
  id: string;
  courseId: string;
  subjectId: string;
  teacherId: string;
  roomId: string;
  timeBlockId: string;
}

export interface AppState {
  attendanceRecords: any[];
  avoidDeporteDuringAnyBreak?: boolean;
}

export interface AttendanceRecord {
  id: string;
  teacherId: string;
  date: string; // YYYY-MM-DD
  status:
    | 'asistencia'
    | 'tardanza'
    | 'ausencia'
    | 'calificaciones'
    | 'planificacion'
    | 'acompanamiento';
  notes?: string;
}

export interface Task {
  id: string;
  courseId: string;
  subjectId: string;
  teacherId: string;
  title: string;
  description: string;
  dueDate: string;
}

export interface Announcement {
  id: string;
  courseId: string; // 'all' for all courses
  senderId: string;
  senderRole: 'admin' | 'teacher';
  title: string;
  content: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  studentId: string; // Or courseId if broadcasted
  title: string;
  content: string;
  timestamp: string;
  read: boolean;
}

export interface PerformanceAlert {
  id: string;
  teacherId: string;
  type: 'calificaciones' | 'planificacion' | 'acompanamiento' | 'clases' | 'tardanza' | 'ausencia';
  status: 'pendiente' | 'resuelta';
  date: string;
  description: string;
}

export interface TeacherPerformanceStats {
  teacherId: string;
  compliancePercentage: number;
  punctualityLevel: 'alto' | 'medio' | 'bajo';
  academicResponsibility: 'alta' | 'media' | 'baja';
  activeAlerts: number;
}

export type ActivityType = 'event' | 'incident' | 'meeting' | 'pedagogical_group';

export interface Activity {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  type: ActivityType;
  courseId?: string; // Optional link to course
  scheduleEntryId?: string; // Optional link to schedule entry
}
