// Pantalla del plan semanal. Muestra los 7 días con su sesión si la hay.
// Por ahora es solo lectura; la edición llega en un hito posterior.

import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ALL_WEEK_DAYS, WeekDay } from '@/domain/profile';
import { Plan, Session } from '@/domain/planning';

const DAY_LABELS: Record<WeekDay, string> = {
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
}

export function PlanScreen({ plan }: PlanScreenProps) {
  if (!plan) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Aún no hay plan generado.</Text>
        <Text style={styles.muted}>
          El primer plan se genera automáticamente al completar el onboarding.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Plan de la semana</Text>
        <Text style={styles.meta}>Semana del {plan.weekStart}</Text>
      </View>

      {ALL_WEEK_DAYS.map((day) => {
        const sessions = plan.sessions[day];
        return (
          <View key={day} style={styles.dayRow}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayLabel}>{DAY_LABELS[day]}</Text>
            </View>
            {sessions.length === 0 ? (
              <Text style={styles.restDay}>Descanso</Text>
            ) : (
              sessions.map((session, i) => (
                <SessionCard key={i} session={session} />
              ))
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function SessionCard({ session }: { session: Session }) {
  return (
    <View style={[styles.card, session.discipline === 'strength' ? styles.cardStrength : styles.cardRunning]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDiscipline}>
          {session.discipline === 'strength' ? 'Fuerza' : 'Carrera'}
        </Text>
        <Text style={styles.cardMeta}>~{session.estimatedDurationMinutes} min</Text>
      </View>
      {session.discipline === 'strength' && (
        <>
          <Text style={styles.cardTitle}>{strengthTitle(session)}</Text>
          {session.exercises.length > 0 && (
            <Text style={styles.cardDetail}>
              {session.exercises.length} ejercicio(s): {session.exercises.slice(0, 3).map((e) => e.name).join(', ')}
              {session.exercises.length > 3 ? '…' : ''}
            </Text>
          )}
        </>
      )}
      {session.discipline === 'running' && (
        <>
          <Text style={styles.cardTitle}>{runTitle(session)}</Text>
          {session.blocks.length > 0 && (
            <Text style={styles.cardDetail}>
              {session.blocks.length} bloque(s), {Math.round(totalDistance(session) / 100) / 10} km totales
            </Text>
          )}
        </>
      )}
      {session.purpose && (
        <Text style={styles.purpose}>{session.purpose}</Text>
      )}
    </View>
  );
}

function strengthTitle(s: Extract<Session, { discipline: 'strength' }>): string {
  switch (s.type) {
    case 'upper': return 'Tren superior';
    case 'lower': return 'Tren inferior';
    case 'full_body': return 'Cuerpo completo';
    case 'accessory': return 'Accesorios';
  }
}

function runTitle(s: Extract<Session, { discipline: 'running' }>): string {
  switch (s.type) {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F2',
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
  },
  muted: {
    fontSize: 14,
    color: '#20231F',
    opacity: 0.6,
    textAlign: 'center',
  },
  header: {
    padding: 24,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#20231F',
    marginBottom: 4,
  },
  meta: {
    fontSize: 14,
    color: '#20231F',
    opacity: 0.6,
  },
  dayRow: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EAE3',
  },
  dayHeader: {
    marginBottom: 8,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#20231F',
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  restDay: {
    fontSize: 14,
    color: '#20231F',
    opacity: 0.4,
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
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
    marginBottom: 4,
  },
  cardDiscipline: {
    fontSize: 12,
    fontWeight: '500',
    color: '#20231F',
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardMeta: {
    fontSize: 12,
    color: '#20231F',
    opacity: 0.6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#20231F',
    marginBottom: 4,
  },
  cardDetail: {
    fontSize: 14,
    color: '#20231F',
    opacity: 0.7,
    marginBottom: 4,
  },
  purpose: {
    fontSize: 13,
    color: '#20231F',
    opacity: 0.6,
    fontStyle: 'italic',
    marginTop: 4,
  },
});