export const sortCourses = (courses: any[]) => {
  const levelOrder: { [key: string]: number } = {
    'inicial': 1,
    'primario': 2,
    'primaria': 2,
    'secundario': 3,
    'secundaria': 3
  };

  const getLevelWeight = (level: string) => {
    const l = (level || '').toLowerCase().trim();
    return levelOrder[l] || 99;
  };

  const getGradeWeight = (grade: string) => {
    const g = (grade || '').toLowerCase().trim();
    if (g.includes('maternal')) return 1;
    if (g.includes('pre-k') || g.includes('prek')) return 2;
    if (g.includes('kínder') || g.includes('kinder')) return 3;
    if (g.includes('preprimario') || g.includes('pre-primario')) return 4;

    const match = g.match(/(\d+)/);
    if (match) {
      return 10 + parseInt(match[1], 10);
    }
    return 50;
  };

  return [...courses].sort((a, b) => {
    const levelA = getLevelWeight(a.level);
    const levelB = getLevelWeight(b.level);
    if (levelA !== levelB) return levelA - levelB;

    const gradeA = getGradeWeight(a.grade);
    const gradeB = getGradeWeight(b.grade);
    if (gradeA !== gradeB) return gradeA - gradeB;

    const secA = (a.section || '').toLowerCase();
    const secB = (b.section || '').toLowerCase();
    if (secA !== secB) return secA.localeCompare(secB);

    const tandaA = (a.tanda || '').toLowerCase();
    const tandaB = (b.tanda || '').toLowerCase();
    return tandaA.localeCompare(tandaB);
  });
};
