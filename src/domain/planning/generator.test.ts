import { describe, expect, it } from 'vitest';

import { ALL_WEEK_DAYS, WeekDay, emptyAvailability, emptyEquipment, emptyRestrictions, Profile } from '@/domain/profile';

import {
  Plan,
  RunSession,
  Session,
  StrengthSession,
  assignSessionsToDays,
  countAvailableDays,
  defaultPlanConfig,
  generatePlan,
  mondayOf,
} from '@/domain/planning';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    experience: 'intermediate',
    primaryGoal: {
      id: 'g1',
      description: 'Bajar 5 km a 22 min',
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
    ...overrides,
  };
}

describe('mondayOf', () => {
  it('returns the same day if it is Monday', () => {
    expect(mondayOf('2026-10-12T10:00:00Z')).toBe('2026-10-12');
  });
  it('returns the previous Monday if it is Wednesday', () => {
    expect(mondayOf('2026-10-14T10:00:00Z')).toBe('2026-10-12');
  });
  it('handles Sunday by jumping back six days', () => {
    expect(mondayOf('2026-10-11T10:00:00Z')).toBe('2026-10-05');
  });
});

describe('countAvailableDays', () => {
  it('counts days with at least one slot', () => {
    const profile = makeProfile();
    expect(countAvailableDays(profile.availability)).toBe(5);
  });

  it('returns 0 when no slots', () => {
    expect(countAvailableDays(emptyAvailability())).toBe(0);
  });
});

describe('generatePlan', () => {
  it('creates a plan with sessions within [min, max] and <= available days', () => {
    const profile = makeProfile(); // 5 días disponibles
    const plan = generatePlan(profile, defaultPlanConfig(), '2026-10-12T10:00:00Z');
    expect(plan.sessions).toBeDefined();
    const total = Object.values(plan.sessions).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBeGreaterThanOrEqual(defaultPlanConfig().minSessionsPerWeek);
    expect(total).toBeLessThanOrEqual(Math.min(defaultPlanConfig().maxSessionsPerWeek, 5));
  });

  it('returns an empty plan when no availability', () => {
    const profile = makeProfile({ availability: emptyAvailability() });
    const plan = generatePlan(profile, defaultPlanConfig(), '2026-10-12T10:00:00Z');
    const total = Object.values(plan.sessions).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(0);
  });

  it('respects maxSessionsPerWeek when availability is high', () => {
    const profile = makeProfile({
      availability: {
        ...emptyAvailability(),
        mon: [{ start: '07:00', end: '08:00' }],
        tue: [{ start: '07:00', end: '08:00' }],
        wed: [{ start: '07:00', end: '08:00' }],
        thu: [{ start: '07:00', end: '08:00' }],
        fri: [{ start: '07:00', end: '08:00' }],
        sat: [{ start: '07:00', end: '08:00' }],
        sun: [{ start: '07:00', end: '08:00' }],
      },
    });
    const cfg = { ...defaultPlanConfig(), maxSessionsPerWeek: 4 };
    const plan = generatePlan(profile, cfg, '2026-10-12T10:00:00Z');
    const total = Object.values(plan.sessions).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(4);
  });

  it('uses running majority when primary goal is running', () => {
    const profile = makeProfile({
      primaryGoal: {
        id: 'g1',
        description: 'Bajar 5 km',
        discipline: 'running',
        target: '22:00',
      },
    });
    const plan = generatePlan(profile, defaultPlanConfig(), '2026-10-12T10:00:00Z');
    const disciplines = Object.values(plan.sessions).flat().map((s) => s.discipline);
    const running = disciplines.filter((d) => d === 'running').length;
    const strength = disciplines.filter((d) => d === 'strength').length;
    expect(running).toBeGreaterThanOrEqual(strength);
  });

  it('uses strength majority when primary goal is strength', () => {
    const profile = makeProfile({
      primaryGoal: {
        id: 'g1',
        description: 'Press banca 100kg',
        discipline: 'strength',
        target: '100kg',
      },
    });
    const plan = generatePlan(profile, defaultPlanConfig(), '2026-10-12T10:00:00Z');
    const disciplines = Object.values(plan.sessions).flat().map((s) => s.discipline);
    const running = disciplines.filter((d) => d === 'running').length;
    const strength = disciplines.filter((d) => d === 'strength').length;
    expect(strength).toBeGreaterThanOrEqual(running);
  });

  it('puts at least one session of each discipline when count allows', () => {
    const profile = makeProfile();
    const plan = generatePlan(profile, defaultPlanConfig(), '2026-10-12T10:00:00Z');
    const all = Object.values(plan.sessions).flat();
    const hasRunning = all.some((s) => s.discipline === 'running');
    const hasStrength = all.some((s) => s.discipline === 'strength');
    expect(hasRunning && hasStrength).toBe(true);
  });

  it('uses deterministic IDs when idFn is provided', () => {
    let counter = 0;
    const idFn = () => `id_${counter++}`;
    const profile = makeProfile();
    const p1 = generatePlan(profile, defaultPlanConfig(), '2026-10-12T10:00:00Z', idFn);
    const p2 = generatePlan(profile, defaultPlanConfig(), '2026-10-12T10:00:00Z', idFn);
    // Cada plan reserva un id para el Plan (counter++) y genera sesiones
    // adicionales. Como las sesiones no llevan id en este MVP, cada
    // generatePlan consume exactamente 1 id.
    expect(p1.id).toBe('id_0');
    expect(p2.id).toBe('id_1');
  });
});

describe('assignSessionsToDays constraints', () => {
  // Helper: crear sesión de fuerza simple.
  function strength(type: StrengthSession['type'] = 'upper'): StrengthSession {
    return {
      discipline: 'strength',
      type,
      exercises: [],
      estimatedDurationMinutes: 45,
    };
  }
  function run(): RunSession {
    return {
      discipline: 'running',
      type: 'easy',
      blocks: [{ type: 'steady', distanceMeters: 5000 }],
      estimatedDurationMinutes: 30,
    };
  }

  it('puts at most one session per day', () => {
    const sessions: Session[] = [strength(), strength(), strength(), strength()];
    const result = assignSessionsToDays(sessions, {
      ...emptyAvailability(),
      mon: [{ start: '07:00', end: '08:00' }],
      tue: [{ start: '07:00', end: '08:00' }],
      wed: [{ start: '07:00', end: '08:00' }],
      thu: [{ start: '07:00', end: '08:00' }],
    });
    for (const day of Object.keys(result) as Array<keyof typeof result>) {
      expect(result[day].length).toBeLessThanOrEqual(1);
    }
  });

  it('does not place strength on consecutive days', () => {
    // 4 sesiones de strength en 6 días disponibles. Solo 3 días alternos
    // (lun, wed, fri), por lo que el asignador recorta a 3 sesiones.
    // Las 3 que se colocan no pueden estar en días consecutivos por construcción.
    const sessions: Session[] = [
      strength('upper'),
      strength('lower'),
      strength('upper'),
      strength('lower'),
    ];
    const avail = {
      ...emptyAvailability(),
      mon: [{ start: '07:00', end: '08:00' }],
      tue: [{ start: '07:00', end: '08:00' }],
      wed: [{ start: '07:00', end: '08:00' }],
      thu: [{ start: '07:00', end: '08:00' }],
      fri: [{ start: '07:00', end: '08:00' }],
      sat: [{ start: '07:00', end: '08:00' }],
    };
    const result = assignSessionsToDays(sessions, avail);

    const strengthDays = Object.keys(result).filter(
      (day) => result[day as keyof typeof result].some((s) => s.discipline === 'strength'),
    );
    expect(strengthDays.length).toBe(3);

    // Verificar que ningún par de strengthDays está adyacente.
    const indices = strengthDays.map((day) => ALL_WEEK_DAYS.indexOf(day as WeekDay)).sort((a, b) => a - b);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i] - indices[i - 1]).toBeGreaterThanOrEqual(2);
    }
  });

  it('places 4 strength sessions on 7+ days without consecutive', () => {
    // 4 strength, 7 días: sí caben en días alternos.
    const sessions: Session[] = [
      strength('upper'),
      strength('lower'),
      strength('upper'),
      strength('lower'),
    ];
    const avail = {
      ...emptyAvailability(),
      mon: [{ start: '07:00', end: '08:00' }],
      tue: [{ start: '07:00', end: '08:00' }],
      wed: [{ start: '07:00', end: '08:00' }],
      thu: [{ start: '07:00', end: '08:00' }],
      fri: [{ start: '07:00', end: '08:00' }],
      sat: [{ start: '07:00', end: '08:00' }],
      sun: [{ start: '07:00', end: '08:00' }],
    };
    const result = assignSessionsToDays(sessions, avail);

    const strengthDays = Object.keys(result).filter(
      (day) => result[day as keyof typeof result].some((s) => s.discipline === 'strength'),
    );
    expect(strengthDays.length).toBe(4);
  });

  it('does not place running after intense strength (lower/full_body) when possible', () => {
    // 7 días disponibles, 1 strength lower, 1 run: el run puede evitar
    // el día siguiente a la strength, así que la restricción se cumple.
    const sessions: Session[] = [strength('lower'), run()];
    const avail = {
      ...emptyAvailability(),
      mon: [{ start: '07:00', end: '08:00' }],
      tue: [{ start: '07:00', end: '08:00' }],
      wed: [{ start: '07:00', end: '08:00' }],
      thu: [{ start: '07:00', end: '08:00' }],
      fri: [{ start: '07:00', end: '08:00' }],
      sat: [{ start: '07:00', end: '08:00' }],
      sun: [{ start: '07:00', end: '08:00' }],
    };
    const result = assignSessionsToDays(sessions, avail);

    // El día posterior a strength lower/full_body no debe tener running.
    const days = Object.keys(result) as Array<keyof typeof result>;
    for (let i = 0; i < days.length - 1; i++) {
      const prevHasIntense = result[days[i]].some(
        (s) => s.discipline === 'strength' && (s.type === 'lower' || s.type === 'full_body'),
      );
      const nextHasRun = result[days[i + 1]].some((s) => s.discipline === 'running');
      expect(prevHasIntense && nextHasRun).toBe(false);
    }
  });

  it('returns empty plan when no availability', () => {
    const sessions: Session[] = [strength(), run()];
    const result = assignSessionsToDays(sessions, emptyAvailability());
    const total = Object.values(result).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(0);
  });

  it('places strength sessions respecting the consecutive rule even under tight availability', () => {
    // Solo 1 día disponible con 3 strength: el motor coloca 1 (la primera),
    // las demás quedan fuera porque cualquier otra posición violaría la
    // regla de consecutivos. Esto es preferible a apilar strength en el
    // mismo día (que duplicaría carga sin recuperación).
    const sessions: Session[] = [strength('upper'), strength('lower'), strength('upper')];
    const avail = {
      ...emptyAvailability(),
      mon: [{ start: '07:00', end: '08:00' }],
    };
    const result = assignSessionsToDays(sessions, avail);
    const total = Object.values(result).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(1);
  });

  it('places all sessions of distinct disciplines when availability allows', () => {
    // 2 días disponibles, 2 sesiones de disciplinas distintas: ambas caben.
    const sessions: Session[] = [strength('upper'), run()];
    const avail = {
      ...emptyAvailability(),
      mon: [{ start: '07:00', end: '08:00' }],
      wed: [{ start: '07:00', end: '08:00' }],
    };
    const result = assignSessionsToDays(sessions, avail);
    const total = Object.values(result).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(2);
  });
});

describe('Plan shape', () => {
  it('produced plan has all required fields', () => {
    const profile = makeProfile();
    const plan: Plan = generatePlan(profile, defaultPlanConfig(), '2026-10-12T10:00:00Z');
    expect(plan.id).toBeTruthy();
    expect(plan.weekStart).toBe('2026-10-12');
    expect(plan.config).toBeDefined();
    expect(plan.createdAt).toBe('2026-10-12T10:00:00Z');
    expect(Object.keys(plan.sessions)).toHaveLength(7);
  });
});