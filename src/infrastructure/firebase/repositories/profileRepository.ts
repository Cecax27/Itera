// Adaptador del repositorio de perfil a Firestore.
//
// Regla de arquitectura: la app importa este módulo a través de su index,
// pero el dominio no sabe que existe Firebase detrás.
//
// Estructura en Firestore:
//   users/{userId}/profile  (documento único)
//
// La colección `users/{userId}/profile` se eligió en vez de `profiles/{userId}`
// porque agrupa todo lo del usuario bajo un mismo nodo y simplifica las
// reglas de seguridad (una sola regla "solo el dueño accede a users/{uid}/*").

import { doc, getDoc, setDoc } from 'firebase/firestore';

import {
  Profile,
  ProfileRepository,
  validateProfile,
} from '@/domain/profile';

import { getDbInstance } from '../client';

function profileDocRef(userId: string) {
  return doc(getDbInstance(), 'users', userId, 'profile', 'main');
}

export const firestoreProfileRepository: ProfileRepository = {
  async get(userId: string): Promise<Profile | null> {
    const snap = await getDoc(profileDocRef(userId));
    if (!snap.exists()) return null;
    const data = snap.data();

    // Validamos lo que llega de Firestore por si el documento fue escrito
    // por una versión anterior con un esquema distinto. Si falla, devolvemos
    // null y el caller puede decidir cómo manejarlo (en la UI mostraremos
    // un error y ofreceremos rehacer el onboarding).
    try {
      validateProfile(data as Profile);
    } catch {
      return null;
    }
    return data as Profile;
  },

  async save(userId: string, profile: Profile): Promise<void> {
    // Validamos antes de escribir para no guardar documentos inválidos.
    validateProfile(profile);
    await setDoc(profileDocRef(userId), profile);
  },
};