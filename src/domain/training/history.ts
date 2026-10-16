import { ALL_WEEK_DAYS, WeekDay } from '@/domain/profile';
import { Plan, Session } from '@/domain/planning';

import { plannedSessionRecordId, RunLog, SessionRecordMetadata, SessionSetRecord } from './records';

export interface RecordedTrainingSession {
  metadata: SessionRecordMetadata;
  sets: SessionSetRecord[];
  runLog: RunLog | null;
}

export type HistoryDisciplineFilter = 'all' | 'running' | 'strength';
export type HistoryDateFilter = 'week' | '30days' | 'all';

export interface WeeklyTrainingSummary {
  weekStart: string;
  runningDistanceMeters: number;
  strengthVolumeKg: number;
  completedPlannedSessions: number;
  plannedSessions: number;
  adherencePercent: number | null;
}

export function mondayOfDate(dateIso: string): string {
  const date = toUtcDate(dateIso);
  const dayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayOffset);
  return date.toISOString().slice(0, 10);
}

export function filterTrainingHistory(
  records: readonly RecordedTrainingSession[],
  discipline: HistoryDisciplineFilter,
  dateFilter: HistoryDateFilter,
  todayIso: string,
): RecordedTrainingSession[] {
  const today = toUtcDate(todayIso);
  const todayDate = today.toISOString().slice(0, 10);
  const weekStart = mondayOfDate(todayDate);
  const firstAllowedDate = dateFilter === 'week'
    ? weekStart
    : dateFilter === '30days'
      ? addUtcDays(todayDate, -29)
      : null;

  return records
    .filter(({ metadata }) => {
      if (discipline !== 'all' && metadata.discipline !== discipline) return false;
      if (metadata.date > todayDate) return false;
      return firstAllowedDate === null || metadata.date >= firstAllowedDate;
    })
    .slice()
    .sort((a, b) => b.metadata.date.localeCompare(a.metadata.date) || b.metadata.id.localeCompare(a.metadata.id));
}

export function computeWeeklyTrainingSummary(
  records: readonly RecordedTrainingSession[],
  plan: Plan | null,
  todayIso: string,
): WeeklyTrainingSummary {
  const weekStart = mondayOfDate(todayIso);
  const weekEnd = addUtcDays(weekStart, 6);
  const currentWeekRecords = records.filter(
    ({ metadata }) => metadata.date >= weekStart && metadata.date <= weekEnd,
  );

  const runningDistanceMeters = currentWeekRecords.reduce(
    (sum, record) => sum + (record.runLog?.actualDistanceMeters ?? 0),
    0,
  );
  const strengthVolumeKg = currentWeekRecords.reduce(
    (sum, record) => sum + record.sets.reduce(
      (setSum, set) => setSum + set.actualWeightKg * set.actualReps,
      0,
    ),
    0,
  );

  if (!plan || plan.weekStart !== weekStart) {
    return {
      weekStart,
      runningDistanceMeters,
      strengthVolumeKg,
      completedPlannedSessions: 0,
      plannedSessions: 0,
      adherencePercent: null,
    };
  }

  const planned: Array<{ id: string; session: Session }> = [];
  ALL_WEEK_DAYS.forEach((day: WeekDay) => {
    plan.sessions[day].forEach((session, index) => {
      planned.push({
        id: plannedSessionRecordId(plan.weekStart, day, index),
        session,
      });
    });
  });

  const byId = new Map(currentWeekRecords.map((record) => [record.metadata.id, record]));
  const completedPlannedSessions = planned.filter(({ id, session }) =>
    hasCompleteResult(session, byId.get(id)),
  ).length;

  return {
    weekStart,
    runningDistanceMeters,
    strengthVolumeKg,
    completedPlannedSessions,
    plannedSessions: planned.length,
    adherencePercent: planned.length > 0
      ? Math.round((completedPlannedSessions / planned.length) * 100)
      : null,
  };
}

function hasCompleteResult(session: Session, record: RecordedTrainingSession | undefined): boolean {
  if (!record) return false;
  if (session.discipline === 'running') return record.runLog !== null;

  const expectedSetIds = session.exercises.flatMap((exercise) =>
    Array.from({ length: exercise.sets }, (_, index) => `${exercise.id}_set_${index + 1}`),
  );
  if (expectedSetIds.length === 0) return false;
  const recordedSetIds = new Set(record.sets.map((set) => set.id));
  return expectedSetIds.every((setId) => recordedSetIds.has(setId));
}

function addUtcDays(dateIso: string, days: number): string {
  const date = toUtcDate(dateIso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toUtcDate(dateIso: string): Date {
  const day = dateIso.slice(0, 10);
  const date = new Date(`${day}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? new Date('1970-01-05T00:00:00.000Z') : date;
}
