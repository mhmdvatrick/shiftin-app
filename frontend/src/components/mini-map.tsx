// Web + fallback MiniMap. No native-maps import here, so the web bundle stays clean.
import { Phone, MapPin, NavigationArrow } from "phosphor-react-native";
import React from "react";
import { View, Text } from "react-native";

import { distanceLabel } from "@/src/format";
import { radius, spacing, fontSize, useTheme } from "@/src/theme";

export type MiniMapProps = {
  outletLat: number;
  outletLng: number;
  workerLat?: number | null;
  workerLng?: number | null;
  distanceM?: number | null;
  geofenceRadiusM?: number;
  height?: number;
  inside?: boolean;
};

export function MiniMap({ distanceM, geofenceRadiusM = 100, height = 180, inside }: MiniMapProps) {
  const { colors } = useTheme();
  return (
    <View
      testID="mini-map"
      style={{
        height,
        borderRadius: radius.lg,
        backgroundColor: colors.surfaceTertiary,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        overflow: "hidden",
      }}
    >
      <MapPin size={36} color={colors.brandPrimary} weight="fill" />
      <Text style={{ color: colors.onSurface, fontWeight: "700", fontSize: fontSize.base }}>
        {distanceM != null ? `${distanceLabel(distanceM)} dari outlet` : "Peta lokasi outlet"}
      </Text>
      {distanceM != null ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <NavigationArrow size={14} color={inside ? colors.success : colors.muted} weight="fill" />
          <Text style={{ color: inside ? colors.success : colors.muted, fontSize: fontSize.sm }}>
            {inside ? "Di dalam area" : `Zona check-in: ${geofenceRadiusM} m`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export const _unused = Phone;
