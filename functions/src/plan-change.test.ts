import { describe, expect, it } from 'vitest';

import { applyPlanOperations, parsePlanRecord, PlanRecord, validatePlanCoherence, WeekDay } from './plan-change';
import { BLOCK_MAX_WEEKS, buildPlanBlock, resolveWeekCount, weeklyVolumeFactor } from './plan-block';

const availability: Record<WeekDay, readonly unknown[]> = {
  mon: [{}], tue: [{}], wed: [{}], thu: [{}], fri: [{}], sat: [{}], sun: [{}],
};

const run = {
  discipline: 'running' as const,
  type: 'easy' as const,
  blocks: [{ type: 'steady' as const, distanceMeters: 5000 }],
  estimatedDurationMinutes: 30,
};

const strength = {
  discipline: 'strength' as const,
  type: 'upper' as const,
  exercises: [{
    id: 'press',
    name: 'Press banca',
    muscleGroup: 'chest' as const,
    sets: 3,
    reps: '8',
    targetWeightKg: 30,
    restSeconds: 90,
  }],
  estimatedDurationMinutes: 40,
};

const currentPlan: PlanRecord = {
  id: 'current',
  weekStart: '2026-10-12',
  config: { minSessionsPerWeek: 2, maxSessionsPerWeek: 5, targetSessionMinutes: 45 },
  createdAt: '2026-10-12T08:00:00.000Z',
  weeks: [{
    weekStart: '2026-10-12',
    sessions: { mon: [run], tue: [strength], wed: [], thu: [], fri: [], sat: [], sun: [] },
  }],
};

describe('applyPlanOperations', () => {
  it('moves sessions and preserves the original plan snapshot', () => {
    const proposed = applyPlanOperations(currentPlan, { availability }, [{
      type: 'move', day: 'mon', index: 0, toDay: 'wed', toIndex: null, session: null,
    }]);
    expect(proposed.weeks[0].sessions.mon).toEqual([]);
    expect(proposed.weeks[0].sessions.wed).toEqual([run]);
    expect(currentPlan.weeks[0].sessions.mon).toEqual([run]);
  });

  it('allows an explicit exercise/load proposal but rejects unavailable days', () => {
    const updatedStrength = { ...strength, purpose: null, exercises: [{ ...strength.exercises[0], targetWeightKg: 32 }] };
    const proposed = applyPlanOperations(currentPlan, { availability }, [{
      type: 'replace', day: 'tue', index: 0, toDay: null, toIndex: null, session: updatedStrength,
    }]);
    expect(proposed.weeks[0].sessions.tue[0].discipline).toBe('strength');
    if (proposed.weeks[0].sessions.tue[0].discipline === 'strength') {
      expect(proposed.weeks[0].sessions.tue[0].exercises[0].targetWeightKg).toBe(32);
    }

    expect(() => applyPlanOperations(currentPlan, {
      availability: { ...availability, wed: [] },
    }, [{ type: 'move', day: 'mon', index: 0, toDay: 'wed', toIndex: null, session: null }]))
      .toThrow('La propuesta programa una sesión en un día sin disponibilidad.');
  });

  it('rejects conflicts that the planning motor already forbids', () => {
    expect(() => applyPlanOperations(currentPlan, { availability }, [{
      type: 'move', day: 'mon', index: 0, toDay: 'wed', toIndex: null, session: null,
    }, {
      type: 'move', day: 'tue', index: 0, toDay: 'wed', toIndex: null, session: null,
    }])).toThrow();
  });

  it('applies operations to the week indicated by the operation', () => {
    const block: PlanRecord = {
      ...currentPlan,
      weeks: [
        currentPlan.weeks[0],
        { weekStart: '2026-10-19', sessions: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } },
      ],
    };
    const proposed = applyPlanOperations(block, { availability }, [{
      type: 'add', week: 1, day: 'tue', index: null, toDay: null, toIndex: null, session: run,
    }]);
    expect(proposed.weeks[1].sessions.tue).toEqual([run]);
    expect(proposed.weeks[0].sessions.mon).toEqual([run]);
  });

  it('rejects operations pointing outside the block', () => {
    expect(() => applyPlanOperations(currentPlan, { availability }, [{
      type: 'add', week: 3, day: 'tue', index: null, toDay: null, toIndex: null, session: run,
    }])).toThrow('La propuesta apunta a una semana fuera del bloque.');
  });
});

describe('parsePlanRecord', () => {
  it('accepts the multi-week block shape', () => {
    expect(parsePlanRecord(currentPlan)).toEqual(currentPlan);
  });

  it('wraps legacy single-week plans into one-week blocks', () => {
    const legacy = {
      id: 'current',
      weekStart: '2026-10-12',
      config: currentPlan.config,
      createdAt: currentPlan.createdAt,
      sessions: { mon: [run], tue: [strength], wed: [], thu: [], fri: [], sat: [], sun: [] },
    };
    const parsed = parsePlanRecord(legacy);
    expect(parsed.weeks).toHaveLength(1);
    expect(parsed.weeks[0].weekStart).toBe('2026-10-12');
    expect(parsed.weeks[0].sessions.mon).toEqual([run]);
  });

  it('rejects malformed plans', () => {
    expect(() => parsePlanRecord({ id: 'x' })).toThrow('El plan almacenado no tiene un formato válido.');
  });
});

describe('validatePlanCoherence', () => {
  it('accepts a coherent block', () => {
    const block: PlanRecord = {
      ...currentPlan,
      weeks: [
        currentPlan.weeks[0],
        { weekStart: '2026-10-19', sessions: { mon: [run], tue: [strength], wed: [], thu: [], fri: [], sat: [], sun: [] } },
      ],
    };
    expect(() => validatePlanCoherence(block, availability)).not.toThrow();
  });

  it('rejects non-contiguous weeks', () => {
    const block: PlanRecord = {
      ...currentPlan,
      weeks: [
        currentPlan.weeks[0],
        { weekStart: '2026-10-20', sessions: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } },
      ],
    };
    expect(() => validatePlanCoherence(block, availability))
      .toThrow('Las semanas del bloque no son contiguas.');
  });

  it('rejects a goal date before the block start', () => {
    expect(() => validatePlanCoherence({ ...currentPlan, goalDate: '2026-10-05' }, availability))
      .toThrow('La fecha objetivo es anterior al inicio del plan.');
  });

  it('validates every week against availability and session limits', () => {
    const block: PlanRecord = {
      ...currentPlan,
      weeks: [
        currentPlan.weeks[0],
        {
          weekStart: '2026-10-19',
          sessions: {
            mon: [run], tue: [strength], wed: [run], thu: [strength], fri: [run], sat: [], sun: [run],
          },
        },
      ],
    };
    expect(() => validatePlanCoherence(block, availability))
      .toThrow('La propuesta supera el máximo de sesiones semanales.');
  });
});

describe('buildPlanBlock', () => {
  it('builds the requested number of contiguous weeks from today', () => {
    const block = buildPlanBlock(currentPlan, { weeks: 4, goalDate: null }, '2026-10-14T10:00:00Z');
    expect(block.weekStart).toBe('2026-10-12');
    expect(block.weeks.map((week) => week.weekStart)).toEqual([
      '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02',
    ]);
    expect(block.weeks[0].sessions.mon).toEqual([run]);
  });

  it('resolves the week count from the goal date', () => {
    // 2026-11-08 es domingo: cae dentro de la 4ª semana del bloque.
    expect(resolveWeekCount({ goalDate: '2026-11-08' }, '2026-10-12')).toBe(4);
    // 2026-11-09 es lunes: ya necesita una 5ª semana.
    expect(resolveWeekCount({ goalDate: '2026-11-09' }, '2026-10-12')).toBe(5);
    expect(() => resolveWeekCount({ goalDate: '2026-10-01' }, '2026-10-12'))
      .toThrow('La fecha objetivo es anterior a la semana en curso.');
  });

  it('defaults to 4 weeks without explicit horizon', () => {
    const block = buildPlanBlock(currentPlan, {}, '2026-10-12T10:00:00Z');
    expect(block.weeks).toHaveLength(4);
  });

  it('progresses running volume and keeps strength as-is', () => {
    const longRun = {
      discipline: 'running' as const,
      type: 'long' as const,
      blocks: [
        { type: 'warmup' as const, distanceMeters: 1500 },
        { type: 'steady' as const, distanceMeters: 8000 },
        { type: 'cooldown' as const, distanceMeters: 1500 },
      ],
      estimatedDurationMinutes: 66,
    };
    const templatePlan: PlanRecord = {
      ...currentPlan,
      weeks: [{
        weekStart: '2026-10-12',
        sessions: { mon: [longRun], tue: [strength], wed: [], thu: [], fri: [], sat: [], sun: [] },
      }],
    };
    const block = buildPlanBlock(templatePlan, { weeks: 3, goalDate: null }, '2026-10-12T10:00:00Z');
    const week2Run = block.weeks[1].sessions.mon[0];
    if (week2Run.discipline !== 'running') throw new Error('se esperaba carrera');
    const steady = week2Run.blocks.find((b) => b.type === 'steady')!;
    expect(steady.distanceMeters).toBe(8400); // 8000 × 1.05, redondeado a 100 m
    expect(week2Run.estimatedDurationMinutes).toBe(69); // 66 × 1.05
    // La fuerza no cambia con la progresión de volumen.
    expect(block.weeks[1].sessions.tue[0]).toEqual(strength);
  });

  it('clamps the horizon to the allowed range', () => {
    expect(BLOCK_MAX_WEEKS).toBe(26);
    expect(weeklyVolumeFactor(3, 6)).toBe(0.8);
    expect(weeklyVolumeFactor(5, 6)).toBe(0.7);
  });
});
