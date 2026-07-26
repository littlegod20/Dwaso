import { Feather } from '@expo/vector-icons';

import { Card } from '@/components/common/card';
import { IconBadge } from '@/components/common/icon-badge';
import { ListRow } from '@/components/common/list-row';
import { useTheme } from '@/hooks/use-theme';

type AlertBannerProps = {
  icon: keyof typeof Feather.glyphMap;
  variant: 'warning' | 'danger';
  title: string;
  subtitle: string;
  onPress?: () => void;
};

export function AlertBanner({ icon, variant, title, subtitle, onPress }: AlertBannerProps) {
  const theme = useTheme();
  const colors = variant === 'warning'
    ? { bg: theme.warningBg, fg: theme.warning }
    : { bg: theme.dangerBg, fg: theme.danger };

  return (
    <Card onPress={onPress} borderColor={colors.bg}>
      <ListRow
        leading={<IconBadge icon={icon} color={colors.fg} backgroundColor={colors.bg} size={44} iconSize={20} />}
        title={title}
        subtitle={subtitle}
        showChevron={!!onPress}
      />
    </Card>
  );
}
