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
import { getProductById } from '@/mock-data/products';
import { calculateMargin } from '@/utils/margin';
import { formatCurrency } from '@/utils/format-currency';
import { getStatusMeta } from '@/utils/product-status';

export default function EditPriceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const product = getProductById(id ?? '');

  if (!product) {
    return (
      <ScreenContainer>
        <PageHeader title="Edit price" />
        <ThemedText themeColor="textSecondary">Product not found.</ThemedText>
      </ScreenContainer>
    );
  }

  const status = getStatusMeta(product.status);
  const margin = calculateMargin(product.costPrice, product.sellPrice);

  return (
    <ScreenContainer>
      {/* TODO: wire up save handler once persistence exists */}
      <PageHeader title="Edit price" rightLabel="Save" onRightLabelPress={() => router.back()} />

      <View style={styles.identity}>
        <IconBadge icon="box" color={theme[status.variant]} backgroundColor={theme[`${status.variant}Bg`]} />
        <View style={styles.identityText}>
          <ThemedText type="default" style={styles.productName}>
            {product.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {product.category} · SKU {product.sku}
          </ThemedText>
        </View>
      </View>

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Cost price
        </ThemedText>
        <View style={[styles.input, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText themeColor="textSecondary">₵</ThemedText>
          <TextInput
            defaultValue={product.costPrice.toFixed(2)}
            keyboardType="decimal-pad"
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
          <ThemedText themeColor="primary">₵</ThemedText>
          <TextInput
            defaultValue={product.sellPrice.toFixed(2)}
            keyboardType="decimal-pad"
            style={[styles.inputText, { color: theme.primary }]}
          />
          <Feather name="edit-2" size={16} color={theme.primary} />
        </View>
        {product.lastPriceChange && (
          <ThemedText type="small" themeColor="textSecondary">
            Was {formatCurrency(product.lastPriceChange.from)} · changed {product.lastPriceChange.date}
          </ThemedText>
        )}
      </View>

      <Card borderColor={theme.primary} style={[styles.marginCard, { backgroundColor: theme.warningBg }]}>
        <ThemedText type="default">New margin</ThemedText>
        <ThemedText type="default" themeColor="primary" style={styles.marginValue}>
          {margin}%
        </ThemedText>
      </Card>

      {/* TODO: submit handler — persist price change once backend exists */}
      <AppButton label="Save price" onPress={() => router.back()} />
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
  discard: {
    textAlign: 'center',
  },
});
