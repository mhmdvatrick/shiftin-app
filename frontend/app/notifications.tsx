import { useRouter } from "expo-router";
import { ArrowLeft } from "phosphor-react-native";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NotificationsView } from "@/src/components/notifications-view";
import { makeStyles, spacing, fontSize, useTheme } from "@/src/theme";

export default function WorkerNotifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable testID="notif-back" onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={22} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={s.h1}>Notifikasi</Text>
        <View style={{ width: 40 }} />
      </View>
      <NotificationsView />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  h1: { fontSize: fontSize.xl, fontWeight: "800", color: c.onSurface },
}));
