// Stack de navegación raíz.
//
// Decide qué pantalla mostrar según el estado global:
// - loading (auth inicial): spinner.
// - sin sesión: LoginScreen.
// - con sesión pero sin perfil: Onboarding (al terminar, genera plan).
// - con sesión y perfil: stack principal con tabs (Hoy, Plan, Ajustes).
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
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { SessionRegistrationModal, SessionRegistrationTarget } from '@/app/screens/SessionRegistrationModal';
import { useAuth, usePlan, useProfile } from '@/app/hooks';
import { LoginScreen } from '@/app/screens/LoginScreen';
import { OnboardingScreen } from '@/app/screens/OnboardingScreen';
import { PlanScreen } from '@/app/screens/PlanScreen';
import { TodayScreen } from '@/app/screens/TodayScreen';
import { SettingsScreen } from '@/app/screens/SettingsScreen';
import { useThemeTokens } from '@/app/theme';
import { Profile, WeekDay } from '@/domain/profile';
import { Plan, Session } from '@/domain/planning';
import { createFreeSessionRecordId, plannedSessionRecordId } from '@/domain/training';

export type RootStackParamList = {
  Tabs: undefined;
};

export type TabsParamList = {
  Hoy: undefined;
  Plan: undefined;
  Settings: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabsParamList>();

export function RootStackComponent() {
  const { status: authStatus } = useAuth();
  const { status: profileStatus, profile, save } = useProfile();
  const { plan, generateFromProfile } = usePlan();
  const tokens = useThemeTokens();
  const [registrationTarget, setRegistrationTarget] = useState<SessionRegistrationTarget | null>(null);

  function openPlannedRegistration(session: Session, date: string, day: WeekDay, index: number) {
    if (!plan) return;
    setRegistrationTarget({
      sessionId: plannedSessionRecordId(plan.weekStart, day, index),
      date,
      source: 'planned',
      plannedSession: session,
    });
  }

  function openFreeRegistration(date: string) {
    setRegistrationTarget({
      sessionId: createFreeSessionRecordId(),
      date,
      source: 'free',
      plannedSession: null,
    });
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
      <MainTabs
        plan={plan}
        onRegisterPlanned={openPlannedRegistration}
        onRegisterFree={openFreeRegistration}
      />
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
          onSaved={() => setRegistrationTarget(null)}
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
  onRegisterPlanned,
  onRegisterFree,
}: {
  plan: Plan | null;
  onRegisterPlanned: (session: Session, date: string, day: WeekDay, index: number) => void;
  onRegisterFree: (date: string) => void;
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
        {() => <TodayScreen plan={plan} onRegisterPlanned={onRegisterPlanned} onRegisterFree={onRegisterFree} />}
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
        {() => <PlanScreen plan={plan} onRegisterPlanned={onRegisterPlanned} onRegisterFree={onRegisterFree} />}
      </Tabs.Screen>
      <Tabs.Screen
        name="Settings"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          ),
        }}
      >
        {() => <SettingsScreen />}
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
