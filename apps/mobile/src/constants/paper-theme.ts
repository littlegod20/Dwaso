import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

import { Colors, type ThemeColor } from '@/constants/theme';

function buildPaperTheme(base: MD3Theme, palette: Record<ThemeColor, string>): MD3Theme {
  return {
    ...base,
    roundness: 16,
    colors: {
      ...base.colors,
      primary: palette.primary,
      onPrimary: palette.primaryText,
      primaryContainer: palette.primary,
      onPrimaryContainer: palette.primaryText,
      background: palette.background,
      onBackground: palette.text,
      surface: palette.card,
      onSurface: palette.text,
      surfaceVariant: palette.backgroundElement,
      onSurfaceVariant: palette.textSecondary,
      outline: palette.border,
      outlineVariant: palette.border,
      error: palette.danger,
      onError: '#FFFFFF',
      errorContainer: palette.dangerBg,
      onErrorContainer: palette.danger,
    },
  };
}

export const PaperLightTheme = buildPaperTheme(MD3LightTheme, Colors.light);
export const PaperDarkTheme = buildPaperTheme(MD3DarkTheme, Colors.dark);
