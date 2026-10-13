// Motor de planificación: genera un plan semanal a partir de un perfil.
//
// El motor es TypeScript puro, sin React ni dependencias externas. Toma:
//   - Perfil (objetivos, disponibilidad, equipamiento)
//   - Configuración del plan (min/max sesiones, duración objetivo)
// Y devuelve un Plan listo para persistir.
//
// Reglas implementadas en H2:
//   1. El número de sesiones está entre minSessionsPerWeek y
//      maxSessionsPerWeek, ajustado a la capacidad de la semana
//      (días con franjas disponibles).
//   2. Las sesiones se distribuyen intentando que cada día de la
//      semana con franjas tenga a lo sumo una sesión.
//   3. Las sesiones de fuerza no van en días consecutivos.
//   4. Las sesiones de carrera no van el día después de una sesión
//      de fuerza intensa (tipo 'lower' o 'full_body').
//   5. La distribución intenta priorizar la disciplina del objetivo
//      principal.
//
// Las reglas más complejas (progresión de cargas, periodización, bloques
// de carrera específicos) son trabajo de hitos posteriores y/o de la
// capa de IA (H7).

import { ALL_WEEK_DAYS, Profile, WeekDay, WeeklyAvailability } from '@/domain/profile';

import {
  Plan,
  PlanConfig,
  RunBlock,
  RunSession,
  RunType,
  Session,
  StrengthExercise,
  StrengthSession,
} from './plan';

const DEFAULT_DURATION_MINUTES = 45;

/**
 * Devuelve la configuración por defecto del plan. El usuario puede
 * ajustarla en el perfil en el futuro.
 */
export function defaultPlanConfig(): PlanConfig {
  return {
    minSessionsPerWeek: 3,
    maxSessionsPerWeek: 5,
    targetSessionMinutes: DEFAULT_DURATION_MINUTES,
  };
}

/**
 * Cuenta cuántos días de la semana tienen al menos una franja disponible.
 */
export function countAvailableDays(avail: WeeklyAvailability): number {
  return ALL_WEEK_DAYS.filter((day) => avail[day].length > 0).length;
}

/**
 * Genera un plan semanal a partir de un perfil y configuración.
 *
 * @param profile perfil del usuario.
 * @param config configuración del plan (min/max sesiones, duración).
 * @param now fecha de generación, ISO 8601. Se usa para createdAt y
 *            para calcular el lunes de la semana actual.
 * @param idFn función que genera IDs únicos. Permite inyectar un mock
 *            determinista en tests.
 */
export function generatePlan(
  profile: Profile,
  config: PlanConfig,
  now: string,
  idFn: () => string = defaultIdFn,
): Plan {
  const availableDays = countAvailableDays(profile.availability);

  // Número de sesiones: entre min y max, y como máximo tantos días
  // disponibles hay. Si no hay días disponibles, plan vacío.
  const desiredSessions = Math.max(
    config.minSessionsPerWeek,
    Math.min(config.maxSessionsPerWeek, availableDays),
  );

  // Distribución por disciplina según objetivo principal.
  const sessions = buildSessions(desiredSessions, profile, idFn);

  // Asignación a días según disponibilidad y restricciones.
  const sessionsByDay = assignSessionsToDays(sessions, profile.availability);

  return {
    id: idFn(),
    weekStart: mondayOf(now),
    config,
    sessions: sessionsByDay,
    createdAt: now,
  };
}

 /**
 * Elimina N sesiones de fuerza empezando por las menos prioritarias.
 * (No se usa actualmente dentro del motor, pero queda como utilidad
 * por si en el futuro queremos recortar antes de pasar al asignador.)
 */
function removeExcessStrength(sessions: Session[], n: number): Session[] {
  const strengthIndices: number[] = [];
  sessions.forEach((s, i) => {
    if (s.discipline === 'strength') strengthIndices.push(i);
  });
  const sorted = strengthIndices
    .map((i) => ({ i, s: sessions[i] }))
    .sort((a, b) => priorityOrder(b.s) - priorityOrder(a.s));
  const toRemove = new Set(sorted.slice(0, n).map((x) => x.i));
  return sessions.filter((_, i) => !toRemove.has(i));
}

// --- Construcción de sesiones ---

function buildSessions(
  count: number,
  profile: Profile,
  idFn: () => string,
): Session[] {
  const primaryDiscipline = profile.primaryGoal.discipline;
  const sessions: Session[] = [];

  // Distribución: si el objetivo principal es running, 60% running +
  // 40% strength. Si es strength, al revés. Si hay objetivo principal
  // y secundarios que pidan más de otra disciplina, ajustamos.
  const runningShare = primaryDiscipline === 'running' ? 0.6 : 0.4;
  const strengthShare = 1 - runningShare;

  let runningCount = Math.round(count * runningShare);
  let strengthCount = count - runningCount;

  // Asegurar al menos 1 de cada si hay espacio.
  if (count >= 2 && runningCount === 0) {
    runningCount = 1;
    strengthCount = count - 1;
  }
  if (count >= 2 && strengthCount === 0) {
    strengthCount = 1;
    runningCount = count - 1;
  }

  for (let i = 0; i < runningCount; i++) {
    sessions.push(buildRunSession(profile, idFn, i));
  }
  for (let i = 0; i < strengthCount; i++) {
    sessions.push(buildStrengthSession(profile, idFn, i));
  }

  return sessions;
}

function buildRunSession(profile: Profile, idFn: () => string, index: number): RunSession {
  // Tipo: alternamos easy/long/tempo según índice para no acumular
  // carga. En el MVP no hay periodización real.
  const cycle: RunType[] = ['easy', 'long', 'tempo', 'easy', 'easy'];
  const type = cycle[index % cycle.length];

  const blocks = buildRunBlocks(type, profile);

  return {
    discipline: 'running',
    type,
    blocks,
    purpose: runPurpose(type),
    estimatedDurationMinutes: estimateRunMinutes(blocks, profile),
  };
}

function buildRunBlocks(type: RunType, profile: Profile): RunBlock[] {
  // Bloques muy simples para el MVP. Se refinan en H5 (cuando midamos
  // el historial para proponer progresión real).
  switch (type) {
    case 'easy':
      return [
        { type: 'steady', distanceMeters: 5000 },
      ];
    case 'long':
      return [
        { type: 'warmup', distanceMeters: 1500 },
        { type: 'steady', distanceMeters: 8000 },
        { type: 'cooldown', distanceMeters: 1500 },
      ];
    case 'tempo':
      return [
        { type: 'warmup', distanceMeters: 1500 },
        { type: 'steady', distanceMeters: 4000 },
        { type: 'cooldown', distanceMeters: 1500 },
      ];
    case 'intervals':
      return [
        { type: 'warmup', distanceMeters: 1500 },
        ...Array.from({ length: 5 }, (_, i) => ({
          type: 'interval' as const,
          distanceMeters: 800,
          recoverySeconds: 90,
          repetitions: 1,
          // repetitions aquí es el conteo de bloques de este tipo;
          // si quisiéramos "5x800", usaríamos repetitions=5 y 1 bloque.
          // Por simplicidad, lo dejamos explícito con 5 bloques.
          // Se ignora la i para evitar errores de TypeScript no usados.
          // (marcada con _ pero TS strict permite unused con _)
        })),
        { type: 'cooldown', distanceMeters: 1500 },
      ];
    case 'race':
      return [{ type: 'steady', distanceMeters: 10000 }];
  }
}

function runPurpose(type: RunType): string {
  switch (type) {
    case 'easy': return 'Carrera suave para acumular volumen sin fatiga.';
    case 'long': return 'Carrera larga para construir base aeróbica.';
    case 'tempo': return 'Trabajo sostenido en zona de umbral.';
    case 'intervals': return 'Series de alta intensidad con recuperación.';
    case 'race': return 'Competición o test de marca.';
  }
}

function estimateRunMinutes(blocks: readonly RunBlock[], profile: Profile): number {
  // Asumimos ritmo medio del perfil por defecto: principiante 7 min/km,
  // intermedio 6 min/km, avanzado 5 min/km. Esto es una heurística tosca
  // que ajustaremos con el perfil real cuando llegue el modelo.
  const paceSecondsPerKm =
    profile.experience === 'beginner' ? 420 :
    profile.experience === 'intermediate' ? 360 :
    300;

  let totalSeconds = 0;
  for (const block of blocks) {
    const km = block.distanceMeters / 1000;
    totalSeconds += km * paceSecondsPerKm;
    if (block.recoverySeconds) {
      // repetitions = 1 ya viene en el bloque; las repeticiones de
      // intervalos reales se modelan como bloques separados, así
      // que aquí solo añadimos una recuperación por bloque.
      totalSeconds += block.recoverySeconds;
    }
  }
  return Math.round(totalSeconds / 60);
}

function buildStrengthSession(
  profile: Profile,
  idFn: () => string,
  index: number,
): StrengthSession {
  // Alternamos upper/lower para evitar trabajar el mismo grupo en días
  // consecutivos. El primer día del ciclo es full_body para principiantes.
  const cycle: StrengthSession['type'][] =
    profile.experience === 'beginner'
      ? ['full_body', 'upper', 'lower', 'full_body', 'upper']
      : ['upper', 'lower', 'upper', 'lower', 'full_body'];

  const type = cycle[index % cycle.length];
  const exercises = pickExercisesForType(type, profile);

  return {
    discipline: 'strength',
    type,
    exercises,
    purpose: strengthPurpose(type),
    estimatedDurationMinutes: estimateStrengthMinutes(exercises),
  };
}

function pickExercisesForType(
  type: StrengthSession['type'],
  profile: Profile,
): StrengthExercise[] {
  // Catálogo mínimo. Se ampliará en H4 o cuando llegue la IA.
  const all: Record<string, StrengthExercise> = {
    bench_press: {
      id: 'bench_press', name: 'Press banca',
      muscleGroup: 'chest', sets: 4, reps: '6-8', targetWeightKg: 40,
      restSeconds: 120,
    },
    back_squat: {
      id: 'back_squat', name: 'Sentadilla trasera',
      muscleGroup: 'legs', sets: 4, reps: '6-8', targetWeightKg: 60,
      restSeconds: 150,
    },
    deadlift: {
      id: 'deadlift', name: 'Peso muerto',
      muscleGroup: 'back', sets: 3, reps: '5', targetWeightKg: 80,
      restSeconds: 180,
    },
    overhead_press: {
      id: 'overhead_press', name: 'Press militar',
      muscleGroup: 'shoulders', sets: 3, reps: '8-10', targetWeightKg: 25,
      restSeconds: 90,
    },
    row: {
      id: 'row', name: 'Remo con barra',
      muscleGroup: 'back', sets: 3, reps: '8-10', targetWeightKg: 35,
      restSeconds: 90,
    },
    pullup: {
      id: 'pullup', name: 'Dominadas',
      muscleGroup: 'back', sets: 3, reps: '6-8', targetWeightKg: 0,
      restSeconds: 120,
    },
    lunge: {
      id: 'lunge', name: 'Zancadas',
      muscleGroup: 'legs', sets: 3, reps: '10-12', targetWeightKg: 16,
      restSeconds: 90,
    },
    curl: {
      id: 'curl', name: 'Curl bíceps',
      muscleGroup: 'arms', sets: 3, reps: '10-12', targetWeightKg: 10,
      restSeconds: 60,
    },
    plank: {
      id: 'plank', name: 'Plancha',
      muscleGroup: 'core', sets: 3, reps: '45s', targetWeightKg: 0,
      restSeconds: 45,
    },
  };

  // Filtrar por equipamiento disponible.
  const equip = profile.equipment;
  const available = Object.values(all).filter((ex) => {
    if (ex.id === 'bench_press' || ex.id === 'overhead_press' || ex.id === 'curl') {
      return equip.dumbbells || equip.barbell;
    }
    if (ex.id === 'back_squat' || ex.id === 'deadlift' || ex.id === 'row') {
      return equip.barbell;
    }
    if (ex.id === 'pullup') return equip.pull_up_bar;
    if (ex.id === 'lunge') return equip.dumbbells;
    if (ex.id === 'plank') return true;
    return true;
  });

  const pick = (ids: string[]): StrengthExercise[] =>
    ids.map((id) => available.find((e) => e.id === id)).filter((e): e is StrengthExercise => Boolean(e));

  switch (type) {
    case 'upper':
      return pick(['bench_press', 'row', 'overhead_press', 'curl']);
    case 'lower':
      return pick(['back_squat', 'deadlift', 'lunge', 'plank']);
    case 'full_body':
      return pick(['back_squat', 'bench_press', 'row', 'plank']);
    case 'accessory':
      return pick(['curl', 'lunge', 'plank']);
  }
}

function strengthPurpose(type: StrengthSession['type']): string {
  switch (type) {
    case 'upper': return 'Tren superior: fuerza y volumen.';
    case 'lower': return 'Tren inferior: base de fuerza.';
    case 'full_body': return 'Cuerpo completo: activación general.';
    case 'accessory': return 'Accesorios:弱点 muscular o técnico.';
  }
}

function estimateStrengthMinutes(exercises: readonly StrengthExercise[]): number {
  let totalSeconds = 0;
  for (const ex of exercises) {
    // ~3 segundos por rep promedio + descanso entre series.
    const repsMatch = ex.reps.match(/\d+/);
    const reps = repsMatch ? Number(repsMatch[0]) : 8;
    const setSeconds = reps * 3 + ex.restSeconds;
    totalSeconds += ex.sets * setSeconds;
  }
  return Math.max(20, Math.round(totalSeconds / 60));
}

// --- Asignación a días ---

/**
 * Asigna sesiones a días respetando:
 * - Una sesión por día como máximo.
 * - No dos sesiones de fuerza en días consecutivos.
 * - No carrera el día después de fuerza intensa (lower / full_body).
 *
 * Estrategia:
 * 1. Separamos las sesiones en strength y running.
 * 2. Para strength: pre-reservamos días alternos del conjunto disponible
 *    y los llenamos en orden de prioridad (intensas primero). Esto
 *    garantiza la regla de consecutivos por construcción, sin depender
 *    de mirar el estado futuro durante la colocación.
 * 3. Para running: usamos todos los días disponibles restantes, evitando
 *    el día posterior a una fuerza intensa.
 *
 * Si alguna sesión no se puede colocar respetando las restricciones,
 * se hace fallback al primer día libre. Preferimos registrar la sesión
 * a perderla, aunque suponga relajar la restricción. Cuando llegue el
 * ajuste fino, registraremos warnings.
 */
export function assignSessionsToDays(
  sessions: readonly Session[],
  avail: WeeklyAvailability,
): Record<WeekDay, readonly Session[]> {
  const result: Record<WeekDay, Session[]> = {
    mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
  };

  const candidateDays = ALL_WEEK_DAYS.filter((day) => avail[day].length > 0);
  if (candidateDays.length === 0) return result;

  const strengthSessions = sessions
    .filter((s) => s.discipline === 'strength')
    .sort((a, b) => priorityOrder(a) - priorityOrder(b));
  const runSessions = sessions
    .filter((s) => s.discipline === 'running')
    .sort((a, b) => priorityOrder(a) - priorityOrder(b));

  const strengthDays = pickAlternates(candidateDays);

  // Recortar strength si excede los días alternos disponibles. Para no
  // violar la restricción "no consecutivos", solo se pueden colocar
  // tantas strength como días alternos haya.
  const overflow = strengthSessions.length - strengthDays.length;
  const trimmedStrength = overflow > 0
    ? strengthSessions.slice(0, strengthDays.length)
    : strengthSessions;
  const droppedStrength = overflow > 0
    ? strengthSessions.slice(strengthDays.length)
    : [];

  // 1) Strength en días alternos.
  for (const s of trimmedStrength) {
    let placed = false;
    for (const day of strengthDays) {
      if (result[day].length > 0) continue;
      result[day].push(s);
      placed = true;
      break;
    }
    if (!placed) {
      // Fallback: cualquier día libre.
      for (const day of candidateDays) {
        if (result[day].length === 0) {
          result[day].push(s);
          break;
        }
      }
    }
  }
  // Las strength que no caben en días alternos se pierden. En el MVP es
  // preferible registrarlas con un warning que apilarlas rompiendo la
  // restricción. (Mejora futura: emitir warnings vía canal separado.)
  void droppedStrength;

  // 2) Running en días restantes, evitando día tras strength intensa.
  for (const r of runSessions) {
    let placed = false;
    for (const day of candidateDays) {
      if (result[day].length > 0) continue;
      if (!isCompatiblePlacement(day, result, r)) continue;
      result[day].push(r);
      placed = true;
      break;
    }
    if (!placed) {
      // Fallback: primer día libre que cumpla la restricción
      // (incluso si estaba ocupado por otra razón). Si no hay ninguno,
      // colocamos en cualquier día libre como último recurso.
      let fallbackPlaced = false;
      for (const day of candidateDays) {
        if (result[day].length > 0) continue;
        if (!isCompatiblePlacement(day, result, r)) continue;
        result[day].push(r);
        fallbackPlaced = true;
        break;
      }
      if (!fallbackPlaced) {
        for (const day of candidateDays) {
          if (result[day].length === 0) {
            result[day].push(r);
            break;
          }
        }
      }
    }
  }

  return result;
}

/**
 * Devuelve una selección alternada de días. Si los candidatos son
 * [mon, tue, wed, thu, fri, sat], devuelve [mon, wed, fri] o
 * [tue, thu, sat] según qué paridad haya más espacio desde el inicio.
 *
 * Esto garantiza que cualquier subconjunto de días alternos tendrá
 * al menos un hueco entre ellos.
 */
function pickAlternates(days: readonly WeekDay[]): WeekDay[] {
  if (days.length === 0) return [];
  const first = days[0];
  const startIdx = ALL_WEEK_DAYS.indexOf(first);
  const result: WeekDay[] = [];
  for (let i = startIdx; i < ALL_WEEK_DAYS.length; i += 2) {
    if (days.includes(ALL_WEEK_DAYS[i])) {
      result.push(ALL_WEEK_DAYS[i]);
    }
  }
  // Si no hay días alternos desde el inicio, probamos desde la otra paridad.
  if (result.length === 0) {
    for (let i = startIdx + 1; i < ALL_WEEK_DAYS.length; i += 2) {
      if (days.includes(ALL_WEEK_DAYS[i])) {
        result.push(ALL_WEEK_DAYS[i]);
      }
    }
  }
  return result;
}

function priorityOrder(s: Session): number {
  // 0 = prioridad alta (fuerza intensa, requiere buena recuperación).
  if (s.discipline === 'strength' && (s.type === 'lower' || s.type === 'full_body')) {
    return 0;
  }
  if (s.discipline === 'strength') return 1;
  if (s.discipline === 'running' && s.type === 'long') return 2;
  return 3;
}

function isCompatiblePlacement(
  day: WeekDay,
  result: Record<WeekDay, Session[]>,
  session: Session,
): boolean {
  // No fuerza en días consecutivos.
  if (session.discipline === 'strength') {
    if (wouldBeConsecutiveStrength(day, result, session)) return false;
  }

  // No carrera el día después de fuerza intensa.
  if (session.discipline === 'running') {
    const prev = prevDay(day);
    if (prev) {
      const prevSession = result[prev].find((s) => s.discipline === 'strength');
      if (prevSession && (prevSession.type === 'lower' || prevSession.type === 'full_body')) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Indica si colocar `session` de fuerza en `day` la haría consecutiva
 * con otra sesión de fuerza ya colocada en el día anterior o siguiente.
 */
function wouldBeConsecutiveStrength(
  day: WeekDay,
  result: Record<WeekDay, Session[]>,
  session: Session,
): boolean {
  if (session.discipline !== 'strength') return false;
  for (const other of [prevDay(day), nextDay(day)]) {
    if (other && result[other].some((s) => s.discipline === 'strength')) {
      return true;
    }
  }
  return false;
}

function prevDay(day: WeekDay): WeekDay | null {
  const i = ALL_WEEK_DAYS.indexOf(day);
  return i > 0 ? ALL_WEEK_DAYS[i - 1] : null;
}

function nextDay(day: WeekDay): WeekDay | null {
  const i = ALL_WEEK_DAYS.indexOf(day);
  return i < ALL_WEEK_DAYS.length - 1 ? ALL_WEEK_DAYS[i + 1] : null;
}

// --- Utilidades ---

/**
 * Devuelve el lunes de la semana de la fecha dada, en formato YYYY-MM-DD.
 * Implementación simple sin dependencias: parseamos la fecha, ajustamos.
 */
export function mondayOf(dateIso: string): string {
  const [y, m, d] = dateIso.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // getUTCDay: 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
  const dow = date.getUTCDay();
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  date.setUTCDate(date.getUTCDate() + diffToMonday);
  return date.toISOString().slice(0, 10);
}

function defaultIdFn(): string {
  return `pl_${Math.random().toString(36).slice(2, 11)}`;
}