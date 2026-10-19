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
    await setupChannel(); // Android 13+: 권한 요청 전에 채널이 먼저 있어야 함
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
// 예약/취소 요청을 순서대로 하나씩만 실행
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = queue.then(job, job);
    queue = run.catch(() => { });
    return run;
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
export function cancelWakeAlarm() {
    return enqueue(() => Notifications.cancelAllScheduledNotificationsAsync());
}

/**
 * 매일 hour:minute 에 시작해서 60초 동안 10초 간격으로 알림을 보낸다.
 * (앱이 꺼져 있어도 OS가 울려주는 알림 → 앱을 열면 계속 울리는 알람 화면이 뜸)
 */

export function scheduleWakeAlarm(hour: number, minute: number) {
    return enqueue(async () => {
        if (!(await ensurePermission())) {
            console.log("[ALARM] 알림 권한 없음 → 예약 안 함");
            return false;
        }
        await Notifications.cancelAllScheduledNotificationsAsync();

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
        const list = await Notifications.getAllScheduledNotificationsAsync();
        console.log("[ALARM] 예약 완료:", list.length, "개");
        return true;
    });
}
/** 현재 울리는 회차의 남은 알림만 취소 */
export async function stopRingingChain(): Promise<void> {
    const now = Date.now();
    const scheduled =
        await Notifications.getAllScheduledNotificationsAsync();

    for (const notification of scheduled) {
        const data = notification.content.data;

        const isAlarm =
            data?.type === ALARM_TYPE ||
            notification.identifier.startsWith("wake-alarm-");

        if (!isAlarm) continue;

        // data에 없으면 알림 식별자에서 시작 시각 추출
        const match = notification.identifier.match(
            /^wake-alarm-(\d+)-\d+$/
        );

        const ringStart = Number(
            data?.ringStart ?? match?.[1]
        );

        if (
            Number.isFinite(ringStart) &&
            ringStart <= now &&
            now < ringStart + RING_SECONDS * 1000
        ) {
            await Notifications.cancelScheduledNotificationAsync(
                notification.identifier
            );
        }
    }
}