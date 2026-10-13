// Stack de navegación raíz.
//
// Decide qué pantalla mostrar según el estado global:
// - loading (auth inicial): spinner.
// - sin sesión: LoginScreen.
// - con sesión pero sin perfil: Onboarding (al terminar, genera plan).
// - con sesión y perfil: stack principal con tabs (Hoy, Plan, Ajustes).
//
// En H3 este stack se sustituye por tabs con @react-navigation/bottom-tabs.

import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth, usePlan, useProfile } from '@/app/hooks';
import { LoginScreen } from '@/app/screens/LoginScreen';
import { OnboardingScreen } from '@/app/screens/OnboardingScreen';
import { PlanScreen } from '@/app/screens/PlanScreen';
import { TodayScreen } from '@/app/screens/TodayScreen';
import { SettingsScreen } from '@/app/screens/SettingsScreen';
import { Profile } from '@/domain/profile';

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

  let content: React.ReactNode;
  if (authStatus === 'loading' || profileStatus === 'loading') {
    content = (
      <View style={styles.center}>
        <ActivityIndicator color="#C8F169" />
        <Text style={styles.muted}>Cargando…</Text>
      </View>
    );
  } else if (authStatus === 'unauthenticated') {
    content = <LoginScreen />;
  } else if (!profile) {
    content = (
      <OnboardingScreen
        onComplete={async (p: Profile) => {
          await save(p);
          // El plan se generará en cuanto se monte el stack principal,
          // porque usePlan ya tiene acceso al perfil actualizado.
          // Forzamos aquí para que el usuario lo vea sin recargar.
          await generateFromProfile(p);
        }}
      />
    );
  } else {
    content = <MainTabs planExists={plan !== null} />;
  }

  return <NavigationContainer>{content}</NavigationContainer>;
}

function MainTabs({ planExists }: { planExists: boolean }) {
  return (
    <Tabs.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#20231F',
        tabBarInactiveTintColor: '#20231F80',
        tabBarStyle: { backgroundColor: '#F7F7F2', borderTopColor: '#E9EAE3' },
        headerStyle: { backgroundColor: '#F7F7F2' },
        headerTintColor: '#20231F',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="Hoy"
        component={TodayScreen}
        options={{ title: 'Hoy' }}
      />
      <Tabs.Screen
        name="Plan"
        options={{ title: 'Plan' }}
      >
        {() => <PlanTabContent />}
      </Tabs.Screen>
      <Tabs.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Ajustes' }}
      />
    </Tabs.Navigator>
  );
}

function PlanTabContent() {
  const { plan } = usePlan();
  return <PlanScreen plan={plan} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F2',
    gap: 8,
  },
  muted: {
    color: '#20231F',
    opacity: 0.6,
  },
});

// Compatibilidad: RootStack ahora es el wrapper completo, no un screen.
// Mantenemos un export con el nombre antiguo para no romper imports
// externos que pueda haber.
export { RootStackComponent as RootStack };