// Asistente de creación de plan con IA.
//
// Flujo guiado (7 pasos) lanzable desde Plan en cualquier momento:
//   intro → objetivo → días y experiencia → disponibilidad →
//   equipamiento → notas → revisión y generación.
//
// El último paso envía el brief al modelo y previsualiza el plan
// propuesto. Solo si el usuario confirma ("Usar este plan") se guarda
// como plan activo, sustituyendo el anterior. Los entrenamientos ya
// realizados se conservan siempre.
//
// UX:
// - Validación en línea por paso (nada de Alerts al final): los errores
//   del dominio (planBriefFieldErrors) se muestran junto a cada campo.
// - Fechas y horas se eligen con selectores, nunca a mano.
// - Si algo falta en Revisión, se lista con salto directo al paso que
//   lo corrige en lugar de bloquear sin explicación.
// - Cerrar con datos sin usar pide confirmación para no perder nada.
//
// Requiere API key de OpenAI y modelo configurados en Ajustes: los datos
// viajan a Functions y la clave nunca llega a Firestore.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  Button,
  Chip,
  DatePickerField,
  EquipmentChecklist,
  formatDateEs,
  Screen as ScreenLayout,
  TextField,
  WeekAvailabilityEditor,
} from '@/app/components';
import { FadeIn } from '@/app/animations';
import { useAssistantSettings, usePlanBuilder } from '@/app/hooks';
import { useThemeTokens } from '@/app/theme';
import {
  Equipment,
  ExperienceLevel,
  Goal,
  Profile,
  WeekDay,
  emptyEquipment,
  emptyAvailability,
} from '@/domain/profile';
import {
  addUtcDays,
  MAX_BRIEF_DESCRIPTION_LENGTH,
  MAX_BRIEF_NOTES_LENGTH,
  MAX_BRIEF_TARGET_LENGTH,
  PLAN_FOCUS_OPTIONS,
  Plan,
  PlanBrief,
  PlanBriefField,
  PlanFocus,
  GeneratedPlanResult,
  Session,
  dateForWeekDay,
  planBriefFieldErrors,
  validatePlanBrief,
} from '@/domain/planning';

type Step =
  | 'intro'
  | 'objective'
  | 'days'
  | 'availability'
  | 'equipment'
  | 'notes'
  | 'review';

const STEPS: readonly Step[] = ['intro', 'objective', 'days', 'availability', 'equipment', 'notes', 'review'];

const WEEK_DAYS: readonly WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const DAY_SHORT_LABELS: Record<WeekDay, string> = {
  mon: 'Lun', tue: 'Mar', wed: 'Mié', thu: 'Jue', fri: 'Vie', sat: 'Sáb', sun: 'Dom',
};

/** Paso al que saltar para corregir cada campo validable del brief. */
const FIELD_STEP: Record<PlanBriefField, Step> = {
  'objective.description': 'objective',
  'objective.target': 'objective',
  sessionsPerWeek: 'days',
  experience: 'days',
  focus: 'days',
  availability: 'availability',
  notes: 'notes',
};

export interface PlanBuilderScreenProps {
  profile: Profile;
  /** Guarda el plan confirmado como plan activo (usePlan.savePlan). */
  onApplyPlan: (plan: Plan) => Promise<void>;
  onClose: () => void;
  /** Abre Ajustes cuando falta la API key o el modelo. */
  onOpenSettings: () => void;
}

export function PlanBuilderScreen({ profile, onApplyPlan, onClose, onOpenSettings }: PlanBuilderScreenProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const insets = useSafeAreaInsets();
  const { refresh: refreshSettings, apiKeySaved, selectedModel } = useAssistantSettings();
  const { generating, error: generationError, draft, generate, resetDraft } = usePlanBuilder();

  const [step, setStep] = useState<Step>('intro');
  const [objective, setObjective] = useState<Goal>(() => ({
    id: 'builder-primary',
    description: '',
    discipline: profile.primaryGoal.discipline,
    target: '',
  }));
  const [sessionsPerWeek, setSessionsPerWeek] = useState(defaultSessionsPerWeek(profile));
  const [experience, setExperience] = useState<ExperienceLevel>(profile.experience);
  const [focus, setFocus] = useState<PlanFocus | null>(null);
  const [availability, setAvailability] = useState<Record<WeekDay, readonly { start: string; end: string }[]>>(
    () => cloneAvailability(profile.availability),
  );
  const [equipment, setEquipment] = useState<Equipment>(() => profile.equipment ?? emptyEquipment());
  const [notes, setNotes] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  /** Pasos cuya validación ya se intentó (para no gritar antes de tiempo). */
  const [attempted, setAttempted] = useState<Partial<Record<Step, boolean>>>({});

  // Al volver de Ajustes, refresca la configuración del asistente.
  useFocusEffect(useCallback(() => {
    void refreshSettings();
  }, [refreshSettings]));

  const stepIndex = STEPS.indexOf(step);
  const configured = apiKeySaved && Boolean(selectedModel);

  const brief: PlanBrief = {
    objective,
    sessionsPerWeek,
    availability,
    equipment,
    experience,
    focus,
    notes,
  };

  const fieldErrors = planBriefFieldErrors(brief);

  const availableDays = useMemo(
    () => Object.values(availability).filter((slots) => slots.length > 0).length,
    [availability],
  );

  // Instantánea del estado inicial para saber si hay datos sin guardar.
  const initialSnapshot = useRef(
    JSON.stringify([objective, sessionsPerWeek, experience, focus, availability, equipment, notes]),
  ).current;
  const stateSnapshot = JSON.stringify([objective, sessionsPerWeek, experience, focus, availability, equipment, notes]);
  const dirty = stateSnapshot !== initialSnapshot || stepIndex > 0;

  // Propuesta generada con datos ya modificados → conviene regenerar.
  const generatedSnapshot = useRef<string | null>(null);
  const draftStale = Boolean(draft) && generatedSnapshot.current !== stateSnapshot;

  const onGenerate = useCallback(async () => {
    try {
      validatePlanBrief(brief);
    } catch (err) {
      Alert.alert(
        'Revisa las respuestas',
        err instanceof Error ? err.message : 'Faltan datos para generar el plan.',
      );
      return;
    }
    generatedSnapshot.current = stateSnapshot;
    await generate(brief);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief, generate, stateSnapshot]);

  const onApply = async () => {
    if (!draft) return;
    setApplying(true);
    try {
      await onApplyPlan(draft.plan);
      setApplied(true);
    } catch (err) {
      Alert.alert('No se pudo guardar el plan', err instanceof Error ? err.message : 'Inténtalo de nuevo.');
    } finally {
      setApplying(false);
    }
  };

  const onBack = () => setStep(STEPS[Math.max(0, stepIndex - 1)]);

  const onNext = () => {
    if (!stepValid(step, fieldErrors)) {
      setAttempted((prev) => ({ ...prev, [step]: true }));
      return;
    }
    setStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)]);
  };

  const requestClose = () => {
    if (applied || !dirty) {
      onClose();
      return;
    }
    Alert.alert(
      '¿Cerrar el asistente?',
      'Se perderán los cambios que no hayas usado en un plan.',
      [
        { text: 'Seguir editando', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: onClose },
      ],
    );
  };

  return (
    <Modal visible animationType="slide" onRequestClose={requestClose} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: tokens.colors.canvas, paddingTop: Math.max(16, insets.top) }]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={requestClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar asistente"
            style={styles.closeButton}
          >
            <Text style={[styles.closeText, { color: tokens.colors.ink }]}>Cerrar</Text>
          </Pressable>
          <Text style={[styles.topLabel, { color: tokens.colors.textSecondary }]}>NUEVO PLAN · IA</Text>
          <View style={styles.closeButton} />
        </View>

        <View style={styles.header}>
          <View style={styles.progress}>
            {STEPS.map((s, i) => (
              <View
                key={s}
                style={[styles.progressSegment, i <= stepIndex && { backgroundColor: tokens.colors.accent }]}
              />
            ))}
          </View>
          <Text style={[styles.stepCount, { color: tokens.colors.textSecondary }]}>
            PASO {stepIndex + 1} DE {STEPS.length}
          </Text>
          <Text style={[styles.stepTitle, { color: tokens.colors.ink }]}>{labelFor(step)}</Text>
          {subtitleFor(step) && (
            <Text style={[styles.stepSubtitle, { color: tokens.colors.textSecondary }]}>{subtitleFor(step)}</Text>
          )}
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScreenLayout scroll>
            <FadeIn delay={0} key={step}>
              {step === 'intro' && <IntroStep configured={configured} onOpenSettings={onOpenSettings} />}
              {step === 'objective' && (
                <ObjectiveStep
                  objective={objective}
                  setObjective={setObjective}
                  showErrors={Boolean(attempted.objective)}
                  fieldErrors={fieldErrors}
                />
              )}
              {step === 'days' && (
                <DaysStep
                  sessionsPerWeek={sessionsPerWeek}
                  setSessionsPerWeek={setSessionsPerWeek}
                  availableDays={availableDays}
                  experience={experience}
                  setExperience={setExperience}
                  focus={focus}
                  setFocus={setFocus}
                />
              )}
              {step === 'availability' && (
                <View>
                  <WeekAvailabilityEditor
                    availability={availability}
                    onChange={setAvailability}
                    helper="Ajusta tus franjas para este plan. La IA solo programará en días con franja disponible."
                  />
                  {availableDays === 0 && (
                    <Text style={[styles.inlineError, { color: tokens.colors.error }]} accessibilityLiveRegion="polite">
                      Marca al menos un día con franja disponible.
                    </Text>
                  )}
                  {availableDays > 0 && availableDays < sessionsPerWeek && (
                    <Text style={[styles.inlineError, { color: tokens.colors.error }]}>
                      Quieres entrenar {sessionsPerWeek} días, pero solo has marcado {availableDays}. Añade más
                      franjas o reduce los días en el paso anterior.
                    </Text>
                  )}
                </View>
              )}
              {step === 'equipment' && (
                <EquipmentChecklist
                  equipment={equipment}
                  onChange={setEquipment}
                  helper="La IA usará solo el equipamiento que marques aquí."
                />
              )}
              {step === 'notes' && (
                <View>
                  <TextField
                    label="Notas para el asistente"
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Ej. Prefiero la carrera larga el fin de semana, la fuerza temprano y evito los intervalos."
                    multiline
                    maxLength={MAX_BRIEF_NOTES_LENGTH}
                  />
                  {(profile.restrictions.injuries.length > 0 || profile.restrictions.notes.length > 0) && (
                    <Text style={[styles.bodyText, { color: tokens.colors.textSecondary, marginTop: 4 }]}>
                      Tu perfil ya declara restricciones: {profile.restrictions.injuries.join(', ') || '—'}
                      {profile.restrictions.notes ? ` · ${profile.restrictions.notes}` : ''}
                    </Text>
                  )}
                </View>
              )}
              {step === 'review' && (
                <ReviewStep
                  configured={configured}
                  onOpenSettings={onOpenSettings}
                  draft={draft}
                  draftStale={draftStale}
                  generating={generating}
                  generationError={generationError}
                  fieldErrors={fieldErrors}
                  onFixField={(field) => setStep(FIELD_STEP[field])}
                  onGenerate={() => void onGenerate()}
                  onApply={() => void onApply()}
                  onDiscard={() => resetDraft()}
                  onBack={onBack}
                  applying={applying}
                  applied={applied}
                  onClose={onClose}
                />
              )}
            </FadeIn>
          </ScreenLayout>

          {step !== 'review' && (
            <View
              style={[
                styles.bottomBar,
                { borderTopColor: tokens.colors.border, paddingBottom: Math.max(tokens.spacing.md, insets.bottom) },
              ]}
            >
              {step === 'intro' ? (
                <Button label="Empezar" onPress={onNext} variant="outline" />
              ) : (
                <>
                  <Button label="Atrás" onPress={onBack} variant="secondary" fullWidth={false} />
                  <Button label="Siguiente" onPress={onNext} variant="primary" fullWidth={false} />
                </>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/** ¿Se puede avanzar desde este paso? Usa los mismos errores que la revisión. */
function stepValid(step: Step, fieldErrors: Partial<Record<PlanBriefField, string>>): boolean {
  switch (step) {
    case 'objective': return !fieldErrors['objective.description'] && !fieldErrors['objective.target'];
    case 'days': return !fieldErrors.sessionsPerWeek && !fieldErrors.experience && !fieldErrors.focus;
    case 'availability': return !fieldErrors.availability;
    case 'notes': return !fieldErrors.notes;
    default: return true;
  }
}

function defaultSessionsPerWeek(profile: Profile): number {
  const fromProfile = Object.values(profile.availability).filter((slots) => slots.length > 0).length;
  return Math.max(1, Math.min(7, fromProfile));
}

function cloneAvailability(
  profileAvailability: Profile['availability'],
): Record<WeekDay, { start: string; end: string }[]> {
  const clone: Record<WeekDay, { start: string; end: string }[]> = {
    mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
  };
  for (const day of WEEK_DAYS) {
    clone[day] = [...(profileAvailability[day] ?? emptyAvailability()[day])];
  }
  return clone;
}

function labelFor(step: Step): string {
  switch (step) {
    case 'intro': return 'Nuevo plan';
    case 'objective': return 'Objetivo';
    case 'days': return 'Ritmo semanal';
    case 'availability': return 'Disponibilidad';
    case 'equipment': return 'Equipamiento';
    case 'notes': return 'Notas';
    case 'review': return 'Revisión';
  }
}

function subtitleFor(step: Step): string {
  switch (step) {
    case 'intro': return '';
    case 'objective': return 'Qué quieres conseguir y para cuándo.';
    case 'days': return 'Cuántos días entrenas y tu experiencia.';
    case 'availability': return 'Cuándo puedes entrenar cada día.';
    case 'equipment': return 'Con qué material cuentas.';
    case 'notes': return 'Contexto extra para el modelo.';
    case 'review': return 'Comprueba la propuesta antes de usarla.';
  }
}

// --- Pasos ---

function IntroStep({ configured, onOpenSettings }: { configured: boolean; onOpenSettings: () => void }) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  return (
    <View>
      <Text style={[styles.bodyText, { color: tokens.colors.textSecondary }]}>
        Te haré unas preguntas sobre tu objetivo, tus días y tu material. Al final, la IA diseñará
        una propuesta de plan semanal para que la revises antes de usarla.
      </Text>
      <Text style={[styles.bodyText, { color: tokens.colors.textSecondary }]}>
        Tu plan actual se sustituye solo si aceptas la propuesta. Los entrenamientos ya registrados
        se conservan.
      </Text>

      <View style={[styles.statusRow, { backgroundColor: tokens.colors.surfaceElevated, borderColor: tokens.colors.border }]}>
        <Ionicons
          name={configured ? 'checkmark-circle' : 'alert-circle'}
          size={18}
          color={configured ? tokens.colors.success : tokens.colors.error}
        />
        <Text style={[styles.statusText, { color: tokens.colors.ink }]}>
          {configured
            ? 'API de OpenAI configurada y lista.'
            : 'Falta tu API key de OpenAI o el modelo en Ajustes.'}
        </Text>
      </View>

      {!configured && (
        <View style={[styles.notice, { borderColor: tokens.colors.border, backgroundColor: tokens.colors.surfaceElevated }]}>
          <Text style={styles.noticeTitle}>Configuración pendiente</Text>
          <Text style={[styles.bodyText, { color: tokens.colors.textSecondary }]}>
            Para generar el plan necesitas tu API key de OpenAI y un modelo elegido en Ajustes.
          </Text>
          <Button label="Abrir Ajustes" onPress={onOpenSettings} variant="secondary" />
        </View>
      )}
    </View>
  );
}

interface ObjectiveProps {
  objective: Goal;
  setObjective: (goal: Goal) => void;
  /** Muestra los errores del paso (tras intentar avanzar). */
  showErrors: boolean;
  fieldErrors: Partial<Record<PlanBriefField, string>>;
}

function ObjectiveStep({ objective, setObjective, showErrors, fieldErrors }: ObjectiveProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const descriptionError = showErrors ? fieldErrors['objective.description'] : undefined;

  return (
    <View>
      <TextField
        label="¿Qué quieres conseguir?"
        value={objective.description}
        onChangeText={(d) => setObjective({ ...objective, description: d })}
        placeholder="Ej. Correr un 10K en menos de 50 minutos · Levantar 100 kg en sentadilla · Mejorar mi condición"
        multiline
        maxLength={MAX_BRIEF_DESCRIPTION_LENGTH}
        error={descriptionError}
        helper="Describelo con tus palabras; la IA lo usará para priorizar."
      />
      <Text style={[styles.sectionLabel, { color: tokens.colors.ink }]}>Disciplina principal</Text>
      <View style={styles.chipRow}>
        <Chip label="Carrera" selected={objective.discipline === 'running'} onPress={() => setObjective({ ...objective, discipline: 'running' })} />
        <Chip label="Fuerza" selected={objective.discipline === 'strength'} onPress={() => setObjective({ ...objective, discipline: 'strength' })} />
      </View>
      <TextField
        label="Meta concreta (opcional)"
        value={objective.target}
        onChangeText={(t) => setObjective({ ...objective, target: t })}
        placeholder="Ej. 50:00 en 10 km · 100 kg · 75 kg de peso"
        maxLength={MAX_BRIEF_TARGET_LENGTH}
      />
      <DatePickerField
        label="Fecha objetivo (opcional)"
        value={objective.targetDate}
        onChange={(date) => setObjective({ ...objective, targetDate: date })}
        helper="Día de tu prueba o evento; la IA contará las semanas hacia ella."
      />
    </View>
  );
}

interface DaysStepProps {
  sessionsPerWeek: number;
  setSessionsPerWeek: (value: number) => void;
  availableDays: number;
  experience: ExperienceLevel;
  setExperience: (value: ExperienceLevel) => void;
  focus: PlanFocus | null;
  setFocus: (value: PlanFocus | null) => void;
}

function DaysStep({
  sessionsPerWeek,
  setSessionsPerWeek,
  availableDays,
  experience,
  setExperience,
  focus,
  setFocus,
}: DaysStepProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  return (
    <View>
      <Text style={[styles.sectionLabel, { color: tokens.colors.ink }]}>¿Cuántos días quieres entrenar a la semana?</Text>
      <View style={styles.dayChipsRow}>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <Chip
            key={n}
            label={String(n)}
            selected={sessionsPerWeek === n}
            onPress={() => setSessionsPerWeek(n)}
            style={styles.dayChip}
          />
        ))}
      </View>
      {sessionsPerWeek > availableDays && (
        <Text style={[styles.inlineError, { color: tokens.colors.error }]} accessibilityLiveRegion="polite">
          Tu disponibilidad actual cubre {availableDays} día(s). Puedes ajustarla en el siguiente paso
          o elegir menos días aquí.
        </Text>
      )}
      <Text style={[styles.sectionLabel, { color: tokens.colors.ink }]}>Experiencia</Text>
      <View style={styles.chipRow}>
        {(['beginner', 'intermediate', 'advanced'] as const).map((lvl) => (
          <Chip
            key={lvl}
            label={experienceLabel(lvl)}
            selected={experience === lvl}
            onPress={() => setExperience(lvl)}
          />
        ))}
      </View>
      <Text style={[styles.sectionLabel, { color: tokens.colors.ink }]}>Reparto carrera / fuerza (opcional)</Text>
      <View style={styles.chipRow}>
        <Chip
          label="Sin preferencia"
          selected={focus === null}
          onPress={() => setFocus(null)}
        />
        {PLAN_FOCUS_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={focus === option.value}
            onPress={() => setFocus(option.value)}
          />
        ))}
      </View>
    </View>
  );
}

function experienceLabel(lvl: ExperienceLevel): string {
  switch (lvl) {
    case 'beginner': return 'Principiante';
    case 'intermediate': return 'Intermedio';
    case 'advanced': return 'Avanzado';
  }
}

interface ReviewStepProps {
  configured: boolean;
  onOpenSettings: () => void;
  draft: GeneratedPlanResult | null;
  /** true si el brief cambió desde que se generó el borrador. */
  draftStale: boolean;
  generating: boolean;
  generationError: string | null;
  fieldErrors: Partial<Record<PlanBriefField, string>>;
  onFixField: (field: PlanBriefField) => void;
  onGenerate: () => void;
  onApply: () => void;
  onDiscard: () => void;
  onBack: () => void;
  applying: boolean;
  applied: boolean;
  onClose: () => void;
}

function ReviewStep({
  configured,
  onOpenSettings,
  draft,
  draftStale,
  generating,
  generationError,
  fieldErrors,
  onFixField,
  onGenerate,
  onApply,
  onDiscard,
  onBack,
  applying,
  applied,
  onClose,
}: ReviewStepProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const issues = Object.entries(fieldErrors) as [PlanBriefField, string][];

  /** Semana del bloque que se previsualiza (si el plan es multi-semana). */
  const [previewIndex, setPreviewIndex] = useState(0);
  // Un borrador nuevo vuelve a mostrar la primera semana.
  useEffect(() => { setPreviewIndex(0); }, [draft?.plan.weekStart]);

  if (applied) {
    return (
      <View>
        <Text style={[styles.bodyText, { color: tokens.colors.ink }]}>
          Plan aplicado. Ya puedes verlo en la pantalla Plan y empezar tu próxima sesión.
        </Text>
        <Button label="Volver a mi plan" onPress={onClose} />
      </View>
    );
  }

  if (!draft) {
    return (
      <View>
        {issues.length > 0 && (
          <View style={[styles.blockCard, { borderColor: tokens.colors.error, backgroundColor: tokens.colors.errorSurface }]}>
            <Text style={[styles.blockTitle, { color: tokens.colors.ink }]}>Antes de generar, revisa:</Text>
            {issues.map(([field, message]) => (
              <Pressable
                key={field}
                onPress={() => onFixField(field)}
                style={styles.issueRow}
                accessibilityRole="button"
                accessibilityLabel={`Corregir: ${message}`}
              >
                <Text style={[styles.issueText, { color: tokens.colors.ink }]}>{message}</Text>
                <Text style={[styles.issueFix, { color: tokens.colors.ink }]}>Corregir</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Button
          label={generating ? 'Generando…' : 'Generar plan con IA'}
          onPress={onGenerate}
          loading={generating}
          disabled={!configured || issues.length > 0}
        />
        {issues.length > 0 && !generating && (
          <Text style={[styles.bodyText, { color: tokens.colors.textSecondary, marginTop: 8 }]}>
            Completa los datos marcados arriba para poder generar el plan.
          </Text>
        )}
        {generating && (
          <Text style={[styles.bodyText, { color: tokens.colors.textSecondary, marginTop: 8 }]}>
            El modelo está diseñando tu plan. Puede tardar unos segundos.
          </Text>
        )}
        {generationError && (
          <Text style={[styles.bodyText, { color: tokens.colors.error, marginTop: 8 }]} accessibilityLiveRegion="assertive">
            {generationError}
          </Text>
        )}
        {!configured && !generating && (
          <View style={[styles.notice, { borderColor: tokens.colors.border, backgroundColor: tokens.colors.surfaceElevated }]}>
            <Text style={[styles.bodyText, { color: tokens.colors.textSecondary }]}>
              Configura tu API key de OpenAI y el modelo en Ajustes para activar la generación.
            </Text>
            <Button label="Abrir Ajustes" onPress={onOpenSettings} variant="secondary" />
          </View>
        )}
        <Button label="Atrás" onPress={onBack} variant="secondary" style={{ marginTop: 8 }} />
      </View>
    );
  }

  // A partir de aquí existe un borrador: previsualizamos la semana elegida.
  const previewWeek = draft.plan.weeks[Math.min(previewIndex, draft.plan.weeks.length - 1)];

  return (
    <View>
      <Text style={[styles.bodyText, { color: tokens.colors.textSecondary }]}>
        {draft.explanation}
      </Text>

      {draftStale && (
        <View style={[styles.notice, { borderColor: tokens.colors.border, backgroundColor: tokens.colors.surfaceElevated }]}>
          <Text style={[styles.bodyText, { color: tokens.colors.textSecondary }]}>
            Has cambiado datos desde que se generó esta propuesta. Regenera para que refleje tus respuestas.
          </Text>
        </View>
      )}

      <View style={[styles.planCard, { borderColor: tokens.colors.border, backgroundColor: tokens.colors.surfaceElevated }]}>
        {draft.plan.weeks.length > 1 ? (
          <>
            <Text style={styles.planCardTitle}>
              Bloque del {formatDateEs(draft.plan.weeks[0].weekStart)} al {formatDateEs(blockEndDate(draft.plan))}
            </Text>
            <Text style={[styles.planBlockNote, { color: tokens.colors.textSecondary }]}>
              {draft.plan.weeks.length} semanas
              {draft.plan.goalDate ? ` · fecha objetivo: ${formatDateEs(draft.plan.goalDate)}` : ''}
            </Text>
            <View style={styles.weekChipRow}>
              {draft.plan.weeks.map((week, index) => (
                <Chip
                  key={week.weekStart}
                  label={`Sem ${index + 1}`}
                  selected={index === previewIndex}
                  onPress={() => setPreviewIndex(index)}
                />
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.planCardTitle}>Semana del {formatDateEs(draft.plan.weekStart)}</Text>
        )}
        {WEEK_DAYS.map((day) => {
          const sessions = previewWeek.sessions[day] ?? [];
          const date = dateForWeekDay(previewWeek.weekStart, day);
          return (
            <View key={day} style={styles.planRow}>
              <Text style={styles.planDay}>
                {DAY_SHORT_LABELS[day]}{date ? ` ${date.slice(8, 10)}` : ''}
              </Text>
              <View style={styles.planSessions}>
                {sessions.length === 0 ? (
                  <Text style={[styles.planSession, { color: tokens.colors.textSecondary }]}>Descanso</Text>
                ) : sessions.map((session, i) => (
                  <View key={i} style={styles.planSessionRow}>
                    <View
                      style={[
                        styles.planDot,
                        { backgroundColor: session.discipline === 'strength' ? tokens.colors.accent : tokens.colors.accentRun },
                      ]}
                    />
                    <Text style={styles.planSession}>
                      {sessionTitle(session)} · ~{session.estimatedDurationMinutes} min
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>

      {draft.warnings.length > 0 && (
        <View style={styles.warningsBlock}>
          {draft.warnings.map((warning, i) => (
            <Text key={i} style={[styles.bodyText, { color: tokens.colors.ink }]}>⚠ {warning}</Text>
          ))}
        </View>
      )}

      {draft.safetyNotice && (
        <View style={[styles.notice, { borderColor: tokens.colors.border, backgroundColor: tokens.colors.surfaceElevated }]}>
          <Text style={styles.noticeTitle}>Aviso de seguridad</Text>
          <Text style={[styles.bodyText, { color: tokens.colors.textSecondary }]}>{draft.safetyNotice}</Text>
        </View>
      )}

      {draft.assumptions.length > 0 && (
        <View style={styles.assumptionsBlock}>
          <Text style={[styles.bodyText, { color: tokens.colors.textSecondary }]}>
            Suposiciones del modelo:
          </Text>
          {draft.assumptions.map((assumption, i) => (
            <Text key={i} style={[styles.bodyText, { color: tokens.colors.textSecondary }]}>· {assumption}</Text>
          ))}
        </View>
      )}

      <Text style={[styles.bodyText, { color: tokens.colors.textSecondary, marginTop: 8 }]}>
        Al usar este plan sustituyes el plan actual. Los entrenamientos ya registrados se conservan.
      </Text>

      <Button label={applying ? 'Guardando…' : 'Usar este plan'} onPress={onApply} loading={applying} />
      <Button label="Regenerar propuesta" onPress={onDiscard} variant="ghost" style={{ marginTop: 8 }} />
      <Button label="Atrás" onPress={onBack} variant="secondary" style={{ marginTop: 8, marginBottom: 16 }} />
    </View>
  );
}

/** Último día visible del bloque: la fecha objetivo o el domingo de la última semana. */
function blockEndDate(plan: Plan): string {
  if (plan.goalDate) return plan.goalDate;
  const lastWeek = plan.weeks[plan.weeks.length - 1];
  return addUtcDays(lastWeek.weekStart, 6);
}

function sessionTitle(session: Session): string {
  if (session.discipline === 'strength') {
    switch (session.type) {
      case 'upper': return 'Tren superior';
      case 'lower': return 'Tren inferior';
      case 'full_body': return 'Cuerpo completo';
      case 'accessory': return 'Accesorios';
    }
  }
  switch (session.type) {
    case 'easy': return 'Carrera suave';
    case 'long': return 'Carrera larga';
    case 'tempo': return 'Tempo';
    case 'intervals': return 'Intervalos';
    case 'race': return 'Competición';
  }
}

function makeStyles(tokens: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
    root: { flex: 1 },
    flex: { flex: 1 },
    topBar: {
      height: 48,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    closeButton: { minWidth: 56, minHeight: 44, justifyContent: 'center' },
    closeText: { fontSize: 15, fontWeight: '600' },
    topLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1 },
    header: {
      paddingHorizontal: tokens.spacing.xl,
      marginBottom: 4,
    },
    progress: { flexDirection: 'row', gap: 6, marginBottom: 12 },
    progressSegment: {
      flex: 1,
      height: 4,
      borderRadius: 999,
      backgroundColor: tokens.colors.inactiveBackground,
    },
    stepCount: {
      fontSize: tokens.fontSize.caption,
      fontWeight: '600',
      letterSpacing: 1.5,
    },
    stepTitle: {
      fontSize: tokens.fontSize.titleScreen,
      fontWeight: tokens.fontWeight.semibold,
      marginTop: 2,
    },
    stepSubtitle: { fontSize: tokens.fontSize.body, marginTop: 4, lineHeight: 21 },
    bodyText: { fontSize: 15, lineHeight: 22, marginBottom: 10 },
    sectionLabel: { fontSize: 13, fontWeight: '500', marginBottom: 8, marginTop: 14 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    dayChipsRow: { flexDirection: 'row', gap: 6 },
    dayChip: { flex: 1, paddingHorizontal: 0, justifyContent: 'center', alignItems: 'center' },
    inlineError: { fontSize: tokens.fontSize.label, lineHeight: 18, marginTop: 6, marginBottom: 8 },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderRadius: tokens.radius.md,
      paddingHorizontal: 14,
      minHeight: 44,
      marginTop: 8,
    },
    statusText: { flex: 1, fontSize: tokens.fontSize.label, lineHeight: 18 },
    bottomBar: {
      justifyContent: 'flex-end',
      flexDirection: 'row',
      gap: tokens.spacing.md,
      paddingHorizontal: tokens.spacing.xl,
      paddingVertical: tokens.spacing.md,
      borderTopWidth: 1,
      marginBottom: 15
    },
    notice: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8, marginTop: 12 },
    noticeTitle: { fontSize: 17, fontWeight: '600', color: tokens.colors.ink },
    blockCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
    blockTitle: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
    issueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
      paddingVertical: 6,
    },
    issueText: { flex: 1, fontSize: tokens.fontSize.body, lineHeight: 20 },
    issueFix: { fontSize: tokens.fontSize.body, fontWeight: tokens.fontWeight.semibold },
    planCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 4, marginBottom: 12 },
    planCardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8, color: tokens.colors.ink },
    planBlockNote: { fontSize: 13, marginTop: -4, marginBottom: 8 },
    weekChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    planRow: { flexDirection: 'row', gap: 12, paddingVertical: 6 },
    planDay: { width: 56, fontWeight: '600', fontSize: 14, color: tokens.colors.ink },
    planSessions: { flex: 1, gap: 2 },
    planSessionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    planDot: { width: 8, height: 8, borderRadius: 4 },
    planSession: { flex: 1, fontSize: 14, lineHeight: 20, color: tokens.colors.ink },
    warningsBlock: { marginBottom: 12, gap: 4 },
    assumptionsBlock: { marginBottom: 8 },
  });
}
