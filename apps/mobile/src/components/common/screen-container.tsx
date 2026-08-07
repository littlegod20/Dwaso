import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenContainerProps = {
  children: ReactNode;
  scroll?: boolean;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  edges?: Array<'top' | 'bottom'>;
  /** Pull-to-refresh, which on every screen means "sync now" rather than
   * "refetch", because the data is already local. */
  refreshControl?: ScrollViewProps['refreshControl'];
};

export function ScreenContainer({
  children,
  scroll = true,
  contentContainerStyle,
  edges = ['top', 'bottom'],
  refreshControl,
}: ScreenContainerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const paddingTop = edges.includes('top') ? insets.top : 0;
  const paddingBottom = edges.includes('bottom') ? insets.bottom + Spacing.four : Spacing.four;

  if (!scroll) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.background, paddingTop, paddingBottom }]}>
        <View style={styles.centeredContent}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop, paddingBottom },
        contentContainerStyle,
      ]}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.centeredContent}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  centeredContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
});
