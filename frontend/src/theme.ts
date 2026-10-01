// Design tokens for Shiftin. Light + dark. Colors come from design_guidelines.json.
// Use makeStyles() for StyleSheets and useTheme().colors for color props.
// Never write color literals in components.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFCF9",
  onSurface: "#2A2421",
  surfaceSecondary: "#F4EFEA",
  onSurfaceSecondary: "#3E3631",
  surfaceTertiary: "#EAE4DD",
  onSurfaceTertiary: "#4F453F",
  surfaceInverse: "#2A2421",
  onSurfaceInverse: "#FFFCF9",
  muted: "#8A7D75",

  brand: "#FF8A00",
  onBrand: "#FFFFFF",
  brandPrimary: "#FF8A00",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#FFB74D",
  onBrandSecondary: "#4E2A00",
  brandTertiary: "#FFF3E0",
  onBrandTertiary: "#E65C00",

  success: "#2E7D32",
  onSuccess: "#FFFFFF",
  warning: "#F57F17",
  onWarning: "#4E2A00",
  error: "#D32F2F",
  onError: "#FFFFFF",
  info: "#0288D1",
  onInfo: "#FFFFFF",

  border: "#EAE4DD",
  borderStrong: "#D7CCC2",
  divider: "#F4EFEA",
};

const dark: typeof light = {
  surface: "#1A1614",
  onSurface: "#FFFCF9",
  surfaceSecondary: "#2A2421",
  onSurfaceSecondary: "#EAE4DD",
  surfaceTertiary: "#38312D",
  onSurfaceTertiary: "#D7CCC2",
  surfaceInverse: "#FFFCF9",
  onSurfaceInverse: "#2A2421",
  muted: "#A2958C",

  brand: "#FF9800",
  onBrand: "#4E2A00",
  brandPrimary: "#FF9800",
  onBrandPrimary: "#4E2A00",
  brandSecondary: "#FFB74D",
  onBrandSecondary: "#4E2A00",
  brandTertiary: "#4E2A00",
  onBrandTertiary: "#FFD180",

  success: "#81C784",
  onSuccess: "#003300",
  warning: "#FFB300",
  onWarning: "#4E2A00",
  error: "#E57373",
  onError: "#4E0000",
  info: "#4FC3F7",
  onInfo: "#00334E",

  border: "#38312D",
  borderStrong: "#4F453F",
  divider: "#2A2421",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

// Spacing / radius / typography tokens (same values as design_guidelines.json).
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 } as const;
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 } as const;
export const fontSize = { sm: 12, base: 14, lg: 16, xl: 20, "2xl": 24, "3xl": 30 } as const;

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
