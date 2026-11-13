// Utilidades para resolver la sesión del día y la siguiente sesión a
// partir de un Plan multi-semana.
//
// El plan es un bloque de semanas: cada semana tiene su propio
// weekStart (lunes) y sus sesiones por día. Para saber qué toca hoy:
//   1. Calculamos el lunes de la semana de la fecha dada.
//   2. Buscamos la semana del bloque con ese weekStart.
//   3. Devolvemos las sesiones del día correspondiente (puede haber 0
//      = descanso).
//
// Para "siguiente sesión" buscamos hacia adelante desde hoy (dentro de
// la semana actual y en las semanas posteriores del bloque). Si no hay
// nada más adelante, caemos al comportamiento anterior: envolver y
// buscar en los días ya pasados de la semana en curso.

import { ALL_WEEK_DAYS, WeekDay } from '@/domain/profile';

import { Plan, Session, WeekPlan } from './plan';
import { mondayOf } from './generator';

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

/** Devuelve la fecha ISO de un día del plan, tomando weekStart como lunes. */
export function dateForWeekDay(weekStart: string, day: WeekDay): string {
  const monday = new Date(`${weekStart.slice(0, 10)}T00:00:00.000Z`);
  const offset = ALL_WEEK_DAYS.indexOf(day);
  monday.setUTCDate(monday.getUTCDate() + offset);
  return monday.toISOString().slice(0, 10);
}

/**
 * Devuelve la semana del bloque que contiene la fecha indicada.
 * Devuelve null si la fecha está fuera del bloque (antes de la primera
 * semana o después de la última).
 */
export function weekPlanForDate(plan: Plan, dateIso: string): WeekPlan | null {
  const monday = mondayOf(dateIso);
  return plan.weeks.find((week) => week.weekStart === monday) ?? null;
}

/**
 * Devuelve la sesión (o sesiones) del día indicado de una semana.
 * Si hay varias, las devuelve en orden.
 */
export function getSessionsForDay(week: WeekPlan, day: WeekDay): readonly Session[] {
  return week.sessions[day];
}

/**
 * Devuelve la sesión del día de la fecha indicada, según la semana del
 * bloque que la contiene. Lista vacía significa "descanso" (o fecha
 * fuera del bloque).
 */
export function getTodaySessions(plan: Plan, dateIso: string): readonly Session[] {
  const week = weekPlanForDate(plan, dateIso);
  if (!week) return [];
  return getSessionsForDay(week, weekDayOf(dateIso));
}

export interface NextSession {
  /** Lunes de la semana a la que pertenece la sesión encontrada. */
  weekStart: string;
  /** Fecha completa (YYYY-MM-DD) de la sesión encontrada. */
  date: string;
  /** Día de la semana de la sesión encontrada. */
  day: WeekDay;
  sessions: readonly Session[];
}

/**
 * Busca la próxima sesión con contenido a partir de la fecha indicada
 * (incluido). Primero recorre hacia adelante el resto de la semana
 * actual y las semanas posteriores del bloque. Si no encuentra nada,
 * envuelve y busca en los días ya pasados de la semana actual.
 */
export function getNextSession(plan: Plan, dateIso: string): NextSession | null {
  const week = weekPlanForDate(plan, dateIso);
  if (!week) return null;
  const today = weekDayOf(dateIso);
  const startIndex = plan.weeks.indexOf(week);
  const startDayIndex = ALL_WEEK_DAYS.indexOf(today);

  // Búsqueda hacia adelante: resto de la semana actual + semanas posteriores.
  for (let weekIdx = startIndex; weekIdx < plan.weeks.length; weekIdx += 1) {
    const candidate = plan.weeks[weekIdx];
    const firstDay = weekIdx === startIndex ? startDayIndex : 0;
    for (let dayIdx = firstDay; dayIdx < ALL_WEEK_DAYS.length; dayIdx += 1) {
      const day = ALL_WEEK_DAYS[dayIdx];
      const sessions = candidate.sessions[day];
      if (sessions.length > 0) {
        return { weekStart: candidate.weekStart, date: dateForWeekDay(candidate.weekStart, day), day, sessions };
      }
    }
  }

  // Envolver: días ya pasados de la semana actual.
  for (let dayIdx = 0; dayIdx < startDayIndex; dayIdx += 1) {
    const day = ALL_WEEK_DAYS[dayIdx];
    const sessions = week.sessions[day];
    if (sessions.length > 0) {
      return { weekStart: week.weekStart, date: dateForWeekDay(week.weekStart, day), day, sessions };
    }
  }
  return null;
}

/**
 * Resumen compacto del progreso de una semana.
 *
 * Mostramos: número total de sesiones planeadas, número por
 * disciplina y km totales planeados en carrera.
 */
export interface WeekProgress {
  totalSessions: number;
  runningSessions: number;
  strengthSessions: number;
  totalRunningMeters: number;
}

export function emptyWeekProgress(): WeekProgress {
  return {
    totalSessions: 0,
    runningSessions: 0,
    strengthSessions: 0,
    totalRunningMeters: 0,
  };
}

export function computeWeekProgress(week: WeekPlan | null): WeekProgress {
  if (!week) return emptyWeekProgress();
  const all = Object.values(week.sessions).flat();
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
