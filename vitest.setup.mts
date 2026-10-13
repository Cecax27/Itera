// Setup global para Vitest.
//
// No importamos @testing-library/react-native aquí porque carga el módulo
// nativo 'react-native', que no existe en entorno node. En su lugar, los
// tests de UI importan { render, screen } directamente y el cleanup se
// hace manualmente en afterEach cuando proceda.

import { vi } from 'vitest';

// Stub de APIs que el código de dominio podría necesitar y jsdom/node no
// proveen. Por ahora vacío; añadimos lo que haga falta.

// Aviso: este archivo se carga para TODOS los tests, incluido node puro.
// No importes nada que requiera RN aquí.