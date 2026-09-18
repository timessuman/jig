import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { PROBE_SCRIPT } from './script.js';

/**
 * Running the probe, by the CLI, in a headless browser it finds for itself.
 *
 * The probe existed before this and still does: an agent evaluates it in
 * whatever browser it has. But "the agent has to run it" was the last thing
 * standing between a review and a measurement — a step that can be skipped is
 * a step that gets skipped, every live run has shown that. When a browser is
 * on this machine, nobody has to be asked: `jig probe --run` drives it, and the
 * Stop hook runs the probes itself rather than blocking and hoping.
 *
 * No dependency for any of it. Chrome speaks its own debugging protocol over a
 * WebSocket, and Node has had a WebSocket client since 22.
 */

const CHROME_ENV = ['JIG_CHROME', 'CHROME_PATH', 'PUPPETEER_EXECUTABLE_PATH', 'CHROMIUM_PATH'];
const CHROME_COMMANDS = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser'];
const CHROME_APPS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

/** Browsers a tool already downloaded here: Playwright's and Puppeteer's
 *  caches. A project that installed either has a browser whether or not the
 *  machine has one of its own. */
function cachedBrowsers(): string[] {
  const roots = [
    join(homedir(), '.cache', 'ms-playwright'),
    join(homedir(), 'Library', 'Caches', 'ms-playwright'),
    join(homedir(), 'AppData', 'Local', 'ms-playwright'),
    join(homedir(), '.cache', 'puppeteer', 'chrome'),
  ];
  const found: string[] = [];
  for (const root of roots) {
    let entries: string[];
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }
    for (const entry of entries.sort().reverse()) {
      for (const rel of [
        ['chrome-linux', 'chrome'], ['chrome-linux64', 'chrome'], ['chrome-headless-shell-linux64', 'chrome-headless-shell'],
        ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'], ['chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'],
        ['chrome-win', 'chrome.exe'], ['chrome-win64', 'chrome.exe'],
      ]) {
        const candidate = join(root, entry, ...rel);
        if (existsSync(candidate)) found.push(candidate);
      }
    }
  }
  return found;
}

export function findChrome(): string | undefined {
  for (const key of CHROME_ENV) {
    const value = process.env[key];
    if (value && existsSync(value)) return value;
  }
  for (const command of CHROME_COMMANDS) {
    const resolved = which(command);
    if (resolved) return resolved;
  }
  for (const app of CHROME_APPS) if (existsSync(app)) return app;
  return cachedBrowsers()[0];
}

function which(command: string): string | undefined {
  const dirs = (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':');
  for (const dir of dirs) {
    if (!dir) continue;
    const candidate = join(dir, command);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

interface CdpMessage { id?: number; method?: string; params?: Record<string, unknown>; result?: Record<string, unknown>; sessionId?: string; error?: { message: string } }

/** Evaluates the probe against one URL at one width, and returns its JSON. */
export async function runProbe(opts: { url: string; width: number; height?: number; chrome?: string; timeoutMs?: number }): Promise<string> {
  const chrome = opts.chrome ?? findChrome();
  if (!chrome) {
    throw new Error(
      'No browser found to run the probe. Install one, or set JIG_CHROME to a Chrome, Chromium or Edge binary. ' +
        'A project with Playwright or Puppeteer already has one, and Jig will find it.',
    );
  }
  const profile = mkdtempSync(join(tmpdir(), 'jig-probe-'));
  const child = spawn(chrome, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
    '--disable-extensions', '--disable-background-networking', '--no-sandbox', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const timeoutMs = opts.timeoutMs ?? 30_000;
  try {
    const endpoint = await new Promise<string>((done, fail) => {
      const timer = setTimeout(() => fail(new Error(`${chrome} did not start within ${timeoutMs / 1000}s.`)), timeoutMs);
      let buffered = '';
      child.stderr!.on('data', (chunk: Buffer) => {
        buffered += chunk.toString();
        const match = /ws:\/\/[^\s]+/.exec(buffered);
        if (match) { clearTimeout(timer); done(match[0]); }
      });
      child.on('exit', (code) => { clearTimeout(timer); fail(new Error(`${chrome} exited with code ${code} before it was ready.`)); });
    });
    return await evaluate(endpoint, opts.url, opts.width, opts.height ?? 900, timeoutMs);
  } finally {
    child.kill();
    rmSync(profile, { recursive: true, force: true });
  }
}

async function evaluate(endpoint: string, url: string, width: number, height: number, timeoutMs: number): Promise<string> {
  const socket = new WebSocket(endpoint);
  let nextId = 1;
  const pending = new Map<number, { done: (value: Record<string, unknown>) => void; fail: (err: Error) => void }>();
  const loaded = { fired: false, waiters: [] as Array<() => void> };

  await new Promise<void>((done, fail) => {
    socket.addEventListener('open', () => done(), { once: true });
    socket.addEventListener('error', () => fail(new Error('Could not connect to the browser.')), { once: true });
  });

  socket.addEventListener('message', (event: MessageEvent) => {
    const message = JSON.parse(String(event.data)) as CdpMessage;
    if (message.id && pending.has(message.id)) {
      const { done, fail } = pending.get(message.id)!;
      pending.delete(message.id);
      if (message.error) fail(new Error(message.error.message));
      else done(message.result ?? {});
    }
    if (message.method === 'Page.loadEventFired') {
      loaded.fired = true;
      for (const waiter of loaded.waiters.splice(0)) waiter();
    }
  });

  const send = (method: string, params: Record<string, unknown> = {}, sessionId?: string) =>
    new Promise<Record<string, unknown>>((done, fail) => {
      const id = nextId++;
      pending.set(id, { done, fail });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
      setTimeout(() => { if (pending.delete(id)) fail(new Error(`${method} timed out.`)); }, timeoutMs);
    });

  try {
    const target = await send('Target.createTarget', { url: 'about:blank' });
    const attached = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    const session = attached.sessionId as string;
    await send('Page.enable', {}, session);
    // `mobile: false` deliberately. Mobile emulation gives a page with no
    // viewport meta tag the 980px fallback layout, so a probe asked for 360
    // records 980 and the file lands under the wrong width. What is measured
    // here is the CSS viewport, which is what the rules are written against.
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, session);
    await send('Page.navigate', { url }, session);
    if (!loaded.fired) {
      await Promise.race([
        new Promise<void>((done) => loaded.waiters.push(done)),
        new Promise<void>((done) => setTimeout(done, timeoutMs / 2)),
      ]);
    }
    // The page's own scripts run on load; the probe reads what they produced.
    await new Promise((done) => setTimeout(done, 250));
    const result = await send('Runtime.evaluate', { expression: PROBE_SCRIPT, awaitPromise: true, returnByValue: true }, session);
    const value = (result.result as { value?: unknown } | undefined)?.value;
    if (typeof value !== 'string') {
      const description = (result.exceptionDetails as { text?: string } | undefined)?.text;
      throw new Error(`The probe returned nothing${description ? `: ${description}` : ''}. Is ${url} a page this browser can open?`);
    }
    return value;
  } finally {
    socket.close();
  }
}
