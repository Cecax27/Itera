// Repositorio de planes en Firestore.
//
// Estructura: users/{userId}/plans/{planId}
// El planId lo genera el cliente y se incluye en el Plan.id, por simplicidad.

import { doc, getDoc, setDoc } from 'firebase/firestore';

import { Plan } from '@/domain/planning';

import { getDbInstance } from '../client';

function planDocRef(userId: string, planId: string) {
  return doc(getDbInstance(), 'users', userId, 'plans', planId);
}

export const firestorePlanRepository = {
  async get(userId: string, planId: string): Promise<Plan | null> {
    const snap = await getDoc(planDocRef(userId, planId));
    if (!snap.exists()) return null;
    return snap.data() as Plan;
  },

  async save(userId: string, plan: Plan): Promise<void> {
    await setDoc(planDocRef(userId, plan.id), plan);
  },
};