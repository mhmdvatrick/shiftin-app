import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Storefront, Coffee } from "phosphor-react-native";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles, radius, spacing, fontSize, useTheme } from "@/src/theme";

const HERO_WORKER =
  "https://images.unsplash.com/photo-1599549192669-6baac5d32432?crop=entropy&cs=srgb&fm=jpg&w=800&q=70";
const HERO_BIZ =
  "https://images.unsplash.com/photo-1588416820614-f8d6ac6cea56?crop=entropy&cs=srgb&fm=jpg&w=800&q=70";

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();

  const RoleCard = ({
    title,
    subtitle,
    img,
    role,
    icon,
    testID,
  }: {
    title: string;
    subtitle: string;
    img: string;
    role: "worker" | "business";
    icon: React.ReactNode;
    testID: string;
  }) => (
    <Pressable
      testID={testID}
      style={({ pressed }) => [s.roleCard, pressed && { opacity: 0.92 }]}
      onPress={() => router.push(`/register?role=${role}`)}
    >
      <Image source={{ uri: img }} style={s.roleImg} contentFit="cover" />
      <LinearGradient colors={["transparent", colors.surfaceInverse]} style={s.scrim} />
      <View style={s.roleContent}>
        <View style={s.iconBubble}>{icon}</View>
        <Text style={s.roleTitle}>{title}</Text>
        <Text style={s.roleSub}>{subtitle}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[s.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={s.header}>
        <Text style={s.logo}>Shiftin</Text>
        <Text style={s.tagline}>Marketplace kerja paruh waktu F&B — Jogja</Text>
      </View>

      <Text style={s.prompt}>Masuk sebagai</Text>
      <View style={s.cards}>
        <RoleCard
          testID="role-worker"
          title="Pekerja"
          subtitle="Ambil shift, kerja fleksibel"
          img={HERO_WORKER}
          role="worker"
          icon={<Coffee size={26} color={colors.onBrandPrimary} weight="fill" />}
        />
        <RoleCard
          testID="role-business"
          title="Pemilik Bisnis"
          subtitle="Cari pekerja cepat"
          img={HERO_BIZ}
          role="business"
          icon={<Storefront size={26} color={colors.onBrandPrimary} weight="fill" />}
        />
      </View>

      <Pressable testID="go-login" onPress={() => router.push("/login")} style={s.loginRow}>
        <Text style={s.loginText}>
          Sudah punya akun? <Text style={s.loginLink}>Masuk</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface, paddingHorizontal: spacing.lg },
  header: { gap: spacing.xs, marginBottom: spacing.xl },
  logo: { fontSize: 40, fontWeight: "900", color: c.brandPrimary, letterSpacing: -1 },
  tagline: { fontSize: fontSize.base, color: c.muted },
  prompt: { fontSize: fontSize.xl, fontWeight: "800", color: c.onSurface, marginBottom: spacing.md },
  cards: { flex: 1, gap: spacing.lg },
  roleCard: { flex: 1, borderRadius: radius.lg, overflow: "hidden", backgroundColor: c.surfaceSecondary },
  roleImg: { ...StyleSheetAbsolute() },
  scrim: { ...StyleSheetAbsolute() },
  roleContent: { flex: 1, justifyContent: "flex-end", padding: spacing.lg, gap: spacing.xs },
  iconBubble: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: c.brandPrimary,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  roleTitle: { fontSize: fontSize["2xl"], fontWeight: "900", color: c.onSurfaceInverse },
  roleSub: { fontSize: fontSize.base, color: c.onSurfaceInverse, opacity: 0.9 },
  loginRow: { alignItems: "center", paddingVertical: spacing.lg },
  loginText: { fontSize: fontSize.lg, color: c.onSurfaceSecondary },
  loginLink: { color: c.brandPrimary, fontWeight: "800" },
}));

function StyleSheetAbsolute() {
  return { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
}
