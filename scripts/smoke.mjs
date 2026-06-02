// Minimal CDP smoke test: launch Chrome, load the app, collect console + exceptions,
// and report whether the app DOM mounted. Uses Node 22 built-in WebSocket/fetch.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_TO_LOAD = process.argv[2] ?? 'http://localhost:4173/retro-pocket-games/#/';
const CHROME =
  process.env.CHROME ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;
const userDir = mkdtempSync(join(tmpdir(), 'rp-cdp-'));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDir}`,
    '--no-first-run',
    '--window-size=430,820',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await res.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch {
      /* not ready yet */
    }
    await sleep(200);
  }
  throw new Error('CDP not ready');
}

async function main() {
  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);
  const logs = [];
  const errors = [];
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve) => {
      const mid = ++id;
      pending.set(mid, resolve);
      ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
    });

  await new Promise((r) => (ws.onopen = r));

  let sessionId;
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const a = (msg.params.args ?? []).map((x) => x.value ?? x.description ?? '').join(' ');
      logs.push(`[${msg.params.type}] ${a}`);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push(d.exception?.description ?? d.text ?? JSON.stringify(d));
    }
  };

  // attach to a tab
  const { targetInfos } = await send('Target.getTargets');
  let target = targetInfos.find((t) => t.type === 'page');
  if (!target) {
    const created = await send('Target.createTarget', { url: 'about:blank' });
    target = { targetId: created.targetId };
  }
  const att = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  sessionId = att.sessionId;

  await send('Runtime.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Page.navigate', { url: URL_TO_LOAD }, sessionId);

  await sleep(5000); // real wall-clock for async boot + IndexedDB

  const domRes = await send(
    'Runtime.evaluate',
    {
      expression: `JSON.stringify({
        hasDevice: !!document.querySelector('.device'),
        hasRail: !!document.querySelector('.rail'),
        tiles: document.querySelectorAll('.tile').length,
        navItems: document.querySelectorAll('.nav__item').length,
        splashOnly: !!document.querySelector('.boot-splash') && !document.querySelector('.device'),
        canvas: !!document.querySelector('canvas'),
      })`,
      returnByValue: true,
    },
    sessionId,
  );

  console.log('=== DOM probe ===');
  console.log(domRes.result.value);
  console.log('=== console logs (' + logs.length + ') ===');
  logs.slice(0, 30).forEach((l) => console.log(l));
  console.log('=== exceptions (' + errors.length + ') ===');
  errors.slice(0, 20).forEach((e) => console.log(e));

  if (process.env.SHOT) {
    const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const { writeFileSync } = await import('node:fs');
    writeFileSync(process.env.SHOT, Buffer.from(shot.data, 'base64'));
    console.log('screenshot ->', process.env.SHOT);
  }

  ws.close();
  chrome.kill();
  process.exit(0);
}

main().catch((e) => {
  console.error('SMOKE FAIL:', e);
  chrome.kill();
  process.exit(1);
});
