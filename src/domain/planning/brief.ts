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

/**
 * Valida el brief. Lanza PlanningValidationError con el campo concreto
 * si algo no cumple las reglas; devuelve void si todo está bien.
 */
export function validatePlanBrief(brief: PlanBrief): void {
  if (!brief.objective || brief.objective.description.trim().length === 0) {
    throw new PlanningValidationError(
      'El objetivo necesita una descripción.',
      'objective.description',
    );
  }
  if (brief.objective.description.length > 280) {
    throw new PlanningValidationError(
      'La descripción del objetivo no puede superar 280 caracteres.',
      'objective.description',
    );
  }
  if (brief.objective.target && brief.objective.target.length > MAX_BRIEF_TARGET_LENGTH) {
    throw new PlanningValidationError(
      `La meta concreta no puede superar ${MAX_BRIEF_TARGET_LENGTH} caracteres.`,
      'objective.target',
    );
  }

  if (
    !Number.isInteger(brief.sessionsPerWeek)
    || brief.sessionsPerWeek < 1
    || brief.sessionsPerWeek > 7
  ) {
    throw new PlanningValidationError(
      'El número de días por semana debe estar entre 1 y 7.',
      'sessionsPerWeek',
    );
  }

  const availableDays = Object.values(brief.availability).filter((slots) => slots.length > 0).length;
  if (availableDays === 0) {
    throw new PlanningValidationError(
      'Marca al menos un día con franja disponible.',
      'availability',
    );
  }
  if (availableDays < brief.sessionsPerWeek) {
    throw new PlanningValidationError(
      'No puedes entrenar más días de los que tienen franja disponible.',
      'sessionsPerWeek',
    );
  }

  if (brief.experience !== 'beginner'
    && brief.experience !== 'intermediate'
    && brief.experience !== 'advanced') {
    throw new PlanningValidationError(
      'El nivel de experiencia no es válido.',
      'experience',
    );
  }

  if (typeof brief.notes !== 'string' || brief.notes.length > MAX_BRIEF_NOTES_LENGTH) {
    throw new PlanningValidationError(
      `Las notas no pueden superar ${MAX_BRIEF_NOTES_LENGTH} caracteres.`,
      'notes',
    );
  }

  if (brief.focus !== null && !PLAN_FOCUS_OPTIONS.some((option) => option.value === brief.focus)) {
    throw new PlanningValidationError(
      'El reparto entre carrera y fuerza no es válido.',
      'focus',
    );
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
