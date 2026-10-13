// Punto de entrada público del módulo de infraestructura Firebase.
// El resto de la app solo debería importar desde aquí.

export { getAuthInstance, getDbInstance } from './client';
export { firebaseConfig } from './config';