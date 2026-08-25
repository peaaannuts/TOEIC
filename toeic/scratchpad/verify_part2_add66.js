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
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  // Stub speechSynthesis so listening flows don't hang headless
  await page.addInitScript(() => {
    window.speechSynthesis.speak = function (u) { setTimeout(() => u.onend && u.onend(), 5); };
    window.speechSynthesis.cancel = function () {};
    window.speechSynthesis.getVoices = () => [];
  });

  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // 1) count check
  const count = await page.evaluate(() => PART2.length);
  check('PART2が190問になっている', count === 190, `count=${count}`);

  // 2) structural fields for new entries (index 124..189)
  const VALID_T = ['WH疑問文', 'Yes/No疑問文', '依頼・提案', '選択疑問文', '平叙文', '付加疑問文'];
  const structOk = await page.evaluate((valid) => {
    for (let i = 124; i < 190; i++) {
      const q = PART2[i];
      if (!q.q || !q.jq || !q.x) return `missing text field at ${i}`;
      if (!q.r || q.r.length !== 3) return `bad r at ${i}`;
      if (!q.jr || q.jr.length !== 3) return `bad jr at ${i}`;
      if (!q.qAudio || q.qAudio !== `q${i + 1}_q.mp3`) return `bad qAudio at ${i}: ${q.qAudio}`;
      if (!q.audio || q.audio.length !== 3) return `bad audio at ${i}`;
      if (!valid.includes(q.t)) return `bad t at ${i}: ${q.t}`;
    }
    return 'ok';
  }, VALID_T);
  check('新規66問のフィールド構造が正しい(index124-189)', structOk === 'ok', structOk);

  // 3) new questions get picked up by buildListenQueue when due (listenMode=2)
  const queueCount = await page.evaluate(() => {
    const today = todayKey();
    for (let i = 0; i < 124; i++) state.listenStats[i] = { lv: 4, next: addDays(today, 30), seen: 4, ok: 4 };
    for (let i = 124; i < 190; i++) state.listenStats[i] = { lv: 0, next: today, seen: 0, ok: 0 };
    saveState();
    listenMode = 2;
    const q = buildListenQueue();
    return q.filter((i) => i >= 124).length;
  });
  check('新規66問が出題キューに乗る(buildListenQueue)', queueCount > 0, `count=${queueCount}`);

  // 4) render a new question (index 124, q125) and confirm no photo shown + choices rendered
  const renderInfo = await page.evaluate(() => {
    listenMode = 2;
    listenQueue = [124];
    listenPos = 0;
    showListenQuestion();
    const photoHidden = document.getElementById('listen-photo').classList.contains('hidden');
    const choices = document.querySelectorAll('#listen-choices .abc-btn').length;
    return { photoHidden, choices };
  });
  check('新規問題(q125)がPart2形式で描画される(写真非表示・選択肢3つ)',
    renderInfo.photoHidden && renderInfo.choices === 3, JSON.stringify(renderInfo));

  // 5) confirm a sample of new audio files load (not 404): first, middle, last of the new batch
  for (const f of ['q125_q.mp3', 'q125_a.mp3', 'q157_b.mp3', 'q190_q.mp3', 'q190_c.mp3']) {
    const st = await page.evaluate(async (file) => {
      const res = await fetch('audio/part2/' + file);
      return res.status;
    }, f);
    check(`${f}が404にならない`, st === 200, `status=${st}`);
  }

  // 6) full flow: answer the rendered question and confirm scoring works
  const answerOk = await page.evaluate(() => {
    const btn = document.querySelectorAll('#listen-choices .abc-btn')[0];
    if (!btn) return 'no buttons';
    btn.click();
    const fb = document.getElementById('listen-feedback');
    return fb && !fb.classList.contains('hidden') ? 'answered' : 'no-explain';
  });
  check('新規問題に解答して解説が表示される', answerOk === 'answered', answerOk);

  // 7) full Part2 session (10問) completes without errors
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.click('[data-tab="listen"]').catch(async () => { await page.click('[data-goto="listen"]').catch(() => {}); });
  await page.waitForTimeout(150);
  await page.click('#listen-start-btn');
  await page.waitForTimeout(200);
  let clicks = 0;
  for (let i = 0; i < 40; i++) {
    const done = await page.evaluate(() => !document.getElementById('listen-result').classList.contains('hidden'));
    if (done) break;
    const btns = await page.$$('#listen-choices .abc-btn:not([disabled])');
    if (btns.length) {
      await btns[0].click(); await page.waitForTimeout(30);
      await page.click('#listen-next-btn').catch(() => {});
      clicks++;
      await page.waitForTimeout(40);
    } else await page.waitForTimeout(50);
  }
  const sessionDone = await page.evaluate(() => !document.getElementById('listen-result').classList.contains('hidden'));
  check('Part2セッション(1セット10問)が完走する(190問体制でも従来どおり)', sessionDone, `clicks=${clicks}`);

  check('コンソール/ページエラーが無い', errors.length === 0, JSON.stringify(errors));

  await browser.close();

  const fail = results.filter((r) => !r.pass);
  console.log(`\n${results.length - fail.length}/${results.length} PASS`);
  process.exit(fail.length ? 1 : 0);
})();
