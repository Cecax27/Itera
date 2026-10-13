// Pantalla "Hoy" mínima. Sirve como smoke test de Firebase: si Firebase
// está bien configurado, ambos badges se mostrarán en verde ("Conectado").
//
// En H3 esta pantalla se sustituirá por la real con la sesión del día.

import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getAuthInstance } from '@/infrastructure/firebase';
import { getDbInstance } from '@/infrastructure/firebase';

export function TodayScreen({ navigation }: { navigation: { navigate: (screen: 'Settings') => void } }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Itera</Text>
      <Text style={styles.subtitle}>H0 · Smoke test de Firebase</Text>

      <FirebaseStatusBadge label="Auth" />
      <FirebaseStatusBadge label="Firestore" />

      <Text style={styles.hint} onPress={() => navigation.navigate('Settings')}>
        Ir a Ajustes →
      </Text>
    </View>
  );
}

function FirebaseStatusBadge({ label }: { label: string }) {
  // El badge verifica que el cliente se instancia sin error. Las claves se
  // validan al llamar, así que un error de configuración se refleja aquí.
  let status: 'ok' | 'error' = 'ok';
  try {
    if (label === 'Auth') {
      getAuthInstance();
    } else {
      getDbInstance();
    }
  } catch {
    status = 'error';
  }

  const color = status === 'ok' ? '#C8F169' : '#E55';
  const text = status === 'ok' ? 'Conectado' : 'Error';

  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeLabel}>{label}</Text>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F2',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 40,
    fontWeight: '600',
    color: '#20231F',
  },
  subtitle: {
    fontSize: 16,
    color: '#20231F',
    opacity: 0.7,
  },
  badge: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 160,
    alignItems: 'center',
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#20231F',
    opacity: 0.7,
  },
  badgeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#20231F',
  },
  hint: {
    color: '#20231F',
    opacity: 0.6,
    textDecorationLine: 'underline',
  },
});