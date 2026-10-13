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
- **Backend / persistencia / auth**: **Firebase** (Firestore como base de datos y Authentication para identidad).
- **Idioma de documentación, código y mensajes de UI**: español.
- **Identidad visual**: sigue el sistema definido en la skill `visual-identity` y la wiki.

### Pendiente de definir (no inventar)

- **Versión del SDK de Expo** a usar.
- **Cliente Firebase en React Native**: hay dos opciones reales y cambia cómo se desarrolla (Expo Go vs EAS Build). Decidir antes de empezar:
  - **Firebase JS SDK oficial** — funciona en Expo Go, rápido de levantar, menos integraciones nativas.
  - **@react-native-firebase** — más completo y recomendado para producción, pero **requiere EAS Build** (no funciona en Expo Go).
- **Estructura de carpetas** del proyecto (raíz vs. monorepo con `apps/mobile/`).
- **Gestión de configuración sensible** (claves de Firebase): `.env` + `expo-public`, archivo `google-services.json`, qué se commitea y qué no.
- **Reemplazo del `.gitignore`** actual (es una plantilla Java que no aplica).

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