// Adaptador de exportación a Zepp (Amazfit).
//
// Convierte una RunSession del dominio al JSON de "plantilla de
// entrenamiento" que la app Zepp importa vía deep link. La conversión es
// determinista y pura: nada de IA, nada de red, nada de React.
//
// IMPORTANTE — origen de los códigos usados aquí:
// El protocolo de plantillas de Zepp NO es una API oficial documentada.
// Los valores de este archivo provienen únicamente de observación
// empírica del flujo real (Run Planner + app Zepp), verificado contra el
// servidor de referencia en octubre de 2026:
//   - intervalType "0" calentamiento, "1" trabajo, "2" descanso,
//     "4" vuelta a la calma.
//   - intervalUnit "0" distancia (intervalUnitValue en metros),
//     "1" tiempo (intervalUnitValue en segundos).
//   - intervalTypeI18nKey observados: gapType_warmup, gapType_training,
//     gapType_rest. La etiqueta del tipo "4" NO fue observada: se envía
//     null en lugar de inventar una clave.
//   - intervalUnitI18nKey observado: gap_Km para distancia, null para tiempo.
//   - lengthUnitI18nKey: "gap_metric". alertRule "0", alertRuleDetail
//     "0-0" (sin avisos). trainingTypeId 1 / trainingTypeName "户外跑"
//     (carrera al aire libre). appName: com.xiaomi.hm.health.
//   - createdAt/updatedAt: enteros epoch-ms (los añade el backend al
//     almacenar).
// No se añade ningún código no observado. Objetivos de ritmo o FC NO se
// convierten (no hay códigos de aviso verificados): se omiten y se
// informan al usuario en `omissions`.

import { RunBlock, RunSession } from '@/domain/planning';

/** Códigos de etapa observados. No ampliar sin verificación en dispositivo. */
const ZEPP_INTERVAL_TYPE = {
  warmup: '0',
  work: '1',
  rest: '2',
  cooldown: '4',
} as const;

/** Etiquetas i18n observadas; la del tipo "4" no se observó → null. */
const ZEPP_INTERVAL_TYPE_I18N_KEY: Record<string, string | null> = {
  [ZEPP_INTERVAL_TYPE.warmup]: 'gapType_warmup',
  [ZEPP_INTERVAL_TYPE.work]: 'gapType_training',
  [ZEPP_INTERVAL_TYPE.rest]: 'gapType_rest',
  [ZEPP_INTERVAL_TYPE.cooldown]: null,
};

const ZEPP_UNIT = { distanceMeters: '0', seconds: '1' } as const;
const ZEPP_UNIT_I18N_KEY: Record<string, string | null> = {
  [ZEPP_UNIT.distanceMeters]: 'gap_Km',
  [ZEPP_UNIT.seconds]: null,
};

/** Imagen pública usada en la tarjeta de compartir; valor observado. */
const ZEPP_SHARE_URL = 'https://img-cdn.zepp.com/20230911/outdoor.png';
/** Paquete de la app Zepp; valor observado. */
const ZEPP_APP_NAME = 'com.xiaomi.hm.health';
/** Carrera al aire libre; valores observados. */
const ZEPP_TRAINING_TYPE_ID = 1;
const ZEPP_TRAINING_TYPE_NAME = '户外跑';
/** Valor observado en todas las plantillas de referencia. */
const ZEPP_LENGTH_UNIT_I18N_KEY = 'gap_metric';

/** Límites de validación de la plantilla generada. */
export const MAX_ZEPP_NODES = 40;
const MAX_REPETITIONS = 20;
const MAX_INTERVAL_VALUE = 100_000; // metros o segundos por etapa.
const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 300;

export interface ZeppTrainingInterval {
  intervalType: string;
  intervalUnit: string;
  intervalUnitValue: string;
  alertRule: string;
  alertRuleDetail: string;
  lengthUnit: number;
  intervalGuide: null;
  intervalGuideI18nKey: null;
  intervalTypeI18nKey: string | null;
  intervalUnitI18nKey: string | null;
  alertRuleI18nKey: null;
  lengthUnitI18nKey: string;
}

export interface ZeppTemplate {
  username: string;
  avatar: string;
  shareUrl: string;
  title: string;
  description: string;
  trainingIntervals: {
    type: 'PARENT';
    children: ZeppIntervalNode[];
  };
  appName: string;
  status: 'AVAILABLE';
  trainingTypeId: number;
  trainingTypeName: string;
  isOfficial: null;
  officialId: null;
  estimatedDistance: null;
  estimatedTime: null;
  titleI18nKey: null;
  descriptionI18nKey: null;
  target: null;
  targetI18nKey: null;
  difficulty: null;
  difficultyI18nKey: null;
}

export interface ZeppIntervalNode {
  type: 'NODE';
  trainingInterval: ZeppTrainingInterval;
}

export interface ZeppTemplateInput {
  session: RunSession;
  /** Título visible en Zepp (p. ej. "Intervalos · Martes"). */
  title: string;
  /** Descripción visible; normalmente el propósito de la sesión. */
  description?: string;
}

export type ZeppTemplateResult =
  | { ok: true; template: ZeppTemplate; omissions: readonly string[] }
  | { ok: false; error: string };

/**
 * Convierte una sesión de carrera en plantilla Zepp. Devuelve un error
 * claro cuando la sesión no puede representarse de forma fiable (fuerza,
 * bloques sin dimensión válida, demasiadas etapas…). Nunca genera una
 * plantilla parcial "inventando" datos.
 *
 * Las repeticiones se desarrollan en nodos repetidos (no hay un campo de
 * repeticiones en el protocolo observado): un intervalo 5×1000 con 90 s de
 * recuperación produce [1000, 90, 1000, 90, …]. Los objetivos de ritmo se
 * omiten y se reportan en `omissions`.
 */
export function buildZeppTemplate(input: ZeppTemplateInput): ZeppTemplateResult {
  const { session } = input;
  if (session.discipline !== 'running') {
    return {
      ok: false,
      error: 'Solo se pueden exportar sesiones de carrera a Zepp: la app Zepp no admite importar plantillas de fuerza.',
    };
  }

  const omissions: string[] = [];
  const nodes: ZeppIntervalNode[] = [];

  for (const block of session.blocks) {
    const pushed = pushBlockNodes(nodes, block, omissions);
    if (!pushed) return { ok: false, error: blockError(block) };
    if (nodes.length > MAX_ZEPP_NODES) {
      return {
        ok: false,
        error: `La sesión genera demasiadas etapas para Zepp (máximo ${MAX_ZEPP_NODES}). Reduce repeticiones o bloques antes de exportar.`,
      };
    }
  }

  if (nodes.length === 0) {
    return { ok: false, error: 'La sesión no tiene bloques que exportar.' };
  }

  const title = normalizeText(input.title, MAX_TITLE_LENGTH);
  if (!title) return { ok: false, error: 'La plantilla necesita un título.' };
  const description = normalizeText(input.description ?? '', MAX_DESCRIPTION_LENGTH);

  return {
    ok: true,
    omissions: [...new Set(omissions)],
    template: {
      // Sin datos personales: la plantilla se sirve desde una URL pública.
      username: '',
      avatar: '',
      shareUrl: ZEPP_SHARE_URL,
      title,
      description,
      trainingIntervals: { type: 'PARENT', children: nodes },
      appName: ZEPP_APP_NAME,
      status: 'AVAILABLE',
      trainingTypeId: ZEPP_TRAINING_TYPE_ID,
      trainingTypeName: ZEPP_TRAINING_TYPE_NAME,
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
    },
  } satisfies ZeppTemplateResult;
}

interface StageValue {
  unit: string;
  value: number;
}

/**
 * Añade a `nodes` los nodos Zepp del bloque. Devuelve false cuando el
 * bloque no puede representarse de forma fiable (el llamante aborta la
 * exportación completa con un mensaje claro, nunca exporta a medias).
 */
function pushBlockNodes(
  nodes: ZeppIntervalNode[],
  block: RunBlock,
  omissions: string[],
): boolean {
  if (!hasValidDimension(block)) return false;

  const repetitions = block.repetitions ?? 1;
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > MAX_REPETITIONS) {
    return false;
  }
  const recoverySeconds = block.recoverySeconds;
  if (recoverySeconds !== undefined
    && (!Number.isInteger(recoverySeconds) || recoverySeconds < 0 || recoverySeconds > MAX_INTERVAL_VALUE)) {
    return false;
  }
  if (block.paceSecondsPerKm !== undefined) {
    omissions.push(
      `El ritmo objetivo ${paceLabel(block.paceSecondsPerKm)} no se exporta: Zepp no tiene códigos de aviso de ritmo verificados en este protocolo.`,
    );
  }
  if (block.type === 'interval' && repetitions > 1 && !recoverySeconds) {
    omissions.push('El intervalo declara repeticiones sin recuperación; la plantilla irá sin descansos entre series.');
  }

  const work = zeppNode(workStage(block), blockValue(block));
  if (!work) return false;
  const rest = recoverySeconds
    ? zeppNode(ZEPP_INTERVAL_TYPE.rest, { unit: ZEPP_UNIT.seconds, value: recoverySeconds })
    : null;
  if (recoverySeconds && !rest) return false;

  if (block.type === 'interval' && repetitions > 1) {
    // Serie con repeticiones explícitas: intervalo (+ descanso) repetido.
    for (let i = 0; i < repetitions; i += 1) {
      nodes.push(work);
      if (rest) nodes.push(rest);
    }
    return true;
  }

  nodes.push(work);
  // Descanso tras el trabajo (estructura observada en la plantilla de
  // referencia: warmup → training → rest).
  if (rest) nodes.push(rest);
  return true;
}

function hasValidDimension(block: RunBlock): boolean {
  const hasDistance = Number.isFinite(block.distanceMeters) && block.distanceMeters > 0;
  const hasDuration = Number.isFinite(block.durationSeconds ?? 0) && (block.durationSeconds ?? 0) > 0;
  // Una dimensión, no ambas: evitar ambigüedades al convertir.
  return hasDistance !== hasDuration;
}

function workStage(block: RunBlock): string {
  switch (block.type) {
    case 'warmup': return ZEPP_INTERVAL_TYPE.warmup;
    case 'cooldown': return ZEPP_INTERVAL_TYPE.cooldown;
    case 'recovery': return ZEPP_INTERVAL_TYPE.rest;
    case 'interval':
    case 'steady':
    default: return ZEPP_INTERVAL_TYPE.work;
  }
}

/** Nodo Zepp desde un valor canónico (metros enteros o segundos enteros). */
function zeppNode(intervalType: string, value: StageValue): ZeppIntervalNode | null {
  if (!Number.isInteger(value.value) || value.value < 1 || value.value > MAX_INTERVAL_VALUE) return null;
  return {
    type: 'NODE',
    trainingInterval: {
      intervalType,
      intervalUnit: value.unit,
      intervalUnitValue: String(value.value),
      alertRule: '0',
      alertRuleDetail: '0-0',
      lengthUnit: 0,
      intervalGuide: null,
      intervalGuideI18nKey: null,
      intervalTypeI18nKey: ZEPP_INTERVAL_TYPE_I18N_KEY[intervalType] ?? null,
      intervalUnitI18nKey: ZEPP_UNIT_I18N_KEY[value.unit] ?? null,
      alertRuleI18nKey: null,
      lengthUnitI18nKey: ZEPP_LENGTH_UNIT_I18N_KEY,
    },
  };
}

/** Valor canónico del bloque: preferimos tiempo cuando está declarado. */
function blockValue(block: RunBlock): StageValue {
  const hasDuration = (block.durationSeconds ?? 0) > 0;
  return hasDuration
    ? { unit: ZEPP_UNIT.seconds, value: block.durationSeconds! }
    : { unit: ZEPP_UNIT.distanceMeters, value: block.distanceMeters };
}

function blockError(block: RunBlock): string {
  return `El bloque "${block.type}" no se puede exportar de forma fiable: revisa que cada bloque tenga distancia en metros o duración en segundos, con repeticiones (1–20) y descansos válidos.`;
}

/** Ritmo en m/km legible (m:ss min/km), sin depender de domain/training. */
function paceLabel(secondsPerKm: number): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '—';
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds} min/km`;
}

function normalizeText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}
