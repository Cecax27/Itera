---
id: visual-identity
description: |
  Use this skill whenever designing or modifying any user-facing surface of Itera:
  layouts, screens, components, design tokens, color usage, typography, iconography,
  illustrations, photography, motion, or visual hierarchy. Also use it when writing
  copy that has a visual or UI framing, defining new components, choosing spacing,
  selecting colors, picking typography sizes, or auditing existing UI against the
  brand system. Triggers: "design", "UI", "screen", "component", "token",
  "color", "tipografía", "componente", "pantalla", "modo entrenamiento".
---

# Itera · Identidad visual

Esta skill carga el sistema de diseño de Itera cada vez que se toca cualquier
superficie visible del producto. Antes de proponer, modificar o revisar UI, lee
la wiki oficial y respeta los principios aquí resumidos.

## Fuentes de verdad (consultar antes de diseñar)

1. **Identidad visual (wiki)** — sistema completo:
   https://github.com/Cecax27/Itera/wiki/Identidad-visual
2. **Implementación visual (wiki)** — orden y filosofía:
   https://github.com/Cecax27/Itera/wiki/Implementación-visual
3. **AGENTS.md (raíz del repo)** — principios de producto que la UI debe
   respetar (especialmente "Primero la acción, después de la conversación",
   "Cada entrenamiento debe tener un propósito" y "Carrera y fuerza son un
   solo sistema").

Si la wiki y este archivo entran en conflicto, la wiki gana. Si este archivo
y tu memoria entran en conflicto, este archivo gana.

## Concepto creativo en una frase

Cada sesión cuenta. Itera representa la mejora continua: no necesitas hacer
todo perfecto hoy; necesitas entender dónde estás y cuál es el siguiente paso.

Tres adjetivos sostienen toda la dirección visual:

- **Humana**: acompaña sin juzgar, celebrar artificialmente ni presionar.
- **Editorial**: jerarquías tipográficas fuertes, números protagonistas y espacio para respirar.
- **Precisa**: cada dato, botón y gráfico tiene una función clara.

## Tokens de diseño (resumen)

Estos valores son el punto de partida. Si necesitas desviarte, justifícalo.

### Color

| Token | Valor | Uso |
|-------|-------|-----|
| Itera Lime | `#C8F169` | Acción primaria, estado activo, progreso destacado |
| Ink | `#20231F` | Titulares, texto principal, botón oscuro en tema claro |
| Canvas | `#F7F7F2` | Fondo claro principal |
| Surface | `#E9EAE3` | Contenedores, divisores suaves |
| Background oscuro | `#171A17` | Fondo principal del tema oscuro |
| Surface oscuro | `#242824` | Tarjetas y superficies elevadas en tema oscuro |

Reglas duras:

- El verde lima lleva texto oscuro, no blanco.
- El rojo se reserva para errores reales.
- El lima nunca es el único indicador de estado; añadir texto, icono o forma.
- No invertir colores automáticamente entre temas; revisar cada componente.

### Tipografía

- **Space Grotesk** — titulares, objetivos, cifras protagonistas.
- **DM Sans** — controles, etiquetas, descripciones, mensajes de la IA.
- Cifras tabulares siempre que estén disponibles.

Escalas (referencia, se adaptan al dispositivo y a accesibilidad):

- Titular principal 32-40 px Semibold.
- Título de pantalla 26-30 px Semibold.
- Título de sección 19-22 px Semibold.
- Nombre del ejercicio 24-28 px Semibold.
- Texto normal 15-16 px Regular.
- Etiquetas 12-14 px Medium.
- Cifra deportiva destacada 36-48 px Bold.

### Espaciado y forma

- Espaciado base: 4 px.
- Espaciado habitual entre elementos: 12-16 px.
- Padding de tarjetas: 16-20 px.
- Radio de tarjetas: 16 px.
- Radio de botones: 12-14 px.
- Altura de botones principales: 52-56 px.
- Borde de tarjetas: 1 px neutro.
- Elevación: mínima. Priorizar superficies y bordes.
- Transiciones: 150-220 ms, sin animaciones obligatorias.
- Área táctil mínima: 44-48 px.

## Principios de experiencia que la UI debe respetar

1. **Una acción principal por pantalla**. El botón primario en lima con texto
   oscuro. Lo demás, secundario.
2. **Espacio en blanco**. Si dudas entre "más denso" y "más respiro", elige
   respiro.
3. **Progreso explicable**. Un dato protagonista con contexto útil. No una
   colección de cifras compitiendo por atención.
4. **Modo entrenamiento**. Durante una sesión, la pantalla se simplifica al
   mínimo: ejercicio al centro, datos de la serie visibles, registrar serie como
   acción principal. Sin calendario, sin gráficas, sin chat fijo.
5. **Tema adaptativo**. Tema claro y oscuro soportados. No invertir
   automáticamente sin revisar.
6. **Detalles bajo demanda**. Las funciones deben ser fáciles de descubrir
   pero no estar todas visibles al mismo tiempo. Configuración inicial =
   formulario corto. Avanzado disponible después.

## Conflictos resueltos (no reabrir)

| Tensión | Decisión |
|---------|----------|
| Editorial vs legibilidad | Titulares expresivos, controles y textos funcionales sobrios. |
| Lima vs elegancia | Lima como acento estratégico, no como fondo general. |
| Mucha información vs simplicidad | Resumen primero, detalle bajo demanda. |
| IA adaptable vs interfaz predecible | La IA cambia el plan, no la estructura de la interfaz ni las acciones esenciales. |
| Personalización vs simplicidad | Preferencias avanzadas ocultas en primer uso. |

## Lo que NO hacer

- No usar siluetas de corredor, mancuernas ni rayos como iconografía principal.
- No llenar cada tarjeta de ilustraciones.
- No usar personajes animados, medallas 3D, partículas ni estética infantil.
- No comparar métricas incompatibles ni interpretar una sesión como tendencia.
- No traducir la jerarquía visual a otra disciplina sin revisar (lo que vale
  para fuerza no siempre vale tal cual para carrera, pero la lógica debe ser
  la misma).
- No añadir sombras, degradados ni efectos tridimensionales al logotipo.

## Cómo aplicar esta skill

Antes de proponer UI nueva:

1. Identifica a qué principio(s) de producto (en AGENTS.md) responde.
2. Identifica qué pantalla(s) toca y si pertenece al modo planificación o al
   modo entrenamiento.
3. Verifica que los tokens usados (color, tipo, espaciado) coinciden con este
   archivo.
4. Si introduces un token nuevo, justifícalo y propón añadirlo a la wiki.
5. Si modificas la jerarquía de una pantalla prioritaria (Hoy, Plan, Progreso,
   Modo entrenamiento), consulta antes con el usuario.

## Pendiente de definir (no inventar)

- Detalles finales del símbolo/logotipo y sus variantes.
- Métricas accesibles adicionales (contrastes WCAG verificados).
- Icono adaptativo para Android (foreground + background separados).
- Guía oficial de microcopy (botones, confirmaciones, avisos de seguridad).
- Herramienta de diseño para mantener una única fuente de verdad.