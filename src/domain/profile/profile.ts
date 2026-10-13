// Entidades puras del perfil de usuario.
// Sin React Native, sin Firebase, sin Expo.
// Solo tipos, factories y validadores.

/**
 * Niveles de experiencia deportiva. Tres valores discretos.
 * - beginner: menos de 1 año entrenando con regularidad.
 * - intermediate: 1-3 años entrenando con regularidad.
 * - advanced: más de 3 años entrenando con regularidad.
 */
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * Días de la semana. Usamos string literals para serializar a Firestore
 * y para que los JSON de tests sean legibles.
 */
export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const ALL_WEEK_DAYS: readonly WeekDay[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const;

/**
 * Franja horaria dentro de un día. Formato HH:mm (24h, con ceros a la
 * izquierda). Una franja representa tiempo disponible para entrenar.
 *
 * No usamos objetos Date para evitar arrastrar dependencias de runtime
 * y para poder validar y serializar fácilmente.
 */
export interface TimeSlot {
  start: string; // HH:mm
  end: string;   // HH:mm
}

/**
 * Disponibilidad semanal: para cada día, una lista de franjas.
 * Lista vacía significa "no disponible ese día".
 */
export type WeeklyAvailability = Record<WeekDay, readonly TimeSlot[]>;

/**
 * Tipos de equipamiento reconocidos. La lista se mantiene explícita
 * (en vez de un array libre) para poder usarla en el motor de planificación
 * y en la UI sin ambigüedad.
 */
export type EquipmentId =
  | 'dumbbells'
  | 'barbell'
  | 'kettlebell'
  | 'resistance_bands'
  | 'pull_up_bar'
  | 'bench'
  | 'squat_rack'
  | 'treadmill'
  | 'outdoor_running_route'
  | 'stationary_bike';

export const ALL_EQUIPMENT: readonly EquipmentId[] = [
  'dumbbells',
  'barbell',
  'kettlebell',
  'resistance_bands',
  'pull_up_bar',
  'bench',
  'squat_rack',
  'treadmill',
  'outdoor_running_route',
  'stationary_bike',
] as const;

/**
 * Mapa de equipamiento: para cada id conocido, indica si está disponible.
 * Cualquier id fuera de ALL_EQUIPMENT es rechazado por el validador.
 */
export type Equipment = Record<EquipmentId, boolean>;

/**
 * Objetivo deportivo. El principal es obligatorio y se muestra destacado;
 * los secundarios son opcionales y complementarios.
 */
export interface Goal {
  /** Identificador estable para poder referenciarlo desde otras entidades (ej. un plan). */
  id: string;
  /** Descripción legible del objetivo. */
  description: string;
  /** Disciplina a la que aplica el objetivo. */
  discipline: 'running' | 'strength';
  /** Métrica específica. Ej. "5km_time" en "21:30", "bench_press_1rm" en "80kg". */
  target: string;
  /** Fecha objetivo opcional, formato ISO 8601 (YYYY-MM-DD). */
  targetDate?: string;
}

/**
 * Restricciones del usuario. Cosas que el planificador debe respetar:
 * - lesiones activas
 * - limitaciones médicas relevantes
 * - preferencias (ej. "no me gusta練练練练...") -- nota: ver Wiki Reglas-de-producto
 *   para señales de alarma.
 *
 * Texto libre. Validamos solo que la longitud esté acotada para evitar
 * payloads absurdos.
 */
export interface Restrictions {
  /** Lista de lesiones o limitaciones activas. Cada elemento es texto libre. */
  injuries: readonly string[];
  /** Otras notas relevantes para el planificador. */
  notes: string;
}

/**
 * Perfil deportivo completo del usuario.
 */
export interface Profile {
  /** Nombre del usuario (opcional, para mostrar en la UI). */
  name?: string;
  /** Edad en años (opcional, relevante para progresión). */
  age?: number;
  /** Nivel de experiencia. */
  experience: ExperienceLevel;
  /** Objetivo principal. Obligatorio. */
  primaryGoal: Goal;
  /** Objetivos secundarios. Lista vacía si no hay. */
  secondaryGoals: readonly Goal[];
  /** Disponibilidad semanal. */
  availability: WeeklyAvailability;
  /** Equipamiento disponible. */
  equipment: Equipment;
  /** Restricciones y notas relevantes. */
  restrictions: Restrictions;
}

/**
 * Error específico del dominio de perfil. Usar en vez de Error genérico
 * para que el dominio exprese qué falló.
 */
export class ProfileValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'ProfileValidationError';
  }
}