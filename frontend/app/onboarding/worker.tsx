import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { LocationPicker, PhotoUpload } from "@/src/components/pickers";
import { useToast } from "@/src/components/toast";
import { Button, Chip, TextField, Title, Muted } from "@/src/components/ui";
import { SKILLS, YOGYA_CENTER } from "@/src/constants";
import { makeStyles, spacing } from "@/src/theme";

export default function OnboardingWorker() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const s = useStyles();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [experience, setExperience] = useState("");
  const [ewallet, setEwallet] = useState("");
  const [lat, setLat] = useState<number | null>(YOGYA_CENTER.lat);
  const [lng, setLng] = useState<number | null>(YOGYA_CENTER.lng);
  const [photo, setPhoto] = useState<string | null>(null);
  const [ktp, setKtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleSkill(v: string) {
    setSkills((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  async function onSubmit() {
    if (!name || skills.length === 0 || lat == null) {
      toast.show("Lengkapi nama, skill, dan lokasi", "error");
      return;
    }
    setLoading(true);
    try {
      await api.put("/profile", {
        name,
        phone,
        skills,
        experience,
        ewallet_number: ewallet,
        lat,
        lng,
        photo_url: photo,
        ktp_url: ktp,
        ready_to_work: true,
      });
      await refresh();
      toast.show("Profil tersimpan! Akun terverifikasi.", "success");
      router.replace("/(worker)");
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
      <Title>Lengkapi Profil Pekerja</Title>
      <Muted>Agar bisa mengambil shift di sekitarmu</Muted>

      <View style={s.form}>
        <TextField label="Nama Lengkap" value={name} onChangeText={setName} placeholder="Nama kamu" testID="worker-name" />
        <TextField label="Nomor HP" value={phone} onChangeText={setPhone} placeholder="08xxx" keyboardType="phone-pad" testID="worker-phone" />

        <View style={{ gap: spacing.sm }}>
          <Text style={s.label}>Skill (pilih satu atau lebih)</Text>
          <View style={s.skillWrap}>
            {SKILLS.map((sk) => (
              <Chip key={sk.value} label={sk.label} selected={skills.includes(sk.value)} onPress={() => toggleSkill(sk.value)} testID={`skill-${sk.value}`} />
            ))}
          </View>
        </View>

        <TextField label="Pengalaman Singkat" value={experience} onChangeText={setExperience} placeholder="mis. 2 tahun jadi barista" multiline testID="worker-exp" />
        <TextField label="Nomor E-wallet / Rekening" value={ewallet} onChangeText={setEwallet} placeholder="mis. GoPay 08xxx" testID="worker-ewallet" />

        <LocationPicker label="Lokasi Domisili" lat={lat} lng={lng} onPick={(a, b) => { setLat(a); setLng(b); }} />

        <PhotoUpload label="Foto Profil (opsional)" path={photo} onUploaded={setPhoto} kind="profile" testID="worker-photo" />
        <PhotoUpload label="Foto KTP (untuk verifikasi)" path={ktp} onUploaded={setKtp} kind="ktp" testID="worker-ktp" />

        <Button title="Simpan & Mulai" onPress={onSubmit} loading={loading} testID="worker-submit" />
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  form: { gap: spacing.lg, marginTop: spacing.lg },
  label: { fontSize: 14, fontWeight: "600", color: c.onSurfaceSecondary },
  skillWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
}));
