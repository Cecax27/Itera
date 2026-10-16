# AGENTS.md — Itera (Asistente deportivo con IA)

Guía compacta para sesiones de OpenCode que trabajen en este repositorio.

## Qué es este proyecto

**Itera** es el nombre provisional de un **asistente deportivo personal con IA** cuyo MVP está pensado para un único usuario: el propio desarrollador (deportista amateur que combina carrera y fuerza con horarios rotativos). No es una app genérica de rutinas ni un chatbot que olvida el historial entre conversaciones.

El objetivo central: **"Entrena con un propósito. Entiende tu progreso. Siempre sabe cuál es el siguiente paso."**

## Estado del repositorio

- Repo recién inicializado. Solo hay un `.gitignore` de plantilla Java y `LICENSE`.
- No existe código, build config ni CI todavía. **No des por sentado nada sobre comandos o librerías concretas**: pregunta o confirma antes de generar estructura.
- `AGENTS.md`, `README.md` y la skill `visual-identity` (en `.opencode/skills/`) son los primeros artefactos reales del proyecto.

## Stack técnico confirmado

- **Plataforma objetivo**: Android. No hay versión web por ahora.
- **Framework de la app móvil**: **React Native con Expo**.
- **Versión de Expo SDK**: **57** (la 53 quedó descartada al ejecutar `create-expo-app@latest`, que instaló la más reciente).
- **Cliente Firebase en React Native**: **Firebase JS SDK oficial** (válido para Expo Go).
- **Backend / persistencia / auth**: **Firebase** (Firestore como base de datos y Authentication para identidad).
- **Estructura del proyecto**: archivos en la **raíz del repo**. No es monorepo.
- **applicationId Android**: `com.bitabit.itera`.
- **Idioma de documentación, código y mensajes de UI**: español.
- **Identidad visual**: sigue el sistema definido en la skill `visual-identity` y la wiki.

### Estructura del código

```
.
├── app.json                  # Configuración Expo (nombre, slug, scheme, iconos, paquete Android)
├── index.ts                  # Punto de entrada: registra src/App como componente raíz
├── package.json              # Dependencias y scripts (start, ios, android, typecheck, test, emulator)
├── tsconfig.json             # Extiende expo/tsconfig.base con strict + path alias @/* → src/*
├── vitest.config.mts         # Config de Vitest (node por defecto, jsdom opt-in para UI)
├── vitest.setup.mts          # Setup global de tests (vacío salvo stubs necesarios)
├── .env.example              # Variables públicas EXPO_PUBLIC_FIREBASE_* (plantilla, sí se commitea)
├── assets/                   # Iconos y splash por defecto
└── src/
    ├── App.tsx               # Componente raíz: monta SafeAreaProvider + RootStack
    ├── app/                  # Capa de UI (ver src/app/README.md)
    │   ├── README.md         # Reglas de la capa app
    │   ├── components/       # Botones, tarjetas, campos y controles compartidos
    │   ├── navigation/       # Stacks, tabs, drawers, tipos de navegación
    │   │   └── RootStack.tsx # Auth, onboarding y tabs (Hoy, Plan, Ajustes)
    │   ├── screens/          # Hoy, Plan, Ajustes, onboarding y registro H4
    │   └── hooks/            # Hooks de auth, perfil, plan y resultados
    ├── domain/               # Lógica de negocio pura, sin React ni Firebase (ver src/domain/README.md)
    │   ├── planning/          # Motor del plan semanal y sesión del día
    │   ├── training/          # RPE y modelos de resultados
    │   └── README.md         # Reglas de la capa domain
    └── infrastructure/       # Aísla dependencias externas del dominio
        └── firebase/         # Único punto de la app que importa 'firebase/*'
            ├── repositories/ # Auth, perfiles, planes y registros de sesión
            ├── config.ts     # Lee EXPO_PUBLIC_* y asegura que están todas
            └── client.ts     # Singleton Firebase + conectores de emulador
```

### Principios de arquitectura ya implementados

- **Tres capas aisladas**: `src/app/` (UI), `src/domain/` (lógica pura), `src/infrastructure/` (Firebase, futuro LLM). La regla:
  - `domain/` no importa de `app`, `infrastructure`, React Native, Expo ni Firebase. TypeScript puro.
  - `app/` no importa de `firebase/*` directamente. Pasa por `infrastructure/`.
  - `infrastructure/` aísla el SDK concreto del resto del código.
- **Variables de entorno públicas con prefijo `EXPO_PUBLIC_`**: las claves de Firebase son identificadores públicos (no secretos), así que pueden vivir en el bundle del cliente. `.env` está ignorado por `.gitignore`.
- **Path alias `@/*` → `src/*`**: activado para imports limpios. Usar `@/infrastructure/firebase` en vez de rutas relativas largas.
- **TypeScript estricto** en todo el código (`strict: true` en `tsconfig.json`).
- **Emulador Firebase opcional**: con `EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true` y `npm run emulator`, la app se conecta a los emuladores locales de Auth/Firestore. Por defecto está desactivado (apunta a `itera-4f63c`).
- **Tests con Vitest**: entorno `node` por defecto para dominio, `jsdom` opt-in para UI. Comandos `npm test` y `npm run test:watch`.
- **Navegación con `@react-navigation/native`**: stack mínimo Hoy/Ajustes en H0, se sustituye en H3.

### Hitos completados

- **H0** (Bootstrap y andamiaje técnico): estructura de tres capas, navegación mínima, smoke test de Firebase, emulador opcional, Vitest configurado. ✅
- **H1** (Perfil y objetivos deportivos): modelo de dominio con validadores (18 tests), repositorio de Firestore, hook `useProfile`, onboarding de 8 pasos, reglas de seguridad, sign-in anónimo provisional para desarrollo. ✅
- **Auth real con email y contraseña** (extensión de H1): módulo `src/domain/auth/`, `firebaseAuthRepository`, hook `useAuth`, `LoginScreen`, navegación enruta por estado de auth. 13 tests del auth. ✅
- **H2** (Plan semanal): dominio `src/domain/planning/` con tipos y motor puro (18 tests), `firestorePlanRepository` en `users/{uid}/plans/current`, `usePlan` hook, `PlanScreen` con bottom-tabs, generación automática al terminar el onboarding. ✅
- **H3** (Sesión del día, primera cara): `weekDayOf`, `getTodaySessions`, `getNextSession`, `computeWeekProgress` (10 tests); `TodayScreen` con encabezado + sesión + descanso, propósito visible bajo el título, botón Empezar como acción principal. ✅
- **H4** (Registro de resultados): dominio `src/domain/training/`, registros de series por ejercicio y resultado de carrera; persistencia bajo `users/{uid}/sessions/{sessionId}`, hooks `useSessionSets` y `useRunLog`, formularios disponibles desde Hoy y Plan. RPE 1–10. Se permiten sesiones libres, separadas de las planificadas. ✅

### Pendiente de definir (no inventar)

- **Google Sign-In**: queda pendiente hasta que salgamos de Expo Go. Requiere build nativo (EAS Build + `@react-native-google-signin/google-signin` o `expo-auth-session`). En el `firebaseAuthRepository` ya está el método `signInWithGoogle` declarado (lanzando error claro) para que cuando se implemente solo cambie la implementación.
- **Apple Sign-In**: mismo caso que Google, solo iOS. Pendiente.
- **Política de edición del perfil después del onboarding** (libre, o campos congelados).
- **Reglas de progresión reales** (subida de peso, aumento de km, periodización). El motor de H2 es una primera versión; en hitos siguientes o vía IA (H7) se afinan.
- **Capa de IA**: cliente LLM, prompts, herramientas.
- **Tests de UI**: con `@testing-library/react-native` + jsdom.
- **Migración de cuentas**: si en el futuro un usuario quiere cambiar de email, hay que decidir el flujo (¿vincular? ¿re-crear cuenta?).
- **Plan editable**: la pantalla de plan es solo lectura. La edición manual (cambiar sesiones de día, añadir/quitar) llega en un hito posterior.
- **Manejo de fallos del motor**: si el motor no puede asignar respetando restricciones, hoy recorta strength. Idealmente registramos warnings o ajustamos el número de sesiones.

## Arquitectura conceptual obligatoria

El producto debe separar **tres responsabilidades** claramente. No las mezcles en un solo módulo:

| Capa | Qué guarda / hace | Importante |
|------|-------------------|------------|
| **Datos deportivos** | Objetivos, planes, sesiones, resultados, historial de cambios | La información persistente **no debe depender** de la memoria de conversación |
| **Motor de planificación** | Calendarios, estructura de sesiones, reglas de progresión, validaciones | Mantiene el plan coherente aunque la IA proponga cambios |
| **Capa de IA** | Interpreta contexto, explica, responde, propone adaptaciones | Trabaja **dentro de límites definidos** (ver Seguridad) |

Consecuencia práctica: las recomendaciones de la IA deben poder cambiar de proveedor sin perder el historial, y el motor de planificación debe poder ejecutarse sin la IA encendida.

## Capacidades del MVP (las seis imprescindibles)

Cualquier funcionalidad nueva debe justificarse contra esta lista. Las seis son **imprescindibles** y forman un ciclo completo:

1. **Perfil y objetivos deportivos** — experiencia, objetivos, disponibilidad semanal, equipamiento, preferencias, restricciones.
2. **Planificador de carrera y fuerza** — plan semanal con sesiones, ejercicios, series, repeticiones, descansos, ritmos o intensidades.
3. **Entrenamiento del día** — sesión recomendada visible al abrir la app, duración estimada, ejecución, propósito; permite marcar ejercicios o bloques como completados.
4. **Registro de resultados** — guarda lo planificado y lo realizado: duración, distancia, ritmo, pesos, repeticiones, percepción de esfuerzo.
5. **Historial y análisis** — sesiones anteriores, evolución de marcas, volumen, progresión de cargas, comparaciones con sentido por disciplina.
7. **Asistente que explica y adapta** — consulta historial guardado, explica decisiones, propone cambios ante sesiones completadas, omitidas o cambios de disponibilidad/recuperación.

## Fuera del alcance inicial (no construir todavía)

- Integraciones con Garmin, Apple Health, relojes.
- Nutrición, calorías, planes alimenticios.
- Comunidad, amigos, rankings.
- Compatibilidad avanzada con múltiples deportes.
- Tienda de planes y entrenadores.
- Entrenamiento predictivo complejo.

Si una tarea pide alguna de estas cosas, **pregunta antes** de implementarla: probablemente sea para una fase posterior.

## Principios de producto (deciden qué construir y qué descartar)

1. **Primero la acción, después la conversación.** La pantalla principal muestra la sesión recomendada y permite empezar a registrar. El chat resuelve dudas y hace ajustes, **no es barrera para entrenar**.
2. **Cada entrenamiento debe tener un propósito** que el usuario pueda explicar: qué entrena, por qué, cómo medirá el resultado y qué relación tiene con su objetivo.
3. **Registrar debe ser fácil.** Distinguir siempre entre lo planeado y lo realizado, sin obligar a introducir datos innecesarios.
4. **Adaptarse a la realidad, no solo al plan ideal.** Si el usuario pierde sesión, cambia horario o reporta fatiga, la app ayuda a decidir cómo continuar. El calendario no es una obligación inamovible.
5. **Las recomendaciones deben ser explicables.** La IA no modifica un plan sin explicar qué dato motivó el cambio, y debe distinguir entre datos conocidos, estimaciones e incertidumbre.
6. **Carrera y fuerza son un solo sistema.** Considerar la carga combinada y evitar que una sesión interfiera con la recuperación de la otra.

## Seguridad — límite duro

La IA **no diagnostica lesiones ni sustituye a un profesional sanitario**. Ante señales de alarma, **la seguridad prevalece sobre la continuidad del plan**. Esto no es negociable: cualquier feature que cruce esta línea debe rechazarse o marcarse explícitamente como aviso al usuario.

## Decisión de diseño clave que no debe olvidarse

> La IA puede recomendar cambios, pero la aplicación debe **conservar un historial claro** de lo que estaba planeado, lo que realmente ocurrió y por qué se modificó el plan.

Implicación: nunca sobrescribas un plan; registra el cambio como un evento en el historial para que el usuario pueda revisar decisiones semanas después.

## Cómo se mide el éxito del MVP

Métricas iniciales (son hipótesis de validación, no estándares):

- >= 80% de sesiones realizadas vs. planificadas durante 4 semanas (con ajustes justificados).
- Identificar la siguiente sesión en < 30 segundos.
- Registrar >= 90% de las sesiones realizadas.
- Poder explicar el propósito de las sesiones principales.
- Cambios propuestos comprensibles y aplicables.
- Uso continuo 4 semanas sin reconstruir contexto manualmente.

## Convenciones de trabajo en este repo

- **Idioma**: documentación, comentarios de código y mensajes al usuario en **español**.
- **Historial claro**: ante cualquier cambio destructivo en planes o sesiones, persistir el estado previo; no sobrescribir.
- **Preguntar antes de asumir stack**: hasta que no exista `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, etc., no elijas framework por defecto.
- **No añadir integraciones externas** (Garmin, Health, etc.) sin confirmar que es fase post-MVP.
- Mantener `AGENTS.md` y `README.md` sincronizados cuando cambien alcance, principios o arquitectura.

## Cosas que un agente suele pasar por alto

- Que "carrera y fuerza" son **un solo sistema de planificación**, no dos agendas independientes.
- Que el usuario objetivo es **el propio desarrollador**, no un mercado masivo — esto limita features que serían "naturales" en un producto comercial (rankings, comunidad, tienda).
- Que la capa de IA es **intercambiable**; no atar el modelo a un proveedor concreto en código de dominio.
- Que el `.gitignore` actual es una **plantilla Java sin relación con el proyecto** — probablemente habrá que reemplazarlo cuando se elija el stack real.
