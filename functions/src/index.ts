import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

import { loadAssistantContext } from './context';
import { applyPlanOperations, CurrentPlanSchema, PlanOperationSchema, validatePlanCoherence, WeekDay } from './plan-change';
import { detectSafetySignal, safetyReply } from './safety';
import { listAvailableModels, requestAssistantResponse } from './openai-assistant';

initializeApp();
const db = getFirestore();
const REGION = 'us-central1';

export const askAssistant = onCall(
  {
    region: REGION,
    timeoutSeconds: 60,
    memory: '512MiB',
    maxInstances: 2,
  },
  async (request) => {
    const userId = request.auth?.uid;
    if (!userId) throw new HttpsError('unauthenticated', 'Inicia sesión para usar el asistente.');

    const question = typeof request.data?.question === 'string' ? request.data.question.trim() : '';
    const sessionId = typeof request.data?.sessionId === 'string' ? request.data.sessionId : null;
    const apiKey = typeof request.data?.apiKey === 'string' ? request.data.apiKey.trim() : '';
    const model = typeof request.data?.model === 'string' ? request.data.model.trim() : '';
    const conversation = Array.isArray(request.data?.conversation)
      ? request.data.conversation
          .filter((turn: unknown): turn is { role: 'user' | 'assistant'; content: string } => {
            if (!turn || typeof turn !== 'object') return false;
            const candidate = turn as { role?: unknown; content?: unknown };
            return (candidate.role === 'user' || candidate.role === 'assistant')
              && typeof candidate.content === 'string';
          })
          .slice(-8)
          .map((turn: { role: 'user' | 'assistant'; content: string }) => ({
            role: turn.role,
            content: turn.content.slice(0, 1500),
          }))
      : [];
    if (!question || question.length > 2000) {
      throw new HttpsError('invalid-argument', 'La pregunta debe tener entre 1 y 2000 caracteres.');
    }
    if (!apiKey || apiKey.length > 500 || !model || model.length > 200) {
      throw new HttpsError('failed-precondition', 'Configura una API key de OpenAI y un modelo en Ajustes.');
    }
    if (sessionId && (sessionId.length > 180 || sessionId.includes('/'))) {
      throw new HttpsError('invalid-argument', 'El identificador de sesión no es válido.');
    }

    const safetySignal = detectSafetySignal(question);
    if (safetySignal) return safetyReply(safetySignal);

    try {
      const context = await loadAssistantContext(db, userId, sessionId);
      const currentPlan = CurrentPlanSchema.parse(context.currentPlan);
      const modelReply = await requestAssistantResponse(apiKey, model, {
        question,
        context,
        conversation,
      });

      if (modelReply.text.length > 2500 || modelReply.knownFacts.length > 8 || modelReply.assumptions.length > 8) {
        throw new Error('La respuesta estructurada excedió los límites de Itera.');
      }

      let planChange: Record<string, unknown> | null = null;
      let answer = modelReply.text;
      let knownFacts = modelReply.knownFacts;
      let assumptions = modelReply.assumptions;
      if (modelReply.proposal) {
        try {
          if (!modelReply.proposal.reason.trim() || modelReply.proposal.reason.length > 1000) {
            throw new Error('La propuesta no incluye una explicación válida.');
          }
          const operations = modelReply.proposal.operations.map((operation) => PlanOperationSchema.parse(operation));
          const profileAvailability = context.profile.availability as Record<WeekDay, readonly unknown[]>;
          const proposedPlan = applyPlanOperations(currentPlan, { availability: profileAvailability }, operations);
          const changeRef = db.collection('users').doc(userId).collection('planChanges').doc();
          const createdAt = new Date().toISOString();
          const change = {
            id: changeRef.id,
            status: 'proposed' as const,
            source: 'assistant' as const,
            previousPlan: currentPlan,
            proposedPlan,
            reason: modelReply.proposal.reason,
            createdAt,
            resolvedAt: null,
          };
          // Solo persiste la propuesta auditable; no toca plans/current.
          await changeRef.set(change);
          planChange = change;
        } catch (err) {
          logger.warn('Se rechazó una propuesta de plan inválida.', { error: String(err) });
          answer = 'No he guardado una propuesta porque los cambios no pasan las reglas actuales del motor de planificación. Tu plan permanece intacto.';
          knownFacts = [];
          assumptions = [];
        }
      }

      return {
        text: answer,
        knownFacts,
        assumptions,
        source: 'assistant' as const,
        planChange,
      };
    } catch (err) {
      logger.error('Falló askAssistant; el plan no se modifica.', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw new HttpsError('unavailable', 'El asistente no está disponible ahora. El plan permanece intacto.');
    }
  },
);

export const testOpenAIConnection = onCall(
  { region: REGION, timeoutSeconds: 25, maxInstances: 2 },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Inicia sesión para probar la conexión.');
    const apiKey = typeof request.data?.apiKey === 'string' ? request.data.apiKey.trim() : '';
    if (!apiKey || apiKey.length > 500) throw new HttpsError('invalid-argument', 'La API key no es válida.');
    try {
      const models = await listAvailableModels(apiKey);
      if (models.length === 0) throw new Error('No hay modelos de texto disponibles para esta clave.');
      return { models };
    } catch {
      logger.warn('Falló la prueba de conexión de OpenAI.');
      throw new HttpsError('failed-precondition', 'OpenAI rechazó la clave o no tiene modelos de texto disponibles.');
    }
  },
);

export const resolvePlanChange = onCall(
  { region: REGION, timeoutSeconds: 30, maxInstances: 2 },
  async (request) => {
    const userId = request.auth?.uid;
    if (!userId) throw new HttpsError('unauthenticated', 'Inicia sesión para responder a la propuesta.');
    const changeId = typeof request.data?.changeId === 'string' ? request.data.changeId : '';
    const decision = request.data?.decision;
    if (!changeId || changeId.length > 180 || changeId.includes('/')) {
      throw new HttpsError('invalid-argument', 'El identificador de propuesta no es válido.');
    }
    if (decision !== 'accepted' && decision !== 'rejected') {
      throw new HttpsError('invalid-argument', 'La respuesta debe ser accepted o rejected.');
    }

    const userRef = db.collection('users').doc(userId);
    const changeRef = userRef.collection('planChanges').doc(changeId);
    const planRef = userRef.collection('plans').doc('current');
    const profileRef = userRef.collection('profile').doc('main');
    const resolvedAt = new Date().toISOString();

    return db.runTransaction(async (transaction) => {
      const changeSnapshot = await transaction.get(changeRef);
      if (!changeSnapshot.exists) throw new HttpsError('not-found', 'No se encontró la propuesta.');
      const change = changeSnapshot.data()!;
      if (change.status !== 'proposed') {
        throw new HttpsError('failed-precondition', 'Esta propuesta ya fue respondida.');
      }

      if (decision === 'rejected') {
        transaction.update(changeRef, { status: 'rejected', resolvedAt });
        return { status: 'rejected', plan: null };
      }

      const [currentPlanSnapshot, profileSnapshot] = await Promise.all([
        transaction.get(planRef),
        transaction.get(profileRef),
      ]);
      if (!currentPlanSnapshot.exists || !profileSnapshot.exists) {
        throw new HttpsError('failed-precondition', 'Falta el plan o perfil necesario para aplicar la propuesta.');
      }

      const currentPlan = CurrentPlanSchema.parse(currentPlanSnapshot.data());
      const previousPlan = CurrentPlanSchema.parse(change.previousPlan);
      const proposedPlan = CurrentPlanSchema.parse(change.proposedPlan);
      if (stableStringify(currentPlan) !== stableStringify(previousPlan)) {
        throw new HttpsError('failed-precondition', 'El plan cambió desde que se creó la propuesta. Pide una propuesta nueva.');
      }

      const profile = profileSnapshot.data() ?? {};
      const availability = profile.availability as Record<WeekDay, readonly unknown[]> | undefined;
      if (!availability) throw new HttpsError('failed-precondition', 'No se encontró disponibilidad semanal en el perfil.');
      validatePlanCoherence(proposedPlan, availability);
      transaction.set(planRef, proposedPlan);
      transaction.update(changeRef, { status: 'accepted', resolvedAt });
      return { status: 'accepted', plan: proposedPlan };
    });
  },
);

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
