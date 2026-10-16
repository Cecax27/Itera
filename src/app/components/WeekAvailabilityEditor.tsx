// Editor de disponibilidad semanal: una fila por día con sus franjas.
// Extraído del onboarding para reutilizarlo también en el asistente de
// creación de planes (donde se precarga la disponibilidad del perfil).

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from './Card';
import { TextField } from './TextField';
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
  const addSlot = () => onChange([...slots, { start: '08:00', end: '09:00' }]);
  const updateSlot = (i: number, patch: Partial<Slot>) =>
    onChange(slots.map((s, j) => (i === j ? { ...s, ...patch } : s)));
  const removeSlot = (i: number) => onChange(slots.filter((_, j) => j !== i));

  return (
    <Card padding="sm" style={styles.card}>
      <Text style={[styles.dayLabel, { color: tokens.colors.ink }]}>{dayLabel(day)}</Text>
      {slots.map((slot, i) => (
        <View key={i} style={styles.slotRow}>
          <TextField value={slot.start} onChangeText={(t) => updateSlot(i, { start: t })} placeholder="HH:mm" />
          <Text style={[styles.slotSep, { color: tokens.colors.textSecondary }]}>a</Text>
          <TextField value={slot.end} onChangeText={(t) => updateSlot(i, { end: t })} placeholder="HH:mm" />
          <Pressable onPress={() => removeSlot(i)} style={styles.removeButton} accessibilityLabel={`Quitar franja de ${dayLabel(day)}`}>
            <Text style={[styles.removeText, { color: tokens.colors.error }]}>×</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={addSlot} accessibilityLabel={`Añadir franja el ${dayLabel(day)}`}>
        <Text style={[styles.add, { color: tokens.colors.ink }]}>+ Añadir franja</Text>
      </Pressable>
    </Card>
  );
}

function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    helper: { fontSize: 15, marginBottom: 12, lineHeight: 21 },
    card: { marginBottom: 8 },
    dayLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
    slotRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    slotSep: { fontSize: 14 },
    removeButton: { paddingHorizontal: 4, paddingVertical: 8 },
    removeText: { fontSize: 18 },
    add: { fontSize: 13, textDecorationLine: 'underline', marginTop: 4 },
  });
}
