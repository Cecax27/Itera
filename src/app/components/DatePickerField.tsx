// Campo de fecha objetivo con selector de calendario.
//
// Sustituye al input de texto libre "YYYY-MM-DD": el formato válido queda
// garantizado por construcción y los días pasados se bloquean (una fecha
// objetivo no puede estar en el pasado). La rejilla reutiliza el motor
// puro del dominio (buildMonthGrid, semanas de lunes a domingo).

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { buildMonthGrid, MONTH_NAMES_ES } from '@/domain/planning';
import { ThemeTokens, useThemeTokens } from '../theme';
import { PickerModal } from './PickerModal';

export interface DatePickerFieldProps {
  label?: string;
  /** Fecha ISO "YYYY-MM-DD" o undefined si no hay fecha. */
  value?: string;
  onChange: (dateIso: string | undefined) => void;
  placeholder?: string;
  helper?: string;
  error?: string;
  style?: StyleProp<ViewStyle>;
}

const WEEKDAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
const WEEKDAY_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] as const;

/** Fecha ISO de hoy, en hora local (las metas son a día completo). */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "2027-03-14" → "dom, 14 mar 2027". */
export function formatDateEs(dateIso: string): string {
  const utc = new Date(`${dateIso.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(utc.getTime())) return dateIso;
  const weekday = WEEKDAY_SHORT[(utc.getUTCDay() + 6) % 7];
  const day = dateIso.slice(8, 10);
  const month = MONTH_NAMES_ES[Number(dateIso.slice(5, 7)) - 1]?.slice(0, 3) ?? '';
  return `${weekday}, ${day} ${month} ${dateIso.slice(0, 4)}`;
}

export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = 'Elegir fecha',
  helper,
  error,
  style,
}: DatePickerFieldProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const [open, setOpen] = useState(false);
  const [grid, setGrid] = useState(() => currentMonth(value));

  // Al abrir, el calendario muestra el mes de la fecha elegida (o de hoy).
  useEffect(() => {
    if (open) setGrid(currentMonth(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const today = todayIso();
  const weeks = useMemo(() => buildMonthGrid(grid.year, grid.month), [grid]);
  const monthTitle = `${MONTH_NAMES_ES[grid.month - 1]} ${grid.year}`;
  const hasValue = Boolean(value);

  const moveMonth = (delta: number) => {
    const next = new Date(Date.UTC(grid.year, grid.month - 1 + delta, 1));
    setGrid({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 });
  };

  return (
    <View style={style}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.field,
          { backgroundColor: tokens.colors.surfaceElevated, borderColor: tokens.colors.border },
          error && styles.fieldError,
        ]}
        accessibilityRole="button"
        accessibilityLabel={value ? `${label ?? 'Fecha'}: ${formatDateEs(value)}` : `${label ?? 'Fecha'}: sin fecha`}
      >
        <Ionicons
          name="calendar-outline"
          size={18}
          color={hasValue ? tokens.colors.ink : tokens.colors.veryMutedText}
        />
        {hasValue ? (
          <Text style={[styles.valueText, { color: tokens.colors.ink }]}>{formatDateEs(value!)}</Text>
        ) : (
          <Text style={[styles.valueText, { color: tokens.colors.veryMutedText }]}>{placeholder}</Text>
        )}
        {hasValue && (
          <Pressable
            onPress={() => onChange(undefined)}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel="Quitar la fecha objetivo"
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={18} color={tokens.colors.veryMutedText} />
          </Pressable>
        )}
      </Pressable>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}

      <PickerModal
        visible={open}
        title="Fecha objetivo"
        onCancel={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
      >
        <View style={styles.monthRow}>
          <Pressable onPress={() => moveMonth(-1)} style={styles.monthNav} accessibilityRole="button" accessibilityLabel="Mes anterior">
            <Ionicons name="chevron-back" size={20} color={tokens.colors.ink} />
          </Pressable>
          <Text style={[styles.monthTitle, { color: tokens.colors.ink }]}>{monthTitle}</Text>
          <Pressable onPress={() => moveMonth(1)} style={styles.monthNav} accessibilityRole="button" accessibilityLabel="Mes siguiente">
            <Ionicons name="chevron-forward" size={20} color={tokens.colors.ink} />
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAY_LETTERS.map((letter) => (
            <Text key={letter} style={[styles.weekday, { color: tokens.colors.textSecondary }]}>
              {letter}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.gridRow}>
              {week.map((cell) => {
                const past = cell.date < today;
                const selected = value === cell.date;
                return (
                  <Pressable
                    key={cell.date}
                    disabled={past}
                    onPress={() => onChange(cell.date)}
                    style={[
                      styles.day,
                      selected && { backgroundColor: tokens.colors.accent },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: past }}
                    accessibilityLabel={formatDateEs(cell.date)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: tokens.colors.ink },
                        !cell.inMonth && { color: tokens.colors.veryMutedText },
                        past && { color: tokens.colors.veryMutedText },
                        selected && { color: tokens.colors.accentInk, fontWeight: tokens.fontWeight.bold },
                        cell.date === today && !selected && styles.dayToday,
                      ]}
                    >
                      {cell.dayOfMonth}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.quickRow}>
          <Pressable
            onPress={() => { onChange(today); setGrid(currentMonth(today)); }}
            style={styles.quickButton}
            accessibilityRole="button"
          >
            <Text style={[styles.quickText, { color: tokens.colors.ink }]}>Hoy</Text>
          </Pressable>
          {hasValue && (
            <Pressable
              onPress={() => onChange(undefined)}
              style={styles.quickButton}
              accessibilityRole="button"
            >
              <Text style={[styles.quickText, { color: tokens.colors.textSecondary }]}>Quitar fecha</Text>
            </Pressable>
          )}
        </View>
        <Text style={[styles.modalHint, { color: tokens.colors.textSecondary }]}>
          Solo puedes elegir hoy o fechas futuras.
        </Text>
      </PickerModal>
    </View>
  );
}

function currentMonth(dateIso?: string): { year: number; month: number } {
  const source = dateIso ?? todayIso();
  return {
    year: Number(source.slice(0, 4)),
    month: Number(source.slice(5, 7)),
  };
}

function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    label: {
      fontSize: tokens.fontSize.label,
      fontWeight: tokens.fontWeight.medium,
      color: tokens.colors.ink,
      marginBottom: tokens.spacing.sm,
      marginTop: tokens.spacing.md,
    },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: tokens.borderWidth.hairline,
      borderRadius: tokens.radius.md,
      paddingHorizontal: 14,
      minHeight: tokens.minTouch,
    },
    fieldError: { borderColor: tokens.colors.error },
    valueText: { flex: 1, fontSize: tokens.fontSize.bodyLg, minHeight: tokens.minTouch, textAlignVertical: 'center' },
    clearButton: { padding: 8, marginRight: -8 },
    errorText: {
      fontSize: tokens.fontSize.label,
      color: tokens.colors.error,
      marginTop: tokens.spacing.xs,
    },
    helperText: {
      fontSize: tokens.fontSize.label,
      color: tokens.colors.textSecondary,
      marginTop: tokens.spacing.xs,
    },
    monthRow: { flexDirection: 'row', alignItems: 'center', marginTop: tokens.spacing.xs },
    monthNav: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: tokens.radius.sm,
    },
    monthTitle: { flex: 1, textAlign: 'center', fontSize: tokens.fontSize.body, fontWeight: tokens.fontWeight.semibold, textTransform: 'capitalize' },
    weekdayRow: { flexDirection: 'row', marginTop: tokens.spacing.sm },
    weekday: { flex: 1, textAlign: 'center', fontSize: tokens.fontSize.label, fontWeight: tokens.fontWeight.medium },
    grid: { marginTop: tokens.spacing.xs },
    gridRow: { flexDirection: 'row' },
    day: {
      flex: 1,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: tokens.radius.sm,
    },
    dayText: { fontSize: tokens.fontSize.body, textAlign: 'center' },
    dayToday: { textDecorationLine: 'underline' },
    quickRow: { flexDirection: 'row', gap: tokens.spacing.lg, marginTop: tokens.spacing.sm, marginBottom: tokens.spacing.xs },
    quickButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
    quickText: { fontSize: tokens.fontSize.body, fontWeight: tokens.fontWeight.medium },
    modalHint: { fontSize: tokens.fontSize.label, marginBottom: tokens.spacing.sm },
  });
}
