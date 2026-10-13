// Interfaz del repositorio de autenticación.
// Vive en el dominio; la implementación con Firebase vive en infrastructure/.

import { AuthUser } from './user';

/**
 * Métodos del repositorio de autenticación. Decisiones de diseño:
 *
 * - signInEmail / signUpEmail: devuelven el AuthUser creado.
 * - signInWithGoogle: en RN requiere flujo OAuth interactivo (devuelve un
 *   provider que la UI lanza); la interfaz lo deja como método asíncrono
 *   que la implementación resuelve.
 * - signOut: cierra la sesión.
 * - currentUser: getter opcional para preguntar si hay sesión activa sin
 *   suscribirse a cambios.
 * - subscribe: callback que se invoca cuando entra/sale un usuario.
 *   Importante para que useAuth() reaccione en tiempo real.
 */
export interface AuthRepository {
  signInWithEmail(email: string, password: string): Promise<AuthUser>;
  signUpWithEmail(email: string, password: string, displayName?: string): Promise<AuthUser>;
  signInWithGoogle(): Promise<AuthUser>;
  signOut(): Promise<void>;
  /** Devuelve el usuario actual o null si no hay sesión. */
  currentUser(): AuthUser | null;
  /**
   * Suscribe a cambios de sesión. Devuelve una función para cancelar la
   * suscripción.
   */
  subscribe(listener: (user: AuthUser | null) => void): () => void;
}