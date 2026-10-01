import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { useToast } from "@/src/components/toast";
import { Avatar, Button, StarRating, TextField } from "@/src/components/ui";
import { makeStyles, spacing, fontSize, useTheme } from "@/src/theme";

export default function RateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const q = useQuery({ queryKey: ["application", id], queryFn: () => api.get(`/applications/${id}`) });
  const app = q.data;
  const job = app?.job;

  const isBusiness = user?.role === "business";
  const targetName = isBusiness ? app?.worker_name : job?.business_name;

  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");

  const mut = useMutation({
    mutationFn: () => api.post("/ratings", { application_id: id, stars, comment }),
    onSuccess: () => {
      toast.show("Terima kasih atas penilaianmu!", "success");
      qc.invalidateQueries({ queryKey: ["myshifts"] });
      qc.invalidateQueries({ queryKey: ["jobapps"] });
      router.back();
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="rate-back" onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={22} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={s.hTitle}>Beri Nilai</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + spacing.xl }]} bottomOffset={16}>
        <View style={s.target}>
          <Avatar name={targetName} size={72} />
          <Text style={s.name}>{targetName ?? "-"}</Text>
          <Text style={s.sub}>{job?.title}</Text>
        </View>

        <View style={s.starBox}>
          <Text style={s.label}>Seberapa puas kamu?</Text>
          <StarRating value={stars} onChange={setStars} size={42} />
        </View>

        <TextField label="Komentar (opsional)" value={comment} onChangeText={setComment} placeholder="Ceritakan pengalamanmu" multiline testID="rate-comment" />

        <Button title="Kirim Penilaian" onPress={() => mut.mutate()} loading={mut.isPending} testID="rate-submit" />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  hTitle: { fontSize: fontSize.xl, fontWeight: "800", color: c.onSurface },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl, paddingTop: spacing.lg },
  target: { alignItems: "center", gap: spacing.sm },
  name: { fontSize: fontSize.xl, fontWeight: "900", color: c.onSurface },
  sub: { fontSize: fontSize.base, color: c.muted },
  starBox: { alignItems: "center", gap: spacing.md },
  label: { fontSize: fontSize.lg, fontWeight: "700", color: c.onSurface },
}));
