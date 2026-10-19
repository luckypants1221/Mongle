import { Feather } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { isSurveyComplete, PRE_SLEEP_QUESTIONS, type PreSleepSurvey, type PreSleepSurveyAnswers } from "@/lib/preSleepSurvey";
import React, { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  previousDate: string;
  previousScore: number | null;
  onClose: () => void;
  onStart: (survey: PreSleepSurvey) => void;
}

export function PreSleepSurveyModal({ previousDate, previousScore, onClose, onStart }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [answers, setAnswers] = useState<Partial<PreSleepSurveyAnswers>>({});
  const submitted = useRef(false);
  const complete = isSurveyComplete(answers);
  const count = PRE_SLEEP_QUESTIONS.filter(({ key }) => typeof answers[key] === "boolean").length;

  function submit() {
    if (submitted.current || !isSurveyComplete(answers)) return;
    submitted.current = true;
    onStart({ ...answers, answeredAt: new Date().toISOString(), previousSleepDate: previousDate, previousSleepScore: previousScore });
  }

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingTop: insets.top + 16 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="설문 닫기" />
        <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>오늘 밤 코골이 설문</Text>
              <Text accessibilityLiveRegion="polite" style={[styles.subtitle, { color: colors.mutedForeground }]}>오늘의 습관을 알려주세요 · {count}/4</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="설문 닫기" hitSlop={12} onPress={onClose} style={styles.close}>
              <Feather name="x" size={26} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={[styles.previous, { backgroundColor: colors.card }]}>
              <Feather name="moon" size={28} color={colors.primary} />
              <View style={styles.heading}>
                <Text style={[styles.previousTitle, { color: colors.text }]}>{previousScore == null ? "전날 수면점수 없음" : `전날 수면점수 ${previousScore}점`}</Text>
                <Text style={[styles.description, { color: colors.mutedForeground }]}>{previousDate} · {previousScore == null ? "기록이 없어 설문 응답만 저장해요." : "전날 기록과 오늘의 습관을 함께 기록해요."}</Text>
              </View>
            </View>

            {PRE_SLEEP_QUESTIONS.map(({ key, title, description }, index) => (
              <View key={key} style={[styles.question, { backgroundColor: colors.card }]}>
                <Text style={[styles.questionTitle, { color: colors.text }]}>{index + 1}. {title}</Text>
                <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>
                <View accessibilityRole="radiogroup" accessibilityLabel={title} style={styles.options}>
                  {[true, false].map((value) => {
                    const selected = answers[key] === value;
                    const label = value ? "네" : "아니요";
                    return (
                      <Pressable key={label} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`${title} ${label}`}
                        onPress={() => setAnswers((current) => ({ ...current, [key]: value }))}
                        style={({ pressed }) => [styles.option, { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border, opacity: pressed ? 0.8 : 1 }]}>
                        <Text style={[styles.optionLabel, { color: selected ? colors.primaryForeground : colors.text }]}>{selected ? "✓ " : ""}{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            <Text style={[styles.note, { color: colors.mutedForeground }]}>응답은 이번 수면 기록과 함께 기기에 저장돼요. 설문만으로 코골이 발생 여부나 확률을 판단하지 않아요.</Text>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !complete }} disabled={!complete} onPress={submit}
              style={({ pressed }) => [styles.submit, { backgroundColor: colors.warning, opacity: !complete ? 0.4 : pressed ? 0.85 : 1 }]}>
              <Text style={[styles.submitLabel, { color: colors.primaryForeground }]}>{complete ? "설문 완료하고 수면 시작" : "4개 질문에 모두 답해주세요"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.65)" },
  sheet: { maxHeight: "100%", borderTopLeftRadius: 28, borderTopRightRadius: 28, flexShrink: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 22 },
  heading: { flex: 1 },
  title: { fontSize: 23, fontWeight: "700" },
  subtitle: { fontSize: 14, marginTop: 7 },
  close: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, gap: 14, paddingBottom: 8 },
  previous: { padding: 18, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 14 },
  previousTitle: { fontSize: 17, fontWeight: "700" },
  question: { padding: 18, borderRadius: 20, gap: 12 },
  questionTitle: { fontSize: 17, fontWeight: "700", lineHeight: 25 },
  description: { fontSize: 13, lineHeight: 21 },
  options: { flexDirection: "row", gap: 12 },
  option: { flex: 1, borderWidth: 1, borderRadius: 15, minHeight: 50, alignItems: "center", justifyContent: "center" },
  optionLabel: { fontSize: 16, fontWeight: "700" },
  note: { fontSize: 12, lineHeight: 20, paddingVertical: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 12 },
  submit: { minHeight: 55, borderRadius: 18, padding: 14, alignItems: "center", justifyContent: "center" },
  submitLabel: { fontSize: 16, fontWeight: "700", textAlign: "center" },
});
