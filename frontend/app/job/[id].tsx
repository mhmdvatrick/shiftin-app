import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Clock, CalendarBlank, Users, CurrencyCircleDollar } from "phosphor-react-native";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { MiniMap } from "@/src/components/mini-map";
import { useToast } from "@/src/components/toast";
import { Button, ErrorView, RemoteImage, Skeleton, StatusChip } from "@/src/components/ui";
import { SHIFT_STATUS_LABEL } from "@/src/constants";
import { rupiah, distanceLabel, formatDate, timeRange } from "@/src/format";
import { makeStyles, radius, spacing, fontSize, useTheme } from "@/src/theme";

const FALLBACK = "https://images.unsplash.com/photo-1554118811-1e0d58224f24?crop=entropy&cs=srgb&fm=jpg&w=800&q=70";

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["job", id], queryFn: () => api.get(`/jobs/${id}`) });
  const job = q.data;

  const takeMut = useMutation({
    mutationFn: () => api.post(`/jobs/${id}/take`),
    onSuccess: () => {
      toast.show("Shift berhasil diambil! 🎉", "success");
      qc.invalidateQueries({ queryKey: ["nearby"] });
      qc.invalidateQueries({ queryKey: ["myshifts"] });
      qc.invalidateQueries({ queryKey: ["job", id] });
      router.replace("/(worker)/shifts");
    },
    onError: (e: any) => toast.show(e.message || "Gagal mengambil shift", "error"),
  });

  if (q.isLoading) {
    return (
      <View style={[s.container, { paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg, gap: spacing.md }]}>
        <Skeleton height={200} radius={radius.lg} />
        <Skeleton height={28} width="70%" />
        <Skeleton height={18} width="50%" />
      </View>
    );
  }
  if (q.isError || !job) {
    return (
      <View style={[s.container, { paddingTop: insets.top + spacing.xl }]}>
        <ErrorView message="Loker tidak ditemukan" onRetry={() => router.back()} />
      </View>
    );
  }

  const already = job.my_application;
  const full = job.slots_left <= 0;

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          {job.outlet_photo_url ? (
            <RemoteImage path={job.outlet_photo_url} style={s.heroImg} />
          ) : (
            <Image source={{ uri: FALLBACK }} style={s.heroImg} contentFit="cover" />
          )}
          <LinearGradient colors={["rgba(0,0,0,0.35)", "transparent", colors.surface]} style={s.heroScrim} />
          <Pressable testID="job-back" onPress={() => router.back()} style={[s.backBtn, { top: insets.top + spacing.sm }]}>
            <ArrowLeft size={22} color={colors.onSurface} weight="bold" />
          </Pressable>
        </View>

        <View style={s.body}>
          <View style={s.skillChip}>
            <Text style={s.skillChipText}>{job.skill_label}</Text>
          </View>
          <Text style={s.title}>{job.title}</Text>
          <Text style={s.biz}>{job.business_name}</Text>

          <View style={s.infoGrid}>
            <Info icon={<CalendarBlank size={18} color={colors.brandPrimary} weight="fill" />} label="Tanggal" value={formatDate(job.date)} />
            <Info icon={<Clock size={18} color={colors.brandPrimary} weight="fill" />} label="Jam" value={timeRange(job.start_time, job.end_time)} />
            <Info icon={<CurrencyCircleDollar size={18} color={colors.brandPrimary} weight="fill" />} label="Tarif" value={`${rupiah(job.hourly_rate)}/jam`} />
            <Info icon={<Users size={18} color={colors.brandPrimary} weight="fill" />} label="Dibutuhkan" value={`${job.slots_filled}/${job.workers_needed} orang`} />
          </View>

          <View style={s.estCard}>
            <Text style={s.estLabel}>Estimasi total penghasilan</Text>
            <Text style={s.estVal}>{rupiah(job.estimated_total)}</Text>
            <Text style={s.estSub}>{job.planned_hours} jam × {rupiah(job.hourly_rate)}</Text>
          </View>

          <View style={s.section}>
            <View style={s.metaItem}>
              <MapPin size={16} color={colors.muted} weight="fill" />
              <Text style={s.address}>{job.outlet_address}{job.distance_m != null ? ` • ${distanceLabel(job.distance_m)}` : ""}</Text>
            </View>
            <MiniMap outletLat={job.outlet_lat} outletLng={job.outlet_lng} height={160} distanceM={job.distance_m} />
          </View>

          {job.description ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Deskripsi</Text>
              <Text style={s.desc}>{job.description}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* sticky bottom CTA */}
      <BlurView intensity={Platform.OS === "web" ? 0 : 40} tint="light" style={[s.cta, { paddingBottom: insets.bottom + spacing.md }]}>
        {already ? (
          <View style={s.ctaRow}>
            <StatusChip label={SHIFT_STATUS_LABEL[already.status] ?? "Diambil"} tone="success" />
            <Button title="Lihat di Shift Saya" variant="secondary" onPress={() => router.replace("/(worker)/shifts")} testID="goto-shifts" style={{ flex: 1 }} />
          </View>
        ) : (
          <Button
            title={full ? "Slot Penuh" : "Ambil Shift"}
            onPress={() => takeMut.mutate()}
            disabled={full}
            loading={takeMut.isPending}
            testID="ambil-shift-button"
          />
        )}
      </BlurView>
    </View>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const s = useStyles();
  return (
    <View style={s.info}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  hero: { height: 220, backgroundColor: c.surfaceTertiary },
  heroImg: { width: "100%", height: "100%" },
  heroScrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  backBtn: { position: "absolute", left: spacing.lg, width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: spacing.lg, marginTop: -spacing.xl, gap: spacing.md },
  skillChip: { alignSelf: "flex-start", backgroundColor: c.brandSecondary, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  skillChipText: { color: c.onBrandSecondary, fontWeight: "700", fontSize: fontSize.sm },
  title: { fontSize: fontSize["2xl"], fontWeight: "900", color: c.onSurface },
  biz: { fontSize: fontSize.lg, color: c.muted },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  info: { width: "47%", flexDirection: "row", gap: spacing.sm, backgroundColor: c.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border },
  infoLabel: { fontSize: fontSize.sm, color: c.muted },
  infoValue: { fontSize: fontSize.base, fontWeight: "700", color: c.onSurface },
  estCard: { backgroundColor: c.brandTertiary, borderRadius: radius.lg, padding: spacing.lg, gap: 2 },
  estLabel: { fontSize: fontSize.base, color: c.onBrandTertiary },
  estVal: { fontSize: fontSize["2xl"], fontWeight: "900", color: c.onBrandTertiary },
  estSub: { fontSize: fontSize.sm, color: c.onBrandTertiary, opacity: 0.8 },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "800", color: c.onSurface },
  metaItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  address: { flex: 1, fontSize: fontSize.base, color: c.onSurfaceSecondary },
  desc: { fontSize: fontSize.base, color: c.onSurfaceSecondary, lineHeight: 22 },
  cta: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface + "F2" },
  ctaRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
}));
