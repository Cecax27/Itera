// Entidades del dominio de planificación.
// TypeScript puro, sin React ni Firebase.

import { WeekDay } from '@/domain/profile';

/**
 * Disciplinas que soporta el MVP. Mantener este literal corto y estable:
 * toda la lógica del motor (carga, descansos, conflictos) depende de él.
 */
export type Discipline = 'running' | 'strength';

/**
 * Tipos de sesión de carrera. Define la naturaleza del trabajo físico
 * y la regla de intensidad.
 */
export type RunType =
  | 'easy'        // aeróbico suave, ritmo conversacional
  | 'long'        // carrera larga, volumen alto a intensidad baja
  | 'tempo'       // ritmo sostenido en zona de umbral
  | 'intervals'   // series de alta intensidad con recuperación
  | 'race';       // competición (no aplica al MVP pero se reserva)

/**
 * Bloque de carrera. Una sesión de carrera puede tener varios bloques
 * (por ejemplo, calentamiento + intervalo + enfriamiento). En el MVP
 * simplificamos: una sesión tiene varios RunBlock encadenados.
 */
export interface RunBlock {
  /** Tipo de trabajo: fácil, intervalo, recuperación, etc. */
  type: 'warmup' | 'interval' | 'recovery' | 'cooldown' | 'steady';
  /** Distancia en metros. */
  distanceMeters: number;
  /** Ritmo objetivo en segundos por kilómetro (opcional, depende del tipo). */
  paceSecondsPerKm?: number;
  /** Para intervalos: tiempo de descanso entre repeticiones, en segundos. */
  recoverySeconds?: number;
  /** Repeticiones (1 si no es intervalo). */
  repetitions?: number;
}

/**
 * Sesión de carrera.
 */
export interface RunSession {
  discipline: 'running';
  type: RunType;
  /** Bloques que componen la sesión, en orden. */
  blocks: readonly RunBlock[];
  /** Propósito o nota corta (ej. "ritmo controlado en subida"). */
  purpose?: string;
  /** Duración estimada total, en minutos. Útil para la pantalla Hoy. */
  estimatedDurationMinutes: number;
}

/**
 * Grupo muscular principal de un ejercicio de fuerza. Categorías toscas
 * para el MVP; el motor no las usa todavía, las tenemos para futuras
 * reglas de progresión y para UI.
 */
export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'full_body';

/**
 * Ejercicio de fuerza individual.
 */
export interface StrengthExercise {
  /** Identificador estable (ej. "bench_press", "back_squat"). */
  id: string;
  /** Nombre legible (ej. "Press banca"). */
  name: string;
  /** Grupo muscular principal. */
  muscleGroup: MuscleGroup;
  /** Series planeadas. */
  sets: number;
  /** Repeticiones por serie (rango: "8-12" o número fijo "5"). */
  reps: string;
  /** Peso objetivo en kg. 0 si es peso corporal. */
  targetWeightKg: number;
  /** Descanso entre series, en segundos. */
  restSeconds: number;
}

/**
 * Sesión de fuerza.
 */
export interface StrengthSession {
  discipline: 'strength';
  /** Tipo de sesión, útil para reglas de carga y recuperación. */
  type: 'full_body' | 'upper' | 'lower' | 'accessory';
  exercises: readonly StrengthExercise[];
  purpose?: string;
  estimatedDurationMinutes: number;
}

/**
 * Unión discriminada: una sesión es de carrera o de fuerza, no las dos.
 */
export type Session = RunSession | StrengthSession;

/**
 * Slots disponibles por día. La cantidad mínima de slots se basa en
 * las franjas declaradas en el perfil. Si un día tiene 0 franjas, no
 * se puede asignar sesión ese día.
 */
export type DayCapacity = Record<WeekDay, number>;

/**
 * Configuración del plan, en valores introducidos por el perfil o por
 * el usuario en su perfil. Vive en el plan (no en el perfil) porque
 * puede evolucionar: cuando lleguemos a la IA (H7), puede proponer
 * cambios en estos números registrándolos como planChanges.
 */
export interface PlanConfig {
  /** Mínimo de sesiones por semana. */
  minSessionsPerWeek: number;
  /** Máximo de sesiones por semana. */
  maxSessionsPerWeek: number;
  /** Duración objetivo de cada sesión en minutos (se usa para calcular capacidad). */
  targetSessionMinutes: number;
}

/**
 * Plan semanal completo con todas sus sesiones ya asignadas.
 */
export interface Plan {
  id: string;
  /** Semana a la que aplica el plan (ISO 8601: lunes en formato YYYY-MM-DD). */
  weekStart: string;
  /** Configuración usada para generar este plan. */
  config: PlanConfig;
  /** Sesiones asignadas por día. Lista vacía = día de descanso. */
  sessions: Record<WeekDay, readonly Session[]>;
  /** Fecha de creación, ISO 8601. */
  createdAt: string;
}

/**
 * Error específico del dominio de planificación.
 */
export class PlanningValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'PlanningValidationError';
  }
}