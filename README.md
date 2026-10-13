# Itera — Asistente deportivo personal con IA

> **Entrena con un propósito. Entiende tu progreso. Siempre sabe cuál es el siguiente paso.**

Itera es un entrenador deportivo personal basado en IA que transforma tus objetivos de carrera y fuerza en un plan concreto, registra lo que realmente haces y adapta tus próximos entrenamientos según tu evolución, disponibilidad y recuperación.

A diferencia de una app de rutinas, un registro deportivo o un chatbot, Itera **recuerda tu historial, explica por qué entrena cada cosa y te dice siempre cuál es el siguiente paso**.

---

## ¿Qué problema resuelve?

La dificultad de decidir qué entrenar cada día, mantener una planificación coherente y aprender de los resultados.

La frustración central del usuario objetivo: *"Quiero entrenar bien, pero no quiero tener que convertirme en mi propio entrenador para conseguirlo".*

---

## Propuesta de valor

| Nivel | Qué aporta |
|-------|------------|
| **Inmediato** | Claridad: elimina la pregunta diaria de qué entrenar, con qué intensidad y cuánto tiempo. |
| **Continuo** | Comprensión: explica el propósito de cada sesión, las adaptaciones del plan y las señales de progreso. |
| **Acumulativo** | Aprendizaje: construye un historial para tomar mejores decisiones con el tiempo, en lugar de empezar de cero cada semana. |

---

## Visión

Convertirse en un sistema de entrenamiento personal que ayude a las personas a progresar de manera sostenible mediante planes individualizados, datos deportivos e inteligencia artificial que aprende de su evolución y les enseña a entrenar mejor.

**Misión**: transformar los objetivos deportivos en un proceso cotidiano claro, medible, adaptable y comprensible.

A largo plazo, el objetivo no es que el usuario dependa de la IA para siempre, sino que desarrolle una mejor comprensión de su propio entrenamiento.

---

## Usuario objetivo (MVP)

Deportista amateur que quiere entrenar con método:

- Combina deporte con trabajo y otras responsabilidades.
- Tiene metas concretas (mejorar 5 km, ganar fuerza, etc.).
- Necesita saber qué hacer en cada sesión.
- Tiene disponibilidad variable y no siempre puede seguir un calendario ideal.
- Quiere comprender los resultados, no solo acumular estadísticas.
- Acepta registrar información si obtiene un beneficio claro.

El primer usuario es el propio desarrollador, con horarios rotativos y objetivos de carrera y fuerza. Eso hace que la **adaptación a la disponibilidad real** sea una funcionalidad a validar desde el inicio.

---

## Alcance del MVP

### Capacidades imprescindibles

1. **Perfil y objetivos deportivos** — configuración de experiencia, objetivos, disponibilidad, equipamiento y restricciones.
2. **Planificador de carrera y fuerza** — plan semanal con sesiones, ejercicios, series, repeticiones, descansos, ritmos o intensidades.
3. **Entrenamiento del día** — sesión recomendada visible al abrir la app, con duración estimada y propósito.
4. **Registro de resultados** — captura lo planeado y lo realizado: duración, distancia, ritmo, pesos, repeticiones, percepción del esfuerzo.
5. **Historial y análisis** — consultas de sesiones, evolución de marcas, volumen, progresión de cargas.
6. **Asistente que explica y adapta** — consulta el historial, explica decisiones y propone cambios ante sesiones completadas, omitidas o cambios de disponibilidad/recuperación.

### Fuera del MVP

- Integración con Garmin, Apple Health y otros dispositivos.
- Sincronización automática de relojes.
- Nutrición, calorías y planes alimenticios.
- Comunidad, amigos y rankings.
- Compatibilidad avanzada con múltiples deportes.
- Tienda de planes y entrenadores.
- Entrenamiento predictivo complejo.

---

## Cómo funciona

```
Definir objetivo       →   Planificar        →   Ejecutar y registrar
↓                                              ↓
   ← Adaptar el siguiente paso  ←   Analizar
```

El ciclo se repite con cada sesión. Una decisión de diseño clave: **la IA puede recomendar cambios, pero la aplicación conserva un historial claro de lo planeado, lo realizado y por qué se modificó el plan**, para que el usuario pueda revisar sus decisiones semanas después.

---

## Arquitectura conceptual

Tres responsabilidades separadas:

- **Datos deportivos** — objetivos, planes, sesiones, resultados, historial de cambios. La información persistente no depende de la memoria de conversación.
- **Motor de planificación** — calendarios, estructura de sesiones, reglas de progresión, validaciones. Mantiene el plan coherente aunque la IA proponga cambios.
- **Capa de IA** — interpreta contexto, explica recomendaciones, responde preguntas y propone adaptaciones dentro de límites definidos.

Esta separación permite no atar la aplicación a un único proveedor de IA y conservar el historial aunque cambie el modelo.

---

## Principios que guían el producto

1. Primero la acción, después la conversación.
2. Cada entrenamiento debe tener un propósito.
3. Registrar debe ser fácil.
4. Adaptarse a la realidad, no solo al plan ideal.
5. Las recomendaciones deben ser explicables.
6. Carrera y fuerza funcionan como un solo sistema.

**Regla de seguridad**: la IA no diagnostica lesiones ni sustituye a un profesional sanitario. Ante señales de alarma, la seguridad prevalece sobre la continuidad del plan.

---

## Cómo sabremos que funciona

Métricas iniciales (hipótesis de validación):

| Métrica | Objetivo |
|--------|----------|
| Sesiones realizadas vs. planificadas | >= 80% durante 4 semanas |
| Tiempo en identificar la siguiente sesión | < 30 segundos |
| Sesiones registradas | >= 90% de las realizadas |
| Comprensión del plan | Poder explicar el propósito de las sesiones principales |
| Utilidad de las adaptaciones | Cambios comprensibles y aplicables |
| Continuidad de uso | 4 semanas sin reconstruir contexto manualmente |

Con un solo usuario no se demuestra que funcione para todo el mercado, pero sí permite descubrir si el flujo tiene sentido y qué partes generan fricción.

---

## Stack técnico

- **Plataforma**: Android. No hay versión web por ahora.
- **Framework móvil**: React Native con Expo (SDK 53).
- **Cliente Firebase**: Firebase JS SDK oficial (compatible con Expo Go).
- **Backend y persistencia**: Firebase (Firestore como base de datos, Authentication para identidad).
- **Estructura del proyecto**: archivos en la raíz del repo. No es monorepo.
- **Idioma**: documentación, código y mensajes de UI en español.
- **Identidad visual**: definida en la [wiki del proyecto](https://github.com/Cecax27/Itera/wiki/Identidad-visual).

---

## Estado del proyecto

Repositorio recién inicializado. Contiene la documentación base del producto (`README.md` y `AGENTS.md`), la skill de OpenCode para identidad visual (`.opencode/skills/visual-identity`) y, desde octubre de 2026, el código inicial de la app Android con React Native + Expo (SDK 53).

Detalles pendientes (gestión de configuración sensible, método de creación del proyecto Expo) están listados en [`AGENTS.md`](./AGENTS.md) bajo "Pendiente de definir".

Consulta [`AGENTS.md`](./AGENTS.md) para las guías de trabajo específicas para agentes que desarrollen en este repo.