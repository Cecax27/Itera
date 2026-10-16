# Firebase Functions — Itera

Las llamadas al proveedor de IA se ejecutan en Cloud Functions. El backend expone varios callables autenticados:

- `askAssistant` — chat contextual (H7): lee perfil, plan e historial, responde y guarda propuestas auditables en `planChanges` sin tocar el plan.
- `generateTrainingPlan` — creador de planes (H8): recibe el brief del asistente guiado (objetivo, días, disponibilidad capturada así, equipamiento, experiencia, reparto deseado y notas), completa el contexto con perfil, plan actual y últimos entrenamientos, y pide al modelo un plan semanal completo con salida estructurada. El borrador se normaliza y valida contra `CurrentPlanSchema` y la coherencia semanal (solo días disponibles, máximo una sesión por día, sin fuerza en días consecutivos ni carrera tras fuerza intensa). Devuelve el plan draft con explicación, avisos y suposiciones; **no modifica `plans/current`**: la app lo previsualiza y solo lo persiste si el usuario confirma.
- `testOpenAIConnection` — comprueba la API key y lista los modelos de texto disponibles.
- `resolvePlanChange` — acepta o rechaza una propuesta del asistente de chat en una transacción.

Cada usuario introduce su propia API key en Ajustes; la app la guarda en Android SecureStore, asociada a su uid y a ese dispositivo, y la envía de forma transitoria a la Function. No se almacena en Firestore, Secret Manager ni en variables `EXPO_PUBLIC_*`. En otros dispositivos debe configurarse de nuevo.

## Desarrollo local

1. Instala dependencias en el subproyecto Functions: `npm --prefix functions install` (o `pnpm install` desde `functions/`, no desde la raíz móvil).
2. Arranca Firebase con `npm run emulator` desde la raíz. Añade `EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true` y `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` al `.env` de Expo.
3. En Ajustes de Itera, introduce la API key de tu cuenta, prueba la conexión y elige uno de los modelos devueltos por `GET /v1/models`.
4. Comprueba tipos/build con `npm --prefix functions run typecheck` y `npm --prefix functions run build`.

`@google-cloud/functions-framework` debe permanecer como dependencia directa de `functions/package.json`. El despliegue usa pnpm y `functions/pnpm-workspace.yaml` autoriza únicamente los postinstall revisados de `@firebase/util` y `protobufjs`.

## Despliegue

Cloud Functions requiere el plan Blaze. Despliega el backend:

```sh
firebase deploy --only functions
```

Cada usuario configura su clave y modelo en su dispositivo. La Function no persiste la clave; las propuestas se guardan como eventos en `users/{uid}/planChanges/{changeId}` y **no cambian el plan hasta que el usuario las acepte**.
