// Checklist de equipamiento disponible. Extraído del onboarding para
// reutilizarlo en el asistente de creación de planes.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ALL_EQUIPMENT, Equipment } from '@/domain/profile';
import { ThemeTokens, useThemeTokens } from '../theme';

export interface EquipmentChecklistProps {
  equipment: Equipment;
  onChange: (equipment: Equipment) => void;
  helper?: string;
}

export function EquipmentChecklist({ equipment, onChange, helper }: EquipmentChecklistProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);

  return (
    <View>
      {helper && <Text style={[styles.helper, { color: tokens.colors.textSecondary }]}>{helper}</Text>}
      {ALL_EQUIPMENT.map((id) => (
        <Pressable
          key={id}
          style={[styles.row, { borderBottomColor: tokens.colors.border }]}
          onPress={() => onChange({ ...equipment, [id]: !equipment[id] })}
          accessibilityLabel={equipmentLabel(id)}
          accessibilityState={{ checked: equipment[id] }}
          accessibilityRole="checkbox"
        >
          <View
            style={[
              styles.checkbox,
              { borderColor: tokens.colors.ink },
              equipment[id] && { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
            ]}
          >
            {equipment[id] && <Text style={[styles.checkmark, { color: tokens.colors.accentInk }]}>✓</Text>}
          </View>
          <Text style={[styles.label, { color: tokens.colors.ink }]}>
            {equipmentLabel(id)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function equipmentLabel(id: keyof Equipment): string {
  switch (id) {
    case 'dumbbells': return 'Mancuernas';
    case 'barbell': return 'Barra';
    case 'kettlebell': return 'Kettlebell';
    case 'resistance_bands': return 'Bandas de resistencia';
    case 'pull_up_bar': return 'Barra de dominadas';
    case 'bench': return 'Banco';
    case 'squat_rack': return 'Rack de sentadillas';
    case 'treadmill': return 'Cinta de correr';
    case 'outdoor_running_route': return 'Ruta al aire libre';
    case 'stationary_bike': return 'Bicicleta estática';
  }
}

function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    helper: { fontSize: 15, marginBottom: 12, lineHeight: 21 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
    checkbox: {
      width: 24,
      height: 24,
      borderWidth: 2,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkmark: { fontSize: 14, fontWeight: '700' },
    label: { fontSize: 15 },
  });
}
