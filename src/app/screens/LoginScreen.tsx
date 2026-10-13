// Pantalla de login. Soporta email + contraseña en dos modos:
// - Iniciar sesión (cuenta existente)
// - Crear cuenta
//
// Reglas de UX alineadas con Identidad-visual:
// - Una acción principal por pantalla.
// - Botón lima con texto oscuro.
// - Errores en banda diferenciada, no en rojo chillón.
// - Espaciado generoso, no densidad.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Screen as ScreenLayout, TextField } from '@/app/components';
import { AuthError, useAuth } from '@/app/hooks';
import { useThemeTokens } from '@/app/theme';

type Mode = 'signin' | 'signup';

export function LoginScreen() {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const tokens = useThemeTokens();
  const styles = makeStyles(tokens);
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, name || undefined);
      }
    } catch (err) {
      if (err instanceof AuthError) {
        setError(translateError(err));
      } else {
        setError('Ha ocurrido un error inesperado.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenLayout scroll padded={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brand}>Itera</Text>
          <Text style={styles.title}>
            {mode === 'signin' ? 'Inicia sesión' : 'Crea tu cuenta'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'signin'
              ? 'Bienvenido de vuelta. Continúa desde donde lo dejaste.'
              : 'Cuéntanos qué quieres conseguir y te ayudamos a llegar.'}
          </Text>
        </View>

        <View style={styles.form}>
          {mode === 'signup' && (
            <TextField
              label="Nombre (opcional)"
              value={name}
              onChangeText={setName}
              placeholder="Cómo te llamas"
              autoCapitalize="words"
            />
          )}

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextField
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 6 caracteres"
            secureTextEntry
            helper={mode === 'signup' ? 'La usarás para volver a entrar.' : undefined}
          />

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Button
            label={mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
            onPress={onSubmit}
            loading={submitting}
            style={styles.submitButton}
          />

          <Pressable
            onPress={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
            }}
            disabled={submitting}
            style={styles.toggleMode}
          >
            <Text style={styles.toggleModeText}>
              {mode === 'signin'
                ? '¿No tienes cuenta? Crea una'
                : '¿Ya tienes cuenta? Inicia sesión'}
            </Text>
          </Pressable>

          {/*
            Botón de Google pendiente:
            Cuando salgamos de Expo Go y montemos EAS Build con el plugin
            nativo de Google Sign-In, este botón se activa y se conecta con
            firebaseAuthRepository.signInWithGoogle().
            Por ahora mostrarlo lanzaría el error "Google Sign-In requiere build
            nativo, pendiente", así que lo omitimos.
          */}
        </View>
      </View>
    </ScreenLayout>
  );
}

function translateError(err: AuthError): string {
  switch (err.code) {
    case 'invalid-email': return 'El email no tiene un formato válido.';
    case 'weak-password': return 'La contraseña debe tener al menos 6 caracteres.';
    case 'wrong-credentials': return 'Email o contraseña incorrectos.';
    case 'email-in-use': return 'Ya existe una cuenta con este email.';
    case 'user-disabled': return 'Esta cuenta está deshabilitada.';
    case 'network-failed': return 'Error de red. Comprueba tu conexión.';
    default: return 'Ha ocurrido un error. Inténtalo de nuevo.';
  }
}

function makeStyles(tokens: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: tokens.spacing.xl,
      paddingTop: tokens.spacing.xxl,
    },
    header: {
      marginBottom: tokens.spacing.xxl,
    },
    brand: {
      fontSize: tokens.fontSize.titleBig,
      fontWeight: tokens.fontWeight.bold,
      color: tokens.colors.accent,
      marginBottom: tokens.spacing.xs,
      letterSpacing: -0.5,
    },
    title: {
      fontSize: tokens.fontSize.titleScreen,
      fontWeight: tokens.fontWeight.semibold,
      color: tokens.colors.ink,
      marginBottom: tokens.spacing.xs,
    },
    subtitle: {
      fontSize: tokens.fontSize.bodyLg,
      color: tokens.colors.textSecondary,
      lineHeight: 22,
    },
    form: {
      gap: tokens.spacing.xs,
    },
    submitButton: {
      marginTop: tokens.spacing.lg,
    },
    toggleMode: {
      alignItems: 'center',
      paddingVertical: tokens.spacing.md,
    },
    toggleModeText: {
      color: tokens.colors.ink,
      opacity: 0.7,
      textDecorationLine: 'underline',
      fontSize: tokens.fontSize.body,
    },
    errorBox: {
      backgroundColor: tokens.colors.errorSurface,
      padding: tokens.spacing.md,
      borderRadius: tokens.radius.md,
      marginTop: tokens.spacing.sm,
    },
    errorText: {
      color: tokens.colors.error,
      fontSize: tokens.fontSize.body,
    },
  });
}