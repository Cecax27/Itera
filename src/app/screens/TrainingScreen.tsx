import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Card, Screen as ScreenLayout } from '@/app/components';
import { Session } from '@/domain/planning';
import {
  ActiveTrainingSession,
  advanceStrengthTrainingProgress,
  isRpe,
  Rpe,
  RunLog,
  SessionSetRecord,
  TrainingProgress,
  validatePositiveNumber,
} from '@/domain/training';
import { formatPace } from '@/domain/training';
import { useThemeTokens } from '@/app/theme';

const RPE_VALUES: Rpe[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export interface TrainingScreenProps {
  sessionId: string;
  loading: boolean;
  loadError: string | null;
  training: ActiveTrainingSession | null;
  onRefresh: () => Promise<void>;
  onUpdateProgress: (progress: TrainingProgress) => Promise<TrainingProgress>;
  onRecordSet: (set: SessionSetRecord, progress: TrainingProgress) => Promise<TrainingProgress>;
  onRecordRun: (runLog: RunLog, progress: TrainingProgress) => Promise<TrainingProgress>;
  onFinishIncomplete: () => Promise<void>;
  onDismiss: () => void;
  onExit: () => void;
}

export function TrainingScreen({
  sessionId,
  loading,
  loadError,
  training,
  onUpdateProgress,
  onRefresh,
  onRecordSet,
  onRecordRun,
  onFinishIncomplete,
  onDismiss,
  onExit,
}: TrainingScreenProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now());
  const session = training?.metadata.plannedSession ?? null;
  const progress = training?.progress ?? null;
  const currentExercise = session?.discipline === 'strength'
    ? session.exercises[progress?.currentExerciseIndex ?? -1] ?? null
    : null;
  const currentSetNumber = progress?.currentSetNumber ?? 1;
  const setKey = `${sessionId}_${progress?.currentExerciseIndex ?? -1}_${currentSetNumber}`;

  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [runRpe, setRunRpe] = useState('');

  useEffect(() => {
    if (currentExercise) {
      setWeight(String(currentExercise.targetWeightKg));
      setReps(/^\d+$/.test(currentExercise.reps) ? currentExercise.reps : '');
      setRpe('');
    }
  }, [setKey, currentExercise]);

  const runDetails = useMemo(() => {
    if (session?.discipline !== 'running') return null;
    const meters = session.blocks.reduce(
      (sum, block) => sum + block.distanceMeters * (block.repetitions ?? 1),
      0,
    );
    return { meters, kilometers: meters / 1000 };
  }, [session]);

  useEffect(() => {
    if (session?.discipline === 'running' && runDetails) {
      setDistanceKm(runDetails.kilometers.toFixed(1));
      setDurationMinutes(String(session.estimatedDurationMinutes));
      setRunRpe('');
    }
  }, [runDetails, session]);

  useEffect(() => {
    if (progress?.restEndsAt === null || progress?.restEndsAt === undefined) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [progress?.restEndsAt]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' && progress?.status === 'active') {
        void onUpdateProgress({ ...progress, status: 'paused', updatedAt: new Date().toISOString() })
          .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo pausar la sesión.'));
      }
    });
    return () => subscription.remove();
  }, [onUpdateProgress, progress]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (training?.progress.status === 'completed') {
        onDismiss();
        onExit();
        return true;
      }
      if (training && (training.progress.status === 'active' || training.progress.status === 'paused')) {
        void pauseAndExit();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [training, onUpdateProgress, onExit]);

  if (loading || !training || training.metadata.id !== sessionId || !session || !progress) {
    return (
      <ScreenLayout contentStyle={styles.center}>
        {loading ? <ActivityIndicator color={tokens.colors.accent} /> : null}
        <Text style={styles.secondaryText}>
          {loading ? 'Recuperando el entrenamiento…' : loadError ?? 'No se encontró la sesión en curso.'}
        </Text>
        {!loading ? (
          <Button
            label={loadError ? 'Reintentar' : 'Volver'}
            onPress={() => loadError ? void onRefresh() : onExit()}
            variant="secondary"
          />
        ) : null}
      </ScreenLayout>
    );
  }

  const activeSession = session as Session;
  const activeProgress = progress as TrainingProgress;
  const remainingSeconds = progress.restEndsAt === null
    ? 0
    : Math.max(0, Math.ceil((progress.restEndsAt - now) / 1000));

  async function saveStrengthSet(skipped: boolean) {
    const exercise = currentExercise;
    if (!exercise) return;
    setSaving(true);
    setError(null);
    try {
      const actualWeight = skipped ? null : Number(weight.replace(',', '.'));
      const actualReps = skipped ? null : Number(reps);
      const effort = Number(rpe);
      if (!skipped) {
        if (!weight.trim() || !Number.isFinite(actualWeight) || actualWeight! < 0) {
          throw new Error('Indica el peso real; usa 0 kg para peso corporal.');
        }
        if (!Number.isInteger(actualReps) || actualReps! <= 0) {
          throw new Error('Indica las repeticiones realizadas.');
        }
        if (!isRpe(effort)) throw new Error('Selecciona el esfuerzo percibido (RPE 1–10).');
      }

      const nextProgress = advanceStrengthTrainingProgress(
        activeProgress,
        activeSession as Extract<Session, { discipline: 'strength' }>,
      );
      const finished = nextProgress.status === 'completed';
      const record: SessionSetRecord = {
        id: `${exercise.id}_set_${currentSetNumber}`,
        status: skipped ? 'skipped' : 'completed',
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        setNumber: currentSetNumber,
        plannedWeightKg: exercise.targetWeightKg,
        plannedReps: exercise.reps,
        actualWeightKg: skipped ? null : actualWeight!,
        actualReps: skipped ? null : actualReps!,
        rpe: skipped ? null : effort as Rpe,
        recordedAt: new Date().toISOString(),
      };

      await onRecordSet(record, nextProgress);
      if (finished) {
        Alert.alert('Sesión terminada', 'Los resultados quedaron guardados.', [
          { text: 'Listo', onPress: () => { onDismiss(); onExit(); } },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la serie.');
    } finally {
      setSaving(false);
    }
  }

  async function saveRun() {
    if (!runDetails || activeSession.discipline !== 'running') return;
    setSaving(true);
    setError(null);
    try {
      const effort = Number(runRpe);
      if (!isRpe(effort)) throw new Error('Selecciona el esfuerzo percibido (RPE 1–10).');
      const actualDistanceMeters = Math.round(validatePositiveNumber(distanceKm, 'La distancia') * 1000);
      const actualDurationSeconds = Math.round(validatePositiveNumber(durationMinutes, 'La duración') * 60);
      const runLog: RunLog = {
        plannedDistanceMeters: runDetails.meters || null,
        plannedDurationMinutes: activeSession.estimatedDurationMinutes,
        actualDistanceMeters,
        actualDurationSeconds,
        actualPaceSecondsPerKm: Math.round(actualDurationSeconds * 1000 / actualDistanceMeters),
        rpe: effort,
        recordedAt: new Date().toISOString(),
      };
      const finishedAt = new Date().toISOString();
      await onRecordRun(runLog, {
        ...activeProgress,
        status: 'completed',
        updatedAt: finishedAt,
        finishedAt,
      });
      Alert.alert('Sesión terminada', 'Los resultados quedaron guardados.', [
        { text: 'Listo', onPress: () => { onDismiss(); onExit(); } },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la carrera.');
    } finally {
      setSaving(false);
    }
  }

  async function startRestTimer() {
    if (!activeProgress.restDurationSeconds) return;
    const endsAt = Date.now() + activeProgress.restDurationSeconds * 1000;
    try {
      await onUpdateProgress({ ...activeProgress, restEndsAt: endsAt, updatedAt: new Date().toISOString() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el temporizador.');
    }
  }

  async function clearRestTimer() {
    try {
      await onUpdateProgress({ ...activeProgress, restEndsAt: null, updatedAt: new Date().toISOString() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el descanso.');
    }
  }

  async function resumeTraining() {
    try {
      await onUpdateProgress({ ...activeProgress, status: 'active', updatedAt: new Date().toISOString() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reanudar el entrenamiento.');
    }
  }

  async function pauseAndExit() {
    try {
      if (activeProgress.status === 'active') {
        await onUpdateProgress({ ...activeProgress, status: 'paused', updatedAt: new Date().toISOString() });
      }
      onExit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo pausar el entrenamiento.');
    }
  }

  function confirmFinishIncomplete() {
    Alert.alert(
      'Terminar sesión incompleta',
      'Se conservarán los resultados registrados y esta sesión no contará como completada.',
      [
        { text: 'Seguir entrenando', style: 'cancel' },
        {
          text: 'Terminar',
          onPress: () => void onFinishIncomplete().then(onExit).catch((err) => {
            setError(err instanceof Error ? err.message : 'No se pudo cerrar la sesión.');
          }),
        },
      ],
    );
  }

  if (progress.status === 'completed') {
    return (
      <ScreenLayout contentStyle={styles.content}>
        <View style={styles.finishedMark}><Text style={styles.finishedMarkText}>✓</Text></View>
        <Text style={styles.finishedTitle}>Entrenamiento terminado</Text>
        <Text style={styles.secondaryText}>El plan quedó intacto y tus resultados ya están guardados.</Text>
        <Button label="Terminar" onPress={() => { onDismiss(); onExit(); }} style={styles.primaryAction} />
      </ScreenLayout>
    );
  }

  if (progress.status === 'paused') {
    return (
      <ScreenLayout contentStyle={styles.content}>
        <Text style={styles.eyebrow}>SESIÓN GUARDADA</Text>
        <Text style={styles.pausedTitle}>¿Continuamos?</Text>
        <Text style={styles.secondaryText}>Retomarás en el mismo ejercicio y serie. Lo ya registrado se conserva.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Continuar entrenamiento" onPress={() => void resumeTraining()} loading={saving} style={styles.primaryAction} />
        <Button label="Terminar como incompleta" onPress={confirmFinishIncomplete} variant="secondary" style={styles.secondaryActionButton} />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout scroll contentStyle={styles.screenContent}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.eyebrow}>MODO ENTRENAMIENTO</Text>
          <Text style={styles.topSessionTitle}>{sessionTitle(session)}</Text>
        </View>
        <Pressable onPress={() => void pauseAndExit()} accessibilityRole="button" style={styles.pauseButton}>
          <Text style={styles.pauseLabel}>Pausar</Text>
        </Pressable>
      </View>

      {session.discipline === 'strength' && currentExercise ? (
        <>
          <View style={styles.progressLine}>
            <Text style={styles.secondaryText}>Ejercicio {progress.currentExerciseIndex + 1} de {session.exercises.length}</Text>
            <Text style={styles.secondaryText}>Serie {currentSetNumber} de {currentExercise.sets}</Text>
          </View>
          <Text style={styles.exerciseTitle}>{currentExercise.name}</Text>
          <Text style={styles.purpose}>{currentExercise.reps} reps previstas · {currentExercise.targetWeightKg} kg</Text>
          <Card padding="lg" style={styles.workCard}>
            <Text style={styles.sectionTitle}>Esta serie</Text>
            <View style={styles.fieldsRow}>
              <NumberField label="Peso realizado (kg)" value={weight} onChangeText={setWeight} />
              <NumberField label="Repeticiones" value={reps} onChangeText={setReps} integer />
            </View>
            <RpePicker value={rpe} onChange={setRpe} />
          </Card>

          {progress.restDurationSeconds ? (
            <View style={styles.restBox}>
              <Text style={styles.restTitle}>
                {progress.restEndsAt === null
                  ? `Descanso recomendado · ${formatSeconds(progress.restDurationSeconds)}`
                  : remainingSeconds > 0
                    ? `Descanso · ${formatSeconds(remainingSeconds)}`
                    : 'Descanso terminado'}
              </Text>
              {progress.restEndsAt === null || remainingSeconds === 0 ? (
                <Pressable onPress={() => void startRestTimer()} style={styles.restAction} accessibilityRole="button">
                  <Text style={styles.restActionText}>{remainingSeconds === 0 && progress.restEndsAt !== null ? 'Iniciar de nuevo' : 'Iniciar temporizador'}</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => void clearRestTimer()} style={styles.restAction} accessibilityRole="button">
                  <Text style={styles.restActionText}>Omitir descanso</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Registrar serie" onPress={() => void saveStrengthSet(false)} loading={saving} style={styles.primaryAction} />
          <Button label="No pude completar" onPress={() => void saveStrengthSet(true)} loading={saving} variant="secondary" style={styles.secondaryActionButton} />
        </>
      ) : session.discipline === 'running' && runDetails ? (
        <>
          <Text style={styles.sectionTitle}>Objetivo de carrera</Text>
          <Text style={styles.exerciseTitle}>{runTitle(session)}</Text>
          <Text style={styles.purpose}>{runDetails.kilometers.toFixed(1)} km previstos · ~{session.estimatedDurationMinutes} min</Text>
          <View style={styles.blockList}>
            {session.blocks.map((block, index) => (
              <Text key={`${block.type}_${index}`} style={styles.secondaryText}>
                {blockLabel(block.type)} · {block.distanceMeters} m
                {block.repetitions && block.repetitions > 1 ? ` × ${block.repetitions}` : ''}
                {block.paceSecondsPerKm ? ` · ${formatPace(block.paceSecondsPerKm)}` : ''}
              </Text>
            ))}
          </View>
          <Card padding="lg" style={styles.workCard}>
            <Text style={styles.sectionTitle}>Carrera realizada</Text>
            <View style={styles.fieldsRow}>
              <NumberField label="Distancia (km)" value={distanceKm} onChangeText={setDistanceKm} />
              <NumberField label="Duración (min)" value={durationMinutes} onChangeText={setDurationMinutes} />
            </View>
            <RpePicker value={runRpe} onChange={setRunRpe} />
          </Card>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Registrar carrera y terminar" onPress={() => void saveRun()} loading={saving} style={styles.primaryAction} />
          <Button label="Terminar como incompleta" onPress={confirmFinishIncomplete} variant="secondary" style={styles.secondaryActionButton} />
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.exerciseTitle}>No hay ejercicios en esta sesión.</Text>
          <Text style={styles.secondaryText}>Puedes conservar el entrenamiento como incompleto.</Text>
          <Button label="Terminar como incompleta" onPress={confirmFinishIncomplete} variant="secondary" style={styles.secondaryActionButton} />
        </View>
      )}
    </ScreenLayout>
  );
}

function NumberField({
  label,
  value,
  onChangeText,
  integer = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  integer?: boolean;
}) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={integer ? 'number-pad' : 'decimal-pad'}
        placeholder="0"
        placeholderTextColor={tokens.colors.veryMutedText}
        style={styles.input}
      />
    </View>
  );
}

function RpePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  return (
    <View style={styles.rpeWrapper}>
      <Text style={styles.fieldLabel}>Esfuerzo percibido · RPE</Text>
      <View style={styles.rpeRow}>
        {RPE_VALUES.map((valueNumber) => {
          const selected = value === String(valueNumber);
          return (
            <Pressable
              key={valueNumber}
              onPress={() => onChange(String(valueNumber))}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Esfuerzo ${valueNumber} de 10`}
              style={[styles.rpeOption, selected && styles.rpeSelected]}
            >
              <Text style={[styles.rpeText, selected && styles.rpeSelectedText]}>{valueNumber}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.helper}>1 muy fácil · 10 esfuerzo máximo</Text>
    </View>
  );
}

function sessionTitle(session: Session): string {
  if (session.discipline === 'running') return runTitle(session);
  const labels = { upper: 'Tren superior', lower: 'Tren inferior', full_body: 'Cuerpo completo', accessory: 'Accesorios' };
  return labels[session.type];
}

function runTitle(session: Extract<Session, { discipline: 'running' }>): string {
  const labels = { easy: 'Carrera suave', long: 'Carrera larga', tempo: 'Tempo', intervals: 'Intervalos', race: 'Competición' };
  return labels[session.type];
}

function blockLabel(type: string): string {
  const labels: Record<string, string> = {
    warmup: 'Calentamiento', interval: 'Intervalo', recovery: 'Recuperación', cooldown: 'Enfriamiento', steady: 'Continuo',
  };
  return labels[type] ?? type;
}

function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function makeStyles(tokens: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
    screenContent: { paddingBottom: tokens.spacing.xxl },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: tokens.spacing.xl, gap: tokens.spacing.md },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: tokens.spacing.md },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacing.xl },
    eyebrow: { fontSize: tokens.fontSize.caption, letterSpacing: 1, fontWeight: tokens.fontWeight.semibold, color: tokens.colors.textSecondary },
    topSessionTitle: { fontSize: tokens.fontSize.titleSection, fontWeight: tokens.fontWeight.semibold, color: tokens.colors.ink, marginTop: tokens.spacing.xs },
    pauseButton: { minHeight: tokens.minTouch, justifyContent: 'center', paddingHorizontal: tokens.spacing.md },
    pauseLabel: { color: tokens.colors.ink, fontSize: tokens.fontSize.body, fontWeight: tokens.fontWeight.semibold },
    progressLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: tokens.spacing.md },
    exerciseTitle: { color: tokens.colors.ink, fontSize: tokens.fontSize.titleBig, fontWeight: tokens.fontWeight.bold, marginBottom: tokens.spacing.xs },
    purpose: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.body, marginBottom: tokens.spacing.lg },
    workCard: { marginBottom: tokens.spacing.md },
    sectionTitle: { color: tokens.colors.ink, fontSize: tokens.fontSize.titleSection, fontWeight: tokens.fontWeight.semibold, marginBottom: tokens.spacing.sm },
    fieldsRow: { flexDirection: 'row', gap: tokens.spacing.md },
    field: { flex: 1, marginTop: tokens.spacing.sm },
    fieldLabel: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.label, fontWeight: tokens.fontWeight.medium, marginBottom: tokens.spacing.sm },
    input: { minHeight: 52, borderWidth: tokens.borderWidth.hairline, borderColor: tokens.colors.border, borderRadius: tokens.radius.md, backgroundColor: tokens.colors.canvas, color: tokens.colors.ink, paddingHorizontal: tokens.spacing.md, fontSize: tokens.fontSize.bodyLg },
    rpeWrapper: { marginTop: tokens.spacing.lg },
    rpeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs },
    rpeOption: { width: 36, minHeight: 44, borderRadius: tokens.radius.sm, borderWidth: tokens.borderWidth.hairline, borderColor: tokens.colors.border, backgroundColor: tokens.colors.canvas, alignItems: 'center', justifyContent: 'center' },
    rpeSelected: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.ink },
    rpeText: { color: tokens.colors.ink, fontSize: tokens.fontSize.label, fontWeight: tokens.fontWeight.medium },
    rpeSelectedText: { color: tokens.colors.accentInk, fontWeight: tokens.fontWeight.bold },
    helper: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.caption, marginTop: tokens.spacing.sm },
    primaryAction: { marginTop: tokens.spacing.md },
    secondaryActionButton: { marginTop: tokens.spacing.sm },
    secondaryText: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.body, lineHeight: 22, textAlign: 'center' },
    restBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing.sm, borderRadius: tokens.radius.md, padding: tokens.spacing.md, backgroundColor: tokens.colors.surface, marginBottom: tokens.spacing.md },
    restTitle: { color: tokens.colors.ink, fontSize: tokens.fontSize.label, fontWeight: tokens.fontWeight.semibold, flex: 1 },
    restAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: tokens.spacing.sm },
    restActionText: { color: tokens.colors.ink, fontSize: tokens.fontSize.label, fontWeight: tokens.fontWeight.semibold },
    blockList: { gap: tokens.spacing.sm, marginBottom: tokens.spacing.md },
    error: { color: tokens.colors.error, fontSize: tokens.fontSize.label, marginVertical: tokens.spacing.sm },
    finishedMark: { width: 64, height: 64, borderRadius: 32, backgroundColor: tokens.colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: tokens.spacing.md },
    finishedMarkText: { fontSize: 36, fontWeight: tokens.fontWeight.bold, color: tokens.colors.accentInk },
    finishedTitle: { color: tokens.colors.ink, fontSize: tokens.fontSize.titleBig, fontWeight: tokens.fontWeight.bold, textAlign: 'center' },
    pausedTitle: { color: tokens.colors.ink, fontSize: tokens.fontSize.titleBig, fontWeight: tokens.fontWeight.bold, marginVertical: tokens.spacing.sm },
    emptyState: { alignItems: 'center', gap: tokens.spacing.md, marginTop: tokens.spacing.xxl },
  });
}
