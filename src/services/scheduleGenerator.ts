import { ScheduleEntry } from '../types';
import { AppState } from '../context/AppContext';

export const generateSchedule = (state: AppState): ScheduleEntry[] => {
  const {
    assignments,
    courses,
    academicRequirements,
    timeBlocks,
    rooms,
    teacherPreferences,
    breakPreferences,
    winterSchedulePreference,
    teachers
  } = state;
  const schedule: ScheduleEntry[] = [];

  // 1. Create a list of all required teaching hours (tasks)
  const tasks = assignments.flatMap((a) => {
    const course = courses.find((c) => c.id === a.courseId);
    const requirement = academicRequirements.find(
      (r) =>
        r.cycle === course?.cycle && r.modality === course?.modality && r.output === course?.output
    );
    let hours = requirement ? requirement.weeklyHours : 0;

    // Apply winter reduction
    if (winterSchedulePreference) {
      hours = Math.floor(hours * winterSchedulePreference.reductionFactor);
    }

    return Array(hours).fill({
      courseId: a.courseId,
      subjectId: a.subjectId,
      teacherId: a.teacherId
    });
  });

  // 3. Greedy allocation
  for (const timeBlock of timeBlocks) {
    for (const task of tasks) {
      const course = courses.find((c) => c.id === task.courseId);
      if (!course) continue;

      // Check if it's a break for THIS specific course (level and cycle)
      const isBreakForThisCourse = (breakPreferences || []).some(
        (bp) =>
          bp.startTime === timeBlock.startTime &&
          bp.level === course.level &&
          (bp.cycle === 'General' || bp.cycle === course.cycle)
      );
      if (isBreakForThisCourse) continue;

      // Check if already scheduled
      if (schedule.some((s) => s.timeBlockId === timeBlock.id && s.courseId === task.courseId))
        continue;
      if (schedule.some((s) => s.timeBlockId === timeBlock.id && s.teacherId === task.teacherId))
        continue;

      // Check teacher preferences
      const teacherPref = (teacherPreferences || []).find((tp) => tp.teacherId === task.teacherId);
      if (teacherPref) {
        // 1. Check if day is allowed
        if (!teacherPref.workingDays.includes(timeBlock.day)) continue;

        // 2. Check shift availability (respect daily overrides if they exist)
        const shift = course.tanda || 'Matutina';
        let isAvailableInShift = false;

        const dayConfig = teacherPref.dailyConfig?.[timeBlock.day];

        const mStart = dayConfig?.mStart || teacherPref.morningStart || '08:00';
        const mEnd = dayConfig?.mEnd || teacherPref.morningEnd || '12:00';
        const aStart = dayConfig?.aStart || teacherPref.afternoonStart || '14:00';
        const aEnd = dayConfig?.aEnd || teacherPref.afternoonEnd || '18:00';

        if (shift === 'Matutina' || shift === 'Jornada Extendida') {
          if (timeBlock.startTime >= mStart && timeBlock.endTime <= mEnd) {
            isAvailableInShift = true;
          }
        }

        if (shift === 'Vespertina' || shift === 'Jornada Extendida') {
          if (timeBlock.startTime >= aStart && timeBlock.endTime <= aEnd) {
            isAvailableInShift = true;
          }
        }

        if (!isAvailableInShift) continue;
      }

      // Assign
      schedule.push({
        id: Date.now().toString() + Math.random(),
        ...task,
        roomId: rooms[0]?.id || 'default',
        timeBlockId: timeBlock.id
      });

      // Remove task from pending
      const index = tasks.indexOf(task);
      if (index > -1) tasks.splice(index, 1);

      break; // Move to next time block
    }
  }

  return schedule;
};

export const optimizePedagogically = (state: AppState): ScheduleEntry[] => {
  // A more sophisticated approach:
  // 1. Sort tasks by total hours remaining (balance load)
  // 2. Score time blocks by adjacency to existing classes (reduce gaps)
  // 3. Prefer spreading classes across days (improve distribution)

  // For now, a simplified version of this logic:
  const schedule = generateSchedule(state); // Start with a base schedule

  // Heuristic: Shuffle tasks to try different distributions
  // In a real scenario, this would be a constraint solver or genetic algorithm.
  return schedule.sort(() => Math.random() - 0.5);
};
