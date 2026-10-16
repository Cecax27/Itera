import { useCallback, useEffect, useState } from 'react';

import { AssistantModel } from '@/domain/assistant';
import { assistantClient } from '@/infrastructure/llm/assistantClient';
import {
  clearAssistantCredentials,
  readAssistantCredentials,
  saveAssistantCredentials,
  saveAssistantModel,
} from '@/infrastructure/llm/assistantSettingsStore';

import { useAuth } from './useAuth';

const DEFAULT_MODEL = 'gpt-6-luna';

export function useAssistantSettings() {
  const { user } = useAuth();
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [models, setModels] = useState<AssistantModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setApiKeySaved(false);
      setSelectedModel('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const credentials = await readAssistantCredentials(user.id);
      setApiKeySaved(Boolean(credentials.apiKey));
      setSelectedModel(credentials.model ?? '');
    } catch {
      setError('No se pudo leer la configuración segura del asistente.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const testConnection = useCallback(async (draftApiKey: string) => {
    if (!user) {
      setError('Inicia sesión para configurar el asistente.');
      return false;
    }
    setTesting(true);
    setError(null);
    setNotice(null);
    let saved: Awaited<ReturnType<typeof readAssistantCredentials>>;
    try {
      saved = await readAssistantCredentials(user.id);
    } catch {
      setError('No se pudo leer la configuración segura de este dispositivo.');
      setTesting(false);
      return false;
    }

    const apiKey = draftApiKey.trim() || saved.apiKey;
    if (!apiKey) {
      setError('Introduce tu API key de OpenAI.');
      setTesting(false);
      return false;
    }

    let availableModels: AssistantModel[];
    try {
      availableModels = await assistantClient.listAvailableModels(apiKey);
    } catch (err) {
      setError('No se pudo conectar con OpenAI. Comprueba la API key y tu conexión, e inténtalo de nuevo.');
      setTesting(false);
      return false;
    }
    if (availableModels.length === 0) {
      setError('La conexión respondió, pero esa cuenta no ofrece modelos de texto compatibles.');
      setTesting(false);
      return false;
    }

    const nextModel = availableModels.some((model) => model.id === saved.model)
      ? saved.model!
      : availableModels.find((model) => model.id === DEFAULT_MODEL)?.id ?? availableModels[0].id;
    try {
      await saveAssistantCredentials(user.id, { apiKey, model: nextModel });
      setModels(availableModels);
      setSelectedModel(nextModel);
      setApiKeySaved(true);
      setNotice(`Conexión correcta. ${availableModels.length} modelos disponibles.`);
      return true;
    } catch {
      setError('La conexión funciona, pero no se pudo guardar la configuración segura.');
      return false;
    } finally {
      setTesting(false);
    }
  }, [user]);

  const selectModel = useCallback(async (modelId: string) => {
    if (!user) return;
    if (!models.some((model) => model.id === modelId)) return;
    try {
      const stored = await readAssistantCredentials(user.id);
      if (!stored.apiKey) {
        setError('Prueba primero la conexión con una clave API.');
        return;
      }
      await saveAssistantModel(user.id, modelId);
      setSelectedModel(modelId);
      setNotice(`Modelo seleccionado: ${modelId}`);
      setError(null);
    } catch {
      setError('No se pudo guardar el modelo en este dispositivo.');
    }
  }, [models, user]);

  const clear = useCallback(async () => {
    if (!user) return;
    try {
      await clearAssistantCredentials(user.id);
      setApiKeySaved(false);
      setSelectedModel('');
      setModels([]);
      setNotice('Se eliminó la configuración de OpenAI de este dispositivo.');
      setError(null);
    } catch {
      setError('No se pudo eliminar la clave de este dispositivo.');
    }
  }, [user]);

  return {
    apiKeySaved,
    selectedModel,
    models,
    loading,
    testing,
    error,
    notice,
    refresh,
    testConnection,
    selectModel,
    clear,
  };
}
