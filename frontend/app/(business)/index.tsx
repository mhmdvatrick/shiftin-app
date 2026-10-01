import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Plus, Users, Clock } from "phosphor-react-native";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Card, EmptyState, JobCardSkeleton, StatusChip } from "@/src/components/ui";
import { rupiah, formatShortDate, timeRange } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, fontSize, useTheme } from "@/src/theme";

const TABS = [
  { key: "active", label: "Aktif" },
  { key: "ongoing", label: "Berjalan" },
  { key: "completed", label: "Selesai" },
];

function jobTone(status: string): "neutral" | "success" | "warning" | "info" | "error" {
  if (status === "open") return "info";
  if (status === "filled") return "success";
  if (status === "ongoing") return "warning";
  if (status === "cancelled") return "error";
  return "neutral";
}
const JOB_STATUS_LABEL: Record<string, string> = {
  open: "Mencari Pekerja", filled: "Terisi Penuh", ongoing: "Berlangsung", completed: "Selesai", cancelled: "Dibatalkan",
};

export default function BusinessDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const [tab, setTab] = useState("active");

  const q = useQuery<any[]>({ queryKey: ["bizjobs", tab], queryFn: () => api.get(`/jobs/business?tab=${tab}`) });
  const fabBottom = (usesNativeTabs ? insets.bottom : 0) + spacing.lg;

  const renderItem = ({ item }: { item: any }) => (
    <Card testID={`bizjob-${item.id}`} onPress={() => router.push(`/business-job/${item.id}`)} style={s.card}>
      <View style={s.rowBetween}>
        <Text style={s.title}>{item.title}</Text>
        <StatusChip label={JOB_STATUS_LABEL[item.status] ?? item.status} tone={jobTone(item.status)} />
      </View>
      <Text style={s.skill}>{item.skill_label} • {rupiah(item.hourly_rate)}/jam</Text>
      <View style={s.metaItem}>
        <Clock size={15} color={colors.muted} weight="fill" />
        <Text style={s.meta}>{formatShortDate(item.date)} • {timeRange(item.start_time, item.end_time)}</Text>
      </View>
      <View style={s.footer}>
        <View style={s.fill}>
          <Users size={16} color={colors.brandPrimary} weight="fill" />
          <Text style={s.fillText}>{item.slots_filled}/{item.workers_needed} pekerja</Text>
        </View>
        {item.checked_in_count > 0 ? <StatusChip label={`${item.checked_in_count} sedang bekerja`} tone="info" /> : null}
      </View>
    </Card>
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.h1}>Loker Saya</Text>
        <View style={s.segment}>
          {TABS.map((t) => (
            <Text key={t.key} testID={`biztab-${t.key}`} onPress={() => setTab(t.key)} style={[s.segText, tab === t.key && s.segActive]}>
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
          contentContainerStyle={[s.list, { paddingBottom: fabBottom + 80 }]}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={
            <EmptyState
              testID="bizjobs-empty"
              title={tab === "active" ? "Belum ada loker aktif" : tab === "ongoing" ? "Tidak ada yang berjalan" : "Belum ada loker selesai"}
              subtitle="Buat loker pertamamu untuk mulai mencari pekerja"
              actionLabel="Buat Loker"
              onAction={() => router.push("/create-job")}
            />
          }
        />
      )}

      <Pressable testID="create-job-fab" style={[s.fab, { bottom: fabBottom }]} onPress={() => router.push("/create-job")}>
        <Plus size={22} color={colors.onBrandPrimary} weight="bold" />
        <Text style={s.fabText}>Buat Loker</Text>
      </Pressable>
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
  skill: { fontSize: fontSize.base, color: c.muted },
  metaItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  meta: { fontSize: fontSize.base, color: c.onSurfaceSecondary },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: c.border, paddingTop: spacing.sm },
  fill: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  fillText: { fontSize: fontSize.base, fontWeight: "700", color: c.onSurface },
  fab: { position: "absolute", right: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.brandPrimary, paddingHorizontal: spacing.xl, height: 56, borderRadius: radius.pill },
  fabText: { color: c.onBrandPrimary, fontWeight: "800", fontSize: fontSize.lg },
}));
