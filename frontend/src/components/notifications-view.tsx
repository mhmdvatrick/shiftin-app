import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Bell,
  BriefcaseMetal,
  CheckCircle,
  CurrencyDollar,
  MapPin,
  XCircle,
} from "phosphor-react-native";
import { FlatList, RefreshControl, Text, View } from "react-native";

import { api } from "@/src/api/client";
import { EmptyState, Skeleton } from "@/src/components/ui";
import { makeStyles, radius, spacing, fontSize, useTheme } from "@/src/theme";

function iconFor(type: string, color: string) {
  const p = { size: 22, color, weight: "fill" as const };
  switch (type) {
    case "new_job":
      return <BriefcaseMetal {...p} />;
    case "slot_filled":
      return <CheckCircle {...p} />;
    case "attendance":
      return <MapPin {...p} />;
    case "payment":
    case "work_confirmed":
      return <CurrencyDollar {...p} />;
    case "job_cancelled":
      return <XCircle {...p} />;
    default:
      return <Bell {...p} />;
  }
}

export function NotificationsView() {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();

  const q = useQuery<any[]>({ queryKey: ["notifications"], queryFn: () => api.get("/notifications") });

  const readAll = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread"] });
    },
  });

  function onPress(n: any) {
    if (n.data?.job_id) router.push(`/job/${n.data.job_id}`);
  }

  const renderItem = ({ item }: { item: any }) => (
    <View style={[s.item, !item.read && s.unread]} testID={`notif-${item.id}`}>
      <View style={s.iconWrap}>{iconFor(item.type, colors.brandPrimary)}</View>
      <View style={{ flex: 1 }}>
        <Text style={s.title} onPress={() => onPress(item)}>{item.title}</Text>
        <Text style={s.body}>{item.body}</Text>
      </View>
      {!item.read ? <View style={s.dot} /> : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {q.data && q.data.some((n) => !n.read) ? (
        <Text testID="mark-read-all" style={s.readAll} onPress={() => readAll.mutate()}>
          Tandai semua dibaca
        </Text>
      ) : null}
      {q.isLoading ? (
        <View style={s.list}>
          <Skeleton height={64} radius={radius.md} />
          <Skeleton height={64} radius={radius.md} />
        </View>
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState testID="notif-empty" title="Belum ada notifikasi" subtitle="Info loker & shift akan muncul di sini" />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  readAll: { color: c.brandPrimary, fontWeight: "700", textAlign: "right", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, fontSize: fontSize.base },
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: c.border },
  unread: { backgroundColor: c.brandTertiary, borderColor: c.brandSecondary },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
  title: { fontSize: fontSize.base, fontWeight: "800", color: c.onSurface },
  body: { fontSize: fontSize.sm, color: c.onSurfaceSecondary, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.brandPrimary },
}));
