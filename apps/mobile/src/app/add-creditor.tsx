import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Contact } from 'expo-contacts';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AlertBanner } from '@/components/common/alert-banner';
import { AppButton } from '@/components/common/app-button';
import { IconBadge } from '@/components/common/icon-badge';
import { PageHeader } from '@/components/common/page-header';
import { ScreenContainer } from '@/components/common/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createCreditor, useLocalMutation } from '@/lib/mutations';
import { useMoney } from '@/utils/format-currency';
import { CURRENCY_META } from '@dwaso/domain';

export default function AddCreditorScreen() {
  const theme = useTheme();
  const { currency, parse } = useMoney();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [source, setSource] = useState<'manual' | 'contact_import'>('manual');
  const [error, setError] = useState<string | null>(null);

  const save = useLocalMutation(createCreditor);

  /**
   * Opens the system contact picker, which returns exactly the one person the
   * trader chose.
   *
   * This is deliberately not a bulk address-book import. A creditor is a third
   * party who never installed this app and never agreed to be in it, so
   * uploading hundreds of uninvolved contacts to justify adding one would be
   * collecting data because it was available rather than because it was needed.
   */
  const pickContact = async () => {
    try {
      const contact = await Contact.presentPicker();
      if (!contact) return;

      const [given, family, phones] = await Promise.all([
        contact.getGivenName(),
        contact.getFamilyName(),
        contact.getPhones(),
      ]);

      setName([given, family].filter(Boolean).join(' ').trim());
      setPhone(phones[0]?.number ?? '');
      setSource('contact_import');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open your contacts');
    }
  };

  const submit = () => {
    save.mutate(
      {
        name: name.trim(),
        phone: phone.trim() || null,
        openingBalanceMinor: openingBalance ? parse(Number(openingBalance) || 0) : undefined,
        source,
      },
      {
        onSuccess: () => router.back(),
        onError: (cause) =>
          setError(cause instanceof Error ? cause.message : 'Could not save this customer'),
      },
    );
  };

  return (
    <ScreenContainer>
      <PageHeader title="Add creditor" />

      <Pressable
        onPress={pickContact}
        style={[styles.contactsRow, { backgroundColor: theme.backgroundElement }]}
      >
        <IconBadge
          icon="user"
          color={theme.primary}
          backgroundColor={theme.warningBg}
          size={44}
          iconSize={20}
        />
        <View style={styles.contactsText}>
          <ThemedText type="default" style={styles.contactsTitle}>
            Pick from contacts
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Only the one person you choose is saved
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
          value={name}
          onChangeText={setName}
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
          value={phone}
          onChangeText={setPhone}
          placeholder="+233"
          placeholderTextColor={theme.textSecondary}
          keyboardType="phone-pad"
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Needed only if you want to send reminders. Every reminder names your business and tells
          them how to stop.
        </ThemedText>
      </View>

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Opening balance
        </ThemedText>
        <TextInput
          value={openingBalance}
          onChangeText={setOpeningBalance}
          placeholder={`${CURRENCY_META[currency].symbol}0.00`}
          placeholderTextColor={theme.textSecondary}
          keyboardType="decimal-pad"
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />
      </View>

      {error ? (
        <AlertBanner icon="alert-circle" variant="danger" title="Not saved" subtitle={error} />
      ) : null}

      <AppButton
        label={save.isPending ? 'Saving…' : 'Save creditor'}
        disabled={name.trim().length === 0 || save.isPending}
        onPress={submit}
      />
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
