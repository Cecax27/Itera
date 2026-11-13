// Plantilla real observada en Run Planner (octubre de 2026).
//
// Obtenida publicando en su servidor de referencia y recuperando la URL
// pública. Es el fixture de compatibilidad: cuando el adaptador recibe una
// sesión equivalente, debe reproducir esta estructura campo a campo.
// createdAt/updatedAt son epoch-ms (enteros) añadidos por el servidor al
// almacenar.

export const RUN_PLANNER_OBSERVED_TEMPLATE = {
  title: 'Entrenamiento',
  description: '15 min de calentamiento + 5 km de carrera + 2 min de recuperación',
  username: '',
  avatar: '',
  shareUrl: 'https://img-cdn.zepp.com/20230911/outdoor.png',
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
      {
        type: 'NODE',
        trainingInterval: {
          intervalType: '2',
          intervalUnit: '1',
          intervalUnitValue: '120',
          alertRule: '0',
          alertRuleDetail: '0-0',
          lengthUnit: 0,
          intervalGuide: null,
          intervalGuideI18nKey: null,
          intervalTypeI18nKey: 'gapType_rest',
          intervalUnitI18nKey: null,
          alertRuleI18nKey: null,
          lengthUnitI18nKey: 'gap_metric',
        },
      },
    ],
  },
  appName: 'com.xiaomi.hm.health',
  createdAt: 1760948893000,
  updatedAt: 1760948893000,
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
} as const;
