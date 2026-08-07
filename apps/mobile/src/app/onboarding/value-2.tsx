import { router } from 'expo-router';

import { WelcomeSlide } from '@/components/onboarding/welcome-slide';

export default function OnboardingValue2Screen() {
  return (
    <WelcomeSlide
      icon="users"
      headline="Never lose track of who owes you"
      subtext="Record credit sales, see who's overdue at a glance, and send reminders without digging through notebooks."
      stepIndex={1}
      totalSteps={3}
      onBack={() => router.back()}
      onSkip={() => router.push('/onboarding/sign-in')}
      onNext={() => router.push('/onboarding/value-3')}
    />
  );
}
