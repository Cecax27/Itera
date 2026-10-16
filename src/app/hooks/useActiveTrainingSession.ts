import { useCallback, useEffect, useState } from 'react';

import {
  ActiveTrainingSession,
  RunLog,
  SessionRecordMetadata,
  SessionSetRecord,
  TrainingProgress,
  createTrainingProgress,
  withTrainingStatus,
} from '@/domain/training';
import { firestoreSessionRecordRepository } from '@/infrastructure/firebase/repositories';

import { useAuth } from './useAuth';

export function useActiveTrainingSession() {
  const { user, status: authStatus } = useAuth();
  const [active, setActive] = useState<ActiveTrainingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (authStatus === 'loading') {
      setLoading(true);
      return;
    }
    if (!user) {
      setActive(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setActive(await firestoreSessionRecordRepository.getActiveTrainingSession(user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo recuperar la sesión en curso.');
    } finally {
      setLoading(false);
    }
  }, [authStatus, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const start = useCallback(async (metadata: SessionRecordMetadata) => {
    if (!user) throw new Error('Inicia sesión para empezar un entrenamiento.');
    if (active && (active.progress.status === 'active' || active.progress.status === 'paused')) {
      throw new Error('Ya tienes una sesión en curso. Continúala o termínala antes de empezar otra.');
    }
    const persistedActive = await firestoreSessionRecordRepository.getActiveTrainingSession(user.id);
    if (persistedActive) {
      setActive(persistedActive);
      if (persistedActive.metadata.id === metadata.id) return persistedActive;
      throw new Error('Ya tienes una sesión en curso. Continúala o termínala antes de empezar otra.');
    }
    const existingRecord = await firestoreSessionRecordRepository.getSessionRecord(user.id, metadata.id);
    if (existingRecord?.trainingProgress?.status === 'incomplete' || existingRecord?.trainingProgress?.status === 'completed') {
      throw new Error('Esta sesión ya fue cerrada. Revisa sus resultados en Progreso.');
    }
    const [existingSets, existingRunLog] = await Promise.all([
      firestoreSessionRecordRepository.getSets(user.id, metadata.id),
      firestoreSessionRecordRepository.getRunLog(user.id, metadata.id),
    ]);
    if (existingSets.length > 0 || existingRunLog) {
      throw new Error('Esta sesión ya tiene resultados. Puedes revisarlos o corregirlos desde “Registrar resultado”.');
    }
    const progress = createTrainingProgress();
    await firestoreSessionRecordRepository.saveTrainingProgress(user.id, metadata, progress);
    const next = { metadata, progress };
    setActive(next);
    return next;
  }, [active, user]);

  const updateProgress = useCallback(async (progress: TrainingProgress) => {
    if (!user || !active) throw new Error('No hay un entrenamiento activo para actualizar.');
    const nextProgress = { ...progress, updatedAt: new Date().toISOString() };
    await firestoreSessionRecordRepository.saveTrainingProgress(user.id, active.metadata, nextProgress);
    setActive({ metadata: active.metadata, progress: nextProgress });
    return nextProgress;
  }, [active, user]);

  const recordSet = useCallback(async (set: SessionSetRecord, progress: TrainingProgress) => {
    if (!user || !active) throw new Error('No hay un entrenamiento activo para guardar.');
    const nextProgress = { ...progress, updatedAt: new Date().toISOString() };
    await firestoreSessionRecordRepository.saveTrainingSet(user.id, active.metadata, set, nextProgress);
    setActive({ metadata: active.metadata, progress: nextProgress });
    return nextProgress;
  }, [active, user]);

  const recordRun = useCallback(async (runLog: RunLog, progress: TrainingProgress) => {
    if (!user || !active) throw new Error('No hay un entrenamiento activo para guardar.');
    const nextProgress = { ...progress, updatedAt: new Date().toISOString() };
    await firestoreSessionRecordRepository.saveRunLog(user.id, active.metadata, runLog, nextProgress);
    setActive({ metadata: active.metadata, progress: nextProgress });
    return nextProgress;
  }, [active, user]);

  const finishIncomplete = useCallback(async () => {
    if (!user || !active) return;
    const now = new Date().toISOString();
    await firestoreSessionRecordRepository.saveTrainingProgress(
      user.id,
      active.metadata,
      withTrainingStatus(active.progress, 'incomplete', now),
    );
    setActive(null);
  }, [active, user]);

  const dismiss = useCallback(() => setActive(null), []);

  return {
    active,
    loading,
    error,
    refresh,
    start,
    updateProgress,
    recordSet,
    recordRun,
    finishIncomplete,
    dismiss,
  };
}
