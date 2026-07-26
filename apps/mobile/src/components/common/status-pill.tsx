import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type StatusPillVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'primary';

type StatusPillProps = {
  label: string;
  variant?: StatusPillVariant;
  withDot?: boolean;
};

export function StatusPill({ label, variant = 'neutral', withDot = false }: StatusPillProps) {
  const theme = useTheme();

  const variantColors: Record<StatusPillVariant, { bg: string; fg: string }> = {
    success: { bg: theme.successBg, fg: theme.success },
    warning: { bg: theme.warningBg, fg: theme.warning },
    danger: { bg: theme.dangerBg, fg: theme.danger },
    primary: { bg: theme.primary, fg: theme.primaryText },
    neutral: { bg: theme.backgroundElement, fg: theme.textSecondary },
  };

  const { bg, fg } = variantColors[variant];

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {withDot && <View style={[styles.dot, { backgroundColor: fg }]} />}
      <ThemedText type="smallBold" style={[styles.label, { color: fg }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.five,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
  },
});
