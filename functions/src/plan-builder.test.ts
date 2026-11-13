import { describe, expect, it } from 'vitest';

import {
  assembleDraftPlan,
  GeneratedPlanOutput,
  mondayOfIso,
  PlanBriefInput,
} from './plan-builder';

const availability: Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', readonly unknown[]> = {
  mon: [{ start: '08:00', end: '09:00' }],
  tue: [{ start: '08:00', end: '09:00' }],
  wed: [{ start: '08:00', end: '09:00' }],
  thu: [{ start: '08:00', end: '09:00' }],
  fri: [{ start: '08:00', end: '09:00' }],
  sat: [{ start: '08:00', end: '09:00' }],
  sun: [{ start: '08:00', end: '09:00' }],
};

const brief: PlanBriefInput = {
  objective: { description: 'Correr un 10K en 50 minutos', discipline: 'running' },
  sessionsPerWeek: 3,
  experience: 'intermediate',
};

function output(partial: Partial<GeneratedPlanOutput> = {}): GeneratedPlanOutput {
  return {
    explanation: 'Plan aeróbico con fuerza de sostenimiento.',
    knownFacts: ['Objetivo: 10K en 50 min'],
    assumptions: [],
    warnings: [],
    config: { minSessionsPerWeek: 2, maxSessionsPerWeek: 3, targetSessionMinutes: 45 },
    sessions: {
      mon: [],
      tue: [{
        discipline: 'running',
        type: 'easy',
        blocks: [{ type: 'steady', distanceMeters: 5000, durationSeconds: null, paceSecondsPerKm: null, recoverySeconds: null, repetitions: null }],
        purpose: 'Tirada suave',
        estimatedDurationMinutes: 30,
      }],
      wed: [],
      thu: [{
        discipline: 'strength',
        type: 'lower',
        exercises: [{
          id: 'back_squat',
          name: 'Sentadilla trasera',
          muscleGroup: 'legs',
          sets: 4,
          reps: '6-8',
          targetWeightKg: 60,
          restSeconds: 150,
        }],
        purpose: 'Tren inferior',
        estimatedDurationMinutes: 45,
      }],
      fri: [],
      sat: [],
      sun: [],
    },
    ...partial,
  };
}

describe('mondayOfIso', () => {
  it('devuelve el lunes de la semana de la fecha dada', () => {
    expect(mondayOfIso('2026-10-16T10:00:00.000Z')).toBe('2026-10-12');
    expect(mondayOfIso('2026-10-12')).toBe('2026-10-12');
    // Domingo 18 → lunes 12.
    expect(mondayOfIso('2026-10-18')).toBe('2026-10-12');
  });
});

describe('assembleDraftPlan', () => {
  const input = {
    brief,
    profileAvailability: availability,
    profileExperience: 'intermediate',
    now: () => '2026-10-12T10:00:00.000Z',
    mondayOf: mondayOfIso,
  };

  it('compone un plan completo con id draft y weekStart del lunes', () => {
    const draft = assembleDraftPlan(output(), input);
    expect(draft.plan.id).toBe('draft');
    expect(draft.plan.weekStart).toBe('2026-10-12');
    expect(draft.plan.createdAt).toBe('2026-10-12T10:00:00.000Z');
    expect(draft.plan.config.maxSessionsPerWeek).toBe(3);
    expect(draft.plan.weeks).toHaveLength(1);
    expect(draft.plan.weeks[0].weekStart).toBe('2026-10-12');
    expect(draft.plan.weeks[0].sessions.tue).toHaveLength(1);
  });

  it('normaliza los campos opcionales nulos del modelo (purpose y bloques)', () => {
    const draft = assembleDraftPlan(output({
      sessions: {
        mon: [{
          discipline: 'running',
          type: 'easy',
          blocks: [{ type: 'steady', distanceMeters: 5000, durationSeconds: null, paceSecondsPerKm: null, recoverySeconds: null, repetitions: null }],
          purpose: null,
          estimatedDurationMinutes: 30,
        }],
        tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
      },
    }), input);
    const run = draft.plan.weeks[0].sessions.mon[0];
    expect(run).toEqual({
      discipline: 'running',
      type: 'easy',
      blocks: [{ type: 'steady', distanceMeters: 5000 }],
      estimatedDurationMinutes: 30,
    });
  });

  it('aclampa la config del modelo a límites razonables', () => {
    const draft = assembleDraftPlan(output({
      config: { minSessionsPerWeek: -5, maxSessionsPerWeek: 99, targetSessionMinutes: 1000 },
    }), input);
    expect(draft.plan.config).toEqual({
      minSessionsPerWeek: 0,
      maxSessionsPerWeek: 7,
      targetSessionMinutes: 300,
    });
  });

  it('rechaza sesiones en días sin disponibilidad del perfil', () => {
    const sundayEmpty = { ...availability, sun: [] };
    expect(() => assembleDraftPlan(output({
      sessions: {
        mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: output().sessions.tue,
      },
    }), { ...input, profileAvailability: sundayEmpty })).toThrow();
  });

  it('usa la disponibilidad del brief cuando viene del asistente', () => {
    // El perfil no tiene hueco el domingo, pero el usuario lo marcó en el asistente.
    const briefAvailability = { ...availability, sun: [{ start: '10:00', end: '11:00' }] };
    const draft = assembleDraftPlan(output({
      sessions: {
        mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: output().sessions.tue,
      },
    }), {
      ...input,
      brief: { ...brief, availability: briefAvailability } as PlanBriefInput,
      profileAvailability: { ...availability, sun: [] },
    });
    expect(draft.plan.weeks[0].sessions.sun).toHaveLength(1);
  });

  it('expande el bloque hasta la fecha objetivo del brief', () => {
    const draft = assembleDraftPlan(output(), {
      ...input,
      brief: {
        ...brief,
        objective: { ...brief.objective, targetDate: '2026-11-01' },
      } as PlanBriefInput,
    });
    expect(draft.plan.goalDate).toBe('2026-11-01');
    // Del lunes 12 al domingo 1 de noviembre: 3 semanas.
    expect(draft.plan.weeks.map((week) => week.weekStart)).toEqual([
      '2026-10-12', '2026-10-19', '2026-10-26',
    ]);
  });

  it('cubre desde hoy hasta la fecha objetivo (caso 13 → 30 de noviembre)', () => {
    const runSession = output().sessions.tue;
    const draft = assembleDraftPlan(output({
      config: { minSessionsPerWeek: 2, maxSessionsPerWeek: 5, targetSessionMinutes: 45 },
      sessions: {
        mon: runSession,
        tue: runSession,
        wed: [],
        thu: output().sessions.thu,
        fri: [],
        sat: runSession,
        sun: [],
      },
    }), {
      ...input,
      now: () => '2026-11-13T10:00:00.000Z',
      brief: {
        ...brief,
        objective: { ...brief.objective, targetDate: '2026-11-30' },
      } as PlanBriefInput,
    });
    // Del bloque salen las semanas del 9, 16, 23 y 30 de noviembre.
    expect(draft.plan.weeks.map((week) => week.weekStart)).toEqual([
      '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30',
    ]);
    // Hoy es viernes 13: lunes, martes y jueves ya pasaron y no aparecen.
    expect(draft.plan.weeks[0].sessions.mon).toEqual([]);
    expect(draft.plan.weeks[0].sessions.tue).toEqual([]);
    expect(draft.plan.weeks[0].sessions.thu).toEqual([]);
    expect(draft.plan.weeks[0].sessions.sat).toHaveLength(1);
    // La semana objetivo termina el día del objetivo (lunes 30).
    expect(draft.plan.weeks[3].sessions.mon).toHaveLength(1);
    expect(draft.plan.weeks[3].sessions.tue).toEqual([]);
    expect(draft.plan.weeks[3].sessions.sat).toEqual([]);
  });

  it('ignora la fecha objetivo si ya pasó y recorta los días pasados', () => {
    const runSession = output().sessions.tue;
    const draft = assembleDraftPlan(output({
      config: { minSessionsPerWeek: 2, maxSessionsPerWeek: 5, targetSessionMinutes: 45 },
      sessions: {
        mon: [], tue: runSession, wed: [], thu: [], fri: [], sat: runSession, sun: [],
      },
    }), {
      ...input,
      now: () => '2026-10-16T10:00:00.000Z',
      brief: {
        ...brief,
        objective: { ...brief.objective, targetDate: '2026-10-10' },
      } as PlanBriefInput,
    });
    expect(draft.plan.goalDate).toBeUndefined();
    expect(draft.plan.weeks).toHaveLength(1);
    // Hoy es viernes 16: la semana en curso solo conserva lo pendiente.
    expect(draft.plan.weeks[0].sessions.tue).toEqual([]);
    expect(draft.plan.weeks[0].sessions.sat).toHaveLength(1);
  });

  it('extiende el horizonte si al recortar los días pasados no queda nada', () => {
    // Viernes 16, plantilla solo con sesiones de martes y jueves: la
    // semana en curso queda vacía y el bloque se extiende una semana más.
    const draft = assembleDraftPlan(output(), {
      ...input,
      now: () => '2026-10-16T10:00:00.000Z',
    });
    expect(draft.plan.weeks).toHaveLength(2);
    expect(draft.plan.weeks[0].sessions.tue).toEqual([]);
    expect(draft.plan.weeks[1].sessions.tue).toHaveLength(1);
  });

  it('devuelve las suposiciones y añade nota si falta experiencia', () => {
    const draft = assembleDraftPlan(output({
      assumptions: ['Ritmos estimados'],
    }), { ...input, profileExperience: null, brief: { ...brief, experience: null } as PlanBriefInput });
    expect(draft.assumptions.some((a) => a.includes('experiencia'))).toBe(true);
    expect(draft.assumptions).toContain('Ritmos estimados');
  });
});
