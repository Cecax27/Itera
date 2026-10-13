// Hook useProfile: carga el perfil del usuario autenticado desde Firestore
// y permite actualizarlo.
//
// El hook depende de useAuth() para conocer el uid actual. Cuando no hay
// sesión (null), profile también es null y status = 'unauthenticated'.

import { useCallback, useEffect, useState } from 'react';

import { Profile } from '@/domain/profile';
import { firestoreProfileRepository } from '@/infrastructure/firebase/repositories';

import { useAuth } from './useAuth';

export type ProfileStatus = 'loading' | 'unauthenticated' | 'ready';

export interface UseProfileResult {
  status: ProfileStatus;
  userId: string | null;
  profile: Profile | null;
  save: (profile: Profile) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useProfile(): UseProfileResult {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<ProfileStatus>('loading');

  const load = useCallback(async (uid: string) => {
    const p = await firestoreProfileRepository.get(uid);
    setProfile(p);
    setStatus('ready');
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setStatus('unauthenticated');
      return;
    }
    setStatus('loading');
    void load(user.id);
  }, [user, load]);

  const save = useCallback(
    async (newProfile: Profile) => {
      if (!user) {
        throw new Error('Cannot save profile: user not authenticated');
      }
      await firestoreProfileRepository.save(user.id, newProfile);
      setProfile(newProfile);
    },
    [user],
  );

  const refresh = useCallback(async () => {
    if (!user) return;
    await load(user.id);
  }, [user, load]);

  return {
    status,
    userId: user?.id ?? null,
    profile,
    save,
    refresh,
  };
}