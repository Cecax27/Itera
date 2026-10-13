// Wrapper de pantalla: aplica fondo del tema y padding consistente.
// Usar como raíz de cada pantalla en lugar de View/ScrollView desnudos.

import { ReactNode } from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeTokens, useThemeTokens } from '../theme';

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Si true, aplica contentInsetAdjustmentBehavior iOS. Por defecto true. */
  iOSScrollAdjustment?: boolean;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  contentStyle,
  iOSScrollAdjustment = true,
}: ScreenProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const insets = useSafeAreaInsets();

  const paddingStyle = padded
    ? { paddingHorizontal: tokens.spacing.xl, paddingTop: tokens.spacing.lg, paddingBottom: Math.max(tokens.spacing.xl, insets.bottom + tokens.spacing.md) }
    : undefined;

  if (scroll) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[paddingStyle, contentStyle]}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior={iOSScrollAdjustment ? 'automatic' : undefined}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, paddingStyle, contentStyle]}>
      {children}
    </View>
  );
}

function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tokens.colors.canvas,
    },
  });
}