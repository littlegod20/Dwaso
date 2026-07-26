import { router } from 'expo-router';

import { WelcomeSlide } from '@/components/onboarding/welcome-slide';

export default function OnboardingWelcomeScreen() {
  return (
    <WelcomeSlide
      icon="box"
      headline="Track your stock in seconds"
      subtext="Scan a product to log a sale or restock — no spreadsheets, no guesswork on what's running low."
      stepIndex={0}
      totalSteps={3}
      onSkip={() => router.push('/onboarding/business-setup')}
      onNext={() => router.push('/onboarding/value-2')}
    />
  );
}
