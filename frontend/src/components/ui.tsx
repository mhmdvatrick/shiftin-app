// Shared UI primitives for Shiftin. All colors from the theme.
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  ViewStyle,
  TextStyle,
  StyleProp,
  Platform,
} from "react-native";

import { fileUrl } from "@/src/api/client";
import { makeStyles, radius, spacing, fontSize, useTheme } from "@/src/theme";

// ---------- Button ----------
export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
  testID,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useButtonStyles();
  const { colors } = useTheme();
  const bg =
    variant === "primary"
      ? colors.brandPrimary
      : variant === "danger"
        ? colors.error
        : variant === "secondary"
          ? colors.surfaceTertiary
          : "transparent";
  const fg =
    variant === "primary"
      ? colors.onBrandPrimary
      : variant === "danger"
        ? colors.onError
        : colors.onSurface;
  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === "ghost" && { backgroundColor: "transparent" },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={s.row}>
          {icon}
          <Text style={[s.label, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const useButtonStyles = makeStyles((c) => ({
  btn: {
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { fontSize: fontSize.lg, fontWeight: "700" },
}));

// ---------- TextField ----------
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
  multiline,
  testID,
  error,
  prefix,
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
  secureTextEntry?: boolean;
  autoCapitalize?: any;
  multiline?: boolean;
  testID?: string;
  error?: string;
  prefix?: string;
}) {
  const s = useFieldStyles();
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={[s.inputWrap, error ? s.inputError : null, multiline ? s.multi : null]}>
        {prefix ? <Text style={s.prefix}>{prefix}</Text> : null}
        <TextInput
          testID={testID}
          style={s.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
        />
      </View>
      {error ? <Text style={s.errorText}>{error}</Text> : null}
    </View>
  );
}

const useFieldStyles = makeStyles((c) => ({
  label: { fontSize: fontSize.base, fontWeight: "600", color: c.onSurfaceSecondary },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
  multi: { alignItems: "flex-start", paddingVertical: spacing.sm },
  inputError: { borderColor: c.error },
  prefix: { color: c.onSurfaceTertiary, fontSize: fontSize.lg, fontWeight: "600", marginRight: spacing.xs },
  input: { flex: 1, minHeight: 52, color: c.onSurface, fontSize: fontSize.lg },
  errorText: { color: c.error, fontSize: fontSize.sm },
}));

// ---------- Chip ----------
export function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const s = useChipStyles();
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (onPress) {
          if (Platform.OS !== "web") Haptics.selectionAsync();
          onPress();
        }
      }}
      style={[
        s.chip,
        {
          backgroundColor: selected ? colors.brandPrimary : colors.surfaceTertiary,
          borderColor: selected ? colors.brandPrimary : colors.border,
        },
      ]}
    >
      <Text style={[s.chipText, { color: selected ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const useChipStyles = makeStyles((c) => ({
  chip: {
    height: 36,
    flexShrink: 0,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: fontSize.base, fontWeight: "600" },
}));

// ---------- Card ----------
export function Card({
  children,
  onPress,
  style,
  testID,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const s = useCardStyles();
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [s.card, style, pressed && { opacity: 0.9 }]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[s.card, style]}>
      {children}
    </View>
  );
}

const useCardStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
}));

// ---------- StatusChip ----------
export function StatusChip({ label, tone }: { label: string; tone: "neutral" | "success" | "warning" | "info" | "error" }) {
  const { colors } = useTheme();
  const map = {
    neutral: { bg: colors.surfaceTertiary, fg: colors.onSurfaceTertiary },
    success: { bg: colors.success, fg: colors.onSuccess },
    warning: { bg: colors.warning, fg: colors.onWarning },
    info: { bg: colors.info, fg: colors.onInfo },
    error: { bg: colors.error, fg: colors.onError },
  }[tone];
  return (
    <View style={{ backgroundColor: map.bg, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, alignSelf: "flex-start" }}>
      <Text style={{ color: map.fg, fontSize: fontSize.sm, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

// ---------- StarRating ----------
export function StarRating({
  value,
  onChange,
  size = 20,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: spacing.xs }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          testID={`star-${n}`}
          disabled={!onChange}
          onPress={() => {
            if (onChange) {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              onChange(n);
            }
          }}
        >
          <Text style={{ fontSize: size, color: n <= value ? colors.brandPrimary : colors.border }}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ---------- Avatar ----------
export function Avatar({ name, uri, size = 44 }: { name?: string | null; uri?: string | null; size?: number }) {
  const { colors } = useTheme();
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.brandTertiary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.onBrandTertiary, fontWeight: "800", fontSize: size * 0.4 }}>{initial}</Text>
    </View>
  );
}

// ---------- RemoteImage (auth-aware storage image) ----------
export function RemoteImage({
  path,
  style,
  contentFit = "cover",
}: {
  path: string | null | undefined;
  style: StyleProp<ViewStyle>;
  contentFit?: "cover" | "contain";
}) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fileUrl(path).then((u) => active && setUri(u));
    return () => {
      active = false;
    };
  }, [path]);
  if (!uri) return <View style={style} />;
  return <Image source={{ uri }} style={style as any} contentFit={contentFit} transition={200} />;
}

// ---------- EmptyState ----------
export function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
  testID,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  const s = useEmptyStyles();
  return (
    <View testID={testID} style={s.wrap}>
      <Text style={s.emoji}>🍽️</Text>
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button title={actionLabel} onPress={onAction} variant="secondary" testID="empty-action" />
        </View>
      ) : null}
    </View>
  );
}

const useEmptyStyles = makeStyles((c) => ({
  wrap: { alignItems: "center", justifyContent: "center", padding: spacing["2xl"], gap: spacing.sm },
  emoji: { fontSize: 44 },
  title: { fontSize: fontSize.xl, fontWeight: "800", color: c.onSurface, textAlign: "center" },
  subtitle: { fontSize: fontSize.base, color: c.muted, textAlign: "center" },
}));

// ---------- Skeleton ----------
export function Skeleton({ height = 16, width = "100%", radius: r = radius.sm, style }: { height?: number; width?: any; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ height, width, borderRadius: r, backgroundColor: colors.surfaceTertiary }, style]} />;
}

export function JobCardSkeleton() {
  return (
    <Card style={{ gap: spacing.md }}>
      <Skeleton height={20} width="60%" />
      <Skeleton height={14} width="40%" />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Skeleton height={28} width={80} radius={radius.pill} />
        <Skeleton height={28} width={80} radius={radius.pill} />
      </View>
      <Skeleton height={14} width="80%" />
    </Card>
  );
}

// ---------- ErrorView ----------
export function ErrorView({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", padding: spacing["2xl"], gap: spacing.md }}>
      <Text style={{ fontSize: 40 }}>😕</Text>
      <Text style={{ color: colors.onSurface, fontSize: fontSize.lg, fontWeight: "700", textAlign: "center" }}>
        {message || "Terjadi kesalahan"}
      </Text>
      {onRetry ? <Button title="Coba Lagi" variant="secondary" onPress={onRetry} testID="retry-button" /> : null}
    </View>
  );
}

// ---------- Text helpers ----------
export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[{ fontSize: fontSize["2xl"], fontWeight: "800", color: colors.onSurface }, style]}>{children}</Text>;
}
export function Muted({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[{ fontSize: fontSize.base, color: colors.muted }, style]}>{children}</Text>;
}
