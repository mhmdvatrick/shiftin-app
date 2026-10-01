// Lightweight toast system (no Alert). Mounted high in the tree.
import * as Haptics from "expo-haptics";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radius, spacing, fontSize, useTheme } from "@/src/theme";

type Tone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: Tone };

const ToastContext = createContext<{ show: (message: string, tone?: Tone) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const show = useCallback((message: string, tone: Tone = "info") => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, tone }]);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(
        tone === "error"
          ? Haptics.NotificationFeedbackType.Error
          : tone === "success"
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
      );
    }
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: insets.top + spacing.sm, left: spacing.lg, right: spacing.lg, gap: spacing.sm }}
      >
        {toasts.map((t) => {
          const bg = t.tone === "error" ? colors.error : t.tone === "success" ? colors.success : colors.surfaceInverse;
          const fg = t.tone === "error" ? colors.onError : t.tone === "success" ? colors.onSuccess : colors.onSurfaceInverse;
          return (
            <Animated.View
              key={t.id}
              entering={FadeInDown}
              exiting={FadeOutUp}
              style={{ backgroundColor: bg, borderRadius: radius.md, padding: spacing.md }}
            >
              <Text style={{ color: fg, fontSize: fontSize.base, fontWeight: "600", textAlign: "center" }}>{t.message}</Text>
            </Animated.View>
          );
        })}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
