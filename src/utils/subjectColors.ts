export interface SubjectColorTheme {
  bg: string;          // Color de fondo (Tailwind class)
  border: string;      // Color de borde (Tailwind class)
  text: string;        // Color de texto del título (Tailwind class)
  badgeBg: string;     // Fondo de insignias / chips
  badgeText: string;   // Texto de insignias / chips
  accent: string;      // Color primario hex
  subtleBg: string;    // Color de fondo hex
  borderColor: string; // Color de borde hex
  textColor: string;   // Color de texto hex
}

const PALETTES: SubjectColorTheme[] = [
  // 0: Lengua Española / Literatura (Rosa / Coral)
  {
    bg: 'bg-rose-50/90',
    border: 'border-rose-200 hover:border-rose-400',
    text: 'text-rose-950',
    badgeBg: 'bg-rose-100/90',
    badgeText: 'text-rose-800',
    accent: '#e11d48',
    subtleBg: '#fff1f2',
    borderColor: '#fecdd3',
    textColor: '#881337'
  },
  // 1: Matemáticas (Azul Zafiro)
  {
    bg: 'bg-blue-50/90',
    border: 'border-blue-200 hover:border-blue-400',
    text: 'text-blue-950',
    badgeBg: 'bg-blue-100/90',
    badgeText: 'text-blue-800',
    accent: '#2563eb',
    subtleBg: '#eff6ff',
    borderColor: '#bfdbfe',
    textColor: '#1e3a8a'
  },
  // 2: Ciencias Sociales / Historia (Ámbar / Naranja)
  {
    bg: 'bg-amber-50/90',
    border: 'border-amber-200 hover:border-amber-400',
    text: 'text-amber-950',
    badgeBg: 'bg-amber-100/90',
    badgeText: 'text-amber-800',
    accent: '#d97706',
    subtleBg: '#fffbeb',
    borderColor: '#fde68a',
    textColor: '#78350f'
  },
  // 3: Ciencias de la Naturaleza / Biología / Química (Esmeralda)
  {
    bg: 'bg-emerald-50/90',
    border: 'border-emerald-200 hover:border-emerald-400',
    text: 'text-emerald-950',
    badgeBg: 'bg-emerald-100/90',
    badgeText: 'text-emerald-800',
    accent: '#059669',
    subtleBg: '#ecfdf5',
    borderColor: '#a7f3d0',
    textColor: '#064e3b'
  },
  // 4: Idiomas / Inglés (Violeta / Púrpura)
  {
    bg: 'bg-violet-50/90',
    border: 'border-violet-200 hover:border-violet-400',
    text: 'text-violet-950',
    badgeBg: 'bg-violet-100/90',
    badgeText: 'text-violet-800',
    accent: '#7c3aed',
    subtleBg: '#f5f3ff',
    borderColor: '#ddd6fe',
    textColor: '#4c1d95'
  },
  // 5: Educación Física / Deporte (Cian / Turquesa)
  {
    bg: 'bg-cyan-50/90',
    border: 'border-cyan-200 hover:border-cyan-400',
    text: 'text-cyan-950',
    badgeBg: 'bg-cyan-100/90',
    badgeText: 'text-cyan-800',
    accent: '#0891b2',
    subtleBg: '#ecfeff',
    borderColor: '#a5f3fc',
    textColor: '#164e63'
  },
  // 6: Educación Artística (Fucsia / Rosa)
  {
    bg: 'bg-pink-50/90',
    border: 'border-pink-200 hover:border-pink-400',
    text: 'text-pink-950',
    badgeBg: 'bg-pink-100/90',
    badgeText: 'text-pink-800',
    accent: '#db2777',
    subtleBg: '#fdf2f8',
    borderColor: '#fbcfe8',
    textColor: '#831843'
  },
  // 7: FIHR / Humana y Religiosa (Verde Menta / Teal)
  {
    bg: 'bg-teal-50/90',
    border: 'border-teal-200 hover:border-teal-400',
    text: 'text-teal-950',
    badgeBg: 'bg-teal-100/90',
    badgeText: 'text-teal-800',
    accent: '#0d9488',
    subtleBg: '#f0fdfa',
    borderColor: '#99f6e4',
    textColor: '#134e4a'
  },
  // 8: Tecnología / Informática (Índigo)
  {
    bg: 'bg-indigo-50/90',
    border: 'border-indigo-200 hover:border-indigo-400',
    text: 'text-indigo-950',
    badgeBg: 'bg-indigo-100/90',
    badgeText: 'text-indigo-800',
    accent: '#4f46e5',
    subtleBg: '#eef2ff',
    borderColor: '#c7d2fe',
    textColor: '#312e81'
  }
];

export const getSubjectTheme = (name?: string): SubjectColorTheme => {
  if (!name) return PALETTES[8];

  const n = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  // Lengua Española / Literatura
  if (n.includes('espanol') || n.includes('lengua') || n.includes('literatura') || n.includes('lectura') || n.includes('ortograf')) {
    return PALETTES[0];
  }
  // Matemáticas
  if (n.includes('matemat') || n.includes('algeb') || n.includes('geometr') || n.includes('calcul') || n.includes('trigono')) {
    return PALETTES[1];
  }
  // Ciencias Sociales
  if (n.includes('social') || n.includes('histor') || n.includes('geograf') || n.includes('civic') || n.includes('moral')) {
    return PALETTES[2];
  }
  // Ciencias de la Naturaleza
  if (n.includes('natural') || n.includes('biolog') || n.includes('quimic') || n.includes('fisic') || n.includes('cienc')) {
    return PALETTES[3];
  }
  // Idiomas
  if (n.includes('ingles') || n.includes('english') || n.includes('frances') || n.includes('idiom') || n.includes('extranjer')) {
    return PALETTES[4];
  }
  // Educación Física
  if ((n.includes('fisic') && (n.includes('educ') || n.includes('depor'))) || n.includes('deporte') || n.includes('recreac')) {
    return PALETTES[5];
  }
  // Artística
  if (n.includes('art') || n.includes('music') || n.includes('teatr') || n.includes('dibuj')) {
    return PALETTES[6];
  }
  // Religión / FIHR
  if (n.includes('fihr') || n.includes('relig') || n.includes('human') || n.includes('formacion') || n.includes('integral')) {
    return PALETTES[7];
  }
  // Informática / Tecnología
  if (n.includes('inform') || n.includes('tecno') || n.includes('comput') || n.includes('robot')) {
    return PALETTES[8];
  }

  // Hash determinístico para materias adicionales
  let hash = 0;
  for (let i = 0; i < n.length; i++) {
    hash = (hash << 5) - hash + n.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PALETTES.length;
  return PALETTES[index];
};
