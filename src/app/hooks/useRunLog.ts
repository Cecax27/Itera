import { useCallback, useEffect, useState } from 'react';

import { RunLog, SessionRecordMetadata } from '@/domain/training';
import { firestoreSessionRecordRepository } from '@/infrastructure/firebase/repositories';

import { useAuth } from './useAuth';

export function useRunLog(sessionId: string | null, metadata: SessionRecordMetadata | null) {
  const { user } = useAuth();
  const [runLog, setRunLog] = useState<RunLog | null>(null);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !sessionId) {
      setRunLog(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRunLog(await firestoreSessionRecordRepository.getRunLog(user.id, sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el registro de carrera.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (newRunLog: RunLog) => {
    if (!user || !metadata) throw new Error('No hay una sesión activa para guardar.');
    setError(null);
    try {
      await firestoreSessionRecordRepository.saveRunLog(user.id, metadata, newRunLog);
      setRunLog(newRunLog);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar la carrera.';
      setError(message);
      throw err;
    }
  }, [metadata, user]);

  return { runLog, loading, error, save, refresh };
}
