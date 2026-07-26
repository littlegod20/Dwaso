import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/common/avatar';
import { ListRow } from '@/components/common/list-row';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { Creditor } from '@/mock-data/creditors';
import { formatCurrency } from '@/utils/format-currency';
import { getCreditorStatusMeta, getInitials } from '@/utils/creditor-status';

type CreditorRowProps = {
  creditor: Creditor;
};

export function CreditorRow({ creditor }: CreditorRowProps) {
  const theme = useTheme();
  const status = getCreditorStatusMeta(creditor);
  const isPaid = creditor.status === 'paid';

  return (
    <ListRow
      onPress={() => router.push({ pathname: '/creditor/[id]', params: { id: creditor.id } })}
      leading={
        <Avatar
          label={getInitials(creditor.name)}
          icon={isPaid ? 'check' : undefined}
          color={theme[status.variant === 'neutral' ? 'text' : status.variant]}
          backgroundColor={status.variant === 'neutral' ? theme.backgroundElement : theme[`${status.variant}Bg`]}
        />
      }
      title={creditor.name}
      subtitle={status.label}
      subtitleColor={status.variant === 'neutral' ? 'textSecondary' : status.variant}
      trailing={
        <View style={styles.trailing}>
          <ThemedText type="smallBold" themeColor={isPaid ? 'textSecondary' : 'text'}>
            {formatCurrency(creditor.balance)}
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
