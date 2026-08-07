import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/common/app-button';
import { OnboardingNav } from '@/components/onboarding/onboarding-nav';
import { ProgressDots } from '@/components/onboarding/progress-dots';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type WelcomeSlideProps = {
  icon: keyof typeof Feather.glyphMap;
  headline: string;
  subtext: string;
  stepIndex: number;
  totalSteps: number;
  onBack?: () => void;
  onSkip: () => void;
  onNext: () => void;
  nextLabel?: string;
};

export function WelcomeSlide({
  icon,
  headline,
  subtext,
  stepIndex,
  totalSteps,
  onBack,
  onSkip,
  onNext,
  nextLabel = 'Next',
}: WelcomeSlideProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView
      style={[
        styles.container,
        { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.three },
      ]}
    >
      <OnboardingNav onBack={onBack} onSkip={onSkip} />

      <View style={styles.body}>
        <View style={[styles.iconCircle, { backgroundColor: theme.warningBg }]}>
          <Feather name={icon} size={40} color={theme.primary} />
        </View>
        <ThemedText type="title" style={styles.headline}>
          {headline}
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.subtext}>
          {subtext}
        </ThemedText>
      </View>

      <View style={styles.footer}>
        <ProgressDots total={totalSteps} activeIndex={stepIndex} />
        <AppButton label={nextLabel} onPress={onNext} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  headline: {
    fontSize: 26,
    lineHeight: 32,
    textAlign: 'center',
  },
  subtext: {
    textAlign: 'center',
  },
  footer: {
    gap: Spacing.four,
    paddingBottom: Spacing.two,
  },
});
