import { describe, expect, it } from 'vitest';

import { AssistantModel, buildOfflineAnswer, buildSafetyAnswer, detectSafetySignal, rankModels } from './assistant';

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

describe('rankModels', () => {
  const model = (id: string): AssistantModel => ({ id, ownedBy: 'openai' });

  it('puts the newest gpt family first', () => {
    const ranked = rankModels([
      model('gpt-4o'),
      model('gpt-6-luna'),
      model('gpt-5.1'),
      model('gpt-4.1'),
    ]);
    expect(ranked.map((m) => m.id)).toEqual([
      'gpt-6-luna', 'gpt-5.1', 'gpt-4.1', 'gpt-4o',
    ]);
  });

  it('ranks the o-series and chatgpt aliases behind current gpt models', () => {
    const ranked = rankModels([
      model('chatgpt-4o-latest'),
      model('o3-mini'),
      model('gpt-5'),
      model('o4-mini'),
    ]);
    expect(ranked.map((m) => m.id)).toEqual([
      'gpt-5', 'o4-mini', 'o3-mini', 'chatgpt-4o-latest',
    ]);
  });

  it('keeps live aliases ahead of dated snapshots and fine-tunes last', () => {
    const ranked = rankModels([
      model('ft:gpt-4.1-2025-04-14:mi-empresa'),
      model('gpt-4o-2024-08-06'),
      model('gpt-4o'),
    ]);
    expect(ranked.map((m) => m.id)).toEqual([
      'gpt-4o', 'gpt-4o-2024-08-06', 'ft:gpt-4.1-2025-04-14:mi-empresa',
    ]);
  });

  it('breaks ties alphabetically and does not mutate the input', () => {
    const input = [model('gpt-6-nova'), model('gpt-6-luna')];
    const ranked = rankModels(input);
    expect(ranked.map((m) => m.id)).toEqual(['gpt-6-luna', 'gpt-6-nova']);
    expect(input.map((m) => m.id)).toEqual(['gpt-6-nova', 'gpt-6-luna']);
  });
});
