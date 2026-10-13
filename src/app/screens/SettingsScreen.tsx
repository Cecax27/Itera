// Pantalla "Ajustes" con edición de perfil (placeholder hasta H1.b) y
// cierre de sesión. La edición real del perfil (re-onboarding) se abordará
// en un hito posterior.

import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth, useProfile } from '@/app/hooks';

export function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.label}>Sesión</Text>
        <Text style={styles.value}>{user?.email ?? user?.displayName ?? user?.id ?? '—'}</Text>
        <Text style={styles.meta}>Proveedor: {user?.provider ?? '—'}</Text>

        <Text style={styles.buttonDanger} onPress={() => signOut()}>
          Cerrar sesión
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Perfil</Text>
        {profile ? (
          <>
            <Text style={styles.value}>
              {profile.name ? `${profile.name}, ` : ''}
              {profile.experience}
            </Text>
            <Text style={styles.meta}>
              {profile.secondaryGoals.length + 1} objetivo(s) registrado(s).
            </Text>
            <Text style={styles.meta}>
              {Object.values(profile.equipment).filter(Boolean).length} piezas de equipamiento.
            </Text>
          </>
        ) : (
          <Text style={styles.meta}>Sin perfil todavía.</Text>
        )}
        <Text style={styles.muted}>
          La edición de perfil post-onboarding llega en un hito posterior.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F2',
  },
  section: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EAE3',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#20231F',
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  value: {
    fontSize: 18,
    fontWeight: '500',
    color: '#20231F',
    marginBottom: 4,
  },
  meta: {
    fontSize: 14,
    color: '#20231F',
    opacity: 0.7,
    marginBottom: 4,
  },
  muted: {
    fontSize: 12,
    color: '#20231F',
    opacity: 0.5,
    marginTop: 12,
    fontStyle: 'italic',
  },
  buttonDanger: {
    marginTop: 16,
    color: '#A33',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});