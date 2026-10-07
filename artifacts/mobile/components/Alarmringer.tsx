import { Feather } from "@/components/Icon";
import { useSleep } from "@/context/SleepContext";
import {
    ALARM_TYPE,
    RING_SECONDS,
    cancelWakeAlarm,
    scheduleWakeAlarm,
    stopRingingChain,
} from "@/lib/alarmScheduler";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Modal, Platform, Pressable, StyleSheet, Text, Vibration, View } from "react-native";

/**
 * 앱 루트(SleepProvider 안쪽)에 한 번만 넣는다.
 *  - 알람 시간/스위치가 바뀌면 알림 예약을 갱신
 *  - 알람 시간이 되면(알림 수신 / 알림 탭 / 앱 열기) 알람 화면을 띄우고
 *    소리 + 진동을 반복 재생, 최대 60초 후 자동 종료
 */
export default function AlarmRinger() {
    const { alarmHour, alarmMin, alarmOn } = useSleep();
    const player = useAudioPlayer(require("@/assets/sounds/alarm.wav"));

    const [ringing, setRinging] = useState(false);
    const ringingRef = useRef(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    /* ── 알림 예약 갱신 ── */
    useEffect(() => {
        if (Platform.OS === "web") return;
        if (alarmOn) scheduleWakeAlarm(alarmHour, alarmMin);
        else cancelWakeAlarm();
    }, [alarmOn, alarmHour, alarmMin]);

    /* ── 끄기 ── */
    const stop = useCallback(async () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
        try { player.pause(); } catch { }
        Vibration.cancel();
        ringingRef.current = false;
        setRinging(false);
        await stopRingingChain();
    }, [player]);

    /* ── 울리기 시작 (ringStart 기준 60초가 남아 있을 때만) ── */
    const start = useCallback(async (ringStart: number) => {
        const remaining = ringStart + RING_SECONDS * 1000 - Date.now();
        if (!ringStart || remaining <= 0 || ringingRef.current) return;

        ringingRef.current = true;
        setRinging(true);

        try {
            await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true });
            player.loop = true;
            player.seekTo(0);
            player.play();
        } catch { }

        Vibration.vibrate([0, 700, 500], true); // 계속 반복
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        timerRef.current = setTimeout(() => { stop(); }, remaining);
    }, [player, stop]);

    /* ── 알림 수신(앱 켜짐) / 알림 탭 / 콜드 스타트 ── */
    useEffect(() => {
        if (Platform.OS === "web") return;

        const handle = (n: Notifications.Notification) => {
            const d = n.request.content.data as { type?: string; ringStart?: number } | undefined;
            if (d?.type === ALARM_TYPE) start(Number(d.ringStart));
        };

        const s1 = Notifications.addNotificationReceivedListener(handle);
        const s2 = Notifications.addNotificationResponseReceivedListener((r) => handle(r.notification));
        Notifications.getLastNotificationResponseAsync().then((r) => { if (r) handle(r.notification); });

        return () => { s1.remove(); s2.remove(); };
    }, [start]);

    /* ── 알림 없이 앱을 직접 열었을 때도, 알람 시간 60초 안이면 울리기 ── */
    useEffect(() => {
        if (Platform.OS === "web" || !alarmOn) return;

        const check = () => {
            const t = new Date();
            t.setHours(alarmHour, alarmMin, 0, 0);
            const ringStart = t.getTime();
            const now = Date.now();
            if (now >= ringStart && now < ringStart + RING_SECONDS * 1000) start(ringStart);
        };

        check();
        const sub = AppState.addEventListener("change", (s) => { if (s === "active") check(); });
        return () => sub.remove();
    }, [alarmOn, alarmHour, alarmMin, start]);

    /* ── 언마운트 시 정리 ── */
    useEffect(() => () => { Vibration.cancel(); }, []);

    const period = alarmHour < 12 ? "오전" : "오후";
    const hour12 = alarmHour === 0 ? 12 : alarmHour > 12 ? alarmHour - 12 : alarmHour;

    return (
        <Modal visible={ringing} animationType="fade" statusBarTranslucent onRequestClose={() => { }}>
            <View style={styles.root}>
                <View style={styles.iconWrap}>
                    <Feather name="bell" size={44} color="#FFE082" />
                </View>
                <Text style={styles.label}>기상 알람</Text>
                <Text style={styles.period}>{period}</Text>
                <Text style={styles.time}>
                    {String(hour12).padStart(2, "0")}:{String(alarmMin).padStart(2, "0")}
                </Text>
                <Text style={styles.hint}>일어날 시간이에요!</Text>

                <Pressable
                    style={({ pressed }) => [styles.stopBtn, { opacity: pressed ? 0.8 : 1 }]}
                    onPress={stop}
                >
                    <Text style={styles.stopText}>알람 끄기</Text>
                </Pressable>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#1E203C", alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
    iconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(255,224,130,0.14)", alignItems: "center", justifyContent: "center", marginBottom: 16 },
    label: { fontSize: 16, fontWeight: "600", color: "#7A8AA6" },
    period: { fontSize: 18, fontWeight: "500", color: "#7A8AA6", marginTop: 12 },
    time: { fontSize: 76, fontWeight: "700", color: "#BBDDFF", letterSpacing: -1 },
    hint: { fontSize: 15, color: "#fff", marginTop: 4 },
    stopBtn: { marginTop: 56, width: "100%", paddingVertical: 20, borderRadius: 20, backgroundColor: "#FFE082", alignItems: "center" },
    stopText: { fontSize: 20, fontWeight: "800", color: "#1E203C" },
});