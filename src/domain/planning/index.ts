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
  Plan,
} from './plan';

export { PlanningValidationError } from './plan';

export {
  defaultPlanConfig,
  countAvailableDays,
  generatePlan,
  assignSessionsToDays,
  mondayOf,
} from './generator';

export {
  weekDayOf,
  dateForWeekDay,
  getSessionsForDay,
  getTodaySessions,
  getNextSession,
  computeWeekProgress,
} from './today';

export type { WeekProgress } from './today';
