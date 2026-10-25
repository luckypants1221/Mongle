import { Feather } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { HumidifierControlPanel } from "@/components/HumidifierControlPanel";

export type EnvType = "music" | "humidity" | "lighting" | null;

interface EnvState {
  music: string;
  humidity: number;
  lighting: string;
  setMusic: (v: string) => void;
  setHumidity: (v: number) => void;
  setLighting: (v: string) => void;
}

interface Props {
  visible: EnvType;
  onClose: () => void;
  env: EnvState;
  recommendedHumidity?: number | null;
  recommendedTemperature?: number | null;
  userId?: string | number | null;       // 가습기 원격 제어용 (로그인 user_id)
}

const MUSIC_LIST = [
  { id: "none", icon: "volume-x" as const, label: "없음", desc: "조용한 수면" },
  { id: "nature", icon: "wind" as const, label: "자연음", desc: "숲속 바람 소리" },
  { id: "rain", icon: "cloud-rain" as const, label: "빗소리", desc: "잔잔한 빗소리" },
  { id: "white", icon: "radio" as const, label: "백색소음", desc: "집중 수면 유도" },
];

const LIGHTING_LIST = [
  { id: "off", label: "끄기", icon: "moon" as const, desc: "완전 암실" },
  { id: "on", label: "켜기", icon: "sun" as const, desc: "밝은 환경" },
];

export function EnvModal({ visible, onClose, env, recommendedHumidity, recommendedTemperature, userId }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isOpen = visible !== null;

  function title() {
    if (visible === "music") return "수면 음악";
    if (visible === "humidity") return "습도 설정";
    if (visible === "lighting") return "조명 설정";
    return "";
  }

  function icon(): React.ComponentProps<typeof Feather>["name"] {
    if (visible === "music") return "music";
    if (visible === "humidity") return "droplet";
    return "sun";
  }

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
        {/* 핸들 */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* 헤더 */}
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: "#BBDDFF15" }]}>
            <Feather name={icon()} size={20} color="#BBDDFF" />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title()}</Text>
          <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.surface }]}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* 음악 선택 */}
        {visible === "music" && (
          <View style={styles.body}>
            {MUSIC_LIST.map(({ id, icon: ic, label, desc }) => {
              const active = env.music === id;
              return (
                <Pressable
                  key={id}
                  style={[
                    styles.optionRow,
                    { backgroundColor: active ? "#BBDDFF12" : colors.surface, borderColor: active ? "#BBDDFF" : colors.border },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    env.setMusic(id);
                  }}
                >
                  <View style={[styles.optionIcon, { backgroundColor: active ? "#BBDDFF20" : colors.card }]}>
                    <Feather name={ic} size={20} color={active ? "#BBDDFF" : colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: active ? "#BBDDFF" : colors.text }]}>{label}</Text>
                    <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>{desc}</Text>
                  </View>
                  {active && <Feather name="check-circle" size={20} color="#BBDDFF" />}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* 습도 조절 */}
        {visible === "humidity" && (
          <ScrollView style={{ maxHeight: HUM_SCROLL_MAX }} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={[styles.humDisplay, { backgroundColor: colors.surface }]}>
              <Text style={[styles.humBigNum, { color: "#BBDDFF" }]}>{env.humidity}%</Text>
              <Text style={[styles.humLabel, { color: colors.mutedForeground }]}>목표 습도</Text>
              <Text style={[
                styles.humStatus,
                { color: env.humidity >= 40 && env.humidity <= 60 ? "#4CAF50" : "#FFE082" }
              ]}>
                {env.humidity >= 40 && env.humidity <= 60 ? "적정 범위" : "권장: 40~60%"}
              </Text>
            </View>
            <HumidifierControlPanel
              userId={userId}
              active={visible === "humidity"}
              targetHumidity={env.humidity}
              onServerTarget={env.setHumidity}
            />
            <View style={[styles.recommendBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {recommendedHumidity !== null && recommendedHumidity !== undefined ? (
                <>
                  <View style={styles.recommendInfo}>
                    <Text style={[styles.recommendTitle, { color: colors.text }]}>최근 30일 기록 기반 추천 습도</Text>
                    <Text style={styles.recommendValue}>{recommendedHumidity}%</Text>
                    <Text style={[styles.recommendHint, { color: colors.mutedForeground }]}>수면 점수가 높은 날의 평균 습도이며 최적값을 보장하지 않습니다.</Text>
                  </View>
                  <Pressable
                    style={styles.recommendButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      env.setHumidity(Math.max(30, Math.min(70, recommendedHumidity)));
                    }}
                  >
                    <Text style={styles.recommendButtonText}>적용</Text>
                  </Pressable>
                </>
              ) : (
                <Text style={[styles.recommendHint, { color: colors.mutedForeground }]}>최근 30일간 유효한 수면 기록이 5개 이상 쌓이면 추천 습도를 표시합니다.</Text>
              )}
            </View>
            <View style={[styles.recommendBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.recommendTitle, { color: colors.text }]}>최근 30일 기록 기반 추천 온도</Text>
              {recommendedTemperature !== null && recommendedTemperature !== undefined ? (
                <Text style={styles.recommendValue}>{recommendedTemperature}°C</Text>
              ) : (
                <Text style={[styles.recommendHint, { color: colors.mutedForeground }]}>유효한 온도 기록 5개 이상 필요</Text>
              )}
              <Text style={[styles.recommendHint, { color: colors.mutedForeground }]}>수면 점수가 높은 날의 평균 온도입니다. 온도 제어 기능은 포함되지 않습니다.</Text>
            </View>
            <View style={styles.humControls}>
              {[30, 35, 40, 45, 50, 55, 60, 65, 70].map((v) => {
                const active = env.humidity === v;
                const optimal = v >= 40 && v <= 60;
                return (
                  <Pressable
                    key={v}
                    style={[
                      styles.humChip,
                      {
                        backgroundColor: active ? "#BBDDFF" : optimal ? "#BBDDFF12" : colors.surface,
                        borderColor: active ? "#BBDDFF" : optimal ? "#BBDDFF40" : colors.border,
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      env.setHumidity(v);
                    }}
                  >
                    <Text style={[styles.humChipText, { color: active ? "#1E203C" : optimal ? "#BBDDFF" : colors.mutedForeground }]}>
                      {v}%
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.humBtnRow}>
              <Pressable
                style={[styles.humAdjBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => { if (env.humidity > 30) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); env.setHumidity(env.humidity - 5); } }}
              >
                <Feather name="minus" size={20} color={colors.text} />
              </Pressable>
              <View style={[styles.humBar, { backgroundColor: colors.surface }]}>
                <View style={[styles.humFill, { width: `${((env.humidity - 30) / 40) * 100}%`, backgroundColor: "#BBDDFF" }]} />
              </View>
              <Pressable
                style={[styles.humAdjBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => { if (env.humidity < 70) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); env.setHumidity(env.humidity + 5); } }}
              >
                <Feather name="plus" size={20} color={colors.text} />
              </Pressable>
            </View>
          </ScrollView>
        )}

        {/* 조명 설정 */}
        {visible === "lighting" && (
          <View style={styles.body}>
            {LIGHTING_LIST.map(({ id, icon: ic, label, desc }) => {
              const active = env.lighting === id;
              return (
                <Pressable
                  key={id}
                  style={[
                    styles.optionRow,
                    { backgroundColor: active ? "#FFE08212" : colors.surface, borderColor: active ? "#FFE082" : colors.border },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    env.setLighting(id);
                  }}
                >
                  <View style={[styles.optionIcon, { backgroundColor: active ? "#FFE08220" : colors.card }]}>
                    <Feather name={ic} size={20} color={active ? "#FFE082" : colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: active ? "#FFE082" : colors.text }]}>{label}</Text>
                    <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>{desc}</Text>
                  </View>
                  {active && <Feather name="check-circle" size={20} color="#FFE082" />}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* 확인 버튼 */}
        <Pressable style={styles.confirmBtn} onPress={onClose}>
          <LinearGradient colors={["#FFE082", "#FFD040"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmGrad}>
            <Text style={styles.confirmText}>확인</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </Modal>
  );
}

const HUM_SCROLL_MAX = Math.round(Dimensions.get("window").height * 0.62);

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    gap: 16,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 18, fontWeight: "700" },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  body: { gap: 10 },
  optionRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 16, borderWidth: 1.5, padding: 14,
  },
  optionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  optionLabel: { fontSize: 15, fontWeight: "600" },
  optionDesc: { fontSize: 12, marginTop: 2 },
  recommendBox: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 10 },
  recommendInfo: { gap: 4 },
  recommendTitle: { fontSize: 12, fontWeight: "600" },
  recommendValue: { fontSize: 24, fontWeight: "800", color: "#BBDDFF" },
  recommendHint: { fontSize: 11, lineHeight: 17 },
  recommendButton: { alignSelf: "flex-start", backgroundColor: "#BBDDFF", borderRadius: 9, paddingVertical: 8, paddingHorizontal: 16 },
  recommendButtonText: { fontSize: 12, fontWeight: "700", color: "#1E203C" },
  humDisplay: { alignItems: "center", borderRadius: 20, paddingVertical: 20, gap: 4 },
  humBigNum: { fontSize: 52, fontWeight: "700" },
  humLabel: { fontSize: 13 },
  humStatus: { fontSize: 12, fontWeight: "600" },
  humControls: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  humChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  humChipText: { fontSize: 13, fontWeight: "600" },
  humBtnRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  humAdjBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  humBar: { flex: 1, height: 10, borderRadius: 5, overflow: "hidden" },
  humFill: { height: "100%", borderRadius: 5 },
  confirmBtn: { borderRadius: 16, overflow: "hidden" },
  confirmGrad: { paddingVertical: 16, alignItems: "center" },
  confirmText: { color: "#1E203C", fontSize: 16, fontWeight: "800" },
});
