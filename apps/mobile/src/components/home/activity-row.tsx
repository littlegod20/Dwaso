import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { ActivityEntry } from '@/mock-data/activity';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatCurrency } from '@/utils/format-currency';

type ActivityRowProps = {
  entry: ActivityEntry;
};

export function ActivityRow({ entry }: ActivityRowProps) {
  const theme = useTheme();
  const isIn = entry.direction === 'in';
  const color = isIn ? theme.success : theme.text;

  return (
    <View style={styles.row}>
      <View style={[styles.iconCircle, { backgroundColor: theme.backgroundElement }]}>
        <Feather
          name={isIn ? 'arrow-up-right' : 'arrow-down-left'}
          size={16}
          color={isIn ? theme.success : theme.textSecondary}
        />
      </View>
      <View style={styles.textGroup}>
        <ThemedText type="default" numberOfLines={1}>
          {entry.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {entry.time}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" style={{ color }}>
        {entry.amount >= 0 ? '+' : ''}
        {formatCurrency(entry.amount)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    flex: 1,
    gap: 2,
  },
});
