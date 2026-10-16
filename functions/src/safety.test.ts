import { describe, expect, it } from 'vitest';

import { detectSafetySignal, safetyReply } from './safety';

describe('safety gate', () => {
  it('detects urgent and caution signals before any provider call', () => {
    expect(detectSafetySignal('Siento dolor en el pecho')).toEqual({ severity: 'urgent' });
    expect(detectSafetySignal('Tengo una molestia en la rodilla')).toEqual({ severity: 'caution' });
    expect(detectSafetySignal('¿Por qué me toca carrera suave?')).toBeNull();
  });

  it('never returns a plan change for an alarm signal', () => {
    const reply = safetyReply({ severity: 'urgent' });
    expect(reply.planChange).toBeNull();
    expect(reply.text).toContain('No puedo diagnosticar');
  });
});
