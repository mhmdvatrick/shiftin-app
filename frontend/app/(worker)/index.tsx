import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Bell, MapPin, Clock, CurrencyDollar } from "phosphor-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, ScrollView, Switch, Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { Card, Chip, EmptyState, ErrorView, JobCardSkeleton, StatusChip } from "@/src/components/ui";
import { SKILLS } from "@/src/constants";
import { rupiah, distanceLabel, formatShortDate, timeRange } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, fontSize, useTheme } from "@/src/theme";

type Job = {
  id: string;
  title: string;
  skill_label: string;
  business_name: string;
  outlet_address: string;
  date: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  estimated_total: number;
  distance_m: number;
  slots_filled: number;
  workers_needed: number;
};

export default function WorkerFeed() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();

  const [skill, setSkill] = useState<string | null>(null);

  const jobsQ = useQuery<Job[]>({
    queryKey: ["nearby", skill],
    queryFn: () => api.get(`/jobs/nearby${skill ? `?skill=${skill}` : ""}`),
  });
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => api.get("/profile") });
  const unreadQ = useQuery({ queryKey: ["unread"], queryFn: () => api.get("/notifications/unread-count") });

  const readyMut = useMutation({
    mutationFn: (v: boolean) => api.put("/profile/ready", { ready_to_work: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });

  const ready = profileQ.data?.ready_to_work ?? false;
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const renderCard = ({ item }: { item: Job }) => {
    const full = item.slots_filled >= item.workers_needed;
    return (
      <Card testID={`job-card-${item.id}`} onPress={() => router.push(`/job/${item.id}`)} style={s.card}>
        <View style={s.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{item.title}</Text>
            <Text style={s.cardBiz}>{item.business_name}</Text>
          </View>
          <View style={s.skillChip}>
            <Text style={s.skillChipText}>{item.skill_label}</Text>
          </View>
        </View>

        <View style={s.metaRow}>
          <View style={s.metaItem}>
            <MapPin size={15} color={colors.muted} weight="fill" />
            <Text style={s.metaText}>{distanceLabel(item.distance_m)}</Text>
          </View>
          <View style={s.metaItem}>
            <Clock size={15} color={colors.muted} weight="fill" />
            <Text style={s.metaText}>{formatShortDate(item.date)} • {timeRange(item.start_time, item.end_time)}</Text>
          </View>
        </View>

        <View style={s.cardFooter}>
          <View>
            <Text style={s.rate}>{rupiah(item.hourly_rate)}<Text style={s.rateUnit}>/jam</Text></Text>
            <Text style={s.estLabel}>Estimasi {rupiah(item.estimated_total)}</Text>
          </View>
          <StatusChip
            label={full ? "Penuh" : `${item.slots_filled}/${item.workers_needed} terisi`}
            tone={full ? "neutral" : "success"}
          />
        </View>
      </Card>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* sticky top chrome */}
      <View style={s.topChrome}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.hi}>Halo, {user?.name?.split(" ")[0] ?? "Pekerja"} 👋</Text>
            <Text style={s.sub}>Loker terdekat di Jogja</Text>
          </View>
          <Pressable testID="feed-bell" style={s.bellWrap} onPress={() => router.push("/notifications")}>
            <Bell size={24} color={colors.onSurface} weight="regular" />
            {(unreadQ.data?.count ?? 0) > 0 ? <View style={s.badge}><Text style={s.badgeText}>{unreadQ.data.count}</Text></View> : null}
          </Pressable>
        </View>

        <View style={s.readyCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.readyTitle}>Status: {ready ? "Siap Kerja" : "Tidak Aktif"}</Text>
            <Text style={s.readySub}>Aktifkan untuk menerima tawaran shift</Text>
          </View>
          <Switch
            testID="ready-toggle"
            value={ready}
            onValueChange={(v) => readyMut.mutate(v)}
            trackColor={{ true: colors.brandPrimary, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipRow}
          style={s.chipScroll}
        >
          <Chip label="Semua" selected={skill === null} onPress={() => setSkill(null)} testID="filter-all" />
          {SKILLS.map((sk) => (
            <Chip key={sk.value} label={sk.label} selected={skill === sk.value} onPress={() => setSkill(sk.value)} testID={`filter-${sk.value}`} />
          ))}
        </ScrollView>
      </View>

      {jobsQ.isLoading ? (
        <View style={s.list}>
          <JobCardSkeleton />
          <JobCardSkeleton />
          <JobCardSkeleton />
        </View>
      ) : jobsQ.isError ? (
        <ErrorView message="Gagal memuat loker" onRetry={() => jobsQ.refetch()} />
      ) : (
        <FlatList
          data={jobsQ.data}
          keyExtractor={(j) => j.id}
          renderItem={renderCard}
          contentContainerStyle={[s.list, { paddingBottom: bottomChrome + spacing.xl }]}
          refreshControl={
            <RefreshControl refreshing={jobsQ.isRefetching} onRefresh={() => jobsQ.refetch()} tintColor={colors.brandPrimary} />
          }
          ListEmptyComponent={
            <EmptyState
              testID="feed-empty"
              title="Belum ada loker di sekitarmu"
              subtitle="Tarik ke bawah untuk menyegarkan atau ubah filter skill"
              actionLabel="Segarkan"
              onAction={() => jobsQ.refetch()}
            />
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  topChrome: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.sm, backgroundColor: c.surface },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  hi: { fontSize: fontSize["2xl"], fontWeight: "900", color: c.onSurface },
  sub: { fontSize: fontSize.base, color: c.muted },
  bellWrap: { padding: spacing.xs },
  badge: { position: "absolute", top: 0, right: 0, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: c.onError, fontSize: 10, fontWeight: "800" },
  readyCard: { flexDirection: "row", alignItems: "center", backgroundColor: c.brandTertiary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  readyTitle: { fontSize: fontSize.lg, fontWeight: "800", color: c.onBrandTertiary },
  readySub: { fontSize: fontSize.sm, color: c.onBrandTertiary, opacity: 0.8 },
  chipScroll: { marginHorizontal: -spacing.lg },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  card: { gap: spacing.md },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  cardTitle: { fontSize: fontSize.lg, fontWeight: "800", color: c.onSurface },
  cardBiz: { fontSize: fontSize.base, color: c.muted, marginTop: 2 },
  skillChip: { backgroundColor: c.brandSecondary, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  skillChipText: { color: c.onBrandSecondary, fontSize: fontSize.sm, fontWeight: "700" },
  metaRow: { gap: spacing.xs },
  metaItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaText: { fontSize: fontSize.base, color: c.onSurfaceSecondary },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: c.border, paddingTop: spacing.md },
  rate: { fontSize: fontSize.xl, fontWeight: "900", color: c.brandPrimary },
  rateUnit: { fontSize: fontSize.sm, fontWeight: "600", color: c.muted },
  estLabel: { fontSize: fontSize.sm, color: c.muted },
}));
