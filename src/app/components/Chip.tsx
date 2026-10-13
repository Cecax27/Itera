// Chip seleccionable. Usado en LoginScreen y OnboardingScreen.

import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { ThemeTokens, useThemeTokens } from '../theme';

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, selected, onPress, disabled, style }: ChipProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    chip: {
      paddingVertical: tokens.spacing.sm,
      paddingHorizontal: 14,
      borderRadius: tokens.radius.md,
      borderWidth: tokens.borderWidth.hairline,
      borderColor: tokens.colors.border,
      backgroundColor: tokens.colors.surfaceElevated,
      minHeight: tokens.minTouch,
      justifyContent: 'center',
    },
    chipSelected: {
      backgroundColor: tokens.colors.accent,
      borderColor: tokens.colors.accent,
    },
    pressed: { opacity: 0.85 },
    disabled: { opacity: 0.5 },
    label: {
      fontSize: tokens.fontSize.body,
      color: tokens.colors.ink,
      fontWeight: tokens.fontWeight.medium,
    },
    labelSelected: {
      fontWeight: tokens.fontWeight.semibold,
    },
  });
}