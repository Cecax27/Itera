# `src/domain/`

Lógica de negocio del producto. **TypeScript puro**, sin React Native, sin Firebase, sin Expo.

## Regla dura

Nada de este directorio puede importar desde:

- `react`, `react-native`, `expo-*`, `@react-navigation/*`
- `firebase/*`, `@firebase/*`
- `src/app/*`, `src/infrastructure/*`

El dominio puede depender de TypeScript built-ins y de utilidades compartidas, nada más.

## Qué vive aquí

- **Entidades puras**: `Profile`, `Goal`, `Plan`, `Session`, `SessionRecordMetadata`, `SessionSetRecord`, `RunLog`, `PlanChange`. Solo tipos y constructores.
- **Registro H4**: mantiene por separado la instantánea planificada y los resultados realizados; RPE entero de 1 a 10 y sesiones libres identificadas como tales.
- **Historial H5**: filtros por disciplina/periodo y agregaciones semanales puras para distancia de carrera, volumen de fuerza y adherencia al plan.
- **Modo H6**: `TrainingProgress` conserva estado, posición y temporizador opcional; una serie omitida se registra como omitida, sin resultados ficticios.
- **Asistente H7**: los cambios se proponen como eventos con snapshots anterior/propuesto; el dominio distingue seguridad/fallback y no aplica cambios sin aceptación explícita.
- **Validaciones**: funciones que validan invariantes del dominio (no de UI).
- **Reglas del motor de planificación**: generación, progresión, restricciones de simultaneidad entre carrera y fuerza.
- **Adaptadores puros**: funciones que convierten entre tipos de Firestore y tipos de dominio (cuando la lógica no requiere Firebase, solo tipos).
- **Tests** del dominio (Vitest).

## Qué NO vive aquí

- Componentes visuales.
- Hooks de React.
- Llamadas a Firebase, LLM, geolocalización, etc.
- Estado global de UI.

## Convención de nombres

- Un archivo por agregado: `profile.ts`, `plan.ts`, `session.ts`, `set.ts`, `run-log.ts`, `plan-change.ts`.
- Cada archivo expone: tipos, factories (`createProfile`, `updateProfile`), validadores (`validateProfile`).
- Errores de dominio propios (`ProfileValidationError`, etc.), nunca `Error` genérico.

## Cómo se prueba

Vitest. Las pruebas son unitarias, sin mocks de Firebase ni de React. Si una función del dominio necesita datos externos, está mal ubicada y debería ir a `src/infrastructure/`.
