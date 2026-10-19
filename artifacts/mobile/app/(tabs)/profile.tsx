import { Feather } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useSleep } from "@/context/SleepContext";
import { useColors } from "@/hooks/useColors";
import { useTabBarHeight } from "@/hooks/useTabBarHeight";

/* ─── 공통 설정 행 ──────────────────────────────────── */
interface SettingRowProps {
  icon: React.ComponentProps<typeof Feather>["name"];
  iconColor: string;
  label: string;
  value?: string;
  onPress?: () => void;
  rightEl?: React.ReactNode;
}
function SettingRow({ icon, iconColor, label, value, onPress, rightEl }: SettingRowProps) {
  const colors = useColors();
  return (
    <Pressable
      style={({ pressed }) => [styles.settingRow, { opacity: pressed && !!onPress ? 0.7 : 1 }]}
      onPress={onPress}
      disabled={!onPress && !rightEl}
    >
      <View style={[styles.settingIconBg, { backgroundColor: iconColor + "22" }]}>
        <Feather name={icon} size={16} color={iconColor} />
      </View>
      <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {value && <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>{value}</Text>}
      {rightEl}
      {!rightEl && onPress && (
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
      )}
    </Pressable>
  );
}

/* ─── 메인 화면 ─────────────────────────────────────── */
export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const { user, logout, changePassword } = useAuth();
  const {
    averageDuration, averageScore, records,
    alarmHour, alarmMin, alarmOn,
    setAlarm, setAlarmOn,
    alarmPresets, addAlarmPreset, editAlarmPreset, removeAlarmPreset,
  } = useSleep();

  /* 알람 시간 모달 상태 */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftPM, setDraftPM] = useState(false);
  const [hourText, setHourText] = useState("7");
  const [minText, setMinText] = useState("00");
  // null: 알람 시간 직접 설정 / "new": 프리셋 추가 / {h,m}: 프리셋 수정
  const [editTarget, setEditTarget] = useState<null | "new" | { h: number; m: number }>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const period = alarmHour < 12 ? "오전" : "오후";
  const hour12 = alarmHour === 0 ? 12 : alarmHour > 12 ? alarmHour - 12 : alarmHour;

  const parsed = parseDraft();
  const draftPeriod = draftPM ? "오후" : "오전";
  const previewStr = parsed
    ? `${String(parsed.h12).padStart(2, "0")}:${String(parsed.m).padStart(2, "0")}`
    : "--:--";

  function loadDraft(h: number, m: number) {
    setDraftPM(h >= 12);
    setHourText(String(h === 0 ? 12 : h > 12 ? h - 12 : h));
    setMinText(String(m).padStart(2, "0"));
  }

  function parseDraft(): { h: number; m: number; h12: number } | null {
    const h12 = parseInt(hourText, 10);
    const m = parseInt(minText, 10);
    if (isNaN(h12) || isNaN(m) || h12 < 1 || h12 > 12 || m < 0 || m > 59) return null;
    return { h: (h12 % 12) + (draftPM ? 12 : 0), m, h12 };
  }

  function closePicker() {
    setPickerOpen(false);
    setEditTarget(null);
  }

  function openPicker() {
    setEditTarget(null);
    loadDraft(alarmHour, alarmMin);
    setPickerOpen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function openPresetEditor(target: "new" | { h: number; m: number }) {
    if (target === "new") loadDraft(7, 0);
    else loadDraft(target.h, target.m);
    setEditTarget(target);
    setPickerOpen(true);
  }

  function fmtPreset(h: number, m: number) {
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h < 12 ? "오전" : "오후"} ${h12}:${String(m).padStart(2, "0")}`;
  }

  function onPresetLongPress(p: { h: number; m: number }) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(fmtPreset(p.h, p.m), "이 알람 시간을 어떻게 할까요?", [
      { text: "수정", onPress: () => openPresetEditor(p) },
      { text: "삭제", style: "destructive", onPress: () => removeAlarmPreset(p.h, p.m) },
      { text: "취소", style: "cancel" },
    ]);
  }

  async function confirmAlarm() {
    const t = parseDraft();
    if (!t) {
      Alert.alert("시간 확인", "시는 1~12, 분은 0~59 사이로 입력해주세요.");
      return;
    }
    if (editTarget === "new") {
      await addAlarmPreset(t.h, t.m);
    } else if (editTarget) {
      await editAlarmPreset(editTarget.h, editTarget.m, t.h, t.m);
    } else {
      await setAlarm(t.h, t.m);
    }
    closePicker();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleLogout() {
    Alert.alert("로그아웃", "정말 로그아웃 하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃", style: "destructive",
        onPress: async () => { await logout(); router.replace("/(auth)/login"); },
      },
    ]);
  }

  /* 비밀번호 변경 */
  const [userUpdatePicker, setUserUpdatePicker] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function closeUserModal() {
    setUserUpdatePicker(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function handleProfileUpdate() {
    if (!user) return;

    if (!currentPassword || !newPassword) {
      Alert.alert("오류", "비밀번호를 모두 입력해주세요.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("오류", "새 비밀번호가 일치하지 않습니다.");
      return;
    }

    const success = await changePassword(user.id, currentPassword, newPassword);

    if (success) {
      Alert.alert("완료", "비밀번호가 변경되었습니다.");
      closeUserModal();
    } else {
      Alert.alert("오류", "현재 비밀번호가 올바르지 않습니다.");
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: tabBarHeight + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 프로필 헤더 */}
        <LinearGradient colors={["#252848", "#1E203C"]} style={styles.profileHeader}>
          <Text style={styles.pageTitle}>마이페이지</Text>
          <View style={styles.profileCard}>
            <Image source={require("@/assets/images/logo_nobg.png")} style={styles.avatarLogo} resizeMode="contain" />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name ?? "사용자"}</Text>
              <Text style={styles.profileEmail}>{user?.email ?? ""}</Text>
            </View>
            <Pressable style={styles.editBtn} onPress={() => setUserUpdatePicker(true)}>
              <Feather name="edit-2" size={14} color="#FFE082" />
            </Pressable>
          </View>
          <View style={styles.miniStatsRow}>
            {[
              { label: "총 기록", value: `${records.length}회`, icon: "calendar" as const, color: "#BBDDFF" },
              { label: "평균 수면", value: `${Math.floor(averageDuration / 60)}h`, icon: "clock" as const, color: "#80CBC4" },
              { label: "평균 점수", value: `${averageScore}점`, icon: "star" as const, color: "#FFE082" },
            ].map(({ label, value, icon, color }) => (
              <View key={label} style={[styles.miniStat, { backgroundColor: "rgba(187,221,255,0.06)" }]}>
                <Feather name={icon} size={16} color={color} />
                <Text style={styles.miniStatVal}>{value}</Text>
                <Text style={styles.miniStatLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* 기상 알람 카드 */}
        <View style={[styles.alarmCard, { backgroundColor: colors.card, marginHorizontal: 16 }]}>
          <View style={styles.alarmCardHeader}>
            <View style={[styles.iconWrap, { backgroundColor: "#FFE08220" }]}>
              <Feather name="bell" size={17} color="#FFE082" />
            </View>
            <Text style={[styles.alarmCardTitle, { color: colors.text }]}>기상 알람</Text>
            <Switch
              value={alarmOn}
              onValueChange={(v) => { setAlarmOn(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              trackColor={{ false: colors.muted, true: "#BBDDFF" }}
              thumbColor="#fff"
            />
          </View>

          {/* 큰 시간 표시 */}
          <Pressable
            style={({ pressed }) => [
              styles.alarmFace,
              { backgroundColor: colors.surface, opacity: alarmOn ? (pressed ? 0.75 : 1) : 0.4 },
            ]}
            onPress={alarmOn ? openPicker : undefined}
          >
            <Text style={[styles.alarmPeriod, { color: colors.mutedForeground }]}>{period}</Text>
            <Text style={[styles.alarmBigTime, { color: "#BBDDFF" }]}>
              {String(hour12).padStart(2, "0")}:{String(alarmMin).padStart(2, "0")}
            </Text>
            <View style={[styles.alarmEditChip, { backgroundColor: alarmOn ? "#BBDDFF20" : "transparent", borderColor: alarmOn ? "#BBDDFF50" : "transparent" }]}>
              <Feather name="edit-3" size={12} color={alarmOn ? "#BBDDFF" : colors.muted} />
              <Text style={[styles.alarmEditText, { color: alarmOn ? "#BBDDFF" : colors.muted }]}>탭하여 수정</Text>
            </View>
          </Pressable>

          {/* 빠른 선택 칩 */}
          <View style={styles.quickChips}>
            {alarmPresets.map(({ h, m }) => {
              const active = alarmHour === h && alarmMin === m && alarmOn;
              const lbl = fmtPreset(h, m);
              return (
                <Pressable
                  key={lbl}
                  style={[styles.quickChip, {
                    backgroundColor: active ? "#BBDDFF" : colors.surface,
                    borderColor: active ? "#BBDDFF" : colors.border,
                    opacity: alarmOn ? 1 : 0.4,
                  }]}
                  onPress={() => {
                    if (!alarmOn) return;
                    setAlarm(h, m);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  onLongPress={() => onPresetLongPress({ h, m })}
                >
                  <Text style={[styles.quickChipText, { color: active ? "#1E203C" : colors.mutedForeground }]}>{lbl}</Text>
                </Pressable>
              );
            })}
            <Pressable
              style={[styles.quickChip, { backgroundColor: colors.surface, borderColor: colors.border, borderStyle: "dashed" }]}
              onPress={() => openPresetEditor("new")}
            >
              <Text style={[styles.quickChipText, { color: "#BBDDFF" }]}>+ 추가</Text>
            </Pressable>
          </View>
        </View>

        {/* 일반 설정 */}
        <View style={[styles.section, { backgroundColor: colors.card, marginHorizontal: 16 }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>설정</Text>
          <SettingRow icon="user" iconColor="#BBDDFF" label="기본 정보" value={user?.name} onPress={() => Alert.alert("알림", "준비 중입니다.")} />
          <View style={[styles.sep, { backgroundColor: colors.border }]} />
          <SettingRow icon="shield" iconColor="#66BB6A" label="개인정보 보호"
            onPress={() => Alert.alert("개인정보 처리방침", "수집된 정보는 수면 측정 목적으로만 사용됩니다.")} />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, marginHorizontal: 16 }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>앱 정보</Text>
          <SettingRow icon="info" iconColor="#7A8AA6" label="앱 버전" value="1.0.0" />
        </View>

        <Pressable
          style={({ pressed }) => [styles.logoutBtn, { borderColor: colors.destructive, opacity: pressed ? 0.7 : 1 }]}
          onPress={handleLogout}
        >
          <Feather name="log-out" size={18} color={colors.destructive} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>로그아웃</Text>
        </Pressable>
      </ScrollView>

      {/* ── 회원정보(비밀번호) 수정 모달 ── */}
      <Modal
        visible={userUpdatePicker}
        transparent
        animationType="slide"
        onRequestClose={closeUserModal}
      >
        <KeyboardAvoidingView
          style={styles.userBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.userSheet, { backgroundColor: colors.card }]}>
            <Pressable style={styles.userCloseBtn} onPress={closeUserModal}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>

            <Text style={[styles.userTitle, { color: colors.text }]}>비밀번호 변경</Text>

            <Text style={[styles.userLabel, { color: colors.mutedForeground }]}>현재 비밀번호</Text>
            <View style={[styles.inputIconWrap, { backgroundColor: colors.surface }]}>
              <Feather name="lock" size={18} color="#BBDDFF" />
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="현재 비밀번호 입력"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                autoCapitalize="none"
                style={{ flex: 1, color: colors.text }}
              />
            </View>

            <Text style={[styles.userLabel, { color: colors.mutedForeground }]}>새 비밀번호</Text>
            <View style={[styles.inputIconWrap, { backgroundColor: colors.surface }]}>
              <Feather name="lock" size={18} color="#FFE082" />
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="새 비밀번호"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                autoCapitalize="none"
                style={{ flex: 1, color: colors.text }}
              />
            </View>

            <View style={[styles.inputIconWrap, { backgroundColor: colors.surface }]}>
              <Feather name="shield" size={18} color="#80CBC4" />
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="새 비밀번호 확인"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                autoCapitalize="none"
                style={{ flex: 1, color: colors.text }}
              />
            </View>

            <Pressable style={styles.userSaveBtn} onPress={handleProfileUpdate}>
              <LinearGradient colors={["#FFE082", "#FFD040"]} style={styles.userSaveGrad}>
                <Feather name="lock" size={18} color="#1E203C" />
                <Text style={styles.userSaveText}>저장하기</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 알람 시간 설정 모달 ── */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={closePicker}>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.backdrop} onPress={closePicker} />
          <View style={[styles.pickerSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.pickerTitle, { color: colors.text }]}>
              {editTarget === "new" ? "알람 시간 추가" : editTarget ? "알람 시간 수정" : "기상 알람 설정"}
            </Text>

            {/* 미리보기 */}
            <View style={[styles.pickerPreview, { backgroundColor: colors.surface }]}>
              <Text style={[styles.previewPeriod, { color: colors.mutedForeground }]}>{draftPeriod}</Text>
              <Text style={[styles.previewTime, { color: "#BBDDFF" }]}>{previewStr}</Text>
            </View>

            {/* 오전 / 오후 */}
            <View style={styles.ampmRow}>
              {[{ label: "오전", pm: false }, { label: "오후", pm: true }].map(({ label, pm }) => {
                const active = draftPM === pm;
                return (
                  <Pressable
                    key={label}
                    style={[styles.ampmBtn, {
                      backgroundColor: active ? "#BBDDFF" : colors.surface,
                      borderColor: active ? "#BBDDFF" : colors.border,
                    }]}
                    onPress={() => { setDraftPM(pm); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  >
                    <Text style={[styles.ampmText, { color: active ? "#1E203C" : colors.mutedForeground }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 시간 직접 입력 */}
            <View style={styles.timeInputRow}>
              <View style={styles.spinnerWrap}>
                <Text style={[styles.spinnerLabel, { color: colors.mutedForeground }]}>시 (1~12)</Text>
                <TextInput
                  value={hourText}
                  onChangeText={(t) => setHourText(t.replace(/[^0-9]/g, "").slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  placeholder="07"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.timeInput, { backgroundColor: colors.surface, color: "#BBDDFF" }]}
                />
              </View>
              <Text style={[styles.spinnerColon, { color: "#BBDDFF" }]}>:</Text>
              <View style={styles.spinnerWrap}>
                <Text style={[styles.spinnerLabel, { color: colors.mutedForeground }]}>분 (0~59)</Text>
                <TextInput
                  value={minText}
                  onChangeText={(t) => setMinText(t.replace(/[^0-9]/g, "").slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  placeholder="00"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.timeInput, { backgroundColor: colors.surface, color: "#BBDDFF" }]}
                />
              </View>
            </View>

            {/* 빠른 선택 */}
            <View style={styles.quickRow}>
              {[{ h: 6, m: 0 }, { h: 7, m: 0 }, { h: 7, m: 30 }, { h: 8, m: 0 }].map(({ h, m }) => {
                const active = parsed?.h === h && parsed?.m === m;
                const lbl = fmtPreset(h, m);
                return (
                  <Pressable
                    key={lbl}
                    style={[styles.quickBtn, {
                      backgroundColor: active ? "#BBDDFF" : colors.surface,
                      borderColor: active ? "#BBDDFF" : colors.border,
                    }]}
                    onPress={() => { loadDraft(h, m); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  >
                    <Text style={[styles.quickBtnText, { color: active ? "#1E203C" : colors.mutedForeground }]}>{lbl}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 확인 */}
            <Pressable style={styles.confirmBtn} onPress={confirmAlarm}>
              <LinearGradient colors={["#FFE082", "#FFD040"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmGrad}>
                <Feather name="bell" size={18} color="#1E203C" />
                <Text style={styles.confirmText}>
                  {editTarget === "new" ? "추가하기" : "알람 설정 완료"}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 12 },

  profileHeader: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  pageTitle: { fontSize: 26, fontWeight: "700", color: "#BBDDFF", paddingTop: 16 },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "rgba(187,221,255,0.06)", borderRadius: 18, padding: 14 },
  avatarLogo: { width: 56, height: 56 },
  profileInfo: { flex: 1, gap: 3 },
  profileName: { fontSize: 17, fontWeight: "700", color: "#fff" },
  profileEmail: { fontSize: 12, color: "#7A8AA6" },
  editBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,224,130,0.12)", alignItems: "center", justifyContent: "center" },
  miniStatsRow: { flexDirection: "row", gap: 10 },
  miniStat: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 4 },
  miniStatVal: { fontSize: 18, fontWeight: "700", color: "#fff" },
  miniStatLabel: { fontSize: 10, color: "#7A8AA6" },

  alarmCard: { borderRadius: 20, padding: 16, gap: 14 },
  alarmCardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  alarmCardTitle: { flex: 1, fontSize: 15, fontWeight: "600" },
  alarmFace: { borderRadius: 20, padding: 20, alignItems: "center", gap: 4 },
  alarmPeriod: { fontSize: 14, fontWeight: "500" },
  alarmBigTime: { fontSize: 56, fontWeight: "700", letterSpacing: -1 },
  alarmEditChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5, marginTop: 4 },
  alarmEditText: { fontSize: 12, fontWeight: "500" },
  quickChips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  quickChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  quickChipText: { fontSize: 12, fontWeight: "600" },

  section: { borderRadius: 20, padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  settingRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  settingIconBg: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  settingLabel: { fontSize: 15 },
  settingValue: { fontSize: 13 },
  sep: { height: 1, marginLeft: 46, marginVertical: 2 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 16, borderWidth: 1.5, paddingVertical: 16, marginHorizontal: 16 },
  logoutText: { fontSize: 16, fontWeight: "600" },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  pickerSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingHorizontal: 24, gap: 16 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  pickerTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  pickerPreview: { borderRadius: 16, padding: 14, alignItems: "center", gap: 2 },
  previewPeriod: { fontSize: 13 },
  previewTime: { fontSize: 40, fontWeight: "700", letterSpacing: 2 },
  spinnerWrap: { alignItems: "center", gap: 8 },
  spinnerLabel: { fontSize: 12, fontWeight: "600" },
  spinnerColon: { fontSize: 40, fontWeight: "700", marginTop: 20 },
  ampmRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
  ampmBtn: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  ampmText: { fontSize: 15, fontWeight: "700" },
  timeInputRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  timeInput: { width: 96, height: 80, borderRadius: 20, fontSize: 40, fontWeight: "800", textAlign: "center" },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  quickBtn: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  quickBtnText: { fontSize: 12, fontWeight: "600" },
  confirmBtn: { borderRadius: 16, overflow: "hidden" },
  confirmGrad: { paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  confirmText: { color: "#1E203C", fontSize: 16, fontWeight: "800" },

  userSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
  },
  userTitle: { fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 10 },
  userLabel: { fontSize: 13, fontWeight: "600" },
  userSaveBtn: { borderRadius: 16, overflow: "hidden", marginTop: 12 },
  userSaveGrad: { paddingVertical: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  userSaveText: { fontSize: 16, fontWeight: "700", color: "#1E203C" },
  userCloseBtn: { position: "absolute", right: 20, top: 20 },
  userBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  inputIconWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    height: 54,
  },
});