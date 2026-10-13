// Sistema de tokens de diseño. Theme tokens y paleta clara/oscura.
//
// Fuentes:
// - Wiki Identidad-visual (https://github.com/Cecax27/Itera/wiki/Identidad-visual)
// - Skill visual-identity en este repo
//
// Cada componente debe importar tokens desde aquí, NO hardcodear colores
// hex ni medidas. Si necesitas un token nuevo, añádelo aquí primero.

import { useColorScheme } from 'react-native';

const palette = {
  lime: '#C8F169',
  ink: '#20231F',
  inkLight: '#F0F0EB',
  canvas: '#F7F7F2',
  surface: '#E9EAE3',
  backgroundDark: '#171A17',
  surfaceDark: '#242824',
  surfaceDarkAlt: '#2D312E',
  accentRun: '#5BB3F2',
  accentRunDark: '#3F8FC9',
  error: '#C0392B',
  errorDark: '#E55',
  errorSurface: '#FFE5E5',
  errorSurfaceDark: '#3A1F1F',
  success: '#5B8C5A',
  successDark: '#7AB87B',
  border: '#E9EAE3',
  borderDark: '#2F332F',
  textSecondary: '#5C5F58',
  textSecondaryDark: '#A0A39C',
} as const;

export interface ThemeColors {
  canvas: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  ink: string;
  textSecondary: string;
  accent: string;
  accentInk: string;
  accentRun: string;
  accentRunInk: string;
  error: string;
  errorSurface: string;
  success: string;
  mutedText: string;
  veryMutedText: string;
  inactiveBackground: string;
  tabBarActive: string;
  tabBarInactive: string;
}

export interface ThemeTokens {
  scheme: 'light' | 'dark';
  colors: ThemeColors;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    pill: number;
  };
  fontSize: {
    caption: number;
    label: number;
    body: number;
    bodyLg: number;
    titleSection: number;
    titleScreen: number;
    titleBig: number;
    titleHero: number;
    metricLarge: number;
  };
  fontWeight: {
    medium: '500';
    semibold: '600';
    bold: '700';
  };
  borderWidth: {
    hairline: number;
  };
  minTouch: number;
}

const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
const fontSize = {
  caption: 11,
  label: 13,
  body: 15,
  bodyLg: 16,
  titleSection: 19,
  titleScreen: 24,
  titleBig: 28,
  titleHero: 40,
  metricLarge: 48,
} as const;
const fontWeight = { medium: '500', semibold: '600', bold: '700' } as const;
const borderWidth = { hairline: 1 } as const;
const minTouch = 48;

export const lightTokens: ThemeTokens = {
  scheme: 'light',
  colors: {
    canvas: palette.canvas,
    surface: palette.surface,
    surfaceElevated: '#FFFFFF',
    border: palette.border,
    ink: palette.ink,
    textSecondary: palette.textSecondary,
    accent: palette.lime,
    accentInk: palette.ink,
    accentRun: palette.accentRun,
    accentRunInk: '#FFFFFF',
    error: palette.error,
    errorSurface: palette.errorSurface,
    success: palette.success,
    mutedText: 'rgba(32, 35, 31, 0.6)',
    veryMutedText: 'rgba(32, 35, 31, 0.4)',
    inactiveBackground: palette.surface,
    tabBarActive: palette.ink,
    tabBarInactive: 'rgba(32, 35, 31, 0.5)',
  },
  spacing,
  radius,
  fontSize,
  fontWeight,
  borderWidth,
  minTouch,
};

export const darkTokens: ThemeTokens = {
  scheme: 'dark',
  colors: {
    canvas: palette.backgroundDark,
    surface: palette.surfaceDark,
    surfaceElevated: palette.surfaceDarkAlt,
    border: palette.borderDark,
    ink: palette.inkLight,
    textSecondary: palette.textSecondaryDark,
    accent: palette.lime,
    accentInk: palette.ink,
    accentRun: palette.accentRunDark,
    accentRunInk: '#FFFFFF',
    error: palette.errorDark,
    errorSurface: palette.errorSurfaceDark,
    success: palette.successDark,
    mutedText: 'rgba(240, 240, 235, 0.6)',
    veryMutedText: 'rgba(240, 240, 235, 0.4)',
    inactiveBackground: palette.surfaceDarkAlt,
    tabBarActive: palette.inkLight,
    tabBarInactive: 'rgba(240, 240, 235, 0.5)',
  },
  spacing,
  radius,
  fontSize,
  fontWeight,
  borderWidth,
  minTouch,
};

export function useThemeTokens(): ThemeTokens {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTokens : lightTokens;
}

export function getTokens(scheme: 'light' | 'dark' | null | undefined): ThemeTokens {
  return scheme === 'dark' ? darkTokens : lightTokens;
}