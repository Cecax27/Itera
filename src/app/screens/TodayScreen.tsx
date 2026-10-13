// Pantalla "Hoy". Muestra la sesión del día con su propósito, un resumen
// compacto del progreso semanal, y maneja el caso de descanso.
//
// Bloques (de arriba a abajo):
// 1. Encabezado: día actual + progreso compacto de la semana.
// 2. Sesión del día (si hay) o descanso (si no).
// 3. Próxima sesión cuando hoy es descanso.
//
// Diseño alineado con la wiki Identidad-visual:
// - Una acción principal por pantalla (empezar / marcar completada).
// - Resumen en una línea, no compite con la sesión.
// - El propósito de la sesión va bajo el título, siempre visible.

import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

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
import { ALL_WEEK_DAYS, WeekDay } from '@/domain/profile';

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
}

export function TodayScreen({ plan }: TodayScreenProps) {
  const todayIso = useMemo(() => new Date().toISOString(), []);
  const day = plan ? weekDayOf(todayIso) : 'mon';
  const todayLabel = plan ? DAY_LABELS[day] : 'Hoy';

  if (!plan) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Aún no hay plan generado.</Text>
        <Text style={styles.muted}>
          Completa el onboarding para que Itera genere tu plan semanal.
        </Text>
      </View>
    );
  }

  const todaySessions = getTodaySessions(plan, todayIso);
  const progress = computeWeekProgress(plan);
  const isRestDay = todaySessions.length === 0;
  const nextSession = isRestDay ? getNextSession(plan, todayIso) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.dayLabel}>{todayLabel.toUpperCase()}</Text>
        <ProgressLine progress={progress} />
      </View>

      {isRestDay ? (
        <RestDayCard day={day} nextSession={nextSession} plan={plan} />
      ) : (
        <View style={styles.sessionsList}>
          {todaySessions.map((session, i) => (
            <SessionCard key={i} session={session} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// --- Subcomponentes ----

function ProgressLine({ progress }: { progress: ReturnType<typeof computeWeekProgress> }) {
  const km = Math.round(progress.totalRunningMeters / 1000);
  return (
    <Text style={styles.progressLine}>
      {progress.totalSessions} sesiones esta semana · {progress.runningSessions} carrera ·{' '}
      {progress.strengthSessions} fuerza · {km} km
    </Text>
  );
}

function SessionCard({ session }: { session: Session }) {
  const isStrength = session.discipline === 'strength';
  return (
    <View style={[styles.card, isStrength ? styles.cardStrength : styles.cardRunning]}>
      <View style={styles.cardHeader}>
        <Text style={styles.discipline}>
          {isStrength ? 'FUERZA' : 'CARRERA'}
        </Text>
        <Text style={styles.meta}>~{session.estimatedDurationMinutes} min</Text>
      </View>

      <Text style={styles.title}>{sessionTitle(session)}</Text>

      {session.purpose && (
        <Text style={styles.purpose}>{session.purpose}</Text>
      )}

      {isStrength && (
        <StrengthDetails session={session} />
      )}
      {!isStrength && (
        <RunningDetails session={session} />
      )}

      <View style={styles.actions}>
        <ActionButton primary label="Empezar" />
      </View>
    </View>
  );
}

function StrengthDetails({ session }: { session: StrengthSession }) {
  if (session.exercises.length === 0) {
    return <Text style={styles.detail}>Sin ejercicios definidos.</Text>;
  }
  return (
    <View style={styles.detailsList}>
      {session.exercises.map((ex, i) => (
        <Text key={i} style={styles.detail}>
          · {ex.name}: {ex.sets}×{ex.reps}
          {ex.targetWeightKg > 0 ? ` @ ${ex.targetWeightKg} kg` : ''}
        </Text>
      ))}
    </View>
  );
}

function RunningDetails({ session }: { session: RunSession }) {
  const totalMeters = session.blocks.reduce(
    (sum, b) => sum + b.distanceMeters * (b.repetitions ?? 1),
    0,
  );
  const km = (totalMeters / 1000).toFixed(1);
  return (
    <View style={styles.detailsList}>
      <Text style={styles.detail}>· {session.blocks.length} bloque(s), {km} km totales</Text>
      {session.blocks.map((b, i) => (
        <Text key={i} style={styles.detail}>
          · {b.type}: {b.distanceMeters}m
          {b.repetitions && b.repetitions > 1 ? ` × ${b.repetitions}` : ''}
        </Text>
      ))}
    </View>
  );
}

function RestDayCard({
  day,
  nextSession,
  plan,
}: {
  day: WeekDay;
  nextSession: ReturnType<typeof getNextSession>;
  plan: Plan;
}) {
  if (!nextSession) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Hoy descansas</Text>
        <Text style={styles.purpose}>
          No hay sesiones programadas en tu plan semanal. Ve a la pestaña Plan para revisar.
        </Text>
      </View>
    );
  }

  const nextDayLabel = DAY_LABELS[nextSession.day];
  const isToday = nextSession.day === day;
  const firstSession = nextSession.sessions[0];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Hoy descansas</Text>
      <Text style={styles.purpose}>
        {isToday
          ? 'Tu siguiente sesión también es hoy, pero ya pasó.'
          : 'Tu cuerpo y tu plan están alineados. La próxima sesión está agendada.'}
      </Text>

      <View style={styles.nextSessionBox}>
        <Text style={styles.nextSessionLabel}>
          {isToday ? 'Esta era la última:' : 'PRÓXIMA'}
        </Text>
        <Text style={styles.nextSessionTitle}>
          {nextDayLabel} · {sessionTitle(firstSession)}
        </Text>
        <Text style={styles.detail}>
          ~{firstSession.estimatedDurationMinutes} min
        </Text>
      </View>
    </View>
  );
}

function ActionButton({ label, primary }: { label: string; primary?: boolean }) {
  return (
    <View style={[styles.actionButton, primary ? styles.actionButtonPrimary : styles.actionButtonSecondary]}>
      <Text style={primary ? styles.actionTextPrimary : styles.actionTextSecondary}>{label}</Text>
    </View>
  );
}

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

// --- Estilos ----

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F2',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    backgroundColor: '#F7F7F2',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  empty: {
    fontSize: 18,
    color: '#20231F',
    marginBottom: 8,
    textAlign: 'center',
  },
  muted: {
    fontSize: 14,
    color: '#20231F',
    opacity: 0.6,
    textAlign: 'center',
  },
  header: {
    marginBottom: 24,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#20231F',
    opacity: 0.6,
    letterSpacing: 1,
    marginBottom: 4,
  },
  progressLine: {
    fontSize: 14,
    color: '#20231F',
    opacity: 0.7,
  },
  sessionsList: {
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E9EAE3',
  },
  cardStrength: {
    borderLeftWidth: 4,
    borderLeftColor: '#C8F169',
  },
  cardRunning: {
    borderLeftWidth: 4,
    borderLeftColor: '#5BB3F2',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  discipline: {
    fontSize: 11,
    fontWeight: '500',
    color: '#20231F',
    opacity: 0.6,
    letterSpacing: 0.5,
  },
  meta: {
    fontSize: 12,
    color: '#20231F',
    opacity: 0.6,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#20231F',
    marginBottom: 4,
  },
  purpose: {
    fontSize: 14,
    color: '#20231F',
    opacity: 0.7,
    marginBottom: 12,
    lineHeight: 20,
  },
  detailsList: {
    marginBottom: 12,
    gap: 2,
  },
  detail: {
    fontSize: 13,
    color: '#20231F',
    opacity: 0.7,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: '#C8F169',
  },
  actionButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EAE3',
  },
  actionTextPrimary: {
    color: '#20231F',
    fontSize: 15,
    fontWeight: '600',
  },
  actionTextSecondary: {
    color: '#20231F',
    fontSize: 15,
    fontWeight: '500',
  },
  nextSessionBox: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#F7F7F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9EAE3',
  },
  nextSessionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#20231F',
    opacity: 0.6,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  nextSessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#20231F',
    marginBottom: 4,
  },
});

// ALL_WEEK_DAYS se importa aunque no se use directamente; lo dejo por
// referencia para hitos futuros que filtren por día de la semana.
void ALL_WEEK_DAYS;