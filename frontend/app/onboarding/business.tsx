import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { LocationPicker, PhotoUpload } from "@/src/components/pickers";
import { useToast } from "@/src/components/toast";
import { Button, Chip, TextField, Title, Muted } from "@/src/components/ui";
import { BUSINESS_TYPES, YOGYA_CENTER } from "@/src/constants";
import { makeStyles, spacing } from "@/src/theme";

export default function OnboardingBusiness() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const s = useStyles();

  const [bizName, setBizName] = useState("");
  const [bizType, setBizType] = useState("Coffee Shop");
  const [address, setAddress] = useState("");
  const [picName, setPicName] = useState(user?.name ?? "");
  const [picContact, setPicContact] = useState("");
  const [lat, setLat] = useState<number | null>(YOGYA_CENTER.lat);
  const [lng, setLng] = useState<number | null>(YOGYA_CENTER.lng);
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!bizName || !address || lat == null) {
      toast.show("Lengkapi nama usaha, alamat, dan lokasi", "error");
      return;
    }
    setLoading(true);
    try {
      await api.put("/profile", {
        business_name: bizName,
        business_type: bizType,
        address,
        pic_name: picName,
        pic_contact: picContact,
        lat,
        lng,
        outlet_photo_url: photo,
      });
      await refresh();
      toast.show("Profil bisnis tersimpan!", "success");
      router.replace("/(business)");
    } catch (e: any) {
      toast.show(e.message || "Gagal menyimpan", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing["3xl"] }]}
      keyboardShouldPersistTaps="handled"
    >
      <Title>Profil Bisnis</Title>
      <Muted>Lokasi outlet wajib — dipakai untuk radius & geofence</Muted>

      <View style={s.form}>
        <TextField label="Nama Usaha" value={bizName} onChangeText={setBizName} placeholder="mis. Kopi Senja" testID="biz-name" />

        <View style={{ gap: spacing.sm }}>
          <Text style={s.label}>Jenis Usaha</Text>
          <View style={s.wrap}>
            {BUSINESS_TYPES.map((t) => (
              <Chip key={t} label={t} selected={bizType === t} onPress={() => setBizType(t)} testID={`biztype-${t}`} />
            ))}
          </View>
        </View>

        <TextField label="Alamat" value={address} onChangeText={setAddress} placeholder="Jl. ..." multiline testID="biz-address" />
        <TextField label="Nama PIC" value={picName} onChangeText={setPicName} placeholder="Nama kontak" testID="biz-pic" />
        <TextField label="Kontak PIC" value={picContact} onChangeText={setPicContact} placeholder="08xxx" keyboardType="phone-pad" testID="biz-contact" />

        <LocationPicker label="Lokasi Outlet (pin peta)" lat={lat} lng={lng} onPick={(a, b) => { setLat(a); setLng(b); }} />

        <PhotoUpload label="Foto Outlet (opsional)" path={photo} onUploaded={setPhoto} kind="outlet" testID="biz-photo" />

        <Button title="Simpan & Mulai" onPress={onSubmit} loading={loading} testID="biz-submit" />
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  form: { gap: spacing.lg, marginTop: spacing.lg },
  label: { fontSize: 14, fontWeight: "600", color: c.onSurfaceSecondary },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
}));
