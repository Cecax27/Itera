// Stack de navegación raíz. Mientras no haya flujo real, expone dos
// pantallas (Hoy y Ajustes) para validar que la navegación funciona.
//
// En H3 se sustituirá por la navegación real con tabs (Hoy, Plan, Progreso)
// y un menú secundario.

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { TodayScreen } from '@/app/screens/TodayScreen';
import { SettingsScreen } from '@/app/screens/SettingsScreen';

export type RootStackParamList = {
  Today: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootStack() {
  return (
    <NavigationContainer>
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
    </NavigationContainer>
  );
}