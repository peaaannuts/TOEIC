// 単語(WORDS)300語追加(700→1000語)の実機検証(Playwright)
// verify_words_grammar.js のパターンを踏襲し、新規追加分(index 700-999)に対象を絞って検証する。
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
  }));
  check('WORDSが1000語になっている', counts.words === 1000, JSON.stringify(counts));
  check('IPAが1000件になっている', counts.ipa === 1000, JSON.stringify(counts));

  // ---- 新規300語が出題キューに乗ることを確認(新規300語のindexは700-999) ----
  const newWordsInQueue = await page.evaluate(() => {
    const today = todayKey();
    // 既存700語を復習済み(next=未来)にし、新規300語(index700-999)だけ復習期日を今日にする
    for (let i = 0; i < 700; i++) state.words[i] = { lv: 4, next: addDays(today, 30), seen: 4, ok: 3 };
    for (let i = 700; i < 1000; i++) state.words[i] = { lv: 0, next: today, seen: 1, ok: 0 };
    saveState();
    const queue = buildWordQueue();
    return queue.filter((i) => i >= 700).length;
  });
  check('新規単語300語が出題キューに正しく乗る(buildWordQueueで拾われる)', newWordsInQueue > 0, `count=${newWordsInQueue}`);

  // ---- 新規語(index700, 旅行/接客ドメインの1件目)を直接レンダリングして描画確認 ----
  const cardCheck = await page.evaluate(() => {
    wordQueue = [700];
    wordPos = 0;
    showCard();
    return {
      word: document.getElementById('fc-word') ? document.getElementById('fc-word').textContent : null,
      meaning: document.getElementById('fc-meaning') ? document.getElementById('fc-meaning').textContent : null,
      html: document.getElementById('flashcard') ? document.getElementById('flashcard').textContent.slice(0, 200) : null,
      expectedWord: WORDS[700].w,
      expectedMeaning: WORDS[700].m,
      expectedIpa: IPA[WORDS[700].w],
    };
  });
  const cardOk = cardCheck.html && cardCheck.html.includes(cardCheck.expectedWord) && cardCheck.html.includes(cardCheck.expectedMeaning);
  check('新規語(index700)のフラッシュカードが単語・意味を含めて正しく描画される', cardOk, JSON.stringify(cardCheck));
  check('新規語(index700)にIPA発音記号が対応している', !!cardCheck.expectedIpa, JSON.stringify(cardCheck));

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
