import { chromium, firefox, webkit } from 'playwright';
import fs from 'node:fs';

const HOST = 'https://trivia-generator-qssbvh95g-andrew-nguyen-99.vercel.app';
const SHARE = 'XiPmVnZZ4Stqa3hG1NUpstdY67nLjYD0';
const AXE = fs.readFileSync('./node_modules/axe-core/axe.min.js', 'utf8');

const GAME_ROUTES = ['/', '/board', '/clock', '/wedges', '/streak', '/map',
  '/thread', '/seance', '/ladder', '/mystery', '/gauntlet', '/cold-case', '/overture'];
const KEY_ROUTES = ['/', '/board', '/clock', '/map', '/wedges'];

// noise we don't count as real console errors
const isNoise = (t) => /favicon|_vercel|404 \(Not Found\).*\.(ico|png|svg)|Failed to load resource: the server responded with a status of 404/i.test(t);

async function authContext(ctx) {
  // visiting the share URL once sets the _vercel_jwt bypass cookie on the context
  const p = await ctx.newPage();
  await p.goto(`${HOST}/?_vercel_share=${SHARE}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await p.close();
}

function wire(page) {
  const rec = { consoleErrors: [], pageErrors: [] };
  page.on('console', (m) => { if (m.type() === 'error' && !isNoise(m.text())) rec.consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => rec.pageErrors.push(String(e).slice(0, 200)));
  return rec;
}

const results = { mobileSweep: [], multiEngine: [], axe: [] };

// ---------- Gate 2: mobile sweep (chromium, iPhone-class viewport) ----------
{
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  await authContext(ctx);
  for (const route of GAME_ROUTES) {
    const page = await ctx.newPage();
    const rec = wire(page);
    let status = 0, overflow = null, title = '';
    try {
      const resp = await page.goto(HOST + route, { waitUntil: 'networkidle', timeout: 45000 });
      status = resp ? resp.status() : 0;
      await page.waitForTimeout(800);
      title = (await page.title()).slice(0, 60);
      overflow = await page.evaluate(() => {
        const el = document.scrollingElement || document.documentElement;
        return Math.max(0, el.scrollWidth - window.innerWidth);
      });
    } catch (e) { rec.pageErrors.push('NAV: ' + String(e).slice(0, 120)); }
    results.mobileSweep.push({ route, status, title, overflowPx: overflow, ...rec });
    await page.close();
  }
  // screenshots of two key rooms at mobile width
  for (const r of ['/', '/board']) {
    const page = await ctx.newPage();
    try { await page.goto(HOST + r, { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(600);
      await page.screenshot({ path: `mobile${r === '/' ? '-home' : r.replace('/', '-')}.png` }); } catch {}
    await page.close();
  }
  await browser.close();
}

// ---------- Gate 3: multi-engine (chromium / firefox / webkit, desktop) ----------
for (const [name, type] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
  const browser = await type.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await authContext(ctx);
  const perRoute = [];
  for (const route of KEY_ROUTES) {
    const page = await ctx.newPage();
    const rec = wire(page);
    let status = 0, title = '', h1 = '';
    try {
      const resp = await page.goto(HOST + route, { waitUntil: 'networkidle', timeout: 45000 });
      status = resp ? resp.status() : 0;
      await page.waitForTimeout(600);
      title = (await page.title()).slice(0, 60);
      h1 = await page.evaluate(() => document.querySelector('h1,h2')?.textContent?.trim().slice(0, 50) || '');
    } catch (e) { rec.pageErrors.push('NAV: ' + String(e).slice(0, 120)); }
    perRoute.push({ route, status, title, h1, pageErrors: rec.pageErrors.length, consoleErrors: rec.consoleErrors.length });
    await page.close();
  }
  results.multiEngine.push({ engine: name, version: browser.version(), routes: perRoute });
  await browser.close();
}

// ---------- Gate 4: axe-core a11y (chromium desktop) ----------
{
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await authContext(ctx);
  for (const route of KEY_ROUTES) {
    const page = await ctx.newPage();
    let out = { route, error: null, violations: [] };
    try {
      await page.goto(HOST + route, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(600);
      await page.addScriptTag({ content: AXE });
      const res = await page.evaluate(async () => await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } }));
      out.violations = res.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help.slice(0, 80) }));
    } catch (e) { out.error = String(e).slice(0, 160); }
    results.axe.push(out);
    await page.close();
  }
  await browser.close();
}

fs.writeFileSync('gates-results.json', JSON.stringify(results, null, 2));

// ---- console summary + verification asserts ----
const sweepFails = results.mobileSweep.filter((r) => r.status >= 400 || r.pageErrors.length || r.overflowPx > 1);
const engineFails = results.multiEngine.flatMap((e) => e.routes.filter((r) => r.status >= 400 || r.pageErrors).map((r) => `${e.engine}${r.route}`));
const axeTotals = {};
for (const r of results.axe) for (const v of r.violations) axeTotals[v.impact] = (axeTotals[v.impact] || 0) + v.nodes;

console.log('\n=== GATE 2 mobile sweep ===');
for (const r of results.mobileSweep) console.log(`${String(r.status).padEnd(3)} ovf=${String(r.overflowPx).padEnd(4)} perr=${r.pageErrors.length} cerr=${r.consoleErrors.length}  ${r.route}`);
console.log('\n=== GATE 3 multi-engine ===');
for (const e of results.multiEngine) console.log(`${e.engine.padEnd(9)} ${e.version.padEnd(14)} ` + e.routes.map((r) => `${r.route}:${r.status}${r.pageErrors ? '!' : ''}`).join(' '));
console.log('\n=== GATE 4 axe (wcag2a/aa) ===');
for (const r of results.axe) console.log(`${r.route.padEnd(10)} ${r.error ? 'ERR ' + r.error : r.violations.length + ' violations: ' + r.violations.map((v) => `${v.id}(${v.impact}×${v.nodes})`).join(', ')}`);
console.log('\naxe totals by impact:', JSON.stringify(axeTotals));
console.log('mobile sweep fails (status>=400 | pageerror | overflow>1px):', sweepFails.length);
console.log('multi-engine load fails:', engineFails.length, engineFails.join(' '));
