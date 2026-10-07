import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const ALARM_TYPE = "wake-alarm";
export const RING_SECONDS = 60;      // 알람이 울리는 총 시간
const CHAIN_INTERVAL = 10;           // 알림을 이어서 보내는 간격(초)
const DAYS_AHEAD = 7;                // 앞으로 며칠치를 미리 예약할지 (7 x 6 = 42개, iOS 한도 64개 이내)

/* 알람 알림은 앱이 켜져 있을 때 배너/소리를 내지 않는다 (앱이 직접 울림) */
Notifications.setNotificationHandler({
    handleNotification: async (n) => {
        const isAlarm = n.request.content.data?.type === ALARM_TYPE;
        return {
            shouldShowAlert: !isAlarm,
            shouldShowBanner: !isAlarm,
            shouldShowList: true,
            shouldPlaySound: !isAlarm,
            shouldSetBadge: false,
        };
    },
});

async function ensurePermission() {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
}

async function setupChannel() {
    if (Platform.OS !== "android") return;
    await Notifications.setNotificationChannelAsync("alarm", {
        name: "기상 알람",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        vibrationPattern: [0, 500, 500, 500],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
    });
}

/** 저장된 알람 알림 전부 취소 */
export async function cancelWakeAlarm() {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
        all
            .filter((n) => n.content.data?.type === ALARM_TYPE)
            .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => { }))
    );
}

/**
 * 매일 hour:minute 에 시작해서 60초 동안 10초 간격으로 알림을 보낸다.
 * (앱이 꺼져 있어도 OS가 울려주는 알림 → 앱을 열면 계속 울리는 알람 화면이 뜸)
 */
export async function scheduleWakeAlarm(hour: number, minute: number) {
    if (!(await ensurePermission())) return false;
    await setupChannel();
    await cancelWakeAlarm();

    const now = Date.now();
    const steps = RING_SECONDS / CHAIN_INTERVAL;

    for (let d = 0; d < DAYS_AHEAD; d++) {
        const t = new Date();
        t.setDate(t.getDate() + d);
        t.setHours(hour, minute, 0, 0);
        const ringStart = t.getTime();
        if (ringStart <= now) continue;

        for (let i = 0; i < steps; i++) {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "기상 알람",
                    body: "일어날 시간이에요! 눌러서 알람을 끄세요 ⏰",
                    sound: "default",
                    interruptionLevel: "timeSensitive",
                    data: { type: ALARM_TYPE, ringStart },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: new Date(ringStart + i * CHAIN_INTERVAL * 1000),
                    channelId: "alarm",
                },
            });
        }
    }
    return true;
}

/** 알람 끄기: 지금 울리는 중인 묶음의 남은 알림을 취소하고, 표시된 알림도 지운다 */
export async function stopRingingChain() {
    const now = Date.now();
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
        all
            .filter((n) => n.content.data?.type === ALARM_TYPE && Number(n.content.data?.ringStart) <= now)
            .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => { }))
    );
    await Notifications.dismissAllNotificationsAsync().catch(() => { });
}