import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

import {
  RecordedTrainingSession,
  RunLog,
  SessionRecordMetadata,
  SessionSetRecord,
  TrainingProgress,
} from '@/domain/training';

import { getDbInstance } from '../client';

function sessionRef(userId: string, sessionId: string) {
  return doc(getDbInstance(), 'users', userId, 'sessions', sessionId);
}

async function metadataForWrite(userId: string, metadata: SessionRecordMetadata) {
  const ref = sessionRef(userId, metadata.id);
  const snapshot = await getDoc(ref);
  const { createdAt, ...mutableMetadata } = metadata;
  return {
    ref,
    data: {
      ...mutableMetadata,
      ...(snapshot.exists() ? {} : { createdAt }),
      updatedAt: new Date().toISOString(),
    },
  };
}

export const firestoreSessionRecordRepository = {
  async getSessionRecord(userId: string, sessionId: string): Promise<SessionRecordMetadata | null> {
    const snapshot = await getDoc(sessionRef(userId, sessionId));
    return snapshot.exists()
      ? ({ ...snapshot.data(), id: snapshot.id } as SessionRecordMetadata)
      : null;
  },

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const parentRef = sessionRef(userId, sessionId);
    const [setsSnapshot, runLogsSnapshot] = await Promise.all([
      getDocs(collection(parentRef, 'sets')),
      getDocs(collection(parentRef, 'run_log')),
    ]);
    const documentsToDelete = setsSnapshot.docs.length + runLogsSnapshot.docs.length + 1;
    if (documentsToDelete > 500) {
      throw new Error('Esta sesión tiene demasiados registros para borrarse de una vez.');
    }

    const batch = writeBatch(getDbInstance());
    setsSnapshot.docs.forEach((snapshot) => batch.delete(snapshot.ref));
    runLogsSnapshot.docs.forEach((snapshot) => batch.delete(snapshot.ref));
    batch.delete(parentRef);
    await batch.commit();
  },

  async getActiveTrainingSession(userId: string) {
    const sessionsSnapshot = await getDocs(collection(getDbInstance(), 'users', userId, 'sessions'));
    const active = sessionsSnapshot.docs
      .map((snapshot) => {
        const metadata = { ...snapshot.data(), id: snapshot.id } as SessionRecordMetadata;
        const progress = metadata.trainingProgress;
        return progress && (progress.status === 'active' || progress.status === 'paused')
          ? { metadata, progress }
          : null;
      })
      .filter((session): session is NonNullable<typeof session> => session !== null)
      .sort((a, b) => b.progress.updatedAt.localeCompare(a.progress.updatedAt));

    return active[0] ?? null;
  },

  async saveTrainingProgress(
    userId: string,
    metadata: SessionRecordMetadata,
    progress: TrainingProgress,
  ): Promise<void> {
    const parent = await metadataForWrite(userId, metadata);
    await setDoc(parent.ref, { ...parent.data, trainingProgress: progress }, { merge: true });
  },

  async saveTrainingSet(
    userId: string,
    metadata: SessionRecordMetadata,
    set: SessionSetRecord,
    progress: TrainingProgress,
  ): Promise<void> {
    const batch = writeBatch(getDbInstance());
    const parent = await metadataForWrite(userId, metadata);
    batch.set(parent.ref, { ...parent.data, trainingProgress: progress }, { merge: true });
    batch.set(doc(sessionRef(userId, metadata.id), 'sets', set.id), set);
    await batch.commit();
  },

  async getHistory(userId: string): Promise<RecordedTrainingSession[]> {
    const sessionsSnapshot = await getDocs(collection(getDbInstance(), 'users', userId, 'sessions'));
    const sessions = await Promise.all(sessionsSnapshot.docs.map(async (sessionSnapshot) => {
      const metadata = {
        ...sessionSnapshot.data(),
        id: sessionSnapshot.id,
      } as SessionRecordMetadata;

      if (metadata.discipline === 'strength') {
        const setsSnapshot = await getDocs(collection(sessionSnapshot.ref, 'sets'));
        return {
          metadata,
          sets: setsSnapshot.docs.map((setDoc) => setDoc.data() as SessionSetRecord),
          runLog: null,
        };
      }

      const runLogSnapshot = await getDoc(doc(sessionSnapshot.ref, 'run_log', 'result'));
      return {
        metadata,
        sets: [],
        runLog: runLogSnapshot.exists() ? (runLogSnapshot.data() as RunLog) : null,
      };
    }));

    return sessions.sort((a, b) => b.metadata.date.localeCompare(a.metadata.date));
  },

  async getSets(userId: string, sessionId: string): Promise<SessionSetRecord[]> {
    const snapshot = await getDocs(collection(sessionRef(userId, sessionId), 'sets'));
    return snapshot.docs
      .map((setDoc) => setDoc.data() as SessionSetRecord)
      .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName) || a.setNumber - b.setNumber);
  },

  async saveSets(
    userId: string,
    metadata: SessionRecordMetadata,
    sets: readonly SessionSetRecord[],
  ): Promise<void> {
    const batch = writeBatch(getDbInstance());
    const parent = await metadataForWrite(userId, metadata);
    batch.set(parent.ref, parent.data, { merge: true });
    for (const set of sets) {
      batch.set(doc(sessionRef(userId, metadata.id), 'sets', set.id), set);
    }
    await batch.commit();
  },

  async getRunLog(userId: string, sessionId: string): Promise<RunLog | null> {
    const snapshot = await getDoc(doc(sessionRef(userId, sessionId), 'run_log', 'result'));
    return snapshot.exists() ? (snapshot.data() as RunLog) : null;
  },

  async saveRunLog(
    userId: string,
    metadata: SessionRecordMetadata,
    runLog: RunLog,
    trainingProgress?: TrainingProgress,
  ): Promise<void> {
    const batch = writeBatch(getDbInstance());
    const parent = await metadataForWrite(userId, metadata);
    batch.set(parent.ref, {
      ...parent.data,
      ...(trainingProgress ? { trainingProgress } : {}),
    }, { merge: true });
    batch.set(doc(sessionRef(userId, metadata.id), 'run_log', 'result'), runLog);
    await batch.commit();
  },
};
