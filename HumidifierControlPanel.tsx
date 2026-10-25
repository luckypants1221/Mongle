// 습도 설정 창 안의 "실제 가습기" 제어 패널
//  - 모드 선택: 자동 / 켜기 / 끄기  (바꾸면 바로 서버에 저장 -> 아두이노가 5~10초 안에 반영)
//  - 목표 습도: 부모(습도 설정 창)의 % 선택값을 그대로 사용
//  - 아두이노 상태: 연결 여부, 현재 습도, 가습기 작동 여부 (창이 열려 있는 동안 3초마다 갱신)
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import {
  getHumidifierApi,
  setHumidifierApi,
  type HumidifierMode,
  type HumidifierState,
} from "@/services/humidifierApi";

const MODES: { id: HumidifierMode; label: string }[] = [
  { id: "auto", label: "자동" },
  { id: "on", label: "켜기" },
  { id: "off", label: "끄기" },
];

const BAND = 3; // 아두이노 자동 모드 기준: 목표 ±3%

interface Props {
  userId?: string | number | null;
  active: boolean;                       // 습도 설정 창이 열려 있을 때만 통신
  targetHumidity: number;
  onServerTarget: (v: number) => void;   // 서버에 저장된 목표 습도를 화면 값에 반영
}

export function HumidifierControlPanel({ userId, active, targetHumidity, onServerTarget }: Props) {
  const colors = useColors();
  const [state, setState] = useState<HumidifierState | null>(null);
  const [mode, setMode] = useState<HumidifierMode>("auto");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const sentRef = useRef<{ mode: HumidifierMode; target: number } | null>(null);
  const onServerTargetRef = useRef(onServerTarget);
  onServerTargetRef.current = onServerTarget;

  // 창이 열리면: 서버 설정 불러오기 + 3초마다 아두이노 상태 갱신
  useEffect(() => {
    if (!active || !userId) return;
    let alive = true;
    setLoaded(false);

    const tick = async (first: boolean) => {
      try {
        const s = await getHumidifierApi(userId);
        if (!alive) return;
        setState(s);
        setError(null);
        if (first) {
          setMode(s.mode);
          sentRef.current = { mode: s.mode, target: s.target_hum };
          onServerTargetRef.current(s.target_hum);
        }
      } catch {
        if (alive) setError("서버에 연결할 수 없어요.");
      } finally {
        if (alive && first) setLoaded(true);
      }
    };

    void tick(true);
    const iv = setInterval(() => void tick(false), 3000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [active, userId]);

  const send = useCallback(
    async (m: HumidifierMode, t: number) => {
      if (!userId) return;
      setSaving(true);
      try {
        const s = await setHumidifierApi(userId, m, t);
        sentRef.current = { mode: m, target: t };
        setState(s);
        setError(null);
      } catch {
        setError("설정을 저장하지 못했어요. 서버 연결을 확인해 주세요.");
      } finally {
        setSaving(false);
      }
    },
    [userId],
  );

  // 모드나 목표 습도가 바뀌면 0.4초 뒤 서버에 저장 (연속으로 누를 때 한 번만 전송)
  useEffect(() => {
    if (!active || !loaded || !userId) return;
    const sent = sentRef.current;
    if (sent && sent.mode === mode && sent.target === targetHumidity) return;
    const timer = setTimeout(() => void send(mode, targetHumidity), 400);
    return () => clearTimeout(timer);
  }, [active, loaded, userId, mode, targetHumidity, send]);

  if (!userId) {
    return (
      <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>로그인하면 가습기를 앱으로 조절할 수 있어요.</Text>
      </View>
    );
  }

  const online = !!state?.online;
  const deviceText = !state
    ? "가습기 상태 확인 중…"
    : online
      ? `가습기 연결됨 · 현재 습도 ${state.device_hum ?? "--"}%`
      : "가습기 연결 안 됨";
  const runText = online && state?.device_on !== null && state?.device_on !== undefined
    ? (state.device_on ? "작동 중" : "멈춤")
    : null;

  const modeDesc =
    mode === "auto"
      ? `습도가 ${targetHumidity - BAND}% 아래면 켜고, ${targetHumidity + BAND}% 이상이면 꺼요.`
      : mode === "on"
        ? "습도와 관계없이 계속 켜 둬요."
        : "가습기를 꺼 둬요.";

  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* 아두이노 상태 */}
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: online ? "#4CAF50" : "#8A8FA8" }]} />
        <Text style={[styles.statusText, { color: colors.text }]} numberOfLines={1}>{deviceText}</Text>
        {runText && (
          <View style={[styles.runBadge, { backgroundColor: state?.device_on ? "#BBDDFF" : colors.card }]}>
            <Text style={[styles.runText, { color: state?.device_on ? "#1E203C" : colors.mutedForeground }]}>{runText}</Text>
          </View>
        )}
        {saving && <ActivityIndicator size="small" color="#BBDDFF" />}
      </View>
      {state && !online && (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          아두이노 전원과 와이파이(핫스팟)를 확인해 주세요. 설정은 저장되어 연결되면 적용돼요.
        </Text>
      )}

      {/* 모드 선택 */}
      <View style={styles.modeRow}>
        {MODES.map(({ id, label }) => {
          const activeMode = mode === id;
          return (
            <Pressable
              key={id}
              style={[
                styles.modeBtn,
                {
                  backgroundColor: activeMode ? "#BBDDFF" : colors.card,
                  borderColor: activeMode ? "#BBDDFF" : colors.border,
                },
              ]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setMode(id);
              }}
            >
              <Text style={[styles.modeText, { color: activeMode ? "#1E203C" : colors.text }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>{modeDesc} 가습기에 반영되기까지 최대 10초 걸려요.</Text>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  statusText: { flex: 1, fontSize: 13, fontWeight: "600" },
  runBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  runText: { fontSize: 11, fontWeight: "700" },
  modeRow: { flexDirection: "row", gap: 8 },
  modeBtn: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 10, alignItems: "center" },
  modeText: { fontSize: 14, fontWeight: "700" },
  hint: { fontSize: 11, lineHeight: 17 },
  error: { fontSize: 11, color: "#FF8A80" },
});
