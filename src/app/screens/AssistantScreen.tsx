import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card } from '@/app/components';
import { AssistantMessage, useAssistant } from '@/app/hooks/useAssistant';
import { Plan, Session } from '@/domain/planning';
import { PlanChange, PlanChangeStatus } from '@/domain/assistant';
import { useThemeTokens } from '@/app/theme';

const DAY_LABELS: Record<keyof Plan['sessions'], string> = {
  mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves',
  fri: 'Viernes', sat: 'Sábado', sun: 'Domingo',
};

export interface AssistantScreenProps {
  sessionId: string | null;
  initialQuestion: string | null;
  onClose: () => void;
  onOpenSettings: () => void;
  onPlanChanged: () => Promise<void>;
}

type AssistantListItem =
  | { kind: 'message'; message: AssistantMessage }
  | { kind: 'planChange'; change: PlanChange };

export function AssistantScreen({ sessionId, initialQuestion, onClose, onOpenSettings, onPlanChanged }: AssistantScreenProps) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<AssistantListItem>>(null);
  const initialQuestionSent = useRef(false);
  const {
    messages,
    planChanges,
    loading,
    loadingChanges,
    credentialLoading,
    apiKeyConfigured,
    error,
    send,
    resolvePlanChange,
    refreshPlanChanges,
    refreshCredentials,
  } = useAssistant();
  const [draft, setDraft] = useState('');
  const [showChanges, setShowChanges] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    if (!initialQuestion || credentialLoading || initialQuestionSent.current || messages.length > 0) return;
    initialQuestionSent.current = true;
    void send(initialQuestion, sessionId);
  }, [credentialLoading, initialQuestion, messages.length, send, sessionId]);

  useFocusEffect(useCallback(() => {
    void refreshCredentials();
  }, [refreshCredentials]));

  const submit = () => {
    const question = draft.trim();
    if (!question || loading) return;
    setDraft('');
    void send(question, sessionId);
  };

  const handleResolve = useCallback(async (
    changeId: string,
    decision: Extract<PlanChangeStatus, 'accepted' | 'rejected'>,
  ) => {
    setResolvingId(changeId);
    try {
      const result = await resolvePlanChange(changeId, decision);
      await refreshPlanChanges();
      if (result.status === 'accepted') await onPlanChanged();
    } finally {
      setResolvingId(null);
    }
  }, [onPlanChanged, refreshPlanChanges, resolvePlanChange]);

  const listData = useMemo<AssistantListItem[]>(() => showChanges
    ? planChanges.map((change) => ({ kind: 'planChange', change }))
    : messages.map((message) => ({ kind: 'message', message })), [messages, planChanges, showChanges]);
  const renderItem = useCallback(({ item }: { item: AssistantListItem }) => {
    if (item.kind === 'planChange') {
      return (
        <PlanChangeCard
          change={item.change}
          resolving={resolvingId === item.change.id}
          onResolve={(decision) => void handleResolve(item.change.id, decision).catch(() => undefined)}
        />
      );
    }
    const planChangeId = item.message.planChange?.id;
    return (
      <MessageBubble
        message={item.message}
        resolving={planChangeId !== undefined && resolvingId === planChangeId}
        onResolve={(decision) => {
          if (planChangeId) void handleResolve(planChangeId, decision).catch(() => undefined);
        }}
      />
    );
  }, [handleResolve, resolvingId]);

  const listHeader = useMemo(() => (
    <View style={styles.listHeader}>
      {showChanges ? (
        <Text style={styles.contextLabel}>DECISIONES SOBRE TU PLAN</Text>
      ) : sessionId ? (
        <Text style={styles.contextLabel}>CONTEXTO: SESIÓN DEL DÍA</Text>
      ) : (
        <Text style={styles.contextLabel}>CONTEXTO: PERFIL, PLAN E HISTORIAL</Text>
      )}
      {!showChanges ? <Text style={styles.disclaimer}>Usa tu perfil, plan, historial y mensajes de esta conversación (sin nombre ni correo). Tu plan no cambia hasta que aceptes una propuesta.</Text> : null}
      {!showChanges && !credentialLoading && !apiKeyConfigured ? (
        <View style={styles.configurationBanner}>
          <Text style={styles.secondaryText}>Configura tu API key personal de OpenAI en Ajustes para activar las respuestas.</Text>
          <Button label="Configurar API key" onPress={onOpenSettings} variant="secondary" style={styles.configureButton} />
        </View>
      ) : null}
      <Pressable
        onPress={() => setShowChanges((current) => !current)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showChanges }}
        style={styles.historyToggle}
      >
        <Text style={styles.historyToggleText}>
          {showChanges ? 'Volver a la conversación' : `Cambios recientes · ${loadingChanges ? '…' : planChanges.length}`}
        </Text>
        <Ionicons name={showChanges ? 'chevron-back' : 'chevron-forward'} size={18} color={tokens.colors.ink} />
      </Pressable>
    </View>
  ), [loadingChanges, planChanges.length, sessionId, showChanges, styles, tokens.colors.ink]);

  const conversationEmptyState = (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>¿Qué quieres entender?</Text>
      <Text style={styles.secondaryText}>Puedes preguntar por tu sesión, progreso o cómo adaptar el plan.</Text>
      {sessionId ? <Suggestion label="¿Por qué me toca esta sesión?" onPress={() => void send('¿Por qué me toca esta sesión?', sessionId)} /> : null}
    </View>
  );
  const changesEmptyState = (
    <View style={styles.emptyState}>
      {loadingChanges ? <ActivityIndicator color={tokens.colors.accent} /> : null}
      <Text style={styles.emptyTitle}>{loadingChanges ? 'Cargando decisiones…' : 'Aún no hay cambios de plan.'}</Text>
      {!loadingChanges ? <Text style={styles.secondaryText}>Las propuestas aceptadas o rechazadas aparecerán aquí.</Text> : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: tokens.colors.canvas, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topBar}>
        <View style={styles.topCopy}>
          <Text style={styles.eyebrow}>ITERA</Text>
          <Text style={styles.title}>Asistente</Text>
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar asistente" style={styles.closeButton}>
          <Ionicons name="close" size={22} color={tokens.colors.ink} />
        </Pressable>
        <Pressable onPress={onOpenSettings} accessibilityRole="button" accessibilityLabel="Configurar OpenAI" style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={20} color={tokens.colors.ink} />
        </Pressable>
      </View>

      <FlatList<AssistantListItem>
        ref={listRef}
        data={listData}
        keyExtractor={(item) => item.kind === 'message' ? item.message.id : `change_${item.change.id}`}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={showChanges ? changesEmptyState : conversationEmptyState}
        contentContainerStyle={styles.messages}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={tokens.colors.accent} />
          <Text style={styles.secondaryText}>Consultando tu contexto…</Text>
        </View>
      ) : null}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, tokens.spacing.md) }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Escribe tu pregunta…"
          placeholderTextColor={tokens.colors.veryMutedText}
          multiline
          maxLength={2000}
          editable={!loading && !credentialLoading}
          accessibilityLabel="Pregunta al asistente"
          style={styles.input}
          onSubmitEditing={submit}
        />
        <Button
          label="Enviar"
          onPress={submit}
          loading={loading}
          disabled={!draft.trim() || credentialLoading}
          fullWidth={false}
          style={styles.sendButton}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({
  message,
  resolving,
  onResolve,
}: {
  message: AssistantMessage;
  resolving: boolean;
  onResolve: (decision: Extract<PlanChangeStatus, 'accepted' | 'rejected'>) => void;
}) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  if (message.role === 'user') {
    return (
      <View style={styles.userMessage}>
        <Text style={styles.userMessageText}>{message.text}</Text>
      </View>
    );
  }

  return (
    <View style={styles.assistantMessage}>
      <Card padding="md">
        {message.source === 'engine' ? <Text style={styles.engineLabel}>REGLAS DEL MOTOR</Text> : null}
        <Text style={styles.messageText}>{message.text}</Text>
        {message.knownFacts && message.knownFacts.length > 0 ? (
          <Text style={styles.contextText}>Datos conocidos: {message.knownFacts.join(' · ')}</Text>
        ) : null}
        {message.assumptions && message.assumptions.length > 0 ? (
          <Text style={styles.contextText}>Suposiciones: {message.assumptions.join(' · ')}</Text>
        ) : null}
        {message.planChange ? (
          <PlanChangeCard change={message.planChange} resolving={resolving} onResolve={onResolve} />
        ) : null}
      </Card>
    </View>
  );
}

function PlanChangeCard({
  change,
  resolving,
  onResolve,
}: {
  change: PlanChange;
  resolving: boolean;
  onResolve: (decision: Extract<PlanChangeStatus, 'accepted' | 'rejected'>) => void;
}) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const statusLabel = change.status === 'proposed'
    ? 'PROPUESTA'
    : change.status === 'accepted' ? 'ACEPTADA' : 'RECHAZADA';
  const dayChanges = describePlanChanges(change.previousPlan, change.proposedPlan);

  return (
    <View style={styles.proposal}>
      <View style={styles.proposalHeader}>
        <Text style={styles.proposalLabel}>{statusLabel}</Text>
        <Text style={styles.proposalDate}>{formatDate(change.createdAt)}</Text>
      </View>
      <Text style={styles.proposalReason}>{change.reason}</Text>
      {dayChanges.slice(0, 5).map((line) => (
        <Text key={line} style={styles.proposalChange}>{line}</Text>
      ))}
      {change.status === 'proposed' ? (
        <View style={styles.proposalActions}>
          <Button
            label="Rechazar"
            onPress={() => onResolve('rejected')}
            variant="secondary"
            disabled={resolving}
            loading={resolving}
            fullWidth={false}
            style={styles.rejectButton}
          />
          <Button
            label="Aceptar cambios"
            onPress={() => onResolve('accepted')}
            variant="primary"
            disabled={resolving}
            fullWidth={false}
            style={styles.acceptButton}
          />
        </View>
      ) : null}
    </View>
  );
}

function Suggestion({ label, onPress }: { label: string; onPress: () => void }) {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.suggestion}>
      <Text style={styles.suggestionText}>{label}</Text>
    </Pressable>
  );
}

function describePlanChanges(previous: Plan, proposed: Plan): string[] {
  const days = Object.keys(previous.sessions) as Array<keyof Plan['sessions']>;
  return days.flatMap((day) => {
    const before = previous.sessions[day];
    const after = proposed.sessions[day];
    if (JSON.stringify(before) === JSON.stringify(after)) return [];
    return [`${DAY_LABELS[day]}: ${describeDay(before)} → ${describeDay(after)}`];
  });
}

function describeDay(sessions: readonly Session[]): string {
  if (sessions.length === 0) return 'Descanso';
  return sessions.map((session) => {
    if (session.discipline === 'running') {
      const meters = session.blocks.reduce((sum, block) => sum + block.distanceMeters * (block.repetitions ?? 1), 0);
      return `${sessionTitle(session)} · ${(meters / 1000).toFixed(1)} km · ~${session.estimatedDurationMinutes} min`;
    }
    const exercises = session.exercises.slice(0, 3).map((exercise) =>
      `${exercise.name} ${exercise.sets}×${exercise.reps} @ ${exercise.targetWeightKg} kg`,
    );
    const more = session.exercises.length > 3 ? ` +${session.exercises.length - 3}` : '';
    return `${sessionTitle(session)} · ${exercises.join(', ')}${more}`;
  }).join(' + ');
}

function sessionTitle(session: Session): string {
  if (session.discipline === 'running') {
    const labels = { easy: 'Carrera suave', long: 'Carrera larga', tempo: 'Tempo', intervals: 'Intervalos', race: 'Competición' };
    return labels[session.type];
  }
  const labels = { upper: 'Tren superior', lower: 'Tren inferior', full_body: 'Cuerpo completo', accessory: 'Accesorios' };
  return labels[session.type];
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_FORMATTER.format(date);
}

const DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: 'UTC' });

function makeStyles(tokens: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
    root: { flex: 1 },
    topBar: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: tokens.spacing.xl, borderBottomWidth: tokens.borderWidth.hairline, borderBottomColor: tokens.colors.border },
    topCopy: { gap: tokens.spacing.xs },
    eyebrow: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.caption, letterSpacing: 1, fontWeight: tokens.fontWeight.semibold },
    title: { color: tokens.colors.ink, fontSize: tokens.fontSize.titleSection, fontWeight: tokens.fontWeight.semibold },
    closeButton: { width: tokens.minTouch, height: tokens.minTouch, borderRadius: tokens.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.surface },
    settingsButton: { width: tokens.minTouch, height: tokens.minTouch, borderRadius: tokens.radius.pill, alignItems: 'center', justifyContent: 'center', marginLeft: tokens.spacing.sm },
    messages: { flexGrow: 1, paddingHorizontal: tokens.spacing.lg, paddingTop: tokens.spacing.md, paddingBottom: tokens.spacing.lg },
    listHeader: { marginBottom: tokens.spacing.lg },
    contextLabel: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.caption, letterSpacing: 0.7, fontWeight: tokens.fontWeight.semibold },
    disclaimer: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.caption, marginTop: tokens.spacing.xs },
    configurationBanner: { gap: tokens.spacing.sm, marginTop: tokens.spacing.md, padding: tokens.spacing.md, borderRadius: tokens.radius.md, backgroundColor: tokens.colors.surface },
    configureButton: { alignSelf: 'flex-start' },
    historyToggle: { minHeight: tokens.minTouch, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: tokens.spacing.md },
    historyToggleText: { color: tokens.colors.ink, fontSize: tokens.fontSize.label, fontWeight: tokens.fontWeight.semibold },
    userMessage: { alignSelf: 'flex-end', maxWidth: '88%', backgroundColor: tokens.colors.accent, borderRadius: tokens.radius.lg, borderBottomRightRadius: tokens.radius.sm, padding: tokens.spacing.md, marginVertical: tokens.spacing.xs },
    userMessageText: { color: tokens.colors.accentInk, fontSize: tokens.fontSize.body, lineHeight: 21 },
    assistantMessage: { alignSelf: 'stretch', marginVertical: tokens.spacing.xs },
    messageText: { color: tokens.colors.ink, fontSize: tokens.fontSize.body, lineHeight: 22 },
    engineLabel: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.caption, fontWeight: tokens.fontWeight.semibold, letterSpacing: 0.7, marginBottom: tokens.spacing.xs },
    contextText: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.caption, lineHeight: 18, marginTop: tokens.spacing.sm },
    proposal: { borderTopWidth: tokens.borderWidth.hairline, borderTopColor: tokens.colors.border, marginTop: tokens.spacing.md, paddingTop: tokens.spacing.md },
    proposalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: tokens.spacing.sm },
    proposalLabel: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.caption, fontWeight: tokens.fontWeight.semibold, letterSpacing: 0.6 },
    proposalDate: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.caption },
    proposalReason: { color: tokens.colors.ink, fontSize: tokens.fontSize.label, lineHeight: 19, marginTop: tokens.spacing.sm },
    proposalChange: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.caption, marginTop: tokens.spacing.xs },
    proposalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.spacing.sm, marginTop: tokens.spacing.md },
    rejectButton: { minWidth: 88 },
    acceptButton: { minWidth: 140 },
    emptyState: { alignItems: 'center', gap: tokens.spacing.sm, paddingVertical: tokens.spacing.xxl, paddingHorizontal: tokens.spacing.lg },
    emptyTitle: { color: tokens.colors.ink, fontSize: tokens.fontSize.titleSection, fontWeight: tokens.fontWeight.semibold, textAlign: 'center' },
    secondaryText: { color: tokens.colors.textSecondary, fontSize: tokens.fontSize.body, lineHeight: 21, textAlign: 'center' },
    suggestion: { minHeight: 48, justifyContent: 'center', paddingHorizontal: tokens.spacing.md, borderRadius: tokens.radius.md, backgroundColor: tokens.colors.surface, marginTop: tokens.spacing.sm },
    suggestionText: { color: tokens.colors.ink, fontSize: tokens.fontSize.label, fontWeight: tokens.fontWeight.medium },
    error: { color: tokens.colors.error, fontSize: tokens.fontSize.label, marginHorizontal: tokens.spacing.lg, marginVertical: tokens.spacing.xs },
    loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: tokens.spacing.sm, paddingVertical: tokens.spacing.sm },
    composer: { flexDirection: 'row', alignItems: 'flex-end', gap: tokens.spacing.sm, paddingHorizontal: tokens.spacing.lg, paddingTop: tokens.spacing.sm, borderTopWidth: tokens.borderWidth.hairline, borderTopColor: tokens.colors.border },
    input: { flex: 1, minHeight: tokens.minTouch, maxHeight: 120, borderWidth: tokens.borderWidth.hairline, borderColor: tokens.colors.border, borderRadius: tokens.radius.md, paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, color: tokens.colors.ink, fontSize: tokens.fontSize.body, backgroundColor: tokens.colors.surfaceElevated },
    sendButton: { minHeight: tokens.minTouch },
  });
}
