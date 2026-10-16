// Hook usePlanBuilder: gestiona la generación del plan con la IA en el
// asistente de creación guiada. El estado del formulario (brief) vive en
// la pantalla; aquí solo está la llamada al plan-builder de Functions,
// los errores legibles y el borrador resultante.
//
// Crucial: generate() no persiste nada. El borrador se devuelve para que
// el usuario lo previsualice; solo si confirma, la pantalla llama al
// guardado del plan (usePlan.savePlan).

import { useCallback, useState } from 'react';

import { GeneratedPlanResult, PlanBrief, validatePlanBrief } from '@/domain/planning';
import { planBuilderClient } from '@/infrastructure/llm/planBuilderClient';
import { readAssistantCredentials } from '@/infrastructure/llm/assistantSettingsStore';

import { useAuth } from './useAuth';

export interface UsePlanBuilderResult {
  generating: boolean;
  error: string | null;
  draft: GeneratedPlanResult | null;
  generate: (brief: PlanBrief) => Promise<GeneratedPlanResult | null>;
  /** Limpia el borrador y el error (p. ej. al regenerar o descartar). */
  resetDraft: () => void;
}

export function usePlanBuilder(): UsePlanBuilderResult {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<GeneratedPlanResult | null>(null);

  const resetDraft = useCallback(() => {
    setDraft(null);
    setError(null);
  }, []);

  const generate = useCallback(
    async (brief: PlanBrief): Promise<GeneratedPlanResult | null> => {
      try {
        validatePlanBrief(brief);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Los datos del asistente no son válidos.');
        return null;
      }

      if (!user) {
        setError('Inicia sesión para crear un plan.');
        return null;
      }

      setError(null);
      setDraft(null);
      setGenerating(true);
      try {
        const credentials = await readAssistantCredentials(user.id);
        if (!credentials.apiKey || !credentials.model) {
          setError('Configura tu API key de OpenAI y un modelo en Ajustes antes de generar el plan.');
          return null;
        }
        const result = await planBuilderClient.generateTrainingPlan({
          apiKey: credentials.apiKey,
          model: credentials.model,
          brief,
        });
        setDraft(result);
        return result;
      } catch (err) {
        setError(describeError(err, 'No se pudo generar el plan ahora. Tu plan actual no ha cambiado.'));
        return null;
      } finally {
        setGenerating(false);
      }
    },
    [user],
  );

  return { generating, error, draft, generate, resetDraft };
}

function describeError(err: unknown, fallback: string): string {
  // httpsCallable lanza FirebaseError con (a veces) el mensaje del
  // servidor dentro de corchetes; lo reducimos al texto legible.
  if (err instanceof Error && err.message) {
    return err.message.replace(/^\[(?:\w[\w-]*)\][: ]*/, '') || fallback;
  }
  return fallback;
}
