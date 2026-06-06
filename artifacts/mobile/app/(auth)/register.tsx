import { Feather } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import axios from "axios";

interface Field {
  key: string;
  label: string;
  placeholder: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  keyboard?: "email-address" | "default";
  secure?: boolean;
}

const FIELDS: Field[] = [
  { key: "name", label: "이름", placeholder: "이름을 입력하세요", icon: "user" },
  { key: "email", label: "이메일", placeholder: "이메일을 입력하세요", icon: "mail", keyboard: "email-address" },
  { key: "password", label: "비밀번호", placeholder: "비밀번호를 입력하세요", icon: "lock", secure: true },
  { key: "confirm", label: "비밀번호 확인", placeholder: "비밀번호를 다시 입력하세요", icon: "check-circle", secure: true },
];

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  function update(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleRegister() {
    const { name, email, password, confirm } = form;
    if (!name || !email || !password) {
      Alert.alert("알림", "모든 항목을 입력해주세요.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("알림", "비밀번호가 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ok = await register({ name, email, password });
    setLoading(false);
    if (!ok) {
      Alert.alert("가입 실패", "이미 사용 중인 이메일입니다.");
    } else {
      router.replace("/(tabs)");
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* 상단 헤더 — 노치까지 덮는 그라디언트 */}
      <LinearGradient colors={["#252848", "#1E203C"]} style={styles.topBar}>
        {/* 노치/상태바 안전 여백 + 여유 공간 */}
        <View style={{ height: insets.top + 25 }} />
        <View style={styles.topBarContent}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#BBDDFF" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Image
              source={require("@/assets/images/logo_nobg.png")}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text style={styles.title}>몽글 · 회원가입</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 24, 40) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* 입력 폼 */}
          <View style={styles.form}>
            {FIELDS.map(({ key, label, placeholder, icon, keyboard, secure }) => (
              <View key={key} style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
                <View style={[styles.inputBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Feather name={icon} size={17} color={colors.primary} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder={placeholder}
                    placeholderTextColor={colors.mutedForeground}
                    value={(form as Record<string, string>)[key]}
                    onChangeText={(v) => update(key, v)}
                    keyboardType={keyboard ?? "default"}
                    secureTextEntry={secure && !showPass}
                    autoCapitalize="none"
                  />
                  {key === "password" && (
                    <Pressable onPress={() => setShowPass(!showPass)} hitSlop={10}>
                      <Feather
                        name={showPass ? "eye-off" : "eye"}
                        size={17}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* 가입 완료 버튼 */}
          <Pressable
            style={({ pressed }) => [styles.submitBtn, { opacity: pressed || loading ? 0.82 : 1 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            <LinearGradient
              colors={["#FFE082", "#FFD040"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGrad}
            >
              <Text style={styles.submitText}>{loading ? "가입 중..." : "회원가입 완료"}</Text>
            </LinearGradient>
          </Pressable>

          {/* SNS 가입 */}
          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>SNS 가입</Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>
          <View style={styles.socialRow}>
            {[
              { label: "N", bg: "#03C75A", text: "#fff" },
              { label: "L", bg: "#00B900", text: "#fff" },
              { label: "G", bg: "#fff", text: "#444" },
            ].map(({ label, bg, text }) => (
              <Pressable
                key={label}
                style={[styles.socialBtn, { backgroundColor: bg }]}
                onPress={() => Alert.alert("알림", "SNS 가입은 준비 중입니다.")}
              >
                <Text style={{ color: text, fontWeight: "700", fontSize: 18 }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    width: "100%",
    paddingBottom: 14,
  },
  topBarContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerLogo: { width: 36, height: 36 },
  title: { fontSize: 20, fontWeight: "700", color: "#BBDDFF" },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 16,
  },
  form: { gap: 10 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginLeft: 4 },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  input: { flex: 1, fontSize: 14 },
  submitBtn: { borderRadius: 16, overflow: "hidden", marginTop: 4 },
  submitGrad: { paddingVertical: 17, alignItems: "center" },
  submitText: { color: "#1E203C", fontSize: 16, fontWeight: "800" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  divider: { flex: 1, height: 1 },
  socialRow: { flexDirection: "row", justifyContent: "center", gap: 20 },
  socialBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
});