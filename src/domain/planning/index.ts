// Punto de entrada público del dominio de planificación.

export type {
  Discipline,
  RunType,
  RunBlock,
  RunSession,
  MuscleGroup,
  StrengthExercise,
  StrengthSession,
  Session,
  DayCapacity,
  PlanConfig,
  WeekPlan,
  Plan,
} from './plan';

export { PlanningValidationError, normalizePlan } from './plan';

export {
  defaultPlanConfig,
  countAvailableDays,
  generatePlan,
  assignSessionsToDays,
  mondayOf,
  weeklyVolumeFactor,
} from './generator';

export {
  weekDayOf,
  dateForWeekDay,
  weekPlanForDate,
  getSessionsForDay,
  getTodaySessions,
  getNextSession,
  computeWeekProgress,
  emptyWeekProgress,
} from './today';

export type { WeekProgress, NextSession } from './today';

export type { PlanHorizon } from './generator';
export { weeksUntilMonday } from './generator';

export type {
  PlanBrief,
  PlanFocus,
  PlanFocusOption,
  GeneratedPlanResult,
  PlanBuilderRepository,
} from './brief';

export {
  PLAN_FOCUS_OPTIONS,
  MAX_BRIEF_NOTES_LENGTH,
  validatePlanBrief,
} from './brief';

export type { PlanSessionEdit } from './edits';

export {
  editPlanSession,
  removePlanSession,
  movePlanSession,
  replacePlanSession,
} from './edits';
