import { PlanBuilderRepository } from '@/domain/planning';
import { firebaseAssistantRepository } from '@/infrastructure/firebase/repositories';

// La app conoce el contrato del plan-builder; la implementación concreta
// vive detrás del adaptador seguro de Firebase Functions.
export const planBuilderClient: PlanBuilderRepository = firebaseAssistantRepository;
