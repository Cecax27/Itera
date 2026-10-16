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
import { useActiveTrainingSession, useAuth, usePlan, useProfile, useTrainingHistory } from '@/app/hooks';
import { LoginScreen } from '@/app/screens/LoginScreen';
import { OnboardingScreen } from '@/app/screens/OnboardingScreen';
import { PlanScreen } from '@/app/screens/PlanScreen';
import { ProgressScreen } from '@/app/screens/ProgressScreen';
import { TodayScreen } from '@/app/screens/TodayScreen';
import { SettingsScreen } from '@/app/screens/SettingsScreen';
import { TrainingScreen } from '@/app/screens/TrainingScreen';
import { useThemeTokens } from '@/app/theme';
import { Profile, WeekDay } from '@/domain/profile';
import { Plan, Session } from '@/domain/planning';
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
  const { plan, generateFromProfile } = usePlan();
  const activeTrainingState = useActiveTrainingSession();
  const trainingHistory = useTrainingHistory();
  const tokens = useThemeTokens();
  const [registrationTarget, setRegistrationTarget] = useState<SessionRegistrationTarget | null>(null);

  function openPlannedRegistration(session: Session, date: string, day: WeekDay, index: number) {
    if (activeTrainingState.active?.progress.status === 'active' || activeTrainingState.active?.progress.status === 'paused') {
      Alert.alert('Sesión en curso', 'Pausa o termina la sesión antes de registrar otro resultado.');
      return;
    }
    if (!plan) return;
    setRegistrationTarget({
      sessionId: plannedSessionRecordId(plan.weekStart, day, index),
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
              onStartPlanned={(session, date, day, index) => {
                const sessionId = plannedSessionRecordId(plan?.weekStart ?? '', day, index);
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
      </RootStack.Navigator>
    );
  }

  const navTheme: Theme = tokens.scheme === 'dark' ? darkNavTheme : lightNavTheme;

  return (
    <NavigationContainer theme={navTheme}>
      {content}
      {profile && (
        <SessionRegistrationModal
          key={registrationTarget?.sessionId ?? 'closed'}
          target={registrationTarget}
          onClose={() => setRegistrationTarget(null)}
           onSaved={() => {
             setRegistrationTarget(null);
             void trainingHistory.refresh();
           }}
        />
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
  onOpenSettings,
  activeTraining,
  activeTrainingLoading,
  onStartPlanned,
  onResumeActive,
  onFinishIncomplete,
}: {
  plan: Plan | null;
  recordedSessions: readonly RecordedTrainingSession[];
  historyLoading: boolean;
  historyError: string | null;
  onRefreshHistory: () => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onRegisterPlanned: (session: Session, date: string, day: WeekDay, index: number) => void;
  onRegisterFree: (date: string) => void;
  onOpenSettings: () => void;
  activeTraining: ActiveTrainingSession | null;
  activeTrainingLoading: boolean;
  onStartPlanned: (session: Session, date: string, day: WeekDay, index: number) => void;
  onResumeActive: () => void;
  onFinishIncomplete: () => void;
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
          />
        )}
      </Tabs.Screen>
      <Tabs.Screen
        name="Plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" color={color} size={size} />
          ),
        }}
      >
        {() => (
          <PlanScreen
            plan={plan}
            onRegisterPlanned={onRegisterPlanned}
            onRegisterFree={onRegisterFree}
            recordedSessions={recordedSessions}
            historyLoading={historyLoading}
            onRefreshHistory={onRefreshHistory}
            activeTraining={activeTraining}
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
