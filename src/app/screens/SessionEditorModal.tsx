// Editor de sesiones planificadas del plan semanal.
//
// Desde la pantalla Plan, el usuario puede abrir una sesión y:
//   - editar su contenido (ejercicios, series, repeticiones, peso,
//     descansos, distancia de bloques, propósito),
//   - moverla a otro día libre,
//   - eliminarla del plan.
//
// El modal no toca Firestore: al guardar llama a onSave(day, index, edit)
// y la navegación aplica la edición con las operaciones puras de dominio
// (editPlanSession) y persiste el plan. Igual para eliminar.

import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Chip } from '@/app/components';
import { useThemeTokens } from '@/app/theme';
import { RunSession, Session, StrengthSession } from '@/domain/planning';
import { WeekDay } from '@/domain/profile';

const WEEK_DAYS: readonly WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const DAY_FULL_LABELS: Record<WeekDay, string> = {
  mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes', sat: 'Sábado', sun: 'Domingo',
};

export interface SessionEditorTarget {
  /** Lunes ISO de la semana del bloque a la que pertenece la sesión. */
  weekStart: string;
  day: WeekDay;
  index: number;
  session: Session;
  /** Días con sesión ya asignada (excluyendo el actual) para deshabilitar el movimiento. */
  occupiedDays: readonly WeekDay[];
}

export interface SessionEditPayload {
  toDay?: WeekDay;
  session?: Session;
}

interface SessionEditorModalProps {
  target: SessionEditorTarget | null;
  onClose: () => void;
  /** Guarda la edición (contenido y/o destino). */
  onSave: (day: WeekDay, index: number, edit: SessionEditPayload) => void;
  /** Elimina la sesión del plan. */
  onDelete: (day: WeekDay, index: number) => void;
}

export function SessionEditorModal({ target, onClose, onSave, onDelete }: SessionEditorModalProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const [targetDay, setTargetDay] = useState<WeekDay | null>(null);
  const [saving, setSaving] = useState(false);
  const [exerciseEdits, setExerciseEdits] = useState<Record<string, ExerciseEdit>>({});
  const [blockEdits, setBlockEdits] = useState<Record<string, BlockEdit>>({});
  const [purpose, setPurpose] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!target) return null;
  const activeTarget = target;

  const session = target.session;
  const isStrength = session.discipline === 'strength';
  const day = target.day;

  function openConfirmDelete() {
    Alert.alert(
      'Eliminar sesión',
      `Quitar la sesión del ${DAY_FULL_LABELS[day]} del plan. Los resultados ya registrados se conservan.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => onDelete(day, activeTarget.index),
        },
      ],
    );
  }

  function buildSavedSession(): Session | null {
    setError(null);
    if (!isStrength) {
      const run = session as RunSession;
      const blocks = run.blocks.map((block, i) => {
        const edit = blockEdits[blockKey(i)];
        const km = edit ? parseKm(edit.km) : block.distanceMeters / 1000;
        if (km === null || km <= 0) throw new Error('Escribe una distancia válida (km) en cada bloque.');
        return {
          ...block,
          distanceMeters: Math.round(km * 1000),
        };
      });
      return { ...run, blocks, purpose: purpose.trim() || run.purpose };
    }

    const strength = session as StrengthSession;
    const exercises = strength.exercises.map((exercise, i) => {
      const edit = exerciseEdits[exercise.id];
      if (!edit) return exercise;
      const sets = Number(edit.sets.replace(',', '.'));
      const weight = Number(edit.weight.replace(',', '.'));
      const rest = Number(edit.restSeconds);
      if (!Number.isInteger(sets) || sets <= 0) throw new Error(`Las series de "${exercise.name}" deben ser un número mayor que 0.`);
      if (!Number.isFinite(weight) || weight < 0) throw new Error(`El peso de "${exercise.name}" no es válido; usa 0 para peso corporal.`);
      if (!Number.isFinite(rest) || rest < 0) throw new Error(`El descanso de "${exercise.name}" no es válido.`);
      const reps = edit.reps.trim();
      if (!reps) throw new Error(`Escribe las repeticiones de "${exercise.name}".`);
      return {
        ...exercise,
        name: edit.name.trim() || exercise.name,
        sets,
        reps,
        targetWeightKg: weight,
        restSeconds: Math.round(rest),
      };
    });
    return { ...strength, exercises, purpose: purpose.trim() || strength.purpose };
  }

  function submit() {
    setSaving(true);
    try {
      const saved = buildSavedSession();
      if (!saved) throw new Error('No se pudo editar la sesión.');
      onSave(day, activeTarget.index, { toDay: targetDay ?? undefined, session: saved });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la edición.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: tokens.colors.canvas }]}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar editor" style={styles.closeButton}>
            <Text style={[styles.closeText, { color: tokens.colors.ink }]}>Cerrar</Text>
          </Pressable>
          <Text style={[styles.topLabel, { color: tokens.colors.textSecondary }]}>EDITAR SESIÓN</Text>
          <View style={styles.closeButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: tokens.colors.ink }]}>
            {isStrength ? 'Fuerza' : 'Carrera'} · {sessionTitle(session)}
          </Text>
          <Text style={[styles.subtitle, { color: tokens.colors.textSecondary }]}>
            {DAY_FULL_LABELS[day]} · ~{session.estimatedDurationMinutes} min
          </Text>

          {isStrength && (session as StrengthSession).exercises.map((exercise, i) => (
            <StrengthExerciseEditor
              key={exercise.id ?? i}
              exercise={exercise}
              edit={exerciseEdits[exercise.id] ?? defaultExerciseEdit(exercise)}
              onChange={(edit) => setExerciseEdits((current) => ({ ...current, [exercise.id]: edit }))}
            />
          ))}

          {!isStrength && (session as RunSession).blocks.map((block, i) => (
            <RunBlockEditor
              key={i}
              index={i}
              block={block}
              edit={blockEdits[blockKey(i)] ?? defaultBlockEdit(block)}
              onChange={(edit) => setBlockEdits((current) => ({ ...current, [blockKey(i)]: edit }))}
            />
          ))}

          <View style={[styles.card, { borderColor: tokens.colors.border, backgroundColor: tokens.colors.surfaceElevated }]}>
            <Text style={[styles.sectionTitle, { color: tokens.colors.ink }]}>Propósito</Text>
            <TextInput
              accessibilityLabel="Propósito de la sesión"
              value={purpose}
              onChangeText={setPurpose}
              placeholder={session.purpose ?? 'Propósito de la sesión'}
              placeholderTextColor={tokens.colors.veryMutedText}
              multiline
              style={[styles.purposeInput, { color: tokens.colors.ink, borderColor: tokens.colors.border }]}
            />
          </View>

          <View style={[styles.card, { borderColor: tokens.colors.border, backgroundColor: tokens.colors.surfaceElevated }]}>
            <Text style={[styles.sectionTitle, { color: tokens.colors.ink }]}>Mover a otro día</Text>
            <View style={styles.chipRow}>
              {WEEK_DAYS.map((candidate) => {
                const occupied = candidate !== day && target.occupiedDays.includes(candidate);
                return (
                  <Chip
                    key={candidate}
                    label={DAY_FULL_LABELS[candidate]}
                    selected={targetDay === candidate}
                    onPress={() => setTargetDay(candidate === targetDay ? null : candidate)}
                    disabled={occupied}
                  />
                );
              })}
            </View>
            {targetDay && targetDay !== day && (
              <Text style={[styles.helper, { color: tokens.colors.textSecondary }]}>
                La sesión pasará al {DAY_FULL_LABELS[targetDay]}.
              </Text>
            )}
          </View>

          {error && <Text style={[styles.error, { color: tokens.colors.error }]}>{error}</Text>}

          <Button
            label={saving ? 'Guardando…' : 'Guardar cambios'}
            onPress={submit}
            loading={saving}
          />
          <Button
            label="Eliminar del plan"
            onPress={openConfirmDelete}
            variant="danger"
            style={{ marginTop: 8, marginBottom: 24 }}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

function blockKey(index: number): string {
  return `block_${index}`;
}

interface ExerciseEdit {
  name: string;
  sets: string;
  reps: string;
  weight: string;
  restSeconds: string;
}

interface BlockEdit {
  km: string;
}

function defaultExerciseEdit(exercise: StrengthSession['exercises'][number]): ExerciseEdit {
  return {
    name: exercise.name,
    sets: String(exercise.sets),
    reps: exercise.reps,
    weight: String(exercise.targetWeightKg),
    restSeconds: String(exercise.restSeconds),
  };
}

function defaultBlockEdit(block: RunSession['blocks'][number]): BlockEdit {
  return { km: (block.distanceMeters / 1000).toFixed(1) };
}

function parseKm(value: string): number | null {
  const km = Number(value.replace(',', '.'));
  return Number.isFinite(km) ? km : null;
}

function sessionTitle(session: Session): string {
  if (session.discipline === 'strength') {
    const labels = { upper: 'Tren superior', lower: 'Tren inferior', full_body: 'Cuerpo completo', accessory: 'Accesorios' };
    return labels[session.type];
  }
  const labels = { easy: 'Suave', long: 'Larga', tempo: 'Tempo', intervals: 'Intervalos', race: 'Competición' };
  return labels[session.type];
}

function StrengthExerciseEditor({
  exercise,
  edit,
  onChange,
}: {
  exercise: StrengthSession['exercises'][number];
  edit: ExerciseEdit;
  onChange: (edit: ExerciseEdit) => void;
}) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  return (
    <View style={[styles.card, { borderColor: tokens.colors.border, backgroundColor: tokens.colors.surfaceElevated }]}>
      <Text style={[styles.exerciseName, { color: tokens.colors.ink }]}>{exercise.name}</Text>
      <View style={styles.row}>
        <Field label="Reps" value={edit.reps} onChangeText={(reps) => onChange({ ...edit, reps })} keyboard="text" />
        <Field label="Series" value={edit.sets} onChangeText={(sets) => onChange({ ...edit, sets })} integer />
      </View>
      <View style={styles.row}>
        <Field label="Peso (kg)" value={edit.weight} onChangeText={(weight) => onChange({ ...edit, weight })} />
        <Field label="Descanso (s)" value={edit.restSeconds} onChangeText={(restSeconds) => onChange({ ...edit, restSeconds })} integer />
      </View>
    </View>
  );
}

function RunBlockEditor({
  index,
  block,
  edit,
  onChange,
}: {
  index: number;
  block: RunSession['blocks'][number];
  edit: BlockEdit;
  onChange: (edit: BlockEdit) => void;
}) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const labels: Record<string, string> = {
    warmup: 'Calentamiento', interval: 'Intervalo', recovery: 'Recuperación', cooldown: 'Enfriamiento', steady: 'Tirada continua',
  };
  return (
    <View style={[styles.card, { borderColor: tokens.colors.border, backgroundColor: tokens.colors.surfaceElevated }]}>
      <Text style={styles.exerciseName}>{labels[block.type] ?? block.type} {index + 1}</Text>
      <View style={styles.row}>
        <Field label="Distancia (km)" value={edit.km} onChangeText={(km) => onChange({ ...edit, km })} />
      </View>
      {block.recoverySeconds !== undefined && (
        <Text style={[styles.helper, { color: tokens.colors.textSecondary }]}>
          Recuperación entre repeticiones: {block.recoverySeconds} s
        </Text>
      )}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  integer = false,
  keyboard,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  integer?: boolean;
  keyboard?: 'text';
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
        keyboardType={keyboard === 'text' ? 'default' : integer ? 'number-pad' : 'decimal-pad'}
        autoCapitalize={keyboard === 'text' ? 'none' : undefined}
        style={[styles.input, { color: tokens.colors.ink, borderColor: tokens.colors.border, backgroundColor: tokens.colors.canvas }]}
      />
    </View>
  );
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
    content: { padding: 20, paddingBottom: 32 },
    title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 },
    subtitle: { fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 16 },
    card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
    exerciseName: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: tokens.colors.ink },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
    row: { flexDirection: 'row', gap: 12 },
    field: { flex: 1 },
    fieldLabel: { fontSize: 12, fontWeight: '500', marginBottom: 6 },
    input: {
      minHeight: 48,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      fontSize: 16,
    },
    purposeInput: {
      minHeight: 72,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      textAlignVertical: 'top',
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    helper: { fontSize: 12, marginTop: 6 },
    error: { fontSize: 14, lineHeight: 20, marginVertical: 12 },
  });
}
