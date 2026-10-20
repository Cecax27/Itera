// Brief del asistente de creación de planes.
//
// El asistente (pantalla de creación guiada) recoge un conjunto de datos
// que se envían al modelo de IA para que genere un plan semanal completo.
// Este módulo define ese payload y sus validaciones, sin tocar React ni
// Firebase: es la parte de dominio que la UI llena y la infraestructura
// serializa para el callable de Functions.
//
// Importante: el brief NO es el perfil. El asistente parte de los datos
// del perfil (disponibilidad, equipamiento, experiencia) precargados y
// editables, pero lo que guarda el plan es el brief capturado en ese
// momento, no el perfil persistido.

import {
  Equipment,
  ExperienceLevel,
  Goal,
  WeeklyAvailability,
} from '@/domain/profile';

import { Plan, PlanningValidationError } from './plan';

/**
 * Preferencia de reparto entre carrera y fuerza dentro de la semana.
 * El modelo la usa como indicación de balance, no como regla dura.
 */
export type PlanFocus =
  | 'running_only'
  | 'more_running'
  | 'balanced'
  | 'more_strength'
  | 'strength_only';

export interface PlanFocusOption {
  value: PlanFocus;
  label: string;
}

export const PLAN_FOCUS_OPTIONS: readonly PlanFocusOption[] = [
  { value: 'running_only', label: 'Solo carrera' },
  { value: 'more_running', label: 'Más carrera' },
  { value: 'balanced', label: 'Equilibrado' },
  { value: 'more_strength', label: 'Más fuerza' },
  { value: 'strength_only', label: 'Solo fuerza' },
];

/**
 * Payload que el asistente de creación de planes envía al modelo.
 */
export interface PlanBrief {
  /** Objetivo principal que guía el plan (reutiliza Goal del perfil). */
  objective: Goal;
  /** Días por semana que el usuario quiere entrenar (1-7). */
  sessionsPerWeek: number;
  /** Disponibilidad semanal capturada en el asistente (puede diferir del perfil). */
  availability: WeeklyAvailability;
  /** Equipamiento declarado en el asistente (puede diferir del perfil). */
  equipment: Equipment;
  /** Experiencia capturada en el asistente. */
  experience: ExperienceLevel;
  /** Reparto preferido entre carrera y fuerza (opcional). */
  focus: PlanFocus | null;
  /** Notas y comentarios libres para el modelo (puede ir vacío). */
  notes: string;
}

export const MAX_BRIEF_NOTES_LENGTH = 2000;
export const MAX_BRIEF_TARGET_LENGTH = 120;
export const MAX_BRIEF_DESCRIPTION_LENGTH = 280;

/** Campos validables del brief; la UI los usa para señalar el input concreto. */
export type PlanBriefField =
  | 'objective.description'
  | 'objective.target'
  | 'sessionsPerWeek'
  | 'availability'
  | 'experience'
  | 'notes'
  | 'focus';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Una franja es válida si ambas horas son "HH:mm" y termina después de empezar. */
function isValidSlot(slot: { start: string; end: string }): boolean {
  return TIME_RE.test(slot.start) && TIME_RE.test(slot.end) && slot.start < slot.end;
}

/**
 * Devuelve todos los errores del brief indexados por campo, en el orden en
 * que se validan (los primeros son los que lanzaría validatePlanBrief).
 * La UI de creación usa esto para señalar campos concretos en línea,
 * mientras que validatePlanBrief sigue siendo la barrera final.
 */
export function planBriefFieldErrors(brief: PlanBrief): Partial<Record<PlanBriefField, string>> {
  const errors: Partial<Record<PlanBriefField, string>> = {};

  if (!brief.objective || brief.objective.description.trim().length === 0) {
    errors['objective.description'] = 'El objetivo necesita una descripción.';
  } else if (brief.objective.description.length > MAX_BRIEF_DESCRIPTION_LENGTH) {
    errors['objective.description'] = `La descripción del objetivo no puede superar ${MAX_BRIEF_DESCRIPTION_LENGTH} caracteres.`;
  }

  if (brief.objective?.target && brief.objective.target.length > MAX_BRIEF_TARGET_LENGTH) {
    errors['objective.target'] = `La meta concreta no puede superar ${MAX_BRIEF_TARGET_LENGTH} caracteres.`;
  }

  if (
    !Number.isInteger(brief.sessionsPerWeek)
    || brief.sessionsPerWeek < 1
    || brief.sessionsPerWeek > 7
  ) {
    errors.sessionsPerWeek = 'El número de días por semana debe estar entre 1 y 7.';
  }

  const availableDays = Object.values(brief.availability).filter((slots) => slots.length > 0).length;
  if (availableDays === 0) {
    errors.availability = 'Marca al menos un día con franja disponible.';
  } else if (availableDays < brief.sessionsPerWeek) {
    errors.sessionsPerWeek = 'No puedes entrenar más días de los que tienen franja disponible.';
  }

  const hasInvalidSlot = Object.values(brief.availability).some(
    (slots) => slots.some((slot) => !isValidSlot(slot)),
  );
  if (hasInvalidSlot) {
    errors.availability = 'Las franjas necesitan una hora de inicio y otra de fin válidas (la franja termina después de empezar).';
  }

  if (brief.experience !== 'beginner'
    && brief.experience !== 'intermediate'
    && brief.experience !== 'advanced') {
    errors.experience = 'El nivel de experiencia no es válido.';
  }

  if (typeof brief.notes !== 'string' || brief.notes.length > MAX_BRIEF_NOTES_LENGTH) {
    errors.notes = `Las notas no pueden superar ${MAX_BRIEF_NOTES_LENGTH} caracteres.`;
  }

  if (brief.focus !== null && !PLAN_FOCUS_OPTIONS.some((option) => option.value === brief.focus)) {
    errors.focus = 'El reparto entre carrera y fuerza no es válido.';
  }

  return errors;
}

/**
 * Valida el brief. Lanza PlanningValidationError con el campo concreto
 * si algo no cumple las reglas; devuelve void si todo está bien.
 */
export function validatePlanBrief(brief: PlanBrief): void {
  const errors = planBriefFieldErrors(brief);
  for (const [field, message] of Object.entries(errors)) {
    if (message) {
      throw new PlanningValidationError(message, field as PlanBriefField);
    }
  }
}

/**
 * Contrato del generador de planes: la infraestructura lo implementa con
 * el callable de Firebase Functions; la app solo ve esta interfaz.
 */
export interface PlanBuilderRepository {
  generateTrainingPlan(request: {
    apiKey: string;
    model: string;
    brief: PlanBrief;
  }): Promise<GeneratedPlanResult>;
}

/**
 * Resultado del generador: un plan borrador validado por el servidor más
 * la explicación del modelo. El plan solo se aplica si el usuario lo
 * confirma en el asistente; nada aquí toca plans/current directamente.
 */
export interface GeneratedPlanResult {
  plan: Plan;
  explanation: string;
  knownFacts: readonly string[];
  assumptions: readonly string[];
  warnings: readonly string[];
  /** Aviso de seguridad añadido por el servidor (o null). */
  safetyNotice: string | null;
  source: 'engine';
}
