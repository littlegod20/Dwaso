import { router } from 'expo-router';

import { WelcomeSlide } from '@/components/onboarding/welcome-slide';

export default function OnboardingValue3Screen() {
  return (
    <WelcomeSlide
      icon="bar-chart-2"
      headline="See your numbers clearly"
      subtext="Know your daily profit, margin, and what's actually selling — without doing the math yourself."
      stepIndex={2}
      totalSteps={3}
      onBack={() => router.back()}
      onSkip={() => router.push('/onboarding/business-setup')}
      onNext={() => router.push('/onboarding/permissions')}
      nextLabel="Continue"
    />
  );
}
