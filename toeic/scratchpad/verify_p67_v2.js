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

  const counts = await page.evaluate(() => ({
    p6: PART6.length,
    p6q: PART6.reduce((a, p) => a + p.qs.length, 0),
    p7: READING.length,
    p7q: READING.reduce((a, r) => a + r.qs.length, 0),
  }));
  check('PART6が12長文48問になっている', counts.p6 === 12 && counts.p6q === 48, JSON.stringify(counts));
  check('READINGが19セット68問になっている', counts.p7 === 19 && counts.p7q === 68, JSON.stringify(counts));

  // 新規Part6長文が buildReadQueue(Part6側)で拾われること
  const p6queue = await page.evaluate(() => {
    const today = todayKey();
    for (let i = 0; i < 9; i++) state.part6Stats[i] = { lv: 4, next: addDays(today, 30), seen: 4, ok: 4 };
    for (let i = 9; i < 12; i++) state.part6Stats[i] = { lv: 0, next: today, seen: 1, ok: 0 };
    saveState();
    readSection = 6;
    return buildReadQueue().filter((i) => i >= 9).length;
  });
  check('新規Part6長文3本が出題キューに乗る(buildReadQueue)', p6queue > 0, `count=${p6queue}`);

  // 新規Part7セットが buildReadQueue(Part7側)で拾われること
  const p7queue = await page.evaluate(() => {
    const today = todayKey();
    for (let i = 0; i < 16; i++) state.readStats[i] = { lv: 4, next: addDays(today, 30), seen: 4, ok: 4 };
    for (let i = 16; i < 19; i++) state.readStats[i] = { lv: 0, next: today, seen: 1, ok: 0 };
    saveState();
    readSection = 7;
    return buildReadQueue().filter((i) => i >= 16).length;
  });
  check('新規Part7セット3件が出題キューに乗る(buildReadQueue)', p7queue > 0, `count=${p7queue}`);

  // 新規Part6長文(保証案内)が実際に描画され、空所4つがラベル化されること
  const p6render = await page.evaluate(() => {
    const idx = PART6.findIndex((p) => p.t === '保証案内');
    readSection = 6;
    readQueue = [idx];
    readPos = 0;
    readQPos = 0;
    renderReadPassages();
    showReadQuestion();
    const body = document.getElementById('read-passages').textContent;
    return {
      idx,
      hasLabels: ['(1)', '(2)', '(3)', '(4)'].every((l) => body.includes(l)),
      leftoverBrace: /\{\d\}/.test(body),
      choices: document.querySelectorAll('#read-choices .choice-btn').length,
      hasTag: document.querySelector('#read-choices .choice-tag') !== null,
    };
  });
  check('新規Part6長文が描画され空所が(1)〜(4)に置換される', p6render.hasLabels && !p6render.leftoverBrace, JSON.stringify(p6render));
  check('新規Part6長文の選択肢が4つ表示される', p6render.choices === 4 && p6render.hasTag, JSON.stringify(p6render));

  // 新規Part7(オンラインチャット)が描画されること
  const p7render = await page.evaluate(() => {
    const idx = READING.findIndex((r) => r.t === 'オンラインチャット');
    readSection = 7;
    readQueue = [idx];
    readPos = 0;
    readQPos = 0;
    renderReadPassages();
    showReadQuestion();
    return {
      idx,
      passage: document.getElementById('read-passages').textContent.includes('Rachel Kim'),
      question: document.getElementById('read-question').textContent.length > 0,
      choices: document.querySelectorAll('#read-choices .choice-btn').length,
    };
  });
  check('新規Part7(オンラインチャット)の本文・設問・選択肢が描画される',
    p7render.passage && p7render.question && p7render.choices === 4, JSON.stringify(p7render));

  // ダブルパッセージが2文書とも描画されること
  const dbl = await page.evaluate(() => {
    const idx = READING.length - 1; // 末尾に追加したダブルパッセージ
    readSection = 7;
    readQueue = [idx];
    readPos = 0;
    readQPos = 0;
    renderReadPassages();
    showReadQuestion();
    const body = document.getElementById('read-passages').textContent;
    return {
      t: READING[idx].t,
      hasNotice: body.includes('Riverton Chamber of Commerce'),
      hasEmail: body.includes('Nadia Barnes'),
    };
  });
  check('新規ダブルパッセージが2文書とも描画される', dbl.hasNotice && dbl.hasEmail, JSON.stringify(dbl));

  // Part6セッションを実際に完走できること
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.click('[data-tab="read"]');
  await page.waitForTimeout(150);
  await page.click('#part6-start-btn');
  await page.waitForTimeout(200);
  let clicks = 0;
  for (let i = 0; i < 40; i++) {
    const done = await page.evaluate(() => !document.getElementById('read-result').classList.contains('hidden'));
    if (done) break;
    const btns = await page.$$('#read-choices .choice-btn:not([disabled])');
    if (btns.length) {
      await btns[0].click(); await page.waitForTimeout(30);
      await page.click('#read-next-btn').catch(() => {});
      clicks++;
      await page.waitForTimeout(40);
    } else await page.waitForTimeout(50);
  }
  const p6done = await page.evaluate(() => !document.getElementById('read-result').classList.contains('hidden'));
  check('Part6セッションが完走する(48問体制でも従来どおり)', p6done, `clicks=${clicks}`);

  check('コンソールエラー0件', errors.length === 0, errors.slice(0, 8).join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
