// Native MiniMap using react-native-maps. Metro only bundles this on ios/android.
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from "react-native-maps";
import React from "react";
import { View } from "react-native";

import { radius, useTheme } from "@/src/theme";
import type { MiniMapProps } from "./mini-map";

export function MiniMap({
  outletLat,
  outletLng,
  workerLat,
  workerLng,
  geofenceRadiusM = 100,
  height = 180,
  inside,
}: MiniMapProps) {
  const { colors } = useTheme();
  return (
    <View style={{ height, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border }} testID="mini-map">
      <MapView
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        pointerEvents="none"
        initialRegion={{
          latitude: outletLat,
          longitude: outletLng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Marker coordinate={{ latitude: outletLat, longitude: outletLng }} title="Outlet" pinColor={colors.brandPrimary} />
        <Circle
          center={{ latitude: outletLat, longitude: outletLng }}
          radius={geofenceRadiusM}
          strokeColor={inside ? colors.success : colors.brandPrimary}
          fillColor={colors.brandPrimary + "22"}
        />
        {workerLat != null && workerLng != null ? (
          <Marker coordinate={{ latitude: workerLat, longitude: workerLng }} title="Kamu" pinColor={colors.info} />
        ) : null}
      </MapView>
    </View>
  );
}
