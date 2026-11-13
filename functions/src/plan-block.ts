// Constructor determinista de bloques multi-semana para el servidor.
//
// Cuando el asistente propone un bloque (kind: 'block'), solo decide el
// horizonte (número de semanas y/o fecha objetivo). Este módulo
// materializa las semanas concretas usando el plan actual como
// plantilla y unas reglas de progresión conservadoras:
//   - El volumen de carrera (bloques steady/interval) sube ~5% semanal,
//     con tope de +30% respecto a la semana 1.
//   - Cada 4ª semana es descarga (volumen ×0.8).
//   - La última semana es descarga de objetivo (×0.7).
//
// Es TypeScript puro y espeja las reglas del motor cliente
// (src/domain/planning/generator.ts); las Functions no pueden importar
// ese código directamente porque se despliegan como paquete separado.
// Si cambian las reglas aquí, cambian allí.

import { PersistedSession, PlanRecord, RunBlockRecord, WeekDay, WeekSessions, WEEK_DAYS } from './plan-change';

const DAY_MS = 86_400_000;

export interface BlockHorizon {
  weeks?: number | null;
  goalDate?: string | null;
}

/** Límites del horizonte que puede pedir el asistente. */
export const BLOCK_MIN_WEEKS = 1;
export const BLOCK_MAX_WEEKS = 26;

/**
 * Construye el bloque propuesto a partir del plan actual.
 *
 * @param currentPlan plan activo (fuente de la plantilla semanal).
 * @param horizon horizonte decidido por el asistente.
 * @param todayIso fecha del servidor (ISO), para anclar el bloque a la
 *        semana en curso aunque el plan empiece semanas atrás.
 */
export function buildPlanBlock(
  currentPlan: PlanRecord,
  horizon: BlockHorizon,
  todayIso: string,
): PlanRecord {
  const startMonday = mondayOf(todayIso);
  const template = currentPlan.weeks[0].sessions;
  const totalWeeks = resolveWeekCount(horizon, startMonday);

  const weeks = [];
  for (let index = 0; index < totalWeeks; index += 1) {
    const weekStart = addDays(startMonday, 7 * index);
    const sessions: WeekSessions = index === 0
      ? structuredClone(template)
      : applyWeeklyProgression(template, index, totalWeeks);
    weeks.push({ weekStart, sessions });
  }

  return {
    ...currentPlan,
    weekStart: startMonday,
    ...(horizon.goalDate ? { goalDate: horizon.goalDate } : {}),
    weeks,
  };
}

/**
 * Resuelve el número de semanas del bloque a partir del horizonte.
 * Prioridad: fecha objetivo > número pedido > 4 semanas por defecto.
 */
export function resolveWeekCount(horizon: BlockHorizon, startMonday: string): number {
  if (horizon.goalDate) {
    const goalMonday = mondayOf(horizon.goalDate);
    const diffDays = Math.floor(
      (Date.parse(`${goalMonday}T00:00:00.000Z`) - Date.parse(`${startMonday}T00:00:00.000Z`)) / DAY_MS,
    );
    if (diffDays < 0) {
      throw new Error('La fecha objetivo es anterior a la semana en curso.');
    }
    return clampWeeks(Math.floor(diffDays / 7) + 1);
  }
  return clampWeeks(horizon.weeks ?? 4);
}

function clampWeeks(requested: number): number {
  if (!Number.isFinite(requested)) return 4;
  return Math.max(BLOCK_MIN_WEEKS, Math.min(BLOCK_MAX_WEEKS, Math.floor(requested)));
}

export function mondayOf(dateIso: string): string {
  const [y, m, d] = dateIso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) throw new Error('La fecha no es válida.');
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay();
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  date.setUTCDate(date.getUTCDate() + diffToMonday);
  return date.toISOString().slice(0, 10);
}

function addDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Factor de volumen para la semana `index` (0-based) de un bloque de
 * `totalWeeks` semanas. Semana 0 = 1.
 */
export function weeklyVolumeFactor(index: number, totalWeeks: number): number {
  if (index <= 0 || totalWeeks <= 1) return 1;
  const isLast = index === totalWeeks - 1;
  if (isLast && totalWeeks >= 3) return 0.7; // descarga de objetivo
  if ((index + 1) % 4 === 0) return 0.8; // descarga cada 4 semanas
  const progressionWeeks = index % 4;
  return Math.min(1.3, 1 + 0.05 * progressionWeeks);
}

function applyWeeklyProgression(
  template: WeekSessions,
  index: number,
  totalWeeks: number,
): WeekSessions {
  const factor = weeklyVolumeFactor(index, totalWeeks);
  const result = {} as WeekSessions;
  for (const day of WEEK_DAYS) {
    result[day] = (template[day] ?? []).map((session) =>
      session.discipline === 'running' ? scaleRunSession(session, factor) : structuredClone(session));
  }
  return result;
}

type RunSessionRecord = Extract<PersistedSession, { discipline: 'running' }>;

function scaleRunSession(session: RunSessionRecord, factor: number): RunSessionRecord {
  return {
    ...session,
    blocks: session.blocks.map((block) => scaleRunBlock(block, factor)),
    estimatedDurationMinutes: Math.max(
      1,
      Math.round(session.estimatedDurationMinutes * factor),
    ),
  };
}

function scaleRunBlock(block: RunBlockRecord, factor: number): RunBlockRecord {
  if (factor === 1) return block;
  // Los calentamientos y enfriamientos se mantienen; el volumen extra
  // va al trabajo principal (steady/interval).
  if (block.type !== 'steady' && block.type !== 'interval') return block;
  return {
    ...block,
    distanceMeters: Math.round((block.distanceMeters * factor) / 100) * 100,
  };
}
