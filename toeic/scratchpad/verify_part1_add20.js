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
  const count = await page.evaluate(() => PART1.length);
  check('PART1が36問になっている', count === 36, `count=${count}`);

  // 2) structural fields for new entries (index 16..35)
  const structOk = await page.evaluate(() => {
    for (let i = 16; i < 36; i++) {
      const q = PART1[i];
      if (!q.r || q.r.length !== 4) return `bad r at ${i}`;
      if (!q.jr || q.jr.length !== 4) return `bad jr at ${i}`;
      if (!q.audio || q.audio.length !== 4) return `bad audio at ${i}`;
      if (!q.img || q.img !== `q${i + 1}.jpg`) return `bad img at ${i}: ${q.img}`;
      if (!['写真(1人)', '写真(複数)', '写真(モノ)'].includes(q.t)) return `bad t at ${i}`;
    }
    return 'ok';
  });
  check('新規20問のフィールド構造が正しい', structOk === 'ok', structOk);

  // 3) new questions get picked up by buildListenQueue when due
  const queueCount = await page.evaluate(() => {
    const today = todayKey();
    for (let i = 0; i < 16; i++) state.part1Stats[i] = { lv: 4, next: addDays(today, 30), seen: 4, ok: 4 };
    for (let i = 16; i < 36; i++) state.part1Stats[i] = { lv: 0, next: today, seen: 0, ok: 0 };
    saveState();
    listenMode = 1;
    const q = buildListenQueue();
    return q.filter((i) => i >= 16).length;
  });
  check('新規20問が出題キューに乗る(buildListenQueue)', queueCount > 0, `count=${queueCount}`);

  // 4) render a new question (q17, index 16) and confirm image path + no console errors
  const renderInfo = await page.evaluate(() => {
    listenMode = 1;
    listenQueue = [16];
    listenPos = 0;
    showListenQuestion();
    const img = document.querySelector('#listen-photo-wrap img, .listen-photo img, #listen-session img');
    return { imgSrc: img ? img.getAttribute('src') : null };
  });
  check('新規問題(q17)の画像が表示される', renderInfo.imgSrc && renderInfo.imgSrc.includes('q17.jpg'), JSON.stringify(renderInfo));

  // 5) confirm image file itself loads (not 404)
  const imgStatus = await page.evaluate(async () => {
    const res = await fetch('images/part1/q17.jpg');
    return res.status;
  });
  check('q17.jpgが404にならない', imgStatus === 200, `status=${imgStatus}`);

  // 6) confirm a sample of new audio files load (q17_a, q26_c, q36_d)
  for (const f of ['q17_a.mp3', 'q26_c.mp3', 'q36_d.mp3']) {
    const st = await page.evaluate(async (file) => {
      const res = await fetch('audio/part1/' + file);
      return res.status;
    }, f);
    check(`${f}が404にならない`, st === 200, `status=${st}`);
  }

  // 7) full flow: answer the rendered question and confirm scoring works
  const answerOk = await page.evaluate(() => {
    const idx = document.querySelectorAll('.abc-btn')[0];
    if (!idx) return 'no buttons';
    idx.click();
    const fb = document.getElementById('listen-feedback');
    return fb && !fb.classList.contains('hidden') ? 'answered' : 'no-explain';
  });
  check('新規問題に解答して解説が表示される', answerOk === 'answered', answerOk);

  check('コンソール/ページエラーが無い', errors.length === 0, JSON.stringify(errors));

  await browser.close();

  const fail = results.filter((r) => !r.pass);
  console.log(`\n${results.length - fail.length}/${results.length} PASS`);
  process.exit(fail.length ? 1 : 0);
})();
