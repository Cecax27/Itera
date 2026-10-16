import { describe, expect, it } from 'vitest';

import { applyPlanOperations, PlanRecord, WeekDay } from './plan-change';

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
  sessions: { mon: [run], tue: [strength], wed: [], thu: [], fri: [], sat: [], sun: [] },
};

describe('applyPlanOperations', () => {
  it('moves sessions and preserves the original plan snapshot', () => {
    const proposed = applyPlanOperations(currentPlan, { availability }, [{
      type: 'move', day: 'mon', index: 0, toDay: 'wed', toIndex: null, session: null,
    }]);
    expect(proposed.sessions.mon).toEqual([]);
    expect(proposed.sessions.wed).toEqual([run]);
    expect(currentPlan.sessions.mon).toEqual([run]);
  });

  it('allows an explicit exercise/load proposal but rejects unavailable days', () => {
    const updatedStrength = { ...strength, purpose: null, exercises: [{ ...strength.exercises[0], targetWeightKg: 32 }] };
    const proposed = applyPlanOperations(currentPlan, { availability }, [{
      type: 'replace', day: 'tue', index: 0, toDay: null, toIndex: null, session: updatedStrength,
    }]);
    expect(proposed.sessions.tue[0].discipline).toBe('strength');
    if (proposed.sessions.tue[0].discipline === 'strength') {
      expect(proposed.sessions.tue[0].exercises[0].targetWeightKg).toBe(32);
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
});
