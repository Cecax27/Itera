// Pantalla "Ajustes" con sesión activa y datos del perfil.
// Edición real del perfil llega en un hito posterior.

import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, Screen as ScreenLayout, TextField } from '@/app/components';
import { useAssistantSettings, useAuth, useProfile } from '@/app/hooks';
import { useThemeTokens } from '@/app/theme';

export function SettingsScreen() {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const assistantSettings = useAssistantSettings();
  const [apiKeyDraft, setApiKeyDraft] = useState('');

  async function testAssistantConnection() {
    const success = await assistantSettings.testConnection(apiKeyDraft);
    if (success) setApiKeyDraft('');
  }

  function openOpenAiKeys() {
    void Linking.openURL('https://platform.openai.com/api-keys').catch(() => {
      Alert.alert('No se pudo abrir el enlace', 'Visita https://platform.openai.com/api-keys desde tu navegador.');
    });
  }

  function confirmClearAssistantKey() {
    Alert.alert(
      'Eliminar API key',
      'Se borrará de este dispositivo. El asistente no podrá llamar a OpenAI hasta que configures otra.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => void assistantSettings.clear() },
      ],
    );
  }

  return (
    <ScreenLayout scroll>
      <Text style={styles.sectionTitle}>Sesión</Text>
      <Card>
        <Row label="Email" value={user?.email ?? '—'} />
        <Row label="Proveedor" value={user?.provider ?? '—'} />
        <Row label="ID" value={user?.id ? `${user.id.slice(0, 12)}…` : '—'} mono />
        <View style={styles.divider} />
        <Button label="Cerrar sesión" onPress={() => signOut()} variant="danger" />
      </Card>

      <Text style={styles.sectionTitle}>Asistente con IA</Text>
      <Card>
        <Text style={styles.muted}>
          Tu API key se guarda en el almacenamiento seguro de este dispositivo y se envía de forma temporal a Firebase Functions para consultar OpenAI. No se guarda en Firestore; si cambias de dispositivo tendrás que introducirla de nuevo.
        </Text>
        <Pressable onPress={openOpenAiKeys} accessibilityRole="link" style={styles.apiKeyLink}>
          <Text style={styles.apiKeyLinkText}>Crear o gestionar API keys en OpenAI</Text>
        </Pressable>
        <TextField
          label="API key de OpenAI"
          value={apiKeyDraft}
          onChangeText={setApiKeyDraft}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={assistantSettings.apiKeySaved ? 'Clave guardada · escribe otra para reemplazarla' : 'Pega tu API key'}
          helper={assistantSettings.apiKeySaved ? 'Hay una clave guardada para esta cuenta en este dispositivo.' : 'La clave pertenece a tu cuenta de OpenAI.'}
        />
        <Button
          label="Probar conexión"
          onPress={() => void testAssistantConnection()}
          loading={assistantSettings.testing}
          disabled={assistantSettings.loading || (!apiKeyDraft.trim() && !assistantSettings.apiKeySaved)}
          variant="primary"
        />

        {assistantSettings.models.length > 0 ? (
          <>
            <Text style={styles.modelLabel}>Modelo para el asistente</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modelChips}>
              {assistantSettings.models.map((model) => (
                <Chip
                  key={model.id}
                  label={model.id}
                  selected={assistantSettings.selectedModel === model.id}
                  onPress={() => void assistantSettings.selectModel(model.id)}
                />
              ))}
            </ScrollView>
          </>
        ) : assistantSettings.selectedModel ? (
          <Text style={styles.muted}>Modelo guardado: {assistantSettings.selectedModel}. Prueba la conexión para actualizar la lista disponible.</Text>
        ) : null}

        {assistantSettings.notice ? <Text style={styles.success}>{assistantSettings.notice}</Text> : null}
        {assistantSettings.error ? <Text style={styles.error}>{assistantSettings.error}</Text> : null}
        {assistantSettings.apiKeySaved ? (
          <Button label="Eliminar API key de este dispositivo" onPress={confirmClearAssistantKey} variant="secondary" style={styles.clearKeyButton} />
        ) : null}
      </Card>

      <Text style={styles.sectionTitle}>Perfil</Text>
      <Card>
        {profile ? (
          <>
            <Row
              label="Nombre"
              value={profile.name ?? '—'}
            />
            <Row
              label="Experiencia"
              value={experienceLabel(profile.experience)}
            />
            <Row
              label="Objetivos"
              value={`${profile.secondaryGoals.length + 1} (${profile.primaryGoal.discipline})`}
            />
            <Row
              label="Equipamiento"
              value={`${Object.values(profile.equipment).filter(Boolean).length} piezas`}
            />
            <Row
              label="Lesiones activas"
              value={`${profile.restrictions.injuries.length}`}
            />
          </>
        ) : (
          <Text style={styles.muted}>Sin perfil todavía.</Text>
        )}
        <View style={styles.divider} />
        <Text style={styles.muted}>
          La edición de perfil post-onboarding llega en un hito posterior.
        </Text>
      </Card>
    </ScreenLayout>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const tokens = useThemeTokens();
  const styles = makeRowStyles(tokens);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

function makeRowStyles(tokens: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: tokens.spacing.sm,
      gap: tokens.spacing.md,
    },
    label: {
      fontSize: tokens.fontSize.body,
      color: tokens.colors.textSecondary,
    },
    value: {
      fontSize: tokens.fontSize.body,
      fontWeight: tokens.fontWeight.medium,
      color: tokens.colors.ink,
      flexShrink: 1,
      textAlign: 'right',
    },
    mono: {
      fontFamily: 'monospace',
      fontSize: tokens.fontSize.label,
    },
  });
}

function experienceLabel(lvl: string): string {
  switch (lvl) {
    case 'beginner': return 'Principiante';
    case 'intermediate': return 'Intermedio';
    case 'advanced': return 'Avanzado';
    default: return lvl;
  }
}

function makeStyles(tokens: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
    sectionTitle: {
      fontSize: tokens.fontSize.label,
      fontWeight: tokens.fontWeight.medium,
      color: tokens.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: tokens.spacing.xl,
      marginBottom: tokens.spacing.md,
    },
    divider: {
      height: 1,
      backgroundColor: tokens.colors.border,
      marginVertical: tokens.spacing.md,
    },
    muted: {
      fontSize: tokens.fontSize.label,
      color: tokens.colors.textSecondary,
      fontStyle: 'italic',
    },
    modelLabel: { fontSize: tokens.fontSize.label, fontWeight: tokens.fontWeight.medium, color: tokens.colors.ink, marginTop: tokens.spacing.md },
    modelChips: { gap: tokens.spacing.sm, paddingVertical: tokens.spacing.sm },
    success: { fontSize: tokens.fontSize.label, color: tokens.colors.success, marginTop: tokens.spacing.md },
    error: { fontSize: tokens.fontSize.label, color: tokens.colors.error, marginTop: tokens.spacing.md },
    clearKeyButton: { marginTop: tokens.spacing.sm },
    apiKeyLink: { minHeight: tokens.minTouch, justifyContent: 'center', alignSelf: 'flex-start' },
    apiKeyLinkText: { color: tokens.colors.ink, fontSize: tokens.fontSize.label, fontWeight: tokens.fontWeight.semibold, textDecorationLine: 'underline' },
  });
}
