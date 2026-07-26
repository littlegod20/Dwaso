import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppButton } from '@/components/common/app-button';
import { IconBadge } from '@/components/common/icon-badge';
import { PageHeader } from '@/components/common/page-header';
import { ScreenContainer } from '@/components/common/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AddCreditorScreen() {
  const theme = useTheme();

  return (
    <ScreenContainer>
      <PageHeader title="Add creditor" />

      {/* TODO: wire up contacts picker */}
      <Pressable style={[styles.contactsRow, { backgroundColor: theme.backgroundElement }]}>
        <IconBadge icon="user" color={theme.primary} backgroundColor={theme.warningBg} size={44} iconSize={20} />
        <View style={styles.contactsText}>
          <ThemedText type="default" style={styles.contactsTitle}>
            Import from contacts
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Pick from your phone&apos;s address book
          </ThemedText>
        </View>
        <Feather name="chevron-right" size={18} color={theme.textSecondary} />
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        <ThemedText type="small" themeColor="textSecondary">
          OR ENTER MANUALLY
        </ThemedText>
        <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
      </View>

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Full name
        </ThemedText>
        <TextInput
          placeholder="e.g. Mama Ngozi"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />
      </View>

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Phone number
        </ThemedText>
        <TextInput
          placeholder="+233"
          placeholderTextColor={theme.textSecondary}
          keyboardType="phone-pad"
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />
      </View>

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Opening balance
        </ThemedText>
        <TextInput
          placeholder="₵0.00"
          placeholderTextColor={theme.textSecondary}
          keyboardType="decimal-pad"
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />
      </View>

      {/* TODO: submit handler — persist creditor once backend exists */}
      <AppButton label="Save creditor" onPress={() => router.back()} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contactsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  contactsText: {
    flex: 1,
    gap: 2,
  },
  contactsTitle: {
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 2,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    height: 52,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
});
