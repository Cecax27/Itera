import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/app/components/Card';
import { Session } from '@/domain/planning';
import { formatPace, RecordedTrainingSession } from '@/domain/training';
import { useThemeTokens } from '@/app/theme';

const INTEGER_FORMATTER = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const KM_FORMATTER = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export interface RecordedSessionCardProps {
  session: Session;
  record: RecordedTrainingSession;
  compact?: boolean;
}

export function RecordedSessionCard({ session, record, compact = false }: RecordedSessionCardProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const isRunning = record.metadata.discipline === 'running';
  const completedSets = record.sets.filter((set) => set.status !== 'skipped' && typeof set.actualReps === 'number');
  const skippedSets = record.sets.filter((set) => set.status === 'skipped');
  const plannedSets = session.discipline === 'strength'
    ? session.exercises.reduce((sum, exercise) => sum + exercise.sets, 0)
    : 0;
  const volume = completedSets.reduce(
    (sum, set) => sum + (set.actualWeightKg ?? 0) * (set.actualReps ?? 0),
    0,
  );
  const effortValues = completedSets.flatMap((set) => typeof set.rpe === 'number' ? [set.rpe] : []);
  const averageRpe = effortValues.length > 0
    ? Math.round(effortValues.reduce((sum, effort) => sum + effort, 0) / effortValues.length)
    : null;
  const incomplete = record.metadata.trainingProgress?.status === 'incomplete';

  return (
    <Card
      accent={isRunning ? 'run' : 'lime'}
      padding={compact ? 'md' : 'lg'}
      style={compact ? styles.compactCard : styles.card}
    >
      <View style={styles.heading}>
        <Text style={styles.status}>{incomplete ? 'SESIÓN INCOMPLETA' : 'TRABAJO REALIZADO'}</Text>
        <Text style={styles.source}>{record.metadata.source === 'free' ? 'LIBRE' : 'PLANIFICADA'}</Text>
      </View>
      <Text style={styles.title}>{sessionTitle(session)}</Text>
      <Text style={styles.message}>
        {incomplete
          ? 'Lo que alcanzaste a hacer quedó guardado en tu historial.'
          : 'Buen trabajo. Esto ya forma parte de tu progreso.'}
      </Text>

      {isRunning ? (
        record.runLog ? (
          <Text style={styles.result}>
            {record.runLog.plannedDistanceMeters === null
              ? ''
              : `Plan: ${KM_FORMATTER.format(record.runLog.plannedDistanceMeters / 1000)} km · `}
            Hecho: {KM_FORMATTER.format(record.runLog.actualDistanceMeters / 1000)} km ·{' '}
            {formatPace(record.runLog.actualPaceSecondsPerKm)} · {Math.round(record.runLog.actualDurationSeconds / 60)} min · RPE {record.runLog.rpe}
          </Text>
        ) : <Text style={styles.result}>No hay resultado de carrera guardado todavía.</Text>
      ) : (
        <>
          <Text style={styles.result}>
            {completedSets.length} de {plannedSets || record.sets.length} series · {INTEGER_FORMATTER.format(volume)} kg·reps
            {averageRpe === null ? '' : ` · RPE medio ${averageRpe}`}
          </Text>
          {skippedSets.length > 0 ? (
            <Text style={styles.omitted}>{skippedSets.length} {skippedSets.length === 1 ? 'serie omitida' : 'series omitidas'}</Text>
          ) : null}
          <Text numberOfLines={compact ? 2 : 4} style={styles.exerciseDetails}>
            {exerciseResultDetails(completedSets)}
          </Text>
        </>
      )}
    </Card>
  );
}

function exerciseResultDetails(sets: RecordedTrainingSession['sets']): string {
  const grouped = new Map<string, { name: string; performed: string[] }>();
  for (const set of sets) {
    if (set.status === 'skipped' || set.actualReps === null) continue;
    const group = grouped.get(set.exerciseId) ?? { name: set.exerciseName, performed: [] };
    const weight = typeof set.actualWeightKg !== 'number' || set.actualWeightKg === 0
      ? 'peso corporal'
      : `${set.actualWeightKg} kg`;
    group.performed.push(`${set.actualReps} reps @ ${weight}`);
    grouped.set(set.exerciseId, group);
  }
  return [...grouped.values()]
    .map(({ name, performed }) => `${name}: ${performed.join(', ')}`)
    .join(' · ');
}

function sessionTitle(session: Session): string {
  if (session.discipline === 'running') {
    const labels = { easy: 'Carrera suave', long: 'Carrera larga', tempo: 'Tempo', intervals: 'Intervalos', race: 'Competición' };
    return labels[session.type];
  }
  const labels = { upper: 'Tren superior', lower: 'Tren inferior', full_body: 'Cuerpo completo', accessory: 'Accesorios' };
  return labels[session.type];
}

function makeStyles(tokens: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
    card: { marginBottom: tokens.spacing.md },
    compactCard: { marginTop: tokens.spacing.sm, marginBottom: tokens.spacing.sm },
    heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing.sm },
    status: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.caption, letterSpacing: 0.7, fontWeight: tokens.fontWeight.semibold },
    source: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.caption, fontWeight: tokens.fontWeight.medium },
    title: { color: tokens.colors.ink, fontSize: tokens.fontSize.titleSection, fontWeight: tokens.fontWeight.semibold, marginTop: tokens.spacing.xs },
    message: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.label, lineHeight: 19, marginTop: tokens.spacing.xs },
    result: { color: tokens.colors.ink, fontSize: tokens.fontSize.label, lineHeight: 20, fontWeight: tokens.fontWeight.medium, marginTop: tokens.spacing.md },
    omitted: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.caption, marginTop: tokens.spacing.xs },
    exerciseDetails: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.caption, lineHeight: 17, marginTop: tokens.spacing.sm },
  });
}
