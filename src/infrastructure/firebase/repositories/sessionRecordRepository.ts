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
  ): Promise<void> {
    const batch = writeBatch(getDbInstance());
    const parent = await metadataForWrite(userId, metadata);
    batch.set(parent.ref, parent.data, { merge: true });
    batch.set(doc(sessionRef(userId, metadata.id), 'run_log', 'result'), runLog);
    await batch.commit();
  },
};
