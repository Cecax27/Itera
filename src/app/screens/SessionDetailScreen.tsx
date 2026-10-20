// Detalle de una sesión planificada del plan semanal.
//
// Se abre al pulsar una card de la pestaña Plan. Aquí se ve la sesión con
// todo su detalle (ejercicios, series, bloques, propósito) y se concentran
// las acciones que antes vivían en cada card: registrar resultado y editar
// sesión. Si el resultado ya está registrado, solo queda la edición.

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, RecordedSessionCard, Screen as ScreenLayout } from '@/app/components';
import { WeekDay } from '@/domain/profile';
import { Session } from '@/domain/planning';
import {
  ActiveTrainingSession,
  formatPace,
  RecordedTrainingSession,
  plannedSessionRecordId,
} from '@/domain/training';
import { useThemeTokens } from '@/app/theme';

export interface SessionDetailScreenProps {
  day: WeekDay;
  index: number;
  /** Lunes IS0 de la semana del plan; se usa para la fecha de registro. */
  weekStart: string;
  /** Puede faltar si el plan cambió mientras la pantalla estaba abierta. */
  session: Session | null;
  record: RecordedTrainingSession | null;
  activeTraining: ActiveTrainingSession | null;
  historyLoading: boolean;
  onBack: () => void;
  onRegister: () => void;
  onEditSession: () => void;
}

export function SessionDetailScreen({
  day,
  index,
  weekStart,
  session,
  record,
  activeTraining,
  historyLoading,
  onBack,
  onRegister,
  onEditSession,
}: SessionDetailScreenProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);

  if (!session) {
    return (
      <ScreenLayout>
        <Header onPress={onBack} dayLabel={DAY_FULL_LABELS[day]} tokens={tokens} />
        <Text style={styles.stale}>
          Esta sesión ya no está en el plan. Vuelve a la pestaña Plan para ver el calendario actual.
        </Text>
      </ScreenLayout>
    );
  }

  const sessionId = plannedSessionRecordId(weekStart, day, index);
  const activeThisSession = activeTraining?.metadata.id === sessionId
    && (activeTraining.progress.status === 'active' || activeTraining.progress.status === 'paused');
  const persistedActive = record?.metadata.trainingProgress?.status === 'active'
    || record?.metadata.trainingProgress?.status === 'paused';
  const inProgress = activeThisSession || persistedActive;
  const registered = Boolean(record) && !persistedActive;
  const isStrength = session.discipline === 'strength';
  const otherActiveBlocking = !activeThisSession && Boolean(activeTraining
    && ['active', 'paused'].includes(activeTraining.progress.status));

  return (
    <ScreenLayout scroll>
      <Header onPress={onBack} dayLabel={DAY_FULL_LABELS[day]} tokens={tokens} />

      {/* Resumen: disciplina, duración, título y propósito. */}
      <View style={styles.hero}>
        <View style={styles.disciplineIcon}>
          <Ionicons
            name={isStrength ? 'barbell-outline' : 'timer-outline'}
            size={22}
            color={isStrength ? tokens.colors.accent : tokens.colors.accentRun}
          />
        </View>
        <Text style={styles.heroMeta}>
          {isStrength ? 'FUERZA' : 'CARRERA'} · ~{session.estimatedDurationMinutes} min
        </Text>
        <Text style={styles.heroTitle}>{sessionTitle(session)}</Text>
        {session.purpose ? (
          <Text style={styles.heroPurpose}>{session.purpose}</Text>
        ) : null}
      </View>

      {/* Contenido detallado: ejercicios de fuerza o bloques de carrera. */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{isStrength ? 'EJERCICIOS' : 'BLOQUES'}</Text>
        <Card accent={isStrength ? 'lime' : 'run'} padding="lg">
          {isStrength
            ? session.exercises.map((exercise, i) => (
              <View key={exercise.id} style={i > 0 ? styles.rowSpacing : undefined}>
                <Text style={styles.itemName}>{exercise.name}</Text>
                <Text style={styles.itemDetail}>
                  {exercise.sets} × {exercise.reps} ·{' '}
                  {exercise.targetWeightKg > 0 ? `${exercise.targetWeightKg} kg` : 'peso corporal'} ·{' '}
                  descanso {exercise.restSeconds} s
                </Text>
              </View>
            ))
            : session.blocks.map((block, i) => {
              const repetitions = block.repetitions ?? 1;
              const isIntervalWithReps = block.type === 'interval' && repetitions > 1;
              const distanceText = isIntervalWithReps
                ? `${formatRunDistance(block.distanceMeters)} × ${repetitions} = ${formatRunDistance(block.distanceMeters * repetitions)}`
                : formatRunDistance(block.distanceMeters * repetitions);
              return (
                <View key={i} style={i > 0 ? styles.rowSpacing : undefined}>
                  <Text style={styles.itemName}>
                    {runBlockLabel(block.type)}{isIntervalWithReps ? ` · ${repetitions} repeticiones` : ''}
                  </Text>
                  <Text style={styles.itemDetail}>
                    {distanceText}
                    {block.paceSecondsPerKm ? ` · ritmo ${formatPace(block.paceSecondsPerKm)}` : ''}
                    {block.type === 'interval' && block.recoverySeconds ? ` · recuperación ${block.recoverySeconds} s` : ''}
                  </Text>
                </View>
              );
            })}
        </Card>
      </View>

      {/* Estado de la sesión: en curso, ya registrada o pendiente. */}
      {inProgress ? (
        <View style={styles.section}>
          <Card accent={isStrength ? 'lime' : 'run'} padding="md">
            <Text style={styles.infoText}>
              {activeThisSession
                ? 'Sesión en curso · continúa desde Hoy.'
                : 'Sesión pausada · continúa desde Hoy.'}
            </Text>
          </Card>
        </View>
      ) : registered && record ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RESULTADO</Text>
          <RecordedSessionCard session={session} record={record} />
        </View>
      ) : null}

      {/* Acciones. Si ya hay resultado guardado, solo queda editar la sesión. */}
      <View style={styles.actions}>
        {!registered && !inProgress ? (
          <Button
            label="Registrar resultado"
            onPress={onRegister}
            variant="primary"
            disabled={historyLoading || otherActiveBlocking}
          />
        ) : null}
        <Button
          label="Editar sesión"
          onPress={onEditSession}
          variant="secondary"
          disabled={otherActiveBlocking}
          style={registered || inProgress ? undefined : styles.editButtonSpacing}
        />
      </View>
    </ScreenLayout>
  );
}

const DAY_FULL_LABELS: Record<WeekDay, string> = {
  mon: 'Lunes',
  tue: 'Martes',
  wed: 'Miércoles',
  thu: 'Jueves',
  fri: 'Viernes',
  sat: 'Sábado',
  sun: 'Domingo',
};

function Header({ onPress, dayLabel, tokens }: { onPress: () => void; dayLabel: string; tokens: ReturnType<typeof useThemeTokens> }) {
  return (
    <View style={headerStyles.topBar}>
      <Pressable
        accessibilityLabel="Volver a la pestaña Plan"
        onPress={onPress}
        hitSlop={12}
        style={headerStyles.backButton}
      >
        <Ionicons name="chevron-back" size={24} color={tokens.colors.ink} />
      </Pressable>
      <Text style={[headerStyles.dayLabel, { color: tokens.colors.textSecondary }]}>{dayLabel}</Text>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});

function sessionTitle(session: Session): string {
  if (session.discipline === 'strength') {
    const labels = { upper: 'Tren superior', lower: 'Tren inferior', full_body: 'Cuerpo completo', accessory: 'Accesorios' };
    return labels[session.type];
  }
  const labels = { easy: 'Carrera suave', long: 'Carrera larga', tempo: 'Tempo', intervals: 'Intervalos', race: 'Competición' };
  return labels[session.type];
}

function runBlockLabel(type: 'warmup' | 'interval' | 'recovery' | 'cooldown' | 'steady'): string {
  switch (type) {
    case 'warmup': return 'Calentamiento';
    case 'interval': return 'Intervalo';
    case 'recovery': return 'Recuperación';
    case 'cooldown': return 'Enfriamiento';
    case 'steady': return 'Tirada continua';
  }
}

function formatRunDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  const whole = meters / 1000;
  return `${Number.isInteger(whole) ? whole : whole.toFixed(1)} km`;
}

function makeStyles(tokens: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
    stale: {
      fontSize: tokens.fontSize.body,
      color: tokens.colors.textSecondary,
      marginTop: tokens.spacing.lg,
      lineHeight: 22,
    },
    hero: {
      marginBottom: tokens.spacing.lg,
    },
    disciplineIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: tokens.spacing.md,
    },
    heroMeta: {
      fontSize: tokens.fontSize.caption,
      fontWeight: tokens.fontWeight.medium,
      letterSpacing: 0.7,
      color: tokens.colors.textSecondary,
    },
    heroTitle: {
      fontSize: tokens.fontSize.titleBig,
      fontWeight: tokens.fontWeight.bold,
      color: tokens.colors.ink,
      letterSpacing: -0.5,
      marginTop: 2,
    },
    heroPurpose: {
      fontSize: tokens.fontSize.body,
      lineHeight: 22,
      color: tokens.colors.textSecondary,
      marginTop: tokens.spacing.sm,
    },
    section: {
      marginBottom: tokens.spacing.lg,
    },
    sectionLabel: {
      fontSize: tokens.fontSize.caption,
      fontWeight: tokens.fontWeight.semibold,
      letterSpacing: 0.7,
      color: tokens.colors.textSecondary,
      marginBottom: tokens.spacing.sm,
    },
    rowSpacing: {
      marginTop: tokens.spacing.md,
    },
    itemName: {
      fontSize: tokens.fontSize.bodyLg,
      fontWeight: tokens.fontWeight.semibold,
      color: tokens.colors.ink,
    },
    itemDetail: {
      fontSize: tokens.fontSize.label,
      lineHeight: 18,
      color: tokens.colors.textSecondary,
      marginTop: 2,
    },
    infoText: {
      fontSize: tokens.fontSize.label,
      color: tokens.colors.textSecondary,
    },
    actions: {
      marginTop: tokens.spacing.sm,
    },
    editButtonSpacing: {
      marginTop: tokens.spacing.md,
    },
  });
}
