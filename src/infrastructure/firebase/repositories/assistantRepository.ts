import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';

import { AssistantAnswer, AssistantConversationTurn, AssistantModel, PlanChange, PlanChangeStatus } from '@/domain/assistant';
import { Plan } from '@/domain/planning';
import { getDbInstance, getFunctionsInstance } from '../client';

interface AskAssistantRequest {
  question: string;
  sessionId: string | null;
  conversation: readonly AssistantConversationTurn[];
  apiKey: string;
  model: string;
}

interface ResolvePlanChangeResponse {
  status: PlanChangeStatus;
  plan: Plan | null;
}

export const firebaseAssistantRepository = {
  async listAvailableModels(apiKey: string): Promise<AssistantModel[]> {
    const callable = httpsCallable<{ apiKey: string }, { models: AssistantModel[] }>(
      getFunctionsInstance(),
      'testOpenAIConnection',
    );
    const response = await callable({ apiKey });

    return response.data.models;
  },

  async ask(request: AskAssistantRequest): Promise<AssistantAnswer> {
    const callable = httpsCallable<AskAssistantRequest, AssistantAnswer>(getFunctionsInstance(), 'askAssistant');
    const response = await callable(request);
    return response.data;
  },

  async listPlanChanges(userId: string): Promise<PlanChange[]> {
    const changesQuery = query(
      collection(getDbInstance(), 'users', userId, 'planChanges'),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    const snapshot = await getDocs(changesQuery);
    return snapshot.docs.map((changeDoc) => ({
      ...changeDoc.data(),
      id: changeDoc.id,
    }) as PlanChange);
  },

  async resolvePlanChange(
    changeId: string,
    decision: Extract<PlanChangeStatus, 'accepted' | 'rejected'>,
  ): Promise<ResolvePlanChangeResponse> {
    const callable = httpsCallable<
      { changeId: string; decision: 'accepted' | 'rejected' },
      ResolvePlanChangeResponse
    >(getFunctionsInstance(), 'resolvePlanChange');
    const response = await callable({ changeId, decision });
    return response.data;
  },
};
