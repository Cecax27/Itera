// Implementación del AuthRepository sobre Firebase. El dominio no sabe de
// Firebase; este módulo aísla el SDK.
//
// Proveedores soportados hoy:
// - Email + contraseña.
//
// Proveedores pendientes (requieren build nativo, fuera de Expo Go):
// - Google Sign-In: ver AGENTS.md -> "Pendiente de definir".
//
// Regla arquitectónica: la app importa este módulo desde su index. El
// resto del código no importa de 'firebase/auth' directamente.

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';

import { AuthError, AuthRepository, AuthUser } from '@/domain/auth';

import { getAuthInstance } from '../client';

interface FirebaseAuthErrorLike {
  code?: string;
  message?: string;
  name?: string;
}

function isFirebaseAuthErrorLike(err: unknown): err is FirebaseAuthErrorLike {
  return err !== null && typeof err === 'object' && 'code' in (err as object);
}

function mapFirebaseError(err: unknown): AuthError {
  if (isFirebaseAuthErrorLike(err)) {
    const code = err.code ?? '';
    switch (code) {
      case 'auth/invalid-email':
        return new AuthError('Email inválido', 'invalid-email');
      case 'auth/missing-password':
      case 'auth/weak-password':
        return new AuthError('Contraseña demasiado débil', 'weak-password');
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return new AuthError('Email o contraseña incorrectos', 'wrong-credentials');
      case 'auth/email-already-in-use':
        return new AuthError('Ya existe una cuenta con este email', 'email-in-use');
      case 'auth/user-disabled':
        return new AuthError('Esta cuenta está deshabilitada', 'user-disabled');
      case 'auth/network-request-failed':
        return new AuthError('Error de red', 'network-failed');
      default:
        return new AuthError(err.message ?? 'Error desconocido', 'unknown');
    }
  }
  return new AuthError(err instanceof Error ? err.message : 'Error desconocido', 'unknown');
}

function toAuthUser(firebaseUser: import('firebase/auth').User | null): AuthUser | null {
  if (!firebaseUser) return null;
  const provider = firebaseUser.providerData[0]?.providerId === 'google.com'
    ? 'google'
    : 'email';
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email ?? undefined,
    displayName: firebaseUser.displayName ?? undefined,
    provider,
  };
}

export const firebaseAuthRepository: AuthRepository = {
  async signInWithEmail(email, password) {
    try {
      const cred = await signInWithEmailAndPassword(getAuthInstance(), email, password);
      const user = toAuthUser(cred.user);
      if (!user) throw new AuthError('No se pudo obtener el usuario', 'unknown');
      return user;
    } catch (err) {
      throw mapFirebaseError(err);
    }
  },

  async signUpWithEmail(email, password, displayName) {
    try {
      const cred = await createUserWithEmailAndPassword(getAuthInstance(), email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      const user = toAuthUser(cred.user);
      if (!user) throw new AuthError('No se pudo obtener el usuario', 'unknown');
      return user;
    } catch (err) {
      throw mapFirebaseError(err);
    }
  },

  async signInWithGoogle() {
    // Pendiente: Google Sign-In requiere build nativo (expo-auth-session +
    // @react-native-google-signin/google-signin) y por tanto no funciona en
    // Expo Go. Cuando salgamos de Expo Go y montemos EAS Build, este método
    // se sustituye por la implementación real. Mientras tanto, lanzamos un
    // error claro para que la UI lo muestre como aviso, no como bug.
    void GoogleAuthProvider; // marcador para que el import no se marque como unused
    throw new AuthError(
      'Google Sign-In aún no está disponible; requiere build nativo. Pendiente.',
      'unknown',
    );
  },

  async signOut() {
    await firebaseSignOut(getAuthInstance());
  },

  currentUser() {
    return toAuthUser(getAuthInstance().currentUser);
  },

  subscribe(listener) {
    const unsubscribe = onAuthStateChanged(getAuthInstance(), (user) => {
      listener(toAuthUser(user));
    });
    return unsubscribe;
  },
};