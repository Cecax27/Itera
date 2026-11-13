// Plantillas de entrenamiento para Zepp: creación autenticada y lectura
// pública.
//
// Dos operaciones lógicas:
//   1. createWorkoutTemplate (callable, requiere sesión): valida el JSON
//      de Zepp con un schema estricto, garantiza que no lleva datos
//      personales, lo almacena en Firestore con identificador aleatorio
//      e impredecible y devuelve { id, url }.
//   2. workoutTemplate (HTTP GET público): sirve el JSON exacto de la
//      plantilla con Content-Type: application/json. Zepp la descarga sin
//      sesión de Itera. Solo lectura: no existe forma de modificar una
//      plantilla desde su identificador público.
//
// El JSON que se sirve contiene únicamente la estructura del
// entrenamiento (título, descripción, etapas). Nunca incluye el uid del
// propietario ni ningún dato del perfil: username/avatar se fuerzan a "".
//
// Duplicados: se calcula un hash canónico del contenido; si ya existe una
// plantilla idéntica se reutiliza en vez de almacenar otra copia.

import { createHash } from 'node:crypto';
import { Firestore } from 'firebase-admin/firestore';
import { Request, Response } from 'express';
import { z } from 'zod';

export const REGION = 'us-central1';
const COLLECTION = 'workoutTemplates';
const TEMPLATE_ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;
const MAX_INTERVAL_VALUE = 100_000;

// --- Validación estricta del JSON de Zepp ---
//
// Solo acepta los valores observados empíricamente en el protocolo real
// (verificación de octubre de 2026). Cualquier código nuevo (tipos de
// etapa, unidades, i18n keys) debe añadirse aquí solo tras verificarse en
// un dispositivo: así impedimos almacenar plantillas inventadas.

const ZeppTrainingIntervalSchema = z.object({
  intervalType: z.enum(['0', '1', '2', '4']),
  intervalUnit: z.enum(['0', '1']),
  intervalUnitValue: z.string().regex(/^\d{1,6}$/).refine(
    (value) => {
      const parsed = Number(value);
      return parsed >= 1 && parsed <= MAX_INTERVAL_VALUE;
    },
    { message: 'intervalUnitValue debe estar entre 1 y 100000.' },
  ),
  alertRule: z.literal('0'),
  alertRuleDetail: z.literal('0-0'),
  lengthUnit: z.literal(0),
  intervalGuide: z.null(),
  intervalGuideI18nKey: z.null(),
  intervalTypeI18nKey: z.enum(['gapType_warmup', 'gapType_training', 'gapType_rest']).nullable(),
  intervalUnitI18nKey: z.enum(['gap_Km']).nullable(),
  alertRuleI18nKey: z.null(),
  lengthUnitI18nKey: z.literal('gap_metric'),
}).strict();

const ZeppNodeSchema = z.object({
  type: z.literal('NODE'),
  trainingInterval: ZeppTrainingIntervalSchema,
}).strict();

export const ZeppTemplateSchema = z.object({
  username: z.string().max(120),
  avatar: z.string().max(4000),
  shareUrl: z.string().startsWith('https://').max(300),
  title: z.string().min(1).max(80),
  description: z.string().max(300),
  trainingIntervals: z.object({
    type: z.literal('PARENT'),
    children: z.array(ZeppNodeSchema).min(1).max(40),
  }).strict(),
  appName: z.literal('com.xiaomi.hm.health'),
  status: z.literal('AVAILABLE'),
  trainingTypeId: z.literal(1),
  trainingTypeName: z.literal('户外跑'),
  isOfficial: z.null(),
  officialId: z.null(),
  estimatedDistance: z.null(),
  estimatedTime: z.null(),
  titleI18nKey: z.null(),
  descriptionI18nKey: z.null(),
  target: z.null(),
  targetI18nKey: z.null(),
  difficulty: z.null(),
  difficultyI18nKey: z.null(),
}).strict();

export type ZeppTemplateRecord = z.infer<typeof ZeppTemplateSchema>;

/**
 * Garantiza que la plantilla pública no contiene datos personales,
 * vengan como vengan del cliente. La URL es pública: no se exponen
 * usuarios, avatares ni identificadores de Itera.
 */
export function sanitizeTemplate(template: ZeppTemplateRecord): ZeppTemplateRecord {
  return { ...template, username: '', avatar: '' };
}

/** JSON canónico para el hash de deduplicación. */
function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function templateHash(template: ZeppTemplateRecord): string {
  return createHash('sha256').update(canonicalStringify(template)).digest('hex');
}

/**
 * URL pública de una plantilla. La base se puede sobreescribir con la
 * variable WORKOUT_TEMPLATE_BASE_URL (p. ej. dominio propio); por defecto
 * se usa el dominio estándar de Cloud Functions (2ª gen).
 */
export function publicTemplateUrl(id: string): string {
  const baseUrl = process.env.WORKOUT_TEMPLATE_BASE_URL
    ?? `https://${REGION}-${process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? 'itera-4f63c'}.cloudfunctions.net/workoutTemplate`;
  return `${baseUrl.replace(/\/+$/, '')}/${id}`;
}

/**
 * Publica la plantilla: reutiliza una copia idéntica si existe y, si no,
 * crea un documento con identificador aleatorio de Firestore (impredecible).
 * Devuelve id y URL pública.
 */
export async function storeWorkoutTemplate(
  db: Firestore,
  rawTemplate: ZeppTemplateRecord,
  ownerUid: string,
  now = Date.now,
): Promise<{ id: string; url: string }> {
  const template = sanitizeTemplate(rawTemplate);
  const hash = templateHash(template);

  const existing = await db.collection(COLLECTION).where('hash', '==', hash).limit(1).get();
  if (!existing.empty) {
    const doc = existing.docs[0];
    return { id: doc.id, url: publicTemplateUrl(doc.id) };
  }

  const createdAtMs = now();
  const docRef = db.collection(COLLECTION).doc();
  // El JSON servido incluye createdAt/updatedAt (epoch-ms), igual que la
  // referencia observada. ownerUid queda fuera del JSON público.
  await docRef.set({
    hash,
    ownerUid,
    createdAtMs,
    updatedAtMs: createdAtMs,
    template: { ...template, createdAt: createdAtMs, updatedAt: createdAtMs },
  });
  return { id: docRef.id, url: publicTemplateUrl(docRef.id) };
}

/**
 * Extrae y valida el identificador de plantilla de una petición GET.
 * Acepta la subruta (…/workoutTemplate/<id>, con o sin prefijo del nombre
 * de la función) y ?id=<id> como alternativa. Devuelve null si no hay
 * candidato sintácticamente válido: así nunca llegamos a Firestore con
 * basura.
 */
export function extractTemplateId(request: Request): string | null {
  const hasPath = request.path && request.path !== '/';
  const rawPath = hasPath
    ? request.path
    : (request.originalUrl ?? request.url ?? '').split('?')[0] ?? '';
  const segments = rawPath.split('/').filter(Boolean);
  const lastSegment = segments.at(-1) ?? '';
  const queryId = typeof request.query?.id === 'string' ? request.query.id : '';
  for (const candidate of [lastSegment, queryId]) {
    if (candidate && TEMPLATE_ID_PATTERN.test(candidate)) return candidate;
  }
  return null;
}

/**
 * Sirve el JSON de la plantilla para el endpoint público.
 * Devuelve 404 si no existe; 200 + JSON exacto si existe.
 */
export async function serveWorkoutTemplate(db: Firestore, request: Request, response: Response): Promise<void> {
  const id = extractTemplateId(request);
  if (!id) {
    response.status(404).json({ error: 'Plantilla no encontrada.' });
    return;
  }

  const snapshot = await db.collection(COLLECTION).doc(id).get();
  if (!snapshot.exists) {
    response.status(404).json({ error: 'Plantilla no encontrada.' });
    return;
  }

  const data = snapshot.data() as { template?: unknown } | undefined;
  if (!data?.template) {
    response.status(404).json({ error: 'Plantilla no encontrada.' });
    return;
  }

  // Solo el JSON de la plantilla; nunca ownerUid ni metadatos internos.
  response.set('Cache-Control', 'public, max-age=60');
  response.status(200).json(data.template);
}
