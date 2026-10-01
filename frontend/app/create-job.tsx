import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowLeft, Minus, Plus, Warning } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useToast } from "@/src/components/toast";
import { Button, Chip, TextField } from "@/src/components/ui";
import { SKILLS } from "@/src/constants";
import { rupiah, formatShortDate } from "@/src/format";
import { makeStyles, radius, spacing, fontSize, useTheme } from "@/src/theme";

function nextDays(n: number) {
  const out: { value: string; label: string }[] = [];
  const today = new Date();
  const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ value, label: i === 0 ? "Hari ini" : i === 1 ? "Besok" : `${DAYS[d.getDay()]} ${d.getDate()}` });
  }
  return out;
}

function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((x) => isNaN(x))) return 0;
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60; // past midnight
  return mins / 60;
}

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

export default function CreateJob() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();

  const cfgQ = useQuery({ queryKey: ["config"], queryFn: () => api.get("/config") });
  const umk = cfgQ.data?.umk_hourly ?? 14410;

  const days = useMemo(() => nextDays(14), []);
  const [title, setTitle] = useState("Butuh tambahan karyawan");
  const [skill, setSkill] = useState<string | null>(null);
  const [date, setDate] = useState(days[0].value);
  const [start, setStart] = useState("17:00");
  const [end, setEnd] = useState("22:00");
  const [rate, setRate] = useState("20000");
  const [workers, setWorkers] = useState(1);
  const [desc, setDesc] = useState("");

  const rateNum = parseInt(rate || "0", 10) || 0;
  const hours = hoursBetween(start, end);
  const total = Math.round(rateNum * hours * workers);
  const belowUmk = rateNum > 0 && rateNum < umk;

  const mut = useMutation({
    mutationFn: () =>
      api.post("/jobs", {
        title,
        skill,
        date,
        start_time: start,
        end_time: end,
        hourly_rate: rateNum,
        workers_needed: workers,
        description: desc,
      }),
    onSuccess: () => {
      toast.show("Loker diposting! Mencari pekerja terdekat...", "success");
      qc.invalidateQueries({ queryKey: ["bizjobs"] });
      router.replace("/(business)");
    },
    onError: (e: any) => toast.show(e.message || "Gagal memposting loker", "error"),
  });

  function validate(): string | null {
    if (!title.trim()) return "Judul wajib diisi";
    if (!skill) return "Pilih posisi/skill";
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) return "Format jam harus HH:MM";
    if (hours <= 0) return "Durasi tidak valid";
    if (rateNum <= 0) return "Tarif per jam wajib diisi";
    return null;
  }

  function onSubmit() {
    const err = validate();
    if (err) {
      toast.show(err, "error");
      return;
    }
    mut.mutate();
  }

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="createjob-back" onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={22} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={s.hTitle}>Buat Loker</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]} bottomOffset={16}>
        <TextField label="Judul Loker" value={title} onChangeText={setTitle} placeholder="mis. Butuh tambahan karyawan" testID="job-title" />

        <View style={s.block}>
          <Text style={s.label}>Posisi / Skill</Text>
          <View style={s.wrap}>
            {SKILLS.map((sk) => (
              <Chip key={sk.value} label={sk.label} selected={skill === sk.value} onPress={() => setSkill(sk.value)} testID={`job-skill-${sk.value}`} />
            ))}
          </View>
        </View>

        <View style={s.block}>
          <Text style={s.label}>Tanggal</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            {days.map((d) => (
              <Chip key={d.value} label={d.label} selected={date === d.value} onPress={() => setDate(d.value)} testID={`job-date-${d.value}`} />
            ))}
          </ScrollView>
        </View>

        <View style={s.timeRow}>
          <View style={{ flex: 1 }}>
            <TextField label="Jam Mulai" value={start} onChangeText={setStart} placeholder="17:00" keyboardType="numbers-and-punctuation" testID="job-start" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Jam Selesai" value={end} onChangeText={setEnd} placeholder="22:00" keyboardType="numbers-and-punctuation" testID="job-end" />
          </View>
        </View>
        {hours > 0 ? <Text style={s.hint}>Durasi: {hours % 1 === 0 ? hours : hours.toFixed(1)} jam {hoursBetween(start, end) > 0 && end <= start ? "(lewat tengah malam)" : ""}</Text> : null}

        <TextField label="Tarif per Jam (Rp)" value={rate} onChangeText={(t) => setRate(t.replace(/[^0-9]/g, ""))} placeholder="20000" keyboardType="number-pad" prefix="Rp" testID="job-rate" />
        {belowUmk ? (
          <View style={s.warn}>
            <Warning size={18} color={colors.onWarning} weight="fill" />
            <Text style={s.warnText}>Tarif di bawah UMK Jogja ({rupiah(umk)}/jam). Tetap bisa diposting.</Text>
          </View>
        ) : null}

        <View style={s.block}>
          <Text style={s.label}>Jumlah Pekerja Dibutuhkan</Text>
          <View style={s.stepper}>
            <Pressable testID="workers-minus" style={s.stepBtn} onPress={() => setWorkers((w) => Math.max(1, w - 1))}>
              <Minus size={20} color={colors.onSurface} weight="bold" />
            </Pressable>
            <Text style={s.stepVal}>{workers}</Text>
            <Pressable testID="workers-plus" style={s.stepBtn} onPress={() => setWorkers((w) => Math.min(50, w + 1))}>
              <Plus size={20} color={colors.onSurface} weight="bold" />
            </Pressable>
          </View>
        </View>

        <TextField label="Deskripsi (opsional)" value={desc} onChangeText={setDesc} placeholder="Info tambahan untuk pekerja" multiline testID="job-desc" />

        <View style={s.summary}>
          <Text style={s.summaryTitle}>Ringkasan Biaya</Text>
          <View style={s.sumRow}>
            <Text style={s.sumLabel}>{rupiah(rateNum)} × {hours % 1 === 0 ? hours : hours.toFixed(1)} jam × {workers} pekerja</Text>
            <Text style={s.sumVal}>{rupiah(total)}</Text>
          </View>
        </View>
      </KeyboardAwareScrollView>

      <View style={[s.cta, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button title="Posting Loker" onPress={onSubmit} loading={mut.isPending} testID="job-submit" />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  hTitle: { fontSize: fontSize.xl, fontWeight: "800", color: c.onSurface },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingTop: spacing.sm },
  block: { gap: spacing.sm },
  label: { fontSize: fontSize.base, fontWeight: "600", color: c.onSurfaceSecondary },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  timeRow: { flexDirection: "row", gap: spacing.md },
  hint: { fontSize: fontSize.sm, color: c.muted, marginTop: -spacing.sm },
  warn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.warning, borderRadius: radius.md, padding: spacing.md },
  warnText: { flex: 1, color: c.onWarning, fontSize: fontSize.sm, fontWeight: "600" },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.lg, alignSelf: "flex-start", backgroundColor: c.surfaceTertiary, borderRadius: radius.pill, padding: spacing.xs },
  stepBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
  stepVal: { fontSize: fontSize.xl, fontWeight: "900", color: c.onSurface, minWidth: 30, textAlign: "center" },
  summary: { backgroundColor: c.brandTertiary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  summaryTitle: { fontSize: fontSize.lg, fontWeight: "800", color: c.onBrandTertiary },
  sumRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sumLabel: { fontSize: fontSize.base, color: c.onBrandTertiary, flex: 1 },
  sumVal: { fontSize: fontSize.xl, fontWeight: "900", color: c.onBrandTertiary },
  cta: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
}));
