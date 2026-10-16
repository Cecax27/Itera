import { useCallback, useState } from 'react';

import { RecordedTrainingSession } from '@/domain/training';
import { firestoreSessionRecordRepository } from '@/infrastructure/firebase/repositories';

import { useAuth } from './useAuth';

export function useTrainingHistory() {
  const { user, status: authStatus } = useAuth();
  const [sessions, setSessions] = useState<RecordedTrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (authStatus === 'loading') {
      setLoading(true);
      return;
    }
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setSessions(await firestoreSessionRecordRepository.getHistory(user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.');
    } finally {
      setLoading(false);
    }
  }, [authStatus, user]);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!user) throw new Error('Inicia sesión para eliminar el entrenamiento.');
    await firestoreSessionRecordRepository.deleteSession(user.id, sessionId);
    await refresh();
  }, [refresh, user]);

  return { sessions, loading, error, refresh, deleteSession };
}
