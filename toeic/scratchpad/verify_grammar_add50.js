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

  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // 1. 件数・カテゴリ内訳
  const counts = await page.evaluate(() => {
    const byType = {};
    QUESTIONS.forEach((q) => { byType[q.t] = (byType[q.t] || 0) + 1; });
    return { total: QUESTIONS.length, byType };
  });
  check('QUESTIONSが500問になっている', counts.total === 500, JSON.stringify(counts.byType));
  const expected = { 品詞: 106, 動詞の形: 81, 語彙: 78, 前置詞: 56, 接続詞: 51, 代名詞: 34, 仮定法: 29, 分詞構文: 21, 倒置: 21, 関係詞: 13, 比較: 10 };
  check('カテゴリ内訳が想定通り', Object.keys(expected).every((k) => counts.byType[k] === expected[k]), JSON.stringify(counts.byType));

  // 2. スキーマ・新規50問(index450-499)の構造確認
  const schemaCheck = await page.evaluate(() => {
    const VALID_CATS = new Set(['品詞', '動詞の形', '語彙', '前置詞', '接続詞', '代名詞', '仮定法', '分詞構文', '倒置', '関係詞', '比較']);
    let errs = [];
    for (let i = 450; i < 500; i++) {
      const q = QUESTIONS[i];
      if (!q.q || !q.jq || !Array.isArray(q.c) || q.c.length !== 4 || !(q.a >= 0 && q.a <= 3) || !q.x || !VALID_CATS.has(q.t)) {
        errs.push(i);
      }
      if (!q.q.includes('-------')) errs.push('blank-missing-' + i);
    }
    return errs;
  });
  check('新規50問(index450-499)のスキーマが正しい', schemaCheck.length === 0, JSON.stringify(schemaCheck));

  // 2b. 英問題文の完全一致重複チェック(全500問。過去のPart5追加スクリプトには無かった観点)
  const dupCheck = await page.evaluate(() => {
    const seen = new Map();
    const dups = [];
    QUESTIONS.forEach((q, i) => {
      const k = q.q.trim().toLowerCase();
      if (seen.has(k)) dups.push({ i, dupOf: seen.get(k), q: q.q });
      else seen.set(k, i);
    });
    return dups;
  });
  check('QUESTIONS全500問に英文の完全一致重複がない', dupCheck.length === 0, JSON.stringify(dupCheck));

  // 3. 新規問題が出題キューに乗ることを確認(疑似SRSデータ投入)
  const queueCheck = await page.evaluate(() => {
    const today = todayKey();
    for (let i = 0; i < 450; i++) state.quizStats[i] = { lv: 4, next: addDays(today, 30), seen: 4, ok: 4 };
    for (let i = 450; i < 500; i++) state.quizStats[i] = { lv: 0, next: today, seen: 1, ok: 0 };
    saveState();
    const queue = buildQuizQueue();
    return queue.filter((i) => i >= 450).length;
  });
  check('新規50問が出題キューに正しく乗る(buildQuizQueueで拾われる)', queueCheck > 0, `count=${queueCheck}`);

  // 4. 新規問題を画面表示・解答完走
  await page.evaluate(() => {
    quizQueue = [450, 458, 466, 474, 482, 490, 498];
    quizPos = 0;
    quizCorrect = 0;
    quizCombo = 0;
    sessionActive = true;
    showTab('quiz');
    document.getElementById('quiz-start').classList.add('hidden');
    document.getElementById('quiz-session').classList.remove('hidden');
    showQuestion();
  });
  await page.waitForTimeout(150);
  let completedClicks = 0;
  for (let i = 0; i < 30; i++) {
    const done = await page.evaluate(() => !document.getElementById('quiz-result').classList.contains('hidden'));
    if (done) break;
    const feedbackHidden = await page.evaluate(() => document.getElementById('quiz-feedback').classList.contains('hidden'));
    if (feedbackHidden) {
      await page.click('#quiz-choices .choice-btn');
    } else {
      await page.click('#quiz-next-btn');
    }
    completedClicks++;
    await page.waitForTimeout(60);
  }
  const sessionDone = await page.evaluate(() => !document.getElementById('quiz-result').classList.contains('hidden'));
  check('新規50問を含むセッションが完走する', sessionDone, `clicks=${completedClicks}`);

  // 5. 記録タブでカテゴリ別正答率・苦手分野カードが正しく機能する(前回機能の回帰、比較カテゴリで確認)
  await page.evaluate(() => {
    state.quizStats = {};
    let n = 0;
    QUESTIONS.forEach((q, i) => { if (q.t === '比較' && n < 6) { state.quizStats[i] = { lv: 0, next: todayKey(), seen: 2, ok: 0 }; n++; } });
    saveState();
    showTab('stats');
  });
  await page.waitForTimeout(150);
  const statsCheck = await page.evaluate(() => ({
    accuracyListText: document.getElementById('accuracy-list').textContent,
    weakGrammarText: document.getElementById('weak-grammar').textContent,
  }));
  check('新規問題を含む比較カテゴリが#accuracy-listに表示される', statsCheck.accuracyListText.includes('比較'), statsCheck.accuracyListText.slice(0, 150));
  check('新規問題を含む比較カテゴリが#weak-grammarに弱点(0%)として表示される', statsCheck.weakGrammarText.includes('比較') && statsCheck.weakGrammarText.includes('0%'), statsCheck.weakGrammarText.slice(0, 150));

  console.log('\n=== コンソールエラー ===');
  console.log(errors.length === 0 ? 'なし' : errors.join('\n'));
  check('コンソールエラーなし', errors.length === 0, errors.join(' | '));

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length > 0) {
    console.log('FAILED:', failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
})();
