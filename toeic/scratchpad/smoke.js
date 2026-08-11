const { chromium } = require('playwright');

const URL = 'http://localhost:8099/index.html';
const KEY = 'toeic600-v1';

function dk(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  // scenario helper: seed localStorage, reload, run fn, return resulting state
  async function run(seed, fnBody) {
    await page.goto(URL);
    await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [KEY, seed]);
    await page.reload();
    return await page.evaluate((body) => {
      // eslint-disable-next-line no-eval
      eval(body);
      return JSON.parse(localStorage.getItem('toeic600-v1'));
    }, fnBody);
  }

  // 0) fresh load, no console errors, hero renders
  await page.goto(URL);
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await page.reload();
  const heroCount = await page.textContent('#streak-count');
  check('fresh load: hero renders', heroCount !== null, `streak-count="${heroCount}"`);

  // A) consecutive day increments
  let st = await run({ streak: { count: 5, lastActive: dk(-1), best: 5 }, freezes: 0 }, 'window.touchStreak();');
  check('A consecutive: 5 -> 6', st.streak.count === 6, `count=${st.streak.count}`);

  // B) 1 missed day, 1 freeze -> preserved, freeze consumed
  st = await run({ streak: { count: 5, lastActive: dk(-2), best: 5 }, freezes: 1 }, 'window.touchStreak();');
  check('B 1-gap w/freeze: preserved', st.streak.count === 6 && st.freezes === 0, `count=${st.streak.count} freezes=${st.freezes}`);

  // C) 2 missed days, only 1 freeze -> reset, freeze NOT consumed
  st = await run({ streak: { count: 5, lastActive: dk(-3), best: 5 }, freezes: 1 }, 'window.touchStreak();');
  check('C 2-gap w/1 freeze: reset', st.streak.count === 1 && st.freezes === 1, `count=${st.streak.count} freezes=${st.freezes}`);

  // D) milestone at 7 grants gems + freeze
  st = await run({ streak: { count: 6, lastActive: dk(-1), best: 6 }, freezes: 0, gems: 0, streakMilestones: [3] }, 'window.touchStreak();');
  check('D milestone 7: +40 gems +1 freeze', st.streak.count === 7 && st.gems === 40 && st.freezes === 1 && st.streakMilestones.includes(7),
    `count=${st.streak.count} gems=${st.gems} freezes=${st.freezes}`);

  // E) buyFreeze spends 200 gems
  st = await run({ gems: 250, freezes: 0 }, 'window.buyFreeze();');
  check('E buyFreeze: -200 gems +1 freeze', st.gems === 50 && st.freezes === 1, `gems=${st.gems} freezes=${st.freezes}`);

  // F) buyFreeze blocked at max stock
  st = await run({ gems: 500, freezes: 2 }, 'window.buyFreeze();');
  check('F buyFreeze blocked at max', st.gems === 500 && st.freezes === 2, `gems=${st.gems} freezes=${st.freezes}`);

  // G) openChest awards gems in range
  st = await run({ gems: 0 }, 'window.openChest(30); window.saveState();');
  check('G openChest bronze: 10-20 gems', st.gems >= 10 && st.gems <= 20, `gems=${st.gems}`);

  // H) migration: existing user with logs but no streak field gets streak seeded
  const logSeed = {};
  logSeed[dk(0)] = { words: 5, quiz: 0, correct: 0, listen: 0, listenOk: 0, read: 0, readOk: 0 };
  logSeed[dk(-1)] = { words: 3, quiz: 0, correct: 0, listen: 0, listenOk: 0, read: 0, readOk: 0 };
  logSeed[dk(-2)] = { words: 2, quiz: 0, correct: 0, listen: 0, listenOk: 0, read: 0, readOk: 0 };
  await page.goto(URL);
  await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [KEY, { log: logSeed }]);
  await page.reload();
  const migrated = await page.evaluate(() => ({ count: window.calcStreak(), text: document.getElementById('streak-count').textContent }));
  check('H migration seeds streak from logs (3 days)', migrated.count === 3, `count=${migrated.count} shown=${migrated.text}`);

  // shop dialog opens on hero click
  await page.goto(URL);
  await page.click('#streak-hero');
  const shopOpen = await page.evaluate(() => document.getElementById('shop-dialog').open);
  check('shop dialog opens on hero tap', shopOpen === true);

  check('no console/page errors during run', errors.length === 0, errors.slice(0,5).join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
