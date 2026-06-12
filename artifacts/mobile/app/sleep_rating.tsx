import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSleep } from "@/context/SleepContext";

export default function SleepRatinScreen() {
    const {
        setSleepScore,
        endSleep,
    } = useSleep();
    const [totalRating, setTotalRating] = useState(0);
    const [tempRating, setTempRating] = useState(0);
    const [humRating, setHumRating] = useState(0);

    const handleSubmit = async () => {
        console.log("수면 종료 버튼 클릭");
        const score = Math.round(
            (
                totalRating * 0.6 +
                tempRating * 0.2 +
                humRating * 0.2
            ) / 5 * 100
        );

        console.log(
            "계산된 수면점수",
            score
        );
        console.log(score);
        setSleepScore(score);

        await endSleep();

        router.replace("/(tabs)");
    }

    return (
        <LinearGradient
            colors={["#1A1C38", "#1E203C"]}
            style={styles.container}
        >
            <Text style={styles.title}>
                오늘 수면은 만족스러웠나요?
            </Text>
            <Text style={styles.subtitle}>
                전체 수면 만족도를 평가해주세요!
            </Text>
            <View style={styles.starContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable
                        key={star}
                        onPress={() => setTotalRating(star)}>
                        <Text style={styles.star}>
                            {star <= totalRating ? "⭐" : "☆"}
                        </Text>
                    </Pressable>
                ))}
            </View>

            <Text style={styles.subtitle}>
                수면 중 습도 만족도를 평가해주세요!
            </Text>
            <View style={styles.starContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable
                        key={star}
                        onPress={() => setHumRating(star)}>
                        <Text style={styles.star}>
                            {star <= humRating ? "⭐" : "☆"}
                        </Text>
                    </Pressable>
                ))}
            </View>

            <Text style={styles.subtitle}>
                수면 중 온도 만족도를 평가해주세요!
            </Text>
            <View style={styles.starContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable
                        key={star}
                        onPress={() => setTempRating(star)}>
                        <Text style={styles.star}>
                            {star <= tempRating ? "⭐" : "☆"}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* <Text style={styles.score}>
                {rating > 0
                    ? `${rating}/5` : "벌점을 선택해주세요"}
            </Text> */}
            <Pressable
                // disabled={rating === 0}
                onPress={handleSubmit}
                style={[
                    styles.button,
                    {
                        // opacity: rating === 0 ? 0.5 : 1,
                    },
                ]}>
                <Text style={styles.buttonText}>
                    완료
                </Text>
            </Pressable>

        </LinearGradient >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
    },
    title: {
        color: "#fff",
        fontSize: 28,
        fontWeight: "700",
        textAlign: "center",
        marginLeft: 10,
        marginBottom: 12,
    },

    subtitle: {
        color: "#BBDDFF",
        fontSize: 16,
        marginBottom: 15,
    },

    starContainer: {
        flexDirection: "row",
        marginBottom: 20,
    },

    star: {
        fontSize: 48,
        marginHorizontal: 6,
    },

    score: {
        color: "#fff",
        fontSize: 18,
        marginBottom: 40,
    },

    button: {
        backgroundColor: "#7AAAD0",
        paddingHorizontal: 40,
        paddingVertical: 16,
        borderRadius: 16,
    },

    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
})