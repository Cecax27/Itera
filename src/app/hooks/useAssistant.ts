import { useCallback, useEffect, useState } from 'react';

import {
  AssistantAnswer,
  AssistantPlanChange,
  buildOfflineAnswer,
  buildSafetyAnswer,
  buildUnconfiguredAnswer,
  detectSafetySignal,
  PlanChange,
  PlanChangeStatus,
} from '@/domain/assistant';
import { assistantClient } from '@/infrastructure/llm/assistantClient';
import { readAssistantCredentials, StoredAssistantCredentials } from '@/infrastructure/llm/assistantSettingsStore';

import { useAuth } from './useAuth';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  knownFacts?: readonly string[];
  assumptions?: readonly string[];
  source?: 'assistant' | 'engine';
  planChange?: AssistantPlanChange | null;
}

export function useAssistant() {
  const { user, status: authStatus } = useAuth();
  const [credentials, setCredentials] = useState<StoredAssistantCredentials>({ apiKey: null, model: null });
  const [credentialLoading, setCredentialLoading] = useState(true);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [planChanges, setPlanChanges] = useState<PlanChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingChanges, setLoadingChanges] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshCredentials = useCallback(async () => {
    if (authStatus === 'loading') {
      setCredentialLoading(true);
      return;
    }
    if (!user) {
      setCredentials({ apiKey: null, model: null });
      setCredentialLoading(false);
      return;
    }
    setCredentialLoading(true);
    try {
      setCredentials(await readAssistantCredentials(user.id));
    } catch {
      setCredentials({ apiKey: null, model: null });
    } finally {
      setCredentialLoading(false);
    }
  }, [authStatus, user]);

  useEffect(() => {
    void refreshCredentials();
  }, [refreshCredentials]);

  const refreshPlanChanges = useCallback(async () => {
    if (!user) {
      setPlanChanges([]);
      setLoadingChanges(false);
      return;
    }
    setLoadingChanges(true);
    try {
      setPlanChanges(await assistantClient.listPlanChanges(user.id));
    } catch {
      setError('No se pudo cargar el historial de decisiones.');
    } finally {
      setLoadingChanges(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshPlanChanges();
  }, [refreshPlanChanges]);

  const send = useCallback(async (question: string, sessionId: string | null): Promise<void> => {
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion || loading || credentialLoading) return;
    setError(null);
    setLoading(true);
    setMessages((current) => [...current, {
      id: makeMessageId(),
      role: 'user',
      text: normalizedQuestion,
    }]);

    let answer: AssistantAnswer;
    const safetySignal = detectSafetySignal(normalizedQuestion);
    if (safetySignal) {
      answer = buildSafetyAnswer(safetySignal);
    } else if (!credentials.apiKey || !credentials.model) {
      answer = buildUnconfiguredAnswer();
    } else {
      try {
        const conversation = messages.slice(-8).map((message) => ({
          role: message.role,
          content: message.text.slice(0, 1500),
        }));
        answer = await assistantClient.ask({
          question: normalizedQuestion,
          sessionId,
          conversation,
          apiKey: credentials.apiKey,
          model: credentials.model,
        });
      } catch {
        answer = buildOfflineAnswer(normalizedQuestion);
      }
    }

    setMessages((current) => [...current, {
      id: makeMessageId(),
      role: 'assistant',
      text: answer.text,
      knownFacts: answer.knownFacts,
      assumptions: answer.assumptions,
      source: answer.source,
      planChange: answer.planChange,
    }]);
    if (answer.planChange) void refreshPlanChanges();
    setLoading(false);
  }, [credentialLoading, credentials, loading, messages, refreshPlanChanges]);

  const resolvePlanChange = useCallback(async (
    changeId: string,
    decision: Extract<PlanChangeStatus, 'accepted' | 'rejected'>,
  ) => {
    setError(null);
    try {
      const result = await assistantClient.resolvePlanChange(changeId, decision);
      setPlanChanges((current) => current.map((change) => change.id === changeId
        ? { ...change, status: result.status, resolvedAt: new Date().toISOString() }
        : change));
      setMessages((current) => current.map((message) => message.planChange?.id === changeId
        ? {
            ...message,
            planChange: { ...message.planChange, status: result.status, resolvedAt: new Date().toISOString() },
          }
        : message));
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo responder a la propuesta.';
      setError(message);
      throw err;
    }
  }, []);

  return {
    messages,
    planChanges,
    loading,
    loadingChanges,
    credentialLoading,
    apiKeyConfigured: Boolean(credentials.apiKey && credentials.model),
    error,
    send,
    resolvePlanChange,
    refreshPlanChanges,
    refreshCredentials,
  };
}

function makeMessageId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
