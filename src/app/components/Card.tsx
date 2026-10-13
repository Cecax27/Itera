// Card base reutilizable. Acepta un accent lateral opcional (lima para
// strength, azul para carrera) para mantener el patrón de las pantallas
// Hoy y Plan.

import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { ThemeTokens, useThemeTokens } from '../theme';

export type CardAccent = 'none' | 'lime' | 'run';

export interface CardProps {
  children: ReactNode;
  accent?: CardAccent;
  padding?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, accent = 'none', padding = 'md', style }: CardProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);

  const accentStyle =
    accent === 'lime' ? styles.accentLime :
    accent === 'run' ? styles.accentRun :
    styles.noStyle;

  const paddingStyle =
    padding === 'sm' ? styles.paddingSm :
    padding === 'lg' ? styles.paddingLg :
    styles.paddingMd;

  return (
    <View style={[styles.base, paddingStyle, accentStyle, style]}>
      {children}
    </View>
  );
}

function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    base: {
      backgroundColor: tokens.colors.surfaceElevated,
      borderRadius: tokens.radius.lg,
      borderWidth: tokens.borderWidth.hairline,
      borderColor: tokens.colors.border,
    },
    noStyle: {},
    accentLime: {
      borderLeftWidth: 4,
      borderLeftColor: tokens.colors.accent,
    },
    accentRun: {
      borderLeftWidth: 4,
      borderLeftColor: tokens.colors.accentRun,
    },
    paddingSm: { padding: tokens.spacing.md },
    paddingMd: { padding: tokens.spacing.lg },
    paddingLg: { padding: tokens.spacing.xl },
  });
}