// Pantalla de login. Soporta email + contraseña en dos modos:
// - Iniciar sesión (cuenta existente)
// - Crear cuenta
//
// Botón "Continuar con Google" está pendiente hasta que salgamos de Expo
// Go (requiere build nativo). Cuando llegue, se activa el botón y se
// elimina el comentario de aviso.
//
// Reglas de UX alineadas con Identidad-visual:
// - Una acción principal por pantalla.
// - Botón lima con texto oscuro.
// - Errores en banda diferenciada, no en rojo chillón.

import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/app/hooks';
import { AuthError } from '@/domain/auth';

type Mode = 'signin' | 'signup';

export function LoginScreen() {
  const { signInWithEmail, signUpWithEmail } = useAuth();
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Itera</Text>
        <Text style={styles.subtitle}>
          {mode === 'signin' ? 'Inicia sesión' : 'Crea tu cuenta'}
        </Text>
      </View>

      <View style={styles.form}>
        {mode === 'signup' && (
          <>
            <Text style={styles.label}>Nombre (opcional)</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Cómo te llamas"
              autoCapitalize="words"
            />
          </>
        )}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="[email protected]"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Mínimo 6 caracteres"
          secureTextEntry
        />

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          style={[styles.button, styles.buttonPrimary]}
          onPress={onSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#20231F" />
          ) : (
            <Text style={styles.buttonTextPrimary}>
              {mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
            </Text>
          )}
        </Pressable>

        <Pressable
          style={styles.linkButton}
          onPress={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
          }}
          disabled={submitting}
        >
          <Text style={styles.linkText}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F2',
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 40,
    fontWeight: '600',
    color: '#20231F',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#20231F',
    opacity: 0.7,
  },
  form: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#20231F',
    marginTop: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EAE3',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#20231F',
    minHeight: 48,
  },
  button: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  buttonPrimary: {
    backgroundColor: '#C8F169',
  },
  buttonTextPrimary: {
    color: '#20231F',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  linkText: {
    color: '#20231F',
    opacity: 0.7,
    textDecorationLine: 'underline',
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  errorText: {
    color: '#A33',
    fontSize: 14,
  },
});