import { describe, expect, it } from 'vitest';

import { editPlanSession, movePlanSession, removePlanSession, replacePlanSession } from './edits';
import { Plan, Session, StrengthSession } from './plan';
import { PlanningValidationError } from './plan';
import { WeekDay } from '@/domain/profile';

const FIRST_WEEK_START = '2026-10-12';
const SECOND_WEEK_START = '2026-10-19';

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

function weekWith(weekStart: string, ...schedule: [WeekDay, Session[]][]): Plan {
  const sessions: Record<WeekDay, Session[]> = {
    mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
  };
  for (const [day, list] of schedule) sessions[day] = list;
  return {
    id: 'current',
    weekStart,
    config: { minSessionsPerWeek: 1, maxSessionsPerWeek: 5, targetSessionMinutes: 45 },
    weeks: [{ weekStart, sessions }],
    createdAt: `${weekStart}T08:00:00.000Z`,
  };
}

const planWith = (...schedule: [WeekDay, Session[]][]) => weekWith(FIRST_WEEK_START, ...schedule);

describe('editPlanSession', () => {
  it('reemplaza el contenido de una sesión en su sitio', () => {
    const plan = planWith(['mon', [runSession]]);
    const editedSession = { ...runSession, estimatedDurationMinutes: 45 };
    const next = replacePlanSession(plan, FIRST_WEEK_START, 'mon', 0, editedSession);

    expect(next.weeks[0].sessions.mon[0]).toEqual(editedSession);
    // No muta el plan original.
    expect(plan.weeks[0].sessions.mon[0]).toEqual(runSession);
  });

  it('mueve una sesión a un día libre sin dejarla en el origen', () => {
    const plan = planWith(['mon', [runSession]]);
    const next = movePlanSession(plan, FIRST_WEEK_START, 'mon', 0, 'wed');

    expect(next.weeks[0].sessions.mon).toEqual([]);
    expect(next.weeks[0].sessions.wed).toEqual([runSession]);
  });

  it('mueve y reemplaza en una sola operación', () => {
    const plan = planWith(['mon', [runSession]]);
    const next = editPlanSession(plan, FIRST_WEEK_START, 'mon', 0, { toDay: 'sat', session: strengthSession });

    expect(next.weeks[0].sessions.mon).toEqual([]);
    expect(next.weeks[0].sessions.sat).toEqual([strengthSession]);
  });

  it('elimina la sesión cuando no hay cambio', () => {
    const plan = planWith(['tue', [strengthSession]]);
    const next = removePlanSession(plan, FIRST_WEEK_START, 'tue', 0);

    expect(next.weeks[0].sessions.tue).toEqual([]);
  });

  it('rechaza si la posición no existe', () => {
    const plan = planWith(['mon', [runSession]]);
    expect(() => editPlanSession(plan, FIRST_WEEK_START, 'mon', 3, {})).toThrow(PlanningValidationError);
    expect(() => editPlanSession(plan, FIRST_WEEK_START, 'mon', -1, {})).toThrow(PlanningValidationError);
  });

  it('rechaza mover a un día ocupado', () => {
    const plan = planWith(['mon', [runSession]], ['wed', [strengthSession]]);
    expect(() => movePlanSession(plan, FIRST_WEEK_START, 'mon', 0, 'wed')).toThrow(PlanningValidationError);
  });

  it('rechaza una semana que no pertenece al bloque', () => {
    const plan = planWith(['mon', [runSession]]);
    expect(() => editPlanSession(plan, '2027-01-04', 'mon', 0, {})).toThrow(PlanningValidationError);
  });

  it('edita la semana indicada del bloque sin tocar las demás', () => {
    const first = planWith(['mon', [runSession]]);
    const second = weekWith(SECOND_WEEK_START, ['wed', [strengthSession]]);
    const block: Plan = { ...first, weeks: [first.weeks[0], second.weeks[0]] };

    const next = replacePlanSession(
      block,
      SECOND_WEEK_START,
      'wed',
      0,
      { ...strengthSession, estimatedDurationMinutes: 50 },
    );

    expect(next.weeks[1].sessions.wed[0].estimatedDurationMinutes).toBe(50);
    expect(next.weeks[0].sessions.mon).toEqual([runSession]);
    // El plan original permanece intacto.
    expect(block.weeks[1].sessions.wed[0].estimatedDurationMinutes).toBe(40);
  });
});
