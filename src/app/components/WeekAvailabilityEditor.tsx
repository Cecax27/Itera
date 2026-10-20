// Editor de disponibilidad semanal: una fila por día con sus franjas.
// Extraído del onboarding para reutilizarlo también en el asistente de
// creación de planes (donde se precarga la disponibilidad del perfil).
//
// Las horas se eligen con ruedas (TimePickerField), nunca a mano: el
// formato "HH:mm" queda garantizado y cada franja se valida en línea
// (la hora de fin debe ser posterior a la de inicio).

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from './Card';
import { TimePickerField } from './TimePickerField';
import { WeekDay } from '@/domain/profile';
import { ThemeTokens, useThemeTokens } from '../theme';

export interface AvailabilityEditorProps {
  availability: Record<WeekDay, readonly { start: string; end: string }[]>;
  onChange: (availability: Record<WeekDay, readonly { start: string; end: string }[]>) => void;
  /** Si se informa, se muestra bajo el título del componente. */
  helper?: string;
}
interface Slot {
  start: string;
  end: string;
}

/** null si la franja es coherente; texto del problema si no. */
export function slotIssue(slot: Slot): string | null {
  if (slot.end <= slot.start) {
    return 'La hora de fin debe ser posterior a la de inicio.';
  }
  return null;
}

export function WeekAvailabilityEditor({ availability, onChange, helper }: AvailabilityEditorProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);

  return (
    <View>
      {helper && <Text style={[styles.helper, { color: tokens.colors.textSecondary }]}>{helper}</Text>}
      {weekDays.map((day) => (
        <DayRow
          key={day}
          day={day}
          slots={availability[day]}
          onChange={(slots) => onChange({ ...availability, [day]: slots })}
        />
      ))}
    </View>
  );
}

const weekDays: readonly WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function dayLabel(day: WeekDay): string {
  switch (day) {
    case 'mon': return 'Lunes';
    case 'tue': return 'Martes';
    case 'wed': return 'Miércoles';
    case 'thu': return 'Jueves';
    case 'fri': return 'Viernes';
    case 'sat': return 'Sábado';
    case 'sun': return 'Domingo';
  }
}

function DayRow({ day, slots, onChange }: { day: WeekDay; slots: readonly Slot[]; onChange: (slots: Slot[]) => void }) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const addSlot = () => {
    // Nace pegada a la última franja del día (o a primera hora si está vacío).
    const last = slots[slots.length - 1];
    const start = last ? last.end : '08:00';
    onChange([...slots, { start, end: shiftHour(start, 1) }]);
  };
  const updateSlot = (i: number, patch: Partial<Slot>) =>
    onChange(slots.map((s, j) => (i === j ? { ...s, ...patch } : s)));
  const removeSlot = (i: number) => onChange(slots.filter((_, j) => j !== i));

  return (
    <Card padding="sm" style={styles.card}>
      <View style={styles.dayHeader}>
        <Text style={[styles.dayLabel, { color: tokens.colors.ink }]}>{dayLabel(day)}</Text>
        {slots.length === 0 && (
          <Text style={[styles.dayOff, { color: tokens.colors.textSecondary }]}>Descanso</Text>
        )}
      </View>
      {slots.map((slot, i) => {
        const issue = slotIssue(slot);
        return (
          <View key={i}>
            <View style={styles.slotRow}>
              <TimePickerField
                value={slot.start}
                onChange={(t) => updateSlot(i, { start: t })}
                invalid={Boolean(issue)}
                title={`Inicio del ${dayLabel(day).toLowerCase()}`}
              />
              <Text style={[styles.slotSep, { color: tokens.colors.textSecondary }]}>a</Text>
              <TimePickerField
                value={slot.end}
                onChange={(t) => updateSlot(i, { end: t })}
                invalid={Boolean(issue)}
                title={`Fin del ${dayLabel(day).toLowerCase()}`}
              />
              <Pressable
                onPress={() => removeSlot(i)}
                style={styles.removeButton}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Quitar franja de ${dayLabel(day)}`}
              >
                <Ionicons name="close" size={20} color={tokens.colors.error} />
              </Pressable>
            </View>
            {issue && (
              <Text style={[styles.slotIssue, { color: tokens.colors.error }]} accessibilityLiveRegion="polite">
                {issue}
              </Text>
            )}
          </View>
        );
      })}
      <Pressable
        onPress={addSlot}
        style={[styles.addButton, { borderColor: tokens.colors.border }]}
        accessibilityRole="button"
        accessibilityLabel={`Añadir franja el ${dayLabel(day)}`}
      >
        <Ionicons name="add" size={16} color={tokens.colors.ink} />
        <Text style={[styles.addText, { color: tokens.colors.ink }]}>Añadir franja</Text>
      </Pressable>
    </Card>
  );
}

/** Suma horas a una "HH:mm" con envoltorio de medianoche ("23:30" → "00:30"). */
function shiftHour(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (h + hours + 24) % 24;
  return `${String(total).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    helper: { fontSize: 15, marginBottom: 12, lineHeight: 21 },
    card: { marginBottom: 8 },
    dayHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    dayLabel: { fontSize: 14, fontWeight: '600' },
    dayOff: { fontSize: 13 },
    slotRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    slotSep: { fontSize: 14 },
    removeButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: tokens.radius.sm,
    },
    slotIssue: { fontSize: tokens.fontSize.label, marginBottom: 4, marginLeft: 2 },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      minHeight: tokens.minTouch,
      borderRadius: tokens.radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      marginTop: 4,
    },
    addText: { fontSize: 14, fontWeight: '500' },
  });
}
