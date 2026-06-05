import { Redirect } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, Platform, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";

const native = Platform.OS !== "web";
const MIN_SPLASH_MS = 2200;

export default function Index() {
  const { user, isLoading } = useAuth();
  const [minDone, setMinDone] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.82)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 700,
        useNativeDriver: native,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 70,
        useNativeDriver: native,
      }),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.07,
            duration: 1000,
            useNativeDriver: native,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: native,
          }),
        ])
      ).start();
    });
  }, []);

  if (!isLoading && minDone) {
    if (user) return <Redirect href="/(tabs)" />;
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <View style={styles.root}>
      <Animated.View
        style={[
          styles.logoWrap,
          { opacity: fade, transform: [{ scale }, { scale: pulse }] },
        ]}
      >
        <Image
          source={require("@/assets/images/logo_nobg.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.Text style={[styles.appName, { opacity: fade }]}>
        몽글
      </Animated.Text>
      <Animated.Text style={[styles.tagline, { opacity: fade }]}>
        오늘 밤도 편안하게 잠드세요
      </Animated.Text>

      <Animated.View style={[styles.dotsRow, { opacity: fade }]}>
        {[0, 1, 2].map((i) => (
          <Dot key={i} delay={i * 220} />
        ))}
      </Animated.View>
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: native,
          }),
          Animated.timing(anim, {
            toValue: 0.25,
            duration: 500,
            useNativeDriver: native,
          }),
        ])
      ).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);

  return <Animated.View style={[styles.dot, { opacity: anim }]} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1E203C",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  logoWrap: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logo: {
    width: 200,
    height: 200,
  },
  appName: {
    fontSize: 34,
    fontWeight: "700",
    color: "#BBDDFF",
    letterSpacing: 3,
  },
  tagline: {
    fontSize: 14,
    color: "#7A8AA6",
    marginTop: 2,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 36,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#BBDDFF",
  },
});
