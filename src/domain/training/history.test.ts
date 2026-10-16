import { describe, expect, it } from 'vitest';

import { Plan, Session, defaultPlanConfig } from '@/domain/planning';

import {
  computeWeeklyTrainingSummary,
  filterTrainingHistory,
  mondayOfDate,
  RecordedTrainingSession,
} from './index';

const runSession: Session = {
  discipline: 'running',
  type: 'easy',
  blocks: [{ type: 'steady', distanceMeters: 5000 }],
  estimatedDurationMinutes: 30,
};

const strengthSession: Session = {
  discipline: 'strength',
  type: 'upper',
  exercises: [{
    id: 'row',
    name: 'Remo',
    muscleGroup: 'back',
    sets: 2,
    reps: '8',
    targetWeightKg: 20,
    restSeconds: 90,
  }],
  estimatedDurationMinutes: 40,
};

const plan: Plan = {
  id: 'current',
  weekStart: '2026-10-12',
  config: defaultPlanConfig(),
  createdAt: '2026-10-12T08:00:00.000Z',
  sessions: {
    mon: [runSession],
    tue: [strengthSession],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  },
};

function makeRecord(
  id: string,
  date: string,
  discipline: 'running' | 'strength',
  source: 'planned' | 'free' = 'planned',
): RecordedTrainingSession {
  return {
    metadata: {
      id,
      date,
      source,
      discipline,
      plannedSession: source === 'planned' ? (discipline === 'running' ? runSession : strengthSession) : null,
      createdAt: `${date}T09:00:00.000Z`,
    },
    sets: discipline === 'strength' ? [1, 2].map((setNumber) => ({
      id: `row_set_${setNumber}`,
      status: 'completed' as const,
      exerciseId: 'row',
      exerciseName: 'Remo',
      setNumber,
      plannedWeightKg: 20,
      plannedReps: '8',
      actualWeightKg: 20,
      actualReps: 8,
      rpe: 7,
      recordedAt: `${date}T09:00:00.000Z`,
    })) : [],
    runLog: discipline === 'running' ? {
      plannedDistanceMeters: source === 'planned' ? 5000 : null,
      plannedDurationMinutes: source === 'planned' ? 30 : null,
      actualDistanceMeters: 5000,
      actualDurationSeconds: 1800,
      actualPaceSecondsPerKm: 360,
      rpe: 6,
      recordedAt: `${date}T09:00:00.000Z`,
    } : null,
  };
}

describe('mondayOfDate', () => {
  it('returns the Monday for a date in any weekday', () => {
    expect(mondayOfDate('2026-10-12')).toBe('2026-10-12');
    expect(mondayOfDate('2026-10-18T12:00:00Z')).toBe('2026-10-12');
  });
});

describe('filterTrainingHistory', () => {
  const records = [
    makeRecord('run-old', '2026-09-01', 'running'),
    makeRecord('strength-this-week', '2026-10-13', 'strength'),
    makeRecord('run-this-week', '2026-10-15', 'running'),
    makeRecord('free-future', '2026-10-20', 'running', 'free'),
  ];

  it('filters by discipline and current week, newest first', () => {
    expect(filterTrainingHistory(records, 'running', 'week', '2026-10-16').map((r) => r.metadata.id))
      .toEqual(['run-this-week']);
  });

  it('supports a rolling 30-day window and all history', () => {
    expect(filterTrainingHistory(records, 'all', '30days', '2026-10-16')).toHaveLength(2);
    expect(filterTrainingHistory(records, 'all', 'all', '2026-10-16')).toHaveLength(3);
  });
});

describe('computeWeeklyTrainingSummary', () => {
  it('aggregates weekly distance, strength volume and completed-plan adherence', () => {
    const records = [
      makeRecord('planned_2026-10-12_mon_1', '2026-10-12', 'running'),
      makeRecord('planned_2026-10-12_tue_1', '2026-10-13', 'strength'),
      makeRecord('free_run', '2026-10-14', 'running', 'free'),
      makeRecord('old_run', '2026-10-11', 'running'),
    ];

    expect(computeWeeklyTrainingSummary(records, plan, '2026-10-16')).toEqual({
      weekStart: '2026-10-12',
      runningDistanceMeters: 10000,
      strengthVolumeKg: 320,
      completedPlannedSessions: 2,
      plannedSessions: 2,
      adherencePercent: 100,
    });
  });

  it('does not count a partial strength record as an adhered session', () => {
    const partial = makeRecord('planned_2026-10-12_tue_1', '2026-10-13', 'strength');
    partial.sets = partial.sets.slice(0, 1);
    const summary = computeWeeklyTrainingSummary([partial], plan, '2026-10-16');
    expect(summary.completedPlannedSessions).toBe(0);
    expect(summary.adherencePercent).toBe(0);
  });

  it('counts skipped sets as logged but not completed or loaded volume', () => {
    const skipped = makeRecord('planned_2026-10-12_tue_1', '2026-10-13', 'strength');
    skipped.sets[1] = {
      ...skipped.sets[1],
      status: 'skipped',
      actualWeightKg: null,
      actualReps: null,
      rpe: null,
    };
    const summary = computeWeeklyTrainingSummary([skipped], plan, '2026-10-16');
    expect(summary.strengthVolumeKg).toBe(160);
    expect(summary.completedPlannedSessions).toBe(0);
    expect(summary.adherencePercent).toBe(0);
  });

  it('hides active and paused sessions from the completed history list', () => {
    const active = makeRecord('active', '2026-10-15', 'running');
    active.metadata.trainingProgress = {
      status: 'paused',
      currentExerciseIndex: 0,
      currentSetNumber: 1,
      restDurationSeconds: null,
      restEndsAt: null,
      startedAt: '2026-10-15T08:00:00.000Z',
      updatedAt: '2026-10-15T08:05:00.000Z',
      finishedAt: null,
    };
    expect(filterTrainingHistory([active], 'all', 'all', '2026-10-16')).toEqual([]);
  });

  it('omits adherence when the active plan is not for this week', () => {
    expect(computeWeeklyTrainingSummary([], { ...plan, weekStart: '2026-10-05' }, '2026-10-16').adherencePercent)
      .toBeNull();
  });
});
