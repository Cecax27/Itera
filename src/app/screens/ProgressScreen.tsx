import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ListRenderItemInfo,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Card, Chip } from '@/app/components';
import { Plan, Session } from '@/domain/planning';
import {
  computeWeeklyTrainingSummary,
  filterTrainingHistory,
  formatPace,
  HistoryDateFilter,
  HistoryDisciplineFilter,
  RecordedTrainingSession,
} from '@/domain/training';
import { useThemeTokens } from '@/app/theme';

const DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const INTEGER_FORMATTER = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const KM_FORMATTER = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export interface ProgressScreenProps {
  plan: Plan | null;
  onOpenSettings: () => void;
  sessions: readonly RecordedTrainingSession[];
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
}

export function ProgressScreen({
  plan,
  onOpenSettings,
  sessions,
  loading,
  error,
  onRefresh,
  onDeleteSession,
}: ProgressScreenProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const [disciplineFilter, setDisciplineFilter] = useState<HistoryDisciplineFilter>('all');
  const [dateFilter, setDateFilter] = useState<HistoryDateFilter>('week');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const todayIso = new Date().toISOString().slice(0, 10);

  useFocusEffect(useCallback(() => {
    void onRefresh();
  }, [onRefresh]));

  const summary = useMemo(
    () => computeWeeklyTrainingSummary(sessions, plan, todayIso),
    [sessions, plan, todayIso],
  );
  const filteredSessions = useMemo(
    () => filterTrainingHistory(sessions, disciplineFilter, dateFilter, todayIso),
    [dateFilter, disciplineFilter, sessions, todayIso],
  );
  const hasFinalizedSession = sessions.some((record) =>
    record.metadata.trainingProgress?.status !== 'active'
    && record.metadata.trainingProgress?.status !== 'paused',
  );
  const deleteSession = useCallback(async (sessionId: string) => {
    setDeletingId(sessionId);
    try {
      await onDeleteSession(sessionId);
    } catch (err) {
      Alert.alert('No se pudo eliminar', err instanceof Error ? err.message : 'Inténtalo de nuevo.');
    } finally {
      setDeletingId(null);
    }
  }, [onDeleteSession]);
  const confirmDelete = useCallback((sessionId: string) => {
    Alert.alert(
      'Eliminar entrenamiento',
      'Se borrarán sus resultados del historial. El plan semanal no cambiará.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => void deleteSession(sessionId) },
      ],
    );
  }, [deleteSession]);
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<RecordedTrainingSession>) => (
      <SessionHistoryCard
        record={item}
        deleting={deletingId === item.metadata.id}
        onDelete={() => confirmDelete(item.metadata.id)}
      />
    ),
    [confirmDelete, deletingId],
  );
  const keyExtractor = useCallback((item: RecordedTrainingSession) => item.metadata.id, []);
  const hasSummaryData = sessions.length > 0 || (!loading && !error);

  const header = (
    <View>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>CONSTANCIA, NO PERFECCIÓN</Text>
          <Text style={styles.title}>Tu progreso</Text>
          <Text style={styles.subtitle}>Un resumen claro de lo que has hecho.</Text>
        </View>
        <Pressable
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Abrir ajustes"
          hitSlop={8}
          style={styles.settingsButton}
        >
          <Ionicons name="settings-outline" size={21} color={tokens.colors.ink} />
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Esta semana</Text>
      <Text style={styles.weekLabel}>Semana del {formatDate(summary.weekStart)}</Text>
      <View style={styles.metricsRow}>
        <MetricCard label="Carrera" value={hasSummaryData ? `${KM_FORMATTER.format(summary.runningDistanceMeters / 1000)} km` : '—'} />
        <MetricCard label="Fuerza" value={hasSummaryData ? INTEGER_FORMATTER.format(summary.strengthVolumeKg) : '—'} unit={hasSummaryData ? 'kg·reps' : undefined} />
        <MetricCard
          label="Plan"
          value={!hasSummaryData || summary.adherencePercent === null ? '—' : `${summary.adherencePercent}%`}
          unit={!hasSummaryData ? undefined : summary.plannedSessions > 0
            ? `${summary.completedPlannedSessions} de ${summary.plannedSessions}`
            : 'sin plan esta semana'}
        />
      </View>

      <Text style={[styles.sectionTitle, styles.historyTitle]}>Entrenamientos registrados</Text>
      <Text style={styles.filterLabel}>Disciplina</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label="Todo" selected={disciplineFilter === 'all'} onPress={() => setDisciplineFilter('all')} />
        <Chip label="Carrera" selected={disciplineFilter === 'running'} onPress={() => setDisciplineFilter('running')} />
        <Chip label="Fuerza" selected={disciplineFilter === 'strength'} onPress={() => setDisciplineFilter('strength')} />
      </ScrollView>
      <Text style={styles.filterLabel}>Periodo</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label="Esta semana" selected={dateFilter === 'week'} onPress={() => setDateFilter('week')} />
        <Chip label="30 días" selected={dateFilter === '30days'} onPress={() => setDateFilter('30days')} />
        <Chip label="Todo" selected={dateFilter === 'all'} onPress={() => setDateFilter('all')} />
      </ScrollView>
      <Text style={styles.resultsCount}>
        {filteredSessions.length} {filteredSessions.length === 1 ? 'sesión' : 'sesiones'}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  const emptyContent = loading ? (
    <View style={styles.emptyState}>
      <ActivityIndicator color={tokens.colors.accent} />
      <Text style={styles.emptyText}>Cargando historial…</Text>
    </View>
  ) : error ? (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No pudimos cargar los entrenamientos.</Text>
      <Pressable onPress={() => void onRefresh()} accessibilityRole="button" style={styles.retryButton}>
        <Text style={styles.retryText}>Intentar de nuevo</Text>
      </Pressable>
    </View>
  ) : sessions.length === 0 ? (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Aún no hay entrenamientos registrados.</Text>
      <Text style={styles.emptyText}>Cuando guardes un resultado, aparecerá aquí.</Text>
    </View>
  ) : !hasFinalizedSession ? (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Tu sesión sigue en curso.</Text>
      <Text style={styles.emptyText}>Aparecerá en el historial cuando la termines o la cierres como incompleta.</Text>
    </View>
  ) : (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No hay sesiones para estos filtros.</Text>
      <Text style={styles.emptyText}>Prueba con otro periodo o disciplina.</Text>
    </View>
  );

  return (
    <FlatList
      data={filteredSessions}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={header}
      ListEmptyComponent={emptyContent}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void onRefresh()} tintColor={tokens.colors.ink} />}
      keyboardShouldPersistTaps="handled"
    />
  );

}

function MetricCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  return (
    <Card padding="md" style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.metricValue}>{value}</Text>
      {unit ? <Text numberOfLines={1} style={styles.metricUnit}>{unit}</Text> : null}
    </Card>
  );
}

const SessionHistoryCard = memo(function SessionHistoryCard({
  record,
  deleting,
  onDelete,
}: {
  record: RecordedTrainingSession;
  deleting: boolean;
  onDelete: () => void;
}) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const isRunning = record.metadata.discipline === 'running';
  const title = record.metadata.plannedSession
    ? sessionTitle(record.metadata.plannedSession)
    : isRunning ? 'Carrera libre' : 'Fuerza libre';
  const volume = record.sets.reduce((sum, set) => sum + (set.actualWeightKg ?? 0) * (set.actualReps ?? 0), 0);
  const completedSets = record.sets.filter((set) => set.status !== 'skipped' && typeof set.actualReps === 'number');
  const skippedSets = record.sets.filter((set) => set.status === 'skipped').length;
  const averageRpe = completedSets.length > 0
    ? Math.round(completedSets.reduce((sum, set) => sum + (typeof set.rpe === 'number' ? set.rpe : 0), 0) / completedSets.length)
    : null;

  return (
    <Card padding="md" accent={isRunning ? 'run' : 'lime'} style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionDate}>{formatDate(record.metadata.date)}</Text>
        <Text style={styles.sessionSource}>
          {record.metadata.trainingProgress?.status === 'incomplete'
            ? 'INCOMPLETA'
            : record.metadata.source === 'free' ? 'LIBRE' : 'PLANIFICADA'}
        </Text>
      </View>
      <Text style={styles.sessionTitle}>{title}</Text>
      {isRunning ? (
        record.runLog ? (
          <Text style={styles.sessionDetail}>
            {KM_FORMATTER.format(record.runLog.actualDistanceMeters / 1000)} km · {formatPace(record.runLog.actualPaceSecondsPerKm)} · {Math.round(record.runLog.actualDurationSeconds / 60)} min · RPE {record.runLog.rpe}
          </Text>
        ) : <Text style={styles.sessionDetail}>Sin resultado de carrera guardado.</Text>
      ) : (
        <>
          <Text style={styles.sessionDetail}>
            {completedSets.length} {completedSets.length === 1 ? 'serie' : 'series'} · {INTEGER_FORMATTER.format(volume)} kg·reps
            {skippedSets > 0 ? ` · ${skippedSets} omitidas` : ''}
            {averageRpe === null ? '' : ` · RPE medio ${averageRpe}`}
          </Text>
          <Text style={styles.exerciseNames} numberOfLines={2}>
            {uniqueExerciseNames(record.sets).join(' · ') || 'Sin series guardadas'}
          </Text>
        </>
      )}
      <Pressable
        onPress={onDelete}
        disabled={deleting}
        accessibilityRole="button"
        accessibilityLabel="Eliminar entrenamiento registrado"
        style={styles.deleteAction}
      >
        <Ionicons name="trash-outline" size={16} color={tokens.colors.ink} />
        <Text style={styles.deleteText}>{deleting ? 'Eliminando…' : 'Eliminar registro'}</Text>
      </Pressable>
    </Card>
  );
});

function uniqueExerciseNames(sets: RecordedTrainingSession['sets']): string[] {
  return [...new Set(sets.map((set) => set.exerciseName))];
}

function sessionTitle(session: Session): string {
  if (session.discipline === 'running') {
    const labels = { easy: 'Carrera suave', long: 'Carrera larga', tempo: 'Tempo', intervals: 'Intervalos', race: 'Competición' };
    return labels[session.type];
  }
  const labels = { upper: 'Tren superior', lower: 'Tren inferior', full_body: 'Cuerpo completo', accessory: 'Accesorios' };
  return labels[session.type];
}

function formatDate(dateIso: string): string {
  const date = new Date(`${dateIso.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? dateIso : DATE_FORMATTER.format(date);
}

function makeStyles(tokens: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
    content: { paddingHorizontal: tokens.spacing.xl, paddingTop: tokens.spacing.lg, paddingBottom: tokens.spacing.xxl, flexGrow: 1 },
    headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: tokens.spacing.xl },
    headingCopy: { flex: 1, gap: tokens.spacing.xs },
    eyebrow: { fontSize: tokens.fontSize.caption, letterSpacing: 1, fontWeight: tokens.fontWeight.semibold, color: tokens.colors.textSecondary },
    title: { fontSize: tokens.fontSize.titleBig, letterSpacing: -0.5, fontWeight: tokens.fontWeight.bold, color: tokens.colors.ink },
    subtitle: { fontSize: tokens.fontSize.body, lineHeight: 21, color: tokens.colors.textSecondary },
    settingsButton: { width: 48, height: 48, borderRadius: tokens.radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: tokens.borderWidth.hairline, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surfaceElevated },
    sectionTitle: { fontSize: tokens.fontSize.titleSection, fontWeight: tokens.fontWeight.semibold, color: tokens.colors.ink },
    weekLabel: { fontSize: tokens.fontSize.label, color: tokens.colors.textSecondary, marginTop: tokens.spacing.xs, marginBottom: tokens.spacing.md },
    metricsRow: { flexDirection: 'row', gap: tokens.spacing.sm },
    metricCard: { flex: 1, minWidth: 0 },
    metricLabel: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.caption, fontWeight: tokens.fontWeight.medium },
    metricValue: { color: tokens.colors.ink, fontSize: tokens.fontSize.titleSection, fontWeight: tokens.fontWeight.bold, marginTop: tokens.spacing.xs },
    metricUnit: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.caption, marginTop: 2 },
    historyTitle: { marginTop: tokens.spacing.xxl, marginBottom: tokens.spacing.md },
    filterLabel: { fontSize: tokens.fontSize.label, color: tokens.colors.textSecondary, marginBottom: tokens.spacing.sm },
    chipRow: { gap: tokens.spacing.sm, paddingBottom: tokens.spacing.md },
    resultsCount: { fontSize: tokens.fontSize.label, color: tokens.colors.textSecondary, marginTop: tokens.spacing.xs, marginBottom: tokens.spacing.sm },
    error: { fontSize: tokens.fontSize.label, color: tokens.colors.error, marginBottom: tokens.spacing.md },
    sessionCard: { marginBottom: tokens.spacing.md },
    deleteAction: { minHeight: tokens.minTouch, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: tokens.spacing.xs, marginTop: tokens.spacing.sm },
    deleteText: { color: tokens.colors.ink, fontSize: tokens.fontSize.caption, fontWeight: tokens.fontWeight.medium },
    sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: tokens.spacing.sm, marginBottom: tokens.spacing.xs },
    sessionDate: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.label, textTransform: 'capitalize' },
    sessionSource: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.caption, fontWeight: tokens.fontWeight.semibold, letterSpacing: 0.5 },
    sessionTitle: { color: tokens.colors.ink, fontSize: tokens.fontSize.bodyLg, fontWeight: tokens.fontWeight.semibold, marginBottom: tokens.spacing.xs },
    sessionDetail: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.label, lineHeight: 20 },
    exerciseNames: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.caption, marginTop: tokens.spacing.xs },
    emptyState: { alignItems: 'center', justifyContent: 'center', gap: tokens.spacing.sm, paddingHorizontal: tokens.spacing.xl, paddingVertical: tokens.spacing.xxl },
    emptyTitle: { color: tokens.colors.ink, fontSize: tokens.fontSize.bodyLg, fontWeight: tokens.fontWeight.semibold, textAlign: 'center' },
    emptyText: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.body, textAlign: 'center' },
    retryButton: { minHeight: tokens.minTouch, alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing.lg },
    retryText: { color: tokens.colors.ink, fontSize: tokens.fontSize.body, fontWeight: tokens.fontWeight.semibold },
  });
}
