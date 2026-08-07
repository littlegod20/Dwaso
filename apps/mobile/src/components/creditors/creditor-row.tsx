import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/common/avatar';
import { ListRow } from '@/components/common/list-row';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { CreditorListItem } from '@/lib/queries/creditors';
import { useMoney } from '@/utils/format-currency';
import { getCreditorStatusMeta, getInitials } from '@/utils/creditor-status';

type CreditorRowProps = {
  creditor: CreditorListItem;
};

export function CreditorRow({ creditor }: CreditorRowProps) {
  const theme = useTheme();
  const { format } = useMoney();
  const status = getCreditorStatusMeta(creditor);
  const isClear = creditor.status === 'clear';

  return (
    <ListRow
      onPress={() => router.push({ pathname: '/creditor/[id]', params: { id: creditor.id } })}
      leading={
        <Avatar
          label={getInitials(creditor.name)}
          icon={isClear ? 'check' : undefined}
          color={theme[status.variant === 'neutral' ? 'text' : status.variant]}
          backgroundColor={
            status.variant === 'neutral' ? theme.backgroundElement : theme[`${status.variant}Bg`]
          }
        />
      }
      title={creditor.name}
      subtitle={status.label}
      subtitleColor={status.variant === 'neutral' ? 'textSecondary' : status.variant}
      trailing={
        <View style={styles.trailing}>
          <ThemedText type="smallBold" themeColor={isClear ? 'textSecondary' : 'text'}>
            {format(creditor.balanceMinor)}
          </ThemedText>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  trailing: {
    alignItems: 'flex-end',
  },
});
