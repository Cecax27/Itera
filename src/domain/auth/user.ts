// Entidades de autenticación. TypeScript puro, sin Firebase.

/**
 * Usuario autenticado en Itera. Representa la sesión activa, no el perfil
 * deportivo (que vive en src/domain/profile/Profile).
 *
 * Los datos vienen de Firebase Auth, pero aquí los tipamos en nuestras
 * propias estructuras para que el resto de la app no dependa de la API
 * de Firebase.
 */
export interface AuthUser {
  /** Identificador estable (uid de Firebase Auth). */
  id: string;
  /** Email verificado, o undefined si el usuario se autenticó con Google. */
  email: string | undefined;
  /** Nombre a mostrar (puede venir del displayName o de Google). */
  displayName: string | undefined;
  /** Proveedor usado en la sesión actual. */
  provider: 'email' | 'google';
}

/**
 * Error específico del dominio de autenticación. Permite distinguir errores
 * de la app (validación de inputs) de errores del SDK de Firebase.
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: AuthErrorCode,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export type AuthErrorCode =
  | 'invalid-email'
  | 'weak-password'
  | 'wrong-credentials'
  | 'email-in-use'
  | 'user-disabled'
  | 'network-failed'
  | 'unknown';