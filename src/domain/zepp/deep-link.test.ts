// Tests del generador del deep link de Amazfit/Zepp.

import { describe, expect, it } from 'vitest';

import { buildAmazfitDeepLink } from './deep-link';

describe('buildAmazfitDeepLink', () => {
  it('reproduce el formato observado en Run Planner (URL sin codificar)', () => {
    const link = buildAmazfitDeepLink('https://itera.app/api/workout-templates/abc123');
    // El enlace real observado llevaba la URL de la plantilla tal cual,
    // con "://" y "/" sin escapar: Zepp así lo interpreta.
    expect(link).toBe(
      'amazfit://com.huami.watch.hmwatchmanager/action'
      + '?name=trainingtemplate_crossfit'
      + '&target=share'
      + '&data=https://itera.app/api/workout-templates/abc123',
    );
  });

  it('no aplica encodeURIComponent a la URL (comportamiento observado)', () => {
    const link = buildAmazfitDeepLink('https://us-central1-itera.cloudfunctions.net/workoutTemplate/x_Y-9');
    expect(link).not.toContain('%3A');
    expect(link).not.toContain('%2F');
    expect(link.endsWith('/workoutTemplate/x_Y-9')).toBe(true);
  });

  it('acepta la URL con espacios alrededor y recorta', () => {
    const link = buildAmazfitDeepLink('  https://itera.app/t/1  ');
    expect(link.endsWith('data=https://itera.app/t/1')).toBe(true);
  });

  it('rechaza URLs que no son https válidas', () => {
    expect(() => buildAmazfitDeepLink('')).toThrow();
    expect(() => buildAmazfitDeepLink('http://itera.app/t/1')).toThrow();
    expect(() => buildAmazfitDeepLink('javascript:alert(1)')).toThrow();
    expect(() => buildAmazfitDeepLink('https://itera.app/t/1 extra')).toThrow();
  });
});
