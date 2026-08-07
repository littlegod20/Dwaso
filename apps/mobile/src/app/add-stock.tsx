import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppButton } from '@/components/common/app-button';
import { Card } from '@/components/common/card';
import { IconBadge } from '@/components/common/icon-badge';
import { PageHeader } from '@/components/common/page-header';
import { ScreenContainer } from '@/components/common/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useProduct } from '@/lib/queries/products';
import { restock, useLocalMutation } from '@/lib/mutations';
import { useMoney } from '@/utils/format-currency';
import { getStatusMeta } from '@/utils/product-status';
import { CURRENCY_META } from '@dwaso/domain';

export default function AddStockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { currency, parse, toMajor } = useMoney();

  const { data: product } = useProduct(id);
  const [quantity, setQuantity] = useState(1);
  const [costText, setCostText] = useState<string | null>(null);

  const save = useLocalMutation(restock);

  if (!product) {
    return (
      <ScreenContainer>
        <PageHeader title="Add stock" />
        <ThemedText themeColor="textSecondary">Product not found.</ThemedText>
      </ScreenContainer>
    );
  }

  const status = getStatusMeta(product.status);

  // Defaults to the last known cost so the common case — restocking at the same
  // price — needs no typing at all.
  const costValue = costText ?? toMajor(product.costPriceMinor).toFixed(2);
  const unitCostMinor = parse(Number(costValue) || 0);

  const submit = () => {
    save.mutate(
      { productId: product.id, quantity, unitCostMinor },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <ScreenContainer>
      <PageHeader title="Add stock" />

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
            Current stock: {product.quantity} {product.unit}
          </ThemedText>
        </View>
      </View>

      <View style={styles.stepperSection}>
        <ThemedText type="small" themeColor="textSecondary">
          Quantity to add
        </ThemedText>
        <View style={styles.stepperRow}>
          <Pressable
            onPress={() => setQuantity((value) => Math.max(1, value - 1))}
            style={[styles.stepperButton, { backgroundColor: theme.backgroundElement }]}
          >
            <Feather name="minus" size={20} color={theme.text} />
          </Pressable>
          <ThemedText type="title" style={styles.stepperValue}>
            {quantity}
          </ThemedText>
          <Pressable
            onPress={() => setQuantity((value) => value + 1)}
            style={[styles.stepperButton, { backgroundColor: theme.primary }]}
          >
            <Feather name="plus" size={20} color={theme.primaryText} />
          </Pressable>
        </View>
      </View>

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Cost per unit (this restock)
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
        <ThemedText type="small" themeColor="textSecondary">
          Recording what you actually paid this time keeps your margin honest.
        </ThemedText>
      </View>

      <Card
        borderColor={theme.primary}
        style={[styles.summaryCard, { backgroundColor: theme.warningBg }]}
      >
        <ThemedText type="default">New stock level</ThemedText>
        <ThemedText type="default" themeColor="primary" style={styles.summaryValue}>
          {product.quantity + quantity} {product.unit}
        </ThemedText>
      </Card>

      <AppButton
        label={save.isPending ? 'Saving…' : `Add ${quantity} ${product.unit}`}
        disabled={save.isPending}
        onPress={submit}
      />
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
  stepperSection: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.five,
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 40,
    lineHeight: 46,
    minWidth: 72,
    textAlign: 'center',
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.one,
    height: 52,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryValue: {
    fontWeight: '700',
  },
});
