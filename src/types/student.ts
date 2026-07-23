export interface ParentGuardian {
  name: string;
  relation: 'Father' | 'Mother' | 'Guardian';
  phone: string;
  secondaryPhone?: string;
  email?: string;
  occupation?: string;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  sex: 'M' | 'F';
  birthDate?: string;
  address?: string;
  gradeId: string;
  section?: string;
  schoolYear: string;
  enrollmentId?: string;
  status: 'Active' | 'Retired' | 'Graduated';
  orderNumber?: number;
  parents: ParentGuardian[];
  created_at?: string;
}

export interface Grade {
  id: string;
  name: string;
  subjects: string[];
}

export interface Subject {
  id: string;
  name: string;
  isActive: boolean;
}

export interface GradeRecord {
  studentId: string;
  subjectId: string;
  schoolYear: string;
  period1?: number;
  period2?: number;
  period3?: number;
  finalExam?: number;
  finalGrade?: number;
}
