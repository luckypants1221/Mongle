const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const http = require('node:http');
const ts = require('typescript');
const mobileRoot = path.resolve(__dirname, '../artifacts/mobile');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...rest) {
  return resolve.call(this, request.startsWith('@/') ? path.join(mobileRoot, request.slice(2)) : request, parent, ...rest);
};
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { buildSleepPayload, sameSleepMeasurement, SleepRecordWriter } = require('../artifacts/mobile/lib/sleepRecording.ts');
const { decodeSleepMemo, validSleepRatings } = require('../artifacts/mobile/lib/sleepRecordMetadata.ts');
const { parseAccountRecords, SleepSensorSamples } = require('../artifacts/mobile/lib/accountData.ts');
const draft = () => ({
  id: 'pending', userId: '7', date: '2026-10-07', startTime: '23:59', endTime: '07:00',
  startAt: '2026-10-07T23:59:42+09:00', endAt: '2026-10-08T07:00:13+09:00',
  durationMinutes: 420, score: 90, scoreAvailable: true, memo: '사용자 메모',
});
function roundtrip(record) { return parseAccountRecords([buildSleepPayload('7', record)], '7').records[0]; }

test('Sleep time is saveable without a sensor or microphone, while missing metrics stay unknown', () => {
  const payload = buildSleepPayload('7', draft());
  assert.equal(payload.id, 7);
  assert.equal(payload.duration, 420);
  assert.equal(payload.temp_avg, 0);
  assert.deepEqual(decodeSleepMemo(payload.memo).missing, ['temperature', 'humidity', 'snoringCount']);
  const saved = roundtrip(draft());
  assert.equal(saved.temperature, undefined);
  assert.equal(saved.humidity, undefined);
  assert.equal(saved.snoringCount, undefined);
  assert.equal(saved.memo, '사용자 메모');
});

test('Real zero measurements and a zero score are distinct from unavailable values', () => {
  const saved = roundtrip({ ...draft(), temperature: 0, humidity: 0, snoringCount: 0, score: 0 });
  assert.equal(saved.temperature, 0); assert.equal(saved.humidity, 0); assert.equal(saved.snoringCount, 0);
  assert.equal(saved.score, 0); assert.equal(saved.scoreAvailable, true);
  const unknown = roundtrip({ ...draft(), scoreAvailable: false });
  assert.equal(unknown.scoreAvailable, false);
});

test('A short real measurement retains fractional minutes through save and memo edits', () => {
  const record = { ...draft(), endAt: '2026-10-07T23:59:55+09:00', durationMinutes: 13 / 60 };
  const saved = roundtrip(record);
  const edited = buildSleepPayload('7', { ...saved, memo: '짧은 측정' });
  assert.equal(saved.durationMinutes, 13 / 60);
  assert.equal(edited.duration, 13 / 60);
  assert.equal(Date.parse(edited.end_sleep) - Date.parse(edited.start_sleep), 13000);
});

test('Memo and ratings updates preserve exact seconds, timezone, multi-day duration, and missing status', () => {
  const record = { ...draft(), endAt: '2026-10-09T07:00:13+09:00', durationMinutes: 1860, ratings: { total: 4, humidity: 3, temperature: 5 } };
  const saved = roundtrip(record);
  const updated = roundtrip({ ...saved, memo: '수정\n한 메모' });
  assert.equal(Date.parse(updated.startAt), Date.parse(record.startAt));
  assert.equal(Date.parse(updated.endAt), Date.parse(record.endAt));
  assert.equal(updated.durationMinutes, 1860);
  assert.deepEqual(updated.ratings, record.ratings);
  assert.equal(updated.temperature, undefined);
  assert.equal(updated.memo, '수정\n한 메모');
  assert.equal(sameSleepMeasurement(updated, record), true);
});

test('Bad records or other account payloads are rejected before any write', () => {
  assert.throws(() => buildSleepPayload('8', draft()));
  assert.throws(() => buildSleepPayload('7', { ...draft(), endAt: 'invalid' }));
  assert.throws(() => buildSleepPayload('7', { ...draft(), durationMinutes: NaN }));
  assert.throws(() => buildSleepPayload('7', { ...draft(), temperature: Infinity }));
  assert.equal(validSleepRatings({ total: 0, humidity: 4, temperature: 5 }), false);
  assert.equal(validSleepRatings({ total: 5, humidity: 4, temperature: 5 }), true);
});

test('Legacy plain memos and malformed metadata are never hidden', () => {
  assert.equal(decodeSleepMemo('지난밤 메모').memo, '지난밤 메모');
  assert.equal(decodeSleepMemo('@mongle/sleep:v1:broken').memo, '@mongle/sleep:v1:broken');
});

test('Sensor averages use unique samples from this account and measurement, retaining partial measurements', () => {
  const samples = new SleepSensorSamples();
  const start = Date.parse('2026-10-07T22:00:00Z');
  const rows = [
    { id: 7, time_stamp: new Date(start - 1000).toISOString(), temp: 99, hum: 99 },
    { id: 8, time_stamp: new Date(start + 1000).toISOString(), temp: 99, hum: 99 },
    { id: 7, time_stamp: new Date(start + 1000).toISOString(), temp: 20, hum: 40 },
    { id: 7, time_stamp: new Date(start + 2000).toISOString(), temp: 24 },
    { id: 7, time_stamp: new Date(start + 3000).toISOString(), hum: 60 },
    { id: 7, time_stamp: new Date(start + 9000).toISOString(), temp: 99, hum: 99 },
  ];
  samples.add(rows, '7', start, start + 4000);
  samples.add(rows, '7', start, start + 4000);
  samples.add([], '7', start, start + 4000); // A later empty/disconnected poll does not wipe the session.
  assert.deepEqual(samples.averages(), { temperature: 22, humidity: 50 });
  assert.deepEqual(new SleepSensorSamples().averages(), { temperature: undefined, humidity: undefined });
});

test('Duplicate finish taps share one POST and only a verified server row is returned', async () => {
  const record = draft(), writer = new SleepRecordWriter(record);
  let posts = 0;
  const io = { create: async () => { posts++; }, read: async () => [roundtrip(record)] };
  const a = writer.save(io), b = writer.save(io);
  assert.equal(a, b);
  assert.equal((await a).memo, record.memo); assert.equal(posts, 1);
});

test('POST success plus failed GET retries verification without posting the same record again', async () => {
  const record = draft(), writer = new SleepRecordWriter(record);
  let posts = 0, reads = 0;
  const io = { create: async () => { posts++; }, read: async () => { if (++reads === 1) throw new Error('offline'); return [roundtrip(record)]; } };
  await assert.rejects(writer.save(io), /offline/);
  assert.equal((await writer.save(io)).userId, '7'); assert.equal(posts, 1);
});

test('An upload timeout after server commit is resolved by readback without duplicate POST', async () => {
  const record = draft(), writer = new SleepRecordWriter(record);
  let posts = 0;
  const result = await writer.save({ create: async () => { posts++; throw new Error('timeout'); }, read: async () => [roundtrip(record)] });
  assert.equal(result.userId, '7'); assert.equal(posts, 1);
});

test('Failed upload keeps the original timestamps for an explicit retry', async () => {
  const record = draft(), writer = new SleepRecordWriter(record);
  let posts = 0;
  const io = { create: async sent => { assert.equal(sent.endAt, record.endAt); if (++posts === 1) throw new Error('offline'); }, read: async () => posts > 1 ? [roundtrip(record)] : [] };
  await assert.rejects(writer.save(io), /offline/);
  const saved = await writer.save(io);
  assert.equal(Date.parse(saved.endAt), Date.parse(record.endAt)); assert.equal(posts, 2);
});

test('A different server measurement cannot satisfy save verification', async () => {
  const writer = new SleepRecordWriter(draft());
  await assert.rejects(writer.save({ create: async () => {}, read: async () => [{ ...roundtrip(draft()), userId: '8' }] }), /확인하지 못/);
});

test('POST and PUT through actual HTTP API roundtrip the bound account, incomplete metrics, ratings, and memo', async () => {
  const rows = [], writes = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost'); res.setHeader('Content-Type', 'application/json');
    if (req.method === 'GET') { res.end(JSON.stringify(rows.filter(row => row.id === Number(url.searchParams.get('id'))))); return; }
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    for (const key of ['id', 'sleep_score', 'temp_avg', 'hum_avg', 'snoring_count']) assert.equal(Number.isInteger(body[key]), true);
    for (const key of ['start_sleep', 'end_sleep', 'audio_path', 'memo']) assert.equal(typeof body[key], 'string');
    assert.equal(body.id, 7); writes.push(req.method);
    if (req.method === 'POST') rows.push(body);
    else { const index = rows.findIndex(row => row.id === body.id && row.start_sleep === body.start_sleep); rows[index] = body; }
    res.end(JSON.stringify({ message: 'success' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:' + server.address().port;
  const service = require('../artifacts/mobile/services/authApi.ts');
  const api = require('../artifacts/mobile/lib/api.ts').api;
  try {
    service.setApiAccount('7');
    const saved = await api.createSleepRecord('7', draft());
    assert.ok(saved); assert.equal(saved.temperature, undefined);
    const rated = await api.updateSleepRecord('7', saved.id, { ratings: { total: 5, humidity: 4, temperature: 3 } });
    const memo = await api.updateSleepRecord('7', rated.id, { memo: '최종 메모' });
    assert.deepEqual(memo.ratings, { total: 5, humidity: 4, temperature: 3 });
    assert.equal(memo.memo, '최종 메모'); assert.equal(memo.snoringCount, undefined);
    assert.equal(rows.length, 1); assert.deepEqual(writes, ['POST', 'PUT', 'PUT']);
    await assert.rejects(api.createSleepRecord('8', draft()));
  } finally { service.setApiAccount(null); await new Promise(resolve => server.close(resolve)); }
});
