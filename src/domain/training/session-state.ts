import { StrengthSession } from '@/domain/planning';

import { TrainingProgress, TrainingStatus } from './records';

export function createTrainingProgress(now = new Date().toISOString()): TrainingProgress {
  return {
    status: 'active',
    currentExerciseIndex: 0,
    currentSetNumber: 1,
    restDurationSeconds: null,
    restEndsAt: null,
    startedAt: now,
    updatedAt: now,
    finishedAt: null,
  };
}

export function advanceStrengthTrainingProgress(
  progress: TrainingProgress,
  session: StrengthSession,
  now = new Date().toISOString(),
): TrainingProgress {
  const exercise = session.exercises[progress.currentExerciseIndex];
  if (!exercise) throw new Error('El ejercicio actual no existe en la sesión.');
  if (progress.currentSetNumber < 1 || progress.currentSetNumber > exercise.sets) {
    throw new Error('La serie actual no es válida.');
  }

  const lastSet = progress.currentSetNumber === exercise.sets;
  const lastExercise = progress.currentExerciseIndex === session.exercises.length - 1;
  const completed = lastSet && lastExercise;

  return {
    ...progress,
    status: completed ? 'completed' : 'active',
    currentExerciseIndex: lastSet ? progress.currentExerciseIndex + 1 : progress.currentExerciseIndex,
    currentSetNumber: lastSet ? 1 : progress.currentSetNumber + 1,
    restDurationSeconds: exercise.restSeconds > 0 ? exercise.restSeconds : null,
    restEndsAt: null,
    updatedAt: now,
    finishedAt: completed ? now : null,
  };
}

export function withTrainingStatus(
  progress: TrainingProgress,
  status: TrainingStatus,
  now = new Date().toISOString(),
): TrainingProgress {
  return {
    ...progress,
    status,
    updatedAt: now,
    finishedAt: status === 'completed' || status === 'incomplete' ? now : null,
  };
}
