# `src/app/`

Capa de interfaz de usuario. Es lo único que sabe de React Native, Expo, navegación y estado de UI.

## Reglas

- **Puede importar de**: `src/domain/`, `src/infrastructure/`, React, React Native, Expo, navegación.
- **NO puede importar de**: `firebase/*` directamente. Toda la comunicación con Firebase pasa por `src/infrastructure/`.
- La UI **no contiene lógica de negocio**. Si una pantalla necesita calcular algo (progresión, validación, formato de plan), debe llamar a una función de `src/domain/`.

## Estructura interna

```
src/app/
├── components/      # Componentes reutilizables (Button, Card, Metric, etc.)
├── navigation/      # Stacks, tabs, drawers, tipos de navegación
├── screens/         # Hoy, Plan, Ajustes y formularios de registro
└── hooks/           # Auth, perfil, plan y persistencia de resultados
```

## Identidad visual

Sigue la skill `visual-identity` y la wiki Identidad-visual. En concreto:

- **Una acción principal por pantalla**.
- **Espacio en blanco**, no densidad.
- **Botón lima con texto oscuro**, no blanco.
- El rojo solo para errores reales.
- El lima nunca como único indicador de estado.
- Área táctil mínima 44-48 px.
- Tipografías: Space Grotesk para titulares, DM Sans para interfaz.

## Tests

Vitest + `@testing-library/react-native`. Componente por componente, pantalla por pantalla. Foco en interacciones (tocar "Registrar serie" llama al handler correcto) más que en snapshots visuales.
