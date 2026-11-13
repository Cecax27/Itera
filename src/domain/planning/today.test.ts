import { describe, expect, it } from 'vitest';

import { WeekDay } from '@/domain/profile';

import { Plan, RunSession, Session, StrengthSession, computeWeekProgress, dateForWeekDay, defaultPlanConfig, getNextSession, getTodaySessions, normalizePlan, weekDayOf, weekPlanForDate } from '@/domain/planning';

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

/** Fixture de plan de una semana (forma nueva de bloque). */
function singleWeekPlan(
  weekStart: string,
  sessions: Record<WeekDay, readonly Session[]>,
): Plan {
  return {
    id: 'p1',
    weekStart,
    config: defaultPlanConfig(),
    createdAt: '2026-10-12T10:00:00Z',
    weeks: [{ weekStart, sessions }],
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

describe('weekPlanForDate', () => {
  const week1 = '2026-10-12';
  const week2 = '2026-10-19';
  const plan: Plan = {
    id: 'p1',
    weekStart: week1,
    config: defaultPlanConfig(),
    createdAt: '2026-10-12T10:00:00Z',
    weeks: [
      { weekStart: week1, sessions: { mon: [strength()], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } },
      { weekStart: week2, sessions: { mon: [run()], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } },
    ],
  };

  it('finds the week containing the date', () => {
    expect(weekPlanForDate(plan, '2026-10-13T08:00:00Z')?.weekStart).toBe(week1);
    expect(weekPlanForDate(plan, '2026-10-19T08:00:00Z')?.weekStart).toBe(week2);
  });

  it('returns null outside the block', () => {
    expect(weekPlanForDate(plan, '2026-10-26T08:00:00Z')).toBeNull();
    expect(weekPlanForDate(plan, '2026-10-05T08:00:00Z')).toBeNull();
  });

  it('resolves sessions across weeks of the block', () => {
    expect(getTodaySessions(plan, '2026-10-12T08:00:00Z')).toEqual([strength()]);
    expect(getTodaySessions(plan, '2026-10-19T08:00:00Z')).toEqual([run()]);
    expect(getTodaySessions(plan, '2026-10-26T08:00:00Z')).toHaveLength(0);
  });
});

describe('getTodaySessions', () => {
  it('returns sessions of the day indicated by the date', () => {
    const plan = singleWeekPlan('2026-10-12', {
      mon: [strength()],
      tue: [],
      wed: [run()],
      thu: [],
      fri: [strength('lower')],
      sat: [],
      sun: [],
    });

    expect(getTodaySessions(plan, '2026-10-12T08:00:00Z')).toEqual([strength()]);
    expect(getTodaySessions(plan, '2026-10-13T08:00:00Z')).toEqual([]);
    expect(getTodaySessions(plan, '2026-10-14T08:00:00Z')).toEqual([run()]);
  });

  it('returns empty array on rest day', () => {
    const plan = singleWeekPlan('2026-10-12', {
      mon: [strength()],
      tue: [],
      wed: [],
      thu: [],
      fri: [],
      sat: [],
      sun: [],
    });
    expect(getTodaySessions(plan, '2026-10-13T08:00:00Z')).toHaveLength(0);
  });
});

describe('getNextSession', () => {
  const plan: Plan = singleWeekPlan('2026-10-12', {
    mon: [strength()],
    tue: [],
    wed: [run()],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  });

  it('finds the same day if today has a session', () => {
    const next = getNextSession(plan, '2026-10-12T08:00:00Z');
    expect(next?.day).toBe('mon');
    expect(next?.date).toBe('2026-10-12');
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
    const emptyPlan: Plan = singleWeekPlan('2026-10-12', {
      mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
    });
    expect(getNextSession(emptyPlan, '2026-10-12T08:00:00Z')).toBeNull();
  });

  it('continues into following weeks of the block', () => {
    const multiWeek: Plan = {
      id: 'p2',
      weekStart: '2026-10-12',
      config: defaultPlanConfig(),
      createdAt: '2026-10-12T10:00:00Z',
      weeks: [
        { weekStart: '2026-10-12', sessions: { mon: [strength()], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } },
        { weekStart: '2026-10-19', sessions: { mon: [], tue: [run(8000)], wed: [], thu: [], fri: [], sat: [], sun: [] } },
      ],
    };
    // Sábado de la semana 1: no hay nada más adelante esta semana, pero
    // la semana siguiente tiene sesión el martes.
    const next = getNextSession(multiWeek, '2026-10-17T08:00:00Z');
    expect(next?.weekStart).toBe('2026-10-19');
    expect(next?.day).toBe('tue');
    expect(next?.date).toBe('2026-10-20');
    expect(next?.sessions[0].discipline).toBe('running');
  });

  it('does not cross into weeks before the current one', () => {
    const multiWeek: Plan = {
      id: 'p3',
      weekStart: '2026-10-12',
      config: defaultPlanConfig(),
      createdAt: '2026-10-12T10:00:00Z',
      weeks: [
        { weekStart: '2026-10-12', sessions: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } },
        { weekStart: '2026-10-19', sessions: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } },
      ],
    };
    // Semana 1 (la actual) está vacía; la siguiente también → null, no
    // envuelve a sesiones pasadas de semanas anteriores.
    expect(getNextSession(multiWeek, '2026-10-14T08:00:00Z')).toBeNull();
  });
});

describe('computeWeekProgress', () => {
  it('counts sessions per discipline', () => {
    const plan = singleWeekPlan('2026-10-12', {
      mon: [strength(), run()],
      tue: [strength()],
      wed: [run(8000)],
      thu: [],
      fri: [],
      sat: [],
      sun: [],
    });
    const progress = computeWeekProgress(plan.weeks[0]);
    expect(progress.totalSessions).toBe(4);
    expect(progress.runningSessions).toBe(2);
    expect(progress.strengthSessions).toBe(2);
    expect(progress.totalRunningMeters).toBe(13000);
  });

  it('returns zeros for empty plan', () => {
    const emptyPlan = singleWeekPlan('2026-10-12', {
      mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
    });
    const progress = computeWeekProgress(emptyPlan.weeks[0]);
    expect(progress.totalSessions).toBe(0);
    expect(progress.totalRunningMeters).toBe(0);
  });

  it('returns zeros for a null week', () => {
    expect(computeWeekProgress(null).totalSessions).toBe(0);
  });
});

describe('normalizePlan', () => {
  it('keeps block plans as-is', () => {
    const plan = singleWeekPlan('2026-10-12', {
      mon: [strength()], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
    });
    expect(normalizePlan(plan)).toBe(plan);
  });

  it('wraps legacy single-week plans into one-week blocks', () => {
    const legacy = {
      id: 'old',
      weekStart: '2026-10-12',
      config: defaultPlanConfig(),
      createdAt: '2026-10-12T10:00:00Z',
      sessions: {
        mon: [strength()], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
      },
    } as unknown as Plan;
    const normalized = normalizePlan(legacy);
    expect(normalized.weeks).toHaveLength(1);
    expect(normalized.weeks[0].weekStart).toBe('2026-10-12');
    expect(normalized.weeks[0].sessions.mon).toEqual([strength()]);
    expect(Object.keys(normalized)).not.toContain('sessions');
  });
});
