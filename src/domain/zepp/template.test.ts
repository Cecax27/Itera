// Tests del adaptador de exportación a Zepp.

import { describe, expect, it } from 'vitest';

import { RunBlock, RunSession } from '@/domain/planning';

import { RUN_PLANNER_OBSERVED_TEMPLATE } from './fixtures';
import { buildZeppTemplate, MAX_ZEPP_NODES, ZeppTemplate } from './template';

function runSession(blocks: RunBlock[], overrides: Partial<RunSession> = {}): RunSession {
  return {
    discipline: 'running',
    type: 'intervals',
    blocks,
    purpose: 'Sesión de prueba',
    estimatedDurationMinutes: 45,
    ...overrides,
  };
}

function intervalValues(template: ZeppTemplate): string[] {
  return template.trainingIntervals.children.map(
    (node) => `${node.trainingInterval.intervalType}:${node.trainingInterval.intervalUnit}:${node.trainingInterval.intervalUnitValue}`,
  );
}

describe('buildZeppTemplate — mapeo de etapas', () => {
  it('mapea calentamiento, trabajo, descanso y vuelta a la calma a los códigos observados', () => {
    const result = buildZeppTemplate({
      session: runSession([
        { type: 'warmup', distanceMeters: 1500 },
        { type: 'steady', distanceMeters: 4000 },
        { type: 'interval', distanceMeters: 800, recoverySeconds: 90, repetitions: 1 },
        { type: 'cooldown', distanceMeters: 1500 },
      ]),
      title: 'Test',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const nodes = result.template.trainingIntervals.children;
    expect(nodes.map((n) => n.trainingInterval.intervalType)).toEqual(['0', '1', '1', '2', '4']);
    // Etiquetas i18n observadas; la de vuelta a la calma no lo fue → null.
    expect(nodes[0].trainingInterval.intervalTypeI18nKey).toBe('gapType_warmup');
    expect(nodes[1].trainingInterval.intervalTypeI18nKey).toBe('gapType_training');
    expect(nodes[3].trainingInterval.intervalTypeI18nKey).toBe('gapType_rest');
    expect(nodes[4].trainingInterval.intervalTypeI18nKey).toBeNull();
  });

  it('convierte distancias a metros y duraciones a segundos con sus unidades', () => {
    const result = buildZeppTemplate({
      session: runSession([
        { type: 'warmup', distanceMeters: 0, durationSeconds: 600 },
        { type: 'steady', distanceMeters: 5320 },
      ]),
      title: 'Test',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [warmup, steady] = result.template.trainingIntervals.children;
    expect(warmup.trainingInterval.intervalUnit).toBe('1');
    expect(warmup.trainingInterval.intervalUnitValue).toBe('600');
    expect(warmup.trainingInterval.intervalUnitI18nKey).toBeNull();
    expect(steady.trainingInterval.intervalUnit).toBe('0');
    expect(steady.trainingInterval.intervalUnitValue).toBe('5320');
    expect(steady.trainingInterval.intervalUnitI18nKey).toBe('gap_Km');
    // Siempre sin avisos: no hay códigos verificados de ritmo/FC.
    for (const node of result.template.trainingIntervals.children) {
      expect(node.trainingInterval.alertRule).toBe('0');
      expect(node.trainingInterval.alertRuleDetail).toBe('0-0');
    }
  });

  it('desenrolla las repeticiones como nodos repetidos con descanso intercalado', () => {
    const result = buildZeppTemplate({
      session: runSession([
        { type: 'interval', distanceMeters: 1000, recoverySeconds: 90, repetitions: 5 },
      ]),
      title: 'Series',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(intervalValues(result.template)).toEqual([
      '1:0:1000', '2:1:90',
      '1:0:1000', '2:1:90',
      '1:0:1000', '2:1:90',
      '1:0:1000', '2:1:90',
      '1:0:1000', '2:1:90',
    ]);
  });

  it('añade el descanso tras un intervalo simple, como la plantilla de referencia', () => {
    const result = buildZeppTemplate({
      session: runSession([
        { type: 'interval', distanceMeters: 5000, recoverySeconds: 120, repetitions: 1 },
      ]),
      title: 'Test',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(intervalValues(result.template)).toEqual(['1:0:5000', '2:1:120']);
  });

  it('rechaza sesiones de fuerza con un mensaje claro', () => {
    const result = buildZeppTemplate({
      session: {
        discipline: 'strength',
        type: 'upper',
        exercises: [],
        estimatedDurationMinutes: 45,
      } as unknown as RunSession,
      title: 'Fuerza',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('carrera');
  });

  it('rechaza bloques sin dimensión, con valores imposibles o con repeticiones absurdas', () => {
    const invalid: RunBlock[] = [
      { type: 'steady', distanceMeters: 0 },
      { type: 'steady', distanceMeters: -500 },
      { type: 'steady', distanceMeters: 1000, durationSeconds: 600 },
      { type: 'steady', distanceMeters: 0, durationSeconds: 0 },
      { type: 'interval', distanceMeters: 1000, recoverySeconds: -5, repetitions: 1 },
      { type: 'interval', distanceMeters: 1000, repetitions: 0 },
      { type: 'interval', distanceMeters: 1000, repetitions: 99 },
      { type: 'steady', distanceMeters: 0, durationSeconds: 200000 },
    ];
    for (const block of invalid) {
      const result = buildZeppTemplate({ session: runSession([block]), title: 'Test' });
      expect(result.ok, `esperaba rechazo para ${JSON.stringify(block)}`).toBe(false);
    }
  });

  it('rechaza la exportación completa si un solo bloque no es exportable', () => {
    const result = buildZeppTemplate({
      session: runSession([
        { type: 'warmup', distanceMeters: 1000 },
        { type: 'steady', distanceMeters: 0 },
      ]),
      title: 'Test',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('steady');
  });

  it('rechaza plantillas con demasiadas etapas', () => {
    const blocks: RunBlock[] = Array.from({ length: Math.ceil((MAX_ZEPP_NODES + 2) / 2) }, () => ({
      type: 'interval' as const,
      distanceMeters: 200,
      recoverySeconds: 60,
      repetitions: 1,
    }));
    const result = buildZeppTemplate({ session: runSession(blocks), title: 'Test' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('demasiadas etapas');
  });
});

describe('buildZeppTemplate — metadatos y compatibilidad', () => {
  it('reproduce la plantilla real observada de Run Planner con una sesión equivalente', () => {
    const result = buildZeppTemplate({
      session: runSession([
        { type: 'warmup', distanceMeters: 0, durationSeconds: 900 },
        { type: 'interval', distanceMeters: 5000, recoverySeconds: 120, repetitions: 1 },
      ]),
      title: 'Entrenamiento',
      description: '15 min de calentamiento + 5 km de carrera + 2 min de recuperación',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { createdAt, updatedAt, ...expectedTemplate } = RUN_PLANNER_OBSERVED_TEMPLATE;
    expect(result.template).toEqual(expectedTemplate);
  });

  it('metadatos observados: sin datos personales, carrera al aire libre, status AVAILABLE', () => {
    const result = buildZeppTemplate({
      session: runSession([{ type: 'steady', distanceMeters: 5000 }]),
      title: '  Carrera suave  ',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.template.username).toBe('');
    expect(result.template.avatar).toBe('');
    expect(result.template.title).toBe('Carrera suave');
    expect(result.template.appName).toBe('com.xiaomi.hm.health');
    expect(result.template.status).toBe('AVAILABLE');
    expect(result.template.trainingTypeId).toBe(1);
    expect(result.template.trainingTypeName).toBe('户外跑');
    expect(result.template.shareUrl).toBe('https://img-cdn.zepp.com/20230911/outdoor.png');
  });

  it('omite los ritmos objetivo sin exportar códigos no verificados, y lo informa', () => {
    const result = buildZeppTemplate({
      session: runSession([
        { type: 'interval', distanceMeters: 1000, paceSecondsPerKm: 330, repetitions: 2, recoverySeconds: 90 },
      ]),
      title: 'Test',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.omissions.length).toBeGreaterThan(0);
    expect(result.omissions[0]).toContain('5:30 min/km');
    for (const node of result.template.trainingIntervals.children) {
      expect(node.trainingInterval.alertRule).toBe('0');
      expect(JSON.stringify(node)).not.toContain('330');
    }
  });

  it('admite sesiones antiguas sin durationSeconds (solo distancia)', () => {
    const oldBlock = { type: 'steady', distanceMeters: 5000 } as RunBlock;
    expect('durationSeconds' in oldBlock).toBe(false);
    const result = buildZeppTemplate({ session: runSession([oldBlock]), title: 'Antigua' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(intervalValues(result.template)).toEqual(['1:0:5000']);
  });

  it('trunca títulos largos y permite descripciones vacías', () => {
    const result = buildZeppTemplate({
      session: runSession([{ type: 'steady', distanceMeters: 5000 }]),
      title: 'T'.repeat(100),
      description: '   ',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.template.title.length).toBe(60);
    expect(result.template.title.endsWith('…')).toBe(true);
    expect(result.template.description).toBe('');
  });

  it('rechaza sesiones sin bloques o con título vacío', () => {
    expect(buildZeppTemplate({ session: runSession([]), title: 'Test' }).ok).toBe(false);
    expect(buildZeppTemplate({ session: runSession([{ type: 'steady', distanceMeters: 1000 }]), title: '   ' }).ok).toBe(false);
  });
});
