import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NotificationsView } from "@/src/components/notifications-view";
import { makeStyles, spacing, fontSize } from "@/src/theme";

export default function BusinessNotifications() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.h1}>Notifikasi</Text>
      </View>
      <NotificationsView />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  h1: { fontSize: fontSize["2xl"], fontWeight: "900", color: c.onSurface },
}));
