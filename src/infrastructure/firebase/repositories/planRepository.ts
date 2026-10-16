// Repositorio de planes en Firestore.
//
// Estructura: users/{userId}/plans/{planId}
// El planId lo genera el cliente y se incluye en el Plan.id, por simplicidad.

import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

import { Plan } from '@/domain/planning';

import { getDbInstance } from '../client';

function planDocRef(userId: string, planId: string) {
  return doc(getDbInstance(), 'users', userId, 'plans', planId);
}

export const firestorePlanRepository = {
  async get(userId: string, planId: string): Promise<Plan | null> {
    const snap = await getDoc(planDocRef(userId, planId));
    if (snap.exists()) return snap.data() as Plan;

    // Compatibilidad con planes creados antes de usar el ID fijo "current":
    // antes se guardaban con el ID aleatorio que generaba el motor.
    if (planId !== 'current') return null;
    const plansSnap = await getDocs(collection(getDbInstance(), 'users', userId, 'plans'));
    const plans = plansSnap.docs
      .map((planDoc) => planDoc.data() as Plan)
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

    return plans[0] ?? null;
  },

  async save(userId: string, plan: Plan): Promise<void> {
    await setDoc(planDocRef(userId, plan.id), plan);
  },
};
