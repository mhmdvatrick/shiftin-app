import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth, User } from "@/src/auth/auth-context";
import { useToast } from "@/src/components/toast";
import { Button, TextField, Title, Muted } from "@/src/components/ui";
import { makeStyles, spacing } from "@/src/theme";

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const s = useStyles();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function routeFor(u: User) {
    if (!u.onboarded) router.replace(u.role === "worker" ? "/onboarding/worker" : "/onboarding/business");
    else router.replace(u.role === "worker" ? "/(worker)" : "/(business)");
  }

  async function onLogin() {
    if (!email || !password) {
      toast.show("Isi email dan kata sandi", "error");
      return;
    }
    setLoading(true);
    try {
      const u = await login(email.trim().toLowerCase(), password);
      routeFor(u);
    } catch (e: any) {
      toast.show(e.message || "Gagal masuk", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAwareScrollView
      style={s.container}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing["2xl"], paddingBottom: insets.bottom + spacing.xl }]}
      bottomOffset={16}
    >
      <Title>Masuk</Title>
      <Muted>Selamat datang kembali di Shiftin</Muted>

      <View style={s.form}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="nama@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          testID="login-email"
        />
        <TextField
          label="Kata Sandi"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          testID="login-password"
        />
        <Button title="Masuk" onPress={onLogin} loading={loading} testID="login-submit" />
      </View>

      <Pressable testID="go-register" onPress={() => router.replace("/welcome")} style={s.footer}>
        <Text style={s.footerText}>
          Belum punya akun? <Text style={s.link}>Daftar</Text>
        </Text>
      </Pressable>

      <View style={s.demoBox}>
        <Muted>Akun demo: bisnis@shiftin.id / budi@shiftin.id — password: password123</Muted>
      </View>
    </KeyboardAwareScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  form: { gap: spacing.lg, marginTop: spacing.xl },
  footer: { alignItems: "center", paddingVertical: spacing.lg },
  footerText: { color: c.onSurfaceSecondary, fontSize: 16 },
  link: { color: c.brandPrimary, fontWeight: "800" },
  demoBox: { marginTop: spacing.md, padding: spacing.md, backgroundColor: c.brandTertiary, borderRadius: 12 },
}));
