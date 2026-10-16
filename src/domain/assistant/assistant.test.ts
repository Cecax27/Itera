import { describe, expect, it } from 'vitest';

import { buildOfflineAnswer, buildSafetyAnswer, detectSafetySignal } from './assistant';

describe('assistant safety and fallback', () => {
  it('detects conservative alarm signals without consulting the LLM', () => {
    expect(detectSafetySignal('Siento dolor fuerte en el pecho')).toEqual({ severity: 'urgent' });
    expect(detectSafetySignal('Me siento mareado al correr')).toEqual({ severity: 'caution' });
    expect(detectSafetySignal('¿Por qué me toca carrera suave?')).toBeNull();
  });

  it('returns a safety-first answer and never proposes a plan change', () => {
    const answer = buildSafetyAnswer({ severity: 'urgent' });
    expect(answer.source).toBe('engine');
    expect(answer.planChange).toBeNull();
    expect(answer.text).toContain('No puedo diagnosticar');
  });

  it('uses transparent rule-based responses when the provider is unavailable', () => {
    expect(buildOfflineAnswer('Ayer omití mi carrera').text).toContain('Regla del motor');
    expect(buildOfflineAnswer('Estoy muy cansado').planChange).toBeNull();
    expect(buildOfflineAnswer('¿Por qué esta sesión?').text).toContain('El asistente no está disponible');
  });
});
