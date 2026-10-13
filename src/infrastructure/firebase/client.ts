// Singleton de la app Firebase y de los servicios principales.
//
// El resto de la app NO debe importar directamente de 'firebase/app' ni de
// 'firebase/firestore' ni de 'firebase/auth'. Debe usar estos getters:
//   - getAuthInstance()
//   - getDbInstance()
//
// Esto mantiene el principio de arquitectura: si mañana cambiamos el
// proveedor de backend, solo tocamos este módulo.

import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, getAuth, initializeAuth, Persistence } from 'firebase/auth';
import { connectFirestoreEmulator, Firestore, getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { firebaseConfig } from './config';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

// Si EXPO_PUBLIC_USE_FIREBASE_EMULATOR es 'true', los singletons se conectan
// a los emuladores locales en lugar del proyecto real.
const USE_EMULATOR = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true';
const EMULATOR_HOST = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST ?? '127.0.0.1';
const AUTH_EMULATOR_PORT = Number(process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT ?? 9099);
const FIRESTORE_EMULATOR_PORT = Number(process.env.EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT ?? 8080);

function getApp(): FirebaseApp {
  if (!app) {
    // Evita reinicializar si Expo hace reload en desarrollo.
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return app;
}

// Adaptador mínimo de AsyncStorage a la interfaz Persistence que espera
// Firebase Auth. Implementa solo los métodos públicos del contrato.
// Referencias:
//   - https://firebase.google.com/docs/auth/web/auth-state-persistence
//   - firebase/auth/src/core/persistence/Persistence.ts (interfaz interna)
class ReactNativeAsyncStoragePersistence implements Persistence {
  type: 'LOCAL' = 'LOCAL';

  async get(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  }

  async set(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  }

  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }

  // Firebase llama a esta función al arrancar para decidir si la persistencia
  // es aplicable. En RN siempre devolvemos true (AsyncStorage siempre está).
  shouldListen(): boolean {
    return true;
  }

  // No usamos reactividad basada en eventos de almacenamiento.
  addListener(): void {
    // no-op
  }

  removeListener(): void {
    // no-op
  }
}

export function getAuthInstance(): Auth {
  if (!auth) {
    const a = getApp();
    try {
      auth = initializeAuth(a, {
        persistence: new ReactNativeAsyncStoragePersistence(),
      });
    } catch {
      // Si initializeAuth falla (por ejemplo en reload de Fast Refresh),
      // recurrimos a getAuth sin persistencia explícita. Firebase usará
      // localStorage, que en RN no funciona fuera del bundle web. La
      // sesión no persistirá entre cierres de app; es un fallback, no el
      // comportamiento deseado.
      auth = getAuth(a);
    }

    if (USE_EMULATOR) {
      // Conectar al emulador de Auth solo después de inicializar para
      // evitar dobles conexiones tras Fast Refresh.
      connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`, {
        disableWarnings: true,
      });
    }
  }
  return auth;
}

export function getDbInstance(): Firestore {
  if (!db) {
    db = getFirestore(getApp());

    if (USE_EMULATOR) {
      connectFirestoreEmulator(db, EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
    }
  }
  return db;
}