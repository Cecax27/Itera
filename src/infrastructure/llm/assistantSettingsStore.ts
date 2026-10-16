import * as SecureStore from 'expo-secure-store';

export interface StoredAssistantCredentials {
  apiKey: string | null;
  model: string | null;
}

function keyName(userId: string, item: 'apiKey' | 'model'): string {
  return `itera.assistant.openai.${item}.${userId}`;
}

export async function readAssistantCredentials(userId: string): Promise<StoredAssistantCredentials> {
  const [apiKey, model] = await Promise.all([
    SecureStore.getItemAsync(keyName(userId, 'apiKey')),
    SecureStore.getItemAsync(keyName(userId, 'model')),
  ]);
  return { apiKey, model };
}

export async function saveAssistantCredentials(
  userId: string,
  credentials: { apiKey: string; model: string },
): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(keyName(userId, 'apiKey'), credentials.apiKey),
    SecureStore.setItemAsync(keyName(userId, 'model'), credentials.model),
  ]);
}

export async function saveAssistantModel(userId: string, model: string): Promise<void> {
  await SecureStore.setItemAsync(keyName(userId, 'model'), model);
}

export async function clearAssistantCredentials(userId: string): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(keyName(userId, 'apiKey')),
    SecureStore.deleteItemAsync(keyName(userId, 'model')),
  ]);
}
