const { chromium } = require('playwright');
const URL = 'http://localhost:8099/index.html';

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const counts = await page.evaluate(() => ({
    words: WORDS.length,
    ipa: Object.keys(IPA).length,
    questions: QUESTIONS.length,
  }));
  check('WORDSが362語になっている', counts.words === 362, JSON.stringify(counts));
  check('IPAが362件になっている', counts.ipa === 362, JSON.stringify(counts));
  check('QUESTIONSが350問になっている', counts.questions === 350, JSON.stringify(counts));

  // ---- 単語カードを完走してSRS登録を確認 ----
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
  check('単語セッションが完走する', wordsDone, `clicks=${clicks}`);

  // ---- 新規語彙が実際に出題キューに乗ることを確認(新規50語のindexは312-361) ----
  const newWordsInQueue = await page.evaluate(() => {
    const today = todayKey();
    // 既存312語を復習済み(next=未来)にし、新規50語(index312-361)だけ復習期日を今日にする
    for (let i = 0; i < 312; i++) state.words[i] = { lv: 4, next: addDays(today, 30), seen: 4, ok: 3 };
    for (let i = 312; i < 362; i++) state.words[i] = { lv: 0, next: today, seen: 1, ok: 0 };
    saveState();
    const queue = buildWordQueue();
    return queue.filter((i) => i >= 312).length;
  });
  check('新規単語50語が出題キューに正しく乗る(buildWordQueueで拾われる)', newWordsInQueue > 0, `count=${newWordsInQueue}`);

  // ---- 文法クイズを完走してSRS登録を確認 ----
  await page.evaluate(() => showTab('quiz'));
  await page.waitForTimeout(150);
  await page.click('#quiz-start-btn');
  await page.waitForTimeout(200);
  clicks = 0;
  for (let i = 0; i < 30; i++) {
    const done = await page.evaluate(() => !document.getElementById('quiz-result').classList.contains('hidden'));
    if (done) break;
    const btns = await page.$$('#quiz-choices .choice-btn:not([disabled])');
    if (btns.length) {
      await btns[0].click(); await page.waitForTimeout(30);
      await page.click('#quiz-next-btn').catch(() => {});
      clicks++;
      await page.waitForTimeout(40);
    } else await page.waitForTimeout(50);
  }
  const quizDone = await page.evaluate(() => !document.getElementById('quiz-result').classList.contains('hidden'));
  check('文法クイズセッションが完走する', quizDone, `clicks=${clicks}`);

  // ---- 新規文法問題(仮定法・倒置・分詞構文、index300-349)が出題キューに乗ることを確認 ----
  const newQuestionsInQueue = await page.evaluate(() => {
    const today = todayKey();
    for (let i = 0; i < 300; i++) state.quizStats[i] = { lv: 4, next: addDays(today, 30), seen: 4, ok: 3 };
    for (let i = 300; i < 350; i++) state.quizStats[i] = { lv: 0, next: today, seen: 1, ok: 0 };
    saveState();
    const queue = buildQuizQueue();
    return queue.filter((i) => i >= 300).length;
  });
  check('新規文法問題50問が出題キューに正しく乗る(buildQuizQueueで拾われる)', newQuestionsInQueue > 0, `count=${newQuestionsInQueue}`);

  // ---- 新カテゴリ(仮定法・倒置・分詞構文)が画面に正しく表示されるか、直接1問レンダリングして確認 ----
  const categoryCheck = await page.evaluate(() => {
    const idx = QUESTIONS.findIndex((q) => q.t === '仮定法');
    quizQueue = [idx];
    quizPos = 0;
    showQuestion();
    return {
      typeText: document.getElementById('quiz-type').textContent,
      choiceCount: document.querySelectorAll('#quiz-choices .choice-btn').length,
      hasTag: document.querySelector('#quiz-choices .choice-tag') !== null,
    };
  });
  check('仮定法カテゴリの問題が正しく表示される(タイプ表示・選択肢4つ・タグあり)',
    categoryCheck.typeText === '仮定法' && categoryCheck.choiceCount === 4 && categoryCheck.hasTag,
    JSON.stringify(categoryCheck));

  check('コンソールエラー0件', errors.length === 0, errors.slice(0, 8).join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
