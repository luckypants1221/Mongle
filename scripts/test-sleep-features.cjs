const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function loadTs(file) {
  const filename = path.join(__dirname, '../artifacts/mobile/lib', file);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = new Module(filename, module);
  mod._compile(output, filename);
  return mod.exports;
}
const { estimateSnoring, localDateKey, previousDateKey, parseSleepScore } = loadTs('snorePrediction.ts');
const { SleepMusicPlayer } = loadTs('sleepMusicPlayer.ts');
const baseline = { alcohol: false, exercise: false, congestion: false, backSleeping: false };

test('No prediction until all questions are explicitly answered, including no', () => {
  assert.equal(estimateSnoring({}), null);
  assert.equal(estimateSnoring({ ...baseline, alcohol: undefined }), null);
  assert.notEqual(estimateSnoring(baseline), null);
});
test('Missing and invalid sleep scores are excluded, and a zero score is valid', () => {
  const noScore = estimateSnoring(baseline);
  for (const score of [undefined, null, NaN, Infinity, -1, 101]) {
    assert.deepEqual(estimateSnoring(baseline, score), noScore);
  }
  assert.equal(estimateSnoring(baseline, 0).previousScore, 0);
});
test('Lifestyle inputs and the previous score affect the estimate with bounded results', () => {
  const normal = estimateSnoring(baseline, 70).percentage;
  for (const factor of ['alcohol', 'congestion', 'backSleeping']) {
    assert.ok(estimateSnoring({ ...baseline, [factor]: true }, 70).percentage > normal);
  }
  assert.ok(estimateSnoring({ ...baseline, exercise: true }, 70).percentage < normal);
  assert.ok(estimateSnoring(baseline, 40).percentage > estimateSnoring(baseline, 90).percentage);
  for (let mask = 0; mask < 16; mask++) {
    const answers = Object.fromEntries(Object.keys(baseline).map((key, bit) => [key, Boolean(mask & (1 << bit))]));
    for (const score of [null, 0, 50, 100]) {
      const result = estimateSnoring(answers, score);
      assert.ok(result.percentage > 0 && result.percentage < 100);
    }
  }
});
test('An absent API sleep score is not fabricated as zero, while numeric strings are accepted', () => {
  for (const score of [undefined, null, '', ' ', 'invalid', false, {}, -1, 101]) assert.equal(parseSleepScore(score), null);
  assert.equal(parseSleepScore('82'), 82);
  assert.equal(parseSleepScore(0), 0);
});
test('Previous day follows the local calendar across UTC and month/year boundaries', () => {
  process.env.TZ = 'Asia/Seoul';
  const earlyMorning = new Date('2026-10-05T15:30:00Z');
  assert.equal(localDateKey(earlyMorning), '2026-10-06');
  assert.equal(previousDateKey(earlyMorning), '2026-10-05');
  assert.equal(previousDateKey(new Date(2026, 0, 1, 0, 30)), '2025-12-31');
  assert.equal(previousDateKey(new Date(2024, 2, 1, 0, 30)), '2024-02-29');
});

function fakeSound() {
  return {
    playing: false, unloaded: false, volume: 0, callback: null,
    async playAsync() { assert.equal(this.unloaded, false); this.playing = true; },
    async pauseAsync() { this.playing = false; },
    async setVolumeAsync(volume) { this.volume = volume; },
    async unloadAsync() { this.playing = false; this.unloaded = true; },
    setOnPlaybackStatusUpdate(callback) { this.callback = callback; },
  };
}
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}
test('Playback, pause, resume, volume, and stop use one sound and release it', async () => {
  const sound = fakeSound();
  const player = new SleepMusicPlayer(async () => sound, () => {});
  await player.select('rain');
  assert.equal(sound.playing, true);
  await player.toggle();
  assert.equal(sound.playing, false);
  await player.toggle();
  assert.equal(sound.playing, true);
  await player.setVolume(0.6);
  assert.equal(sound.volume, 0.6);
  await player.stop();
  assert.equal(sound.unloaded, true);
  assert.equal(player.state.track, 'none');
  assert.equal(player.state.playing, false);
});
test('Changing a track during loading unloads the obsolete sound before starting the latest', async () => {
  const waiting = deferred();
  const started = deferred();
  const firstSound = fakeSound();
  const latestSound = fakeSound();
  const player = new SleepMusicPlayer(async (track) => {
    if (track === 'nature') { started.resolve(); return waiting.promise; }
    return latestSound;
  }, () => {});
  const first = player.select('nature');
  await started.promise;
  const latest = player.select('white');
  waiting.resolve(firstSound);
  await Promise.all([first, latest]);
  assert.equal(firstSound.unloaded, true);
  assert.equal(firstSound.playing, false);
  assert.equal(latestSound.playing, true);
  assert.equal(player.state.track, 'white');
  await player.stop();
});
test('Ending a session during loading cannot start a delayed sound', async () => {
  const waiting = deferred();
  const started = deferred();
  const sound = fakeSound();
  const player = new SleepMusicPlayer(async () => { started.resolve(); return waiting.promise; }, () => {});
  const selected = player.select('rain');
  await started.promise;
  const stopped = player.stop();
  waiting.resolve(sound);
  await Promise.all([selected, stopped]);
  assert.equal(sound.unloaded, true);
  assert.equal(sound.playing, false);
  assert.equal(player.state.track, 'none');
  assert.equal(player.state.loading, false);
});
test('Audio load failures show an error and a subsequent selection recovers', async () => {
  let fail = true;
  const sound = fakeSound();
  const player = new SleepMusicPlayer(async () => {
    if (fail) throw new Error('Simulated asset load failure');
    return sound;
  }, () => {});
  await player.select('rain');
  assert.ok(player.state.error);
  assert.equal(player.state.playing, false);
  assert.equal(player.state.loading, false);
  fail = false;
  await player.select('nature');
  assert.equal(player.state.error, null);
  assert.equal(sound.playing, true);
  await player.stop();
});
test('Playback interruptions are reflected and the next play button resumes', async () => {
  const sound = fakeSound();
  const player = new SleepMusicPlayer(async () => sound, () => {});
  await player.select('rain');
  sound.callback({ isLoaded: true, isPlaying: false });
  assert.equal(player.state.playing, false);
  await player.toggle();
  assert.equal(player.state.playing, true);
  await player.stop();
});
test('Bundled sounds are valid, distinct, non-silent 12-second PCM WAV files', () => {
  const buffers = ['nature', 'rain', 'white'].map((track) => fs.readFileSync(path.join(__dirname, `../artifacts/mobile/assets/audio/${track}.wav`)));
  for (const buffer of buffers) {
    assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
    assert.equal(buffer.toString('ascii', 8, 12), 'WAVE');
    assert.equal(buffer.readUInt16LE(20), 1);
    assert.equal(buffer.readUInt16LE(22), 1);
    assert.equal(buffer.readUInt32LE(24), 22050);
    assert.equal(buffer.readUInt16LE(34), 16);
    assert.equal(buffer.readUInt32LE(40) / (22050 * 2), 12);
    let energy = 0;
    for (let i = 44; i < buffer.length; i += 2) energy += buffer.readInt16LE(i) ** 2;
    assert.ok(energy > 0);
  }
  assert.equal(buffers[0].equals(buffers[1]), false);
  assert.equal(buffers[1].equals(buffers[2]), false);
});
