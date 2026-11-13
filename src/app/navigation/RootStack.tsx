// Stack de navegación raíz.
//
// Decide qué pantalla mostrar según el estado global:
// - loading (auth inicial): spinner.
// - sin sesión: LoginScreen.
// - con sesión pero sin perfil: Onboarding (al terminar, genera plan).
// - con sesión y perfil: tabs principales (Hoy, Plan, Progreso) y Ajustes secundario.
//
// Detalle importante: usePlan() se llama una sola vez aquí; el plan
// resultante se pasa como prop a las pantallas que lo necesitan. Si
// las pantallas llamaran usePlan() por su cuenta, cada una tendría su
// propio estado y no compartirían el resultado del save/generate.

import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer, DarkTheme, DefaultTheme, Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { SessionRegistrationModal, SessionRegistrationTarget } from '@/app/screens/SessionRegistrationModal';
import { SessionEditorModal, SessionEditorTarget, SessionEditPayload } from '@/app/screens/SessionEditorModal';
import { SessionDetailScreen } from '@/app/screens/SessionDetailScreen';
import { PlanBuilderScreen } from '@/app/screens/PlanBuilderScreen';
import { useActiveTrainingSession, useAuth, usePlan, useProfile, useTrainingHistory } from '@/app/hooks';
import { LoginScreen } from '@/app/screens/LoginScreen';
import { OnboardingScreen } from '@/app/screens/OnboardingScreen';
import { PlanScreen } from '@/app/screens/PlanScreen';
import { ProgressScreen } from '@/app/screens/ProgressScreen';
import { AssistantScreen } from '@/app/screens/AssistantScreen';
import { TodayScreen } from '@/app/screens/TodayScreen';
import { SettingsScreen } from '@/app/screens/SettingsScreen';
import { TrainingScreen } from '@/app/screens/TrainingScreen';
import { useThemeTokens } from '@/app/theme';
import { Profile, WeekDay } from '@/domain/profile';
import { mondayOf, Plan, Session, editPlanSession, dateForWeekDay } from '@/domain/planning';
import {
  ActiveTrainingSession,
  createFreeSessionRecordId,
  plannedSessionRecordId,
  RecordedTrainingSession,
  SessionRecordMetadata,
} from '@/domain/training';

export type RootStackParamList = {
  Tabs: undefined;
  Settings: undefined;
  Training: { sessionId: string };
  Assistant: { sessionId: string | null; initialQuestion: string | null };
  PlanBuilder: undefined;
  SessionDetail: { day: WeekDay; index: number; /** Lunes ISO de la semana; por defecto, la del plan. */ weekStart?: string };
};

export type TabsParamList = {
  Hoy: undefined;
  Plan: undefined;
  Progreso: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabsParamList>();

export function RootStackComponent() {
  const { status: authStatus } = useAuth();
  const { status: profileStatus, profile, save } = useProfile();
  const { plan, generateFromProfile, savePlan, deletePlan, refresh: refreshPlan } = usePlan();
  const activeTrainingState = useActiveTrainingSession();
  const trainingHistory = useTrainingHistory();
  const tokens = useThemeTokens();
  const [registrationTarget, setRegistrationTarget] = useState<SessionRegistrationTarget | null>(null);
  const [sessionEditorTarget, setSessionEditorTarget] = useState<SessionEditorTarget | null>(null);

  function openPlannedRegistration(session: Session, date: string, day: WeekDay, index: number, weekStart?: string) {
    if (activeTrainingState.active?.progress.status === 'active' || activeTrainingState.active?.progress.status === 'paused') {
      Alert.alert('Sesión en curso', 'Pausa o termina la sesión antes de registrar otro resultado.');
      return;
    }
    if (!plan) return;
    setRegistrationTarget({
      // El ID del registro planeado ancla a la semana de la fecha: así
      // funciona igual para la semana en curso y para futuras semanas.
      sessionId: plannedSessionRecordId(mondayOf(date), day, index),
      date,
      source: 'planned',
      plannedSession: session,
    });
  }

  function openFreeRegistration(date: string) {
    if (activeTrainingState.active?.progress.status === 'active' || activeTrainingState.active?.progress.status === 'paused') {
      Alert.alert('Sesión en curso', 'Pausa o termina la sesión antes de registrar otro resultado.');
      return;
    }
    setRegistrationTarget({
      sessionId: createFreeSessionRecordId(),
      date,
      source: 'free',
      plannedSession: null,
    });
  }

  function openSessionEditor(day: WeekDay, index: number, weekStart?: string) {
    if (!plan) return;
    const week = plan.weeks.find((candidate) => candidate.weekStart === (weekStart ?? plan.weekStart));
    if (!week) return;
    const session = week.sessions[day][index];
    if (!session) return;
    const occupiedDays = (Object.entries(week.sessions) as [WeekDay, readonly unknown[]][])
      .filter(([d, sessions]) => d !== day && sessions.length > 0)
      .map(([d]) => d);
    setSessionEditorTarget({ weekStart: week.weekStart, day, index, session, occupiedDays });
  }

  function applySessionEdit(weekStart: string, day: WeekDay, index: number, edit: SessionEditPayload) {
    if (!plan) return;
    try {
      const nextPlan = editPlanSession(plan, weekStart, day, index, edit);
      void savePlan(nextPlan).catch((err: unknown) => Alert.alert(
        'No se pudo guardar el plan',
        err instanceof Error ? err.message : 'Inténtalo de nuevo.',
      ));
    } catch (err) {
      Alert.alert('Edición no válida', err instanceof Error ? err.message : 'Inténtalo de nuevo.');
      return;
    }
    setSessionEditorTarget(null);
  }

  function removeSession(weekStart: string, day: WeekDay, index: number) {
    if (!plan) return;
    try {
      const nextPlan = editPlanSession(plan, weekStart, day, index, {});
      void savePlan(nextPlan).catch((err: unknown) => Alert.alert(
        'No se pudo guardar el plan',
        err instanceof Error ? err.message : 'Inténtalo de nuevo.',
      ));
    } catch (err) {
      Alert.alert('Edición no válida', err instanceof Error ? err.message : 'Inténtalo de nuevo.');
      return;
    }
    setSessionEditorTarget(null);
  }

  function deleteCurrentPlan() {
    void deletePlan().catch((err: unknown) => Alert.alert(
      'No se pudo eliminar el plan',
      err instanceof Error ? err.message : 'Inténtalo de nuevo.',
    ));
  }

  async function finishIncompleteTraining() {
    await activeTrainingState.finishIncomplete();
    await trainingHistory.refresh();
  }

  let content: React.ReactNode;
  if (authStatus === 'loading' || profileStatus === 'loading') {
    content = (
      <View style={[styles.center, { backgroundColor: tokens.colors.canvas }]}>
        <ActivityIndicator color={tokens.colors.accent} />
        <Text style={[styles.muted, { color: tokens.colors.textSecondary }]}>Cargando…</Text>
      </View>
    );
  } else if (authStatus === 'unauthenticated') {
    content = <LoginScreen />;
  } else if (!profile) {
    content = (
      <OnboardingScreen
        onComplete={async (p: Profile) => {
          try {
            await save(p);
            await generateFromProfile(p);
          } catch (err) {
            console.warn('[onboarding completion]', err);
            throw err;
          }
        }}
      />
    );
  } else {
    content = (
      <RootStack.Navigator>
        <RootStack.Screen name="Tabs" options={{ headerShown: false }}>
          {({ navigation }) => (
            <MainTabs
              plan={plan}
              recordedSessions={trainingHistory.sessions}
              historyLoading={trainingHistory.loading}
              historyError={trainingHistory.error}
              onRefreshHistory={trainingHistory.refresh}
              onDeleteSession={trainingHistory.deleteSession}
              onRegisterPlanned={openPlannedRegistration}
              onRegisterFree={openFreeRegistration}
              onOpenSessionDetail={(day, index, weekStart) => navigation.navigate('SessionDetail', { day, index, weekStart })}
              activeTraining={activeTrainingState.active}
              activeTrainingLoading={activeTrainingState.loading}
              onResumeActive={() => {
                if (!activeTrainingState.active) return;
                const resume = async () => {
                  if (activeTrainingState.active?.progress.status === 'paused') {
                    await activeTrainingState.updateProgress({
                      ...activeTrainingState.active.progress,
                      status: 'active',
                      updatedAt: new Date().toISOString(),
                    });
                  }
                  navigation.navigate('Training', { sessionId: activeTrainingState.active!.metadata.id });
                };
                void resume().catch((err) => Alert.alert(
                  'No se pudo reanudar',
                  err instanceof Error ? err.message : 'Inténtalo de nuevo.',
                ));
              }}
              onFinishIncomplete={() => void finishIncompleteTraining().catch((err) => Alert.alert(
                'No se pudo cerrar la sesión',
                err instanceof Error ? err.message : 'Inténtalo de nuevo.',
              ))}
              onAskAssistant={(sessionId, question) => navigation.navigate('Assistant', {
                sessionId,
                initialQuestion: question,
              })}
              onCreatePlan={() => navigation.navigate('PlanBuilder')}
              onDeletePlan={deleteCurrentPlan}
              onStartPlanned={(session, date, day, index) => {
                const sessionId = plannedSessionRecordId(mondayOf(date), day, index);
                const start = async () => {
                  if (activeTrainingState.active) {
                    if (activeTrainingState.active.metadata.id === sessionId) {
                      if (activeTrainingState.active.progress.status === 'paused') {
                        await activeTrainingState.updateProgress({
                          ...activeTrainingState.active.progress,
                          status: 'active',
                          updatedAt: new Date().toISOString(),
                        });
                      }
                      navigation.navigate('Training', { sessionId });
                      return;
                    }
                    Alert.alert('Hay una sesión pendiente', 'Continúala o termínala como incompleta antes de empezar otra.');
                    return;
                  }
                  if (!plan) return;
                  const metadata: SessionRecordMetadata = {
                    id: sessionId,
                    date,
                    source: 'planned',
                    discipline: session.discipline,
                    plannedSession: session,
                    createdAt: new Date().toISOString(),
                  };
                  await activeTrainingState.start(metadata);
                  navigation.navigate('Training', { sessionId });
                };
                void start().catch((err) => Alert.alert(
                  'No se pudo iniciar',
                  err instanceof Error ? err.message : 'Inténtalo de nuevo.',
                ));
              }}
              onOpenSettings={() => navigation.navigate('Settings')}
            />
          )}
        </RootStack.Screen>
        <RootStack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Ajustes', presentation: 'modal' }}
        />
        <RootStack.Screen name="PlanBuilder" options={{ headerShown: false, presentation: 'fullScreenModal' }}>
          {({ navigation }) => (
            <PlanBuilderScreen
              profile={profile}
              onApplyPlan={async (nextPlan) => { await savePlan(nextPlan); }}
              onClose={() => navigation.goBack()}
              onOpenSettings={() => navigation.navigate('Settings')}
            />
          )}
        </RootStack.Screen>
        <RootStack.Screen
          name="SessionDetail"
          options={{ headerShown: false }}
        >
          {({ route, navigation }) => {
            const { day, index } = route.params;
            const weekStart = route.params.weekStart ?? plan?.weekStart ?? '';
            // La sesión viene de la semana del bloque indicada (por
            // defecto, la primera); weekStart solo cambia la fecha y el
            // registro correspondiente.
            const week = plan?.weeks.find((candidate) => candidate.weekStart === weekStart);
            const session = week ? week.sessions[day][index] : null;
            return (
              <SessionDetailScreen
                key={`${weekStart}_${day}_${index}`}
                day={day}
                index={index}
                weekStart={weekStart}
                session={session}
                record={trainingHistory.sessions.find((candidate) => candidate.metadata.id === plannedSessionRecordId(weekStart, day, index)) ?? null}
                activeTraining={activeTrainingState.active}
                historyLoading={trainingHistory.loading}
                onBack={() => navigation.goBack()}
                onRegister={() => {
                  if (!session) return;
                  openPlannedRegistration(session, dateForWeekDay(weekStart, day), day, index, weekStart);
                }}
                onEditSession={() => openSessionEditor(day, index, weekStart)}
              />
            );
          }}
        </RootStack.Screen>
        <RootStack.Screen name="Training" options={{ headerShown: false, gestureEnabled: false }}>
          {({ route, navigation }) => (
            <TrainingScreen
              key={route.params.sessionId}
              sessionId={route.params.sessionId}
              loading={activeTrainingState.loading}
              loadError={activeTrainingState.error}
              training={activeTrainingState.active}
              onRefresh={activeTrainingState.refresh}
              onUpdateProgress={activeTrainingState.updateProgress}
              onRecordSet={activeTrainingState.recordSet}
              onRecordRun={activeTrainingState.recordRun}
               onFinishIncomplete={finishIncompleteTraining}
               onDismiss={() => {
                 activeTrainingState.dismiss();
                 void trainingHistory.refresh();
               }}
              onExit={() => navigation.goBack()}
            />
          )}
        </RootStack.Screen>
        <RootStack.Screen name="Assistant" options={{ headerShown: false, presentation: 'modal' }}>
          {({ route, navigation }) => (
            <AssistantScreen
              key={`${route.params.sessionId ?? 'general'}_${route.params.initialQuestion ?? 'question'}`}
              sessionId={route.params.sessionId}
              initialQuestion={route.params.initialQuestion}
              onClose={() => navigation.goBack()}
              onOpenSettings={() => navigation.navigate('Settings')}
              onPlanChanged={refreshPlan}
            />
          )}
        </RootStack.Screen>
      </RootStack.Navigator>
    );
  }

  const navTheme: Theme = tokens.scheme === 'dark' ? darkNavTheme : lightNavTheme;

  return (
    <NavigationContainer theme={navTheme}>
      {content}
      {profile && (
        <>
          <SessionRegistrationModal
            key={`registration_${registrationTarget?.sessionId ?? 'closed'}`}
            target={registrationTarget}
            onClose={() => setRegistrationTarget(null)}
            onSaved={() => {
              setRegistrationTarget(null);
              void trainingHistory.refresh();
            }}
          />
          <SessionEditorModal
            key={`sessionEditor_${sessionEditorTarget ? `${sessionEditorTarget.day}_${sessionEditorTarget.index}` : 'closed'}`}
            target={sessionEditorTarget}
            onClose={() => setSessionEditorTarget(null)}
            onSave={(day, index, edit) => {
              if (!sessionEditorTarget) return;
              applySessionEdit(sessionEditorTarget.weekStart, day, index, edit);
            }}
            onDelete={(day, index) => {
              if (!sessionEditorTarget) return;
              removeSession(sessionEditorTarget.weekStart, day, index);
            }}
          />
        </>
      )}
    </NavigationContainer>
  );
}

const lightNavTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#F7F7F2',
    card: '#F7F7F2',
    text: '#20231F',
    border: '#E9EAE3',
    primary: '#C8F169',
  },
};

const darkNavTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#171A17',
    card: '#171A17',
    text: '#F0F0EB',
    border: '#2F332F',
    primary: '#C8F169',
  },
};

function MainTabs({
  plan,
  recordedSessions,
  historyLoading,
  historyError,
  onRefreshHistory,
  onDeleteSession,
  onRegisterPlanned,
  onRegisterFree,
  onOpenSessionDetail,
  onOpenSettings,
  activeTraining,
  activeTrainingLoading,
  onStartPlanned,
  onResumeActive,
  onFinishIncomplete,
  onAskAssistant,
  onCreatePlan,
  onDeletePlan,
}: {
  plan: Plan | null;
  recordedSessions: readonly RecordedTrainingSession[];
  historyLoading: boolean;
  historyError: string | null;
  onRefreshHistory: () => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onRegisterPlanned: (session: Session, date: string, day: WeekDay, index: number) => void;
  onRegisterFree: (date: string) => void;
  onOpenSessionDetail: (day: WeekDay, index: number, weekStart: string) => void;
  onOpenSettings: () => void;
  activeTraining: ActiveTrainingSession | null;
  activeTrainingLoading: boolean;
  onStartPlanned: (session: Session, date: string, day: WeekDay, index: number) => void;
  onResumeActive: () => void;
  onFinishIncomplete: () => void;
  onAskAssistant: (sessionId: string, question: string) => void;
  onCreatePlan: () => void;
  onDeletePlan: () => void;
}) {
  const tokens = useThemeTokens();
  return (
    <Tabs.Navigator
      screenOptions={{
        tabBarActiveTintColor: tokens.colors.tabBarActive,
        tabBarInactiveTintColor: tokens.colors.tabBarInactive,
        tabBarStyle: { backgroundColor: tokens.colors.canvas, borderTopColor: tokens.colors.border },
        headerStyle: { backgroundColor: tokens.colors.canvas },
        headerTintColor: tokens.colors.ink,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="Hoy"
        options={{
          title: 'Hoy',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="today-outline" color={color} size={size} />
          ),
        }}
      >
        {() => (
          <TodayScreen
            plan={plan}
            recordedSessions={recordedSessions}
            historyLoading={historyLoading}
            onRefreshHistory={onRefreshHistory}
            onRegisterPlanned={onRegisterPlanned}
            onRegisterFree={onRegisterFree}
            activeTraining={activeTraining}
            activeTrainingLoading={activeTrainingLoading}
            onStartPlanned={onStartPlanned}
            onResumeActive={onResumeActive}
            onFinishIncomplete={onFinishIncomplete}
            onAskAssistant={onAskAssistant}
          />
        )}
      </Tabs.Screen>
      <Tabs.Screen
        name="Plan"
        options={{
          title: 'Plan',
          // La pantalla ya tiene su propio encabezado ("Tu plan"); ocultamos
          // el header nativo de la pestaña para no duplicarlo.
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" color={color} size={size} />
          ),
        }}
      >
        {() => (
          <PlanScreen
            plan={plan}
            onRegisterFree={onRegisterFree}
            recordedSessions={recordedSessions}
            historyLoading={historyLoading}
            onRefreshHistory={onRefreshHistory}
            activeTraining={activeTraining}
            onCreatePlan={onCreatePlan}
            onOpenSessionDetail={onOpenSessionDetail}
            onDeletePlan={onDeletePlan}
          />
        )}
      </Tabs.Screen>
      <Tabs.Screen
        name="Progreso"
        options={{
          title: 'Progreso',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" color={color} size={size} />
          ),
        }}
      >
        {() => (
          <ProgressScreen
            plan={plan}
            onOpenSettings={onOpenSettings}
            sessions={recordedSessions}
            loading={historyLoading}
            error={historyError}
            onRefresh={onRefreshHistory}
            onDeleteSession={onDeleteSession}
          />
        )}
      </Tabs.Screen>
    </Tabs.Navigator>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  muted: {
    fontSize: 14,
  },
});

export { RootStackComponent as RootStack };
