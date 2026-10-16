import { Session, Discipline } from '@/domain/planning';

export type Rpe = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type SessionSource = 'planned' | 'free';

export interface SessionRecordMetadata {
  id: string;
  date: string;
  source: SessionSource;
  discipline: Discipline;
  plannedSession: Session | null;
  createdAt: string;
}

export interface SessionSetRecord {
  id: string;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  plannedWeightKg: number | null;
  plannedReps: string | null;
  actualWeightKg: number;
  actualReps: number;
  rpe: Rpe;
  recordedAt: string;
}

export interface RunLog {
  plannedDistanceMeters: number | null;
  plannedDurationMinutes: number | null;
  actualDistanceMeters: number;
  actualDurationSeconds: number;
  actualPaceSecondsPerKm: number;
  rpe: Rpe;
  recordedAt: string;
}

export function isRpe(value: number): value is Rpe {
  return Number.isInteger(value) && value >= 1 && value <= 10;
}

export function plannedSessionRecordId(weekStart: string, day: string, index: number): string {
  return `planned_${weekStart}_${day}_${index + 1}`;
}

export function createFreeSessionRecordId(now = Date.now(), random = Math.random()): string {
  return `free_${now}_${random.toString(36).slice(2, 9)}`;
}

export function runPaceSecondsPerKm(distanceMeters: number, durationSeconds: number): number {
  if (distanceMeters <= 0 || durationSeconds <= 0) return 0;
  return Math.round((durationSeconds * 1000) / distanceMeters);
}

export function formatPace(secondsPerKm: number): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '—';
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds} min/km`;
}

export function validatePositiveNumber(value: string, label: string): number {
  const parsed = Number(value.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} debe ser mayor que 0.`);
  }
  return parsed;
}
