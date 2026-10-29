import { supabase } from '../lib/supabase';

export type StaffEvaluationGroup = 'teacher' | 'management' | 'administrative' | 'support';
export type EvaluationSourceType = 'internal' | 'student_survey' | 'parent_survey';
export type EvaluationPeriod = 'P1' | 'P2' | 'P3' | 'P4';

export interface EvaluationIndicator {
  id: string;
  text: string;
}

export interface EvaluationCriterion {
  id: string;
  number: number;
  title: string;
  description: string;
  indicators: EvaluationIndicator[];
}

export interface ReflectiveQuestion {
  id: string;
  number: number;
  question: string;
}

export interface EvaluationRubricTemplate {
  id: string;
  centerId: string;
  group: StaffEvaluationGroup | 'student_survey' | 'parent_survey';
  title: string;
  subtitle: string;
  scale: {
    value: number;
    label: string;
    description: string;
    color: string;
  }[];
  criteria: EvaluationCriterion[];
  reflectiveQuestions?: ReflectiveQuestion[];
  didacticSequenceQuestions?: ReflectiveQuestion[];
  updatedAt: string;
}

export interface StaffEvaluationRecord {
  id: string;
  centerId: string;
  schoolYear: string;
  period: EvaluationPeriod;
  staffId: string;
  staffName: string;
  staffRole: StaffEvaluationGroup;
  evaluatorId: string;
  evaluatorName: string;
  evaluatorRole: string;
  source: EvaluationSourceType;
  courseId?: string;
  courseName?: string;
  subjectId?: string;
  subjectName?: string;
  appliedDate?: string;
  appliedTime?: string;
  coordinatorName?: string;
  scores: Record<string, number>; // indicatorId -> 1 | 2 | 3 | 4
  criteriaAverages: Record<string, number>; // criterionId -> 1..4
  criteriaObservations?: Record<string, string>; // criterionId -> observación específica del criterio general
  reflectiveAnswers?: Record<string, string>; // questionId -> respuesta abierta del diálogo reflexivo
  appliesDidacticSequence?: boolean;
  didacticSequenceAnswers?: Record<string, string>; // questionId -> respuesta abierta sobre secuencias didácticas
  didacticSequenceObservations?: string; // Observaciones específicas del diálogo de secuencias didácticas
  totalScore: number;
  maxScore: number;
  averageScore: number; // 1.00 - 4.00
  percentage: number; // 0 - 100
  levelLabel: 'Excelente' | 'Bueno' | 'En desarrollo' | 'Insuficiente';
  strengths?: string;
  improvementAreas?: string;
  commitments?: string;
  generalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveSurveyBroadcast {
  id: string;
  centerId: string;
  schoolYear: string;
  period: EvaluationPeriod;
  title: string;
  description: string;
  targetAudience: ('student' | 'parent')[];
  targetCourseIds: string[]; // vacío = todos los cursos
  targetTeacherIds: string[]; // vacío = todos los docentes del curso
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
}

export const STANDARD_SCALE = [
  {
    value: 4,
    label: 'Excelente',
    description: 'Evidencia consistente y satisfactoria del indicador.',
    color: '#10b981'
  },
  {
    value: 3,
    label: 'Bueno',
    description: 'Cumple el indicador, con aspectos puntuales por fortalecer.',
    color: '#3b82f6'
  },
  {
    value: 2,
    label: 'En desarrollo',
    description: 'Cumplimiento parcial; requiere seguimiento y acompañamiento.',
    color: '#f59e0b'
  },
  {
    value: 1,
    label: 'Insuficiente',
    description: 'Presenta dificultades importantes que requieren un plan de mejora.',
    color: '#ef4444'
  }
];

export const getDefaultRubricTemplates = (centerId: string = 'default', centerName: string = 'Centro Educativo'): Record<string, EvaluationRubricTemplate> => {
  const now = new Date().toISOString();

  // 1. INSTRUMENTO DOCENTE (9 criterios oficiales suministrados por el usuario)
  const teacherRubric: EvaluationRubricTemplate = {
    id: `rubric_teacher_${centerId}`,
    centerId,
    group: 'teacher',
    title: 'Instrumento de Evaluación del Rendimiento del Equipo Docente',
    subtitle: 'Evaluación integral por competencias pedagógicas, gestión de aula y valores institucionales',
    scale: STANDARD_SCALE,
    updatedAt: now,
    criteria: [
      {
        id: 'crit_t_1',
        number: 1,
        title: 'Planificación pedagógica',
        description:
          'Evalúa la capacidad del docente para organizar anticipadamente el proceso de enseñanza y aprendizaje, de acuerdo con el currículo y las competencias previstas.',
        indicators: [
          {
            id: 'ind_t_1_1',
            text: 'Elabora una planificación acorde con el diseño curricular y las competencias del grado y la asignatura.'
          },
          {
            id: 'ind_t_1_2',
            text: 'Mantiene actualizada la planificación diaria y la relaciona con la planificación de unidad.'
          },
          {
            id: 'ind_t_1_3',
            text: 'Incorpora las adecuaciones curriculares necesarias para atender las características y necesidades de los estudiantes.'
          },
          {
            id: 'ind_t_1_4',
            text: 'Establece coherencia entre los objetivos o intenciones pedagógicas, los contenidos y las actividades planificadas.'
          },
          {
            id: 'ind_t_1_5',
            text: 'Organiza las actividades correspondientes a los momentos de inicio, desarrollo y cierre de la clase.'
          },
          {
            id: 'ind_t_1_6',
            text: 'Prevé los recursos didácticos y las estrategias de evaluación necesarios para desarrollar la clase.'
          }
        ]
      },
      {
        id: 'crit_t_2',
        number: 2,
        title: 'Dominio curricular y disciplinar',
        description:
          'Evalúa el conocimiento que posee el docente de los contenidos que imparte y su capacidad para comunicarlos y relacionarlos con el contexto de los estudiantes.',
        indicators: [
          {
            id: 'ind_t_2_1',
            text: 'Demuestra dominio de los contenidos de su asignatura.'
          },
          {
            id: 'ind_t_2_2',
            text: 'Explica los contenidos con claridad y precisión, utilizando un lenguaje adecuado al nivel de los estudiantes.'
          },
          {
            id: 'ind_t_2_3',
            text: 'Responde de manera clara y pertinente las preguntas e inquietudes de los estudiantes.'
          },
          {
            id: 'ind_t_2_4',
            text: 'Relaciona los contenidos desarrollados con situaciones de la vida cotidiana y otras áreas del conocimiento.'
          },
          {
            id: 'ind_t_2_5',
            text: 'Promueve el desarrollo de las competencias específicas y fundamentales previstas en el currículo.'
          }
        ]
      },
      {
        id: 'crit_t_3',
        number: 3,
        title: 'Estrategias de enseñanza y atención a la diversidad',
        description:
          'Evalúa la capacidad del docente para facilitar aprendizajes significativos mediante estrategias variadas, participativas e inclusivas.',
        indicators: [
          {
            id: 'ind_t_3_1',
            text: 'Motiva a los estudiantes e introduce adecuadamente el tema de la clase.'
          },
          {
            id: 'ind_t_3_2',
            text: 'Retroalimenta los aprendizajes de la clase anterior.'
          },
          {
            id: 'ind_t_3_3',
            text: 'Explora los conocimientos previos de los estudiantes como punto de partida.'
          },
          {
            id: 'ind_t_3_4',
            text: 'Utiliza estrategias de enseñanza coherentes con el enfoque por competencias.'
          },
          {
            id: 'ind_t_3_5',
            text: 'Selecciona actividades individuales, grupales, expositivas y colaborativas de acuerdo con los aprendizajes esperados.'
          },
          {
            id: 'ind_t_3_6',
            text: 'Promueve la participación activa de los estudiantes en la construcción de sus aprendizajes.'
          },
          {
            id: 'ind_t_3_7',
            text: 'Atiende las diferencias individuales y las necesidades educativas de los estudiantes.'
          },
          {
            id: 'ind_t_3_8',
            text: 'Promueve la equidad de género y la igualdad de oportunidades durante las actividades de aprendizaje.'
          }
        ]
      },
      {
        id: 'crit_t_4',
        number: 4,
        title: 'Gestión y desarrollo de la clase',
        description:
          'Evalúa la capacidad del docente para conducir el proceso pedagógico, organizar el aula y aprovechar eficientemente el tiempo disponible.',
        indicators: [
          {
            id: 'ind_t_4_1',
            text: 'Inicia la clase puntualmente.'
          },
          {
            id: 'ind_t_4_2',
            text: 'Desarrolla de manera coherente los momentos de inicio, desarrollo y cierre.'
          },
          {
            id: 'ind_t_4_3',
            text: 'Distribuye adecuadamente el tiempo según las actividades y los propósitos de la clase.'
          },
          {
            id: 'ind_t_4_4',
            text: 'Utiliza de manera efectiva el espacio físico disponible.'
          },
          {
            id: 'ind_t_4_5',
            text: 'Mantiene un ambiente de disciplina funcional basado en el respeto y la convivencia.'
          },
          {
            id: 'ind_t_4_6',
            text: 'Fomenta las relaciones democráticas, solidarias y de cooperación entre los estudiantes.'
          },
          {
            id: 'ind_t_4_7',
            text: 'Ejerce un liderazgo positivo que favorece la participación y el aprendizaje.'
          }
        ]
      },
      {
        id: 'crit_t_5',
        number: 5,
        title: 'Recursos y ambiente de aprendizaje',
        description:
          'Evalúa la selección y utilización de los recursos didácticos y tecnológicos, así como la organización del entorno para favorecer el aprendizaje.',
        indicators: [
          {
            id: 'ind_t_5_1',
            text: 'Selecciona y utiliza materiales didácticos pertinentes a los contenidos y las competencias que desarrolla.'
          },
          {
            id: 'ind_t_5_2',
            text: 'Integra herramientas tecnológicas cuando contribuyen al logro de los aprendizajes.'
          },
          {
            id: 'ind_t_5_3',
            text: 'Organiza y ambienta el aula con sentido pedagógico, de acuerdo con los contenidos curriculares.'
          },
          {
            id: 'ind_t_5_4',
            text: 'Utiliza los recursos y el espacio del aula para facilitar la participación y la construcción del conocimiento.'
          }
        ]
      },
      {
        id: 'crit_t_6',
        number: 6,
        title: 'Evaluación y seguimiento de los aprendizajes',
        description:
          'Evalúa la capacidad del docente para verificar los aprendizajes, identificar necesidades y utilizar los resultados para mejorar el proceso educativo.',
        indicators: [
          {
            id: 'ind_t_6_1',
            text: 'Utiliza instrumentos de evaluación adecuados a las actividades y los aprendizajes esperados.'
          },
          {
            id: 'ind_t_6_2',
            text: 'Establece criterios de evaluación coherentes con los indicadores de logro.'
          },
          {
            id: 'ind_t_6_3',
            text: 'Relaciona la evaluación con las competencias, los contenidos y las actividades desarrolladas.'
          },
          {
            id: 'ind_t_6_4',
            text: 'Valora el dominio de los contenidos conceptuales, procedimentales y actitudinales.'
          },
          {
            id: 'ind_t_6_5',
            text: 'Aprovecha los resultados de la evaluación para orientar y retroalimentar el aprendizaje.'
          },
          {
            id: 'ind_t_6_6',
            text: 'Aplica procesos de autoevaluación, coevaluación y heteroevaluación.'
          },
          {
            id: 'ind_t_6_7',
            text: 'Mantiene organizados y actualizados los registros de evaluación y el registro de grado.'
          },
          {
            id: 'ind_t_6_8',
            text: 'Verifica la correspondencia entre la planificación, las actividades realizadas y las evidencias de aprendizaje de los estudiantes.'
          },
          {
            id: 'ind_t_6_9',
            text: 'Mantiene organizados los cuadernos y portafolios como evidencias del progreso de los estudiantes.'
          }
        ]
      },
      {
        id: 'crit_t_7',
        number: 7,
        title: 'Desempeño y profesionalismo docente',
        description:
          'Evalúa la conducta profesional, las habilidades comunicativas, el liderazgo y el ejemplo personal del docente dentro de la comunidad educativa.',
        indicators: [
          {
            id: 'ind_t_7_1',
            text: 'Utiliza adecuadamente la expresión oral y escrita.'
          },
          {
            id: 'ind_t_7_2',
            text: 'Mantiene una presentación personal y una vestimenta acordes con su función educativa.'
          },
          {
            id: 'ind_t_7_3',
            text: 'Demuestra seguridad y confianza en sí mismo durante el desarrollo de sus funciones.'
          },
          {
            id: 'ind_t_7_4',
            text: 'Utiliza una postura, un tono de voz y expresiones que favorecen el proceso educativo.'
          },
          {
            id: 'ind_t_7_5',
            text: 'Fomenta y practica los buenos modales.'
          },
          {
            id: 'ind_t_7_6',
            text: 'Promueve la práctica de valores éticos y morales.'
          },
          {
            id: 'ind_t_7_7',
            text: 'Demuestra un liderazgo positivo y es percibido por sus estudiantes como una figura de orientación y referencia.'
          },
          {
            id: 'ind_t_7_8',
            text: 'Mantiene relaciones respetuosas con los estudiantes y los demás integrantes de la comunidad educativa.'
          }
        ]
      },
      {
        id: 'crit_t_8',
        number: 8,
        title: 'Reflexión profesional y compromiso de mejora',
        description:
          'Evalúa la disposición del docente para analizar su práctica, reconocer oportunidades de mejora y asumir compromisos orientados al desarrollo profesional.',
        indicators: [
          {
            id: 'ind_t_8_1',
            text: 'Identifica sus fortalezas a partir de la reflexión sobre su práctica pedagógica.'
          },
          {
            id: 'ind_t_8_2',
            text: 'Reconoce las oportunidades de mejora señaladas durante el acompañamiento.'
          },
          {
            id: 'ind_t_8_3',
            text: 'Muestra una actitud receptiva, respetuosa y colaborativa ante las observaciones y sugerencias.'
          },
          {
            id: 'ind_t_8_4',
            text: 'Participa activamente en la construcción de acuerdos para mejorar su desempeño.'
          },
          {
            id: 'ind_t_8_5',
            text: 'Asume compromisos concretos y verificables para superar las dificultades identificadas.'
          },
          {
            id: 'ind_t_8_6',
            text: 'Cumple los acuerdos de mejora establecidos con el equipo de gestión.'
          },
          {
            id: 'ind_t_8_7',
            text: 'Reflexiona sobre los resultados de su práctica y propone ajustes para mejorar los aprendizajes de los estudiantes.'
          }
        ]
      },
      {
        id: 'crit_t_9',
        number: 9,
        title: 'Compromiso con la filosofía cristiana del centro',
        description: `Evalúa el nivel de identificación, compromiso y coherencia del docente con la filosofía cristiana de ${centerName}, considerando su testimonio personal y profesional, la promoción de los valores morales y espirituales, su contribución a la formación integral de los estudiantes y su apoyo a las actividades e iniciativas que fortalecen la identidad cristiana de la institución.`,
        indicators: [
          {
            id: 'ind_t_9_1',
            text: 'Coherencia entre su conducta profesional y los principios cristianos institucionales.'
          },
          {
            id: 'ind_t_9_2',
            text: 'Promoción de los valores morales y espirituales en la formación de los estudiantes.'
          },
          {
            id: 'ind_t_9_3',
            text: 'Testimonio de respeto, honestidad, responsabilidad, solidaridad y amor al prójimo.'
          },
          {
            id: 'ind_t_9_4',
            text: 'Contribución a una convivencia escolar basada en los valores cristianos.'
          },
          {
            id: 'ind_t_9_5',
            text: 'Participación y colaboración en actividades institucionales de formación espiritual y promoción de valores.'
          },
          {
            id: 'ind_t_9_6',
            text: 'Disposición para fortalecer su práctica educativa de acuerdo con la filosofía cristiana del centro.'
          }
        ]
      }
    ],
    reflectiveQuestions: [
      {
        id: 'refl_t_1',
        number: 1,
        question: '¿Cómo se ha sentido durante la clase de hoy?'
      },
      {
        id: 'refl_t_2',
        number: 2,
        question: '¿Qué momento de la clase le resultó más significativo? ¿Por qué?'
      },
      {
        id: 'refl_t_3',
        number: 3,
        question:
          'Si tuviera la oportunidad de cambiar algo del proceso de enseñanza desarrollado hoy, ¿qué cambiaría? ¿Por qué?'
      },
      {
        id: 'refl_t_4',
        number: 4,
        question:
          '¿En qué medida considera que se logró el propósito de la clase? ¿Qué evidencias respaldan su valoración?'
      },
      {
        id: 'refl_t_5',
        number: 5,
        question:
          '¿Considera que los estudiantes se apropiaron de los contenidos y construyeron aprendizajes significativos? ¿Por qué?'
      }
    ],
    didacticSequenceQuestions: [
      {
        id: 'did_seq_1',
        number: 1,
        question: '¿Cómo describes tu experiencia con las secuencias didácticas?'
      },
      {
        id: 'did_seq_2',
        number: 2,
        question:
          '¿Cómo te ha favorecido el manejo de las orientaciones documentadas y la integración con tus compañeros docentes y gestores del centro educativo en relación con las secuencias didácticas?'
      },
      {
        id: 'did_seq_3',
        number: 3,
        question:
          '¿Qué acciones consideraste para responder a las características de los estudiantes a tu cargo?'
      },
      {
        id: 'did_seq_4',
        number: 4,
        question:
          '¿Cómo valoras la reacción de los estudiantes ante las actividades propuestas en las secuencias didácticas? (Interés, curiosidad, participación y comprensión).'
      },
      {
        id: 'did_seq_5',
        number: 5,
        question: '¿Cuáles consideras que son las principales fortalezas de este proceso de implementación?'
      },
      {
        id: 'did_seq_6',
        number: 6,
        question:
          '¿Cuáles han sido los principales desafíos que has enfrentado en la implementación de las secuencias didácticas? ¿Cómo los has afrontado?'
      },
      {
        id: 'did_seq_7',
        number: 7,
        question:
          '¿Qué tipo de apoyo necesitarías para seguir fortaleciendo tu práctica pedagógica en la implementación de las secuencias didácticas? (Recursos, orientaciones, capacitaciones, entre otros).'
      },
      {
        id: 'did_seq_8',
        number: 8,
        question: '¿Con qué te quedas de esta conversación?'
      },
      {
        id: 'did_seq_9',
        number: 9,
        question: '¿Cómo te has sentido durante este intercambio de impresiones? ¿Por qué?'
      }
    ]
  };

  // 2. INSTRUMENTO EQUIPO DE GESTIÓN (Directores, Coordinadores, Orientadores)
  const managementRubric: EvaluationRubricTemplate = {
    id: `rubric_management_${centerId}`,
    centerId,
    group: 'management',
    title: 'Instrumento de Evaluación del Equipo de Gestión',
    subtitle: 'Liderazgo pedagógico, acompañamiento docente, clima escolar y gestión institucional',
    scale: STANDARD_SCALE,
    updatedAt: now,
    criteria: [
      {
        id: 'crit_m_1',
        number: 1,
        title: 'Planificación Estratégica y Organización Escolar',
        description: 'Evalúa la capacidad para estructurar, dar seguimiento y cumplir el cronograma y las metas académicas del centro.',
        indicators: [
          { id: 'ind_m_1_1', text: 'Elabora y da seguimiento oportuno al plan anual y cronograma de actividades de su área.' },
          { id: 'ind_m_1_2', text: 'Coordina eficazmente los procesos de inicio, desarrollo y cierre de cada período escolar.' },
          { id: 'ind_m_1_3', text: 'Organiza y supervisa la documentación académica y registros oficiales en tiempo y forma.' },
          { id: 'ind_m_1_4', text: 'Anticipa necesidades operativas y propone soluciones preventivas ante imprevistos.' }
        ]
      },
      {
        id: 'crit_m_2',
        number: 2,
        title: 'Acompañamiento y Liderazgo Pedagógico',
        description: 'Evalúa la calidad del seguimiento, orientación y apoyo brindado al cuerpo docente para la mejora de los aprendizajes.',
        indicators: [
          { id: 'ind_m_2_1', text: 'Realiza acompañamientos pedagógicos sistemáticos y revisa las planificaciones docentes.' },
          { id: 'ind_m_2_2', text: 'Brinda retroalimentación constructiva, oportuna y respetuosa a los docentes acompañados.' },
          { id: 'ind_m_2_3', text: 'Lidera grupos pedagógicos y espacios de formación continua con enfoque práctico.' },
          { id: 'ind_m_2_4', text: 'Monitorea el rendimiento estudiantil y coordina planes de nivelación para alumnos en riesgo.' }
        ]
      },
      {
        id: 'crit_m_3',
        number: 3,
        title: 'Gestión del Clima Escolar y Atención a Familias',
        description: 'Evalúa la mediación de conflictos, la disciplina positiva y la comunicación efectiva con padres y estudiantes.',
        indicators: [
          { id: 'ind_m_3_1', text: 'Atiende con prontitud, empatía y profesionalismo las inquietudes de padres, madres y tutores.' },
          { id: 'ind_m_3_2', text: 'Media en situaciones de conducta o convivencia aplicando las normas con justicia y sentido formativo.' },
          { id: 'ind_m_3_3', text: 'Fomenta un clima laboral armónico, colaborativo y de respeto mutuo en todo el personal.' },
          { id: 'ind_m_3_4', text: 'Mantiene canales de comunicación claros y oportunos con toda la comunidad educativa.' }
        ]
      },
      {
        id: 'crit_m_4',
        number: 4,
        title: 'Ética Profesional y Compromiso Institucional',
        description: 'Evalúa la responsabilidad, puntualidad, liderazgo ético y coherencia con la filosofía cristiana del centro.',
        indicators: [
          { id: 'ind_m_4_1', text: 'Demuestra puntualidad, asistencia ejemplar y discreción en el manejo de información sensible.' },
          { id: 'ind_m_4_2', text: 'Asume compromisos de mejora y entrega informes claros a la dirección general.' },
          { id: 'ind_m_4_3', text: 'Modela los valores éticos, morales y cristianos de la institución en su trato diario.' },
          { id: 'ind_m_4_4', text: 'Apoya activamente las actividades institucionales, espirituales y extracurriculares del centro.' }
        ]
      }
    ]
  };

  // 3. INSTRUMENTO EQUIPO ADMINISTRATIVO (Secretaría, Contabilidad, Recepción, Caja)
  const administrativeRubric: EvaluationRubricTemplate = {
    id: `rubric_administrative_${centerId}`,
    centerId,
    group: 'administrative',
    title: 'Instrumento de Evaluación del Equipo Administrativo',
    subtitle: 'Eficiencia operativa, calidad de servicio a las familias, organización documental y ética',
    scale: STANDARD_SCALE,
    updatedAt: now,
    criteria: [
      {
        id: 'crit_a_1',
        number: 1,
        title: 'Atención y Servicio a Padres, Alumnos y Visitantes',
        description: 'Evalúa la cordialidad, claridad y eficacia en la recepción y respuesta a las solicitudes de la comunidad educativa.',
        indicators: [
          { id: 'ind_a_1_1', text: 'Recibe y atiende a los padres, estudiantes y visitantes con amabilidad, respeto y prontitud.' },
          { id: 'ind_a_1_2', text: 'Brinda información clara, precisa y oportuna por vía presencial, telefónica o digital.' },
          { id: 'ind_a_1_3', text: 'Mantiene la calma y el trato cortés incluso ante situaciones de alta demanda o reclamos.' },
          { id: 'ind_a_1_4', text: 'Canaliza oportunamente los casos o solicitudes hacia el departamento correspondiente.' }
        ]
      },
      {
        id: 'crit_a_2',
        number: 2,
        title: 'Organización Documental, Registros y Procesos',
        description: 'Evalúa el orden, exactitud y actualización de expedientes, cobros, certificaciones y plataformas.',
        indicators: [
          { id: 'ind_a_2_1', text: 'Mantiene actualizados y organizados los expedientes estudiantiles, registros o cuentas a su cargo.' },
          { id: 'ind_a_2_2', text: 'Elabora reportes, certificaciones, recibos o documentos sin errores y dentro de los plazos establecidos.' },
          { id: 'ind_a_2_3', text: 'Domina y utiliza adecuadamente las herramientas tecnológicas y el sistema de gestión del centro.' },
          { id: 'ind_a_2_4', text: 'Cumple rigurosamente los controles internos y protocolos administrativos de la institución.' }
        ]
      },
      {
        id: 'crit_a_3',
        number: 3,
        title: 'Puntualidad, Presentación y Trabajo en Equipo',
        description: 'Evalúa el cumplimiento del horario, la imagen institucional y la colaboración interdepartamental.',
        indicators: [
          { id: 'ind_a_3_1', text: 'Cumple puntualmente con su horario de entrada, salida y permanencia en su puesto.' },
          { id: 'ind_a_3_2', text: 'Mantiene su espacio de trabajo limpio, ordenado y una presentación personal acorde al centro.' },
          { id: 'ind_a_3_3', text: 'Colabora de forma proactiva con el equipo directivo, docente y sus compañeros de área.' }
        ]
      },
      {
        id: 'crit_a_4',
        number: 4,
        title: 'Confidencialidad y Valores Institucionales',
        description: 'Evalúa la integridad, discreción y vivencia de la filosofía cristiana del centro.',
        indicators: [
          { id: 'ind_a_4_1', text: 'Guarda estricta confidencialidad sobre la información financiera, académica y personal de las familias.' },
          { id: 'ind_a_4_2', text: 'Refleja honestidad, responsabilidad y valores cristianos en el ejercicio diario de sus funciones.' },
          { id: 'ind_a_4_3', text: 'Participa con disposición en las actividades institucionales y formativas del centro educativo.' }
        ]
      }
    ]
  };

  // 4. INSTRUMENTO EQUIPO DE APOYO (Conserjería, Mantenimiento, Portería, Seguridad, Cocina)
  const supportRubric: EvaluationRubricTemplate = {
    id: `rubric_support_${centerId}`,
    centerId,
    group: 'support',
    title: 'Instrumento de Evaluación del Personal de Apoyo y Planta Física',
    subtitle: 'Higiene, mantenimiento preventivo, seguridad, trato humano y compromiso institucional',
    scale: STANDARD_SCALE,
    updatedAt: now,
    criteria: [
      {
        id: 'crit_s_1',
        number: 1,
        title: 'Calidad en la Limpieza, Orden y Mantenimiento',
        description: 'Evalúa la pulcritud, higienización y cuidado continuo de las áreas asignadas del plantel escolar.',
        indicators: [
          { id: 'ind_s_1_1', text: 'Mantiene limpias, desinfectadas y ordenadas las aulas, baños, pasillos y áreas asignadas.' },
          { id: 'ind_s_1_2', text: 'Realiza sus rutinas operativas de forma oportuna sin interrumpir el desarrollo de las clases.' },
          { id: 'ind_s_1_3', text: 'Verifica continuamente el estado de las instalaciones durante la jornada y corrige imprevistos.' },
          { id: 'ind_s_1_4', text: 'Reporta de inmediato cualquier avería, riesgo físico o necesidad de reparación en el plantel.' }
        ]
      },
      {
        id: 'crit_s_2',
        number: 2,
        title: 'Cuidado de Insumos, Equipos y Seguridad',
        description: 'Evalúa el uso responsable de materiales, herramientas y el cumplimiento de normas de seguridad.',
        indicators: [
          { id: 'ind_s_2_1', text: 'Utiliza de manera racional y cuidadosa los productos de limpieza, materiales y herramientas.' },
          { id: 'ind_s_2_2', text: 'Mantiene organizado y seguro el cuarto de insumos o depósito bajo su responsabilidad.' },
          { id: 'ind_s_2_3', text: 'Cumple las medidas de prevención, higiene y seguridad física para proteger a los estudiantes.' }
        ]
      },
      {
        id: 'crit_s_3',
        number: 3,
        title: 'Puntualidad, Disposición y Servicio',
        description: 'Evalúa la asistencia, proactividad y actitud de colaboración ante los requerimientos del centro.',
        indicators: [
          { id: 'ind_s_3_1', text: 'Asiste puntualmente a sus labores y cumple cabalmente su jornada de trabajo.' },
          { id: 'ind_s_3_2', text: 'Muestra disposición y actitud colaboradora cuando se requiere apoyo en eventos o actividades.' },
          { id: 'ind_s_3_3', text: 'Porta adecuadamente su uniforme o vestimenta de trabajo con higiene y buena presencia.' }
        ]
      },
      {
        id: 'crit_s_4',
        number: 4,
        title: 'Trato Respetuoso y Valores Cristianos',
        description: 'Evalúa la convivencia armónica con estudiantes, docentes y familias conforme a los principios del centro.',
        indicators: [
          { id: 'ind_s_4_1', text: 'Se dirige con respeto, amabilidad y prudencia hacia los estudiantes, docentes, padres y compañeros.' },
          { id: 'ind_s_4_2', text: 'Practica la honestidad, solidaridad y los valores cristianos promovidos por la institución.' },
          { id: 'ind_s_4_3', text: 'Contribuye a mantener un ambiente escolar sano, seguro y acogedor para toda la comunidad.' }
        ]
      }
    ]
  };

  // 5. ENCUESTA PROVISIONAL PARA ALUMNOS Y PADRES (Adaptada de los 9 criterios docentes a lenguaje claro para estudiantes/familias)
  const studentSurveyRubric: EvaluationRubricTemplate = {
    id: `rubric_student_survey_${centerId}`,
    centerId,
    group: 'student_survey',
    title: 'Encuesta Estudiantil y Familiar sobre el Desempeño Docente',
    subtitle: 'Instrumento adaptado para conocer la valoración de los alumnos y las familias sobre el proceso de enseñanza',
    scale: [
      { value: 4, label: 'Siempre (Excelente)', description: 'Lo demuestra en todas o casi todas las clases.', color: '#10b981' },
      { value: 3, label: 'Casi siempre (Bueno)', description: 'Lo demuestra con frecuencia.', color: '#3b82f6' },
      { value: 2, label: 'A veces (En desarrollo)', description: 'Lo hace de forma ocasional.', color: '#f59e0b' },
      { value: 1, label: 'Rara vez / Nunca', description: 'Necesita mejorar de forma importante.', color: '#ef4444' }
    ],
    updatedAt: now,
    criteria: [
      {
        id: 'crit_st_1',
        number: 1,
        title: 'Organización y Preparación de las Clases',
        description: 'Evalúa si el profesor lleva sus clases bien preparadas y organizadas.',
        indicators: [
          { id: 'ind_st_1_1', text: 'El docente llega al aula con la clase bien preparada y explica qué vamos a aprender en el día.' },
          { id: 'ind_st_1_2', text: 'Las actividades y tareas que asigna tienen relación clara con los temas trabajados en clase.' },
          { id: 'ind_st_1_3', text: 'Inicia y termina la clase a tiempo, aprovechando bien cada momento.' }
        ]
      },
      {
        id: 'crit_st_2',
        number: 2,
        title: 'Claridad al Explicar y Dominio de la Materia',
        description: 'Evalúa cómo explica los temas y cómo responde las dudas de los estudiantes.',
        indicators: [
          { id: 'ind_st_2_1', text: 'Explica los temas con claridad, paciencia y usando ejemplos fáciles de entender.' },
          { id: 'ind_st_2_2', text: 'Responde con amabilidad y claridad cuando los estudiantes hacen preguntas o tienen dudas.' },
          { id: 'ind_st_2_3', text: 'Relaciona los temas de la materia con situaciones prácticas de la vida diaria.' }
        ]
      },
      {
        id: 'crit_st_3',
        number: 3,
        title: 'Motivación, Participación y Apoyo al Estudiante',
        description: 'Evalúa si las clases son dinámicas y si el docente apoya a quienes tienen dificultades.',
        indicators: [
          { id: 'ind_st_3_1', text: 'Motiva a los estudiantes a participar, opinar y trabajar en equipo durante la clase.' },
          { id: 'ind_st_3_2', text: 'Brinda apoyo y explica nuevamente cuando algún estudiante necesita ayuda adicional.' },
          { id: 'ind_st_3_3', text: 'Utiliza recursos variados (pizarra, materiales, dinámicas o tecnología) que ayudan a aprender mejor.' }
        ]
      },
      {
        id: 'crit_st_4',
        number: 4,
        title: 'Justicia al Evaluar y Revisión de Tareas',
        description: 'Evalúa cómo corrige los trabajos, cuadernos y pruebas y si orienta para mejorar.',
        indicators: [
          { id: 'ind_st_4_1', text: 'Explica con anticipación qué y cómo va a evaluar en las tareas, prácticas y exámenes.' },
          { id: 'ind_st_4_2', text: 'Revisa los cuadernos, tareas y trabajos y nos dice cómo podemos mejorar nuestras calificaciones.' },
          { id: 'ind_st_4_3', text: 'Evalúa de manera justa y transparente el esfuerzo y aprendizaje de todos los estudiantes.' }
        ]
      },
      {
        id: 'crit_st_5',
        number: 5,
        title: 'Respeto, Convivencia y Valores Cristianos',
        description: 'Evalúa el trato respetuoso, el orden en el aula y el ejemplo de valores cristianos.',
        indicators: [
          { id: 'ind_st_5_1', text: 'Trata a todos los estudiantes y familias con respeto, buen tono de voz y sin favoritismos.' },
          { id: 'ind_st_5_2', text: 'Mantiene el orden, la disciplina y un ambiente de paz y respeto dentro del salón de clases.' },
          { id: 'ind_st_5_3', text: 'Fomenta con su ejemplo los valores cristianos (respeto, honestidad, solidaridad y amor al prójimo).' }
        ]
      }
    ]
  };

  return {
    teacher: teacherRubric,
    management: managementRubric,
    administrative: administrativeRubric,
    support: supportRubric,
    student_survey: studentSurveyRubric
  };
};

const RUBRICS_STORAGE_KEY = 'edugens_staff_rubrics_v1_';
const EVALUATIONS_STORAGE_KEY = 'edugens_staff_evaluations_v1_';
const SURVEY_BROADCASTS_KEY = 'edugens_survey_broadcasts_v1_';

export const staffEvaluationService = {
  // 1. OBTENER PLANTILLAS DE RÚBRICAS (Editables por centro)
  async getRubrics(centerId: string, centerName?: string): Promise<Record<string, EvaluationRubricTemplate>> {
    const defaults = getDefaultRubricTemplates(centerId, centerName || 'Centro Educativo');
    if (!centerId) return defaults;

    // Cargar de localStorage primero
    let stored: Record<string, EvaluationRubricTemplate> | null = null;
    try {
      const raw = localStorage.getItem(`${RUBRICS_STORAGE_KEY}${centerId}`);
      if (raw) {
        stored = JSON.parse(raw);
      }
    } catch {}

    // Intentar cargar de announcements en Supabase (respaldo en nube transparente)
    try {
      const { data } = await supabase
        .from('announcements')
        .select('content, created_at')
        .eq('center_id', centerId)
        .eq('title', `__STAFF_RUBRICS_CONFIG__:${centerId}`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0 && data[0].content?.startsWith('__STAFF_RUBRICS__:')) {
        const cloudParsed = JSON.parse(data[0].content.substring('__STAFF_RUBRICS__:'.length));
        stored = { ...defaults, ...cloudParsed };
        try {
          localStorage.setItem(`${RUBRICS_STORAGE_KEY}${centerId}`, JSON.stringify(stored));
        } catch {}
      }
    } catch {}

    if (!stored) return defaults;
    const merged = { ...defaults, ...stored };
    if (merged.teacher) {
      if (!merged.teacher.reflectiveQuestions || merged.teacher.reflectiveQuestions.length === 0) {
        merged.teacher = {
          ...merged.teacher,
          reflectiveQuestions: defaults.teacher.reflectiveQuestions
        };
      }
      if (
        !merged.teacher.didacticSequenceQuestions ||
        merged.teacher.didacticSequenceQuestions.length === 0
      ) {
        merged.teacher = {
          ...merged.teacher,
          didacticSequenceQuestions: defaults.teacher.didacticSequenceQuestions
        };
      }
    }
    return merged;
  },

  // 2. GUARDAR PLANTILLA EDITADA DE UN GRUPO
  async saveRubric(centerId: string, groupKey: string, updatedTemplate: EvaluationRubricTemplate, userId?: string): Promise<void> {
    const current = await this.getRubrics(centerId);
    const next = {
      ...current,
      [groupKey]: {
        ...updatedTemplate,
        updatedAt: new Date().toISOString()
      }
    };

    try {
      localStorage.setItem(`${RUBRICS_STORAGE_KEY}${centerId}`, JSON.stringify(next));
    } catch {}

    // Respaldo transparente en Supabase
    if (centerId && userId) {
      try {
        const titleTag = `__STAFF_RUBRICS_CONFIG__:${centerId}`;
        const contentPayload = `__STAFF_RUBRICS__:${JSON.stringify(next)}`;
        const { data: existing } = await supabase
          .from('announcements')
          .select('id')
          .eq('center_id', centerId)
          .eq('title', titleTag)
          .limit(1);

        if (existing && existing.length > 0) {
          await supabase
            .from('announcements')
            .update({ content: contentPayload })
            .eq('id', existing[0].id);
        } else {
          await supabase.from('announcements').insert([
            {
              center_id: centerId,
              sender_id: userId,
              sender_role: 'admin',
              title: titleTag,
              content: contentPayload
            }
          ]);
        }
      } catch (e) {
        console.warn('[staffEvaluationService] Guardado local exitoso (nube opcional):', e);
      }
    }
  },

  // 3. OBTENER EVALUACIONES Y RESPUESTAS DE ENCUESTAS
  async getEvaluations(centerId: string, schoolYear?: string): Promise<StaffEvaluationRecord[]> {
    if (!centerId) return [];
    const localKey = `${EVALUATIONS_STORAGE_KEY}${centerId}`;
    let localList: StaffEvaluationRecord[] = [];

    try {
      const raw = localStorage.getItem(localKey);
      if (raw) {
        localList = JSON.parse(raw);
      }
    } catch {}

    // Sincronizar con registros en la nube (almacenados en announcements con prefijo __STAFF_EVAL_RECORD__)
    try {
      const { data } = await supabase
        .from('announcements')
        .select('id, title, content, created_at')
        .eq('center_id', centerId)
        .ilike('title', '__STAFF_EVAL_RECORD__:%')
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        const map = new Map<string, StaffEvaluationRecord>();
        localList.forEach((item) => map.set(item.id, item));

        data.forEach((row: any) => {
          if (row.content && row.content.startsWith('__STAFF_EVAL__:')) {
            try {
              const rec: StaffEvaluationRecord = JSON.parse(
                row.content.substring('__STAFF_EVAL__:'.length)
              );
              if (rec && rec.id) {
                map.set(rec.id, rec);
              }
            } catch {}
          }
        });

        localList = Array.from(map.values()).sort((a, b) =>
          (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)
        );
        try {
          localStorage.setItem(localKey, JSON.stringify(localList));
        } catch {}
      }
    } catch {}

    if (schoolYear) {
      return localList.filter((e) => !e.schoolYear || e.schoolYear === schoolYear);
    }
    return localList;
  },

  // 4. GUARDAR UNA EVALUACIÓN (INTERNA O DE ENCUESTA)
  async saveEvaluation(record: StaffEvaluationRecord, senderUserId?: string): Promise<StaffEvaluationRecord> {
    const centerId = record.centerId;
    const localKey = `${EVALUATIONS_STORAGE_KEY}${centerId}`;
    let list: StaffEvaluationRecord[] = [];

    try {
      const raw = localStorage.getItem(localKey);
      if (raw) list = JSON.parse(raw);
    } catch {}

    const idx = list.findIndex((x) => x.id === record.id);
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.unshift(record);
    }

    try {
      localStorage.setItem(localKey, JSON.stringify(list));
    } catch {}

    // Guardar en Supabase para que alumnos/padres/otros coordinadores lo sincronicen
    if (centerId && senderUserId) {
      try {
        const titleTag = `__STAFF_EVAL_RECORD__:${record.id}`;
        const contentPayload = `__STAFF_EVAL__:${JSON.stringify(record)}`;
        const { data: existing } = await supabase
          .from('announcements')
          .select('id')
          .eq('center_id', centerId)
          .eq('title', titleTag)
          .limit(1);

        if (existing && existing.length > 0) {
          await supabase
            .from('announcements')
            .update({ content: contentPayload })
            .eq('id', existing[0].id);
        } else {
          await supabase.from('announcements').insert([
            {
              center_id: centerId,
              sender_id: senderUserId,
              sender_role: record.evaluatorRole || 'admin',
              title: titleTag,
              content: contentPayload
            }
          ]);
        }
      } catch (e) {
        console.warn('[staffEvaluationService] Error guardando evaluación en nube:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('staffEvaluationsUpdated'));
    return record;
  },

  async deleteEvaluation(centerId: string, evaluationId: string): Promise<void> {
    const localKey = `${EVALUATIONS_STORAGE_KEY}${centerId}`;
    try {
      const raw = localStorage.getItem(localKey);
      if (raw) {
        const list: StaffEvaluationRecord[] = JSON.parse(raw);
        const filtered = list.filter((x) => x.id !== evaluationId);
        localStorage.setItem(localKey, JSON.stringify(filtered));
      }
    } catch {}

    try {
      await supabase
        .from('announcements')
        .delete()
        .eq('center_id', centerId)
        .eq('title', `__STAFF_EVAL_RECORD__:${evaluationId}`);
    } catch {}

    window.dispatchEvent(new CustomEvent('staffEvaluationsUpdated'));
  },

  // 5. GESTIÓN DE CAMPAÑAS / CONVOCATORIAS DE ENCUESTAS PARA ALUMNOS Y PADRES
  async getSurveyBroadcasts(centerId: string): Promise<ActiveSurveyBroadcast[]> {
    if (!centerId) return [];
    const localKey = `${SURVEY_BROADCASTS_KEY}${centerId}`;
    let list: ActiveSurveyBroadcast[] = [];

    try {
      const raw = localStorage.getItem(localKey);
      if (raw) list = JSON.parse(raw);
    } catch {}

    try {
      const { data } = await supabase
        .from('announcements')
        .select('content, created_at')
        .eq('center_id', centerId)
        .eq('title', `__STAFF_SURVEY_BROADCASTS__:${centerId}`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0 && data[0].content?.startsWith('__SURVEY_BROADCASTS__:')) {
        list = JSON.parse(data[0].content.substring('__SURVEY_BROADCASTS__:'.length));
        try {
          localStorage.setItem(localKey, JSON.stringify(list));
        } catch {}
      }
    } catch {}

    return list;
  },

  async saveSurveyBroadcasts(centerId: string, broadcasts: ActiveSurveyBroadcast[], senderUserId?: string): Promise<void> {
    const localKey = `${SURVEY_BROADCASTS_KEY}${centerId}`;
    try {
      localStorage.setItem(localKey, JSON.stringify(broadcasts));
    } catch {}

    if (centerId && senderUserId) {
      try {
        const titleTag = `__STAFF_SURVEY_BROADCASTS__:${centerId}`;
        const contentPayload = `__SURVEY_BROADCASTS__:${JSON.stringify(broadcasts)}`;
        const { data: existing } = await supabase
          .from('announcements')
          .select('id')
          .eq('center_id', centerId)
          .eq('title', titleTag)
          .limit(1);

        if (existing && existing.length > 0) {
          await supabase
            .from('announcements')
            .update({ content: contentPayload })
            .eq('id', existing[0].id);
        } else {
          await supabase.from('announcements').insert([
            {
              center_id: centerId,
              sender_id: senderUserId,
              sender_role: 'admin',
              title: titleTag,
              content: contentPayload
            }
          ]);
        }
      } catch (e) {
        console.warn('[staffEvaluationService] Error sincronizando convocatorias de encuesta:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('staffSurveyBroadcastsUpdated'));
  }
};

export const calculateLevelFromAverage = (
  avg: number
): {
  label: 'Excelente' | 'Bueno' | 'En desarrollo' | 'Insuficiente';
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
} => {
  if (avg >= 3.5) {
    return {
      label: 'Excelente',
      color: '#10b981',
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-700',
      borderClass: 'border-emerald-200'
    };
  }
  if (avg >= 2.75) {
    return {
      label: 'Bueno',
      color: '#3b82f6',
      bgClass: 'bg-blue-50',
      textClass: 'text-blue-700',
      borderClass: 'border-blue-200'
    };
  }
  if (avg >= 2.0) {
    return {
      label: 'En desarrollo',
      color: '#f59e0b',
      bgClass: 'bg-amber-50',
      textClass: 'text-amber-700',
      borderClass: 'border-amber-200'
    };
  }
  return {
    label: 'Insuficiente',
    color: '#ef4444',
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-700',
    borderClass: 'border-rose-200'
  };
};
