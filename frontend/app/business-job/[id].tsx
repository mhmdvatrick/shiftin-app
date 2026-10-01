import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Star, MapPin, Clock } from "phosphor-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useToast } from "@/src/components/toast";
import { Avatar, Button, Card, EmptyState, Skeleton, StatusChip } from "@/src/components/ui";
import { rupiah, distanceLabel, formatDate, timeRange, minutesToHours } from "@/src/format";
import { makeStyles, radius, spacing, fontSize, useTheme } from "@/src/theme";

const APP_STATUS: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "info" | "error" }> = {
  taken: { label: "Belum Hadir", tone: "neutral" },
  checked_in: { label: "Sedang Bekerja", tone: "info" },
  checked_out: { label: "Perlu Konfirmasi", tone: "warning" },
  completed: { label: "Selesai", tone: "success" },
  cancelled: { label: "Dibatalkan", tone: "error" },
  no_show: { label: "Tidak Hadir", tone: "error" },
};

export default function BusinessJobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["jobapps", id], queryFn: () => api.get(`/jobs/${id}/applications`) });
  const favQ = useQuery<any[]>({ queryKey: ["favorites"], queryFn: () => api.get("/favorites") });
  const favIds = new Set((favQ.data ?? []).map((f) => f.id));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["jobapps", id] });
    qc.invalidateQueries({ queryKey: ["bizjobs"] });
  };

  const confirmMut = useMutation({
    mutationFn: (aid: string) => api.post(`/applications/${aid}/confirm`),
    onSuccess: () => { toast.show("Jam kerja dikonfirmasi", "success"); invalidate(); },
    onError: (e: any) => toast.show(e.message, "error"),
  });
  const paidMut = useMutation({
    mutationFn: (aid: string) => api.post(`/applications/${aid}/mark-paid`),
    onSuccess: () => { toast.show("Ditandai sudah dibayar", "success"); invalidate(); },
    onError: (e: any) => toast.show(e.message, "error"),
  });
  const favMut = useMutation({
    mutationFn: ({ wid, on }: { wid: string; on: boolean }) => (on ? api.post(`/favorites/${wid}`) : api.del(`/favorites/${wid}`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });
  const cancelMut = useMutation({
    mutationFn: () => api.post(`/jobs/${id}/cancel`),
    onSuccess: () => { toast.show("Loker dibatalkan", "info"); invalidate(); router.back(); },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  if (q.isLoading || !q.data) {
    return (
      <View style={[s.container, { paddingTop: insets.top + spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.md }]}>
        <Skeleton height={28} width="70%" />
        <Skeleton height={80} radius={radius.lg} />
      </View>
    );
  }

  const job = q.data.job;
  const apps = q.data.applications as any[];
  const canCancel = ["open", "filled", "ongoing"].includes(job.status);

  const renderWorker = (a: any) => {
    const w = a.worker;
    const st = APP_STATUS[a.status] ?? { label: a.status, tone: "neutral" as const };
    const isFav = w && favIds.has(w.id);
    return (
      <Card key={a.id} style={s.wCard} testID={`worker-${a.id}`}>
        <View style={s.wTop}>
          <Avatar name={w?.name} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={s.wName}>{w?.name ?? "Pekerja"}</Text>
            <View style={s.wMeta}>
              <Star size={13} color={colors.brandPrimary} weight="fill" />
              <Text style={s.wMetaText}>{(w?.rating_avg ?? 0).toFixed(1)}</Text>
              {w?.distance_m != null ? <Text style={s.wMetaText}>• {distanceLabel(w.distance_m)}</Text> : null}
            </View>
          </View>
          {w ? (
            <Pressable testID={`fav-toggle-${w.id}`} onPress={() => favMut.mutate({ wid: w.id, on: !isFav })} style={s.favBtn}>
              <Star size={22} color={colors.brandPrimary} weight={isFav ? "fill" : "regular"} />
            </Pressable>
          ) : null}
        </View>

        <View style={s.wStatusRow}>
          <StatusChip label={st.label} tone={st.tone} />
          {a.late ? <StatusChip label="Terlambat" tone="warning" /> : null}
          {a.wage_amount != null ? <Text style={s.wage}>{rupiah(a.wage_amount)} • {minutesToHours(a.actual_minutes)}</Text> : null}
        </View>

        {a.status === "checked_out" ? (
          <Button title="Konfirmasi Jam Kerja" testID={`confirm-${a.id}`} onPress={() => confirmMut.mutate(a.id)} loading={confirmMut.isPending} />
        ) : null}
        {a.status === "completed" ? (
          <View style={s.actionRow}>
            {a.payment_status === "pending" ? (
              <Button title="Tandai Dibayar" variant="secondary" testID={`markpaid-${a.id}`} onPress={() => paidMut.mutate(a.id)} style={{ flex: 1 }} />
            ) : (
              <View style={{ flex: 1 }}><StatusChip label={a.payment_status === "paid" ? "Sudah Dibayar" : "Diterima Pekerja"} tone="success" /></View>
            )}
            {!a.business_rated ? (
              <Button title="Beri Nilai" variant="secondary" testID={`rate-worker-${a.id}`} onPress={() => router.push(`/rate/${a.id}`)} style={{ flex: 1 }} />
            ) : null}
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="bizjob-back" onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={22} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={s.hTitle} numberOfLines={1}>Detail Loker</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + spacing["2xl"] }]}>
        <Card style={{ gap: spacing.sm }}>
          <Text style={s.jobTitle}>{job.title}</Text>
          <Text style={s.skill}>{job.skill_label} • {rupiah(job.hourly_rate)}/jam</Text>
          <View style={s.metaItem}>
            <Clock size={15} color={colors.muted} weight="fill" />
            <Text style={s.meta}>{formatDate(job.date)} • {timeRange(job.start_time, job.end_time)}</Text>
          </View>
          <View style={s.metaItem}>
            <MapPin size={15} color={colors.muted} weight="fill" />
            <Text style={s.meta}>{job.outlet_address}</Text>
          </View>
          <Text style={s.fill}>{job.slots_filled}/{job.workers_needed} pekerja terisi</Text>
        </Card>

        <Text style={s.sectionTitle}>Pekerja ({apps.length})</Text>
        {apps.length === 0 ? (
          <EmptyState testID="noworkers" title="Belum ada pekerja" subtitle="Sistem sedang mencari pekerja terdekat yang cocok" />
        ) : (
          apps.map(renderWorker)
        )}

        {canCancel ? (
          <Button title="Batalkan Loker" variant="danger" onPress={() => cancelMut.mutate()} loading={cancelMut.isPending} testID="cancel-job" />
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  hTitle: { fontSize: fontSize.xl, fontWeight: "800", color: c.onSurface },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingTop: spacing.sm },
  jobTitle: { fontSize: fontSize.xl, fontWeight: "900", color: c.onSurface },
  skill: { fontSize: fontSize.base, color: c.muted },
  metaItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  meta: { flex: 1, fontSize: fontSize.base, color: c.onSurfaceSecondary },
  fill: { fontSize: fontSize.base, fontWeight: "800", color: c.brandPrimary },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "800", color: c.onSurface, marginTop: spacing.sm },
  wCard: { gap: spacing.md },
  wTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  wName: { fontSize: fontSize.lg, fontWeight: "800", color: c.onSurface },
  wMeta: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 2 },
  wMetaText: { fontSize: fontSize.sm, color: c.muted },
  favBtn: { padding: spacing.xs },
  wStatusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  wage: { fontSize: fontSize.base, fontWeight: "800", color: c.success },
  actionRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
}));
