import { PageHeader } from '@/components/common/page-header';
import { ScreenContainer } from '@/components/common/screen-container';
import { ThemedText } from '@/components/themed-text';

type PlaceholderScreenProps = {
  title: string;
  /** Tab-root screens show a plain heading; pushed stack screens show a back button. */
  showBack?: boolean;
};

export function PlaceholderScreen({ title, showBack = false }: PlaceholderScreenProps) {
  return (
    <ScreenContainer>
      {showBack ? <PageHeader title={title} /> : <ThemedText type="subtitle">{title}</ThemedText>}
      <ThemedText type="default" themeColor="textSecondary">
        This screen is coming up next — reach out once you&apos;re ready to review it.
      </ThemedText>
    </ScreenContainer>
  );
}
