import { useCallback, useEffect, useState } from 'react';

import { SessionRecordMetadata, SessionSetRecord } from '@/domain/training';
import { firestoreSessionRecordRepository } from '@/infrastructure/firebase/repositories';

import { useAuth } from './useAuth';

export function useSessionSets(sessionId: string | null, metadata: SessionRecordMetadata | null) {
  const { user } = useAuth();
  const [sets, setSets] = useState<SessionSetRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !sessionId) {
      setSets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setSets(await firestoreSessionRecordRepository.getSets(user.id, sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las series.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (newSets: readonly SessionSetRecord[]) => {
    if (!user || !metadata) throw new Error('No hay una sesión activa para guardar.');
    setError(null);
    try {
      await firestoreSessionRecordRepository.saveSets(user.id, metadata, newSets);
      setSets((current) => {
        const next = new Map(current.map((set) => [set.id, set]));
        newSets.forEach((set) => next.set(set.id, set));
        return [...next.values()].sort(
          (a, b) => a.exerciseName.localeCompare(b.exerciseName) || a.setNumber - b.setNumber,
        );
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudieron guardar las series.';
      setError(message);
      throw err;
    }
  }, [metadata, user]);

  return { sets, loading, error, save, refresh };
}
