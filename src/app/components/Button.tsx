// Botón reutilizable. Tres variantes: primary, secondary, danger.
// Cumple las reglas de Identidad-visual:
//   Lima con texto oscuro, nunca blanco.
//   Altura mínima 48 px.
//   Áreas táctiles cómodas.

import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { ThemeTokens, useThemeTokens } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  accessibilityLabel?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  fullWidth = true,
  accessibilityLabel,
}: ButtonProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={tokens.colors.accentInk} />
      ) : (
        <Text
          style={[
            styles.text,
            variant === 'primary' && styles.textPrimary,
            variant === 'secondary' && styles.textSecondary,
            variant === 'danger' && styles.textDanger,
            variant === 'ghost' && styles.textGhost,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    base: {
      minHeight: tokens.minTouch,
      paddingVertical: tokens.spacing.md,
      paddingHorizontal: tokens.spacing.lg,
      borderRadius: tokens.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullWidth: { alignSelf: 'stretch' },
    primary: {
      backgroundColor: tokens.colors.accent,
    },
    secondary: {
      backgroundColor: tokens.colors.surfaceElevated,
      borderWidth: tokens.borderWidth.hairline,
      borderColor: tokens.colors.border,
    },
    danger: {
      backgroundColor: 'transparent',
    },
    ghost: {
      backgroundColor: 'transparent',
    },
    pressed: { opacity: 0.85 },
    disabled: { opacity: 0.5 },
    text: {
      fontSize: tokens.fontSize.bodyLg,
      fontWeight: tokens.fontWeight.semibold,
    },
    textPrimary: { color: tokens.colors.accentInk },
    textSecondary: { color: tokens.colors.ink },
    textDanger: { color: tokens.colors.error },
    textGhost: { color: tokens.colors.ink, opacity: 0.7 },
  });
}