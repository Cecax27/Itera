# Compilación local de la APK de Android

Guía para generar una APK instalable de Itera en local, sin usar EAS Build ni
servicios en la nube. Proyecto: Expo SDK 57, React Native 0.86, nueva arquitectura
activada (`newArchEnabled: true`).

---

## 1. Estado del proyecto (auditado el 2026-11-12)

### Lo que ya está listo

| Elemento | Estado | Detalle |
|----------|--------|---------|
| Configuración Expo | ✅ | `app.json` define `android.package = com.bitabit.itera`, iconos adaptativos y plugin `expo-secure-store` |
| Firebase | ✅ | Se usa el **Firebase JS SDK**, así que **no** hace falta `google-services.json` ni plugin nativo de Google |
| Java | ✅ | Java 21 instalado (suficiente para RN 0.86 y su Gradle) |
| Android SDK | ✅ | `ANDROID_HOME=/home/carlos/Android/Sdk` con plataformas 35/36, build-tools 35–36, NDK 27.1 y licencias aceptadas |
| Punto de entrada | ✅ | `main: index.ts` en `package.json` registra `src/App` |

### Bloqueos que hay que resolver antes de compilar

1. **`node_modules` está en estado inconsistente.** Existe un almacén `.pnpm`
   con ~700 paquetes, pero faltan los enlaces raíz (`node_modules/expo`,
   `node_modules/.bin`…). La instalación se quedó a medias. Solución:
   reinstalar de cero (paso 2.1).
2. **Falta el archivo `.env`.** `src/infrastructure/firebase/config.ts` lanza un
   error en tiempo de arranque si faltan las variables `EXPO_PUBLIC_FIREBASE_*`.
   El APK compilaría igual, pero la app crashearía al abrir. Solución: paso 2.2.
3. **No existe la carpeta `android/`.** Con Expo esto es normal (se genera con
   `prebuild`), pero hay que ejecutarlo antes de llamar a Gradle (paso 3.1).

---

## 2. Preparación (una vez)

### 2.1. Reinstalar dependencias

```bash
cd ~/Documentos/Itera
rm -rf node_modules
npm install
```

> Este repo usa npm (hay `package-lock.json`). Si antes se instaló con pnpm y
> quedó a medias, esta limpieza lo arregla. Verifica que
> `ls node_modules/.bin | grep expo` devuelta algo.

### 2.2. Crear el `.env`

```bash
cp .env.example .env
```

Edita `.env` y copia los valores desde la consola de Firebase
(«Configuración del proyecto → Tus apps → Configuración del SDK», los de
`firebaseConfig`, **no** el `google-services.json`). Rellena al menos:

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

Deja `EXPO_PUBLIC_USE_FIREBASE_EMULATOR=false` para una APK que hable con el
proyecto real. **Importante:** el bundle de JS se genera en el paso 3.2, así que
el `.env` debe estar completo *antes* de compilar (las variables se incrustan en
ese momento; si cambias el `.env`, recompila).

> El `.env` está ignorado por `.gitignore`: es tu archivo local y no se commitea.

### 2.3. (Opcional) Comprobación de salud

```bash
npx expo-doctor
npm run typecheck
npm test
```

---

## 3. Compilar la APK

### 3.1. Generar el proyecto nativo Android

```bash
npx expo prebuild -p android
```

Esto crea la carpeta `android/` a partir de `app.json` (paquete, iconos,
adaptative icons, plugin de `expo-secure-store`). La carpeta `android/` está en
`.gitignore` y puede regenerarse cuando cambie la configuración nativa.

> Si ya existiera y quieres regenerarla desde cero:
> `npx expo prebuild -p android --clean`

### 3.2. Generar la APK

```bash
cd android
./gradlew assembleRelease
```

La APK queda en:

```
android/app/build/outputs/apk/release/app-release.apk
```

> **Sobre la firma:** por defecto, la plantilla de Expo firma la variante
> `release` con el debug keystore (`~/.android/debug.keystore`, se genera solo),
> así que la APK es instalable directamente. Es válido para pruebas y uso
> personal. Para distribuir de verdad (Play Store), define un keystore propio
> (ver apartado 5).

Otras variantes:

```bash
./gradlew assembleDebug     # APK de debug (más lenta en runtime, depurable)
```

### 3.3. Instalar en un dispositivo

Con el móvil conectado por USB (depuración USB activada) o un emulador corriendo:

```bash
~/Android/Sdk/platform-tools/adb install -r \
  android/app/build/outputs/apk/release/app-release.apk
```

Si `adb` no estuviera en el `PATH` (ahora no lo está), usa la ruta completa de
arriba o añade al `~/.bashrc`:

```bash
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```

---

## 4. Compilación con Metro en marcha (flujo de desarrollo)

Para iterar rápido sin regenerar el bundle cada vez:

```bash
npx expo run:android -v debug
```

Esto hace el `prebuild` (si falta), compila, instala y arranca la app conectada
a Metro; los cambios de JS recargan en caliente. No es el flujo para producir la
APK final, pero sí el cómodo para probar.

---

## 5. Firma con keystore propio (opcional, para distribución)

Solo si quieres una APK firmada en serio (no con el debug keystore):

```bash
# 1. Crear el keystore (guárdalo FUERA del repo o en .gitignore)
keytool -genkeypair -v -keystore ~/.android/itera-release.keystore \
  -alias itera -keyalg RSA -keysize 2048 -validity 10000
```

Y en `android/gradle.properties` (o variables de entorno):

```properties
ITERA_UPLOAD_STORE_FILE=/home/carlos/.android/itera-release.keystore
ITERA_UPLOAD_STORE_PASSWORD=...
ITERA_UPLOAD_KEY_ALIAS=itera
ITERA_UPLOAD_KEY_PASSWORD=...
```

Después edita `android/app/build.gradle` para definir `signingConfigs.release`
con esos valores y asignarla a la variante `release`. Recuerda: **sin
contraseñas en el repo**.

---

## 6. Problemas comunes

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `SDK location not found` | Falta `ANDROID_HOME` | Ya está definido en este equipo; si falla, crea `android/local.properties` con `sdk.dir=/home/carlos/Android/Sdk` |
| `License for package ... not accepted` | Licencias pendientes | `yes \| $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses` |
| La app crashea al abrir y el log dice `Faltan variables de Firebase en .env` | El `.env` no existía al hacer el bundle | Rellena `.env` y recompila (paso 3.2); no basta con recompilar solo el JS |
| `Cannot find module 'expo'` o `expo: command not found` | `node_modules` roto | Repetir el paso 2.1 |
| Gradle falla por memoria | JVM sin heap suficiente | `export GRADLE_OPTS="-Dorg.gradle.jvmargs=-Xmx4g"` y reintentar |
| La APK pesa mucho | Contiene todas las ABIs | Para uso propio no importa; para distribuir: `cd android && ./gradlew bundleRelease` genera un `.aab`, o filtra ABIs en `build.gradle` |

---

## 7. Resumen rápido (chuleta)

```bash
rm -rf node_modules && npm install   # solo la primera vez / si se rompe
cp .env.example .env                 # solo la primera vez; rellenar claves
npx expo prebuild -p android         # tras cambiar app.json o plugins
cd android && ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

`functions/` (Cloud Functions) **no** se necesita para compilar la APK: solo
entra en juego al desplegar el backend o usar el emulador.
