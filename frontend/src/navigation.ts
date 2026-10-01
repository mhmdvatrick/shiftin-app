import { Platform } from "react-native";

// iOS 26+ uses native tabs (liquid glass); everything else uses the classic
// JS Tabs. "unstable" is only the import path — it is production-ready.
export const usesNativeTabs =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;
