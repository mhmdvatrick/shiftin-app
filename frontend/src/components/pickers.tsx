import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Camera, MapPin, UploadSimple } from "phosphor-react-native";
import { useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from "react-native";

import { api } from "@/src/api/client";
import { useToast } from "@/src/components/toast";
import { MiniMap } from "@/src/components/mini-map";
import { RemoteImage } from "@/src/components/ui";
import { YOGYA_CENTER } from "@/src/constants";
import { makeStyles, radius, spacing, fontSize, useTheme } from "@/src/theme";

// ---------------- Location picker ----------------
export function LocationPicker({
  lat,
  lng,
  onPick,
  label = "Lokasi",
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  label?: string;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function useMyLocation() {
    setBusy(true);
    try {
      let { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
        canAskAgain = req.canAskAgain;
      }
      if (status !== "granted") {
        if (!canAskAgain) {
          toast.show("Izin lokasi diblokir. Buka Pengaturan untuk mengaktifkan.", "error");
          Linking.openSettings();
        } else {
          toast.show("Izin lokasi diperlukan", "error");
        }
        // fall back to Yogyakarta center so the user is never dead-ended
        onPick(YOGYA_CENTER.lat, YOGYA_CENTER.lng);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      onPick(pos.coords.latitude, pos.coords.longitude);
      toast.show("Lokasi terdeteksi", "success");
    } catch {
      onPick(YOGYA_CENTER.lat, YOGYA_CENTER.lng);
      toast.show("Memakai lokasi default Jogja", "info");
    } finally {
      setBusy(false);
    }
  }

  const has = lat != null && lng != null;
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={s.label}>{label}</Text>
      {has ? (
        <MiniMap outletLat={lat!} outletLng={lng!} height={150} />
      ) : (
        <View style={s.placeholder}>
          <MapPin size={28} color={colors.muted} />
          <Text style={s.phText}>Belum ada lokasi dipilih</Text>
        </View>
      )}
      <Pressable testID="use-my-location" style={s.locBtn} onPress={useMyLocation} disabled={busy}>
        {busy ? (
          <ActivityIndicator color={colors.onBrandTertiary} />
        ) : (
          <>
            <MapPin size={18} color={colors.onBrandTertiary} weight="fill" />
            <Text style={s.locBtnText}>{has ? "Perbarui Lokasi Saya" : "Gunakan Lokasi Saya"}</Text>
          </>
        )}
      </Pressable>
      {has ? (
        <Text style={s.coords}>
          {lat!.toFixed(5)}, {lng!.toFixed(5)}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------- Photo upload ----------------
export function PhotoUpload({
  path,
  onUploaded,
  label,
  kind,
  useCamera,
  testID,
}: {
  path: string | null;
  onUploaded: (path: string) => void;
  label: string;
  kind: string;
  useCamera?: boolean;
  testID?: string;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function pick() {
    setBusy(true);
    try {
      let result;
      if (useCamera && Platform.OS !== "web") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          if (!perm.canAskAgain) Linking.openSettings();
          toast.show("Izin kamera diperlukan", "error");
          return;
        }
        result = await ImagePicker.launchCameraAsync({ quality: 0.5, cameraType: ImagePicker.CameraType.front });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.5 });
      }
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      const up = await api.upload(uri, kind);
      onUploaded(up.path);
      toast.show("Foto terunggah", "success");
    } catch (e: any) {
      toast.show(e.message || "Gagal mengunggah", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={s.label}>{label}</Text>
      <Pressable testID={testID} style={s.photoBox} onPress={pick} disabled={busy}>
        {busy ? (
          <ActivityIndicator color={colors.brandPrimary} />
        ) : path ? (
          <RemoteImage path={path} style={s.photo} />
        ) : (
          <View style={s.photoEmpty}>
            {useCamera ? <Camera size={28} color={colors.muted} /> : <UploadSimple size={28} color={colors.muted} />}
            <Text style={s.phText}>Ketuk untuk {useCamera ? "ambil foto" : "unggah"}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  label: { fontSize: fontSize.base, fontWeight: "600", color: c.onSurfaceSecondary },
  placeholder: {
    height: 100, borderRadius: radius.md, backgroundColor: c.surfaceTertiary,
    alignItems: "center", justifyContent: "center", gap: spacing.xs,
    borderWidth: 1, borderColor: c.border, borderStyle: "dashed",
  },
  phText: { color: c.muted, fontSize: fontSize.sm },
  locBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    backgroundColor: c.brandTertiary, borderRadius: radius.pill, minHeight: 48,
  },
  locBtnText: { color: c.onBrandTertiary, fontWeight: "700", fontSize: fontSize.base },
  coords: { color: c.muted, fontSize: fontSize.sm, textAlign: "center" },
  photoBox: {
    height: 140, borderRadius: radius.md, overflow: "hidden", backgroundColor: c.surfaceTertiary,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, borderStyle: "dashed",
  },
  photo: { width: "100%", height: "100%" },
  photoEmpty: { alignItems: "center", gap: spacing.xs },
}));
