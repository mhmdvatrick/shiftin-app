import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { MapPin, Clock } from "phosphor-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Button, Card, EmptyState, JobCardSkeleton, StatusChip } from "@/src/components/ui";
import { SHIFT_STATUS_LABEL } from "@/src/constants";
import { rupiah, formatDate, timeRange, minutesToHours } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, fontSize, useTheme } from "@/src/theme";

const TABS = [
  { key: "upcoming", label: "Mendatang" },
  { key: "ongoing", label: "Berlangsung" },
  { key: "history", label: "Riwayat" },
];

function statusTone(status: string): "neutral" | "success" | "warning" | "info" | "error" {
  if (status === "checked_in") return "info";
  if (status === "completed") return "success";
  if (status === "checked_out") return "warning";
  if (status === "cancelled" || status === "no_show") return "error";
  return "neutral";
}

export default function MyShifts() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const [tab, setTab] = useState("upcoming");

  const q = useQuery<any[]>({
    queryKey: ["myshifts", tab],
    queryFn: () => api.get(`/applications/mine?tab=${tab}`),
  });

  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const renderItem = ({ item }: { item: any }) => {
    const job = item.job || {};
    return (
      <Card style={s.card} testID={`shift-${item.id}`}>
        <View style={s.rowBetween}>
          <Text style={s.title}>{job.title}</Text>
          <StatusChip label={SHIFT_STATUS_LABEL[item.status] ?? item.status} tone={statusTone(item.status)} />
        </View>
        <Text style={s.biz}>{job.business_name} • {job.skill_label}</Text>
        <View style={s.metaItem}>
          <Clock size={15} color={colors.muted} weight="fill" />
          <Text style={s.meta}>{job.date ? formatDate(job.date) : ""} • {timeRange(job.start_time, job.end_time)}</Text>
        </View>
        <View style={s.metaItem}>
          <MapPin size={15} color={colors.muted} weight="fill" />
          <Text style={s.meta}>{job.outlet_address}</Text>
        </View>

        {item.status === "completed" && item.wage_amount != null ? (
          <Text style={s.wage}>Upah: {rupiah(item.wage_amount)} • {minutesToHours(item.actual_minutes)}</Text>
        ) : null}

        {item.status === "taken" ? (
          <Button title="Mulai Presensi" testID={`attend-${item.id}`} onPress={() => router.push(`/attendance/${item.id}`)} />
        ) : item.status === "checked_in" ? (
          <Button title="Check-out" variant="secondary" testID={`checkout-${item.id}`} onPress={() => router.push(`/attendance/${item.id}`)} />
        ) : item.status === "completed" && !item.worker_rated ? (
          <Button title="Beri Nilai Bisnis" variant="secondary" testID={`rate-${item.id}`} onPress={() => router.push(`/rate/${item.id}`)} />
        ) : null}
      </Card>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.h1}>Shift Saya</Text>
        <View style={s.segment}>
          {TABS.map((t) => (
            <Text
              key={t.key}
              testID={`tab-${t.key}`}
              onPress={() => setTab(t.key)}
              style={[s.segText, tab === t.key && s.segActive]}
            >
              {t.label}
            </Text>
          ))}
        </View>
      </View>

      {q.isLoading ? (
        <View style={s.list}>
          <JobCardSkeleton />
          <JobCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={[s.list, { paddingBottom: bottomChrome + spacing.xl }]}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={
            <EmptyState
              testID="shifts-empty"
              title={tab === "upcoming" ? "Belum ada shift mendatang" : tab === "ongoing" ? "Tidak ada shift berlangsung" : "Belum ada riwayat"}
              subtitle="Ambil loker dari beranda untuk mulai bekerja"
            />
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  h1: { fontSize: fontSize["2xl"], fontWeight: "900", color: c.onSurface },
  segment: { flexDirection: "row", backgroundColor: c.surfaceTertiary, borderRadius: radius.pill, padding: 4 },
  segText: { flex: 1, textAlign: "center", paddingVertical: spacing.sm, borderRadius: radius.pill, color: c.onSurfaceTertiary, fontWeight: "700", fontSize: fontSize.base, overflow: "hidden" },
  segActive: { backgroundColor: c.brandPrimary, color: c.onBrandPrimary },
  list: { padding: spacing.lg, gap: spacing.md },
  card: { gap: spacing.sm },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  title: { flex: 1, fontSize: fontSize.lg, fontWeight: "800", color: c.onSurface },
  biz: { fontSize: fontSize.base, color: c.muted },
  metaItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  meta: { flex: 1, fontSize: fontSize.base, color: c.onSurfaceSecondary },
  wage: { fontSize: fontSize.base, fontWeight: "800", color: c.success },
}));
