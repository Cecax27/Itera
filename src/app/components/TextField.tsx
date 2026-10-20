// Input de texto. Usado en LoginScreen y OnboardingScreen.

import { ReactNode } from 'react';
import {
  KeyboardTypeOptions,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';

import { ThemeTokens, useThemeTokens } from '../theme';

export interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  multiline?: boolean;
  error?: string;
  helper?: string;
  /** Límite de caracteres; muestra contador "n/máx" bajo el campo. */
  maxLength?: number;
  rightAdornment?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  multiline,
  error,
  helper,
  maxLength,
  style,
}: TextFieldProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);

  return (
    <View style={[styles.wrapper, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputBox, error && styles.inputBoxError, multiline && styles.inputMultiline]}>
        <TextInput
          style={[styles.input, multiline && styles.inputMultilineText]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tokens.colors.veryMutedText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          multiline={multiline}
          maxLength={maxLength}
          selectionColor={tokens.colors.accent}
        />
      </View>
      {(error || helper || maxLength != null) && (
        <View style={styles.footRow}>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : helper ? (
            <Text style={styles.helperText}>{helper}</Text>
          ) : (
            <View />
          )}
          {maxLength != null && (
            <Text style={[styles.counter, value.length > maxLength - 40 && { color: tokens.colors.error }]}>
              {value.length}/{maxLength}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    wrapper: {
      marginBottom: tokens.spacing.md,
    },
    label: {
      fontSize: tokens.fontSize.label,
      fontWeight: tokens.fontWeight.medium,
      color: tokens.colors.ink,
      marginBottom: tokens.spacing.sm,
      marginTop: tokens.spacing.md,
    },
    inputBox: {
      backgroundColor: tokens.colors.surfaceElevated,
      borderWidth: tokens.borderWidth.hairline,
      borderColor: tokens.colors.border,
      borderRadius: tokens.radius.md,
    },
    inputBoxError: {
      borderColor: tokens.colors.error,
    },
    inputMultiline: {
      minHeight: 96,
    },
    input: {
      padding: 14,
      fontSize: tokens.fontSize.bodyLg,
      color: tokens.colors.ink,
      minHeight: tokens.minTouch,
    },
    inputMultilineText: {
      minHeight: 96,
      textAlignVertical: 'top',
    },
    errorText: {
      fontSize: tokens.fontSize.label,
      color: tokens.colors.error,
      marginTop: tokens.spacing.xs,
      flex: 1,
    },
    helperText: {
      fontSize: tokens.fontSize.label,
      color: tokens.colors.textSecondary,
      marginTop: tokens.spacing.xs,
      flex: 1,
    },
    footRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: tokens.spacing.sm,
    },
    counter: {
      fontSize: tokens.fontSize.label,
      color: tokens.colors.veryMutedText,
      marginTop: tokens.spacing.xs,
      fontVariant: ['tabular-nums'],
    },
  });
}