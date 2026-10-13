// Lee las claves públicas de Firebase desde variables de entorno con prefijo
// EXPO_PUBLIC_ (Expo las expone al bundle del cliente de forma segura).
//
// En desarrollo local: copia .env.example a .env y rellena los valores.
// Las claves con prefijo EXPO_PUBLIC_ son visibles en el bundle final, por
// eso solo ponemos aquí identificadores públicos (apiKey, projectId, etc.),
// nunca secretos del servidor.

import { FirebaseOptions } from 'firebase/app';

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

function assertConfigIsComplete(config: FirebaseOptions): void {
  const missing = Object.entries(config)
    .filter(([, value]) => !value || value.length === 0)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de Firebase en .env: ${missing.join(', ')}. ` +
        'Copia .env.example a .env y rellena los valores desde la consola de Firebase.',
    );
  }
}

assertConfigIsComplete(firebaseConfig);

export { firebaseConfig };