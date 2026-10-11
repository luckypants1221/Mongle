import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const ALARM_TYPE = "wake-alarm";
export const RING_SECONDS = 60;
const ID_PREFIX = "wake-alarm-";      // 알람 알림 식별자 접두사
const LEGACY_ID = "wake-alarm";        // 예전 버전(DAILY)에서 쓰던 식별자
const CHAIN_INTERVAL = 10;           // 알림을 이어서 보내는 간격(초)
const DAYS_AHEAD = 7;                // 앞으로 며칠치를 미리 예약할지 (7 x 6 = 42개, iOS 한도 64개 이내)

/* 알람 알림은 앱이 켜져 있을 때 배너/소리를 내지 않는다 (앱이 직접 울림) */
Notifications.setNotificationHandler({
    handleNotification: async (n) => {
        const isAlarm = n.request.content.data?.type === ALARM_TYPE;
        return {
            shouldShowAlert: !isAlarm,
            shouldShowBanner: !isAlarm,
            shouldShowList: !isAlarm,
            shouldPlaySound: !isAlarm,
            shouldSetBadge: false,
        };
    },
});

// 타입 정의가 환경에 따라 달라 오류가 나는 경우가 있어서 any로 받아 안전하게 판별
function isGranted(p: any): boolean {
    return p?.granted === true || p?.status === "granted";
}

async function ensurePermission() {
    const cur: any = await Notifications.getPermissionsAsync();
    if (isGranted(cur)) return true;
    const req: any = await Notifications.requestPermissionsAsync();
    return isGranted(req);
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

type Scheduled = Notifications.NotificationRequest;

function isAlarmNotif(n: Scheduled) {
    return (
        n.identifier === LEGACY_ID ||
        n.identifier.startsWith(ID_PREFIX) ||
        n.content.data?.type === ALARM_TYPE
    );
}

function ringStartOf(n: Scheduled): number {
    const m = n.identifier.match(/^wake-alarm-(\d+)-\d+$/);
    if (m) return Number(m[1]);
    return Number(n.content.data?.ringStart);
}

/**
 * 예약된 알림 전부 취소.
 * 이 앱은 알림을 알람에만 쓰므로, 예전 코드(SleepContext)가 예약해 둔 알림까지 한 번에 지운다.
 */
export async function cancelWakeAlarm() {
    await Notifications.cancelAllScheduledNotificationsAsync();
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
                identifier: `${ID_PREFIX}${ringStart}-${i}`,
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

/** 알람 끄기: 지금 울리는 중인 묶음의 남은 알림을 취소하고, 알림창에 표시된 알림도 지운다 */
export async function stopRingingChain() {
    const now = Date.now();
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
        all
            .filter((n) => isAlarmNotif(n) && (n.identifier === LEGACY_ID || ringStartOf(n) <= now))
            .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => { }))
    );
    await Notifications.dismissAllNotificationsAsync().catch(() => { });
    // 취소 직전에 막 도착한 알림까지 지우기 위해 한 번 더
    setTimeout(() => { Notifications.dismissAllNotificationsAsync().catch(() => { }); }, 1500);
}