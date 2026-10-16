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
// Requiere API key de OpenAI y modelo configurados en Ajustes: los datos
// viajan a Functions y la clave nunca llega a Firestore.

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Button,
  Chip,
  EquipmentChecklist,
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
  PLAN_FOCUS_OPTIONS,
  Plan,
  PlanBrief,
  PlanFocus,
  GeneratedPlanResult,
  dateForWeekDay,
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
  const { refresh: refreshSettings, apiKeySaved, selectedModel } = useAssistantSettings();
  const { generating, error: generationError, draft, generate, resetDraft } = usePlanBuilder();

  const [step, setStep] = useState<Step>('intro');
  const [objective, setObjective] = useState<Goal>(() => ({
    id: 'builder-primary',
    description: '',
    discipline: profile.primaryGoal.discipline,
    target: '',
  }));  const [sessionsPerWeek, setSessionsPerWeek] = useState(defaultSessionsPerWeek(profile));
  const [experience, setExperience] = useState<ExperienceLevel>(profile.experience);
  const [focus, setFocus] = useState<PlanFocus | null>(null);
  const [availability, setAvailability] = useState<Record<WeekDay, readonly { start: string; end: string }[]>>(
    () => cloneAvailability(profile.availability),
  );
  const [equipment, setEquipment] = useState<Equipment>(() => profile.equipment ?? emptyEquipment());
  const [notes, setNotes] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

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

  const availableDays = useMemo(
    () => Object.values(availability).filter((slots) => slots.length > 0).length,
    [availability],
  );

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
    await generate(brief);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief, generate]);

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
  const onNext = () => setStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)]);

  const canContinue =
    (step !== 'objective' || objective.description.trim().length > 0)
    && (step !== 'availability' || availableDays > 0);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: tokens.colors.canvas }]}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar asistente" style={styles.closeButton}>
            <Text style={[styles.closeText, { color: tokens.colors.ink }]}>Cerrar</Text>
          </Pressable>
          <Text style={[styles.topLabel, { color: tokens.colors.textSecondary }]}>NUEVO PLAN · IA</Text>
          <View style={styles.closeButton} />
        </View>

        <ScreenLayout scroll>
          <View style={styles.progress}>
            {STEPS.map((s, i) => (
              <View
                key={s}
                style={[styles.progressDot, i <= stepIndex && { backgroundColor: tokens.colors.accent }]}
              />
            ))}
          </View>

          <Text style={styles.stepLabel}>{labelFor(step)}</Text>

          <FadeIn delay={0} key={step}>
            {step === 'intro' && <IntroStep configured={configured} onOpenSettings={onOpenSettings} />}
            {step === 'objective' && <ObjectiveStep objective={objective} setObjective={setObjective} />}
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
                  helper="Estas son tus franjas actuales; ajústalas para este plan. La IA solo programará en días con franja disponible."
                />
                {availableDays === 0 && (
                  <Text style={[styles.bodyText, { color: tokens.colors.error, marginTop: 8 }]}>
                    Marca al menos un día con franja disponible.
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
                <Text style={[styles.bodyText, { color: tokens.colors.textSecondary }]}>
                  Cuenta lo que ayude a diseñar tu semana: preferencias, contexto y todo lo que quieras evitar. Opcional.
                </Text>
                <TextField
                  label="Notas para el asistente"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Ej. Prefiero la carrera larga el fin de semana, la fuerza temprano y evito los intervalos."
                  multiline
                  helper="Máximo 2000 caracteres."
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
                generating={generating}
                generationError={generationError}
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
          <View style={[styles.bottomBar, { borderTopColor: tokens.colors.border }]}>
            {step === 'intro' ? (
              <Button label="Empezar" onPress={onNext} variant="primary" />
            ) : (
              <>
                <Button label="Atrás" onPress={onBack} variant="secondary" fullWidth={false} />
                <Button
                  label="Siguiente"
                  onPress={onNext}
                  variant="primary"
                  fullWidth={false}
                  disabled={!canContinue}
                />
              </>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
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
}

function ObjectiveStep({ objective, setObjective }: ObjectiveProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  return (
    <View>
      <TextField
        label="¿Qué quieres conseguir?"
        value={objective.description}
        onChangeText={(d) => setObjective({ ...objective, description: d })}
        placeholder="Ej. Correr un 10K en menos de 50 minutos · Levantar 100 kg en sentadilla · Mejorar mi condición"
        multiline
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
      />
      <TextField
        label="Fecha objetivo (opcional)"
        value={objective.targetDate ?? ''}
        onChangeText={(d) => setObjective({ ...objective, targetDate: d || undefined })}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
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
      <Text style={[styles.sectionLabel, { color: tokens.colors.ink }]}>¿Cuántos días quieres entrenar?</Text>
      <View style={styles.chipRow}>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <Chip
            key={n}
            label={String(n)}
            selected={sessionsPerWeek === n}
            onPress={() => setSessionsPerWeek(n)}
          />
        ))}
      </View>
      {sessionsPerWeek > availableDays && (
        <Text style={[styles.bodyText, { color: tokens.colors.error, marginTop: 4 }]}>
          Marca al menos {sessionsPerWeek} día(s) con franja disponible.
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
        {PLAN_FOCUS_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={focus === option.value}
            onPress={() => setFocus(focus === option.value ? null : option.value)}
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
  generating: boolean;
  generationError: string | null;
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
  generating,
  generationError,
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
        <Button
          label={generating ? 'Generando…' : 'Generar plan con IA'}
          onPress={onGenerate}
          loading={generating}
          disabled={!configured}
        />
        {generating && (
          <Text style={[styles.bodyText, { color: tokens.colors.textSecondary, marginTop: 8 }]}>
            El modelo está diseñando tu semana. Puede tardar unos segundos.
          </Text>
        )}
        {generationError && (
          <Text style={[styles.bodyText, { color: tokens.colors.error, marginTop: 8 }]}>
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
      </View>
    );
  }

  return (
    <View>
      <Text style={[styles.bodyText, { color: tokens.colors.textSecondary }]}>
        {draft.explanation}
      </Text>

      <View style={[styles.planCard, { borderColor: tokens.colors.border, backgroundColor: tokens.colors.surfaceElevated }]}>
        <Text style={styles.planCardTitle}>Tu semana</Text>
        {WEEK_DAYS.map((day) => {
          const sessions = draft.plan.sessions[day];
          const date = dateForWeekDay(draft.plan.weekStart, day);
          return (
            <View key={day} style={styles.planRow}>
              <Text style={styles.planDay}>
                {DAY_SHORT_LABELS[day]}{date ? ` ${date.slice(8, 10)}` : ''}
              </Text>
              {sessions.length === 0 ? (
                <Text style={[styles.planSession, { color: tokens.colors.textSecondary }]}>Descanso</Text>
              ) : sessions.map((session, i) => (
                <Text key={i} style={styles.planSession}>
                  {sessionTitle(session)} · ~{session.estimatedDurationMinutes} min
                </Text>
              ))}
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

function sessionTitle(session: Plan['sessions'][WeekDay][number]): string {
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
    root: { flex: 1, paddingTop: 24 },
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
    progress: { flexDirection: 'row', gap: 6, marginBottom: 12 },
    progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colors.surface },
    stepLabel: {
      fontSize: tokens.fontSize.caption,
      color: tokens.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      marginBottom: tokens.spacing.md,
    },
    bodyText: { fontSize: 15, lineHeight: 22, marginBottom: 10 },
    sectionLabel: { fontSize: 13, fontWeight: '500', marginBottom: 8, marginTop: 14 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    bottomBar: {
      flexDirection: 'row',
      gap: tokens.spacing.md,
      paddingHorizontal: tokens.spacing.xl,
      paddingVertical: tokens.spacing.md,
      borderTopWidth: 1,
    },
    notice: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8, marginTop: 12 },
    noticeTitle: { fontSize: 17, fontWeight: '600', color: tokens.colors.ink },
    planCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 4, marginBottom: 12 },
    planCardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8, color: tokens.colors.ink },
    planRow: { flexDirection: 'row', gap: 12, paddingVertical: 6 },
    planDay: { width: 56, fontWeight: '600', fontSize: 14, color: tokens.colors.ink },
    planSession: { flex: 1, fontSize: 14, lineHeight: 20, color: tokens.colors.ink },
    warningsBlock: { marginBottom: 12, gap: 4 },
    assumptionsBlock: { marginBottom: 8 },
  });
}
