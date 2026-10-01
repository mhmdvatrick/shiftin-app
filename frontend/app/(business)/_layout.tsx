import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Briefcase, Star, Bell, User } from "phosphor-react-native";
import { Platform } from "react-native";

import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";

export default function BusinessLayout() {
  const { colors } = useTheme();

  if (usesNativeTabs) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="briefcase.fill" />
          <NativeTabs.Trigger.Label>Loker</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="favorites">
          <NativeTabs.Trigger.Icon sf="star.fill" />
          <NativeTabs.Trigger.Label>Favorit</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="notifications">
          <NativeTabs.Trigger.Icon sf="bell.fill" />
          <NativeTabs.Trigger.Label>Notif</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon sf="person.fill" />
          <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Loker", tabBarIcon: ({ color, focused }) => <Briefcase size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="favorites" options={{ title: "Favorit", tabBarIcon: ({ color, focused }) => <Star size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="notifications" options={{ title: "Notif", tabBarIcon: ({ color, focused }) => <Bell size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ color, focused }) => <User size={24} color={color} weight={focused ? "fill" : "regular"} /> }} />
    </Tabs>
  );
}
