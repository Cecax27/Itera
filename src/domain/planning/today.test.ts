import { describe, expect, it } from 'vitest';

import { ALL_WEEK_DAYS, emptyAvailability, emptyEquipment, emptyRestrictions, Profile, WeekDay } from '@/domain/profile';

import { Plan, RunSession, Session, StrengthSession, computeWeekProgress, dateForWeekDay, defaultPlanConfig, generatePlan, getNextSession, getTodaySessions, weekDayOf } from '@/domain/planning';

function makeProfile(): Profile {
  return {
    experience: 'intermediate',
    primaryGoal: {
      id: 'g1',
      description: 'Bajar 5 km',
      discipline: 'running',
      target: '22:00',
    },
    secondaryGoals: [],
    availability: {
      ...emptyAvailability(),
      mon: [{ start: '07:00', end: '08:00' }],
      tue: [{ start: '07:00', end: '08:00' }],
      wed: [{ start: '07:00', end: '08:00' }],
      thu: [{ start: '07:00', end: '08:00' }],
      fri: [{ start: '07:00', end: '08:00' }],
    },
    equipment: {
      ...emptyEquipment(),
      barbell: true,
      dumbbells: true,
    },
    restrictions: emptyRestrictions(),
  };
}

function strength(type: StrengthSession['type'] = 'upper'): StrengthSession {
  return { discipline: 'strength', type, exercises: [], estimatedDurationMinutes: 45 };
}

function run(distanceMeters = 5000): RunSession {
  return {
    discipline: 'running',
    type: 'easy',
    blocks: [{ type: 'steady', distanceMeters }],
    estimatedDurationMinutes: 30,
  };
}

describe('weekDayOf', () => {
  it('maps ISO dates to WeekDay correctly', () => {
    // 2026-10-12 is a Monday (verified in the generator tests).
    expect(weekDayOf('2026-10-12T10:00:00Z')).toBe('mon');
    expect(weekDayOf('2026-10-13T10:00:00Z')).toBe('tue');
    expect(weekDayOf('2026-10-18T10:00:00Z')).toBe('sun');
  });

  it('falls back to mon for invalid input', () => {
    expect(weekDayOf('')).toBe('mon');
    expect(weekDayOf('not-a-date')).toBe('mon');
  });
});

describe('dateForWeekDay', () => {
  it('maps each plan weekday to its calendar date', () => {
    expect(dateForWeekDay('2026-10-12', 'mon')).toBe('2026-10-12');
    expect(dateForWeekDay('2026-10-12', 'wed')).toBe('2026-10-14');
    expect(dateForWeekDay('2026-10-12', 'sun')).toBe('2026-10-18');
  });
});

describe('getTodaySessions', () => {
  it('returns sessions of the day indicated by the date', () => {
    const plan: Plan = {
      id: 'p1',
      weekStart: '2026-10-12',
      config: defaultPlanConfig(),
      createdAt: '2026-10-12T10:00:00Z',
      sessions: {
        mon: [strength()],
        tue: [],
        wed: [run()],
        thu: [],
        fri: [strength('lower')],
        sat: [],
        sun: [],
      },
    };

    expect(getTodaySessions(plan, '2026-10-12T08:00:00Z')).toEqual([strength()]);
    expect(getTodaySessions(plan, '2026-10-13T08:00:00Z')).toEqual([]);
    expect(getTodaySessions(plan, '2026-10-14T08:00:00Z')).toEqual([run()]);
  });

  it('returns empty array on rest day', () => {
    const plan: Plan = {
      id: 'p1',
      weekStart: '2026-10-12',
      config: defaultPlanConfig(),
      createdAt: '2026-10-12T10:00:00Z',
      sessions: {
        mon: [strength()],
        tue: [],
        wed: [],
        thu: [],
        fri: [],
        sat: [],
        sun: [],
      },
    };
    expect(getTodaySessions(plan, '2026-10-13T08:00:00Z')).toHaveLength(0);
  });
});

describe('getNextSession', () => {
  const plan: Plan = {
    id: 'p1',
    weekStart: '2026-10-12',
    config: defaultPlanConfig(),
    createdAt: '2026-10-12T10:00:00Z',
    sessions: {
      mon: [strength()],
      tue: [],
      wed: [run()],
      thu: [],
      fri: [],
      sat: [],
      sun: [],
    },
  };

  it('finds the same day if today has a session', () => {
    const next = getNextSession(plan, '2026-10-12T08:00:00Z');
    expect(next?.day).toBe('mon');
  });

  it('skips rest days to find the next session', () => {
    const next = getNextSession(plan, '2026-10-13T08:00:00Z'); // martes
    expect(next?.day).toBe('wed');
  });

  it('wraps around to find a session later in the week', () => {
    const next = getNextSession(plan, '2026-10-17T08:00:00Z'); // sábado
    // mon ya pasó (no es hoy), pero la búsqueda incluye hoy, así que si
    // sábado no tiene sesión, vuelve al lunes.
    expect(next?.day).toBe('mon');
  });

  it('returns null when no session exists in the week', () => {
    const emptyPlan: Plan = {
      ...plan,
      sessions: {
        mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
      },
    };
    expect(getNextSession(emptyPlan, '2026-10-12T08:00:00Z')).toBeNull();
  });
});

describe('computeWeekProgress', () => {
  it('counts sessions per discipline', () => {
    const plan: Plan = {
      id: 'p1',
      weekStart: '2026-10-12',
      config: defaultPlanConfig(),
      createdAt: '2026-10-12T10:00:00Z',
      sessions: {
        mon: [strength(), run()],
        tue: [strength()],
        wed: [run(8000)],
        thu: [],
        fri: [],
        sat: [],
        sun: [],
      },
    };
    const progress = computeWeekProgress(plan);
    expect(progress.totalSessions).toBe(4);
    expect(progress.runningSessions).toBe(2);
    expect(progress.strengthSessions).toBe(2);
    expect(progress.totalRunningMeters).toBe(13000);
  });

  it('returns zeros for empty plan', () => {
    const emptyPlan: Plan = {
      id: 'p1',
      weekStart: '2026-10-12',
      config: defaultPlanConfig(),
      createdAt: '2026-10-12T10:00:00Z',
      sessions: {
        mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
      },
    };
    const progress = computeWeekProgress(emptyPlan);
    expect(progress.totalSessions).toBe(0);
    expect(progress.totalRunningMeters).toBe(0);
  });
});
