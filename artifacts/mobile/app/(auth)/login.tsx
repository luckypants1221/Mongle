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

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("알림", "이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ok = await login(email, password);
    setLoading(false);
    if (!ok) {
      Alert.alert("로그인 실패", "이메일 또는 비밀번호가 올바르지 않습니다.");
    } else {
      router.replace("/(tabs)");
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* 그라디언트 헤더 — 노치/상태바 뒤까지 확장 */}
      <LinearGradient colors={["#252848", "#1E203C"]} style={styles.hero}>
        {/* 노치/상태바 높이만큼 안전 여백 */}
        <View style={{ height: insets.top }} />
        <View style={styles.logoWrap}>
          <Image
            source={require("@/assets/images/logo_nobg.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.appName}>몽글</Text>
        <Text style={styles.tagline}>오늘 밤도 편안하게 잠드세요</Text>
        <View style={{ height: 8 }} />
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.form,
            { paddingBottom: Math.max(insets.bottom + 24, 40) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* 입력 필드 */}
          <View style={styles.inputs}>
            <View style={[styles.inputBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Feather name="mail" size={18} color={colors.primary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="이메일"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
              />
            </View>
            <View style={[styles.inputBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Feather name="lock" size={18} color={colors.primary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="비밀번호"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable onPress={() => setShowPass(!showPass)} hitSlop={10}>
                <Feather name={showPass ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
          </View>

          {/* 로그인 버튼 */}
          <Pressable
            style={({ pressed }) => [styles.loginBtn, { opacity: pressed || loading ? 0.82 : 1 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <LinearGradient
              colors={["#FFE082", "#FFD040"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loginBtnGrad}
            >
              <Feather name="log-in" size={18} color="#1E203C" />
              <Text style={styles.loginBtnText}>{loading ? "로그인 중..." : "로그인"}</Text>
            </LinearGradient>
          </Pressable>

          {/* 회원가입 */}
          <Pressable
            style={({ pressed }) => [
              styles.registerBtn,
              { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => router.push("/(auth)/register")}
          >
            <Text style={[styles.registerBtnText, { color: colors.primary }]}>
              계정이 없으신가요? <Text style={{ fontWeight: "700" }}>회원가입</Text>
            </Text>
          </Pressable>

          {/* SNS 로그인 */}
          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>SNS 로그인</Text>
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
                onPress={() => Alert.alert("알림", "SNS 로그인은 준비 중입니다.")}
              >
                <Text style={[styles.socialLabel, { color: text }]}>{label}</Text>
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
  hero: {
    width: "100%",
    alignItems: "center",
    paddingBottom: 28,
    gap: 6,
  },
  logoWrap: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  logo: { width: 140, height: 140 },
  appName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#BBDDFF",
    letterSpacing: 1,
  },
  tagline: { fontSize: 14, color: "#7A8AA6" },
  form: {
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 14,
  },
  inputs: { gap: 12 },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 12,
  },
  input: { flex: 1, fontSize: 15 },
  loginBtn: { borderRadius: 16, overflow: "hidden" },
  loginBtnGrad: {
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loginBtnText: { color: "#1E203C", fontSize: 16, fontWeight: "800" },
  registerBtn: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 15,
    alignItems: "center",
  },
  registerBtnText: { fontSize: 15 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 12 },
  socialRow: { flexDirection: "row", justifyContent: "center", gap: 20 },
  socialBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  socialLabel: { fontSize: 18, fontWeight: "700" },
});
