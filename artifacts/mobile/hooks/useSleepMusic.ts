import { Audio } from "expo-av";
import { useEffect, useRef, useState } from "react";
import { SleepMusicPlayer, type MusicState, type MusicTrack } from "@/lib/sleepMusicPlayer";

const SOURCES = {
  nature: require("@/assets/audio/nature.wav"),
  rain: require("@/assets/audio/rain.wav"),
  white: require("@/assets/audio/white.wav"),
};

export function useSleepMusic(active: boolean, userId?: string) {
  const mounted = useRef(true);
  const activeRef = useRef(active);
  activeRef.current = active;
  const [music, setMusic] = useState<MusicState>({ track: "none", playing: false, loading: false, volume: 0.3, error: null });
  const playerRef = useRef<SleepMusicPlayer | null>(null);
  if (!playerRef.current) {
    playerRef.current = new SleepMusicPlayer(async (track) => {
      // Leave allowsRecordingIOS intact so playback can coexist with recording.
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, playThroughEarpieceAndroid: false, staysActiveInBackground: true });
      const { sound } = await Audio.Sound.createAsync(SOURCES[track], { shouldPlay: false, isLooping: true });
      return sound;
    }, (state) => { if (mounted.current) setMusic(state); });
  }
  const player = playerRef.current;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; void player.stop(); };
  }, [player]);

  useEffect(() => {
    if (!active) void player.stop();
  }, [active, player]);

  useEffect(() => { void player.stop(); }, [userId, player]);

  return {
    music,
    selectMusic: (track: MusicTrack) => activeRef.current ? player.select(track) : Promise.resolve(),
    toggleMusic: () => activeRef.current ? player.toggle() : Promise.resolve(),
    setMusicVolume: (volume: number) => player.setVolume(volume),
    stopMusic: () => player.stop(),
  };
}
