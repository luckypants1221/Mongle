import { Feather } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type RatingKey = "total" | "humidity" | "temperature";

const RATING_ITEMS: {
  key: RatingKey;
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  description: string;
  accent: string;
}[] = [
  {
    key: "total",
    icon: "moon",
    title: "전체 수면 만족도",
    description: "오늘 수면이 전반적으로 어땠는지 알려주세요.",
    accent: "#BBDDFF",
  },
  {
    key: "humidity",
    icon: "droplet",
    title: "습도 만족도",
    description: "자는 동안의 습도가 편안했는지 평가해주세요.",
    accent: "#64B5F6",
  },
  {
    key: "temperature",
    icon: "thermometer",
    title: "온도 만족도",
    description: "수면 중 온도가 적당했는지 남겨주세요.",
    accent: "#80CBC4",
  },
];

export default function SleepRatingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [ratings, setRatings] = useState<Record<RatingKey, number>>({
    total: 0,
    humidity: 0,
    temperature: 0,
  });

  const topPad = Platform.OS === "web" ? 64 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 32 : insets.bottom + 20;
  const canSubmit = Object.values(ratings).every((rating) => rating > 0);
  const average = Math.round(
    (ratings.total + ratings.humidity + ratings.temperature) / 3
  );

  function setRating(key: RatingKey, value: number) {
    Haptics.selectionAsync();
    setRatings((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/(tabs)/records");
  }

  return (
    <LinearGradient colors={["#1A1C38", "#1E203C"]} style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad, paddingBottom: bottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Feather name="check-circle" size={28} color="#BBDDFF" />
          </View>
          <Text style={styles.title}>수면 측정 완료</Text>
          <Text style={styles.subtitle}>방금 잔 수면을 짧게 평가해주세요.</Text>
        </View>

        <View style={[styles.summary, { backgroundColor: colors.card }]}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>평균 만족도</Text>
          <Text style={[styles.summaryValue, { color: canSubmit ? "#FFE082" : colors.mutedForeground }]}>
            {canSubmit ? `${average}/5` : "--/5"}
          </Text>
        </View>

        <View style={styles.ratingList}>
          {RATING_ITEMS.map((item) => (
            <View key={item.key} style={[styles.ratingCard, { backgroundColor: colors.card }]}>
              <View style={styles.ratingHeader}>
                <View style={[styles.ratingIcon, { backgroundColor: `${item.accent}20` }]}>
                  <Feather name={item.icon} size={18} color={item.accent} />
                </View>
                <View style={styles.ratingTextWrap}>
                  <Text style={[styles.ratingTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.ratingDescription, { color: colors.mutedForeground }]}>
                    {item.description}
                  </Text>
                </View>
              </View>

              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const selected = star <= ratings[item.key];
                  return (
                    <Pressable
                      key={star}
                      onPress={() => setRating(item.key, star)}
                      style={({ pressed }) => [
                        styles.starButton,
                        {
                          backgroundColor: selected ? "#FFE082" : colors.surface,
                          borderColor: selected ? "#FFE082" : colors.border,
                          opacity: pressed ? 0.75 : 1,
                        },
                      ]}
                    >
                      <Feather
                        name="star"
                        size={18}
                        color={selected ? "#1E203C" : colors.mutedForeground}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <Pressable
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            { opacity: !canSubmit ? 0.45 : pressed ? 0.85 : 1 },
          ]}
        >
          <LinearGradient
            colors={canSubmit ? ["#BBDDFF", "#7AAAD0"] : ["#4B526D", "#3B405B"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitGradient}
          >
            <Text style={[styles.submitText, { color: canSubmit ? "#1E203C" : "#A8B0C6" }]}>
              기록 화면으로 이동
            </Text>
            <Feather name="arrow-right" size={18} color={canSubmit ? "#1E203C" : "#A8B0C6"} />
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  header: {
    alignItems: "center",
    paddingVertical: 18,
    gap: 8,
  },
  headerIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#BBDDFF18",
    borderWidth: 1,
    borderColor: "#BBDDFF35",
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "#9AA9C7",
    fontSize: 14,
    textAlign: "center",
  },
  summary: {
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryLabel: { fontSize: 13, fontWeight: "600" },
  summaryValue: { fontSize: 24, fontWeight: "800" },
  ratingList: { gap: 10 },
  ratingCard: {
    borderRadius: 16,
    padding: 14,
    gap: 14,
  },
  ratingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ratingIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingTextWrap: { flex: 1, gap: 3 },
  ratingTitle: { fontSize: 15, fontWeight: "800" },
  ratingDescription: { fontSize: 12, lineHeight: 17 },
  stars: {
    flexDirection: "row",
    gap: 8,
  },
  starButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    borderRadius: 18,
    overflow: "hidden",
    marginTop: 2,
  },
  submitGradient: {
    minHeight: 56,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitText: { fontSize: 16, fontWeight: "800" },
});
