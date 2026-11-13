// Deep link de Amazfit/Zepp para importar una plantilla de entrenamiento.
//
// Formato observado en Run Planner (funcionando en producción):
//   amazfit://com.huami.watch.hmwatchmanager/action
//     ?name=trainingtemplate_crossfit
//     &target=share
//     &data=<URL_PUBLICA_DE_LA_PLANTILLA>
//
// Decisiones verificadas:
// - `name=trainingtemplate_crossfit` es el único valor observado en
//   producción. Pese a su nombre, Run Planner lo usa también para
//   plantillas de carrera, así que todo apunta a que es un identificador
//   genérico de "plantilla de entrenamiento". PENDIENTE de confirmar en
//   dispositivo real; no inventamos variantes por deporte.
// - La URL de `data` va SIN codificar (encodeURIComponent) en el enlace
//   observado: `://` y `/` aparecen literalmente. Reproducimos ese formato
//   tal cual; nuestra URL de plantilla solo contiene caracteres seguros
//   (https, '/', '-', alfanuméricos), sin '&' ni '?'.

export const AMZFIT_DEEP_LINK_PREFIX = 'amazfit://com.huami.watch.hmwatchmanager/action';
export const AMZFIT_TEMPLATE_NAME = 'trainingtemplate_crossfit';

export function buildAmazfitDeepLink(templateUrl: string): string {
  const trimmed = templateUrl.trim();
  if (!/^https:\/\/\S+$/.test(trimmed)) {
    throw new Error('La URL de la plantilla no es válida para construir el enlace de Zepp.');
  }
  return `${AMZFIT_DEEP_LINK_PREFIX}?name=${AMZFIT_TEMPLATE_NAME}&target=share&data=${trimmed}`;
}
