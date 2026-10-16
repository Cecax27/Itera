// Flujo H4 para registrar resultados planificados o sesiones libres.
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/app/components/Button';
import { useRunLog, useSessionSets } from '@/app/hooks';
import { Session, StrengthSession } from '@/domain/planning';
import {
  RunLog,
  Rpe,
  SessionRecordMetadata,
  SessionSetRecord,
  formatPace,
  isRpe,
  validatePositiveNumber,
} from '@/domain/training';
import { useThemeTokens } from '@/app/theme';

export interface SessionRegistrationTarget {
  sessionId: string;
  date: string;
  source: 'planned' | 'free';
  plannedSession: Session | null;
}

interface SessionRegistrationModalProps {
  target: SessionRegistrationTarget | null;
  onClose: () => void;
  onSaved: () => void;
}

interface SetDraft {
  id: string;
  number: number;
  weight: string;
  reps: string;
  rpe: string;
}

interface ExerciseDraft {
  id: string;
  name: string;
  plannedWeightKg: number | null;
  plannedReps: string | null;
  sets: SetDraft[];
}

const RPE_VALUES: Rpe[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function SessionRegistrationModal({ target, onClose, onSaved }: SessionRegistrationModalProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const [freeDiscipline, setFreeDiscipline] = useState<'running' | 'strength'>('running');
  const discipline = target?.plannedSession?.discipline ?? freeDiscipline;
  const [createdAt] = useState(() => new Date().toISOString());
  const metadata = useMemo<SessionRecordMetadata | null>(() => {
    if (!target) return null;
    return {
      id: target.sessionId,
      date: target.date,
      source: target.source,
      discipline,
      plannedSession: target.plannedSession,
      createdAt,
    };
  }, [createdAt, discipline, target]);

  const { sets: savedSets, loading: setsLoading, error: setsError, save: saveSets } = useSessionSets(
    discipline === 'strength' ? target?.sessionId ?? null : null,
    metadata,
  );
  const { runLog: savedRunLog, loading: runLogLoading, error: runLogError, save: saveRunLog } = useRunLog(
    discipline === 'running' ? target?.sessionId ?? null : null,
    metadata,
  );

  const [exercises, setExercises] = useState<ExerciseDraft[]>(() => initialExercises(target?.plannedSession));
  const plannedRun = target?.plannedSession?.discipline === 'running' ? target.plannedSession : null;
  const plannedMeters = plannedRun
    ? plannedRun.blocks.reduce((sum, block) => sum + block.distanceMeters * (block.repetitions ?? 1), 0)
    : 0;
  const [distanceKm, setDistanceKm] = useState(plannedMeters ? (plannedMeters / 1000).toFixed(1) : '');
  const [durationMinutes, setDurationMinutes] = useState(
    plannedRun ? String(plannedRun.estimatedDurationMinutes) : '',
  );
  const [runRpe, setRunRpe] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!setsLoading && savedSets.length > 0) {
      setExercises((current) => hydrateExercises(current, savedSets));
    }
  }, [savedSets, setsLoading]);

  useEffect(() => {
    if (savedRunLog) {
      setDistanceKm((savedRunLog.actualDistanceMeters / 1000).toString());
      setDurationMinutes((savedRunLog.actualDurationSeconds / 60).toString());
      setRunRpe(String(savedRunLog.rpe));
    }
  }, [savedRunLog]);

  const pace = useMemo(() => {
    const km = Number(distanceKm.replace(',', '.'));
    const minutes = Number(durationMinutes.replace(',', '.'));
    if (!Number.isFinite(km) || !Number.isFinite(minutes) || km <= 0 || minutes <= 0) return '—';
    return formatPace(Math.round((minutes * 60) / km));
  }, [distanceKm, durationMinutes]);

  if (!target) return null;
  const activeTarget = target;

  const title = target.plannedSession
    ? `${discipline === 'strength' ? 'Fuerza' : 'Carrera'} · ${sessionTitle(target.plannedSession)}`
    : 'Sesión libre';
  const loading = discipline === 'strength' ? setsLoading : runLogLoading;
  const loadError = discipline === 'strength' ? setsError : runLogError;

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      if (discipline === 'strength') {
        const records = buildSetRecords(exercises, activeTarget.plannedSession?.discipline === 'strength' ? activeTarget.plannedSession : null);
        if (records.length === 0) throw new Error('Añade al menos una serie completa.');
        await saveSets(records);
      } else {
        const rpe = Number(runRpe);
        if (!isRpe(rpe)) throw new Error('Selecciona el esfuerzo percibido (1–10).');
        const actualDistanceMeters = Math.round(validatePositiveNumber(distanceKm, 'La distancia') * 1000);
        const actualDurationSeconds = Math.round(validatePositiveNumber(durationMinutes, 'La duración') * 60);
        const actualPaceSecondsPerKm = Math.round((actualDurationSeconds * 1000) / actualDistanceMeters);
        const runLog: RunLog = {
          plannedDistanceMeters: plannedMeters || null,
          plannedDurationMinutes: plannedRun?.estimatedDurationMinutes ?? null,
          actualDistanceMeters,
          actualDurationSeconds,
          actualPaceSecondsPerKm,
          rpe,
          recordedAt: new Date().toISOString(),
        };
        await saveRunLog(runLog);
      }
      Alert.alert('Resultado guardado', 'El registro quedó asociado a esta sesión.', [
        { text: 'Listo', onPress: onSaved },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el resultado.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: tokens.colors.canvas }]}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar registro" style={styles.closeButton}>
            <Text style={[styles.closeText, { color: tokens.colors.ink }]}>Cerrar</Text>
          </Pressable>
          <Text style={[styles.topLabel, { color: tokens.colors.textSecondary }]}>REGISTRO</Text>
          <View style={styles.closeButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: tokens.colors.ink }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: tokens.colors.textSecondary }]}>
            {target.source === 'planned' ? 'Planificado y realizado quedan guardados por separado.' : 'Entrenamiento no incluido en el plan.'}
            {'\n'}{target.date}
          </Text>

          {target.source === 'free' && (
            <View style={styles.disciplinePicker}>
              <DisciplineOption label="Carrera" selected={discipline === 'running'} onPress={() => setFreeDiscipline('running')} />
              <DisciplineOption label="Fuerza" selected={discipline === 'strength'} onPress={() => setFreeDiscipline('strength')} />
            </View>
          )}

          {loading ? (
            <View style={styles.loading}><ActivityIndicator color={tokens.colors.accent} /></View>
          ) : discipline === 'strength' ? (
            <>
              <Text style={[styles.sectionTitle, { color: tokens.colors.ink }]}>Series realizadas</Text>
              <Text style={[styles.helper, { color: tokens.colors.textSecondary, marginBottom: 8 }]}>Usa 0 kg si fue un ejercicio con peso corporal.</Text>
              {exercises.map((exercise, exerciseIndex) => (
                <View key={exercise.id} style={[styles.exerciseCard, { borderColor: tokens.colors.border, backgroundColor: tokens.colors.surfaceElevated }]}>
                  {target.source === 'free' ? (
                    <TextInput
                      accessibilityLabel={`Nombre del ejercicio ${exerciseIndex + 1}`}
                      value={exercise.name}
                      onChangeText={(name) => updateExercise(exerciseIndex, { name })}
                      placeholder="Nombre del ejercicio"
                      placeholderTextColor={tokens.colors.veryMutedText}
                      style={[styles.exerciseNameInput, { color: tokens.colors.ink, borderColor: tokens.colors.border }]}
                    />
                  ) : (
                    <Text style={[styles.exerciseName, { color: tokens.colors.ink }]}>{exercise.name}</Text>
                  )}
                  {exercise.sets.map((set, setIndex) => (
                    <View key={set.id} style={[styles.setBlock, { borderTopColor: tokens.colors.border }]}>
                      <Text style={[styles.setTitle, { color: tokens.colors.textSecondary }]}>Serie {set.number}</Text>
                      <Text style={[styles.planned, { color: tokens.colors.textSecondary }]}>
                        Planificado: {exercise.plannedReps ?? '—'} reps · {exercise.plannedWeightKg ?? '—'} kg
                      </Text>
                      <View style={styles.fieldsRow}>
                        <NumberField label="Peso (kg)" value={set.weight} onChangeText={(weight) => updateSet(exerciseIndex, setIndex, { weight })} />
                        <NumberField label="Reps" value={set.reps} onChangeText={(reps) => updateSet(exerciseIndex, setIndex, { reps })} integer />
                      </View>
                      <RpePicker value={set.rpe} onChange={(rpe) => updateSet(exerciseIndex, setIndex, { rpe })} />
                    </View>
                  ))}
                  <Pressable
                    onPress={() => addSet(exerciseIndex)}
                    style={styles.textAction}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.actionText, { color: tokens.colors.ink }]}>+ Añadir serie</Text>
                  </Pressable>
                </View>
              ))}
              {target.source === 'free' && (
                <Pressable onPress={addExercise} style={styles.addExercise} accessibilityRole="button">
                  <Text style={[styles.actionText, { color: tokens.colors.ink }]}>+ Añadir ejercicio</Text>
                </Pressable>
              )}
            </>
          ) : (
            <View style={[styles.runCard, { backgroundColor: tokens.colors.surfaceElevated, borderColor: tokens.colors.border }]}>
              <Text style={[styles.sectionTitle, { color: tokens.colors.ink }]}>Carrera realizada</Text>
              {plannedRun && (
                <Text style={[styles.planned, { color: tokens.colors.textSecondary }]}>
                  Planificado: {(plannedMeters / 1000).toFixed(1)} km · ~{plannedRun.estimatedDurationMinutes} min
                </Text>
              )}
              <View style={styles.fieldsRow}>
                <NumberField label="Distancia (km)" value={distanceKm} onChangeText={setDistanceKm} />
                <NumberField label="Duración (min)" value={durationMinutes} onChangeText={setDurationMinutes} />
              </View>
              <Text style={[styles.pace, { color: tokens.colors.ink }]}>Ritmo realizado · {pace}</Text>
              <RpePicker value={runRpe} onChange={setRunRpe} />
            </View>
          )}

          {(loadError || error) && <Text style={[styles.error, { color: tokens.colors.error }]}>{error ?? loadError}</Text>}
          <Button
            label="Guardar resultados"
            onPress={() => void submit()}
            loading={saving}
            disabled={loading || Boolean(loadError)}
            style={styles.saveButton}
          />
        </ScrollView>
      </View>
    </Modal>
  );

  function updateExercise(index: number, patch: Partial<ExerciseDraft>) {
    setExercises((current) => current.map((exercise, i) => i === index ? { ...exercise, ...patch } : exercise));
  }

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<SetDraft>) {
    setExercises((current) => current.map((exercise, i) => i === exerciseIndex
      ? { ...exercise, sets: exercise.sets.map((set, j) => j === setIndex ? { ...set, ...patch } : set) }
      : exercise));
  }

  function addSet(exerciseIndex: number) {
    setExercises((current) => current.map((exercise, i) => {
      if (i !== exerciseIndex) return exercise;
      const number = exercise.sets.length + 1;
      return { ...exercise, sets: [...exercise.sets, emptySet(exercise.id, number)] };
    }));
  }

  function addExercise() {
    setExercises((current) => {
      const number = current.length + 1;
      const id = `free_exercise_${number}`;
      return [...current, { id, name: '', plannedWeightKg: null, plannedReps: null, sets: [emptySet(id, 1)] }];
    });
  }
}

function initialExercises(session?: Session | null): ExerciseDraft[] {
  if (!session || session.discipline !== 'strength') return [
    { id: 'free_exercise_1', name: '', plannedWeightKg: null, plannedReps: null, sets: [emptySet('free_exercise_1', 1)] },
  ];
  return session.exercises.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    plannedWeightKg: exercise.targetWeightKg,
    plannedReps: exercise.reps,
    sets: Array.from({ length: exercise.sets }, (_, index) => ({
      id: `${exercise.id}_set_${index + 1}`,
      number: index + 1,
      weight: String(exercise.targetWeightKg),
      reps: /^\d+$/.test(exercise.reps) ? exercise.reps : '',
      rpe: '',
    })),
  }));
}

function emptySet(exerciseId: string, number: number): SetDraft {
  return { id: `${exerciseId}_set_${number}`, number, weight: '0', reps: '', rpe: '' };
}

function hydrateExercises(exercises: ExerciseDraft[], records: SessionSetRecord[]): ExerciseDraft[] {
  return exercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => {
      const record = records.find((candidate) => candidate.id === set.id);
      return record ? {
        ...set,
        weight: String(record.actualWeightKg),
        reps: String(record.actualReps),
        rpe: String(record.rpe),
      } : set;
    }),
  }));
}

function buildSetRecords(exercises: ExerciseDraft[], plannedSession: StrengthSession | null): SessionSetRecord[] {
  const records: SessionSetRecord[] = [];
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      if (!set.reps && !set.rpe) continue;
      if (!exercise.name.trim()) throw new Error('Escribe el nombre de cada ejercicio.');
      const reps = Number(set.reps);
      const weight = Number(set.weight.replace(',', '.'));
      const rpe = Number(set.rpe);
      if (!Number.isInteger(reps) || reps <= 0) throw new Error(`Completa las repeticiones de la serie ${set.number}.`);
      if (!set.weight.trim()) throw new Error(`Completa el peso de la serie ${set.number}; usa 0 kg si fue peso corporal.`);
      if (!Number.isFinite(weight) || weight < 0) throw new Error(`El peso de la serie ${set.number} no es válido.`);
      if (!isRpe(rpe)) throw new Error(`Selecciona el esfuerzo de la serie ${set.number} (1–10).`);
      const plannedExercise = plannedSession?.exercises.find((candidate) => candidate.id === exercise.id);
      records.push({
        id: set.id,
        exerciseId: exercise.id,
        exerciseName: exercise.name.trim(),
        setNumber: set.number,
        plannedWeightKg: plannedExercise?.targetWeightKg ?? null,
        plannedReps: plannedExercise?.reps ?? null,
        actualWeightKg: weight,
        actualReps: reps,
        rpe,
        recordedAt: new Date().toISOString(),
      });
    }
  }
  return records;
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
      <Text style={[styles.fieldLabel, { color: tokens.colors.textSecondary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={integer ? 'number-pad' : 'decimal-pad'}
        placeholder="0"
        placeholderTextColor={tokens.colors.veryMutedText}
        style={[styles.input, { color: tokens.colors.ink, borderColor: tokens.colors.border, backgroundColor: tokens.colors.canvas }]}
      />
    </View>
  );
}

function RpePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  return (
    <View style={styles.rpeWrapper}>
      <Text style={[styles.fieldLabel, { color: tokens.colors.textSecondary }]}>Esfuerzo percibido · RPE</Text>
      <View style={styles.rpeRow}>
        {RPE_VALUES.map((rpe) => {
          const selected = value === String(rpe);
          return (
            <Pressable
              key={rpe}
              onPress={() => onChange(String(rpe))}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Esfuerzo ${rpe} de 10`}
              style={[
                styles.rpeOption,
                { borderColor: selected ? tokens.colors.ink : tokens.colors.border },
                selected && { backgroundColor: tokens.colors.accent },
              ]}
            >
              <Text style={[styles.rpeText, { color: selected ? tokens.colors.accentInk : tokens.colors.ink }]}>{rpe}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.helper, { color: tokens.colors.textSecondary }]}>1 muy fácil · 10 esfuerzo máximo</Text>
    </View>
  );
}

function DisciplineOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.disciplineOption,
        { borderColor: selected ? tokens.colors.ink : tokens.colors.border },
        selected && { backgroundColor: tokens.colors.accent },
      ]}
    >
      <Text style={[styles.disciplineText, { color: selected ? tokens.colors.accentInk : tokens.colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

function sessionTitle(session: Session): string {
  if (session.discipline === 'running') {
    const labels = { easy: 'Suave', long: 'Larga', tempo: 'Tempo', intervals: 'Intervalos', race: 'Competición' };
    return labels[session.type];
  }
  const labels = { upper: 'Tren superior', lower: 'Tren inferior', full_body: 'Cuerpo completo', accessory: 'Accesorios' };
  return labels[session.type];
}

function makeStyles(tokens: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
    root: { flex: 1, paddingTop: 24 },
    topBar: { height: 48, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    closeButton: { minWidth: 56, minHeight: 44, justifyContent: 'center' },
    closeText: { fontSize: 15, fontWeight: '600' },
    topLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1 },
    content: { padding: 20, paddingBottom: 32 },
    title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 },
    subtitle: { fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 16 },
    disciplinePicker: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    disciplineOption: { minHeight: 48, minWidth: 104, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1 },
    disciplineText: { fontSize: 15, fontWeight: '600' },
    sectionTitle: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
    exerciseCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
    exerciseName: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
    exerciseNameInput: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 17, fontWeight: '600', marginBottom: 4 },
    setBlock: { borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
    setTitle: { fontSize: 13, fontWeight: '600' },
    planned: { fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 4 },
    fieldsRow: { flexDirection: 'row', gap: 12 },
    field: { flex: 1, marginTop: 8 },
    fieldLabel: { fontSize: 12, fontWeight: '500', marginBottom: 6 },
    input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 16 },
    rpeWrapper: { marginTop: 12 },
    rpeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    rpeOption: { width: 34, height: 40, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    rpeText: { fontSize: 14, fontWeight: '600' },
    helper: { fontSize: 12, marginTop: 6 },
    textAction: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 8 },
    actionText: { fontSize: 14, fontWeight: '600' },
    addExercise: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12, marginBottom: 12 },
    runCard: { borderWidth: 1, borderRadius: 16, padding: 16 },
    pace: { fontSize: 16, fontWeight: '600', marginTop: 14 },
    error: { fontSize: 14, lineHeight: 20, marginVertical: 12 },
    saveButton: { marginTop: 20 },
    loading: { minHeight: 100, alignItems: 'center', justifyContent: 'center' },
  });
}
