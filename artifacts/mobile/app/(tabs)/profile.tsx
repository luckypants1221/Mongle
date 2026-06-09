import { Feather } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useSleep } from "@/context/SleepContext";
import { useColors } from "@/hooks/useColors";
import { useTabBarHeight } from "@/hooks/useTabBarHeight";
import { TextInput } from "react-native-gesture-handler";

/* ─── 시간 피커 ──────────────────────────────────────── */
function TimeSpinner({
  value, min, max, onChange, padded = true,
}: { value: number; min: number; max: number; onChange: (v: number) => void; padded?: boolean }) {
  const colors = useColors();
  function dec() { const v = value <= min ? max : value - 1; onChange(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }
  function inc() { const v = value >= max ? min : value + 1; onChange(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }
  const display = padded ? String(value).padStart(2, "0") : String(value);
  return (
    <View style={sp.wrap}>
      <Pressable onPress={inc} style={({ pressed }) => [sp.arrowBtn, { backgroundColor: colors.surface, opacity: pressed ? 0.6 : 1 }]}>
        <Feather name="chevron-up" size={22} color="#BBDDFF" />
      </Pressable>
      <View style={[sp.numBox, { backgroundColor: colors.background }]}>
        <Text style={[sp.num, { color: "#BBDDFF" }]}>{display}</Text>
      </View>
      <Pressable onPress={dec} style={({ pressed }) => [sp.arrowBtn, { backgroundColor: colors.surface, opacity: pressed ? 0.6 : 1 }]}>
        <Feather name="chevron-down" size={22} color="#BBDDFF" />
      </Pressable>
    </View>
  );
}

const sp = StyleSheet.create({
  wrap: { alignItems: "center", gap: 8 },
  arrowBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  numBox: { width: 80, height: 80, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  num: { fontSize: 40, fontWeight: "800", letterSpacing: 1 },
});

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
  const { user, logout } = useAuth();
  const { averageDuration, averageScore, records, alarmHour, alarmMin, alarmOn, setAlarm, setAlarmOn, monthlyAverageDuration, monthlyAverageScore,
  } = useSleep();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftHour, setDraftHour] = useState(7);
  const [draftMin, setDraftMin] = useState(0);
  const [sleepGoal, setSleepGoal] = useState(480);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const period = alarmHour < 12 ? "오전" : "오후";
  const hour12 = alarmHour === 0 ? 12 : alarmHour > 12 ? alarmHour - 12 : alarmHour;
  const alarmStr = `${period} ${String(hour12).padStart(2, "0")}:${String(alarmMin).padStart(2, "0")}`;
  const draftPeriod = draftHour < 12 ? "오전" : "오후";
  const draftH12 = draftHour === 0 ? 12 : draftHour > 12 ? draftHour - 12 : draftHour;
  const goalStr = `${Math.floor(sleepGoal / 60)}시간`;

  function openPicker() {
    setDraftHour(alarmHour); setDraftMin(alarmMin);
    setPickerOpen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function confirmAlarm() {
    await setAlarm(draftHour, draftMin);
    setPickerOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleLogout() {
    Alert.alert("로그아웃", "정말 로그아웃 하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃", style: "destructive",
        onPress: async () => { await logout(); router.replace("/(auth)/login"); }
      },
    ]);
  }

  function pickGoal() {
    Alert.alert("수면 목표", "목표 수면 시간을 선택하세요", [
      { text: "6시간", onPress: () => setSleepGoal(360) },
      { text: "7시간", onPress: () => setSleepGoal(420) },
      { text: "8시간 (권장)", onPress: () => setSleepGoal(480) },
      { text: "9시간", onPress: () => setSleepGoal(540) },
      { text: "취소", style: "cancel" },
    ]);
  }


  //비밀번호 변경
  const [userUpdatePicker, setUserUpdatePicker] = useState(false);

  const [newEmail, setNewEmail] = useState(user?.email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const email = user?.email;

  const {
    user: currentUser,
    changePassword
  } = useAuth();

  async function handleProfileUpdate() {
    console.log("저장 버튼 클릭");
    console.log(currentUser);
    if (!currentUser) return;

    if (newEmail.trim() !== currentUser.email) {
      Alert.alert(
        "오류",
        "이메일이 일치하지 않습니다."
      );
      return;
    }
    console.log("email:", currentUser.email);
    console.log("currentPassword:", currentPassword);
    console.log("newPassword:", newPassword);

    if (!currentPassword.trim()) {
      Alert.alert(
        "오류",
        "현재 비밀번호를 입력해주세요."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(
        "오류",
        "비밀번호가 일치하지 않습니다."
      );
      return;
    }

    const success = await changePassword(
      currentUser.email,
      currentPassword,
      newPassword
    );

    if (success) {
      Alert.alert(
        "완료",
        "비밀번호가 변경되었습니다."
      );
      setUserUpdatePicker(false);
    } else {
      Alert.alert(
        "오류",
        "현재 이메일이 올바르지 않습니다."
      );
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
            <Modal
              visible={userUpdatePicker}
              transparent
              animationType="slide"
              onRequestClose={() => setUserUpdatePicker(false)}
            >
              <View style={styles.userBackdrop}>
                <View
                  style={[
                    styles.userSheet,
                    { backgroundColor: colors.card }
                  ]}
                >
                  <Pressable
                    style={styles.userCloseBtn}
                    onPress={() => setUserUpdatePicker(false)}
                  >
                    <Feather
                      name="x"
                      size={22}
                      color={colors.mutedForeground}
                    />
                  </Pressable>

                  <Text
                    style={[
                      styles.userTitle,
                      { color: colors.text }
                    ]}
                  >
                    회원정보 수정
                  </Text>

                  {/* 이메일 */}
                  <Text
                    style={[
                      styles.userLabel,
                      { color: colors.mutedForeground }
                    ]}
                  >
                    이메일 확인
                  </Text>

                  <View
                    style={[
                      styles.inputIconWrap,
                      { backgroundColor: colors.surface }
                    ]}
                  >
                    <Feather
                      name="mail"
                      size={18}
                      color="#BBDDFF"
                    />

                    <TextInput
                      // value={newEmail}
                      onChangeText={setNewEmail}
                      placeholder="이메일 입력"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={{
                        flex: 1,
                        color: colors.text,
                      }}
                    />
                  </View>

                  {/* 비밀번호 */}
                  <Text
                    style={[
                      styles.userLabel,
                      { color: colors.mutedForeground }
                    ]}
                  >
                    현재 비밀번호
                  </Text>

                  <View
                    style={[
                      styles.inputIconWrap,
                      { backgroundColor: colors.surface }
                    ]}
                  >
                    <Feather
                      name="lock"
                      size={18}
                      color="#FF8A80"
                    />

                    <TextInput
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder="현재 비밀번호"
                      placeholderTextColor={colors.mutedForeground}
                      secureTextEntry
                      style={{
                        flex: 1,
                        color: colors.text,
                      }}
                    />
                  </View>
                  <Text
                    style={[
                      styles.userLabel,
                      { color: colors.mutedForeground }
                    ]}
                  >
                    새 비밀번호
                  </Text>

                  <View
                    style={[
                      styles.inputIconWrap,
                      { backgroundColor: colors.surface }
                    ]}
                  >
                    <Feather
                      name="lock"
                      size={18}
                      color="#FFE082"
                    />

                    <TextInput
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="새 비밀번호"
                      placeholderTextColor={colors.mutedForeground}
                      secureTextEntry
                      style={{
                        flex: 1,
                        color: colors.text,
                      }}
                    />
                  </View>

                  <View
                    style={[
                      styles.inputIconWrap,
                      { backgroundColor: colors.surface }
                    ]}
                  >
                    <Feather
                      name="shield"
                      size={18}
                      color="#80CBC4"
                    />

                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="비밀번호 확인"
                      placeholderTextColor={colors.mutedForeground}
                      secureTextEntry
                      style={{
                        flex: 1,
                        color: colors.text,
                      }}
                    />
                  </View>

                  <Pressable
                    style={styles.userSaveBtn}
                    onPress={() => {
                      // console.log("버튼 눌림");
                      handleProfileUpdate();
                    }}
                  >
                    <LinearGradient
                      colors={["#FFE082", "#FFD040"]}
                      style={styles.userSaveGrad}
                    >
                      <Feather
                        name="bell"
                        size={18}
                        color="#1E203C"
                      />
                      <Text style={styles.userSaveText}>
                        저장하기
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            </Modal>
          </View>
          <View style={styles.miniStatsRow}>
            {[
              {
                label: "총 기록", value:
                  records.length > 0
                    ? `${records.length}회`
                    : "-", icon: "calendar" as const, color: "#BBDDFF"
              },
              {
                label: "한 달 평균 수면",
                value:
                  monthlyAverageDuration > 0
                    ? `${monthlyAverageDuration}h`
                    : "-",
                icon: "moon" as const,
                color: "#FFE082",
              },

              {
                label: "한 달 평균 점수",
                value:
                  monthlyAverageScore > 0
                    ? `${monthlyAverageScore}점`
                    : "-",
                icon: "award" as const,
                color: "#80CBC4",
              },
            ].map(({ label, value, icon, color }) => (
              <View key={label} style={[styles.miniStat, { backgroundColor: "rgba(187,221,255,0.06)" }]}>
                {/* <Feather name={icon} size={16} color={color} /> */}
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
              onValueChange={(v) => { setAlarmOn(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} /* eslint-disable-line @typescript-eslint/no-misused-promises */
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
            {[{ h: 6, m: 0 }, { h: 7, m: 0 }, { h: 7, m: 30 }, { h: 8, m: 0 }].map(({ h, m }) => {
              const active = alarmHour === h && alarmMin === m && alarmOn;
              const lbl = `${h < 12 ? "오전" : "오후"} ${h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")}`;
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
                >
                  <Text style={[styles.quickChipText, { color: active ? "#1E203C" : colors.mutedForeground }]}>{lbl}</Text>
                </Pressable>
              );
            })}
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

      {/* ── 알람 시간 설정 모달 ── */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} />
        <View style={[styles.pickerSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.pickerTitle, { color: colors.text }]}>기상 알람 설정</Text>

          {/* 미리보기 */}
          <View style={[styles.pickerPreview, { backgroundColor: colors.surface }]}>
            <Text style={[styles.previewPeriod, { color: colors.mutedForeground }]}>{draftPeriod}</Text>
            <Text style={[styles.previewTime, { color: "#BBDDFF" }]}>
              {String(draftH12).padStart(2, "0")}:{String(draftMin).padStart(2, "0")}
            </Text>
          </View>

          {/* 스피너 */}
          <View style={styles.spinnerRow}>
            <View style={styles.spinnerWrap}>
              <Text style={[styles.spinnerLabel, { color: colors.mutedForeground }]}>시간</Text>
              <TimeSpinner value={draftHour} min={0} max={23} onChange={setDraftHour} />
            </View>
            <Text style={[styles.spinnerColon, { color: "#BBDDFF" }]}>:</Text>
            <View style={styles.spinnerWrap}>
              <Text style={[styles.spinnerLabel, { color: colors.mutedForeground }]}>분</Text>
              <TimeSpinner value={draftMin} min={0} max={59} onChange={setDraftMin} />
            </View>
          </View>

          {/* 빠른 선택 */}
          <View style={styles.quickRow}>
            {[{ h: 6, m: 0 }, { h: 7, m: 0 }, { h: 7, m: 30 }, { h: 8, m: 0 }].map(({ h, m }) => {
              const active = draftHour === h && draftMin === m;
              const lbl = `${h < 12 ? "오전" : "오후"} ${h}:${String(m).padStart(2, "0")}`;
              return (
                <Pressable
                  key={lbl}
                  style={[styles.quickBtn, {
                    backgroundColor: active ? "#BBDDFF" : colors.surface,
                    borderColor: active ? "#BBDDFF" : colors.border,
                  }]}
                  onPress={() => { setDraftHour(h); setDraftMin(m); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
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
              <Text style={styles.confirmText}>알람 설정 완료</Text>
            </LinearGradient>
          </Pressable>
        </View>
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
  spinnerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  spinnerWrap: { alignItems: "center", gap: 8 },
  spinnerLabel: { fontSize: 12, fontWeight: "600" },
  spinnerColon: { fontSize: 40, fontWeight: "700", marginTop: 20 },
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

  userTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
  },

  userLabel: {
    fontSize: 13,
    fontWeight: "600",
  },

  userInput: {
    height: 54,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
  },

  userSaveBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 12,
  },

  userSaveGrad: {
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  userSaveText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E203C",
  },

  userCloseBtn: {
    position: "absolute",
    right: 20,
    top: 20,
  },

  userBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },

  inputIconWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    height: 54,
  },
});
