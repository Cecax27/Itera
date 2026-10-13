// Utilidades para resolver la sesión del día y la siguiente sesión a
// partir de un Plan.
//
// El plan se asigna por día de la semana (L-D), no por fecha concreta.
// Para saber qué toca hoy:
//   1. Calculamos el día de la semana actual en formato WeekDay.
//   2. Devolvemos las sesiones de ese día (puede haber 0 = descanso).
//
// Para "siguiente sesión", buscamos en los días posteriores de esta
// semana, y si no hay, vamos a la siguiente semana (que en el MVP es
// la misma porque solo tenemos un plan actual).

import { ALL_WEEK_DAYS, WeekDay } from '@/domain/profile';

import { Plan, Session } from './plan';

const JS_DAY_TO_WEEK_DAY: Record<number, WeekDay> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

/**
 * Devuelve el WeekDay correspondiente a una fecha ISO (YYYY-MM-DD o
 * ISO completa). Si la fecha es inválida, devuelve 'mon' como fallback
 * conservador para no bloquear la UI.
 */
export function weekDayOf(dateIso: string): WeekDay {
  const [y, m, d] = dateIso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return 'mon';
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay();
  return JS_DAY_TO_WEEK_DAY[dow];
}

/**
 * Devuelve la sesión (o sesiones) del día indicado.
 * Si hay varias, las devuelve en orden.
 */
export function getSessionsForDay(plan: Plan, day: WeekDay): readonly Session[] {
  return plan.sessions[day];
}

/**
 * Devuelve la sesión del día de la fecha indicada. Lista vacía significa
 * "descanso".
 */
export function getTodaySessions(plan: Plan, dateIso: string): readonly Session[] {
  return getSessionsForDay(plan, weekDayOf(dateIso));
}

/**
 * Busca la próxima sesión con contenido a partir del día indicado
 * (incluido). Recorre los días en orden hasta encontrar uno con sesiones.
 *
 * Si no encuentra nada en esta semana, devuelve null.
 */
export function getNextSession(plan: Plan, dateIso: string): { day: WeekDay; sessions: readonly Session[] } | null {
  const today = weekDayOf(dateIso);
  const startIdx = ALL_WEEK_DAYS.indexOf(today);

  for (let offset = 0; offset < ALL_WEEK_DAYS.length; offset++) {
    const idx = (startIdx + offset) % ALL_WEEK_DAYS.length;
    const day = ALL_WEEK_DAYS[idx];
    const sessions = plan.sessions[day];
    if (sessions.length > 0) {
      return { day, sessions };
    }
  }
  return null;
}

/**
 * Resumen compacto del progreso de la semana.
 *
 * En el MVP solo contamos cuántas sesiones están planeadas (no cuáles
 * están completadas — esa distinción llega en H4 cuando registremos
 * resultados). Mostraremos: número total de sesiones planeadas, número
 * por disciplina, km totales planeados en carrera.
 *
 * Cuando llegue H4 (registro de resultados), añadimos 'completed' aquí.
 */
export interface WeekProgress {
  totalSessions: number;
  runningSessions: number;
  strengthSessions: number;
  totalRunningMeters: number;
}

export function computeWeekProgress(plan: Plan): WeekProgress {
  const all = Object.values(plan.sessions).flat();
  const totalSessions = all.length;
  const runningSessions = all.filter((s) => s.discipline === 'running').length;
  const strengthSessions = all.filter((s) => s.discipline === 'strength').length;

  let totalRunningMeters = 0;
  for (const session of all) {
    if (session.discipline === 'running') {
      for (const block of session.blocks) {
        const reps = block.repetitions ?? 1;
        totalRunningMeters += block.distanceMeters * reps;
      }
    }
  }

  return {
    totalSessions,
    runningSessions,
    strengthSessions,
    totalRunningMeters,
  };
}