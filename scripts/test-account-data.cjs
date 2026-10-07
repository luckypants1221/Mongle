const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const http = require('node:http');
const ts = require('typescript');
const mobileRoot = path.resolve(__dirname, '../artifacts/mobile');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...rest) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(mobileRoot, request.slice(2)) : request, parent, ...rest);
};
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const { accountId, normalizeUser, identityId, parseAccountRecords, parseAccountSensor, parseSleepStages, AccountRequestGate, AuthenticatedAccount } = require('../artifacts/mobile/lib/accountData.ts');
const day = '2026-10-07';
function record(id, score = 80) { return { id, day, start_sleep: day + 'T00:10:00+09:00', end_sleep: day + 'T07:40:00+09:00', duration: 450, sleep_score: score, temp_avg: 22, hum_avg: 55, snoring_count: 2 }; }

test('Invalid, absent, and pseudo user IDs cannot be used as accounts', () => {
  for (const value of [undefined, null, '', 'undefined', 'null', 'sample_1', -1, 0, '1&id=2', {}, true]) assert.equal(accountId(value), null);
  assert.equal(accountId(' 007 '), '7');
  assert.equal(accountId(12), '12');
});
test('Both deployed login response shapes map to the correct principal', () => {
  assert.deepEqual(normalizeUser({ id: 7, name: 'A', email: 'a@example.invalid' }, 'A@example.invalid'), { id: '7', name: 'A', email: 'a@example.invalid' });
  assert.deepEqual(normalizeUser({ user: { user_id: 8, user_name: 'B', email: 'b@example.invalid' } }, 'b@example.invalid'), { id: '8', name: 'B', email: 'b@example.invalid' });
  assert.equal(identityId({ user_id: 7, user_name: 'A' }), '7');
  assert.throws(() => identityId({ id: 7, user_id: 8 }));
  assert.throws(() => normalizeUser({ id: 7, name: 'A', email: 'a@example.invalid' }, 'b@example.invalid'));
  assert.throws(() => normalizeUser({ id: 8, name: 'A', email: 'a@example.invalid' }, 'a@example.invalid', '7'));
});
test('Mixed account records are filtered before dates, scores, or aggregates are exposed', () => {
  const result = parseAccountRecords([record(2, 99), record(1, 72), { ...record(2), user_id: 2 }], '1');
  assert.equal(result.rejected, 2);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].score, 72);
  assert.equal(result.records[0].userId, '1');
});
test('Explicit user_id is distinct from a generic row primary key', () => {
  const result = parseAccountRecords([{ ...record(501), user_id: 1, record_id: 501 }], '1');
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].id, '501');
});
test('Empty and missing metrics stay missing instead of becoming zeros', () => {
  const [result] = parseAccountRecords([{ ...record(1), sleep_score: null, temp_avg: '', hum_avg: null, snoring_count: undefined }], '1').records;
  assert.equal(result.scoreAvailable, false);
  assert.equal(result.temperature, undefined);
  assert.equal(result.humidity, undefined);
  assert.equal(result.snoringCount, undefined);
  assert.equal(parseAccountRecords([record(1, 0)], '1').records[0].scoreAvailable, true);
  assert.deepEqual(parseAccountRecords([], '1').records, []);
});
test('Latest same-day server record wins even if the API array is unsorted', () => {
  const result = parseAccountRecords([{ ...record(1, 90), created_at: day + 'T10:00:00Z' }, { ...record(1, 60), created_at: day + 'T09:00:00Z' }], '1');
  assert.equal(result.records[0].score, 90);
});
test('Sensor data must belong to the account and this measurement', () => {
  const now = Date.now();
  const rows = [{ id: 2, temp: 99, hum: 99, time_stamp: new Date(now).toISOString() }, { id: 1, temp: 23, hum: 51, time_stamp: new Date(now - 1000).toISOString() }];
  assert.equal(parseAccountSensor(rows, '1', now - 2000, now).temperature, 23);
  assert.equal(parseAccountSensor([{ ...rows[1], time_stamp: new Date(now - 300000).toISOString() }], '1', now - 2000, now), null);
  assert.equal(parseAccountSensor([{ id: 1, temp: 22, hum: 50 }], '1', now - 2000, now), null);
});
test('No sleep-stage chart is generated without real stage data', () => {
  assert.equal(parseSleepStages(undefined), undefined);
  assert.equal(parseSleepStages([{ stage: 'rem', durationMinutes: -1 }]), undefined);
  assert.deepEqual(parseSleepStages([{ stage: 'deep', duration_minutes: 30 }, { stage: 'rem', durationMinutes: 10 }]), [{ stage: 'deep', durationMinutes: 30 }, { stage: 'rem', durationMinutes: 10 }]);
  assert.equal(parseAccountRecords([record(1)], '1').records[0].sleepStages, undefined);
  assert.equal(parseAccountRecords([{ ...record(1), sleep_stages: [{ stage: 'rem', durationMinutes: 30 }] }], '1').records[0].sleepStages, undefined);
});
test('Delayed account A response cannot replace account B or a later login to A', () => {
  const gate = new AccountRequestGate();
  gate.setAccount('A'); const a = gate.begin('records');
  gate.setAccount('B'); const b = gate.begin('records');
  assert.equal(gate.current(a), false); assert.equal(gate.current(b), true);
  assert.equal(gate.begin('records', 'A'), null); assert.equal(gate.current(b), true);
  gate.setAccount('A'); gate.begin('records'); assert.equal(gate.current(a), false);
  gate.setAccount(null); assert.equal(gate.current(b), false);
});
test('The newest read within one account wins', () => {
  const gate = new AccountRequestGate(); gate.setAccount('A');
  const older = gate.begin('records'); const newer = gate.begin('records');
  assert.equal(gate.current(older), false); assert.equal(gate.current(newer), true);
});
test('API binding rejects wrong-account calls and invalidates replies on logout', () => {
  const account = new AuthenticatedAccount(); account.set('1');
  const ticket = account.begin('1'); assert.throws(() => account.begin('2'));
  account.set(null); assert.equal(account.current(ticket), false);
  account.set('1'); assert.equal(account.current(ticket), false);
});
test('Actual API functions send the bound id and discard a delayed HTTP reply', async () => {
  const seen = [];
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let requestStarted;
  const started = new Promise(resolve => { requestStarted = resolve; });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost'); seen.push(url.pathname + url.search);
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/login') {
      let body = ''; for await (const chunk of req) body += chunk;
      const credentials = JSON.parse(body);
      assert.equal(credentials.name, '');
      res.end(JSON.stringify(credentials.email === 'legacy@example.invalid'
        ? { message: 'login success', user_id: 2, user_name: 'B' }
        : { message: 'login success', id: 1, name: 'A', email: 'a@example.invalid' }));
      return;
    }
    if (url.pathname === '/profile/2') { res.end(JSON.stringify({ id: 2, name: 'B', email: 'legacy@example.invalid' })); return; }
    if (url.pathname === '/sleepinfo' && url.searchParams.get('id') === '1') { requestStarted(); await pending; }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify([record(Number(url.searchParams.get('id')))]));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:' + server.address().port;
  const service = require('../artifacts/mobile/services/authApi.ts');
  const facade = require('../artifacts/mobile/lib/api.ts').api;
  try {
    assert.equal((await facade.login('a@example.invalid', 'capture-only')).id, '1');
    await assert.rejects(() => service.getSleepInfoApi('undefined'));
    await assert.rejects(() => service.getSleepInfoApi('2'));
    const old = service.getSleepInfoApi('1');
    const oldRejected = assert.rejects(old, /계정이 변경/);
    await started;
    assert.equal((await facade.login('legacy@example.invalid', 'capture-only')).id, '2');
    const current = await service.getSleepInfoApi('2');
    assert.equal(current.data[0].id, 2);
    release(); await oldRejected;
    assert.deepEqual(seen, ['/login', '/sleepinfo?id=1', '/login', '/profile/2', '/sleepinfo?id=2']);
  } finally {
    release(); service.setApiAccount(null);
    await new Promise(resolve => server.close(resolve));
  }
});
