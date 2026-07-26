import { Tabs, TabList, TabSlot, TabTrigger } from 'expo-router/ui';

import { AppTabBar, TabButton } from '@/components/navigation/app-tab-bar';

export default function TabsLayout() {
  return (
    <Tabs>
      <TabSlot />
      <TabList asChild>
        <AppTabBar>
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon="home" label="Home" />
          </TabTrigger>
          <TabTrigger name="inventory" href="/inventory" asChild>
            <TabButton icon="box" label="Inventory" />
          </TabTrigger>
          <TabTrigger name="creditors" href="/creditors" asChild>
            <TabButton icon="users" label="Creditors" />
          </TabTrigger>
          <TabTrigger name="reports" href="/reports" asChild>
            <TabButton icon="bar-chart-2" label="Reports" />
          </TabTrigger>
        </AppTabBar>
      </TabList>
    </Tabs>
  );
}
