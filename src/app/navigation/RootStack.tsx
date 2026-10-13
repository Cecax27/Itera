// Stack de navegación raíz.
//
// Decide qué pantalla mostrar según el estado del perfil:
// - loading: muestra un spinner.
// - sin perfil: muestra Onboarding.
// - con perfil: muestra Today.
// - En cualquier momento se puede navegar a Settings (manualmente).
//
// En H3 se sustituirá por la navegación real con tabs (Hoy, Plan, Progreso).

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useProfile } from '@/app/hooks';
import { OnboardingScreen } from '@/app/screens/OnboardingScreen';
import { TodayScreen } from '@/app/screens/TodayScreen';
import { SettingsScreen } from '@/app/screens/SettingsScreen';

export type RootStackParamList = {
  Today: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootStack() {
  const { status, profile, save } = useProfile();

  let content: React.ReactNode;
  if (status === 'loading' || status === 'unauthenticated') {
    content = (
      <View style={styles.center}>
        <ActivityIndicator color="#C8F169" />
        <Text style={styles.muted}>Cargando…</Text>
      </View>
    );
  } else if (!profile) {
    content = <OnboardingScreen onComplete={(p) => save(p)} />;
  } else {
    content = (
      <Stack.Navigator
        initialRouteName="Today"
        screenOptions={{
          headerStyle: { backgroundColor: '#F7F7F2' }, // Canvas
          headerTintColor: '#20231F', // Ink
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