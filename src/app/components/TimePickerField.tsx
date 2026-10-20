// Campo de hora con selector de rueda (hora y minutos).
//
// Sustituye al input de texto libre "HH:mm" de las franjas de
// disponibilidad: el formato válido queda garantizado por construcción.
// Los minutos avanzan en pasos de 5, suficiente para planificar sesiones
// y mantiene la rueda corta en móvil.

import { useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemeTokens, useThemeTokens } from '../theme';
import { PickerModal } from './PickerModal';

export interface TimePickerFieldProps {
  /** Hora "HH:mm" siempre definida (una franja nueva nace con valor). */
  value: string;
  onChange: (time: string) => void;
  /** Tinta el borde en rojo cuando la franja es inconsistente. */
  invalid?: boolean;
  /** Texto del título del selector (ej. "Franja del martes"). */
  title?: string;
  style?: StyleProp<ViewStyle>;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const MINUTE_STEP = 5;

const HOURS: readonly string[] = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES: readonly string[] = Array.from(
  { length: 60 / MINUTE_STEP },
  (_, i) => String(i * MINUTE_STEP).padStart(2, '0'),
);

function parseTime(time: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(time.trim());
  if (!match) return { hour: 8, minute: 0 };
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(MINUTES.length - 1, Math.max(0, Math.round(Number(match[2]) / MINUTE_STEP)));
  return { hour, minute };
}

export function TimePickerField({ value, onChange, invalid, title = 'Elige la hora', style }: TimePickerFieldProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(() => parseTime(value).hour);
  const [minute, setMinute] = useState(() => parseTime(value).minute);

  const openPicker = () => {
    const parsed = parseTime(value);
    setHour(parsed.hour);
    setMinute(parsed.minute);
    setOpen(true);
  };

  const confirm = () => {
    onChange(`${HOURS[hour]}:${MINUTES[minute]}`);
    setOpen(false);
  };

  return (
    <View style={style}>
      <Pressable
        onPress={openPicker}
        style={[
          styles.field,
          { backgroundColor: tokens.colors.surfaceElevated, borderColor: tokens.colors.border },
          invalid && styles.fieldInvalid,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Hora: ${value}`}
        accessibilityValue={{ text: value }}
      >
        <Ionicons name="time-outline" size={16} color={invalid ? tokens.colors.error : tokens.colors.veryMutedText} />
        <Text style={[styles.valueText, { color: tokens.colors.ink }]}>{value}</Text>
        <Ionicons name="chevron-down" size={14} color={tokens.colors.veryMutedText} />
      </Pressable>

      {open && (
        <PickerModal visible title={title} onCancel={() => setOpen(false)} onConfirm={confirm}>
          <View style={styles.wheelRow}>
            <Wheel items={HOURS} index={hour} onIndexChange={setHour} label="Hora" />
            <Wheel items={MINUTES} index={minute} onIndexChange={setMinute} label="Minutos" />
          </View>
          <Text style={[styles.hint, { color: tokens.colors.textSecondary }]}>
            Seleccionado: {HOURS[hour]}:{MINUTES[minute]}
          </Text>
        </PickerModal>
      )}
    </View>
  );
}

interface WheelProps {
  items: readonly string[];
  /** Índice seleccionado dentro de items. */
  index: number;
  onIndexChange: (index: number) => void;
  label: string;
}

/**
 * Columna de rueda con snap al índice más cercano. Los huecos de padding
 * permiten que el primer y último elemento queden centrados.
 */
function Wheel({ items, index, onIndexChange, label }: WheelProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const padding = Math.floor(VISIBLE_ITEMS / 2);
  const data: (string | null)[] = [
    ...Array<null>(padding).fill(null),
    ...items,
    ...Array<null>(padding).fill(null),
  ];

  const handleOffset = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.y;
    const next = Math.round(offset / ITEM_HEIGHT) - padding;
    const clamped = Math.min(items.length - 1, Math.max(0, next));
    if (clamped !== index) onIndexChange(clamped);
  };

  return (
    <View style={styles.wheelColumn}>
      <Text style={[styles.wheelLabel, { color: tokens.colors.textSecondary }]}>{label}</Text>
      <View style={styles.wheelViewport}>
        <View style={styles.wheelBand} pointerEvents="none" />
        <FlatList
          data={data}
          keyExtractor={(_, i) => String(i)}
          getItemLayout={(_, i) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * i, index: i })}
          initialScrollIndex={index}
          renderItem={({ item }) => (
            <View style={styles.wheelItem}>
              <Text style={[styles.wheelItemText, { color: item ? tokens.colors.ink : 'transparent' }]}>
                {item ?? ''}
              </Text>
            </View>
          )}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onScrollEndDrag={handleOffset}
          onMomentumScrollEnd={handleOffset}
          testID={`wheel-${label}`}
        />
      </View>
    </View>
  );
}

function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: tokens.borderWidth.hairline,
      borderRadius: tokens.radius.md,
      minHeight: tokens.minTouch,
      paddingHorizontal: 10,
      flex: 1,
    },
    fieldInvalid: { borderColor: tokens.colors.error },
    valueText: { fontSize: tokens.fontSize.bodyLg, fontWeight: tokens.fontWeight.medium },
    wheelRow: { flexDirection: 'row', gap: tokens.spacing.lg, paddingHorizontal: tokens.spacing.sm },
    wheelColumn: { flex: 1 },
    wheelLabel: {
      fontSize: tokens.fontSize.label,
      textAlign: 'center',
      fontWeight: tokens.fontWeight.medium,
      marginBottom: tokens.spacing.xs,
    },
    wheelViewport: {
      height: ITEM_HEIGHT * VISIBLE_ITEMS,
      overflow: 'hidden',
    },
    wheelBand: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: ITEM_HEIGHT * 2,
      height: ITEM_HEIGHT,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderTopColor: tokens.colors.border,
      borderBottomColor: tokens.colors.border,
    },
    wheelItem: {
      height: ITEM_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wheelItemText: { fontSize: tokens.fontSize.titleSection, fontWeight: tokens.fontWeight.medium },
    hint: { fontSize: tokens.fontSize.label, textAlign: 'center', marginTop: tokens.spacing.sm },
  });
}
