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
import * as Notifications from "@/lib/localNotifications";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Modal, Platform, Pressable, StyleSheet, Text, Vibration, View } from "react-native";

/**
 * 앱 루트(SleepProvider 안쪽)에 한 번만 넣는다.
 *  - 알람 시간/스위치가 바뀌면 알림 예약을 갱신
 *  - 알람 시간이 되면(알림 수신 / 알림 탭 / 앱 열기) 알람 화면을 띄우고
 *    소리 + 진동을 반복 재생, 최대 60초 후 자동 종료
 */
export default function AlarmRinger() {
    const { alarmReady } = useSleep();
    return alarmReady ? <ActiveAlarmRinger /> : null;
}

function ActiveAlarmRinger() {
    const { alarmHour, alarmMin, alarmOn } = useSleep();
    const player = useAudioPlayer(require("@/assets/sounds/alarm.wav"));

    const [ringing, setRinging] = useState(false);
    const ringingRef = useRef(false);
    const activeRingStart = useRef<number | null>(null);
    const stoppedRingStart = useRef<number | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    /* ── 알림 예약 갱신 ── */
    useEffect(() => {
        if (Platform.OS === "web") return;
        if (alarmOn) scheduleWakeAlarm(alarmHour, alarmMin).then((scheduled) => {
            if (!scheduled) Alert.alert("알림 권한 필요", "백그라운드 기상 알람을 받으려면 앱 알림을 허용해 주세요.");
        }).catch((error) => {
            console.warn("[ALARM] 예약 실패", error);
            Alert.alert("알람 예약 실패", "기상 알림을 예약하지 못했습니다. 알림 권한과 알람 설정을 확인해 주세요.");
        });
        else cancelWakeAlarm().catch(console.warn);
    }, [alarmOn, alarmHour, alarmMin]);

    /* ── 끄기 ── */
    const stop = useCallback(async () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
        stoppedRingStart.current = activeRingStart.current;
        try { player.pause(); } catch { }
        Vibration.cancel();
        ringingRef.current = false;
        setRinging(false);
        await stopRingingChain().catch((error) => console.warn("[ALARM] 알림 취소 실패", error));
    }, [player]);

    /* ── 울리기 시작 (ringStart 기준 60초가 남아 있을 때만) ── */
    const start = useCallback(async (ringStart: number) => {
        const remaining = ringStart + RING_SECONDS * 1000 - Date.now();
        if (!alarmOn || !Number.isFinite(ringStart) || remaining <= 0 ||
            ringStart > Date.now() || ringingRef.current || stoppedRingStart.current === ringStart) return;

        activeRingStart.current = ringStart;
        ringingRef.current = true;
        setRinging(true);

        try {
            await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true });
            player.loop = true;
            await player.seekTo(0);
            player.play();
        } catch (error) {
            console.warn("[ALARM] 소리 재생 실패", error);
        }

        Vibration.vibrate([0, 700, 500], true); // 계속 반복
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(console.warn);

        timerRef.current = setTimeout(() => { void stop(); }, Math.max(0, ringStart + RING_SECONDS * 1000 - Date.now()));
    }, [alarmOn, player, stop]);

    /* ── 알림 수신(앱 켜짐) / 알림 탭 / 콜드 스타트 ── */
    useEffect(() => {
        if (Platform.OS === "web") return;

        const handle = (n: Notifications.Notification) => {
            const d = n.request.content.data as { type?: string; ringStart?: number } | undefined;
            if (d?.type === ALARM_TYPE && AppState.currentState === "active") void start(Number(d.ringStart));
        };

        const s1 = Notifications.addNotificationReceivedListener(handle);
        const s2 = Notifications.addNotificationResponseReceivedListener((r) => handle(r.notification));
        Notifications.getLastNotificationResponseAsync().then((r) => { if (r) handle(r.notification); }).catch(console.warn);

        return () => { s1.remove(); s2.remove(); };
    }, [start]);

    /* ── 알림 없이 앱을 직접 열었을 때도, 알람 시간 60초 안이면 울리기 ── */
    useEffect(() => {
        if (Platform.OS === "web" || !alarmOn) return;

        const check = () => {
            if (AppState.currentState !== "active") return;
            const t = new Date();
            t.setHours(alarmHour, alarmMin, 0, 0);
            const ringStart = t.getTime();
            const now = Date.now();
            if (now >= ringStart && now < ringStart + RING_SECONDS * 1000) start(ringStart);
        };

        check();
        const interval = setInterval(check, 1000);
        const sub = AppState.addEventListener("change", (s) => { if (s === "active") check(); });
        return () => { clearInterval(interval); sub.remove(); };
    }, [alarmOn, alarmHour, alarmMin, start]);

    /* ── 언마운트 시 정리 ── */
    useEffect(() => () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        try { player.pause(); } catch { }
        Vibration.cancel();
    }, [player]);

    useEffect(() => {
        if (!alarmOn && ringingRef.current) void stop();
    }, [alarmOn, stop]);

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
