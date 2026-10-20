import { describe, expect, it } from 'vitest';

import { emptyAvailability, emptyEquipment } from '@/domain/profile';

import { PlanBrief, PLAN_FOCUS_OPTIONS, planBriefFieldErrors, validatePlanBrief } from './brief';

function validBrief(overrides: Partial<PlanBrief> = {}): PlanBrief {
  const availability = emptyAvailability();
  availability.mon = [{ start: '08:00', end: '09:00' }];
  availability.wed = [{ start: '18:00', end: '19:30' }];
  return {
    objective: {
      id: 'primary',
      description: 'Correr un 10K en 50 minutos',
      discipline: 'running',
      target: '50:00 en 10 km',
    },
    sessionsPerWeek: 2,
    availability,
    equipment: emptyEquipment(),
    experience: 'intermediate',
    focus: null,
    notes: '',
    ...overrides,
  };
}

describe('validatePlanBrief', () => {
  it('acepta un brief completo y válido', () => {
    expect(() => validatePlanBrief(validBrief())).not.toThrow();
  });

  it('exige una descripción de objetivo', () => {
    expect(() => validatePlanBrief(validBrief({
      objective: { id: 'primary', description: '   ', discipline: 'running', target: '' },
    }))).toThrow();
  });

  it('valida el rango de días por semana (1-7)', () => {
    expect(() => validatePlanBrief(validBrief({ sessionsPerWeek: 0 }))).toThrow();
    expect(() => validatePlanBrief(validBrief({ sessionsPerWeek: 8 }))).toThrow();
    // 7 días posibles: rellenamos la disponibilidad con un día por jornada.
    const availability = emptyAvailability();
    for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const) {
      availability[day] = [{ start: '08:00', end: '09:00' }];
    }
    expect(() => validatePlanBrief(validBrief({ sessionsPerWeek: 7, availability }))).not.toThrow();
  });

  it('no permite más días por semana que la disponibilidad declarada', () => {
    expect(() => validatePlanBrief(validBrief({ sessionsPerWeek: 3 }))).toThrow();
  });

  it('exige al menos un día con franja disponible', () => {
    expect(() => validatePlanBrief(validBrief({
      availability: emptyAvailability(),
    }))).toThrow();
  });

  it('valida el nivel de experiencia', () => {
    expect(() => validatePlanBrief(validBrief({ experience: 'expert' as never }))).toThrow();
  });

  it('valida el reparto de foco', () => {
    for (const focus of PLAN_FOCUS_OPTIONS) {
      expect(() => validatePlanBrief(validBrief({ focus: focus.value }))).not.toThrow();
    }
    expect(() => validatePlanBrief(validBrief({ focus: 'solo_yoga' as never }))).toThrow();
  });

  it('limita la longitud de las notas', () => {
    expect(() => validatePlanBrief(validBrief({ notes: 'x'.repeat(2001) }))).toThrow();
    expect(() => validatePlanBrief(validBrief({ notes: 'x'.repeat(2000) }))).not.toThrow();
  });
});

describe('planBriefFieldErrors', () => {
  it('no devuelve errores con un brief válido', () => {
    expect(planBriefFieldErrors(validBrief())).toEqual({});
  });

  it('señala el campo concreto de cada problema', () => {
    const errors = planBriefFieldErrors(validBrief({
      objective: { id: 'primary', description: '   ', discipline: 'running', target: '' },
      sessionsPerWeek: 9,
    }));
    expect(errors['objective.description']).toBeTruthy();
    expect(errors.sessionsPerWeek).toBeTruthy();
    expect(Object.keys(errors)).toHaveLength(2);
  });

  it('rechaza franjas con hora de fin anterior a la de inicio', () => {
    const availability = emptyAvailability();
    availability.mon = [{ start: '08:00', end: '09:00' }];
    availability.wed = [{ start: '18:00', end: '07:00' }];
    const errors = planBriefFieldErrors(validBrief({ availability }));
    expect(errors.availability).toBeTruthy();
    expect(() => validatePlanBrief(validBrief({ availability }))).toThrow(/después de empezar/);
  });

  it('rechaza franjas con horas mal formadas', () => {
    const availability = emptyAvailability();
    availability.mon = [{ start: '08:00', end: '09:00' }];
    availability.tue = [{ start: '8am', end: '09:00' }];
    expect(planBriefFieldErrors(validBrief({ availability })).availability).toBeTruthy();
  });

  it('acepta franjas coherentes', () => {
    const availability = emptyAvailability();
    availability.fri = [{ start: '23:00', end: '23:59' }];
    availability.sat = [{ start: '00:00', end: '01:00' }];
    expect(planBriefFieldErrors(validBrief({ availability }))).toEqual({});
  });

  it('validatePlanBrief lanza el primer error en el orden de validación', () => {
    // Descripción vacía + 0 días disponibles: el primer error es del objetivo.
    try {
      validatePlanBrief(validBrief({
        objective: { id: 'primary', description: '', discipline: 'running', target: '' },
        availability: emptyAvailability(),
      }));
      expect.unreachable('debía lanzar');
    } catch (err) {
      expect((err as Error).message).toBe('El objetivo necesita una descripción.');
    }
  });
});
