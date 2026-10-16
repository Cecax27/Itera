import { z } from 'zod';

export const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekDay = typeof WEEK_DAYS[number];

export const MAX_PLAN_WEEKS = 26;

const PlanConfigSchema = z.object({
  minSessionsPerWeek: z.number().int().nonnegative(),
  maxSessionsPerWeek: z.number().int().positive(),
  targetSessionMinutes: z.number().positive(),
}).strict();

const PersistedRunBlockSchema = z.object({
  type: z.enum(['warmup', 'interval', 'recovery', 'cooldown', 'steady']),
  distanceMeters: z.number().positive(),
  paceSecondsPerKm: z.number().positive().optional(),
  recoverySeconds: z.number().nonnegative().optional(),
  repetitions: z.number().int().positive().optional(),
}).strict();

const PersistedStrengthExerciseSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  muscleGroup: z.enum(['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full_body']),
  sets: z.number().int().positive().max(20),
  reps: z.string().min(1).max(30),
  targetWeightKg: z.number().nonnegative().max(500),
  restSeconds: z.number().int().nonnegative().max(1800),
}).strict();

const PersistedRunningSessionSchema = z.object({
  discipline: z.literal('running'),
  type: z.enum(['easy', 'long', 'tempo', 'intervals', 'race']),
  blocks: z.array(PersistedRunBlockSchema).min(1).max(20),
  purpose: z.string().max(500).optional(),
  estimatedDurationMinutes: z.number().positive().max(600),
}).strict();

const PersistedStrengthSessionSchema = z.object({
  discipline: z.literal('strength'),
  type: z.enum(['full_body', 'upper', 'lower', 'accessory']),
  exercises: z.array(PersistedStrengthExerciseSchema).min(1).max(40),
  purpose: z.string().max(500).optional(),
  estimatedDurationMinutes: z.number().positive().max(600),
}).strict();

const PersistedSessionSchema = z.discriminatedUnion('discipline', [
  PersistedRunningSessionSchema,
  PersistedStrengthSessionSchema,
]);

const WeekSessionsSchema = z.object({
  mon: z.array(PersistedSessionSchema).max(1),
  tue: z.array(PersistedSessionSchema).max(1),
  wed: z.array(PersistedSessionSchema).max(1),
  thu: z.array(PersistedSessionSchema).max(1),
  fri: z.array(PersistedSessionSchema).max(1),
  sat: z.array(PersistedSessionSchema).max(1),
  sun: z.array(PersistedSessionSchema).max(1),
}).strict();

export type WeekSessions = z.infer<typeof WeekSessionsSchema>;
export type PersistedSession = z.infer<typeof PersistedSessionSchema>;
export type RunBlockRecord = z.infer<typeof PersistedRunBlockSchema>;

const WeekRecordSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sessions: WeekSessionsSchema,
}).strict();

// El plan actual es un bloque de una o varias semanas.
export const CurrentPlanSchema = z.object({
  id: z.string().min(1),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  goalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  config: PlanConfigSchema,
  weeks: z.array(WeekRecordSchema).min(1).max(MAX_PLAN_WEEKS),
  createdAt: z.string().min(1),
}).strict();

// Compatibilidad: los planes previos al bloque multi-semana guardaban
// una única semana con `sessions` por día.
const LegacyPlanSchema = z.object({
  id: z.string().min(1),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  goalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  config: PlanConfigSchema,
  sessions: WeekSessionsSchema,
  createdAt: z.string().min(1),
}).strict();

export type PlanRecord = z.infer<typeof CurrentPlanSchema>;

/**
 * Normaliza un plan que llega de Firestore a la forma de bloque.
 * Acepta el formato de bloque nuevo y el formato legacy de una semana.
 */
export function parsePlanRecord(raw: unknown): PlanRecord {
  const parsedBlock = CurrentPlanSchema.safeParse(raw);
  if (parsedBlock.success) return parsedBlock.data;
  const parsedLegacy = LegacyPlanSchema.safeParse(raw);
  if (parsedLegacy.success) {
    const { sessions, ...rest } = parsedLegacy.data;
    return { ...rest, weeks: [{ weekStart: rest.weekStart, sessions }] };
  }
  throw new Error('El plan almacenado no tiene un formato válido.');
}

const ModelRunBlockSchema = z.object({
  type: z.enum(['warmup', 'interval', 'recovery', 'cooldown', 'steady']),
  distanceMeters: z.number(),
  paceSecondsPerKm: z.number().nullable(),
  recoverySeconds: z.number().nullable(),
  repetitions: z.number().nullable(),
}).strict();

const ModelStrengthExerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  muscleGroup: z.enum(['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full_body']),
  sets: z.number(),
  reps: z.string(),
  targetWeightKg: z.number(),
  restSeconds: z.number(),
}).strict();

const ModelRunningSessionSchema = z.object({
  discipline: z.literal('running'),
  type: z.enum(['easy', 'long', 'tempo', 'intervals', 'race']),
  blocks: z.array(ModelRunBlockSchema),
  purpose: z.string().nullable(),
  estimatedDurationMinutes: z.number(),
}).strict();

const ModelStrengthSessionSchema = z.object({
  discipline: z.literal('strength'),
  type: z.enum(['full_body', 'upper', 'lower', 'accessory']),
  exercises: z.array(ModelStrengthExerciseSchema),
  purpose: z.string().nullable(),
  estimatedDurationMinutes: z.number(),
}).strict();

export const ModelSessionSchema = z.discriminatedUnion('discipline', [
  ModelRunningSessionSchema,
  ModelStrengthSessionSchema,
]);

export type ModelRunBlock = z.infer<typeof ModelRunBlockSchema>;

export const PlanOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('move'),
    week: z.number().int().nonnegative().optional(),
    day: z.enum(WEEK_DAYS),
    index: z.number(),
    toDay: z.enum(WEEK_DAYS),
    toIndex: z.number().nullable(),
    session: z.null(),
  }).strict(),
  z.object({
    type: z.literal('remove'),
    week: z.number().int().nonnegative().optional(),
    day: z.enum(WEEK_DAYS),
    index: z.number(),
    toDay: z.null(),
    toIndex: z.null(),
    session: z.null(),
  }).strict(),
  z.object({
    type: z.literal('replace'),
    week: z.number().int().nonnegative().optional(),
    day: z.enum(WEEK_DAYS),
    index: z.number(),
    toDay: z.null(),
    toIndex: z.null(),
    session: ModelSessionSchema,
  }).strict(),
  z.object({
    type: z.literal('add'),
    week: z.number().int().nonnegative().optional(),
    day: z.enum(WEEK_DAYS),
    index: z.null(),
    toDay: z.null(),
    toIndex: z.null(),
    session: ModelSessionSchema,
  }).strict(),
]);

export type PlanOperation = z.infer<typeof PlanOperationSchema>;
export type ModelSession = z.infer<typeof ModelSessionSchema>;

/**
 * Propuesta de bloque multi-semana: el asistente decide el horizonte
 * (número de semanas y/o fecha objetivo) y el servidor materializa las
 * semanas con el motor determinista a partir del plan actual.
 */
export const PlanBlockProposalSchema = z.object({
  kind: z.literal('block'),
  reason: z.string().min(1).max(1000),
  weeks: z.number().int().min(2).max(MAX_PLAN_WEEKS).nullable(),
  goalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
}).strict();

export const AssistantOutputSchema = z.object({
  text: z.string(),
  knownFacts: z.array(z.string()),
  assumptions: z.array(z.string()),
  proposal: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('operations'),
      reason: z.string(),
      operations: z.array(PlanOperationSchema),
    }).strict(),
    PlanBlockProposalSchema,
  ]).nullable(),
}).strict();

export type ModelPlanProposal = z.infer<typeof AssistantOutputSchema>['proposal'];
export type PlanBlockProposal = z.infer<typeof PlanBlockProposalSchema>;

export function applyPlanOperations(
  currentPlan: PlanRecord,
  profile: { availability: Record<WeekDay, readonly unknown[]> },
  operations: readonly PlanOperation[],
): PlanRecord {
  if (operations.length === 0 || operations.length > 14) {
    throw new Error('La propuesta debe incluir entre 1 y 14 operaciones.');
  }
  const weeks = structuredClone(currentPlan.weeks);

  for (const operation of operations) {
    const weekIndex = operation.week ?? 0;
    if (weekIndex >= weeks.length) {
      throw new Error('La propuesta apunta a una semana fuera del bloque.');
    }
    if (typeof operation.index === 'number'
      && (!Number.isSafeInteger(operation.index) || operation.index < 0)) {
      throw new Error('La posición de sesión propuesta no es válida.');
    }
    if (operation.type === 'move' && operation.toIndex !== null
      && (!Number.isSafeInteger(operation.toIndex) || operation.toIndex < 0)) {
      throw new Error('La posición de destino propuesta no es válida.');
    }
    const sessions = weeks[weekIndex].sessions;

    if (operation.type === 'move') {
      const source = sessions[operation.day];
      const [session] = source.splice(operation.index, 1);
      if (!session) throw new Error('La propuesta intenta mover una sesión que no existe.');
      const target = sessions[operation.toDay];
      const targetIndex = operation.toIndex ?? target.length;
      if (targetIndex > target.length) throw new Error('La posición propuesta no es válida.');
      target.splice(targetIndex, 0, session);
      continue;
    }

    if (operation.type === 'remove') {
      const [removed] = sessions[operation.day].splice(operation.index, 1);
      if (!removed) throw new Error('La propuesta intenta quitar una sesión que no existe.');
      continue;
    }

    if (operation.type === 'replace') {
      if (!sessions[operation.day][operation.index]) throw new Error('La propuesta intenta reemplazar una sesión que no existe.');
      sessions[operation.day][operation.index] = normalizeSession(operation.session);
      continue;
    }

    const added = normalizeSession(operation.session);
    if (sessions[operation.day].length >= 1) throw new Error('La propuesta crea más de una sesión en el mismo día.');
    sessions[operation.day].push(added);
  }

  const proposedPlan = CurrentPlanSchema.parse({ ...currentPlan, weeks });
  validatePlanCoherence(proposedPlan, profile.availability);
  return proposedPlan;
}

export function normalizeSession(session: ModelSession) {
  if (session.discipline === 'running') {
    const { purpose, ...base } = session;
    return {
      ...base,
      ...(purpose === null ? {} : { purpose }),
      blocks: session.blocks.map(normalizeRunBlock),
    };
  }
  const { purpose, ...base } = session;
  return { ...base, ...(purpose === null ? {} : { purpose }) };
}

export function normalizeRunBlock(block: ModelRunBlock) {
  const { paceSecondsPerKm, recoverySeconds, repetitions, ...base } = block;
  return {
    ...base,
    ...(paceSecondsPerKm === null ? {} : { paceSecondsPerKm }),
    ...(recoverySeconds === null ? {} : { recoverySeconds }),
    ...(repetitions === null ? {} : { repetitions }),
  };
}

export function validatePlanCoherence(
  plan: PlanRecord,
  availability: Record<WeekDay, readonly unknown[]>,
): void {
  if (plan.weeks.length === 0) throw new Error('El bloque no tiene semanas.');
  if (plan.weeks[0].weekStart !== plan.weekStart) {
    throw new Error('La primera semana del bloque no coincide con el inicio del plan.');
  }
  for (let index = 1; index < plan.weeks.length; index += 1) {
    if (plan.weeks[index].weekStart !== addDays(plan.weeks[index - 1].weekStart, 7)) {
      throw new Error('Las semanas del bloque no son contiguas.');
    }
  }
  if (plan.goalDate && plan.goalDate < plan.weekStart) {
    throw new Error('La fecha objetivo es anterior al inicio del plan.');
  }
  for (const week of plan.weeks) {
    validateWeekCoherence(week.sessions, plan.config, availability);
  }
}

function validateWeekCoherence(
  sessions: z.infer<typeof WeekSessionsSchema>,
  config: PlanRecord['config'],
  availability: Record<WeekDay, readonly unknown[]>,
): void {
  let count = 0;
  const daySessions = WEEK_DAYS.map((day) => {
    const dayList = sessions[day];
    if (dayList.length > 0 && availability[day].length === 0) {
      throw new Error('La propuesta programa una sesión en un día sin disponibilidad.');
    }
    count += dayList.length;
    return dayList[0] ?? null;
  });

  if (count > config.maxSessionsPerWeek) {
    throw new Error('La propuesta supera el máximo de sesiones semanales.');
  }

  for (let index = 1; index < daySessions.length; index += 1) {
    const previous = daySessions[index - 1];
    const current = daySessions[index];
    if (!previous || !current) continue;
    if (previous.discipline === 'strength' && current.discipline === 'strength') {
      throw new Error('La propuesta programa fuerza en días consecutivos.');
    }
    if (
      previous.discipline === 'strength'
      && (previous.type === 'lower' || previous.type === 'full_body')
      && current.discipline === 'running'
    ) {
      throw new Error('La propuesta programa carrera inmediatamente después de fuerza intensa.');
    }
  }
}

function addDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
