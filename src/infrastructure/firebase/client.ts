// Singleton de la app Firebase y de los servicios principales.
//
// El resto de la app NO debe importar directamente de 'firebase/app' ni de
// 'firebase/firestore' ni de 'firebase/auth'. Debe usar estos getters:
//   - getAuthInstance()
//   - getDbInstance()
//   - signInDevAnonymously()

import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  connectAuthEmulator,
  getAuth,
  initializeAuth,
} from 'firebase/auth';
import { connectFirestoreEmulator, Firestore, getFirestore } from 'firebase/firestore';
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
// getReactNativePersistence solo existe en la build RN de @firebase/auth.
// Firebase 13 lo selecciona automáticamente cuando el bundler aplica la
// condición 'react-native' (vía exports). El import desde 'firebase/auth'
// resuelve al módulo correcto en build RN y a undefined en build web.
// @ts-expect-error: en build web no existe, en build RN sí.
import { getReactNativePersistence } from 'firebase/auth';

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

export function getAuthInstance(): Auth {
  if (!auth) {
    const a = getApp();
    try {
      // Persistencia correcta para Firebase 13 + AsyncStorage 3:
      //   - createAsyncStorage(namespace) crea un adaptador compatible.
      //   - getReactNativePersistence(storage) lo envuelve para Auth.
      // Esta es la receta oficial; las versiones anteriores de AsyncStorage
      // pasaban el módulo directamente y ya no funciona.
      const storage = createAsyncStorage('itera-auth');
      auth = initializeAuth(a, {
        persistence: getReactNativePersistence(storage),
      });
    } catch {
      // Si initializeAuth falla (por ejemplo en reload de Fast Refresh o
      // porque getReactNativePersistence no está disponible en el bundler
      // actual), recurrimos a getAuth sin persistencia explícita. Firebase
      // usará localStorage, que en RN no funciona fuera del bundle web. La
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