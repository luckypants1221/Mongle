import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather, type FeatherIconName } from "@/components/Icon";
import { useSleep } from "@/context/SleepContext";
import { useColors } from "@/hooks/useColors";
import type { MusicTrack } from "@/lib/sleepMusicPlayer";

const TRACKS: { id: MusicTrack; label: string; icon: FeatherIconName }[] = [
  { id: "none", label: "없음", icon: "volume-x" },
  { id: "nature", label: "자연음", icon: "wind" },
  { id: "rain", label: "빗소리", icon: "cloud-rain" },
  { id: "white", label: "백색소음", icon: "radio" },
];

export function SleepMusicCard({ disabled = false }: { disabled?: boolean }) {
  const colors = useColors();
  const { music, selectMusic, toggleMusic, setMusicVolume } = useSleep();
  const selectedLabel = TRACKS.find(({ id }) => id === music.track)?.label;
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.titleRow}>
        <Feather name="music" size={17} color="#BBDDFF" />
        <Text style={[styles.title, { color: colors.text }]}>수면 음악</Text>
        {music.loading && <ActivityIndicator size="small" color="#BBDDFF" />}
      </View>
      <Text style={[styles.caption, { color: colors.mutedForeground }]}>듣고 싶은 소리를 선택하면 반복 재생돼요.</Text>
      <View style={styles.trackRow}>
        {TRACKS.map(({ id, label, icon }) => {
          const selected = music.track === id;
          return (
            <Pressable key={id} disabled={disabled} accessibilityRole="button"
              accessibilityLabel={`수면 음악 ${label}`} accessibilityState={{ selected, disabled }}
              onPress={() => { void selectMusic(id); }}
              style={[styles.track, { backgroundColor: selected ? "#BBDDFF18" : colors.surface, borderColor: selected ? "#BBDDFF" : colors.border }]}>
              <Feather name={icon} size={21} color={selected ? "#BBDDFF" : colors.mutedForeground} />
              <Text style={[styles.trackLabel, { color: selected ? "#BBDDFF" : colors.text }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {music.track !== "none" && (
        <>
          <View style={styles.playbackRow}>
            <Text style={[styles.status, { color: colors.text }]} accessibilityLiveRegion="polite">
              {selectedLabel} · {music.loading ? "준비 중" : music.error ? "재생 오류" : music.playing ? "재생 중" : "일시정지"}
            </Text>
            <Pressable disabled={disabled || music.loading} accessibilityRole="button"
              accessibilityLabel={music.playing ? "음악 일시정지" : "음악 재생"}
              onPress={() => { void toggleMusic(); }}
              style={[styles.playButton, { backgroundColor: "#BBDDFF", opacity: disabled || music.loading ? 0.5 : 1 }]}>
              <Text style={styles.playText}>{music.playing ? "일시정지" : "재생"}</Text>
            </Pressable>
          </View>
          <View style={styles.volumeRow}>
            <Text style={[styles.caption, { color: colors.mutedForeground }]}>음량</Text>
            {[{ label: "작게", value: 0.15 }, { label: "보통", value: 0.3 }, { label: "크게", value: 0.6 }].map(({ label, value }) => (
              <Pressable key={label} disabled={disabled || music.loading} accessibilityRole="button"
                accessibilityLabel={`음악 음량 ${label}`} accessibilityState={{ selected: music.volume === value }}
                onPress={() => { void setMusicVolume(value); }}
                style={[styles.volumeButton, { backgroundColor: music.volume === value ? "#BBDDFF18" : colors.surface }]}>
                <Text style={[styles.caption, { color: music.volume === value ? "#BBDDFF" : colors.mutedForeground }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      {music.error && <Text style={styles.error} accessibilityLiveRegion="polite">{music.error}</Text>}
      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        {music.playing || music.loading && music.track !== "none"
          ? "재생 소리를 코골이로 세지 않도록, 음악 재생 중에는 코골이 감지를 잠시 쉬어요."
          : "음악을 끄거나 일시정지하면 코골이 감지가 다시 시작돼요."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 15, fontWeight: "700", flex: 1 },
  caption: { fontSize: 12 },
  trackRow: { flexDirection: "row", gap: 7 },
  track: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderRadius: 13, paddingVertical: 14 },
  trackLabel: { fontSize: 11, fontWeight: "600" },
  playbackRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  status: { flex: 1, fontSize: 12 },
  playButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  playText: { color: "#1E203C", fontSize: 12, fontWeight: "700" },
  volumeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  volumeButton: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  note: { fontSize: 11, lineHeight: 17 },
  error: { color: "#F48FB1", fontSize: 12, lineHeight: 18 },
});
