const { chromium } = require('playwright');

const URL = 'http://localhost:8099/index.html';

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => {
    window.speechSynthesis.speak = (u) => { if (u && u.onend) setTimeout(() => u.onend(), 1); };
    window.speechSynthesis.cancel = () => {};
    window.speechSynthesis.getVoices = () => [];
  });

  // ---- 単語 ----
  await page.click('[data-tab="words"]'); await page.waitForTimeout(100);
  await page.click('#words-start-btn'); await page.waitForTimeout(150);
  for (let i = 0; i < 25; i++) {
    const done = await page.evaluate(() => !document.getElementById('words-result').classList.contains('hidden'));
    if (done) break;
    await page.click('#flashcard'); await page.waitForTimeout(20);
    await page.click(i % 3 === 0 ? '#fc-ng-btn' : '#fc-ok-btn').catch(() => {});
    await page.waitForTimeout(30);
  }
  const wordsDone = await page.evaluate(() => !document.getElementById('words-result').classList.contains('hidden'));
  check('words: session completes', wordsDone);

  // ---- 文法 (quiz) ----
  await page.click('[data-tab="quiz"]'); await page.waitForTimeout(100);
  await page.click('#quiz-start-btn'); await page.waitForTimeout(150);
  const quizDots = await page.$$eval('#quiz-qdots .qdot', els => els.length);
  for (let i = 0; i < 15; i++) {
    const done = await page.evaluate(() => !document.getElementById('quiz-result').classList.contains('hidden'));
    if (done) break;
    const btns = await page.$$('#quiz-choices .choice-btn:not([disabled])');
    if (btns.length) { await btns[i % 4 < 2 ? 0 : 1].click(); await page.waitForTimeout(40); await page.click('#quiz-next-btn').catch(() => {}); await page.waitForTimeout(50); }
    else await page.waitForTimeout(50);
  }
  const quizDone = await page.evaluate(() => !document.getElementById('quiz-result').classList.contains('hidden'));
  check('quiz: session completes', quizDone, `dots=${quizDots}`);

  // ---- リスニング Part1/2 ----
  await page.click('[data-tab="listen"]'); await page.waitForTimeout(100);
  await page.click('#part1-start-btn'); await page.waitForTimeout(200);
  const listenDots = await page.$$eval('#listen-qdots .qdot', els => els.length);
  for (let i = 0; i < 12; i++) {
    const done = await page.evaluate(() => !document.getElementById('listen-result').classList.contains('hidden'));
    if (done) break;
    const btns = await page.$$('#listen-choices .abc-btn:not([disabled])');
    if (btns.length) { await btns[0].click(); await page.waitForTimeout(40); await page.click('#listen-next-btn').catch(() => {}); await page.waitForTimeout(50); }
    else await page.waitForTimeout(80);
  }
  const listenDone = await page.evaluate(() => !document.getElementById('listen-result').classList.contains('hidden'));
  check('listen (part1): session completes', listenDone, `dots=${listenDots}`);

  // ---- リスニング Part3/4 ----
  await page.click('[data-tab="listen"]'); await page.waitForTimeout(100);
  await page.click('#part4-start-btn'); await page.waitForTimeout(300);
  for (let s = 0; s < 3; s++) {
    const done = await page.evaluate(() => !document.getElementById('listen34-result').classList.contains('hidden'));
    if (done) break;
    const blocks = await page.$$('#listen34-questions .l34-qblock');
    for (const bl of blocks) { const c = await bl.$('.choice-btn'); await c.click(); await page.waitForTimeout(20); }
    await page.click('#listen34-check-btn').catch(() => {});
    await page.waitForTimeout(500);
    await page.click('#listen34-next-btn').catch(() => {});
    await page.waitForTimeout(200);
  }
  const listen34Done = await page.evaluate(() => !document.getElementById('listen34-result').classList.contains('hidden'));
  check('listen34 (part4): session completes', listen34Done);

  // ---- 読解 Part6/7 ----
  await page.click('[data-tab="read"]'); await page.waitForTimeout(100);
  await page.click('#part7-start-btn'); await page.waitForTimeout(200);
  for (let i = 0; i < 60; i++) {
    const done = await page.evaluate(() => !document.getElementById('read-result').classList.contains('hidden'));
    if (done) break;
    const btns = await page.$$('#read-choices .choice-btn:not([disabled])');
    if (btns.length) { await btns[0].click(); await page.waitForTimeout(30); await page.click('#read-next-btn').catch(() => {}); await page.waitForTimeout(40); }
    else await page.waitForTimeout(60);
  }
  const readDone = await page.evaluate(() => !document.getElementById('read-result').classList.contains('hidden'));
  check('read (part7): session completes', readDone);

  // ---- 帰属チェック: 演出が積み残っていないか(セッション終了ごとにflush済みのはず)、ホームに戻ってバナーが残っていないか ----
  await page.click('[data-tab="home"]').catch(() => {});
  await page.waitForTimeout(300);
  const homeErr = errors.length;
  check('no console/page errors across full 5-mode flow', errors.length === 0, errors.slice(0, 10).join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
