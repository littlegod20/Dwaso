import { useMemo, useState } from 'react';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, View } from 'react-native';
import { Switch } from 'react-native-paper';
import type {
  MessageChannel,
  ReminderRule,
  ReminderScheduleView,
  ReminderTrigger,
} from '@dwaso/shared-types';

import { AlertBanner } from '@/components/common/alert-banner';
import { AppButton } from '@/components/common/app-button';
import { PageHeader } from '@/components/common/page-header';
import { ScreenContainer } from '@/components/common/screen-container';
import { SectionHeader } from '@/components/common/section-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiRequest } from '@/lib/api/client';
import { queryKeys } from '@/lib/queries/keys';

const CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp', recommended: true },
  { id: 'sms', label: 'SMS', recommended: false },
  { id: 'email', label: 'Email', recommended: false },
] as const satisfies readonly { id: MessageChannel; label: string; recommended: boolean }[];

/**
 * The rules a trader can choose from, each mapping to one trigger the reminder
 * worker understands. Offsets are fixed rather than free-form: "3 days before"
 * is a decision about tone, and letting someone set 47 days invites nonsense
 * without making anyone's collections better.
 */
const RULE_OPTIONS = [
  { id: 'before', label: '3 days before due', trigger: 'days_before_due', offsetDays: 3 },
  { id: 'on-due', label: 'On due date', trigger: 'on_due_date', offsetDays: 0 },
  { id: 'after', label: '7 days after due', trigger: 'days_after_due', offsetDays: 7 },
  { id: 'weekly', label: 'Weekly until paid', trigger: 'weekly_until_paid', offsetDays: 0 },
] as const satisfies readonly {
  id: string;
  label: string;
  trigger: ReminderTrigger;
  offsetDays: number;
}[];

type RuleId = (typeof RULE_OPTIONS)[number]['id'];

export default function ReminderScheduleScreen() {
  const { creditorId } = useLocalSearchParams<{ creditorId?: string }>();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const [scope, setScope] = useState<'customer' | 'global'>(creditorId ? 'customer' : 'global');
  const [channel, setChannel] = useState<MessageChannel>('whatsapp');
  const [active, setActive] = useState<RuleId[]>(['before', 'on-due']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);

  const { data: schedules } = useQuery({
    queryKey: queryKeys.reminderSchedules,
    queryFn: () => apiRequest<{ schedules: ReminderScheduleView[] }>('/reminders/schedules'),
    select: (data) => data.schedules,
  });

  const targetCreditorId = scope === 'customer' ? (creditorId ?? null) : null;

  const existing = useMemo(
    () => schedules?.find((schedule) => schedule.creditorId === targetCreditorId) ?? null,
    [schedules, targetCreditorId],
  );

  // Loading the saved schedule into local state once per scope, rather than on
  // every render, so switching tabs shows what is stored without discarding
  // edits mid-typing.
  const scopeKey = targetCreditorId ?? 'global';
  if (existing && loaded !== scopeKey) {
    setLoaded(scopeKey);
    setChannel(existing.channel);
    setActive(
      RULE_OPTIONS.filter((option) =>
        existing.rules.some(
          (rule) => rule.trigger === option.trigger && rule.offsetDays === option.offsetDays,
        ),
      ).map((option) => option.id),
    );
  }

  const toggle = (id: RuleId) =>
    setActive((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  const save = async () => {
    setSaving(true);
    setError(null);

    const rules: ReminderRule[] = RULE_OPTIONS.filter((option) => active.includes(option.id)).map(
      (option) => ({ trigger: option.trigger, offsetDays: option.offsetDays }),
    );

    try {
      await apiRequest('/reminders/schedules', {
        method: 'PUT',
        body: { id: existing?.id, creditorId: targetCreditorId, channel, rules, enabled: true },
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.reminderSchedules });
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <PageHeader title="Reminder schedule" />

      {creditorId ? (
        <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
          {(['customer', 'global'] as const).map((option) => (
            <Pressable
              key={option}
              onPress={() => setScope(option)}
              style={[styles.segment, scope === option ? { backgroundColor: theme.primary } : null]}
            >
              <ThemedText
                type="smallBold"
                style={scope === option ? { color: theme.primaryText } : undefined}
                themeColor={scope === option ? undefined : 'textSecondary'}
              >
                {option === 'customer' ? 'This customer' : 'Global default'}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Send via" />
        {CHANNELS.map((option) => {
          const selected = channel === option.id;

          return (
            <Pressable
              key={option.id}
              onPress={() => setChannel(option.id)}
              style={[
                styles.sendViaRow,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: selected ? theme.primary : theme.backgroundElement,
                },
              ]}
            >
              {option.id === 'whatsapp' ? (
                <Ionicons name="logo-whatsapp" size={20} color={theme.text} />
              ) : (
                <Feather
                  name={option.id === 'sms' ? 'message-square' : 'mail'}
                  size={20}
                  color={theme.text}
                />
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
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected ? theme.primary : 'transparent',
                  },
                ]}
              >
                {selected && <Feather name="check" size={14} color={theme.primaryText} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Timing rules" />
        {RULE_OPTIONS.map((option) => {
          const enabled = active.includes(option.id);

          return (
            <View
              key={option.id}
              style={[styles.timingRow, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText type="default" themeColor={enabled ? 'text' : 'textSecondary'}>
                {option.label}
              </ThemedText>
              <Switch
                value={enabled}
                onValueChange={() => toggle(option.id)}
                color={theme.primary}
              />
            </View>
          );
        })}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Every reminder names your business and tells the customer how to stop receiving them.
        Customers who opt out are skipped no matter what is set here.
      </ThemedText>

      {error ? (
        <AlertBanner icon="alert-circle" variant="danger" title="Not saved" subtitle={error} />
      ) : null}

      <AppButton
        label={saving ? 'Saving…' : 'Save schedule'}
        disabled={active.length === 0 || saving}
        onPress={save}
      />
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
});
