import { DocumentSnapshot, Firestore } from 'firebase-admin/firestore';

import { PlanRecord } from './plan-change';

export interface AssistantContext {
  profile: {
    experience: unknown;
    primaryGoal: unknown;
    secondaryGoals: unknown;
    availability: Record<string, unknown>;
    equipment: unknown;
    restrictions: {
      injuries: readonly string[];
      notes: string;
    };
  };
  currentPlan: PlanRecord;
  recentTraining: readonly Record<string, unknown>[];
  recentPlanChanges: readonly Record<string, unknown>[];
  selectedSession: Record<string, unknown> | null;
}

export async function loadAssistantContext(
  db: Firestore,
  userId: string,
  sessionId: string | null,
): Promise<AssistantContext> {
  const userRef = db.collection('users').doc(userId);
  const [profileSnapshot, planSnapshot, sessionSnapshots, planChangeSnapshots] = await Promise.all([
    userRef.collection('profile').doc('main').get(),
    userRef.collection('plans').doc('current').get(),
    userRef.collection('sessions').orderBy('date', 'desc').limit(12).get(),
    userRef.collection('planChanges').orderBy('createdAt', 'desc').limit(5).get(),
  ]);

  if (!profileSnapshot.exists) throw new Error('No existe un perfil deportivo para este usuario.');
  if (!planSnapshot.exists) throw new Error('No existe un plan activo para este usuario.');

  const profileData = profileSnapshot.data() ?? {};
  const restrictions = profileData.restrictions ?? {};
  const plan = planSnapshot.data() as PlanRecord;
  const sessionDocs = new Map<string, DocumentSnapshot>(sessionSnapshots.docs.map((snapshot) => [snapshot.id, snapshot]));
  if (sessionId && !sessionDocs.has(sessionId)) {
    const selectedSnapshot = await userRef.collection('sessions').doc(sessionId).get();
    if (selectedSnapshot.exists) sessionDocs.set(selectedSnapshot.id, selectedSnapshot);
  }

  const recentTraining = await Promise.all(
    [...sessionDocs.values()]
      .filter((snapshot) => snapshot.data()?.trainingProgress?.status !== 'active'
        && snapshot.data()?.trainingProgress?.status !== 'paused')
      .map(async (snapshot) => {
        const metadata = snapshot.data() ?? {};
        const isStrength = metadata.discipline === 'strength';
        if (isStrength) {
          const setsSnapshot = await snapshot.ref.collection('sets').get();
          return {
            date: metadata.date,
            source: metadata.source,
            discipline: metadata.discipline,
            plannedSession: metadata.plannedSession ?? null,
            trainingProgress: metadata.trainingProgress ?? null,
            sets: setsSnapshot.docs.map((setDoc) => {
              const set = setDoc.data();
              return {
                exerciseName: set.exerciseName,
                setNumber: set.setNumber,
                status: set.status ?? 'completed',
                plannedWeightKg: set.plannedWeightKg ?? null,
                plannedReps: set.plannedReps ?? null,
                actualWeightKg: set.actualWeightKg ?? null,
                actualReps: set.actualReps ?? null,
                rpe: set.rpe ?? null,
              };
            }),
          };
        }

        const runLogSnapshot = await snapshot.ref.collection('run_log').doc('result').get();
        return {
          date: metadata.date,
          source: metadata.source,
          discipline: metadata.discipline,
          plannedSession: metadata.plannedSession ?? null,
          trainingProgress: metadata.trainingProgress ?? null,
          runLog: runLogSnapshot.exists ? runLogSnapshot.data() : null,
        };
      }),
  );

  const selectedDoc = sessionId ? sessionDocs.get(sessionId) : undefined;
  const recentPlanChanges = planChangeSnapshots.docs.map((snapshot) => {
    const change = snapshot.data();
    return {
      id: snapshot.id,
      status: change.status,
      reason: change.reason,
      createdAt: change.createdAt,
    };
  });

  return {
    profile: {
      // Excluimos nombre, edad y cualquier identificador personal no necesario.
      experience: profileData.experience ?? null,
      primaryGoal: profileData.primaryGoal ?? null,
      secondaryGoals: profileData.secondaryGoals ?? [],
      availability: profileData.availability ?? {},
      equipment: profileData.equipment ?? {},
      restrictions: {
        injuries: Array.isArray(restrictions.injuries)
          ? restrictions.injuries.filter((item: unknown): item is string => typeof item === 'string').slice(0, 12)
          : [],
        notes: typeof restrictions.notes === 'string' ? restrictions.notes.slice(0, 1000) : '',
      },
    },
    currentPlan: plan,
    recentTraining,
    recentPlanChanges,
    selectedSession: selectedDoc
      ? { id: selectedDoc.id, ...selectedDoc.data() }
      : null,
  };
}
