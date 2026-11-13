// Pantalla "Ajustes" con sesión activa y datos del perfil.
// Edición real del perfil llega en un hito posterior.

import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen as ScreenLayout, TextField } from '@/app/components';
import { useAssistantSettings, useAuth, useProfile } from '@/app/hooks';
import { useThemeTokens } from '@/app/theme';

/** A partir de esta cantidad de modelos aparece el campo de búsqueda. */
const MODEL_FILTER_THRESHOLD = 8;

export function SettingsScreen() {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const assistantSettings = useAssistantSettings();
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  /** Filtro del selector de modelos (solo con listas largas). */
  const [modelFilter, setModelFilter] = useState('');

  const filteredModels = assistantSettings.models.filter((model) =>
    model.id.toLowerCase().includes(modelFilter.trim().toLowerCase()));

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
      <Text style={styles.sectionTitle}>Perfil</Text>
      <Card>
        {profile ? <><Row
              label="Nombre"
              value={profile.name ?? '—'}
            />
            <Row
              label="Experiencia"
              value={experienceLabel(profile.experience)}
            />
            <Row
              label="Objetivos"
              value={`${profile.primaryGoal.discipline}`}
            />
            
            </>:null}
        <Row label="Email" value={user?.email ?? '—'} />
        <View style={styles.divider} />
        <Button label="Cerrar sesión" onPress={() => signOut()} variant="danger" />
      </Card>

      <Text style={styles.sectionTitle}>Asistente con IA</Text>
      <Card>
        <Text style={styles.muted}>
          Tu API key se guarda en el almacenamiento seguro de este dispositivo. Si cambias de dispositivo tendrás que introducirla de nuevo.
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
            <View style={styles.modelHeader}>
              <Text style={styles.modelLabel}>Modelo para el asistente</Text>
              <Text style={styles.modelCount}>
                {assistantSettings.models.length} modelos · del más reciente al más antiguo
              </Text>
            </View>
            {assistantSettings.models.length > MODEL_FILTER_THRESHOLD ? (
              <TextField
                value={modelFilter}
                onChangeText={setModelFilter}
                placeholder="Buscar modelo…"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.modelFilter}
              />
            ) : null}
            <View style={styles.modelList}>
              {filteredModels.map((model, index) => (
                <ModelRow
                  key={model.id}
                  model={model}
                  selected={assistantSettings.selectedModel === model.id}
                  recommended={index === 0}
                  onPress={() => void assistantSettings.selectModel(model.id)}
                />
              ))}
              {filteredModels.length === 0 ? (
                <Text style={styles.modelEmpty}>Ningún modelo coincide con la búsqueda.</Text>
              ) : null}
            </View>
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
    </ScreenLayout>
  );
}

/** Fila del selector de modelos: radio, id y etiqueta de recomendado. */
function ModelRow({
  model,
  selected,
  recommended,
  onPress,
}: {
  model: { id: string; ownedBy: string };
  selected: boolean;
  recommended: boolean;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  const styles = makeModelRowStyles(tokens);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Modelo ${model.id}`}
      style={[styles.row, selected && styles.rowSelected]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <Text style={[styles.id, selected && styles.idSelected]} numberOfLines={1}>
        {model.id}
      </Text>
      {recommended ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Recomendado</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function makeModelRowStyles(tokens: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.spacing.sm,
      minHeight: tokens.minTouch,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: tokens.colors.border,
    },
    rowSelected: {
      backgroundColor: tokens.colors.surface,
    },
    radio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: tokens.colors.veryMutedText,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: {
      borderColor: tokens.colors.accent,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: tokens.colors.accent,
    },
    id: {
      flexShrink: 1,
      fontSize: tokens.fontSize.body,
      color: tokens.colors.ink,
    },
    idSelected: {
      fontWeight: tokens.fontWeight.semibold,
    },
    badge: {
      backgroundColor: tokens.colors.surface,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      borderRadius: tokens.radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginLeft: 'auto',
    },
    badgeText: {
      fontSize: tokens.fontSize.caption,
      color: tokens.colors.textSecondary,
    },
  });
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {  const tokens = useThemeTokens();
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
    modelHeader: {
      marginTop: tokens.spacing.md,
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: tokens.spacing.sm,
    },
    modelCount: {
      fontSize: tokens.fontSize.caption,
      color: tokens.colors.textSecondary,
      flexShrink: 1,
    },
    modelFilter: { marginTop: tokens.spacing.sm },
    modelList: {
      marginTop: tokens.spacing.sm,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      borderRadius: tokens.radius.md,
      overflow: 'hidden',
    },
    modelEmpty: {
      fontSize: tokens.fontSize.label,
      color: tokens.colors.textSecondary,
      fontStyle: 'italic',
      padding: tokens.spacing.md,
    },
    success: { fontSize: tokens.fontSize.label, color: tokens.colors.success, marginTop: tokens.spacing.md },
    error: { fontSize: tokens.fontSize.label, color: tokens.colors.error, marginTop: tokens.spacing.md },
    clearKeyButton: { marginTop: tokens.spacing.sm },
    apiKeyLink: { minHeight: tokens.minTouch, justifyContent: 'center', alignSelf: 'flex-start' },
    apiKeyLinkText: { color: tokens.colors.ink, fontSize: tokens.fontSize.label, fontWeight: tokens.fontWeight.semibold, textDecorationLine: 'underline' },
  });
}
