// Interfaz del repositorio de perfil.
// Vive en el dominio para que la lógica de negocio no dependa de Firebase.
// La implementación concreta vive en src/infrastructure/.

import { Profile } from './profile';

/**
 * Repositorio de perfiles. Interfaz mínima para empezar:
 * - get: carga un perfil por userId (devuelve null si no existe).
 * - save: guarda o reemplaza el perfil completo de un userId.
 *
 * Decisiones pendientes para el futuro:
 * - ¿partial save (updateProfile)? Ahora guardamos el perfil entero.
 * - ¿subscribe a cambios en tiempo real? Por ahora get puntual.
 * - ¿soft delete? No hay eliminación en el MVP.
 */
export interface ProfileRepository {
  get(userId: string): Promise<Profile | null>;
  save(userId: string, profile: Profile): Promise<void>;
}