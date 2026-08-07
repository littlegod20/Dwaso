import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppButton } from '@/components/common/app-button';
import { Card } from '@/components/common/card';
import { IconBadge } from '@/components/common/icon-badge';
import { PageHeader } from '@/components/common/page-header';
import { ScreenContainer } from '@/components/common/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePriceHistory, useProduct } from '@/lib/queries/products';
import { updatePrice, useLocalMutation } from '@/lib/mutations';
import { useMoney } from '@/utils/format-currency';
import { getStatusMeta } from '@/utils/product-status';
import { relativeTime } from '@/utils/relative-time';
import { CURRENCY_META, marginPercent } from '@dwaso/domain';

export default function EditPriceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { currency, format, parse, toMajor } = useMoney();

  const { data: product } = useProduct(id);
  const { data: priceHistory = [] } = usePriceHistory(id);

  const [costText, setCostText] = useState<string | null>(null);
  const [sellText, setSellText] = useState<string | null>(null);

  const save = useLocalMutation(updatePrice);

  if (!product) {
    return (
      <ScreenContainer>
        <PageHeader title="Edit price" />
        <ThemedText themeColor="textSecondary">Product not found.</ThemedText>
      </ScreenContainer>
    );
  }

  const status = getStatusMeta(product.status);
  const costValue = costText ?? toMajor(product.costPriceMinor).toFixed(2);
  const sellValue = sellText ?? toMajor(product.sellPriceMinor).toFixed(2);

  const costPriceMinor = parse(Number(costValue) || 0);
  const sellPriceMinor = parse(Number(sellValue) || 0);

  const lastChange = priceHistory[priceHistory.length - 1];
  const dirty =
    costPriceMinor !== product.costPriceMinor || sellPriceMinor !== product.sellPriceMinor;

  const submit = () => {
    save.mutate(
      { productId: product.id, costPriceMinor, sellPriceMinor },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <ScreenContainer>
      <PageHeader title="Edit price" />

      <View style={styles.identity}>
        <IconBadge
          icon="box"
          color={theme[status.variant]}
          backgroundColor={theme[`${status.variant}Bg`]}
        />
        <View style={styles.identityText}>
          <ThemedText type="default" style={styles.productName}>
            {product.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {[product.category, product.sku ? `SKU ${product.sku}` : null]
              .filter(Boolean)
              .join(' · ') || 'No category set'}
          </ThemedText>
        </View>
      </View>

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Cost price
        </ThemedText>
        <View style={[styles.input, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText themeColor="textSecondary">{CURRENCY_META[currency].symbol}</ThemedText>
          <TextInput
            value={costValue}
            onChangeText={setCostText}
            keyboardType="decimal-pad"
            selectTextOnFocus
            style={[styles.inputText, { color: theme.text }]}
          />
        </View>
      </View>

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Sell price
        </ThemedText>
        <View
          style={[
            styles.input,
            styles.inputActive,
            { backgroundColor: theme.backgroundElement, borderColor: theme.primary },
          ]}>
          <ThemedText themeColor="primary">{CURRENCY_META[currency].symbol}</ThemedText>
          <TextInput
            value={sellValue}
            onChangeText={setSellText}
            keyboardType="decimal-pad"
            selectTextOnFocus
            style={[styles.inputText, { color: theme.primary }]}
          />
          <Feather name="edit-2" size={16} color={theme.primary} />
        </View>
        {lastChange ? (
          <ThemedText type="small" themeColor="textSecondary">
            Was {format(lastChange.fromSellMinor ?? 0)} · changed{' '}
            {relativeTime(lastChange.occurredAt).toLowerCase()}
          </ThemedText>
        ) : null}
      </View>

      <Card
        borderColor={theme.primary}
        style={[styles.marginCard, { backgroundColor: theme.warningBg }]}>
        <ThemedText type="default">New margin</ThemedText>
        <ThemedText type="default" themeColor="primary" style={styles.marginValue}>
          {marginPercent(sellPriceMinor, costPriceMinor)}%
        </ThemedText>
      </Card>

      {/* Past sales keep the cost they were made at, so changing a price here
          cannot rewrite margins the trader has already banked. */}
      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        Sales you have already recorded keep their original prices.
      </ThemedText>

      <AppButton
        label={save.isPending ? 'Saving…' : 'Save price'}
        disabled={!dirty || save.isPending}
        onPress={submit}
      />
      <ThemedText
        type="smallBold"
        themeColor="textSecondary"
        style={styles.discard}
        onPress={() => router.back()}>
        Discard changes
      </ThemedText>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  identityText: {
    flex: 1,
    gap: Spacing.half,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 17,
    fontWeight: '700',
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    height: 52,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  inputActive: {
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  marginCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  marginValue: {
    fontWeight: '700',
  },
  note: {
    textAlign: 'center',
  },
  discard: {
    textAlign: 'center',
  },
});
