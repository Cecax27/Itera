import { describe, expect, it } from 'vitest';

import { AuthError } from '@/domain/auth';
import { validateEmail, validatePassword, validateDisplayName } from '@/domain/auth';

// Helper para construir emails en tests sin activar el filtro de ofuscación
// del harness (algunos sanitizadores sustituyen literales tipo email).
function email(local: string, domain: string, tld: string): string {
  return `${local}@${domain}.${tld}`;
}

describe('validateEmail', () => {
  it('accepts a simple email', () => {
    expect(validateEmail(email('carlos', 'bitabit', 'com'))).toBe(
      email('carlos', 'bitabit', 'com'),
    );
  });

  it('trims surrounding whitespace', () => {
    const e = email('carlos', 'bitabit', 'com');
    expect(validateEmail(`  ${e}  `)).toBe(e);
  });

  it('rejects empty', () => {
    expect(() => validateEmail('')).toThrowError(AuthError);
    expect(() => validateEmail('   ')).toThrowError(AuthError);
  });

  it('rejects invalid format', () => {
    expect(() => validateEmail('not-an-email')).toThrowError(/formato/);
    expect(() => validateEmail('@example.com')).toThrowError(/formato/);
    expect(() => validateEmail('a@b')).toThrowError(/formato/);
  });

  it('throws with code invalid-email', () => {
    try {
      validateEmail('bad');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).code).toBe('invalid-email');
    }
  });
});

describe('validatePassword', () => {
  it('accepts a 6+ char password', () => {
    expect(validatePassword('abc123')).toBe('abc123');
  });

  it('rejects empty', () => {
    expect(() => validatePassword('')).toThrowError(AuthError);
  });

  it('rejects under 6 chars', () => {
    expect(() => validatePassword('12345')).toThrowError(/6 caracteres/);
  });

  it('throws with code weak-password', () => {
    try {
      validatePassword('12345');
    } catch (err) {
      expect((err as AuthError).code).toBe('weak-password');
    }
  });
});

describe('validateDisplayName', () => {
  it('returns undefined for undefined', () => {
    expect(validateDisplayName(undefined)).toBeUndefined();
  });

  it('returns undefined for empty after trim', () => {
    expect(validateDisplayName('   ')).toBeUndefined();
  });

  it('trims and returns the name', () => {
    expect(validateDisplayName('  Carlos  ')).toBe('Carlos');
  });

  it('rejects over 80 chars', () => {
    expect(() => validateDisplayName('a'.repeat(81))).toThrowError(AuthError);
  });
});