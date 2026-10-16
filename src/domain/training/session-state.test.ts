import { describe, expect, it } from 'vitest';

import { StrengthSession } from '@/domain/planning';

import { advanceStrengthTrainingProgress, createTrainingProgress, withTrainingStatus } from './session-state';

const session: StrengthSession = {
  discipline: 'strength',
  type: 'full_body',
  estimatedDurationMinutes: 40,
  exercises: [
    { id: 'squat', name: 'Sentadilla', muscleGroup: 'legs', sets: 2, reps: '5', targetWeightKg: 40, restSeconds: 120 },
    { id: 'row', name: 'Remo', muscleGroup: 'back', sets: 1, reps: '8', targetWeightKg: 20, restSeconds: 60 },
  ],
};

describe('training session state', () => {
  it('starts at the first set and advances within an exercise', () => {
    const start = createTrainingProgress('2026-10-16T10:00:00.000Z');
    const next = advanceStrengthTrainingProgress(start, session, '2026-10-16T10:05:00.000Z');
    expect(next.currentExerciseIndex).toBe(0);
    expect(next.currentSetNumber).toBe(2);
    expect(next.restDurationSeconds).toBe(120);
    expect(next.status).toBe('active');
  });

  it('moves to the next exercise then marks the final set complete', () => {
    const afterTwo = advanceStrengthTrainingProgress(
      advanceStrengthTrainingProgress(createTrainingProgress(), session),
      session,
    );
    expect(afterTwo.currentExerciseIndex).toBe(1);
    expect(afterTwo.currentSetNumber).toBe(1);
    const finished = advanceStrengthTrainingProgress(afterTwo, session, '2026-10-16T10:20:00.000Z');
    expect(finished.status).toBe('completed');
    expect(finished.finishedAt).toBe('2026-10-16T10:20:00.000Z');
  });

  it('preserves progress when pausing and timestamps incomplete sessions', () => {
    const initial = createTrainingProgress('2026-10-16T10:00:00.000Z');
    const paused = withTrainingStatus(initial, 'paused', '2026-10-16T10:05:00.000Z');
    const incomplete = withTrainingStatus(paused, 'incomplete', '2026-10-16T10:10:00.000Z');
    expect(paused.currentSetNumber).toBe(1);
    expect(paused.finishedAt).toBeNull();
    expect(incomplete.finishedAt).toBe('2026-10-16T10:10:00.000Z');
  });
});
