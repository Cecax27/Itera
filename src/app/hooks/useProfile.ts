// Hook useProfile: carga el perfil del usuario actual desde Firestore y
// permite actualizarlo.
//
// Por simplicidad, la autenticación del MVP es: si no hay userId (no hay
// sesión), el perfil es null. El onboarding se muestra cuando el perfil
// es null tras la primera carga.
//
// Tareas pendientes (no resueltas aquí):
// - Cómo obtenemos el userId actual. Hoy se lee desde Firebase Auth.
// - Si necesitamos reintentar la carga o mostrar un estado "loading" persistente.
// - Si suscribimos cambios en tiempo real (onSnapshot) o solo carga puntual.

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';

import { Profile } from '@/domain/profile';
import { firestoreProfileRepository } from '@/infrastructure/firebase/repositories';
import { getAuthInstance, signInDevAnonymously } from '@/infrastructure/firebase';

export type ProfileStatus = 'loading' | 'unauthenticated' | 'ready';

export interface UseProfileResult {
  status: ProfileStatus;
  userId: string | null;
  profile: Profile | null;
  save: (profile: Profile) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useProfile(): UseProfileResult {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<ProfileStatus>('loading');

  const load = useCallback(async (uid: string) => {
    const p = await firestoreProfileRepository.get(uid);
    setProfile(p);
    setStatus('ready');
  }, []);

  useEffect(() => {
    const auth = getAuthInstance();

    // Mientras no haya flujo de login real (llega por H1.b), hacemos
    // sign-in anónimo automático para que el primer usuario pueda usar
    // la app sin configurar credenciales.
    void signInDevAnonymously().catch((err) => {
      console.warn('signInDevAnonymously failed', err);
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUserId(null);
        setProfile(null);
        setStatus('unauthenticated');
        return;
      }
      setUserId(user.uid);
      void load(user.uid);
    });
    return () => unsubscribe();
  }, [load]);

  const save = useCallback(
    async (newProfile: Profile) => {
      if (!userId) {
        throw new Error('Cannot save profile: user not authenticated');
      }
      await firestoreProfileRepository.save(userId, newProfile);
      setProfile(newProfile);
    },
    [userId],
  );

  const refresh = useCallback(async () => {
    if (!userId) return;
    await load(userId);
  }, [userId, load]);

  return { status, userId, profile, save, refresh };
}