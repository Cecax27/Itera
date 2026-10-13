// Hook useAuth: expone el usuario actual y los métodos para cambiar de
// sesión. Se suscribe a cambios del AuthRepository para que la UI reaccione
// en tiempo real.

import { useCallback, useEffect, useState } from 'react';

import {
  AuthError,
  AuthUser,
  validateDisplayName,
  validateEmail,
  validatePassword,
} from '@/domain/auth';
import { firebaseAuthRepository } from '@/infrastructure/firebase/repositories';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface UseAuthResult {
  status: AuthStatus;
  user: AuthUser | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    // Snapshot inicial por si la suscripción llega tarde.
    setUser(firebaseAuthRepository.currentUser());
    const unsubscribe = firebaseAuthRepository.subscribe((u) => {
      setUser(u);
      setStatus(u ? 'authenticated' : 'unauthenticated');
    });
    return unsubscribe;
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const e = validateEmail(email);
    const p = validatePassword(password);
    await firebaseAuthRepository.signInWithEmail(e, p);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, displayName?: string) => {
    const e = validateEmail(email);
    const p = validatePassword(password);
    const n = validateDisplayName(displayName);
    await firebaseAuthRepository.signUpWithEmail(e, p, n);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseAuthRepository.signOut();
  }, []);

  return { status, user, signInWithEmail, signUpWithEmail, signOut };
}

// Re-exportamos AuthError para que las pantallas lo importen desde aquí.
export { AuthError };