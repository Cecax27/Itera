// Operaciones de edición manual sobre el plan (bloque multi-semana).
//
// La pantalla Plan permite mover, eliminar y modificar sesiones concretas
// de una semana del bloque. Estas funciones son puras: reciben el plan y
// devuelven un plan nuevo sin mutar el original. La persistencia
// (sobrescribir plans/current en Firestore) corre por cuenta del hook
// usePlan; aquí solo hay lógica de dominio y validaciones de ocupación
// por día dentro de la semana indicada.

import { ALL_WEEK_DAYS, WeekDay } from '@/domain/profile';

import { Plan, PlanningValidationError, Session, WeekPlan } from './plan';

export interface PlanSessionEdit {
  /**
   * Día de destino si la sesión se mueve. Si se omite, la sesión editada
   * o eliminada se procesa en su día original.
   */
  toDay?: WeekDay;
  /**
   * Contenido nuevo de la sesión. Omitido = eliminar la sesión
   * (con toDay informado equivale a moverla sin cambiar el contenido,
   * que además se puede expresar pasando session tal cual).
   */
  session?: Session;
}

/** Devuelve la semana del bloque con ese lunes; lanza si no existe. */
function findWeek(plan: Plan, weekStart: string): WeekPlan {
  const week = plan.weeks.find((candidate) => candidate.weekStart === weekStart);
  if (!week) {
    throw new PlanningValidationError(
      'No existe una semana del plan con esa fecha de inicio.',
      'weekStart',
    );
  }
  return week;
}

/** Copia del plan con la semana indicada sustituida (sin mutar nada). */
function replaceWeek(plan: Plan, week: WeekPlan, sessions: Record<WeekDay, readonly Session[]>): Plan {
  return {
    ...plan,
    weeks: plan.weeks.map((candidate) => (candidate === week ? { ...week, sessions } : candidate)),
  };
}

/**
 * Aplica una edición sobre la sesión `index` del día `day` dentro de la
 * semana del bloque cuyo lunes es `weekStart`:
 * - `{ session }` sin `toDay` reemplaza el contenido en su sitio.
 * - `{ toDay }` sin `session` mueve la sesión al día destino.
 * - `{ toDay, session }` mueve y reemplaza.
 * - `{}` vacío elimina la sesión.
 *
 * Lanza PlanningValidationError si la semana no existe, si no hay sesión
 * en esa posición o si el día destino ya tiene una sesión.
 */
export function editPlanSession(
  plan: Plan,
  weekStart: string,
  day: WeekDay,
  index: number,
  change: PlanSessionEdit,
): Plan {
  const week = findWeek(plan, weekStart);
  const sessions = [...week.sessions[day]];
  if (index < 0 || index >= sessions.length) {
    throw new PlanningValidationError(
      'No existe una sesión en esa posición del plan.',
      'index',
    );
  }
  const [current] = sessions.splice(index, 1);

  const targetDay = change.toDay ?? day;
  const hasReplacement = 'session' in change && change.session !== undefined;
  if (!hasReplacement && targetDay === day) {
    // Eliminación pura: quitamos la sesión y no la volvemos a colocar.
    const nextSessions = { ...week.sessions };
    for (const d of ALL_WEEK_DAYS) nextSessions[d] = [...week.sessions[d]];
    nextSessions[day] = sessions;
    return replaceWeek(plan, week, nextSessions);
  }
  const nextSession = 'session' in change && change.session !== undefined ? change.session : current;

  // El plan admite como máximo una sesión por día.
  if (week.sessions[targetDay].length > 0 && targetDay !== day) {
    throw new PlanningValidationError(
      'El día de destino ya tiene una sesión asignada.',
      'toDay',
    );
  }

  const nextSessions = { ...week.sessions };
  for (const d of ALL_WEEK_DAYS) {
    nextSessions[d] = [...week.sessions[d]];
  }
  nextSessions[day] = sessions;
  nextSessions[targetDay] = [...nextSessions[targetDay], nextSession];

  return replaceWeek(plan, week, nextSessions);
}

/**
 * Elimina la sesión situada en `weekStart`/`day`/`index`. Atajo legible de
 * `editPlanSession(plan, weekStart, day, index, {})`.
 */
export function removePlanSession(
  plan: Plan,
  weekStart: string,
  day: WeekDay,
  index: number,
): Plan {
  return editPlanSession(plan, weekStart, day, index, {});
}

/**
 * Mueve la sesión de `weekStart`/`day`/`index` a `toDay`, sin cambiar su
 * contenido.
 */
export function movePlanSession(
  plan: Plan,
  weekStart: string,
  day: WeekDay,
  index: number,
  toDay: WeekDay,
): Plan {
  const week = findWeek(plan, weekStart);
  return editPlanSession(plan, weekStart, day, index, { toDay, session: week.sessions[day][index] });
}

/**
 * Reemplaza el contenido de la sesión en `weekStart`/`day`/`index`
 * manteniéndola en su sitio.
 */
export function replacePlanSession(
  plan: Plan,
  weekStart: string,
  day: WeekDay,
  index: number,
  session: Session,
): Plan {
  return editPlanSession(plan, weekStart, day, index, { session });
}
