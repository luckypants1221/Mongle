// Original, deterministic ambient loops. No third-party recordings or licenses.
const fs = require('node:fs');
const path = require('node:path');
const rate = 22050;
const length = rate * 12;
const fade = Math.floor(rate * 0.08);
const directory = path.join(__dirname, '../artifacts/mobile/assets/audio');
fs.mkdirSync(directory, { recursive: true });
for (const [kind, seed] of [['nature', 12345], ['rain', 54321], ['white', 13579]]) {
  let randomState = seed;
  let low = 0;
  let mid = 0;
  const samples = new Float64Array(length + fade);
  for (let i = 0; i < samples.length; i++) {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    const noise = randomState / 2147483648 - 1;
    const t = i / rate;
    low += 0.015 * (noise - low);
    mid += 0.14 * (noise - mid);
    if (kind === 'nature') {
      const wind = low * (1.7 + 0.7 * Math.sin(2 * Math.PI * t / 6));
      const chirpTime = (t + 0.9) % 3;
      const chirp = chirpTime < 0.28
        ? 0.045 * Math.sin(Math.PI * chirpTime / 0.28) ** 2 * Math.sin(2 * Math.PI * (1900 * chirpTime + 1500 * chirpTime ** 2))
        : 0;
      samples[i] = wind + chirp;
    } else if (kind === 'rain') {
      samples[i] = (0.11 * noise + 0.45 * mid) * (0.9 + 0.1 * Math.sin(2 * Math.PI * t / 4));
    } else {
      samples[i] = noise * 0.16;
    }
  }
  const wav = Buffer.alloc(44 + length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) {
    let sample = samples[i];
    if (i < fade) {
      const mix = (1 - Math.cos(Math.PI * i / fade)) / 2;
      sample = samples[length + i] * (1 - mix) + samples[i] * mix;
    }
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(directory, `${kind}.wav`), wav);
  console.log(`${kind}.wav: ${length / rate}s, ${wav.length} bytes`);
}
