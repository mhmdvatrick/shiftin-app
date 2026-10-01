import { useQuery } from "@tanstack/react-query";
import { Star } from "phosphor-react-native";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Avatar, Card, EmptyState, Skeleton } from "@/src/components/ui";
import { skillLabel } from "@/src/constants";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, fontSize, useTheme } from "@/src/theme";

export default function Favorites() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const q = useQuery<any[]>({ queryKey: ["favorites"], queryFn: () => api.get("/favorites") });
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const renderItem = ({ item }: { item: any }) => (
    <Card style={s.card} testID={`fav-${item.id}`}>
      <Avatar name={item.name} size={48} />
      <View style={{ flex: 1 }}>
        <Text style={s.name}>{item.name}</Text>
        <Text style={s.skills}>{(item.skills ?? []).map(skillLabel).join(", ")}</Text>
      </View>
      <View style={s.ratingBox}>
        <Star size={14} color={colors.brandPrimary} weight="fill" />
        <Text style={s.rating}>{item.rating_avg.toFixed(1)}</Text>
      </View>
    </Card>
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.h1}>Pekerja Favorit</Text>
      </View>
      {q.isLoading ? (
        <View style={s.list}>
          <Skeleton height={76} radius={radius.lg} />
          <Skeleton height={76} radius={radius.lg} />
        </View>
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={[s.list, { paddingBottom: bottomChrome + spacing.xl }]}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState testID="fav-empty" title="Belum ada favorit" subtitle="Tandai pekerja andalan dari detail loker" />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  h1: { fontSize: fontSize["2xl"], fontWeight: "900", color: c.onSurface },
  list: { padding: spacing.lg, gap: spacing.md },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { fontSize: fontSize.lg, fontWeight: "800", color: c.onSurface },
  skills: { fontSize: fontSize.sm, color: c.muted },
  ratingBox: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  rating: { fontWeight: "800", color: c.onBrandTertiary, fontSize: fontSize.base },
}));
