import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, MapPin, NavigationArrow, Warning } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { MiniMap } from "@/src/components/mini-map";
import { PhotoUpload } from "@/src/components/pickers";
import { useToast } from "@/src/components/toast";
import { Button, Skeleton } from "@/src/components/ui";
import { distanceLabel } from "@/src/format";
import { makeStyles, radius, spacing, fontSize, useTheme } from "@/src/theme";

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const d = (x: number) => (x * Math.PI) / 180;
  const a =
    Math.sin(d(lat2 - lat1) / 2) ** 2 +
    Math.cos(d(lat1)) * Math.cos(d(lat2)) * Math.sin(d(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export default function Attendance() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["application", id], queryFn: () => api.get(`/applications/${id}`) });
  const app = q.data;
  const job = app?.job;
  const mode: "checkin" | "checkout" = app?.status === "checked_in" ? "checkout" : "checkin";

  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number | null; mocked: boolean } | null>(null);
  const [locating, setLocating] = useState(false);
  const [selfie, setSelfie] = useState<string | null>(null);

  async function fetchLocation() {
    setLocating(true);
    try {
      let { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
        canAskAgain = req.canAskAgain;
      }
      if (status !== "granted") {
        if (!canAskAgain) {
          toast.show("Izin lokasi diblokir. Buka Pengaturan.", "error");
          Linking.openSettings();
        } else {
          toast.show("Izin lokasi diperlukan untuk presensi", "error");
        }
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
        mocked: (pos as any).mocked ?? false,
      });
    } catch {
      toast.show("Gagal mendapatkan lokasi. Pastikan GPS aktif.", "error");
    } finally {
      setLocating(false);
    }
  }

  useEffect(() => {
    fetchLocation();
  }, []);

  const distance = coords && job ? haversine(job.outlet_lat, job.outlet_lng, coords.lat, coords.lng) : null;
  const inside = distance != null && job ? distance <= job.geofence_radius_m : false;

  const mut = useMutation({
    mutationFn: () =>
      api.post(`/attendance/${mode}`, {
        application_id: id,
        lat: coords!.lat,
        lng: coords!.lng,
        accuracy: coords!.accuracy,
        is_mock: coords!.mocked,
        selfie_path: selfie,
      }),
    onSuccess: (res: any) => {
      if (mode === "checkin") {
        toast.show(res.late ? "Check-in berhasil (terlambat)" : "Check-in berhasil! 🎉", "success");
      } else {
        toast.show(`Check-out berhasil. Upah: Rp${(res.wage_amount ?? 0).toLocaleString("id-ID")}`, "success");
      }
      qc.invalidateQueries({ queryKey: ["myshifts"] });
      qc.invalidateQueries({ queryKey: ["application", id] });
      router.replace("/(worker)/shifts");
    },
    onError: (e: any) => toast.show(e.message || "Presensi gagal", "error"),
  });

  function onSubmit() {
    if (!coords) {
      toast.show("Dapatkan lokasi terlebih dahulu", "error");
      return;
    }
    if (!selfie) {
      toast.show("Ambil selfie sebagai bukti kerja", "error");
      return;
    }
    mut.mutate();
  }

  if (q.isLoading || !job) {
    return (
      <View style={[s.container, { paddingTop: insets.top + spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.md }]}>
        <Skeleton height={180} radius={radius.lg} />
        <Skeleton height={24} width="60%" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="attendance-back" onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={22} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={s.hTitle}>{mode === "checkin" ? "Check-in" : "Check-out"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]}>
        <Text style={s.jobTitle}>{job.title}</Text>
        <Text style={s.biz}>{job.business_name}</Text>

        <MiniMap
          outletLat={job.outlet_lat}
          outletLng={job.outlet_lng}
          workerLat={coords?.lat}
          workerLng={coords?.lng}
          geofenceRadiusM={job.geofence_radius_m}
          distanceM={distance}
          inside={inside}
          height={200}
        />

        <View style={[s.geoBanner, { backgroundColor: inside ? colors.success : colors.warning }]}>
          <NavigationArrow size={20} color={inside ? colors.onSuccess : colors.onWarning} weight="fill" />
          <View style={{ flex: 1 }}>
            <Text style={[s.geoTitle, { color: inside ? colors.onSuccess : colors.onWarning }]}>
              {coords ? (inside ? "Kamu di dalam area outlet" : "Kamu di luar area outlet") : "Mendeteksi lokasi..."}
            </Text>
            <Text style={[s.geoSub, { color: inside ? colors.onSuccess : colors.onWarning }]}>
              {distance != null ? `${distanceLabel(distance)} dari outlet • zona ${job.geofence_radius_m} m` : "Pastikan GPS aktif"}
            </Text>
          </View>
        </View>

        {coords?.mocked ? (
          <View style={s.mockWarn}>
            <Warning size={18} color={colors.onError} weight="fill" />
            <Text style={s.mockText}>Lokasi palsu (mock) terdeteksi. Matikan mock location.</Text>
          </View>
        ) : null}

        <Button
          title={locating ? "Mendeteksi..." : "Perbarui Lokasi"}
          variant="secondary"
          onPress={fetchLocation}
          loading={locating}
          icon={<MapPin size={18} color={colors.onSurface} weight="fill" />}
          testID="refresh-location"
        />

        <PhotoUpload
          label="Selfie Bukti Kerja"
          path={selfie}
          onUploaded={setSelfie}
          kind="selfie"
          useCamera
          testID="selfie-capture"
        />
      </ScrollView>

      <View style={[s.cta, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title={mode === "checkin" ? "Check In Sekarang" : "Check Out Sekarang"}
          onPress={onSubmit}
          loading={mut.isPending}
          disabled={!coords || !selfie}
          testID="attendance-submit"
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  hTitle: { fontSize: fontSize.xl, fontWeight: "800", color: c.onSurface },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  jobTitle: { fontSize: fontSize.xl, fontWeight: "900", color: c.onSurface },
  biz: { fontSize: fontSize.base, color: c.muted, marginBottom: spacing.xs },
  geoBanner: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.lg, padding: spacing.lg },
  geoTitle: { fontSize: fontSize.lg, fontWeight: "800" },
  geoSub: { fontSize: fontSize.sm, opacity: 0.9 },
  mockWarn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.error, borderRadius: radius.md, padding: spacing.md },
  mockText: { flex: 1, color: c.onError, fontSize: fontSize.sm, fontWeight: "600" },
  cta: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
}));
