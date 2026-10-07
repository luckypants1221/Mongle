import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSleep } from "@/context/SleepContext";
import { useColors } from "@/hooks/useColors";
export function AccountDataNotice() {
  const { recordsLoading, recordsError, refreshRecords } = useSleep();
  const colors = useColors();
  if (!recordsLoading && !recordsError) return null;
  return <View style={{ padding: 12, borderRadius: 14, gap: 8, backgroundColor: colors.card }}>
    <Text style={{ color: recordsError ? colors.destructive : colors.mutedForeground, fontSize: 12, lineHeight: 18 }} accessibilityLiveRegion="polite">
      {recordsLoading ? "현재 계정의 수면 기록을 불러오는 중이에요." : recordsError}
    </Text>
    {recordsError && !recordsLoading && <Pressable accessibilityRole="button" onPress={() => { void refreshRecords(); }}>
      <Text style={{ color: colors.primary, paddingVertical: 6, fontSize: 13 }}>다시 불러오기</Text>
    </Pressable>}
  </View>;
}
