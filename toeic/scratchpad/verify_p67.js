const { chromium } = require('playwright');
const URL = 'http://localhost:8099/index.html';

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // ---- データ規模の確認(開始画面の件数表示) ----
  const dataCounts = await page.evaluate(() => ({
    part6: PART6.length,
    part6Q: PART6.reduce((s, p) => s + p.qs.length, 0),
    reading: READING.length,
    readingQ: READING.reduce((s, p) => s + p.qs.length, 0),
  }));
  check('PART6が12長文・48問になっている', dataCounts.part6 === 12 && dataCounts.part6Q === 48, JSON.stringify(dataCounts));
  check('READINGが19セット・68問になっている', dataCounts.reading === 19 && dataCounts.readingQ === 68, JSON.stringify(dataCounts));

  // ---- Part 6を最後まで解いてSRS更新を確認 ----
  await page.click('[data-tab="read"]');
  await page.waitForTimeout(150);
  await page.click('#part6-start-btn');
  await page.waitForTimeout(200);
  let clicks = 0;
  for (let i = 0; i < 80; i++) {
    const done = await page.evaluate(() => !document.getElementById('read-result').classList.contains('hidden'));
    if (done) break;
    const btns = await page.$$('#read-choices .choice-btn:not([disabled])');
    if (btns.length) {
      await btns[0].click(); await page.waitForTimeout(30);
      await page.click('#read-next-btn').catch(() => {});
      clicks++;
      await page.waitForTimeout(40);
    } else await page.waitForTimeout(60);
  }
  const part6Done = await page.evaluate(() => !document.getElementById('read-result').classList.contains('hidden'));
  check('Part6セッションが完走する', part6Done, `clicks=${clicks}`);
  const part6Stats = await page.evaluate(() => Object.keys(state.part6Stats || {}).length);
  check('Part6のSRS記録(state.part6Stats)が更新されている', part6Stats > 0, `records=${part6Stats}`);

  // ---- Part 7を最後まで解いてSRS更新を確認 ----
  await page.evaluate(() => showTab('read'));
  await page.waitForTimeout(150);
  await page.click('#part7-start-btn');
  await page.waitForTimeout(200);
  clicks = 0;
  for (let i = 0; i < 120; i++) {
    const done = await page.evaluate(() => !document.getElementById('read-result').classList.contains('hidden'));
    if (done) break;
    const btns = await page.$$('#read-choices .choice-btn:not([disabled])');
    if (btns.length) {
      await btns[0].click(); await page.waitForTimeout(30);
      await page.click('#read-next-btn').catch(() => {});
      clicks++;
      await page.waitForTimeout(40);
    } else await page.waitForTimeout(60);
  }
  const part7Done = await page.evaluate(() => !document.getElementById('read-result').classList.contains('hidden'));
  check('Part7セッションが完走する', part7Done, `clicks=${clicks}`);
  const readStats = await page.evaluate(() => Object.keys(state.readStats || {}).length);
  check('Part7のSRS記録(state.readStats)が更新されている', readStats > 0, `records=${readStats}`);

  // ---- 新規セットが実際に出題されることを繰り返し確認(due/freshに含まれるか) ----
  // 新規追加分を優先的に出題させるため、既存分を全て「既習(next=未来)」にした状態で出題キューを見る
  const newSetsAppear = await page.evaluate(() => {
    // READING全件を復習済み(next=遠い未来)にし、新規9件だけ復習期日を今日にする
    const today = todayKey();
    READING.forEach((_, i) => { state.readStats[i] = { lv: 4, next: addDays(today, 30), seen: 4, ok: 4 }; });
    // 新規3セット(index13,14,15)だけ復習期日を今日に戻す
    [13, 14, 15].forEach((i) => { state.readStats[i] = { lv: 0, next: today, seen: 1, ok: 0 }; });
    saveState();
    const queue = buildReadQueue();
    return queue.some((i) => [13, 14, 15].includes(i));
  });
  check('新規Part7セットが出題キューのロジックに正しく乗る(buildReadQueueで拾われる)', newSetsAppear);

  check('コンソールエラー0件', errors.length === 0, errors.slice(0, 8).join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
