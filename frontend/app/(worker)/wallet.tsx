import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Clock } from "phosphor-react-native";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Button, Card, EmptyState, Skeleton, StatusChip } from "@/src/components/ui";
import { PAYMENT_STATUS_LABEL } from "@/src/constants";
import { rupiah, formatShortDate } from "@/src/format";
import { useToast } from "@/src/components/toast";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, fontSize, useTheme } from "@/src/theme";

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["wallet"], queryFn: () => api.get("/wallet") });

  const confirmMut = useMutation({
    mutationFn: (aid: string) => api.post(`/applications/${aid}/confirm-received`),
    onSuccess: () => {
      toast.show("Pembayaran dikonfirmasi diterima", "success");
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const renderItem = ({ item }: { item: any }) => (
    <Card style={s.item} testID={`wallet-item-${item.application_id}`}>
      <View style={{ flex: 1 }}>
        <Text style={s.itemTitle}>{item.title}</Text>
        <Text style={s.itemSub}>{item.business_name} • {formatShortDate(item.date)}</Text>
        <StatusChip
          label={PAYMENT_STATUS_LABEL[item.payment_status] ?? item.payment_status}
          tone={item.payment_status === "pending" ? "warning" : item.payment_status === "paid" ? "info" : "success"}
        />
      </View>
      <View style={{ alignItems: "flex-end", gap: spacing.sm }}>
        <Text style={s.amount}>{rupiah(item.amount)}</Text>
        {item.payment_status === "paid" ? (
          <Button title="Diterima" variant="secondary" testID={`confirm-received-${item.application_id}`} onPress={() => confirmMut.mutate(item.application_id)} style={{ minHeight: 40, paddingHorizontal: spacing.lg }} />
        ) : null}
      </View>
    </Card>
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.h1}>Dompet</Text>
      </View>

      <View style={s.balanceRow}>
        <View style={[s.balCard, { backgroundColor: colors.brandTertiary }]}>
          <Clock size={22} color={colors.onBrandTertiary} weight="fill" />
          <Text style={[s.balLabel, { color: colors.onBrandTertiary }]}>Menunggu</Text>
          {q.isLoading ? <Skeleton height={22} width={90} /> : <Text style={[s.balVal, { color: colors.onBrandTertiary }]}>{rupiah(q.data?.pending_total)}</Text>}
        </View>
        <View style={[s.balCard, { backgroundColor: colors.success }]}>
          <CheckCircle size={22} color={colors.onSuccess} weight="fill" />
          <Text style={[s.balLabel, { color: colors.onSuccess }]}>Sudah Dibayar</Text>
          {q.isLoading ? <Skeleton height={22} width={90} /> : <Text style={[s.balVal, { color: colors.onSuccess }]}>{rupiah(q.data?.paid_total)}</Text>}
        </View>
      </View>

      <FlatList
        data={q.data?.items}
        keyExtractor={(i) => i.application_id}
        renderItem={renderItem}
        contentContainerStyle={[s.list, { paddingBottom: bottomChrome + spacing.xl }]}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
        ListEmptyComponent={<EmptyState testID="wallet-empty" title="Belum ada penghasilan" subtitle="Selesaikan shift untuk mulai mendapat upah" />}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  h1: { fontSize: fontSize["2xl"], fontWeight: "900", color: c.onSurface },
  balanceRow: { flexDirection: "row", gap: spacing.md, padding: spacing.lg },
  balCard: { flex: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  balLabel: { fontSize: fontSize.sm, fontWeight: "600" },
  balVal: { fontSize: fontSize.xl, fontWeight: "900" },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  itemTitle: { fontSize: fontSize.lg, fontWeight: "800", color: c.onSurface },
  itemSub: { fontSize: fontSize.sm, color: c.muted, marginBottom: spacing.xs },
  amount: { fontSize: fontSize.lg, fontWeight: "900", color: c.onSurface },
}));
