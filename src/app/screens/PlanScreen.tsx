// Pantalla del plan semanal con tres modos de vista:
//  - Lista: sesiones pendientes o futuras de la semana del plan
//    (los días pasados solo muestran lo no realizado, con opción de ocultarlo).
//  - Semana: los 7 días (lunes a domingo) de una semana navegable;
//    se combinan sesiones planeadas y registros realizados.
//  - Mes: calendario del mes navegable; al pulsar un día se ve su detalle.
//
// Todas las cards son minimalistas: al pulsarlas se abre la vista de
// detalle, que concentra el registro de resultados y la edición.

import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Chip, RecordedSessionCard, Screen as ScreenLayout } from '@/app/components';
import { FadeIn } from '@/app/animations';
import { Ionicons } from '@expo/vector-icons';
import { ALL_WEEK_DAYS, WeekDay } from '@/domain/profile';
import { Plan, Session, addUtcDays, buildMonthGrid, dateForWeekDay, monthLabel, monthOf, weekDayOf, weekPlanForDate, mondayOf } from '@/domain/planning';
import { MonthCell } from '@/domain/planning/calendar';
import { useThemeTokens } from '@/app/theme';
import {
  ActiveTrainingSession,
  hasCompleteResult,
  plannedSessionRecordId,
  RecordedTrainingSession,
} from '@/domain/training';

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

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const MONTH_GRID_HEADER = ALL_WEEK_DAYS.map((day) => DAY_LABELS[day]);

type PlanViewMode = 'list' | 'week' | 'month';

const VIEW_MODE_LABELS: Record<PlanViewMode, string> = {
  list: 'Lista',
  week: 'Semana',
  month: 'Mes',
};

type DayEntry =
  | { session: Session; record: RecordedTrainingSession | null; planned: true; day: WeekDay; index: number; weekStart: string }
  | { record: RecordedTrainingSession }; // registro sin sesión planificada (sesión libre).

function isFreeRecord(entry: DayEntry): entry is Extract<DayEntry, { record: RecordedTrainingSession }> {
  return !('session' in entry);
}

export interface PlanScreenProps {
  plan: Plan | null;
  onRegisterFree: (date: string) => void;
  recordedSessions: readonly RecordedTrainingSession[];
  historyLoading: boolean;
  onRefreshHistory: () => Promise<void>;
  activeTraining: ActiveTrainingSession | null;
  /** Abre el asistente de creación de plan con IA. */
  onCreatePlan: () => void;
  /** Abre la vista de detalle de una sesión concreta (con su semana del bloque). */
  onOpenSessionDetail: (day: WeekDay, index: number, weekStart: string) => void;
  /** Elimina el plan completo (con confirmación previa). */
  onDeletePlan: () => void;
}

export function PlanScreen({
  plan,
  onRegisterFree,
  recordedSessions,
  historyLoading,
  onRefreshHistory,
  activeTraining,
  onCreatePlan,
  onOpenSessionDetail,
  onDeletePlan,
}: PlanScreenProps) {
  const tokens = useThemeTokens();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(tokens);

  const [viewMode, setViewMode] = useState<PlanViewMode>('list');
  /** Oculta las sesiones de días pasados que quedaron sin realizar. */
  const [hidePastUncompleted, setHidePastUncompleted] = useState(true);
  /** Desplazamiento de semanas respecto a la semana actual (0 = actual). */
  const [weekOffset, setWeekOffset] = useState(0);
  /** Mes mostrado en la vista mes (null = mes actual). */
  const [monthAnchor, setMonthAnchor] = useState<{ year: number; month: number } | null>(null);
  /** Día seleccionado en la vista mes. */
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    void onRefreshHistory();
  }, [onRefreshHistory]));

  // Semana de referencia para la vista de lista: la que contiene hoy
  // (si hoy está en el bloque); si está fuera, la última pasada o la primera.
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const listWeekIndex = useMemo(() => {
    if (!plan || plan.weeks.length === 0) return 0;
    const todayMonday = mondayOf(todayIso);
    const index = plan.weeks.findIndex((week) => week.weekStart === todayMonday);
    if (index >= 0) return index;
    return todayIso < plan.weeks[0].weekStart ? 0 : plan.weeks.length - 1;
  }, [plan, todayIso]);

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
          onPress={() => onRegisterFree(todayIso)}
          variant="secondary"
          disabled={historyLoading || Boolean(activeTraining && ['active', 'paused'].includes(activeTraining.progress.status))}
          style={styles.freeSessionButton}
        />
      </ScreenLayout>
    );
  }

  const week = plan.weeks[listWeekIndex] ?? plan.weeks[0];
  // Último día del bloque: la fecha objetivo o el domingo de la última semana.
  const blockEndDate = plan.goalDate ?? addUtcDays(plan.weeks[plan.weeks.length - 1].weekStart, 6);
  // Alias no nulo para las funciones auxiliares (el estrechado de tipos
  // no se propaga dentro de las declaraciones de función).
  const currentPlan = plan;
  const goalLabel = plan.goalDate ? formatDateLabel(plan.goalDate) : null;

  /**
   * Entradas a mostrar de un día. Las sesiones planificadas salen de la
   * semana del bloque que contiene la fecha de calendario: así la vista
   * de mes muestra todas las sesiones del plan. Además se añaden los
   * registros realizados de esa fecha (sesiones libres o planes antiguos).
   */
  function buildDayEntries(weekStartIso: string, day: WeekDay): DayEntry[] {
    const dateIso = dateForWeekDay(weekStartIso, day);
    const entries: DayEntry[] = [];
    const matchedRecordIds = new Set<string>();

    const blockWeek = weekPlanForDate(currentPlan, dateIso);
    if (blockWeek) {
      blockWeek.sessions[day].forEach((session, index) => {
        const id = plannedSessionRecordId(blockWeek.weekStart, day, index);
        matchedRecordIds.add(id);
        const record = recordedSessions.find((candidate) => candidate.metadata.id === id) ?? null;
        entries.push({ session, record, planned: true, day, index, weekStart: blockWeek.weekStart });
      });
    }

    recordedSessions
      .filter((record) => record.metadata.date === dateIso && !matchedRecordIds.has(record.metadata.id))
      .forEach((record) => entries.push({ record }));

    return entries;
  }

  /** Entradas visibles de un día en el modo lista. */
  function filterEntriesForList(entries: DayEntry[], dateIso: string): DayEntry[] {
    if (dateIso >= todayIso) {
      // Pendientes y futuras: se muestran todas.
      return entries;
    }
    // Días pasados: solo lo que quedó pendiente (sin resultado completo).
    const pending = entries.filter((entry) =>
      !isFreeRecord(entry) && !(entry.record && hasCompleteResult(entry.session, entry.record)));
    return hidePastUncompleted ? [] : pending;
  }

  /** Marca por disciplina de un día, para los puntos del calendario. */
  function dayMarks(dateIso: string): { strength: number; running: number } {
    const entries = buildDayEntries(mondayOf(dateIso), weekDayOf(dateIso));
    const marks = { strength: 0, running: 0 };
    entries.forEach((entry) => {
      const discipline = isFreeRecord(entry) ? entry.record.metadata.discipline : entry.session.discipline;
      if (discipline === 'strength') marks.strength += 1;
      else marks.running += 1;
    });
    return marks;
  }

  const renderEntry = (entry: DayEntry, key: string) => {
    if (isFreeRecord(entry)) {
      return <FreeRecordCard key={key} record={entry.record} />;
    }
    return (
      <PlannedSessionCard
        key={key}
        session={entry.session}
        day={entry.day}
        index={entry.index}
        weekStart={entry.weekStart}
        record={entry.record}
        activeTraining={activeTraining}
        onPress={() => onOpenSessionDetail(entry.day, entry.index, entry.weekStart)}
      />
    );
  };

  const weekStartIso = addUtcDays(mondayOf(todayIso), weekOffset * 7);
  const weekEndIso = addUtcDays(weekStartIso, 6);

  /** Datos comunes de un día para las vistas lista y semana. */
  const renderDayRow = (day: WeekDay, weekIso: string, filterForList: boolean) => {
    const dateIso = dateForWeekDay(weekIso, day);
    const isToday = dateIso === todayIso;
    const entries = filterForList
      ? filterEntriesForList(buildDayEntries(weekIso, day), dateIso)
      : buildDayEntries(weekIso, day);
    // En modo lista no se muestran días sin nada que hacer (descanso o ya
    // ocultos por la opción de anteriores no realizadas).
    if ((filterForList && entries.length === 0)) return null;
    return (
      <View style={[styles.dayRow, isToday && styles.todayRow]}>
        <View style={[styles.dayHeader, isToday && styles.todayHeader]}>
          <Text style={[styles.dayBadge, isToday && styles.todayBadge]}>
            {DAY_LABELS[day]}
          </Text>
          <Text style={styles.dayFullLabel}>
            {filterForList
              ? `${DAY_FULL_LABELS[day]} · ${formatShortDate(dateIso)}${isToday ? ' · hoy' : ''}`
              : `${DAY_FULL_LABELS[day]} ${dateIso.slice(8, 10)}${isToday ? ' · hoy' : ''}`}
          </Text>
        </View>
        {entries.length === 0 ? (
          <Text style={styles.restDay}>Descanso</Text>
        ) : (
          entries.map((entry, j) => renderEntry(entry, `${day}_${j}`))
        )}
      </View>
    );
  };

  const listModeBody = ALL_WEEK_DAYS.map((day) => renderDayRow(day, week.weekStart, true));

  const weekModeBody = (
    <>
      <View style={styles.navBar}>
        <Pressable
          onPress={() => setWeekOffset((offset) => offset - 1)}
          hitSlop={8}
          style={styles.navArrow}
          accessibilityLabel="Semana anterior"
        >
          <Ionicons name="chevron-back" size={22} color={tokens.colors.ink} />
        </Pressable>
        <Text style={styles.navTitle}>
          {weekOffset === 0
            ? 'Semana actual'
            : `Semana del ${formatShortDate(weekStartIso)} al ${formatShortDate(weekEndIso)}`}
        </Text>
        <Pressable
          onPress={() => setWeekOffset((offset) => offset + 1)}
          hitSlop={8}
          style={styles.navArrow}
          accessibilityLabel="Semana siguiente"
        >
          <Ionicons name="chevron-forward" size={22} color={tokens.colors.ink} />
        </Pressable>
      </View>
      {weekOffset !== 0 && (
        <Text style={styles.hint}>
          Las sesiones planificadas corresponden a las semanas del bloque del plan; en otras semanas se muestran solo los registros realizados.
        </Text>
      )}
      {ALL_WEEK_DAYS.map((day) => renderDayRow(day, weekStartIso, false))}
    </>
  );

  const anchor = monthAnchor ?? monthOf(todayIso);
  const { year, month } = anchor;
  const grid = buildMonthGrid(anchor.year, anchor.month);
  const monthSelectedDate = (() => {
    if (selectedDate && monthOf(selectedDate).year === anchor.year
      && monthOf(selectedDate).month === anchor.month) {
      return selectedDate;
    }
    const todayMonth = monthOf(todayIso);
    return todayMonth.year === anchor.year && todayMonth.month === anchor.month
      ? todayIso
      : grid.flat().find((cell) => cell.inMonth)!.date;
  })();

  const monthModeBody = (
    <>
      <View style={styles.navBar}>
        <Pressable
          onPress={() => setMonthAnchor(month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 })}
          hitSlop={8}
          style={styles.navArrow}
          accessibilityLabel="Mes anterior"
        >
          <Ionicons name="chevron-back" size={22} color={tokens.colors.ink} />
        </Pressable>
        <Text style={styles.navTitle}>{monthLabel(anchor.year, anchor.month)}</Text>
        <Pressable
          onPress={() => setMonthAnchor(month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 })}
          hitSlop={8}
          style={styles.navArrow}
          accessibilityLabel="Mes siguiente"
        >
          <Ionicons name="chevron-forward" size={22} color={tokens.colors.ink} />
        </Pressable>
      </View>
      <View style={styles.monthGrid}>
        {MONTH_GRID_HEADER.map((label) => (
          <Text key={label} style={styles.monthGridHeader}>{label}</Text>
        ))}
      </View>
      {grid.map((week, rowIdx) => (
        <View key={rowIdx} style={styles.monthGrid}>
          {week.map((cell) => (
            <MonthCellView
              key={cell.date}
              cell={cell}
              todayIso={todayIso}
              selected={cell.date === monthSelectedDate}
              marks={dayMarks(cell.date)}
              hasRecords={recordedSessions.some((r) => r.metadata.date === cell.date)}
              onPress={() => setSelectedDate(cell.date)}
            />
          ))}
        </View>
      ))}
      <View style={styles.monthSection}>
        <Text style={styles.sectionLabel}>
          SESIONES DEL {formatLongDate(monthSelectedDate).toUpperCase()}
        </Text>
        {(() => {
          const entries = buildDayEntries(mondayOf(monthSelectedDate), weekDayOf(monthSelectedDate));
          if (entries.length === 0) {
            return <Text style={styles.restDay}>Descanso o sin registros.</Text>;
          }
          return entries.map((entry, j) => renderEntry(entry, `${monthSelectedDate}_${j}`));
        })()}
      </View>
    </>
  );

  return (
    <ScreenLayout scroll contentStyle={{ paddingTop: insets.top + tokens.spacing.lg }}>
      <FadeIn delay={0}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Tu plan</Text>
            <Text style={styles.meta}>
              {plan.weeks.length > 1
                ? `Bloque de ${plan.weeks.length} semanas · del ${formatShortDate(plan.weeks[0].weekStart)} al ${formatShortDate(blockEndDate)}`
                : `Semana del ${formatShortDate(week.weekStart)} · ${countSessions(week)} sesiones`}
            </Text>
            {goalLabel ? (
              <Text style={styles.goalLabel}>Objetivo: {goalLabel}</Text>
            ) : null}
          </View>
          <Pressable
            onPress={onCreatePlan}
            hitSlop={8}
            style={styles.createPlanIcon}
            accessibilityLabel="Nuevo plan con IA"
            accessibilityRole="button"
          >
            <Ionicons name="sparkles-outline" size={22} color={tokens.colors.accent} />
          </Pressable>
        </View>
      </FadeIn>

      <View style={styles.modeSelector}>
        {(['list', 'week', 'month'] as const).map((mode) => (
          <Chip
            key={mode}
            label={VIEW_MODE_LABELS[mode]}
            selected={viewMode === mode}
            onPress={() => setViewMode(mode)}
          />
        ))}
      </View>

      {viewMode === 'list' && (
        <Pressable
          onPress={() => setHidePastUncompleted((value) => !value)}
          style={styles.toggleOption}
          accessibilityRole="switch"
          accessibilityState={{ checked: hidePastUncompleted }}
        >
          <Ionicons
            name={hidePastUncompleted ? 'eye-off-outline' : 'eye-outline'}
            size={16}
            color={tokens.colors.textSecondary}
          />
          <Text style={styles.toggleLabel}>
            {hidePastUncompleted
              ? 'Ocultando anteriores no realizadas'
              : 'Mostrando anteriores no realizadas'}
          </Text>
        </Pressable>
      )}

      <FadeIn delay={0}>
        {viewMode === 'list' && listModeBody}
        {viewMode === 'week' && weekModeBody}
        {viewMode === 'month' && monthModeBody}
      </FadeIn>

      <Button
        label="Registrar sesión libre"
        onPress={() => onRegisterFree(todayIso)}
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

function formatDateLabel(dateIso: string): string {
  const date = new Date(`${dateIso.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return dateIso;
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
}

/** "12 oct" */
function formatShortDate(dateIso: string): string {
  const SHORT_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${dateIso.slice(8, 10)} ${SHORT_MONTHS[Number(dateIso.slice(5, 7)) - 1]}`;
}

/** "lunes 18 de octubre" */
function formatLongDate(dateIso: string): string {
  const monthIndex = Number(dateIso.slice(5, 7)) - 1;
  return `${DAY_FULL_LABELS[weekDayOf(dateIso)].toLowerCase()} ${dateIso.slice(8, 10)} de ${MONTH_NAMES[monthIndex]}`;
}

/** Celda del calendario mensual: número, puntos por disciplina y selección. */
function MonthCellView({
  cell,
  todayIso,
  selected,
  marks,
  hasRecords,
  onPress,
}: {
  cell: MonthCell;
  todayIso: string;
  selected: boolean;
  marks: { strength: number; running: number };
  hasRecords: boolean;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  const styles = cellStyles(tokens);
  const isToday = cell.date === todayIso;
  const extra = hasRecords && marks.strength + marks.running === 0 ? 1 : 0;
  const totalDots = Math.min(3, marks.strength + marks.running + extra);

  return (
    <Pressable onPress={onPress} style={styles.cell} accessibilityLabel={`Sesiones del ${cell.date}`}>
      <View
        style={[
          styles.circle,
          isToday && styles.todayCircle,
          selected && !isToday && styles.selectedCircle,
        ]}
      >
        <Text
          style={[
            styles.dayNumber,
            isToday && styles.todayText,
            selected && !isToday && styles.selectedText,
            !cell.inMonth && styles.otherMonthText,
          ]}
        >
          {cell.dayOfMonth}
        </Text>
      </View>
      <View style={styles.dots}>
        {Array.from({ length: totalDots }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i < marks.strength ? tokens.colors.accent : tokens.colors.accentRun },
            ]}
          />
        ))}
      </View>
    </Pressable>
  );
}

function cellStyles(tokens: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
    cell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 4,
    },
    circle: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    todayCircle: {
      backgroundColor: tokens.colors.accent,
    },
    selectedCircle: {
      borderWidth: 1.5,
      borderColor: tokens.colors.ink,
    },
    dayNumber: {
      fontSize: 12,
      fontWeight: '600',
      color: tokens.colors.ink,
    },
    todayText: {
      color: tokens.colors.accentInk,
    },
    selectedText: {
      fontWeight: tokens.fontWeight.bold,
    },
    otherMonthText: {
      opacity: 0.3,
    },
    dots: {
      flexDirection: 'row',
      gap: 3,
      marginTop: 2,
      height: 4,
    },
    dot: {
      width: 4,
      height: 4,
      borderRadius: 2,
    },
  });
}

function PlannedSessionCard({
  session,
  weekStart,
  day,
  index,
  record,
  activeTraining,
  onPress,
}: {
  session: Session;
  weekStart: string;
  day: WeekDay;
  index: number;
  record: RecordedTrainingSession | null;
  activeTraining: ActiveTrainingSession | null;
  onPress: () => void;
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
        <SessionCardRow
          session={session}
          title="Sesión en curso"
          subtitle="Continúa desde Hoy."
          tokens={tokens}
        />
      </Card>
    );
  }
  if (record && record.metadata.trainingProgress?.status !== 'active' && record.metadata.trainingProgress?.status !== 'paused') {
    return (
      <Pressable onPress={onPress} android_ripple={{ color: tokens.colors.border }}>
        <RecordedSessionCard session={session} record={record} compact />
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress} android_ripple={{ color: tokens.colors.border }}>
      <SessionCard session={session} />
    </Pressable>
  );
}

/** Card compacta para un registro sin sesión planificada (sesión libre). */
function FreeRecordCard({ record }: { record: RecordedTrainingSession }) {
  const tokens = useThemeTokens();
  const styles = freeRecordStyles;
  const isRunning = record.metadata.discipline === 'running';
  const completedSets = record.sets.filter((set) => set.status !== 'skipped' && typeof set.actualReps === 'number');
  const volume = completedSets.reduce(
    (sum, set) => sum + (set.actualWeightKg ?? 0) * (set.actualReps ?? 0),
    0,
  );
  const incomplete = record.metadata.trainingProgress?.status === 'incomplete';
  return (
    <Card accent={isRunning ? 'run' : 'lime'} padding="md" style={sessionCardStyles.cardSpacing}>
      <View style={styles.row}>
        <View style={[sessionCardStyles.iconCircle, { backgroundColor: tokens.colors.surface }]}>
          <Ionicons
            name={isRunning ? 'timer-outline' : 'barbell-outline'}
            size={20}
            color={isRunning ? tokens.colors.accentRun : tokens.colors.accent}
          />
        </View>
        <View style={sessionCardStyles.rowContent}>
          <Text style={[styles.title, { color: tokens.colors.ink }]}>
            Sesión registrada{incomplete ? ' (incompleta)' : ''}
          </Text>
          {isRunning && record.runLog ? (
            <>
              <Text style={[styles.detail, { color: tokens.colors.textSecondary }]}>
                Hecho: {(record.runLog.actualDistanceMeters / 1000).toFixed(1)} km · {Math.round(record.runLog.actualDurationSeconds / 60)} min · RPE {record.runLog.rpe}
              </Text>
              <Text style={[styles.detail, { color: tokens.colors.textSecondary }]}>
                Ritmo {formatPaceLabel(record.runLog.actualPaceSecondsPerKm)}
              </Text>
            </>
          ) : (
            <Text style={[styles.detail, { color: tokens.colors.textSecondary }]}>
              {completedSets.length} de {record.sets.length} series · {Math.round(volume)} kg·reps
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}

/** Ritmo en "mm:ss /km" (misma convención que formatPace del dominio). */
function formatPaceLabel(secondsPerKm: number | null): string {
  if (secondsPerKm === null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '—';
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
}

const freeRecordStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: { fontSize: 16, fontWeight: '600' },
  detail: { fontSize: 13, lineHeight: 18 },
});

/** Fila genérica de card: icono de disciplina, título, dato esencial y chevron. */
function SessionCardRow({
  session,
  title,
  subtitle,
  tokens,
}: {
  session: Session;
  title: string;
  subtitle: string;
  tokens: ReturnType<typeof useThemeTokens>;
}) {
  const isStrength = session.discipline === 'strength';
  return (
    <View style={sessionCardStyles.row}>
      <View style={[sessionCardStyles.iconCircle, { backgroundColor: tokens.colors.surface }]}>
        <Ionicons
          name={isStrength ? 'barbell-outline' : 'timer-outline'}
          size={20}
          color={isStrength ? tokens.colors.accent : tokens.colors.accentRun}
        />
      </View>
      <View style={sessionCardStyles.rowContent}>
        <Text style={[sessionCardStyles.title, { color: tokens.colors.ink }]}>
          {title}
        </Text>
        <Text style={[sessionCardStyles.detail, { color: tokens.colors.textSecondary }]}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={tokens.colors.veryMutedText} />
    </View>
  );
}

function SessionCard({ session }: { session: Session }) {
  const tokens = useThemeTokens();
  const subtitle = session.discipline === 'strength'
    ? `${session.exercises.length} ${session.exercises.length === 1 ? 'ejercicio' : 'ejercicios'} · ~${session.estimatedDurationMinutes} min`
    : `~${(totalDistance(session) / 1000).toFixed(1)} km · ~${session.estimatedDurationMinutes} min`;
  return (
    <Card
      accent={session.discipline === 'strength' ? 'lime' : 'run'}
      padding="md"
      style={sessionCardStyles.cardSpacing}
    >
      <SessionCardRow
        session={session}
        title={sessionTitle(session)}
        subtitle={subtitle}
        tokens={tokens}
      />
    </Card>
  );
}

const sessionCardStyles = StyleSheet.create({
  cardSpacing: { marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  title: { fontSize: 16, fontWeight: '600' },
  detail: { fontSize: 13, lineHeight: 18 },
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
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: tokens.spacing.lg,
    },
    headerText: {
      flex: 1,
    },
    createPlanIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: tokens.fontSize.titleBig,
      fontWeight: tokens.fontWeight.bold,
      color: tokens.colors.ink,
      marginBottom: 4,
      letterSpacing: -0.5,
    },
    meta: {
      fontSize: tokens.fontSize.caption,
      color: tokens.colors.textSecondary,
      fontVariant: ['tabular-nums'],
      marginTop: 2,
    },
    modeSelector: {
      flexDirection: 'row',
      gap: tokens.spacing.sm,
      marginVertical: tokens.spacing.md,
    },
    toggleOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
    },
    toggleLabel: {
      fontSize: tokens.fontSize.label,
      color: tokens.colors.textSecondary,
    },
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: tokens.spacing.sm,
    },
    navArrow: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navTitle: {
      fontSize: tokens.fontSize.body,
      fontWeight: tokens.fontWeight.semibold,
      color: tokens.colors.ink,
      textAlign: 'center',
      flex: 1,
    },
    hint: {
      fontSize: tokens.fontSize.caption,
      color: tokens.colors.textSecondary,
      marginBottom: tokens.spacing.sm,
    },
    monthGrid: {
      flexDirection: 'row',
    },
    monthGridHeader: {
      flex: 1,
      textAlign: 'center',
      fontSize: tokens.fontSize.caption,
      fontWeight: tokens.fontWeight.semibold,
      color: tokens.colors.textSecondary,
      paddingBottom: 4,
    },
    monthSection: {
      marginTop: tokens.spacing.lg,
      marginBottom: tokens.spacing.sm,
    },
    sectionLabel: {
      fontSize: tokens.fontSize.caption,
      fontWeight: tokens.fontWeight.semibold,
      letterSpacing: 0.7,
      color: tokens.colors.textSecondary,
      marginBottom: tokens.spacing.xs,
    },
    goalLabel: {
      fontSize: tokens.fontSize.caption,
      color: tokens.colors.textSecondary,
      marginTop: 2,
      textTransform: 'capitalize',
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
      fontSize: tokens.fontSize.label,
      fontWeight: tokens.fontWeight.medium,
      color: tokens.colors.ink,
    },
    restDay: {
      fontSize: tokens.fontSize.label,
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
    deletePlanButton: { marginTop: tokens.spacing.md, marginBottom: tokens.spacing.xl },
  });
}
