// 単語(WORDS)に熟語(イディオム)100語追加(1000→1100語、熟語41→141件)の実機検証(Playwright)
// verify_words_add300_e2e.js のパターンを踏襲し、新規追加分(index 1000-1099)に対象を絞って検証する。
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

  // ---- 件数確認 ----
  const counts = await page.evaluate(() => ({
    words: WORDS.length,
    ipa: Object.keys(IPA).length,
    idioms: WORDS.filter((w) => w.p === '熟').length,
  }));
  check('WORDSが1100語になっている', counts.words === 1100, JSON.stringify(counts));
  check('IPAが1100件になっている', counts.ipa === 1100, JSON.stringify(counts));
  check('熟語(p==="熟")が141件になっている', counts.idioms === 141, JSON.stringify(counts));

  // ---- 新規100語が出題キューに乗ることを確認(新規100語のindexは1000-1099) ----
  const newWordsInQueue = await page.evaluate(() => {
    const today = todayKey();
    for (let i = 0; i < 1000; i++) state.words[i] = { lv: 4, next: addDays(today, 30), seen: 4, ok: 3 };
    for (let i = 1000; i < 1100; i++) state.words[i] = { lv: 0, next: today, seen: 1, ok: 0 };
    saveState();
    const queue = buildWordQueue();
    return queue.filter((i) => i >= 1000).length;
  });
  check('新規熟語100語が出題キューに正しく乗る(buildWordQueueで拾われる)', newWordsInQueue > 0, `count=${newWordsInQueue}`);

  // ---- 新規語(index1000)を直接レンダリングして描画確認 ----
  const cardCheck = await page.evaluate(() => {
    wordQueue = [1000];
    wordPos = 0;
    showCard();
    return {
      html: document.getElementById('flashcard') ? document.getElementById('flashcard').textContent.slice(0, 400) : null,
      expectedWord: WORDS[1000].w,
      expectedMeaning: WORDS[1000].m,
      expectedIpa: IPA[WORDS[1000].w],
      expectedPos: WORDS[1000].p,
    };
  });
  const cardOk = cardCheck.html && cardCheck.html.includes(cardCheck.expectedWord) && cardCheck.html.includes(cardCheck.expectedMeaning) && cardCheck.html.includes(`[${cardCheck.expectedPos}]`);
  check('新規語(index1000)のフラッシュカードが単語・意味・[熟]タグを含めて正しく描画される', cardOk, JSON.stringify(cardCheck));
  check('新規語(index1000)にIPA発音記号が対応している', !!cardCheck.expectedIpa, JSON.stringify(cardCheck));

  // ---- 単語セッションを完走(コンソールエラーが出ないことを確認) ----
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('[data-tab="words"]');
  await page.waitForTimeout(150);
  await page.click('#words-start-btn');
  await page.waitForTimeout(200);
  let clicks = 0;
  for (let i = 0; i < 30; i++) {
    const done = await page.evaluate(() => !document.getElementById('words-result').classList.contains('hidden'));
    if (done) break;
    await page.click('#flashcard'); await page.waitForTimeout(20);
    await page.click('#fc-ok-btn').catch(() => {});
    clicks++;
    await page.waitForTimeout(30);
  }
  const wordsDone = await page.evaluate(() => !document.getElementById('words-result').classList.contains('hidden'));
  check('単語セッションが完走する(拡大後の配列でも問題なし)', wordsDone, `clicks=${clicks}`);

  check('コンソールエラー0件', errors.length === 0, errors.slice(0, 8).join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
