import { Plan } from '@/domain/planning';

export type PlanChangeStatus = 'proposed' | 'accepted' | 'rejected';

export interface AssistantModel {
  id: string;
  ownedBy: string;
}

export interface AssistantPlanChange {
  id: string;
  status: PlanChangeStatus;
  source: 'assistant';
  previousPlan: Plan;
  proposedPlan: Plan;
  reason: string;
  createdAt: string;
  resolvedAt: string | null;
}

export type PlanChange = AssistantPlanChange;

export interface AssistantReply {
  text: string;
  knownFacts: readonly string[];
  assumptions: readonly string[];
  source: 'assistant' | 'engine';
  planChange: AssistantPlanChange | null;
}

export type AssistantAnswer = AssistantReply;

export interface SafetySignal {
  severity: 'caution' | 'urgent';
}

export function detectSafetySignal(text: string): SafetySignal | null {
  const normalized = normalizeText(text);
  const urgent = /dolor[^.!?]{0,40}(pecho|torax|toracico)|opresion[^.!?]{0,40}(pecho|torax)|desmay|perdida del conocimiento|no puedo respirar|falta de aire intensa|dificultad para respirar|dificultad respiratoria intensa/.test(normalized);
  if (urgent) return { severity: 'urgent' };

  const caution = /dolor|molestia|lesion|herid|mareo|maread|fiebre|enfermedad aguda|inflamacion|hinchazon|falta de aire|dificultad para respirar/.test(normalized);
  return caution ? { severity: 'caution' } : null;
}

export function buildSafetyAnswer(signal: SafetySignal): AssistantReply {
  return {
    text: signal.severity === 'urgent'
      ? 'Por seguridad, detén el entrenamiento. No puedo diagnosticar ni valorar estos síntomas. Busca atención sanitaria urgente o contacta los servicios de emergencia de tu zona.'
      : 'Por seguridad, pausa el entrenamiento y consulta a un profesional sanitario antes de retomarlo. No puedo diagnosticar ni determinar la causa de estos síntomas.',
    knownFacts: [],
    assumptions: [],
    source: 'engine',
    planChange: null,
  };
}

export function buildOfflineAnswer(question: string): AssistantReply {
  const normalized = normalizeText(question);
  let text: string;

  if (/omiti|perdi|no hice|no pude asistir|me salte/.test(normalized)) {
    text = 'Regla del motor: no intentes compensar una sesión omitida duplicando el entrenamiento. Tu plan permanece intacto; revisa la próxima sesión en Hoy y retoma desde ahí.';
  } else if (/fatiga|cansad|agotad/.test(normalized)) {
    text = 'Regla del motor: no aumentes la carga cuando reportas fatiga. Puedes descansar o mantener la próxima sesión en un esfuerzo cómodo. El plan no se ha modificado y esto no es una valoración médica.';
  } else {
    text = 'El asistente no está disponible ahora. Tu plan permanece intacto y no se ha aplicado ningún cambio. Puedes seguir consultando Hoy y Plan; las propuestas deterministas se identificarán como reglas del motor.';
  }

  return {
    text,
    knownFacts: [],
    assumptions: [],
    source: 'engine',
    planChange: null,
  };
}

export function buildUnconfiguredAnswer(): AssistantReply {
  return {
    text: 'Configura tu API key de OpenAI y elige un modelo desde Ajustes para activar el asistente. No se ha enviado la pregunta ni se ha cambiado el plan.',
    knownFacts: [],
    assumptions: [],
    source: 'engine',
    planChange: null,
  };
}

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
