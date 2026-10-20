// Hoja modal inferior reutilizable para selectores (fecha, hora).
//
// Patrón iOS: "Cancelar" a la izquierda, título al centro y acción de
// confirmación a la derecha. El fondo cierra al pulsarlo. Se apoya en
// tokens del tema, sin colores fijos, para funcionar en claro y oscuro.

import { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeTokens, useThemeTokens } from '../theme';

export interface PickerModalProps {
  visible: boolean;
  title: string;
  /** Texto del botón de confirmación (derecha). Por defecto "Listo". */
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  children: ReactNode;
}

export function PickerModal({
  visible,
  title,
  confirmLabel = 'Listo',
  onCancel,
  onConfirm,
  children,
}: PickerModalProps) {
  const tokens = useThemeTokens();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(tokens);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouchable} onPress={onCancel} accessibilityLabel="Cerrar selector" />
        <View
          style={[
            styles.sheet,
            { backgroundColor: tokens.colors.surfaceElevated, paddingBottom: Math.max(insets.bottom, tokens.spacing.md) },
          ]}
        >
          <View style={styles.header}>
            <Pressable onPress={onCancel} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Cancelar">
              <Text style={[styles.headerAction, { color: tokens.colors.textSecondary }]}>Cancelar</Text>
            </Pressable>
            <Text style={[styles.title, { color: tokens.colors.ink }]} numberOfLines={1}>
              {title}
            </Text>
            <Pressable onPress={onConfirm} style={[styles.headerButton, styles.headerButtonRight]} accessibilityRole="button" accessibilityLabel={confirmLabel}>
              <Text style={[styles.headerAction, { color: tokens.colors.ink, fontWeight: tokens.fontWeight.semibold }]}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', justifyContent: 'flex-end' },
    backdropTouchable: { flex: 1 },
    sheet: {
      borderTopLeftRadius: tokens.radius.lg,
      borderTopRightRadius: tokens.radius.lg,
      paddingTop: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: tokens.minTouch,
    },
    headerButton: { minWidth: 64, minHeight: 44, justifyContent: 'center' },
    headerButtonRight: { alignItems: 'flex-end' },
    headerAction: { fontSize: tokens.fontSize.body },
    title: {
      flex: 1,
      textAlign: 'center',
      fontSize: tokens.fontSize.body,
      fontWeight: tokens.fontWeight.semibold,
    },
  });
}
