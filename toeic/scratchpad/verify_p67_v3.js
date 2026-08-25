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
  check('PART6が25長文100問になっている', counts.p6 === 25 && counts.p6q === 100, JSON.stringify(counts));
  check('READINGが32セット118問になっている', counts.p7 === 32 && counts.p7q === 118, JSON.stringify(counts));

  // 新規Part6長文(13本, index 12-24)が buildReadQueue(Part6側)で拾われること
  const p6queue = await page.evaluate(() => {
    const today = todayKey();
    for (let i = 0; i < 12; i++) state.part6Stats[i] = { lv: 4, next: addDays(today, 30), seen: 4, ok: 4 };
    for (let i = 12; i < 25; i++) state.part6Stats[i] = { lv: 0, next: today, seen: 1, ok: 0 };
    saveState();
    readSection = 6;
    return buildReadQueue().filter((i) => i >= 12).length;
  });
  check('新規Part6長文13本が出題キューに乗る(buildReadQueue)', p6queue > 0, `count=${p6queue}`);

  // 新規Part7セット(13件, index 19-31)が buildReadQueue(Part7側)で拾われること
  const p7queue = await page.evaluate(() => {
    const today = todayKey();
    for (let i = 0; i < 19; i++) state.readStats[i] = { lv: 4, next: addDays(today, 30), seen: 4, ok: 4 };
    for (let i = 19; i < 32; i++) state.readStats[i] = { lv: 0, next: today, seen: 1, ok: 0 };
    saveState();
    readSection = 7;
    return buildReadQueue().filter((i) => i >= 19).length;
  });
  check('新規Part7セット13件が出題キューに乗る(buildReadQueue)', p7queue > 0, `count=${p7queue}`);

  // 新規Part6長文(社内異動のお知らせ)が実際に描画され、空所4つがラベル化されること
  const p6render = await page.evaluate(() => {
    const idx = PART6.findIndex((p) => p.t === '社内異動のお知らせ');
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

  // 新規Part6の最後の長文(社内規定変更のお知らせ)も描画確認
  const p6renderLast = await page.evaluate(() => {
    const idx = PART6.findIndex((p) => p.t === '社内規定変更のお知らせ');
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
    };
  });
  check('新規Part6最終長文(25番目)も描画され空所が置換される', p6renderLast.hasLabels && !p6renderLast.leftoverBrace, JSON.stringify(p6renderLast));

  // 新規Part7(アプリのプッシュ通知)が描画されること
  const p7render = await page.evaluate(() => {
    const idx = READING.findIndex((r) => r.t === 'アプリのプッシュ通知');
    readSection = 7;
    readQueue = [idx];
    readPos = 0;
    readQPos = 0;
    renderReadPassages();
    showReadQuestion();
    return {
      idx,
      passage: document.getElementById('read-passages').textContent.includes('FreshCart'),
      question: document.getElementById('read-question').textContent.length > 0,
      choices: document.querySelectorAll('#read-choices .choice-btn').length,
    };
  });
  check('新規Part7(アプリのプッシュ通知)の本文・設問・選択肢が描画される',
    p7render.passage && p7render.question && p7render.choices === 4, JSON.stringify(p7render));

  // 新規ダブルパッセージ(レストラン予約、5問)が2文書とも描画されること
  const dbl = await page.evaluate(() => {
    const idx = READING.length - 1; // 末尾に追加した最後のダブルパッセージ(レストラン予約)
    readSection = 7;
    readQueue = [idx];
    readPos = 0;
    readQPos = 0;
    renderReadPassages();
    showReadQuestion();
    const body = document.getElementById('read-passages').textContent;
    return {
      t: READING[idx].t,
      qCount: READING[idx].qs.length,
      hasConfirmation: body.includes('Copper Grill'),
      hasEmail: body.includes('Alan Turner'),
    };
  });
  check('新規ダブルパッセージ(レストラン予約)が2文書とも描画される', dbl.hasConfirmation && dbl.hasEmail, JSON.stringify(dbl));
  check('新規ダブルパッセージ(レストラン予約)は5問構成', dbl.qCount === 5, JSON.stringify(dbl));

  // Part6セッションを実際に完走できること(100問体制)
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
  check('Part6セッションが完走する(100問体制でも従来どおり)', p6done, `clicks=${clicks}`);

  // Part7セッションを実際に完走できること(118問体制)
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.click('[data-tab="read"]');
  await page.waitForTimeout(150);
  await page.click('#part7-start-btn');
  await page.waitForTimeout(200);
  let clicks7 = 0;
  for (let i = 0; i < 40; i++) {
    const done = await page.evaluate(() => !document.getElementById('read-result').classList.contains('hidden'));
    if (done) break;
    const btns = await page.$$('#read-choices .choice-btn:not([disabled])');
    if (btns.length) {
      await btns[0].click(); await page.waitForTimeout(30);
      await page.click('#read-next-btn').catch(() => {});
      clicks7++;
      await page.waitForTimeout(40);
    } else await page.waitForTimeout(50);
  }
  const p7done = await page.evaluate(() => !document.getElementById('read-result').classList.contains('hidden'));
  check('Part7セッションが完走する(118問体制でも従来どおり)', p7done, `clicks=${clicks7}`);

  check('コンソールエラー0件', errors.length === 0, errors.slice(0, 8).join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
