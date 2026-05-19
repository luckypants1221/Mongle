import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  if (Platform.OS === "web") return 84;
  return 60 + insets.bottom;
}
