import { describe, expect, it } from 'vitest';

import {
  ALL_EQUIPMENT,
  ALL_WEEK_DAYS,
  Profile,
  ProfileValidationError,
  createProfile,
  emptyAvailability,
  emptyEquipment,
  emptyRestrictions,
  validateProfile,
} from '@/domain/profile';

function makeValidProfile(): Profile {
  return {
    name: 'Test',
    age: 30,
    experience: 'intermediate',
    primaryGoal: {
      id: 'g1',
      description: 'Bajar 5 km a 22 min',
      discipline: 'running',
      target: '22:00',
      targetDate: '2027-06-01',
    },
    secondaryGoals: [
      {
        id: 'g2',
        description: 'Dominadas con lastre 10kg',
        discipline: 'strength',
        target: '5 reps',
      },
    ],
    availability: {
      ...emptyAvailability(),
      mon: [{ start: '07:00', end: '08:00' }],
      wed: [{ start: '19:00', end: '20:00' }],
    },
    equipment: {
      ...emptyEquipment(),
      dumbbells: true,
      barbell: true,
    },
    restrictions: { injuries: [], notes: '' },
  };
}

describe('validators', () => {
  it('accepts a valid profile', () => {
    expect(() => validateProfile(makeValidProfile())).not.toThrow();
    expect(() => createProfile(makeValidProfile())).not.toThrow();
  });

  it('rejects empty description in primary goal', () => {
    const profile = makeValidProfile();
    profile.primaryGoal = { ...profile.primaryGoal, description: '   ' };
    expect(() => validateProfile(profile)).toThrowError(ProfileValidationError);
  });

  it('rejects too-long description in primary goal', () => {
    const profile = makeValidProfile();
    profile.primaryGoal = { ...profile.primaryGoal, description: 'a'.repeat(281) };
    expect(() => validateProfile(profile)).toThrowError(/too long/);
  });

  it('rejects unknown discipline', () => {
    const profile = makeValidProfile();
    profile.primaryGoal = {
      ...profile.primaryGoal,
      // @ts-expect-error: comprobando runtime
      discipline: 'cycling',
    };
    expect(() => validateProfile(profile)).toThrowError(/discipline/);
  });

  it('rejects invalid time slot (start >= end)', () => {
    const profile = makeValidProfile();
    profile.availability = {
      ...emptyAvailability(),
      mon: [{ start: '08:00', end: '07:00' }],
    };
    expect(() => validateProfile(profile)).toThrowError(/Availability/);
  });

  it('rejects invalid time format', () => {
    const profile = makeValidProfile();
    profile.availability = {
      ...emptyAvailability(),
      mon: [{ start: '8am', end: '9am' }],
    };
    expect(() => validateProfile(profile)).toThrowError(/Availability/);
  });

  it('accepts empty availability for all days', () => {
    const profile = makeValidProfile();
    profile.availability = emptyAvailability();
    expect(() => validateProfile(profile)).not.toThrow();
  });

  it('rejects equipment with unknown keys', () => {
    const profile = makeValidProfile();
    profile.equipment = {
      ...profile.equipment,
      // @ts-expect-error: comprobando runtime
      spaceship: true,
    };
    expect(() => validateProfile(profile)).toThrowError(/Equipment/);
  });

  it('rejects equipment missing required keys', () => {
    const base = makeValidProfile();
    const partial = { dumbbells: true };
    expect(() =>
      validateProfile({
        ...base,
        equipment: partial as unknown as typeof base.equipment,
      }),
    ).toThrowError(/Equipment/);
  });

  it('accepts all equipment false', () => {
    const profile = makeValidProfile();
    profile.equipment = emptyEquipment();
    expect(() => validateProfile(profile)).not.toThrow();
  });

  it('rejects too many secondary goals', () => {
    const profile = makeValidProfile();
    profile.secondaryGoals = Array.from({ length: 11 }, (_, i) => ({
      id: `g${i}`,
      description: `goal ${i}`,
      discipline: 'strength' as const,
      target: 'x',
    }));
    expect(() => validateProfile(profile)).toThrowError(/max 10/);
  });

  it('rejects invalid age', () => {
    const profile = makeValidProfile();
    profile.age = 200;
    expect(() => validateProfile(profile)).toThrowError(/Age/);
  });

  it('rejects invalid experience level', () => {
    const base = makeValidProfile();
    expect(() =>
      validateProfile({
        ...base,
        experience: 'expert' as unknown as typeof base.experience,
      }),
    ).toThrowError(/Experience/);
  });

  it('accepts profile without optional name/age', () => {
    const profile = makeValidProfile();
    delete profile.name;
    delete profile.age;
    expect(() => validateProfile(profile)).not.toThrow();
  });

  it('rejects targetDate in wrong format', () => {
    const profile = makeValidProfile();
    profile.primaryGoal = { ...profile.primaryGoal, targetDate: '01/06/2027' };
    expect(() => validateProfile(profile)).toThrowError(/targetDate/);
  });
});

describe('helpers', () => {
  it('emptyAvailability returns all days with empty arrays', () => {
    const e = emptyAvailability();
    for (const day of ALL_WEEK_DAYS) {
      expect(e[day]).toEqual([]);
    }
  });

  it('emptyEquipment returns all equipment ids as false', () => {
    const e = emptyEquipment();
    for (const id of ALL_EQUIPMENT) {
      expect(e[id]).toBe(false);
    }
  });

  it('emptyRestrictions returns empty shape', () => {
    const r = emptyRestrictions();
    expect(r.injuries).toEqual([]);
    expect(r.notes).toBe('');
  });
});