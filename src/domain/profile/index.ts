// Punto de entrada público del módulo de perfil del dominio.
// El resto de la app solo debería importar desde aquí.

export type {
  ExperienceLevel,
  WeekDay,
  TimeSlot,
  WeeklyAvailability,
  EquipmentId,
  Equipment,
  Goal,
  Restrictions,
  Profile,
} from './profile';

export { ALL_WEEK_DAYS, ALL_EQUIPMENT, ProfileValidationError } from './profile';

export {
  validateProfile,
  createProfile,
  emptyAvailability,
  emptyEquipment,
  emptyRestrictions,
} from './validators';

export type { ProfileRepository } from './repository';