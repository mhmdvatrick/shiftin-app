import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { SignOut, SealCheck, Star } from "phosphor-react-native";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { Avatar, Button, Card, RemoteImage, Skeleton } from "@/src/components/ui";
import { skillLabel } from "@/src/constants";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, fontSize, useTheme } from "@/src/theme";

export default function WorkerProfile() {
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
    <ScrollView style={[s.container]} contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.lg, paddingBottom: bottomChrome + spacing["3xl"] }]}>
      <View style={s.head}>
        {p?.photo_url ? (
          <RemoteImage path={p.photo_url} style={s.avatar} />
        ) : (
          <Avatar name={p?.name} size={84} />
        )}
        <View style={s.nameRow}>
          <Text style={s.name}>{p?.name ?? ""}</Text>
          {p?.verified ? <SealCheck size={20} color={colors.info} weight="fill" /> : null}
        </View>
        <View style={s.ratingRow}>
          <Star size={16} color={colors.brandPrimary} weight="fill" />
          <Text style={s.rating}>{(p?.rating_avg ?? 0).toFixed(1)}</Text>
          <Text style={s.ratingCount}>({p?.rating_count ?? 0} ulasan)</Text>
        </View>
      </View>

      {q.isLoading ? (
        <Skeleton height={90} radius={radius.lg} />
      ) : (
        <View style={s.statRow}>
          <Stat label="Shift Selesai" value={String(p?.shifts_completed ?? 0)} />
          <Stat label="Kehadiran" value={`${p?.attendance_rate ?? 100}%`} />
          <Stat label="Keandalan" value={`${p?.reliability_score ?? 100}%`} />
        </View>
      )}

      <Card style={{ gap: spacing.sm }}>
        <Text style={s.cardLabel}>Skill</Text>
        <View style={s.chips}>
          {(p?.skills ?? []).map((sk: string) => (
            <View key={sk} style={s.skillChip}>
              <Text style={s.skillChipText}>{skillLabel(sk)}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Row label="Email" value={p?.email} />
        <Row label="No. HP" value={p?.phone || "-"} />
        <Row label="E-wallet / Rekening" value={p?.ewallet_number || "-"} />
        <Row label="Domisili" value={p?.domicile_address || "-"} />
      </Card>

      <Button title="Keluar" variant="danger" icon={<SignOut size={18} color={colors.onError} weight="bold" />} onPress={onLogout} testID="logout-button" />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const s = useStyles();
  return (
    <View style={s.stat}>
      <Text style={s.statVal}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  const s = useStyles();
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  head: { alignItems: "center", gap: spacing.xs },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  name: { fontSize: fontSize["2xl"], fontWeight: "900", color: c.onSurface },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  rating: { fontSize: fontSize.lg, fontWeight: "800", color: c.onSurface },
  ratingCount: { fontSize: fontSize.base, color: c.muted },
  statRow: { flexDirection: "row", gap: spacing.md },
  stat: { flex: 1, backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center", gap: spacing.xs, borderWidth: 1, borderColor: c.border },
  statVal: { fontSize: fontSize.xl, fontWeight: "900", color: c.brandPrimary },
  statLabel: { fontSize: fontSize.sm, color: c.muted, textAlign: "center" },
  cardLabel: { fontSize: fontSize.base, fontWeight: "800", color: c.onSurface },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  skillChip: { backgroundColor: c.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  skillChipText: { color: c.onBrandTertiary, fontWeight: "700", fontSize: fontSize.sm },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, paddingVertical: 4 },
  rowLabel: { color: c.muted, fontSize: fontSize.base },
  rowValue: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "600", flexShrink: 1, textAlign: "right" },
}));
