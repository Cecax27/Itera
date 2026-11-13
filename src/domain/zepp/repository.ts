// Puerto del dominio para publicar plantillas de entrenamiento.
// La implementación concreta (Firebase Functions) vive en infrastructure.

export interface PublishedZeppTemplate {
  /** Identificador público e impredecible de la plantilla. */
  id: string;
  /** URL pública que devuelve el JSON de la plantilla (Content-Type JSON). */
  url: string;
}

export interface ZeppTemplateRepository {
  /**
   * Publica una plantilla Zepp ya validada y devuelve su URL pública.
   * Requiere sesión iniciada; la plantilla en sí no contiene datos
   * personales (el servidor lo revalida y lo garantiza).
   */
  createWorkoutTemplate(template: unknown): Promise<PublishedZeppTemplate>;
}
