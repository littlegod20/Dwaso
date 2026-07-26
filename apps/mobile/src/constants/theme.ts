/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#211C16',
    background: '#F5F1EA',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EDE7DB',
    textSecondary: '#8C8577',
    primary: '#E29D3A',
    primaryText: '#211C16',
    card: '#FFFFFF',
    border: '#E7E1D3',
    danger: '#C74C3F',
    dangerBg: '#FBE8E5',
    success: '#2F9C5C',
    successBg: '#E5F4EA',
    warning: '#B9791F',
    warningBg: '#F7E9D2',
  },
  dark: {
    text: '#F5F1EA',
    background: '#17130F',
    backgroundElement: '#211C16',
    backgroundSelected: '#2E271D',
    textSecondary: '#A79E90',
    primary: '#E29D3A',
    primaryText: '#211C16',
    card: '#211C16',
    border: '#332B21',
    danger: '#E8574B',
    dangerBg: '#2A1614',
    success: '#4CC98A',
    successBg: '#142A1C',
    warning: '#E2A03C',
    warningBg: '#2E2312',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
