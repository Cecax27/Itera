import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { RootStack } from '@/app/navigation/RootStack';

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <RootStack />
        <StatusBar style="dark" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7F7F2', // Canvas
  },
});