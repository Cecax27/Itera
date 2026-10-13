// Validadores de inputs de autenticación.
// Validación local antes de llamar a Firebase (para fallar rápido y con
// mensajes claros sin gastar una llamada de red).

import { AuthError } from './user';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida formato de email. No verifica que el dominio exista, solo la
 * sintaxis. Firebase Auth hace la verificación real.
 */
export function validateEmail(email: string): string {
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    throw new AuthError('El email es obligatorio', 'invalid-email');
  }
  if (!EMAIL_RE.test(trimmed)) {
    throw new AuthError('El email no tiene un formato válido', 'invalid-email');
  }
  return trimmed;
}

/**
 * Valida una contraseña. Firebase Auth exige >= 6 caracteres; mantenemos
 * esa política en cliente para no enviar contraseñas inválidas al servidor.
 */
export function validatePassword(password: string): string {
  if (password.length === 0) {
    throw new AuthError('La contraseña es obligatoria', 'weak-password');
  }
  if (password.length < 6) {
    throw new AuthError('La contraseña debe tener al menos 6 caracteres', 'weak-password');
  }
  return password;
}

/**
 * Valida un nombre para crear cuenta. Opcional, solo longitud.
 */
export function validateDisplayName(name: string | undefined): string | undefined {
  if (name === undefined) return undefined;
  const trimmed = name.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > 80) {
    throw new AuthError('El nombre es demasiado largo (máximo 80 caracteres)', 'unknown');
  }
  return trimmed;
}