// Helpers de animación. Reanimated v4.
//
// Reglas de la wiki Identidad-visual:
// - Transiciones de 150-220 ms.
// - Sin animaciones obligatorias; esto es enhancement.
// - Solo transform y opacity (GPU-friendly).

import { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Animated from 'react-native-reanimated';

const AnimatedView = Animated.View;

export const enterDurationMs = 220;
export const enterEasing = Easing.out(Easing.cubic);

/**
 * Variante de View que entra con fade-in + leve translateY al montar.
 */
export function FadeIn({
  children,
  delay = 0,
  translateY = 8,
  duration = enterDurationMs,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  translateY?: number;
  duration?: number;
  style?: ViewStyle | ViewStyle[];
}) {
  const opacity = useSharedValue(0);
  const ty = useSharedValue(translateY);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration, easing: enterEasing }));
    ty.value = withDelay(delay, withTiming(0, { duration, easing: enterEasing }));
  }, [delay, duration, opacity, ty]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  return (
    <AnimatedView style={[animatedStyle, style as ViewStyle]}>
      {children}
    </AnimatedView>
  );
}

/**
 * Animación de pulse sutil. Devuelve un valor que oscila entre 1 y 1.04.
 * Útil para animar scale en botones.
 */
export function usePulseLoop(active: boolean, periodMs = 1600) {
  const value = useSharedValue(1);
  useEffect(() => {
    if (!active) {
      value.value = withTiming(1, { duration: enterDurationMs });
      return;
    }
    const interval = setInterval(() => {
      value.value = withTiming(value.value === 1.04 ? 1 : 1.04, {
        duration: periodMs / 2,
        easing: Easing.inOut(Easing.quad),
      });
    }, periodMs / 2);
    return () => clearInterval(interval);
  }, [active, periodMs, value]);
  return value;
}