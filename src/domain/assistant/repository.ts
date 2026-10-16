import { Plan } from '@/domain/planning';

import { AssistantAnswer, AssistantModel, PlanChange, PlanChangeStatus } from './assistant';

export interface AssistantConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantRepository {
  ask(input: {
    question: string;
    sessionId: string | null;
    conversation: readonly AssistantConversationTurn[];
    apiKey: string;
    model: string;
  }): Promise<AssistantAnswer>;
  listAvailableModels(apiKey: string): Promise<AssistantModel[]>;
  listPlanChanges(userId: string): Promise<PlanChange[]>;
  resolvePlanChange(
    changeId: string,
    decision: Extract<PlanChangeStatus, 'accepted' | 'rejected'>,
  ): Promise<{ status: PlanChangeStatus; plan: Plan | null }>;
}
