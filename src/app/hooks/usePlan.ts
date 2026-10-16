// Hook usePlan: carga y persiste el plan semanal del usuario.
//
// En el MVP asumimos UN plan activo por usuario (el de la semana actual).
// Si el documento no está, devolvemos null. La generación del plan
// ocurre automáticamente al completar el onboarding.

import { useCallback, useEffect, useState } from 'react';

import { Plan, defaultPlanConfig, generatePlan } from '@/domain/planning';
import { Profile } from '@/domain/profile';
import { firestorePlanRepository } from '@/infrastructure/firebase/repositories';

import { useAuth } from './useAuth';

export type PlanStatus = 'loading' | 'unauthenticated' | 'ready' | 'empty';

export interface UsePlanResult {
  status: PlanStatus;
  plan: Plan | null;
  generateFromProfile: (profile: Profile) => Promise<Plan>;
  /** Guarda el plan dado como plan activo (sustituye el actual). */
  savePlan: (plan: Plan) => Promise<Plan>;
  /** Elimina el plan activo. Los entrenamientos realizados no se tocan. */
  deletePlan: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Estrategia: usamos como planId "current" para tener siempre un único
 * documento activo. Cuando llegue la IA (H7), podemos tener varios planes
 * históricos; en el MVP basta con uno.
 */
const CURRENT_PLAN_ID = 'current';

export function usePlan(): UsePlanResult {
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [status, setStatus] = useState<PlanStatus>('loading');

  const load = useCallback(async (uid: string) => {
    const p = await firestorePlanRepository.get(uid, CURRENT_PLAN_ID);
    setPlan(p);
    setStatus(p ? 'ready' : 'empty');
  }, []);

  useEffect(() => {
    if (!user) {
      setPlan(null);
      setStatus('unauthenticated');
      return;
    }
    setStatus('loading');
    void load(user.id);
  }, [user, load]);

  const generateFromProfile = useCallback(
    async (profile: Profile): Promise<Plan> => {
      if (!user) throw new Error('Cannot generate plan: user not authenticated');
      const now = new Date().toISOString();
      const newPlan = {
        ...generatePlan(profile, defaultPlanConfig(), now),
        id: CURRENT_PLAN_ID,
      };
      await firestorePlanRepository.save(user.id, newPlan);
      setPlan(newPlan);
      setStatus('ready');
      return newPlan;
    },
    [user],
  );

  const savePlan = useCallback(
    async (input: Plan): Promise<Plan> => {
      if (!user) throw new Error('Cannot save plan: user not authenticated');
      const normalized: Plan = input.id === CURRENT_PLAN_ID ? input : { ...input, id: CURRENT_PLAN_ID };
      await firestorePlanRepository.save(user.id, normalized);
      setPlan(normalized);
      setStatus('ready');
      return normalized;
    },
    [user],
  );

  const deletePlan = useCallback(async (): Promise<void> => {
    if (!user) return;
    await firestorePlanRepository.delete(user.id, CURRENT_PLAN_ID);
    // Si el plan activo venía de la compatibilidad con IDs antiguos,
    // nos aseguramos de borrar también ese documento.
    if (plan && plan.id !== CURRENT_PLAN_ID) {
      await firestorePlanRepository.delete(user.id, plan.id).catch(() => undefined);
    }
    setPlan(null);
    setStatus('empty');
  }, [user, plan]);

  const refresh = useCallback(async () => {
    if (!user) return;
    await load(user.id);
  }, [user, load]);

  return { status, plan, generateFromProfile, savePlan, deletePlan, refresh };
}
