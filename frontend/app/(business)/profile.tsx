import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { SignOut, SealCheck, Star, MapPin, Phone } from "phosphor-react-native";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { Avatar, Button, Card, RemoteImage } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, fontSize, useTheme } from "@/src/theme";

export default function BusinessProfile() {
  const { logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["profile"], queryFn: () => api.get("/profile") });
  const p = q.data;
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  async function onLogout() {
    await logout();
    router.replace("/welcome");
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.lg, paddingBottom: bottomChrome + spacing["3xl"] }]}>
      <View style={s.head}>
        {p?.outlet_photo_url ? <RemoteImage path={p.outlet_photo_url} style={s.avatar} /> : <Avatar name={p?.business_name} size={84} />}
        <View style={s.nameRow}>
          <Text style={s.name}>{p?.business_name ?? ""}</Text>
          {p?.verified ? <SealCheck size={20} color={colors.info} weight="fill" /> : null}
        </View>
        <Text style={s.type}>{p?.business_type}</Text>
        <View style={s.ratingRow}>
          <Star size={16} color={colors.brandPrimary} weight="fill" />
          <Text style={s.rating}>{(p?.rating_avg ?? 0).toFixed(1)}</Text>
          <Text style={s.ratingCount}>({p?.rating_count ?? 0} ulasan)</Text>
        </View>
      </View>

      <Card style={{ gap: spacing.md }}>
        <View style={s.row}>
          <MapPin size={18} color={colors.muted} weight="fill" />
          <Text style={s.rowValue}>{p?.address || "-"}</Text>
        </View>
        <View style={s.row}>
          <Phone size={18} color={colors.muted} weight="fill" />
          <Text style={s.rowValue}>{p?.pic_name} • {p?.pic_contact || "-"}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.rowLabel}>Email</Text>
          <Text style={[s.rowValue, { textAlign: "right", flex: 1 }]}>{p?.email}</Text>
        </View>
      </Card>

      <Button title="Keluar" variant="danger" icon={<SignOut size={18} color={colors.onError} weight="bold" />} onPress={onLogout} testID="logout-button" />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  head: { alignItems: "center", gap: spacing.xs },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  name: { fontSize: fontSize["2xl"], fontWeight: "900", color: c.onSurface },
  type: { fontSize: fontSize.base, color: c.muted },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  rating: { fontSize: fontSize.lg, fontWeight: "800", color: c.onSurface },
  ratingCount: { fontSize: fontSize.base, color: c.muted },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowLabel: { color: c.muted, fontSize: fontSize.base },
  rowValue: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "600", flexShrink: 1 },
}));
