// Pantalla "Hoy". Muestra la sesión del día con su propósito, un resumen
// compacto del progreso semanal, y maneja el caso de descanso.
//
// Diseño alineado con la wiki Identidad-visual:
// - Una acción principal por pantalla (Empezar).
// - Resumen en una línea, no compite con la sesión.
// - Propósito de la sesión bajo el título, siempre visible.
// - Cards con fade-in al montar.

import { useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, RecordedSessionCard, Screen as ScreenLayout } from '@/app/components';
import { FadeIn, usePulseLoop } from '@/app/animations';
import {
  Plan,
  RunSession,
  Session,
  StrengthSession,
  computeWeekProgress,
  getNextSession,
  getTodaySessions,
  weekDayOf,
} from '@/domain/planning';
import { WeekDay } from '@/domain/profile';
import { ActiveTrainingSession, plannedSessionRecordId, RecordedTrainingSession } from '@/domain/training';
import { useThemeTokens } from '@/app/theme';

const DAY_LABELS: Record<WeekDay, string> = {
  mon: 'Lunes',
  tue: 'Martes',
  wed: 'Miércoles',
  thu: 'Jueves',
  fri: 'Viernes',
  sat: 'Sábado',
  sun: 'Domingo',
};

export interface TodayScreenProps {
  plan: Plan | null;
  onRegisterPlanned: (session: Session, date: string, day: WeekDay, index: number) => void;
  onRegisterFree: (date: string) => void;
  activeTraining: ActiveTrainingSession | null;
  activeTrainingLoading: boolean;
  onStartPlanned: (session: Session, date: string, day: WeekDay, index: number) => void;
  onResumeActive: () => void;
  onFinishIncomplete: () => void;
  recordedSessions: readonly RecordedTrainingSession[];
  historyLoading: boolean;
  onRefreshHistory: () => Promise<void>;
}

export function TodayScreen({
  plan,
  onRegisterPlanned,
  onRegisterFree,
  activeTraining,
  activeTrainingLoading,
  onStartPlanned,
  onResumeActive,
  onFinishIncomplete,
  recordedSessions,
  historyLoading,
  onRefreshHistory,
}: TodayScreenProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const todayIso = useMemo(() => new Date().toISOString(), []);
  const day = plan ? weekDayOf(todayIso) : 'mon';
  const todayLabel = plan ? DAY_LABELS[day] : 'Hoy';

  useFocusEffect(useCallback(() => {
    void onRefreshHistory();
  }, [onRefreshHistory]));

  if (!plan) {
    return (
      <ScreenLayout scroll>
        {isActiveOrPaused(activeTraining) ? (
          <ActiveTrainingCard active={activeTraining} onResume={onResumeActive} onFinishIncomplete={onFinishIncomplete} />
        ) : null}
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Aún no hay plan generado.</Text>
          <Text style={styles.emptyBody}>
            Completa el onboarding para que Itera genere tu plan semanal.
          </Text>
        </View>
        <Button label="Registrar sesión libre" onPress={() => onRegisterFree(todayIso.slice(0, 10))} variant="secondary" disabled={Boolean(isActiveOrPaused(activeTraining)) || historyLoading} />
      </ScreenLayout>
    );
  }

  const plannedWeekStart = plan.weekStart;
  const todaySessions = getTodaySessions(plan, todayIso);
  const progress = computeWeekProgress(plan);
  const isRestDay = todaySessions.length === 0;
  const nextSession = isRestDay ? getNextSession(plan, todayIso) : null;

  return (
    <ScreenLayout scroll>
      {isActiveOrPaused(activeTraining) ? (
        <ActiveTrainingCard active={activeTraining} onResume={onResumeActive} onFinishIncomplete={onFinishIncomplete} />
      ) : null}
      <FadeIn delay={0}>
        <Text style={styles.dayLabel}>{todayLabel.toUpperCase()}</Text>
        <ProgressLine progress={progress} />
      </FadeIn>

      {isRestDay ? (
        <FadeIn delay={120}>
          <RestDayCard day={day} nextSession={nextSession} plan={plan} />
        </FadeIn>
      ) : (
        <View style={styles.sessionsList}>
          {todaySessions.map((session, i) => (
            <FadeIn key={i} delay={120 + i * 80}>
              {renderPlannedCard(session, i)}
            </FadeIn>
          ))}
        </View>
      )}
      <Button
        label="Registrar sesión libre"
        onPress={() => onRegisterFree(todayIso.slice(0, 10))}
        variant="secondary"
        disabled={Boolean(isActiveOrPaused(activeTraining)) || historyLoading}
        style={styles.freeSessionButton}
      />
    </ScreenLayout>
  );

  function renderPlannedCard(session: Session, index: number) {
    const recordId = plannedSessionRecordId(plannedWeekStart, day, index);
    const record = recordedSessions.find((candidate) => candidate.metadata.id === recordId);
    if (record && !isActiveTrainingRecord(record)) {
      return <RecordedSessionCard session={session} record={record} />;
    }
    const activeThisSession = (isActiveOrPaused(activeTraining) && activeTraining.metadata.id === recordId)
      || Boolean(record && isActiveTrainingRecord(record));
    const anotherSessionActive = isActiveOrPaused(activeTraining) && !activeThisSession;
    return (
      <SessionCard
        session={session}
        startLabel={activeThisSession ? 'Sesión en curso' : anotherSessionActive ? 'Sesión pendiente' : 'Empezar'}
        startDisabled={historyLoading || activeTrainingLoading || activeThisSession || anotherSessionActive}
        showRegister={!historyLoading && !activeTrainingLoading && !activeThisSession && !anotherSessionActive}
        onStart={() => onStartPlanned(session, todayIso.slice(0, 10), day, index)}
        onRegister={() => onRegisterPlanned(session, todayIso.slice(0, 10), day, index)}
      />
    );
  }
}

// --- Subcomponentes ----

function ProgressLine({ progress }: { progress: ReturnType<typeof computeWeekProgress> }) {
  const tokens = useThemeTokens();
  const km = (progress.totalRunningMeters / 1000).toFixed(1);
  return (
    <Text style={[progressStyles.line, { color: tokens.colors.textSecondary }]}>
      {progress.totalSessions} sesiones · {progress.runningSessions} carrera ·{' '}
      {progress.strengthSessions} fuerza · {km} km
    </Text>
  );
}

const progressStyles = StyleSheet.create({
  line: {
    fontSize: 14,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
});

function SessionCard({
  session,
  startLabel,
  startDisabled,
  showRegister,
  onStart,
  onRegister,
}: {
  session: Session;
  startLabel: string;
  startDisabled: boolean;
  showRegister: boolean;
  onStart: () => void;
  onRegister: () => void;
}) {
  const tokens = useThemeTokens();
  const isStrength = session.discipline === 'strength';
  const pulse = usePulseLoop(true, 1800);

  return (
    <Card accent={isStrength ? 'lime' : 'run'} padding="lg" style={sessionCardStyles.cardSpacing}>
      <View style={sessionCardStyles.header}>
        <Text style={[sessionCardStyles.discipline, { color: tokens.colors.textSecondary }]}>
          {isStrength ? 'FUERZA' : 'CARRERA'}
        </Text>
        <Text style={[sessionCardStyles.meta, { color: tokens.colors.textSecondary }]}>
          ~{session.estimatedDurationMinutes} min
        </Text>
      </View>

      <Text style={[sessionCardStyles.title, { color: tokens.colors.ink }]}>
        {sessionTitle(session)}
      </Text>

      {session.purpose && (
        <Text style={[sessionCardStyles.purpose, { color: tokens.colors.textSecondary }]}>
          {session.purpose}
        </Text>
      )}

      {isStrength && <StrengthDetails session={session} />}
      {!isStrength && <RunningDetails session={session} />}

      <View style={sessionCardStyles.actions}>
        <Button label={startLabel} onPress={onStart} variant="primary" disabled={startDisabled} />
        {showRegister ? (
          <Pressable style={sessionCardStyles.secondaryAction} onPress={onRegister} accessibilityRole="button">
            <Text style={[sessionCardStyles.secondaryActionText, { color: tokens.colors.ink }]}>Registrar resultado</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

function ActiveTrainingCard({
  active,
  onResume,
  onFinishIncomplete,
}: {
  active: ActiveTrainingSession;
  onResume: () => void;
  onFinishIncomplete: () => void;
}) {
  const tokens = useThemeTokens();
  const styles = makeActiveTrainingStyles(tokens);
  const title = active.metadata.plannedSession
    ? sessionTitle(active.metadata.plannedSession)
    : 'Sesión de entrenamiento';
  const location = active.metadata.plannedSession?.discipline === 'strength'
    ? `Ejercicio ${active.progress.currentExerciseIndex + 1} · serie ${active.progress.currentSetNumber}`
    : 'Carrera';
  const statusLabel = active.progress.status === 'paused' ? 'SESIÓN EN PAUSA' : 'SESIÓN PENDIENTE';

  return (
    <Card accent={active.metadata.discipline === 'strength' ? 'lime' : 'run'} padding="lg" style={styles.card}>
      <Text style={styles.eyebrow}>{statusLabel}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.detail}>{location}</Text>
      <Button label="Continuar sesión" onPress={onResume} variant="primary" style={styles.button} />
      <Pressable
        onPress={() => Alert.alert(
          'Terminar sesión incompleta',
          'Se conservará lo registrado y la sesión no contará como completada.',
          [
            { text: 'Seguir después', style: 'cancel' },
            { text: 'Terminar', onPress: onFinishIncomplete },
          ],
        )}
        accessibilityRole="button"
        style={styles.secondaryAction}
      >
        <Text style={styles.secondaryText}>Terminar como incompleta</Text>
      </Pressable>
    </Card>
  );
}

function isActiveOrPaused(training: ActiveTrainingSession | null): training is ActiveTrainingSession {
  return training?.progress.status === 'active' || training?.progress.status === 'paused';
}

function isActiveTrainingRecord(record: RecordedTrainingSession): boolean {
  return record.metadata.trainingProgress?.status === 'active' || record.metadata.trainingProgress?.status === 'paused';
}

function makeActiveTrainingStyles(tokens: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
    card: { marginBottom: tokens.spacing.lg },
    eyebrow: { fontSize: tokens.fontSize.caption, fontWeight: tokens.fontWeight.semibold, letterSpacing: 0.8, marginBottom: tokens.spacing.xs, color: tokens.colors.textSecondary },
    title: { fontSize: tokens.fontSize.titleSection, fontWeight: tokens.fontWeight.semibold, color: tokens.colors.ink },
    detail: { fontSize: tokens.fontSize.label, marginTop: tokens.spacing.xs, color: tokens.colors.textSecondary },
    button: { marginTop: tokens.spacing.md },
    secondaryAction: { minHeight: tokens.minTouch, alignItems: 'center', justifyContent: 'center', marginTop: tokens.spacing.xs },
    secondaryText: { fontSize: tokens.fontSize.label, fontWeight: tokens.fontWeight.medium, color: tokens.colors.ink, opacity: 0.75 },
  });
}

const sessionCardStyles = StyleSheet.create({
  cardSpacing: { marginBottom: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  discipline: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  meta: {
    fontSize: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  purpose: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E9EAE3',
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '500',
    opacity: 0.7,
  },
});

function StrengthDetails({ session }: { session: StrengthSession }) {
  const tokens = useThemeTokens();
  if (session.exercises.length === 0) {
    return <Text style={[{ color: tokens.colors.textSecondary }]}>Sin ejercicios definidos.</Text>;
  }
  return (
    <View style={detailStyles.list}>
      {session.exercises.map((ex, i) => (
        <Text
          key={i}
          style={[detailStyles.item, { color: tokens.colors.textSecondary }]}
        >
          · {ex.name}: {ex.sets}×{ex.reps}
          {ex.targetWeightKg > 0 ? ` @ ${ex.targetWeightKg} kg` : ''}
        </Text>
      ))}
    </View>
  );
}

function RunningDetails({ session }: { session: RunSession }) {
  const tokens = useThemeTokens();
  const totalMeters = session.blocks.reduce(
    (sum, b) => sum + b.distanceMeters * (b.repetitions ?? 1),
    0,
  );
  const km = (totalMeters / 1000).toFixed(1);
  return (
    <View style={detailStyles.list}>
      <Text style={[detailStyles.item, { color: tokens.colors.textSecondary }]}>
        · {session.blocks.length} bloque(s), {km} km totales
      </Text>
      {session.blocks.map((b, i) => (
        <Text
          key={i}
          style={[detailStyles.item, { color: tokens.colors.textSecondary }]}
        >
          · {b.type}: {b.distanceMeters}m
          {b.repetitions && b.repetitions > 1 ? ` × ${b.repetitions}` : ''}
        </Text>
      ))}
    </View>
  );
}

const detailStyles = StyleSheet.create({
  list: { marginBottom: 12, gap: 2 },
  item: { fontSize: 13, lineHeight: 18 },
});

function RestDayCard({
  day,
  nextSession,
  plan: _plan,
}: {
  day: WeekDay;
  nextSession: ReturnType<typeof getNextSession>;
  plan: Plan;
}) {
  const tokens = useThemeTokens();
  if (!nextSession) {
    return (
      <Card padding="lg">
        <Text style={[restStyles.title, { color: tokens.colors.ink }]}>Hoy descansas</Text>
        <Text style={[restStyles.purpose, { color: tokens.colors.textSecondary }]}>
          No hay sesiones programadas en tu plan semanal. Ve a la pestaña Plan para revisar.
        </Text>
      </Card>
    );
  }

  const nextDayLabel = DAY_LABELS[nextSession.day];
  const isToday = nextSession.day === day;
  const firstSession = nextSession.sessions[0];

  return (
    <Card padding="lg">
      <Text style={[restStyles.title, { color: tokens.colors.ink }]}>Hoy descansas</Text>
      <Text style={[restStyles.purpose, { color: tokens.colors.textSecondary }]}>
        {isToday
          ? 'Tu siguiente sesión también es hoy, pero ya pasó.'
          : 'Tu cuerpo y tu plan están alineados. La próxima sesión está agendada.'}
      </Text>

      <View
        style={[
          restStyles.nextBox,
          {
            backgroundColor: tokens.colors.surface,
            borderColor: tokens.colors.border,
          },
        ]}
      >
        <Text style={[restStyles.nextLabel, { color: tokens.colors.textSecondary }]}>
          {isToday ? 'ESTA ERA LA ÚLTIMA' : 'PRÓXIMA'}
        </Text>
        <Text style={[restStyles.nextTitle, { color: tokens.colors.ink }]}>
          {nextDayLabel} · {sessionTitle(firstSession)}
        </Text>
        <Text style={[restStyles.nextMeta, { color: tokens.colors.textSecondary }]}>
          ~{firstSession.estimatedDurationMinutes} min
        </Text>
      </View>
    </Card>
  );
}

const restStyles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600', marginBottom: 8 },
  purpose: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  nextBox: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  nextLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.5, marginBottom: 4 },
  nextTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  nextMeta: { fontSize: 13 },
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

function makeStyles(tokens: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
    dayLabel: {
      fontSize: tokens.fontSize.caption,
      fontWeight: tokens.fontWeight.medium,
      color: tokens.colors.textSecondary,
      letterSpacing: 1.5,
      marginBottom: 8,
    },
    sessionsList: {},
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontSize: tokens.fontSize.titleSection,
      color: tokens.colors.ink,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyBody: {
      fontSize: tokens.fontSize.body,
      color: tokens.colors.textSecondary,
      textAlign: 'center',
    },
    freeSessionButton: { marginTop: 16, marginBottom: 20 },
  });
}
