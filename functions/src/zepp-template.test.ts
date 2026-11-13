// Tests de las plantillas de entrenamiento Zepp del backend.

import { afterEach, describe, expect, it } from 'vitest';

import { Request } from 'express';

import {
  extractTemplateId,
  publicTemplateUrl,
  sanitizeTemplate,
  templateHash,
  ZeppTemplateSchema,
  ZeppTemplateRecord,
} from './zepp-template';

// Plantilla observada en el flujo real (Run Planner), sin createdAt/updatedAt:
// esos los añade el backend al almacenar.
const observedTemplate: ZeppTemplateRecord = {
  username: '',
  avatar: '',
  shareUrl: 'https://img-cdn.zepp.com/20230911/outdoor.png',
  title: 'Entrenamiento',
  description: '15 min de calentamiento + 5 km de carrera + 2 min de recuperación',
  trainingIntervals: {
    type: 'PARENT',
    children: [
      {
        type: 'NODE',
        trainingInterval: {
          intervalType: '0',
          intervalUnit: '1',
          intervalUnitValue: '900',
          alertRule: '0',
          alertRuleDetail: '0-0',
          lengthUnit: 0,
          intervalGuide: null,
          intervalGuideI18nKey: null,
          intervalTypeI18nKey: 'gapType_warmup',
          intervalUnitI18nKey: null,
          alertRuleI18nKey: null,
          lengthUnitI18nKey: 'gap_metric',
        },
      },
      {
        type: 'NODE',
        trainingInterval: {
          intervalType: '1',
          intervalUnit: '0',
          intervalUnitValue: '5000',
          alertRule: '0',
          alertRuleDetail: '0-0',
          lengthUnit: 0,
          intervalGuide: null,
          intervalGuideI18nKey: null,
          intervalTypeI18nKey: 'gapType_training',
          intervalUnitI18nKey: 'gap_Km',
          alertRuleI18nKey: null,
          lengthUnitI18nKey: 'gap_metric',
        },
      },
    ],
  },
  appName: 'com.xiaomi.hm.health',
  status: 'AVAILABLE',
  trainingTypeId: 1,
  trainingTypeName: '户外跑',
  isOfficial: null,
  officialId: null,
  estimatedDistance: null,
  estimatedTime: null,
  titleI18nKey: null,
  descriptionI18nKey: null,
  target: null,
  targetI18nKey: null,
  difficulty: null,
  difficultyI18nKey: null,
};

describe('ZeppTemplateSchema', () => {
  it('acepta la plantilla real observada', () => {
    expect(ZeppTemplateSchema.safeParse(observedTemplate).success).toBe(true);
  });

  it('acepta la etapa de vuelta a la calma observada (tipo 4, sin i18n key)', () => {
    const template = {
      ...observedTemplate,
      trainingIntervals: {
        type: 'PARENT' as const,
        children: [
          {
            type: 'NODE' as const,
            trainingInterval: {
              ...observedTemplate.trainingIntervals.children[0].trainingInterval,
              intervalType: '4',
              intervalTypeI18nKey: null,
            },
          },
        ],
      },
    };
    expect(ZeppTemplateSchema.safeParse(template).success).toBe(true);
  });

  it('rechaza códigos no observados o inventados', () => {
    const cases: Array<Record<string, unknown>> = [
      // Tipo de etapa inexistente.
      { ...observedTemplate, trainingIntervals: { type: 'PARENT', children: [{ type: 'NODE', trainingInterval: { ...observedTemplate.trainingIntervals.children[0].trainingInterval, intervalType: '3' } }] } },
      // Etiqueta i18n de cooldown inventada.
      { ...observedTemplate, trainingIntervals: { type: 'PARENT', children: [{ type: 'NODE', trainingInterval: { ...observedTemplate.trainingIntervals.children[0].trainingInterval, intervalType: '4', intervalTypeI18nKey: 'gapType_cooldown' } }] } },
      // App distinta.
      { ...observedTemplate, appName: 'com.otro.app' },
      // Valor fuera de rango.
      { ...observedTemplate, trainingIntervals: { type: 'PARENT', children: [{ type: 'NODE', trainingInterval: { ...observedTemplate.trainingIntervals.children[0].trainingInterval, intervalUnitValue: '999999' } }] } },
      // Valor no numérico.
      { ...observedTemplate, trainingIntervals: { type: 'PARENT', children: [{ type: 'NODE', trainingInterval: { ...observedTemplate.trainingIntervals.children[0].trainingInterval, intervalUnitValue: '15min' } }] } },
      // Deporte no observado.
      { ...observedTemplate, trainingTypeId: 24, trainingTypeName: '力量训练' },
      // Sin etapas.
      { ...observedTemplate, trainingIntervals: { type: 'PARENT', children: [] } },
      // Campo añadido fuera del contrato.
      { ...observedTemplate, extra: true },
    ];
    for (const candidate of cases) {
      expect(ZeppTemplateSchema.safeParse(candidate).success, `esperaba rechazo para ${JSON.stringify(candidate).slice(0, 80)}…`).toBe(false);
    }
  });

  it('rechaca plantillas con demasiadas etapas (límite anti-abuso)', () => {
    const node = observedTemplate.trainingIntervals.children[0];
    const template = {
      ...observedTemplate,
      trainingIntervals: {
        type: 'PARENT' as const,
        children: Array.from({ length: 41 }, () => node),
      },
    };
    expect(ZeppTemplateSchema.safeParse(template).success).toBe(false);
  });
});

describe('sanitizeTemplate', () => {
  it('fuerza username y avatar vacíos aunque lleguen con datos', () => {
    const sanitized = sanitizeTemplate({
      ...observedTemplate,
      username: 'atleta-privado',
      avatar: 'https://img.zepp.com/avatar/secreto.png',
    });
    expect(sanitized.username).toBe('');
    expect(sanitized.avatar).toBe('');
    // El resto queda intacto.
    expect(sanitized.title).toBe(observedTemplate.title);
  });
});

describe('templateHash', () => {
  it('es determinista e independiente del orden de claves', () => {
    const reordered = JSON.parse(JSON.stringify(observedTemplate));
    reordered.description = observedTemplate.description;
    expect(templateHash(sanitizeTemplate(observedTemplate)))
      .toBe(templateHash(sanitizeTemplate(reordered)));
  });

  it('cambia cuando cambia el contenido del entrenamiento', () => {
    const modified = {
      ...observedTemplate,
      title: 'Otro título',
    };
    expect(templateHash(sanitizeTemplate(observedTemplate)))
      .not.toBe(templateHash(sanitizeTemplate(modified)));
  });
});

describe('publicTemplateUrl', () => {
  afterEach(() => {
    delete process.env.WORKOUT_TEMPLATE_BASE_URL;
  });

  it('usa el dominio estándar de Cloud Functions por defecto', () => {
    process.env.GCLOUD_PROJECT = 'itera-4f63c';
    expect(publicTemplateUrl('abc123'))
      .toBe('https://us-central1-itera-4f63c.cloudfunctions.net/workoutTemplate/abc123');
  });

  it('respeta WORKOUT_TEMPLATE_BASE_URL si está configurada', () => {
    process.env.WORKOUT_TEMPLATE_BASE_URL = 'https://itera.example.com/zepp/';
    expect(publicTemplateUrl('abc123')).toBe('https://itera.example.com/zepp/abc123');
  });
});

describe('extractTemplateId', () => {
  function fakeRequest(path: string, query: Record<string, unknown> = {}): Request {
    return { path, query } as unknown as Request;
  }

  it('extrae el id de la subruta', () => {
    expect(extractTemplateId(fakeRequest('/abcXYZ_-123/'))).toBe('abcXYZ_-123');
  });

  it('extrae el id del query como alternativa', () => {
    expect(extractTemplateId(fakeRequest('/', { id: 'abcXYZ_-123' }))).toBe('abcXYZ_-123');
  });

  it('rechaza identificadores con formato inválido sin tocar Firestore', () => {
    expect(extractTemplateId(fakeRequest('/'))).toBeNull();
    expect(extractTemplateId(fakeRequest('/abc$'))).toBeNull();
    expect(extractTemplateId(fakeRequest('/ab'))).toBeNull(); // demasiado corto
    expect(extractTemplateId(fakeRequest('/', { id: '../etc/passwd' }))).toBeNull();
  });
});
