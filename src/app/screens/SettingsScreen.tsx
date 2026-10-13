// Pantalla "Ajustes" con sesión activa y datos del perfil.
// Edición real del perfil llega en un hito posterior.

import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen as ScreenLayout } from '@/app/components';
import { useAuth, useProfile } from '@/app/hooks';
import { useThemeTokens } from '@/app/theme';

export function SettingsScreen() {
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const { user, signOut } = useAuth();
  const { profile } = useProfile();

  return (
    <ScreenLayout scroll>
      <Text style={styles.sectionTitle}>Sesión</Text>
      <Card>
        <Row label="Email" value={user?.email ?? '—'} />
        <Row label="Proveedor" value={user?.provider ?? '—'} />
        <Row label="ID" value={user?.id ? `${user.id.slice(0, 12)}…` : '—'} mono />
        <View style={styles.divider} />
        <Button label="Cerrar sesión" onPress={() => signOut()} variant="danger" />
      </Card>

      <Text style={styles.sectionTitle}>Perfil</Text>
      <Card>
        {profile ? (
          <>
            <Row
              label="Nombre"
              value={profile.name ?? '—'}
            />
            <Row
              label="Experiencia"
              value={experienceLabel(profile.experience)}
            />
            <Row
              label="Objetivos"
              value={`${profile.secondaryGoals.length + 1} (${profile.primaryGoal.discipline})`}
            />
            <Row
              label="Equipamiento"
              value={`${Object.values(profile.equipment).filter(Boolean).length} piezas`}
            />
            <Row
              label="Lesiones activas"
              value={`${profile.restrictions.injuries.length}`}
            />
          </>
        ) : (
          <Text style={styles.muted}>Sin perfil todavía.</Text>
        )}
        <View style={styles.divider} />
        <Text style={styles.muted}>
          La edición de perfil post-onboarding llega en un hito posterior.
        </Text>
      </Card>
    </ScreenLayout>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const tokens = useThemeTokens();
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, mono && rowStyles.mono]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 15,
    color: '#5C5F58',
  },
  value: {
    fontSize: 15,
    fontWeight: '500',
    color: '#20231F',
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 13,
  },
});

function experienceLabel(lvl: string): string {
  switch (lvl) {
    case 'beginner': return 'Principiante';
    case 'intermediate': return 'Intermedio';
    case 'advanced': return 'Avanzado';
    default: return lvl;
  }
}

function makeStyles(tokens: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
    sectionTitle: {
      fontSize: tokens.fontSize.label,
      fontWeight: tokens.fontWeight.medium,
      color: tokens.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: tokens.spacing.xl,
      marginBottom: tokens.spacing.md,
    },
    divider: {
      height: 1,
      backgroundColor: tokens.colors.border,
      marginVertical: tokens.spacing.md,
    },
    muted: {
      fontSize: tokens.fontSize.label,
      color: tokens.colors.textSecondary,
      fontStyle: 'italic',
    },
  });
}