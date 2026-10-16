// Operaciones de edición manual sobre el plan semanal.
//
// La pantalla Plan permite mover, eliminar y modificar sesiones concretas.
// Estas funciones son puras: reciben el plan y devuelven un plan nuevo sin
// mutar el original. La persistencia (sobrescribir plans/current en
// Firestore) corre por cuenta del hook usePlan; aquí solo hay lógica de
// dominio y validaciones de ocupación por día.

import { ALL_WEEK_DAYS, WeekDay } from '@/domain/profile';

import { Plan, PlanningValidationError, Session } from './plan';

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

/**
 * Aplica una edición sobre la sesión `index` del día `day`:
 * - `{ session }` sin `toDay` reemplaza el contenido en su sitio.
 * - `{ toDay }` sin `session` mueve la sesión al día destino.
 * - `{ toDay, session }` mueve y reemplaza.
 * - `{}` vacío elimina la sesión.
 *
 * Lanza PlanningValidationError si no hay sesión en esa posición o si
 * el día destino ya tiene una sesión.
 */
export function editPlanSession(
  plan: Plan,
  day: WeekDay,
  index: number,
  change: PlanSessionEdit,
): Plan {
  const sessions = [...plan.sessions[day]];
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
    const nextSessions = { ...plan.sessions };
    for (const d of ALL_WEEK_DAYS) nextSessions[d] = [...plan.sessions[d]];
    nextSessions[day] = sessions;
    return { ...plan, sessions: nextSessions };
  }
  const nextSession = 'session' in change && change.session !== undefined ? change.session : current;

  // El plan admite como máximo una sesión por día.
  if (plan.sessions[targetDay].length > 0 && targetDay !== day) {
    throw new PlanningValidationError(
      'El día de destino ya tiene una sesión asignada.',
      'toDay',
    );
  }

  const nextSessions = { ...plan.sessions };
  for (const d of ALL_WEEK_DAYS) {
    nextSessions[d] = [...plan.sessions[d]];
  }
  nextSessions[day] = sessions;
  nextSessions[targetDay] = [...nextSessions[targetDay], nextSession];

  return { ...plan, sessions: nextSessions };
}

/**
 * Elimina la sesión situada en `day`/`index`. Atajo legible de
 * `editPlanSession(plan, day, index, {})`.
 */
export function removePlanSession(plan: Plan, day: WeekDay, index: number): Plan {
  return editPlanSession(plan, day, index, {});
}

/**
 * Mueve la sesión de `day`/`index` a `toDay`, sin cambiar su contenido.
 */
export function movePlanSession(
  plan: Plan,
  day: WeekDay,
  index: number,
  toDay: WeekDay,
): Plan {
  return editPlanSession(plan, day, index, { toDay, session: plan.sessions[day][index] });
}

/**
 * Reemplaza el contenido de la sesión en `day`/`index` manteniéndola
 * en su sitio.
 */
export function replacePlanSession(
  plan: Plan,
  day: WeekDay,
  index: number,
  session: Session,
): Plan {
  return editPlanSession(plan, day, index, { session });
}
