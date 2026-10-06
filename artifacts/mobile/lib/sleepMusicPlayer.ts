export type MusicTrack = "none" | "nature" | "rain" | "white";
type PlaybackStatus = { isLoaded: boolean; isPlaying?: boolean; error?: string };
export interface PlaybackSound {
  playAsync(): Promise<unknown>;
  pauseAsync(): Promise<unknown>;
  setVolumeAsync(volume: number): Promise<unknown>;
  unloadAsync(): Promise<unknown>;
  setOnPlaybackStatusUpdate(callback: ((status: PlaybackStatus) => void) | null): void;
}
export type MusicState = {
  track: MusicTrack;
  playing: boolean;
  loading: boolean;
  volume: number;
  error: string | null;
};

// Serialize audio operations so rapid track changes or ending a session while
// an asset loads cannot leave an older sound playing in the background.
export class SleepMusicPlayer {
  state: MusicState = { track: "none", playing: false, loading: false, volume: 0.3, error: null };
  private sound: PlaybackSound | null = null;
  private loadedTrack: MusicTrack = "none";
  private wantsPlayback = false;
  private revision = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private load: (track: Exclude<MusicTrack, "none">) => Promise<PlaybackSound>,
    private onChange: (state: MusicState) => void,
  ) {}

  select(track: MusicTrack) {
    this.wantsPlayback = track !== "none";
    this.state = { ...this.state, track, error: null };
    return this.update();
  }

  toggle() {
    if (this.state.track === "none") return Promise.resolve();
    this.wantsPlayback = !this.state.playing;
    return this.update();
  }

  setVolume(volume: number) {
    if (!Number.isFinite(volume)) return Promise.resolve();
    this.state = { ...this.state, volume: Math.max(0, Math.min(1, volume)) };
    return this.update();
  }

  stop() {
    return this.select("none");
  }

  private publish(patch: Partial<MusicState>) {
    this.state = { ...this.state, ...patch };
    this.onChange({ ...this.state });
  }

  private async unload() {
    const sound = this.sound;
    if (sound) {
      sound.setOnPlaybackStatusUpdate(null);
      try { await sound.pauseAsync(); } catch { /* An unloaded sound can already be stopped. */ }
      await sound.unloadAsync();
      this.sound = null;
    }
    this.loadedTrack = "none";
  }

  private update() {
    const revision = ++this.revision;
    this.publish({ loading: true });
    this.queue = this.queue.then(async () => {
      if (revision !== this.revision) return;
      try {
        const track = this.state.track;
        if (this.loadedTrack !== track) {
          await this.unload();
          this.publish({ playing: false });
        }
        if (revision !== this.revision) return;
        if (track === "none") {
          this.publish({ playing: false, loading: false });
          return;
        }
        if (!this.sound) {
          const sound = await this.load(track);
          if (revision !== this.revision) {
            await sound.unloadAsync();
            return;
          }
          this.sound = sound;
          this.loadedTrack = track;
          sound.setOnPlaybackStatusUpdate((status) => {
            if (this.sound !== sound) return;
            if (status.isLoaded) this.publish({ playing: Boolean(status.isPlaying) });
            else if (status.error) {
              this.wantsPlayback = false;
              this.loadedTrack = "none";
              this.publish({ playing: false, error: "재생이 중단됐어요. 다시 재생해주세요." });
            }
          });
        }
        await this.sound.setVolumeAsync(this.state.volume);
        if (revision !== this.revision) return;
        if (this.wantsPlayback) await this.sound.playAsync();
        else await this.sound.pauseAsync();
        if (revision === this.revision) {
          this.publish({ playing: this.wantsPlayback, loading: false, error: null });
        }
      } catch (error) {
        console.warn("Sleep music playback failed", error);
        try { await this.unload(); } catch { /* Keep the handle for a later stop retry. */ }
        if (revision === this.revision) {
          this.wantsPlayback = false;
          this.publish({ playing: false, loading: false, error: "소리를 재생하지 못했어요. 다시 선택해주세요." });
        }
      }
    });
    return this.queue;
  }
}
