// Hook useZeppExport: exporta una sesión de carrera como plantilla de
// entrenamiento a la app Zepp (Amazfit).
//
// Flujo completo y por qué cada paso:
//   1. El dominio convierte la sesión al JSON de Zepp y la valida
//      (buildZeppTemplate). Si la sesión no es exportable, se informa sin
//      publicar nada.
//   2. Si la conversión omitió información (p. ej. ritmos objetivo, sin
//      códigos verificados en Zepp), se pide confirmación: nunca se
//      elimina información en silencio.
//   3. El backend propio almacena la plantilla y devuelve su URL pública.
//   4. Se construye el deep link amazfit:// con ESA URL (nunca la de un
//      tercero) y se abre la app Zepp.
//   5. Abrir Zepp NO es lo mismo que importar: el mensaje final deja claro
//      que el usuario debe revisar, guardar la plantilla y sincronizarla
//      con el reloj.
//
// Si Zepp no está instalado o el enlace falla, se ofrece compartir la URL
// de la plantilla (p. ej. para abrirla desde el navegador del teléfono).

import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, Share } from 'react-native';

import { RunSession, Session } from '@/domain/planning';
import {
  buildAmazfitDeepLink,
  buildZeppTemplate,
  ZeppTemplateRepository,
} from '@/domain/zepp';
import { firebaseZeppTemplateRepository } from '@/infrastructure/firebase/repositories';

// El repositorio es inyectable para tests; por defecto, Firebase.
const defaultRepository: ZeppTemplateRepository = firebaseZeppTemplateRepository;

export interface UseZeppExportResult {
  /** true mientras se publica la plantilla; deshabilita botones. */
  exporting: boolean;
  /** Ejecuta el flujo completo de exportación con mensajes y fallbacks. */
  exportToZepp: () => void;
}

export function useZeppExport(
  session: Session | null,
  templateTitle: string,
  repository: ZeppTemplateRepository = defaultRepository,
): UseZeppExportResult {
  const [exporting, setExporting] = useState(false);

  const exportToZepp = useCallback(() => {
    if (!session) return;
    // La apertura del enlace y la descarga de la plantilla dependen de la
    // app Zepp nativa: en web no hay deep link de sistema que funcione.
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      Alert.alert(
        'No disponible en esta plataforma',
        'Exportar a Zepp solo funciona desde la app móvil, donde puede abrirse la aplicación Zepp.',
      );
      return;
    }
    // Zepp solo admite importar plantillas de carrera (y otros deportes de
    // resistencia): las de fuerza se informan, nunca se exportan a medias.
    if (session.discipline !== 'running') {
      Alert.alert(
        'Exportación no disponible',
        'Solo se pueden exportar sesiones de carrera a Zepp: la app Zepp no admite importar plantillas de fuerza.',
      );
      return;
    }
    const runSession: RunSession = session;

    // 1) Conversión + validación en el dominio. Falla antes de publicar.
    const conversion = buildZeppTemplate({
      session: runSession,
      title: templateTitle,
      description: runSession.purpose ?? '',
    });
    if (!conversion.ok) {
      Alert.alert('No se puede exportar', conversion.error);
      return;
    }

    // 2) Objetos omitidos (ritmo/FC): confirmación explícita.
    if (conversion.omissions.length > 0) {
      Alert.alert(
        'La plantilla se exportará simplificada',
        [
          ...conversion.omissions.map((notice) => `· ${notice}`),
          '',
          '¿Quieres exportar esta versión simplificada?',
        ].join('\n'),
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Continuar', onPress: () => void publish(conversion.template, repository, setExporting) },
        ],
      );
      return;
    }

    void publish(conversion.template, repository, setExporting);
  }, [session, templateTitle, repository]);

  return { exporting, exportToZepp };
}

async function publish(
  template: unknown,
  repository: ZeppTemplateRepository,
  setExporting: (value: boolean) => void,
): Promise<void> {
  setExporting(true);
  let templateUrl: string | null = null;
  try {
    // 3) Publicar en nuestro backend (requiere sesión).
    const published = await repository.createWorkoutTemplate(template);
    templateUrl = published.url;

    // 4) Deep link con la URL de NUESTRA plantilla.
    const deepLink = buildAmazfitDeepLink(published.url);
    await openExternally(deepLink);

    // 5) Abrir Zepp no garantiza la importación: el paso final es manual.
    Alert.alert(
      'Zepp abierto',
      'Si Zepp no mostró la plantilla, ábrela manualmente: encontrarás el entrenamiento para revisar, guardar y sincronizar con tu reloj. Esta exportación no sincroniza nada por sí sola.',
    );
  } catch (err) {
    // 6) Fallback: compartir la URL para abrirla desde el navegador.
    const shareUrl = templateUrl;
    if (shareUrl) {
      Alert.alert(
        'No se pudo abrir Zepp',
        'Comprueba que la app Zepp está instalada y actualizada. También puedes compartir el enlace de la plantilla y abrirlo en el navegador de este teléfono.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Compartir enlace',
            onPress: () => {
              void Share.share({
                title: 'Plantilla de entrenamiento · Itera',
                message: `Abre este enlace en el navegador para importar la plantilla en Zepp: ${shareUrl}`,
                url: shareUrl,
              }).catch(() => undefined);
            },
          },
        ],
      );
    } else {
      Alert.alert(
        'No se pudo exportar',
        err instanceof Error
          ? describeError(err)
          : 'No se pudo publicar la plantilla. Inténtalo de nuevo.',
      );
    }
  } finally {
    setExporting(false);
  }
}

/**
 * Abre el deep link con openURL directamente. Deliberadamente NO usamos
 * canOpenURL: en Android 11+ exige declarar <queries> en el manifest y en
 * iOS LSApplicationQueriesSchemes para no devolver false siempre. Con
 * openURL: si Zepp está instalada, se abre; si no, la promesa rechaza y el
 * flujo cae al fallback de compartir sin tocar configuración nativa.
 */
async function openExternally(deepLink: string): Promise<void> {
  await Linking.openURL(deepLink);
}

function describeError(err: Error): string {
  // httpsCallable lanza FirebaseError con el mensaje del servidor dentro
  // de corchetes; lo reducimos al texto legible.
  return err.message.replace(/^\[(?:\w[\w-]*)\][: ]*/, '') || 'No se pudo publicar la plantilla.';
}
