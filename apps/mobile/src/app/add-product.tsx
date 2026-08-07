import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';

import { AlertBanner } from '@/components/common/alert-banner';
import { AppButton } from '@/components/common/app-button';
import { Card } from '@/components/common/card';
import { PageHeader } from '@/components/common/page-header';
import { ScreenContainer } from '@/components/common/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createProduct, useLocalMutation } from '@/lib/mutations';
import { useMoney } from '@/utils/format-currency';
import { CURRENCY_META, marginPercent } from '@dwaso/domain';

/**
 * Adding a product by hand, or finishing what a scan started.
 *
 * The scan flow routes here with the name, category and barcode it managed to
 * extract, so the trader confirms rather than types. That is the whole point of
 * the cascade: recognition should remove keystrokes, not add a screen.
 */
export default function AddProductScreen() {
  const params = useLocalSearchParams<{
    name?: string;
    category?: string;
    barcode?: string;
  }>();

  const theme = useTheme();
  const { currency, parse } = useMoney();

  const [name, setName] = useState(params.name ?? '');
  const [category, setCategory] = useState(params.category ?? '');
  const [cost, setCost] = useState('');
  const [sell, setSell] = useState('');
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useLocalMutation(createProduct);

  const costPriceMinor = parse(Number(cost) || 0);
  const sellPriceMinor = parse(Number(sell) || 0);

  const submit = () => {
    save.mutate(
      {
        name: name.trim(),
        category: category.trim() || null,
        costPriceMinor,
        sellPriceMinor,
        openingQuantity: Number(quantity) || 0,
        barcode: params.barcode ?? null,
      },
      {
        onSuccess: (productId) =>
          router.replace({ pathname: '/product/[id]', params: { id: productId } }),
        onError: (cause) =>
          setError(cause instanceof Error ? cause.message : 'Could not save this product'),
      },
    );
  };

  const field = (
    label: string,
    value: string,
    onChangeText: (next: string) => void,
    options: { placeholder?: string; money?: boolean; numeric?: boolean; autoFocus?: boolean } = {},
  ) => (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={[styles.input, { backgroundColor: theme.backgroundElement }]}>
        {options.money ? (
          <ThemedText themeColor="textSecondary">{CURRENCY_META[currency].symbol}</ThemedText>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={options.placeholder}
          placeholderTextColor={theme.textSecondary}
          keyboardType={options.money || options.numeric ? 'decimal-pad' : 'default'}
          autoFocus={options.autoFocus}
          style={[styles.inputText, { color: theme.text }]}
        />
      </View>
    </View>
  );

  return (
    <ScreenContainer>
      <PageHeader title="Add product" />

      {params.barcode ? (
        <AlertBanner
          icon="maximize"
          variant="warning"
          title="Barcode captured"
          subtitle={`${params.barcode} — the next scan of this item will be instant.`}
        />
      ) : null}

      {field('Product name', name, setName, {
        placeholder: 'e.g. Rice 50kg bag',
        autoFocus: !params.name,
      })}
      {field('Category', category, setCategory, { placeholder: 'e.g. Grains' })}
      {field('Cost price', cost, setCost, { placeholder: '0.00', money: true })}
      {field('Sell price', sell, setSell, { placeholder: '0.00', money: true })}
      {field('Opening stock', quantity, setQuantity, { placeholder: '0', numeric: true })}

      {sellPriceMinor > 0 ? (
        <Card
          borderColor={theme.primary}
          style={[styles.marginCard, { backgroundColor: theme.warningBg }]}
        >
          <ThemedText type="default">Margin</ThemedText>
          <ThemedText type="default" themeColor="primary" style={styles.marginValue}>
            {marginPercent(sellPriceMinor, costPriceMinor)}%
          </ThemedText>
        </Card>
      ) : null}

      {error ? (
        <AlertBanner icon="alert-circle" variant="danger" title="Not saved" subtitle={error} />
      ) : null}

      <AppButton
        label={save.isPending ? 'Saving…' : 'Save product'}
        disabled={name.trim().length === 0 || sellPriceMinor <= 0 || save.isPending}
        onPress={submit}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  inputText: {
    flex: 1,
    fontSize: 16,
  },
  marginCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  marginValue: {
    fontWeight: '700',
  },
});
