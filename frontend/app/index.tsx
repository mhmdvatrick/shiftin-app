import { ActivityIndicator, View, Text } from "react-native";

import { useAuthRedirect } from "@/src/auth/auth-context";
import { makeStyles, spacing, fontSize, useTheme } from "@/src/theme";

export default function Index() {
  useAuthRedirect();
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={s.container} testID="splash-screen">
      <Text style={s.logo}>Shiftin</Text>
      <Text style={s.tag}>Kerja fleksibel untuk F&B Jogja</Text>
      <ActivityIndicator color={colors.onBrandPrimary} style={{ marginTop: spacing.xl }} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  logo: { fontSize: 44, fontWeight: "900", color: c.onBrandPrimary, letterSpacing: -1 },
  tag: { fontSize: fontSize.lg, color: c.onBrandPrimary, opacity: 0.9 },
}));
