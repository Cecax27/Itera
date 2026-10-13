// Validadores y factories para las entidades de perfil.
// Reglas:
// - Las funciones puras son testeables sin mocks.
// - Devuelven ProfileValidationError con un campo específico cuando falla.
// - createProfile aplica todos los validadores; construyeProfile (sin 'create')
//   es para uso interno cuando ya validamos por separado.

import {
  ALL_EQUIPMENT,
  ALL_WEEK_DAYS,
  Equipment,
  Goal,
  Profile,
  ProfileValidationError,
  Restrictions,
  TimeSlot,
  WeeklyAvailability,
} from './profile';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function isValidTimeSlot(slot: TimeSlot): boolean {
  if (!isValidTime(slot.start) || !isValidTime(slot.end)) return false;
  return timeToMinutes(slot.start) < timeToMinutes(slot.end);
}

function isValidEquipment(equipment: Equipment): boolean {
  // Solo se permiten los IDs conocidos; cualquier clave extra se rechaza.
  const known = new Set<string>(ALL_EQUIPMENT);
  const keys = Object.keys(equipment);
  if (keys.length !== ALL_EQUIPMENT.length) return false;
  return keys.every((k) => known.has(k));
}

function isValidWeeklyAvailability(avail: WeeklyAvailability): boolean {
  for (const day of ALL_WEEK_DAYS) {
    const slots = avail[day];
    if (!Array.isArray(slots)) return false;
    for (const slot of slots) {
      if (!isValidTimeSlot(slot)) return false;
    }
  }
  return true;
}

function isValidGoal(goal: Goal, field: string): void {
  if (!goal.id || typeof goal.id !== 'string') {
    throw new ProfileValidationError('Goal id is required', field);
  }
  if (!goal.description || goal.description.trim().length === 0) {
    throw new ProfileValidationError('Goal description is required', field);
  }
  if (goal.description.length > 280) {
    throw new ProfileValidationError('Goal description is too long (max 280)', field);
  }
  if (goal.discipline !== 'running' && goal.discipline !== 'strength') {
    throw new ProfileValidationError('Goal discipline must be running or strength', field);
  }
  if (!goal.target || goal.target.trim().length === 0) {
    throw new ProfileValidationError('Goal target is required', field);
  }
  if (goal.targetDate !== undefined && !ISO_DATE_RE.test(goal.targetDate)) {
    throw new ProfileValidationError('Goal targetDate must be YYYY-MM-DD', field);
  }
}

export function validateProfile(profile: Profile): void {
  // Esta función nunca devuelve un valor: si todo está correcto, cae al
  // final sin retornar nada (void). Si algo falla, lanza ProfileValidationError.
  // El llamador decide qué hacer: createProfile confía en void; el repositorio
  // lo envuelve en try/catch.
  if (profile.name !== undefined && (typeof profile.name !== 'string' || profile.name.length > 80)) {
    throw new ProfileValidationError('Name must be a string up to 80 chars', 'name');
  }

  if (profile.age !== undefined) {
    if (!Number.isInteger(profile.age) || profile.age < 10 || profile.age > 100) {
      throw new ProfileValidationError('Age must be an integer between 10 and 100', 'age');
    }
  }

  const validExperience = profile.experience === 'beginner'
    || profile.experience === 'intermediate'
    || profile.experience === 'advanced';
  if (!validExperience) {
    throw new ProfileValidationError('Experience must be beginner, intermediate or advanced', 'experience');
  }

  isValidGoal(profile.primaryGoal, 'primaryGoal');

  if (!Array.isArray(profile.secondaryGoals)) {
    throw new ProfileValidationError('Secondary goals must be an array', 'secondaryGoals');
  }
  if (profile.secondaryGoals.length > 10) {
    throw new ProfileValidationError('Secondary goals max 10', 'secondaryGoals');
  }
  profile.secondaryGoals.forEach((g, i) => isValidGoal(g, `secondaryGoals[${i}]`));

  if (!isValidWeeklyAvailability(profile.availability)) {
    throw new ProfileValidationError('Availability is invalid (wrong day, time or slot)', 'availability');
  }

  if (!isValidEquipment(profile.equipment)) {
    throw new ProfileValidationError('Equipment has unknown keys or missing required keys', 'equipment');
  }

  if (!Array.isArray(profile.restrictions.injuries)) {
    throw new ProfileValidationError('Injuries must be an array', 'restrictions.injuries');
  }
  for (const injury of profile.restrictions.injuries) {
    if (typeof injury !== 'string' || injury.length > 200) {
      throw new ProfileValidationError('Each injury must be a string up to 200 chars', 'restrictions.injuries');
    }
  }
  if (typeof profile.restrictions.notes !== 'string' || profile.restrictions.notes.length > 1000) {
    throw new ProfileValidationError('Restrictions notes must be a string up to 1000 chars', 'restrictions.notes');
  }
}

/**
 * Factory segura: valida y devuelve un Profile. Lanza ProfileValidationError
 * si algo falla.
 */
export function createProfile(profile: Profile): Profile {
  validateProfile(profile);
  return profile;
}

/**
 * Helper para crear una disponibilidad semanal vacía (sin franjas).
 * Útil para empezar el onboarding.
 */
export function emptyAvailability(): WeeklyAvailability {
  return {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  };
}

/**
 * Helper para crear un mapa de equipamiento con todos los valores en false.
 */
export function emptyEquipment(): Equipment {
  const result: Equipment = {
    dumbbells: false,
    barbell: false,
    kettlebell: false,
    resistance_bands: false,
    pull_up_bar: false,
    bench: false,
    squat_rack: false,
    treadmill: false,
    outdoor_running_route: false,
    stationary_bike: false,
  };
  return result;
}

/**
 * Helper para crear restricciones vacías.
 */
export function emptyRestrictions(): Restrictions {
  return { injuries: [], notes: '' };
}