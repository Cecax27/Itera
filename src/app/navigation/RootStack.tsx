// Stack de navegación raíz.
//
// Decide qué pantalla mostrar según el estado global:
// - loading (auth inicial): spinner.
// - sin sesión: LoginScreen.
// - con sesión pero sin perfil: Onboarding.
// - con sesión y perfil: stack principal (Hoy, Ajustes).
//
// En H3 se sustituirá por la navegación real con tabs (Hoy, Plan, Progreso).

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth, useProfile } from '@/app/hooks';
import { LoginScreen } from '@/app/screens/LoginScreen';
import { OnboardingScreen } from '@/app/screens/OnboardingScreen';
import { TodayScreen } from '@/app/screens/TodayScreen';
import { SettingsScreen } from '@/app/screens/SettingsScreen';

export type RootStackParamList = {
  Today: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootStack() {
  const { status: authStatus } = useAuth();
  const { status: profileStatus, profile, save } = useProfile();

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
    content = <OnboardingScreen onComplete={(p) => save(p)} />;
  } else {
    content = (
      <Stack.Navigator
        initialRouteName="Today"
        screenOptions={{
          headerStyle: { backgroundColor: '#F7F7F2' },
          headerTintColor: '#20231F',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen
          name="Today"
          component={TodayScreen}
          options={{ title: 'Hoy' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Ajustes' }}
        />
      </Stack.Navigator>
    );
  }

  return <NavigationContainer>{content}</NavigationContainer>;
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