export interface SafetySignal {
  severity: 'caution' | 'urgent';
}

export function detectSafetySignal(text: string): SafetySignal | null {
  const normalized = normalizeText(text);
  if (/dolor[^.!?]{0,40}(pecho|torax|toracico)|opresion[^.!?]{0,40}(pecho|torax)|desmay|perdida del conocimiento|no puedo respirar|falta de aire intensa|dificultad para respirar|dificultad respiratoria intensa/.test(normalized)) {
    return { severity: 'urgent' };
  }
  if (/dolor|molestia|lesion|herid|mareo|maread|fiebre|enfermedad aguda|inflamacion|hinchazon|falta de aire|dificultad para respirar/.test(normalized)) {
    return { severity: 'caution' };
  }
  return null;
}

export function safetyReply(signal: SafetySignal) {
  return {
    text: signal.severity === 'urgent'
      ? 'Por seguridad, detén el entrenamiento. No puedo diagnosticar ni valorar estos síntomas. Busca atención sanitaria urgente o contacta los servicios de emergencia de tu zona.'
      : 'Por seguridad, pausa el entrenamiento y consulta a un profesional sanitario antes de retomarlo. No puedo diagnosticar ni determinar la causa de estos síntomas.',
    knownFacts: [] as string[],
    assumptions: [] as string[],
    planChange: null,
    source: 'engine' as const,
  };
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}
