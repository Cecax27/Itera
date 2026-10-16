import { AssistantRepository } from '@/domain/assistant';
import { firebaseAssistantRepository } from '@/infrastructure/firebase/repositories';

// La app conoce el contrato del asistente; la implementación concreta vive
// detrás del adaptador seguro de Firebase Functions.
export const assistantClient: AssistantRepository = firebaseAssistantRepository;
