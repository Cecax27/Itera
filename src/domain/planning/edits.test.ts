import { describe, expect, it } from 'vitest';

import { editPlanSession, movePlanSession, removePlanSession, replacePlanSession } from './edits';
import { Plan, Session, StrengthSession } from './plan';
import { PlanningValidationError } from './plan';

const runSession: Session = {
  discipline: 'running',
  type: 'easy' as const,
  blocks: [{ type: 'steady' as const, distanceMeters: 5000 }],
  estimatedDurationMinutes: 30,
};

const strengthSession: StrengthSession = {
  discipline: 'strength',
  type: 'lower' as const,
  exercises: [
    {
      id: 'back_squat',
      name: 'Sentadilla trasera',
      muscleGroup: 'legs' as const,
      sets: 4,
      reps: '6-8',
      targetWeightKg: 60,
      restSeconds: 150,
    },
  ],
  estimatedDurationMinutes: 40,
};

function planWith(...schedule: [keyof Plan['sessions'], Session[]][]): Plan {
  const sessions: Record<keyof Plan['sessions'], Session[]> = {
    mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
  };
  for (const [day, list] of schedule) sessions[day] = list;
  return {
    id: 'current',
    weekStart: '2026-10-12',
    config: { minSessionsPerWeek: 1, maxSessionsPerWeek: 5, targetSessionMinutes: 45 },
    sessions,
    createdAt: '2026-10-12T08:00:00.000Z',
  };
}

describe('editPlanSession', () => {
  it('reemplaza el contenido de una sesión en su sitio', () => {
    const plan = planWith(['mon', [runSession]]);
    const editedSession = { ...runSession, estimatedDurationMinutes: 45 };
    const next = replacePlanSession(plan, 'mon', 0, editedSession);

    expect(next.sessions.mon[0]).toEqual(editedSession);
    // No muta el plan original.
    expect(plan.sessions.mon[0]).toEqual(runSession);
  });

  it('mueve una sesión a un día libre sin dejarla en el origen', () => {
    const plan = planWith(['mon', [runSession]]);
    const next = movePlanSession(plan, 'mon', 0, 'wed');

    expect(next.sessions.mon).toEqual([]);
    expect(next.sessions.wed).toEqual([runSession]);
  });

  it('mueve y reemplaza en una sola operación', () => {
    const plan = planWith(['mon', [runSession]]);
    const next = editPlanSession(plan, 'mon', 0, { toDay: 'sat', session: strengthSession });

    expect(next.sessions.mon).toEqual([]);
    expect(next.sessions.sat).toEqual([strengthSession]);
  });

  it('elimina la sesión cuando no hay cambio', () => {
    const plan = planWith(['tue', [strengthSession]]);
    const next = removePlanSession(plan, 'tue', 0);

    expect(next.sessions.tue).toEqual([]);
  });

  it('rechaza si la posición no existe', () => {
    const plan = planWith(['mon', [runSession]]);
    expect(() => editPlanSession(plan, 'mon', 3, {})).toThrow(PlanningValidationError);
    expect(() => editPlanSession(plan, 'mon', -1, {})).toThrow(PlanningValidationError);
  });

  it('rechaza mover a un día ocupado', () => {
    const plan = planWith(['mon', [runSession]], ['wed', [strengthSession]]);
    expect(() => movePlanSession(plan, 'mon', 0, 'wed')).toThrow(PlanningValidationError);
  });
});
