import { useLocalSearchParams, useRouter } from "expo-router";
import { Coffee, Storefront } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Role, useAuth } from "@/src/auth/auth-context";
import { useToast } from "@/src/components/toast";
import { Button, TextField, Title, Muted } from "@/src/components/ui";
import { makeStyles, radius, spacing, fontSize, useTheme } from "@/src/theme";

export default function Register() {
  const params = useLocalSearchParams<{ role?: string }>();
  const router = useRouter();
  const { register } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();

  const [role, setRole] = useState<Role>((params.role as Role) || "worker");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onRegister() {
    if (!name || !email || password.length < 6) {
      toast.show("Lengkapi data (kata sandi min. 6 karakter)", "error");
      return;
    }
    setLoading(true);
    try {
      const u = await register(email.trim().toLowerCase(), password, role, name.trim());
      router.replace(u.role === "worker" ? "/onboarding/worker" : "/onboarding/business");
    } catch (e: any) {
      toast.show(e.message || "Gagal mendaftar", "error");
    } finally {
      setLoading(false);
    }
  }

  const RoleToggle = ({ r, label, icon }: { r: Role; label: string; icon: React.ReactNode }) => (
    <Pressable
      testID={`register-role-${r}`}
      onPress={() => setRole(r)}
      style={[s.roleOpt, { backgroundColor: role === r ? colors.brandPrimary : colors.surfaceTertiary }]}
    >
      {icon}
      <Text style={[s.roleOptText, { color: role === r ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>{label}</Text>
    </Pressable>
  );

  return (
    <KeyboardAwareScrollView
      style={s.container}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}
      bottomOffset={16}
    >
      <Title>Daftar Akun</Title>
      <Muted>Buat akun Shiftin dalam 1 menit</Muted>

      <View style={s.roleRow}>
        <RoleToggle r="worker" label="Pekerja" icon={<Coffee size={20} color={role === "worker" ? colors.onBrandPrimary : colors.onSurfaceSecondary} weight="fill" />} />
        <RoleToggle r="business" label="Bisnis" icon={<Storefront size={20} color={role === "business" ? colors.onBrandPrimary : colors.onSurfaceSecondary} weight="fill" />} />
      </View>

      <View style={s.form}>
        <TextField label={role === "business" ? "Nama PIC" : "Nama Lengkap"} value={name} onChangeText={setName} placeholder="Nama kamu" testID="register-name" />
        <TextField label="Email" value={email} onChangeText={setEmail} placeholder="nama@email.com" keyboardType="email-address" autoCapitalize="none" testID="register-email" />
        <TextField label="Kata Sandi" value={password} onChangeText={setPassword} placeholder="Min. 6 karakter" secureTextEntry testID="register-password" />
        <Button title="Lanjut" onPress={onRegister} loading={loading} testID="register-submit" />
      </View>

      <Pressable testID="go-login" onPress={() => router.replace("/login")} style={s.footer}>
        <Text style={s.footerText}>
          Sudah punya akun? <Text style={s.link}>Masuk</Text>
        </Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  roleRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  roleOpt: { flex: 1, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", minHeight: 52, borderRadius: radius.md },
  roleOptText: { fontWeight: "800", fontSize: fontSize.lg },
  form: { gap: spacing.lg, marginTop: spacing.lg },
  footer: { alignItems: "center", paddingVertical: spacing.lg },
  footerText: { color: c.onSurfaceSecondary, fontSize: fontSize.lg },
  link: { color: c.brandPrimary, fontWeight: "800" },
}));
