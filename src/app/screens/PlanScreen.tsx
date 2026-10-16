// Pantalla del plan semanal. Muestra los 7 días con su sesión si la hay.
// Por ahora es solo lectura; la edición llega en un hito posterior.

import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen as ScreenLayout } from '@/app/components';
import { FadeIn } from '@/app/animations';
import { ALL_WEEK_DAYS, WeekDay } from '@/domain/profile';
import { dateForWeekDay, Plan, Session } from '@/domain/planning';
import { useThemeTokens } from '@/app/theme';

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
}

export function PlanScreen({ plan, onRegisterPlanned, onRegisterFree }: PlanScreenProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);

  if (!plan) {
    return (
      <ScreenLayout scroll>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Aún no hay plan generado.</Text>
          <Text style={styles.emptyBody}>
            El primer plan se genera automáticamente al completar el onboarding.
          </Text>
        </View>
        <Button label="Registrar sesión libre" onPress={() => onRegisterFree(new Date().toISOString().slice(0, 10))} variant="secondary" />
      </ScreenLayout>
    );
  }

  const today = new Date();
  const currentDay = ALL_WEEK_DAYS[(today.getUTCDay() + 6) % 7]; // ajustar a L=0

  return (
    <ScreenLayout scroll>
      <FadeIn delay={0}>
        <View style={styles.header}>
          <Text style={styles.title}>Tu plan</Text>
          <Text style={styles.meta}>
            Semana del {plan.weekStart} · {Object.values(plan.sessions).reduce((s, l) => s + l.length, 0)} sesiones
          </Text>
        </View>
      </FadeIn>

      {ALL_WEEK_DAYS.map((day, i) => {
        const sessions = plan.sessions[day];
        const isToday = day === currentDay;
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
                  <SessionCard
                    key={j}
                    session={session}
                    onRegister={() => onRegisterPlanned(session, dateForWeekDay(plan.weekStart, day), day, j)}
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
        style={styles.freeSessionButton}
      />
    </ScreenLayout>
  );
}

function SessionCard({ session, onRegister }: { session: Session; onRegister: () => void }) {
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
        style={sessionCardStyles.registerButton}
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
    freeSessionButton: { marginTop: tokens.spacing.lg, marginBottom: tokens.spacing.xl },
  });
}
