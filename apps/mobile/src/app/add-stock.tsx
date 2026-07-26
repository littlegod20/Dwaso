import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppButton } from '@/components/common/app-button';
import { Card } from '@/components/common/card';
import { IconBadge } from '@/components/common/icon-badge';
import { PageHeader } from '@/components/common/page-header';
import { ScreenContainer } from '@/components/common/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getProductById } from '@/mock-data/products';
import { getStatusMeta } from '@/utils/product-status';

// TODO: quantity/cost/supplier are static for now — wire up a real stepper +
// form state once this screen is connected to actual inventory data.
const QUANTITY_TO_ADD = 24;

export default function AddStockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const product = getProductById(id ?? '');

  if (!product) {
    return (
      <ScreenContainer>
        <PageHeader title="Add stock" />
        <ThemedText themeColor="textSecondary">Product not found.</ThemedText>
      </ScreenContainer>
    );
  }

  const status = getStatusMeta(product.status);
  const newStockLevel = product.quantity + QUANTITY_TO_ADD;

  return (
    <ScreenContainer>
      <PageHeader title="Add stock" />

      <View style={styles.identity}>
        <IconBadge icon="box" color={theme[status.variant]} backgroundColor={theme[`${status.variant}Bg`]} />
        <View style={styles.identityText}>
          <ThemedText type="default" style={styles.productName}>
            {product.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Current stock: {product.quantity} units
          </ThemedText>
        </View>
      </View>

      <View style={styles.stepperSection}>
        <ThemedText type="small" themeColor="textSecondary">
          Quantity to add
        </ThemedText>
        <View style={styles.stepperRow}>
          <Pressable style={[styles.stepperButton, { backgroundColor: theme.backgroundElement }]}>
            <Feather name="minus" size={20} color={theme.text} />
          </Pressable>
          <ThemedText type="title" style={styles.stepperValue}>
            {QUANTITY_TO_ADD}
          </ThemedText>
          <Pressable style={[styles.stepperButton, { backgroundColor: theme.primary }]}>
            <Feather name="plus" size={20} color={theme.primaryText} />
          </Pressable>
        </View>
      </View>

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Cost per unit (this restock)
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
          Supplier
        </ThemedText>
        {/* TODO: wire up supplier picker */}
        <Pressable style={[styles.input, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={styles.supplierText}>{product.supplier}</ThemedText>
          <Feather name="chevron-down" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>

      <Card borderColor={theme.primary} style={[styles.summaryCard, { backgroundColor: theme.warningBg }]}>
        <ThemedText type="default">New stock level</ThemedText>
        <ThemedText type="default" themeColor="primary" style={styles.summaryValue}>
          {newStockLevel} units
        </ThemedText>
      </Card>

      {/* TODO: submit handler — persist restock entry once backend exists */}
      <AppButton label={`Add ${QUANTITY_TO_ADD} units`} />
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
  supplierText: {
    flex: 1,
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
