import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Switch } from 'react-native-paper';

import { AppButton } from '@/components/common/app-button';
import { PageHeader } from '@/components/common/page-header';
import { ScreenContainer } from '@/components/common/screen-container';
import { SectionHeader } from '@/components/common/section-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// TODO: scope-toggle, channel selection, and timing rules are static for now —
// wire up real form state once this screen is connected to actual data.
const SEND_VIA_OPTIONS = [
  { id: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp', recommended: true, selected: true },
  { id: 'email', label: 'Email', icon: 'mail', recommended: false, selected: false },
  { id: 'sms', label: 'SMS', icon: 'message-square', recommended: false, selected: false },
] as const;

const TIMING_RULES = [
  { id: 'before', label: '3 days before due', enabled: true },
  { id: 'on-due', label: 'On due date', enabled: true },
  { id: 'weekly', label: 'Weekly until paid', enabled: false },
] as const;

export default function ReminderScheduleScreen() {
  const theme = useTheme();

  return (
    <ScreenContainer>
      <PageHeader title="Reminder schedule" />

      <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.segment, { backgroundColor: theme.primary }]}>
          <ThemedText type="smallBold" style={{ color: theme.primaryText }}>
            This customer
          </ThemedText>
        </View>
        <View style={styles.segment}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Global default
          </ThemedText>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Send via" />
        {SEND_VIA_OPTIONS.map((option) => (
          <View
            key={option.id}
            style={[
              styles.sendViaRow,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: option.selected ? theme.primary : theme.backgroundElement,
              },
            ]}>
            {option.icon === 'whatsapp' ? (
              <Ionicons name="logo-whatsapp" size={20} color={theme.text} />
            ) : (
              <Feather name={option.icon} size={20} color={theme.text} />
            )}
            <ThemedText type="default" style={styles.sendViaLabel}>
              {option.label}
            </ThemedText>
            {option.recommended && (
              <View style={[styles.recommendedPill, { backgroundColor: theme.warningBg }]}>
                <ThemedText type="small" themeColor="warning">
                  Recommended
                </ThemedText>
              </View>
            )}
            <View
              style={[
                styles.radio,
                {
                  borderColor: option.selected ? theme.primary : theme.border,
                  backgroundColor: option.selected ? theme.primary : 'transparent',
                },
              ]}>
              {option.selected && <Feather name="check" size={14} color={theme.primaryText} />}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Timing rules" />
        {TIMING_RULES.map((rule) => (
          <View
            key={rule.id}
            style={[styles.timingRow, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="default" themeColor={rule.enabled ? 'text' : 'textSecondary'}>
              {rule.label}
            </ThemedText>
            <Switch value={rule.enabled} color={theme.primary} />
          </View>
        ))}
        {/* TODO: wire up adding custom timing rules */}
        <Pressable style={styles.addRule}>
          <Feather name="plus" size={16} color={theme.primary} />
          <ThemedText type="smallBold" themeColor="primary">
            Add rule
          </ThemedText>
        </Pressable>
      </View>

      {/* TODO: submit handler — persist reminder schedule once backend exists */}
      <AppButton label="Save schedule" onPress={() => router.back()} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    borderRadius: Spacing.three,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  sendViaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.three,
  },
  sendViaLabel: {
    fontWeight: '700',
    flex: 1,
  },
  recommendedPill: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.five,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  addRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
  },
});
