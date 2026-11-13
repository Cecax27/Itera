// Dominio de exportación a Zepp: adaptador de plantillas, deep link y
// puerto de publicación. TypeScript puro, sin React ni Firebase.

export {
  buildZeppTemplate,
  MAX_ZEPP_NODES,
} from './template';
export type {
  ZeppTemplate,
  ZeppTemplateInput,
  ZeppTemplateResult,
  ZeppIntervalNode,
  ZeppTrainingInterval,
} from './template';

export {
  buildAmazfitDeepLink,
  AMZFIT_DEEP_LINK_PREFIX,
  AMZFIT_TEMPLATE_NAME,
} from './deep-link';

export type {
  PublishedZeppTemplate,
  ZeppTemplateRepository,
} from './repository';
