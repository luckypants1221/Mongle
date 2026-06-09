// //알림 기능

// import * as Notifications from "expo-notifications";

// Notifications.setNotificationHandler({
//     handleNotification: async () => ({
//         shouldShowBanner: true,
//         shouldShowList: true,
//         shouldPlaySound: true,
//         shouldSetBadge: false,
//     }),
// });

// // export async function requestNotificationPermission() {
// //     const { status } =
// //         await Notifications.requestPermissionsAsync();

// //     return status === "granted";
// // }

// export async function scheduleBedtimeNotification(
//     hour: number,
//     minute: number
// ) {
//     await Notifications.scheduleNotificationAsync({
//         content: {
//             title: "🌙 취침 시간",
//             body: "이제 잠들 준비를 해보세용!",
//         },
//         trigger: {
//             type: Notifications.SchedulableTriggerInputTypes.DAILY,
//             hour,
//             minute,
//         },
//     });
// }

// export async function scheduleWakeupNotification(
//     hour: number,
//     minute: number
// ) {
//     await Notifications.scheduleNotificationAsync({
//         content: {
//             title: "☀️ 기상 시간",
//             body: "좋은 아침이에용!",
//         },
//         trigger: {
//             type: Notifications.SchedulableTriggerInputTypes.DAILY,
//             hour,
//             minute,
//         },
//     });
// }

// export async function cancelAllNotifications() {
//     await Notifications.cancelAllScheduledNotificationsAsync();
// }