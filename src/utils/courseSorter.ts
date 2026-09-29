export const sortCourses = (courses: any[]) => {
  const getTandaWeight = (tanda: string, level: string) => {
    const t = (tanda || '').toLowerCase().trim();
    const lvl = (level || '').toLowerCase().trim();
    if (t.includes('mat') || t.includes('mañ')) return 1;
    if (t.includes('ves') || t.includes('tar') || (t === '' && lvl.includes('secun'))) return 2;
    if (t.includes('noc')) return 3;
    return 1;
  };

  const levelOrder: { [key: string]: number } = {
    'inicial': 1,
    'primario': 2,
    'primaria': 2,
    'básico': 2,
    'basico': 2,
    'secundario': 3,
    'secundaria': 3,
    'medio': 3
  };

  const getLevelWeight = (level: string) => {
    const l = (level || '').toLowerCase().trim();
    return levelOrder[l] || 99;
  };

  const getGradeWeight = (grade: string) => {
    const g = (grade || '').toLowerCase().trim();
    if (g.includes('maternal') || g.includes('lact')) return 1;
    if (g.includes('párv') || g.includes('parv') || g.includes('pre-k') || g.includes('prek')) return 2;
    if (g.includes('kínder') || g.includes('kinder')) return 3;
    if (g.includes('preprim') || g.includes('pre-prim')) return 4;

    const match = g.match(/(\d+)/);
    if (match) {
      return 10 + parseInt(match[1], 10);
    }

    if (g.includes('primer')) return 11;
    if (g.includes('segund')) return 12;
    if (g.includes('tercer')) return 13;
    if (g.includes('cuart')) return 14;
    if (g.includes('quint')) return 15;
    if (g.includes('sext')) return 16;
    if (g.includes('séptim') || g.includes('septim')) return 17;
    if (g.includes('octav')) return 18;

    return 50;
  };

  return [...courses].sort((a, b) => {
    // 1. Tanda (Matutina -> Vespertina -> Otras)
    const tandaA = getTandaWeight(a.tanda, a.level);
    const tandaB = getTandaWeight(b.tanda, b.level);
    if (tandaA !== tandaB) return tandaA - tandaB;

    // 2. Nivel (Inicial -> Primaria -> Secundaria)
    const levelA = getLevelWeight(a.level);
    const levelB = getLevelWeight(b.level);
    if (levelA !== levelB) return levelA - levelB;

    // 3. Grado (Menor a mayor)
    const gradeA = getGradeWeight(a.grade);
    const gradeB = getGradeWeight(b.grade);
    if (gradeA !== gradeB) return gradeA - gradeB;

    // 4. Sección (A -> B -> C ...)
    const secA = (a.section || '').trim().toLowerCase();
    const secB = (b.section || '').trim().toLowerCase();
    if (secA !== secB) return secA.localeCompare(secB, undefined, { numeric: true });

    return 0;
  });
};
