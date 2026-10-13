// Pantalla "Ajustes" placeholder. Sirve para validar la navegación.
// El contenido real (perfil, equipamiento, objetivos) llega en H1.

import { Text, View, StyleSheet } from 'react-native';

export function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ajustes</Text>
      <Text style={styles.body}>
        Próximamente: edición de perfil, objetivos, disponibilidad y equipamiento.
      </Text>
      <Text style={styles.body}>
        Esta pantalla existe solo para validar que la navegación funciona durante H0.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F2', // Canvas
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#20231F', // Ink
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    color: '#20231F',
    opacity: 0.7,
    marginBottom: 12,
  },
});