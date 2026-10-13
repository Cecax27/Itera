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