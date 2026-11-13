// Publicación de plantillas Zepp vía Cloud Functions (callables).
// La plantilla llega ya validada por el dominio; el servidor la revalida
// con su schema estricto antes de almacenarla y devuelve la URL pública.

import { httpsCallable } from 'firebase/functions';

import { ZeppTemplateRepository } from '@/domain/zepp';
import { getFunctionsInstance } from '../client';

interface CreateTemplateResponse {
  id: string;
  url: string;
}

export const firebaseZeppTemplateRepository: ZeppTemplateRepository = {
  async createWorkoutTemplate(template: unknown): Promise<CreateTemplateResponse> {
    const callable = httpsCallable<{ template: unknown }, CreateTemplateResponse>(
      getFunctionsInstance(),
      'createWorkoutTemplate',
    );
    const response = await callable({ template });
    return response.data;
  },
};
