// Pantalla "Hoy" mínima. Sirve como smoke test de Firebase: si Firebase
// está bien configurado, ambos badges se mostrarán en verde ("Conectado").
//
// En H3 esta pantalla se sustituirá por la real con la sesión del día.

import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getAuthInstance } from '@/infrastructure/firebase';
import { getDbInstance } from '@/infrastructure/firebase';

type Status = 'checking' | 'ok' | 'error';

export function TodayScreen({ navigation }: { navigation: { navigate: (screen: 'Settings') => void } }) {
  const [authStatus, setAuthStatus] = useState<Status>('checking');
  const [dbStatus, setDbStatus] = useState<Status>('checking');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        // Auth: instanciar el cliente es suficiente para verificar la
        // configuración. Cualquier error de claves faltantes se lanza aquí.
        getAuthInstance();
        if (!cancelled) setAuthStatus('ok');

        // Firestore: igual, instanciar el cliente verifica la configuración.
        // Una operación real (sin red) podría colgarse; instanciar es
        // suficiente como smoke test.
        getDbInstance();
        if (!cancelled) setDbStatus('ok');
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : String(err));
          setAuthStatus('error');
          setDbStatus('error');
        }
      }
    }

    void check();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Itera</Text>
      <Text style={styles.subtitle}>H0 · Smoke test de Firebase</Text>

      <View style={styles.row}>
        <StatusBadge label="Auth" status={authStatus} />
        <StatusBadge label="Firestore" status={dbStatus} />
      </View>

      {errorMsg && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      <Text style={styles.hint} onPress={() => navigation.navigate('Settings')}>
        Ir a Ajustes →
      </Text>

      {authStatus === 'checking' && (
        <ActivityIndicator style={styles.spinner} color="#C8F169" />
      )}
    </View>
  );
}

function StatusBadge({ label, status }: { label: string; status: Status }) {
  const color = status === 'ok' ? '#C8F169' : status === 'error' ? '#E55' : '#E9EAE3';
  const text = status === 'ok' ? 'Conectado' : status === 'error' ? 'Error' : 'Probando…';
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
    backgroundColor: '#F7F7F2', // Canvas
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: '600',
    color: '#20231F', // Ink
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#20231F',
    marginBottom: 24,
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  badge: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 110,
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
  errorBox: {
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    maxWidth: '90%',
  },
  errorText: {
    color: '#A33',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  hint: {
    color: '#20231F',
    opacity: 0.6,
    marginTop: 8,
    textDecorationLine: 'underline',
  },
  spinner: {
    marginTop: 16,
  },
});