// Pantalla del plan. Muestra las semanas del bloque con sus 7 días y la
// sesión de cada uno. Por ahora es solo lectura; la edición llega en un
// hito posterior.

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View, Alert } from 'react-native';
import { Button, Card, RecordedSessionCard, Screen as ScreenLayout } from '@/app/components';
import { FadeIn } from '@/app/animations';
import { Ionicons } from '@expo/vector-icons';
import { ALL_WEEK_DAYS, WeekDay } from '@/domain/profile';
import { dateForWeekDay, mondayOf, Plan, Session } from '@/domain/planning';
import { useThemeTokens } from '@/app/theme';
import { ActiveTrainingSession, plannedSessionRecordId, RecordedTrainingSession } from '@/domain/training';

const DAY_LABELS: Record<WeekDay, string> = {
  mon: 'L',
  tue: 'M',
  wed: 'X',
  thu: 'J',
  fri: 'V',
  sat: 'S',
  sun: 'D',
};

const DAY_FULL_LABELS: Record<WeekDay, string> = {
  mon: 'Lunes',
  tue: 'Martes',
  wed: 'Miércoles',
  thu: 'Jueves',
  fri: 'Viernes',
  sat: 'Sábado',
  sun: 'Domingo',
};

export interface PlanScreenProps {
  plan: Plan | null;
  onRegisterPlanned: (session: Session, date: string, day: WeekDay, index: number) => void;
  onRegisterFree: (date: string) => void;
  recordedSessions: readonly RecordedTrainingSession[];
  historyLoading: boolean;
  onRefreshHistory: () => Promise<void>;
  activeTraining: ActiveTrainingSession | null;
  /** Abre el asistente de creación de plan con IA. */
  onCreatePlan: () => void;
  /** Abre el editor de una sesión concreta. */
  onOpenSessionEditor: (day: WeekDay, index: number) => void;
  /** Elimina el plan completo (con confirmación previa). */
  onDeletePlan: () => void;
}

export function PlanScreen({
  plan,
  onRegisterPlanned,
  onRegisterFree,
  recordedSessions,
  historyLoading,
  onRefreshHistory,
  activeTraining,
  onCreatePlan,
  onOpenSessionEditor,
  onDeletePlan,
}: PlanScreenProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);

  useFocusEffect(useCallback(() => {
    void onRefreshHistory();
  }, [onRefreshHistory]));

  // Semana seleccionada: por defecto la que contiene hoy (si está en el
  // bloque); si hoy está fuera, la última pasada o la primera.
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultWeekIndex = useMemo(() => {
    if (!plan || plan.weeks.length === 0) return 0;
    const todayMonday = mondayOf(todayIso);
    const index = plan.weeks.findIndex((week) => week.weekStart === todayMonday);
    if (index >= 0) return index;
    return todayIso < plan.weeks[0].weekStart ? 0 : plan.weeks.length - 1;
  }, [plan, todayIso]);
  const [weekIndex, setWeekIndex] = useState(defaultWeekIndex);
  const clampedIndex = plan && plan.weeks.length > 0
    ? Math.min(Math.max(weekIndex, 0), plan.weeks.length - 1)
    : 0;

  if (!plan) {
    return (
      <ScreenLayout scroll>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Aún no tienes plan.</Text>
          <Text style={styles.emptyBody}>
            Crea uno con la IA contándole tu objetivo, tus días y tu material.
          </Text>
          <Text style={styles.emptyBody}>
            El registro de entrenamientos ya realizados no se verá afectado.
          </Text>
        </View>
        <Button
          label="Crear plan con IA"
          onPress={onCreatePlan}
          variant="primary"
        />
        <Button
          label="Registrar sesión libre"
          onPress={() => onRegisterFree(new Date().toISOString().slice(0, 10))}
          variant="secondary"
          disabled={historyLoading || Boolean(activeTraining && ['active', 'paused'].includes(activeTraining.progress.status))}
          style={styles.freeSessionButton}
        />
      </ScreenLayout>
    );
  }

  const week = plan.weeks[clampedIndex] ?? plan.weeks[0];
  const todayDate = todayIso;
  const goalLabel = plan.goalDate ? formatDateLabel(plan.goalDate) : null;

  const confirmDeletePlan = () => {
    Alert.alert(
      'Eliminar plan',
      'Se eliminará el plan semanal completo. Los entrenamientos que ya registraste se conservan.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar plan', style: 'destructive', onPress: onDeletePlan },
      ],
    );
  };

  return (
    <ScreenLayout scroll>
      <FadeIn delay={0}>
        <View style={styles.header}>
          <Text style={styles.title}>Tu plan</Text>
          {plan.weeks.length > 1 ? (
            <WeekSelector
              index={clampedIndex}
              total={plan.weeks.length}
              weekStart={week.weekStart}
              sessionCount={countSessions(week)}
              onChange={setWeekIndex}
              styles={styles}
              tokens={tokens}
            />
          ) : (
            <Text style={styles.meta}>
              Semana del {week.weekStart} · {countSessions(week)} sesiones
            </Text>
          )}
          {goalLabel ? (
            <Text style={styles.goalLabel}>Objetivo: {goalLabel}</Text>
          ) : null}
        </View>
        <Button
          label="Nuevo plan con IA"
          onPress={onCreatePlan}
          variant="primary"
          style={styles.createPlanButton}
        />
      </FadeIn>

      {ALL_WEEK_DAYS.map((day, i) => {
        const sessions = week.sessions[day];
        const isToday = dateForWeekDay(week.weekStart, day) === todayDate;
        return (
          <FadeIn key={day} delay={60 + i * 40}>
            <View style={[styles.dayRow, isToday && styles.todayRow]}>
              <View style={[styles.dayHeader, isToday && styles.todayHeader]}>
                <Text
                  style={[
                    styles.dayBadge,
                    isToday && styles.todayBadge,
                  ]}
                >
                  {DAY_LABELS[day]}
                </Text>
                <Text style={styles.dayFullLabel}>
                  {DAY_FULL_LABELS[day]}{isToday ? ' · hoy' : ''}
                </Text>
              </View>
              {sessions.length === 0 ? (
                <Text style={styles.restDay}>Descanso</Text>
              ) : (
                sessions.map((session, j) => (
                  <PlannedSessionCard
                    key={j}
                    session={session}
                    weekStart={week.weekStart}
                    day={day}
                    index={j}
                    record={recordedSessions.find((candidate) => candidate.metadata.id === plannedSessionRecordId(week.weekStart, day, j)) ?? null}
                    activeTraining={activeTraining}
                    historyLoading={historyLoading}
                    onRegister={() => onRegisterPlanned(session, dateForWeekDay(week.weekStart, day), day, j)}
                    onEdit={() => onOpenSessionEditor(day, j)}
                  />
                ))
              )}
            </View>
          </FadeIn>
        );
      })}
      <Button
        label="Registrar sesión libre"
        onPress={() => onRegisterFree(new Date().toISOString().slice(0, 10))}
        variant="secondary"
        disabled={historyLoading || Boolean(activeTraining && ['active', 'paused'].includes(activeTraining.progress.status))}
        style={styles.freeSessionButton}
      />
      <Button
        label="Eliminar plan"
        onPress={confirmDeletePlan}
        variant="ghost"
        style={styles.deletePlanButton}
      />
    </ScreenLayout>
  );
}

function countSessions(week: { sessions: Record<WeekDay, readonly Session[]> }): number {
  return Object.values(week.sessions).reduce((sum, list) => sum + list.length, 0);
}

function WeekSelector({
  index,
  total,
  weekStart,
  sessionCount,
  onChange,
  styles,
  tokens,
}: {
  index: number;
  total: number;
  weekStart: string;
  sessionCount: number;
  onChange: (next: number) => void;
  styles: ReturnType<typeof makeStyles>;
  tokens: ReturnType<typeof useThemeTokens>;
}) {
  return (
    <View style={styles.weekSelector}>
      <Pressable
        onPress={() => onChange(index - 1)}
        disabled={index <= 0}
        accessibilityRole="button"
        accessibilityLabel="Semana anterior"
        style={[styles.weekArrow, index <= 0 && styles.weekArrowDisabled]}
      >
        <Ionicons name="chevron-back" size={18} color={tokens.colors.ink} />
      </Pressable>
      <Text style={styles.meta}>
        Semana {index + 1} de {total} · del {weekStart} · {sessionCount} sesiones
      </Text>
      <Pressable
        onPress={() => onChange(index + 1)}
        disabled={index >= total - 1}
        accessibilityRole="button"
        accessibilityLabel="Semana siguiente"
        style={[styles.weekArrow, index >= total - 1 && styles.weekArrowDisabled]}
      >
        <Ionicons name="chevron-forward" size={18} color={tokens.colors.ink} />
      </Pressable>
    </View>
  );
}

function formatDateLabel(dateIso: string): string {
  const date = new Date(`${dateIso.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return dateIso;
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
}

function PlannedSessionCard({
  session,
  weekStart,
  day,
  index,
  record,
  activeTraining,
  historyLoading,
  onRegister,
  onEdit,
}: {
  session: Session;
  weekStart: string;
  day: WeekDay;
  index: number;
  record: RecordedTrainingSession | null;
  activeTraining: ActiveTrainingSession | null;
  historyLoading: boolean;
  onRegister: () => void;
  onEdit: () => void;
}) {
  const tokens = useThemeTokens();
  const currentSessionId = plannedSessionRecordId(weekStart, day, index);
  const activeThisSession = activeTraining?.metadata.id === currentSessionId
    && (activeTraining.progress.status === 'active' || activeTraining.progress.status === 'paused');
  const persistedActiveThisSession = record?.metadata.trainingProgress?.status === 'active'
    || record?.metadata.trainingProgress?.status === 'paused';
  if (activeThisSession || persistedActiveThisSession) {
    return (
      <Card accent={session.discipline === 'strength' ? 'lime' : 'run'} padding="md" style={sessionCardStyles.cardSpacing}>
        <Text style={[sessionCardStyles.detail, { color: tokens.colors.textSecondary }]}>Sesión en curso · continúa desde Hoy.</Text>
      </Card>
    );
  }
  if (record && record.metadata.trainingProgress?.status !== 'active' && record.metadata.trainingProgress?.status !== 'paused') {
    return <RecordedSessionCard session={session} record={record} compact />;
  }
  return (
    <SessionCard
      session={session}
      onRegister={onRegister}
      onEdit={onEdit}
      disabled={historyLoading || Boolean(activeTraining && ['active', 'paused'].includes(activeTraining.progress.status))}
    />
  );
}

function SessionCard({
  session,
  onRegister,
  onEdit,
  disabled,
}: {
  session: Session;
  onRegister: () => void;
  onEdit: () => void;
  disabled: boolean;
}) {
  const tokens = useThemeTokens();
  return (
    <Card
      accent={session.discipline === 'strength' ? 'lime' : 'run'}
      padding="md"
      style={sessionCardStyles.cardSpacing}
    >
      <View style={sessionCardStyles.header}>
        <Text style={[sessionCardStyles.discipline, { color: tokens.colors.textSecondary }]}>
          {session.discipline === 'strength' ? 'FUERZA' : 'CARRERA'}
        </Text>
        <Text style={[sessionCardStyles.meta, { color: tokens.colors.textSecondary }]}>
          ~{session.estimatedDurationMinutes} min
        </Text>
      </View>
      <Text style={[sessionCardStyles.title, { color: tokens.colors.ink }]}>
        {sessionTitle(session)}
      </Text>
      {session.discipline === 'strength' && session.exercises.length > 0 && (
        <Text style={[sessionCardStyles.detail, { color: tokens.colors.textSecondary }]}>
          {session.exercises.length} ejercicio(s): {session.exercises.slice(0, 3).map((e) => e.name).join(', ')}
          {session.exercises.length > 3 ? '…' : ''}
        </Text>
      )}
      {session.discipline === 'running' && (
        <Text style={[sessionCardStyles.detail, { color: tokens.colors.textSecondary }]}>
          {session.blocks.length} bloque(s), {(totalDistance(session) / 1000).toFixed(1)} km totales
        </Text>
      )}
      <Button
        label="Registrar resultado"
        onPress={onRegister}
        variant="secondary"
        disabled={disabled}
        style={sessionCardStyles.registerButton}
      />
      <Button
        label="Editar sesión"
        onPress={onEdit}
        variant="ghost"
        style={sessionCardStyles.editButton}
      />
    </Card>
  );
}

const sessionCardStyles = StyleSheet.create({
  cardSpacing: { marginTop: 6 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  discipline: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  meta: { fontSize: 12 },
  title: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  detail: { fontSize: 13, lineHeight: 18 },
  registerButton: { marginTop: 12 },
  editButton: { marginTop: 4 },
});

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

function totalDistance(s: Extract<Session, { discipline: 'running' }>): number {
  return s.blocks.reduce((sum, b) => sum + b.distanceMeters * (b.repetitions ?? 1), 0);
}

function makeStyles(tokens: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
    header: {
      marginBottom: tokens.spacing.lg,
    },
    title: {
      fontSize: tokens.fontSize.titleBig,
      fontWeight: tokens.fontWeight.bold,
      color: tokens.colors.ink,
      marginBottom: 4,
      letterSpacing: -0.5,
    },
    meta: {
      fontSize: tokens.fontSize.body,
      color: tokens.colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    goalLabel: {
      fontSize: tokens.fontSize.caption,
      color: tokens.colors.textSecondary,
      marginTop: 2,
      textTransform: 'capitalize',
    },
    weekSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.spacing.xs,
    },
    weekArrow: {
      width: tokens.minTouch,
      height: tokens.minTouch,
      borderRadius: tokens.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.colors.surface,
    },
    weekArrowDisabled: {
      opacity: 0.3,
    },
    dayRow: {
      paddingVertical: tokens.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: tokens.colors.border,
    },
    todayRow: {},
    dayHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.spacing.sm,
      marginBottom: tokens.spacing.sm,
    },
    todayHeader: {},
    dayBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: tokens.colors.surface,
      color: tokens.colors.textSecondary,
      textAlign: 'center',
      textAlignVertical: 'center',
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 28,
      overflow: 'hidden',
    },
    todayBadge: {
      backgroundColor: tokens.colors.accent,
      color: tokens.colors.accentInk,
    },
    dayFullLabel: {
      fontSize: tokens.fontSize.body,
      fontWeight: '500',
      color: tokens.colors.ink,
    },
    restDay: {
      fontSize: tokens.fontSize.body,
      color: tokens.colors.textSecondary,
      opacity: 0.6,
      fontStyle: 'italic',
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontSize: tokens.fontSize.titleSection,
      color: tokens.colors.ink,
      marginBottom: 8,
    },
    emptyBody: {
      fontSize: tokens.fontSize.body,
      color: tokens.colors.textSecondary,
      textAlign: 'center',
    },
    freeSessionButton: { marginTop: tokens.spacing.lg, marginBottom: tokens.spacing.xs },
    createPlanButton: { marginTop: tokens.spacing.md },
    deletePlanButton: { marginTop: tokens.spacing.md, marginBottom: tokens.spacing.xl },
  });
}
