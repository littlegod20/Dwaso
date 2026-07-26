import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type OnboardingNavProps = {
  onBack?: () => void;
  onSkip?: () => void;
};

export function OnboardingNav({ onBack, onSkip }: OnboardingNavProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12}>
          <Feather name="chevron-left" size={24} color={theme.text} />
        </Pressable>
      ) : (
        <View />
      )}
      {onSkip && (
        <Pressable onPress={onSkip} hitSlop={12}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Skip
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
