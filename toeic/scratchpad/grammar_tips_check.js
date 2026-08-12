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

  // 1. GRAMMAR_TIPSのキーがQUESTIONSの全カテゴリと完全一致
  const catCheck = await page.evaluate(() => {
    const cats = new Set(QUESTIONS.map((q) => q.t));
    const keys = Object.keys(GRAMMAR_TIPS);
    const missing = [...cats].filter((c) => !(c in GRAMMAR_TIPS));
    const extra = keys.filter((k) => !cats.has(k));
    return { catCount: cats.size, keyCount: keys.length, missing, extra };
  });
  check('GRAMMAR_TIPSのキーが11カテゴリと完全一致', catCheck.missing.length === 0 && catCheck.extra.length === 0 && catCheck.catCount === 11, JSON.stringify(catCheck));

  // 2. weakGrammarTypes() のロジック検証(疑似データ投入)
  const weakResult = await page.evaluate(() => {
    // 品詞: 10問中3問正解(30%、閾値未満)→弱点
    // 語彙: 10問中9問正解(90%)→弱点でない
    // 比較: 3問中0問正解(0%だがseen<5)→サンプル不足で弱点扱いしない
    state.quizStats = {};
    let idx = 0;
    QUESTIONS.forEach((q, i) => {
      if (q.t === '品詞' && idx < 10) { state.quizStats[i] = { lv: 0, next: todayKey(), seen: 1, ok: i % 10 < 3 ? 1 : 0 }; idx++; }
    });
    let vIdx = 0;
    QUESTIONS.forEach((q, i) => {
      if (q.t === '語彙' && vIdx < 10) { state.quizStats[i] = { lv: 0, next: todayKey(), seen: 1, ok: vIdx < 9 ? 1 : 0 }; vIdx++; }
    });
    let cIdx = 0;
    QUESTIONS.forEach((q, i) => {
      if (q.t === '比較' && cIdx < 3) { state.quizStats[i] = { lv: 0, next: todayKey(), seen: 1, ok: 0 }; cIdx++; }
    });
    saveState();
    return weakGrammarTypes();
  });
  const types = weakResult.map((w) => w.type);
  check('正答率30%(閾値未満・サンプル十分)の品詞が弱点として検出される', types.includes('品詞'), JSON.stringify(weakResult));
  check('正答率90%(閾値以上)の語彙は弱点に含まれない', !types.includes('語彙'), JSON.stringify(weakResult));
  check('出題数3(閾値未満のサンプル数)の比較は0%でも弱点扱いされない', !types.includes('比較'), JSON.stringify(weakResult));
  check('弱点カテゴリは正答率の低い順にソートされる', weakResult.every((w, i) => i === 0 || weakResult[i - 1].pct <= w.pct), JSON.stringify(weakResult));

  // 3. 記録タブの#weak-grammar描画
  await page.evaluate(() => showTab('stats'));
  await page.waitForTimeout(150);
  const statsCard = await page.evaluate(() => {
    const box = document.getElementById('weak-grammar');
    return { html: box.innerHTML, rowCount: box.querySelectorAll('.weak-grammar-row').length, text: box.textContent };
  });
  check('記録タブの#weak-grammarに品詞の行が描画される', statsCard.text.includes('品詞'), statsCard.text.slice(0, 200));
  check('記録タブの#weak-grammarに語彙の行は描画されない', !statsCard.text.includes('語彙'), statsCard.text.slice(0, 200));
  check('#weak-grammarの行数が弱点カテゴリ数と一致', statsCard.rowCount === weakResult.length, `rowCount=${statsCard.rowCount} expected=${weakResult.length}`);

  // 0件時のメッセージ確認
  await page.evaluate(() => { state.quizStats = {}; saveState(); renderStats(); });
  const emptyState = await page.evaluate(() => document.getElementById('weak-grammar').textContent);
  check('弱点0件時に空メッセージが表示される', emptyState.includes('苦手な文法分野はまだありません'), emptyState);

  // 4. クイズ答え合わせでの詳しい解説パネル
  const feedbackWeak = await page.evaluate(() => {
    // 品詞を弱点状態にしておく(1問だけ未登録のまま残し、それを回答対象にする)
    state.quizStats = {};
    let n = 0;
    QUESTIONS.forEach((q, i) => {
      if (q.t === '品詞' && n < 10) { state.quizStats[i] = { lv: 0, next: todayKey(), seen: 5, ok: 1 }; n++; }
    });
    saveState();
    // 品詞の未出題(まだ登録していない)問題を1問キューに入れて回答する
    const targetIdx = QUESTIONS.findIndex((q, i) => q.t === '品詞' && !state.quizStats[i]);
    quizQueue = [targetIdx];
    quizPos = 0;
    quizCombo = 0;
    quizCorrect = 0;
    sessionActive = true;
    showQuestion();
    return targetIdx;
  });
  await page.evaluate(() => showTab('quiz'));
  await page.waitForTimeout(100);
  await page.evaluate(() => { document.getElementById('quiz-session').classList.remove('hidden'); document.getElementById('quiz-start').classList.add('hidden'); });
  await page.click('#quiz-choices .choice-btn');
  await page.waitForTimeout(150);
  const weakPanel = await page.evaluate(() => ({
    hidden: document.getElementById('quiz-weak-tip').classList.contains('hidden'),
    body: document.getElementById('quiz-weak-tip-body').textContent,
    expected: GRAMMAR_TIPS['品詞'],
  }));
  check('弱点カテゴリの問題では詳しい解説パネルが表示される', !weakPanel.hidden, JSON.stringify({ feedbackWeak, hidden: weakPanel.hidden }));
  check('詳しい解説パネルの本文がGRAMMAR_TIPSと一致する', weakPanel.body === weakPanel.expected, `body="${weakPanel.body.slice(0, 30)}..." expected="${weakPanel.expected.slice(0, 30)}..."`);

  // 非弱点カテゴリ(語彙、weakGrammarTypesに含まれない状態)では非表示のまま
  const feedbackStrong = await page.evaluate(() => {
    state.quizStats = {};
    let n = 0;
    QUESTIONS.forEach((q, i) => {
      if (q.t === '語彙' && n < 10) { state.quizStats[i] = { lv: 4, next: todayKey(), seen: 10, ok: 10 }; n++; }
    });
    saveState();
    const targetIdx = QUESTIONS.findIndex((q, i) => q.t === '語彙' && !state.quizStats[i]);
    quizQueue = [targetIdx];
    quizPos = 0;
    quizCombo = 0;
    quizCorrect = 0;
    sessionActive = true;
    showQuestion();
    return targetIdx;
  });
  await page.click('#quiz-choices .choice-btn');
  await page.waitForTimeout(150);
  const strongPanel = await page.evaluate(() => document.getElementById('quiz-weak-tip').classList.contains('hidden'));
  check('非弱点カテゴリの問題では詳しい解説パネルが表示されない', strongPanel, `feedbackStrong=${feedbackStrong}`);

  // details要素の開閉動作(ネイティブ挙動)
  const detailsToggle = await page.evaluate(() => {
    state.quizStats = {};
    let n = 0;
    QUESTIONS.forEach((q, i) => {
      if (q.t === '品詞' && n < 10) { state.quizStats[i] = { lv: 0, next: todayKey(), seen: 5, ok: 1 }; n++; }
    });
    saveState();
    const targetIdx = QUESTIONS.findIndex((q, i) => q.t === '品詞' && !state.quizStats[i]);
    quizQueue = [targetIdx];
    quizPos = 0;
    sessionActive = true;
    showQuestion();
    return true;
  });
  await page.click('#quiz-choices .choice-btn');
  await page.waitForTimeout(150);
  const beforeOpen = await page.evaluate(() => document.querySelector('#quiz-weak-tip details').open);
  await page.click('#quiz-weak-tip summary');
  const afterOpen = await page.evaluate(() => document.querySelector('#quiz-weak-tip details').open);
  check('detailsパネルはクリックで開閉できる', beforeOpen === false && afterOpen === true, `before=${beforeOpen} after=${afterOpen} detailsToggle=${detailsToggle}`);

  // #accuracy-listの描画がリファクタ前と同等の形(カテゴリ名+パーセント)であることの簡易確認
  await page.evaluate(() => {
    state.quizStats = {};
    QUESTIONS.forEach((q, i) => { if (q.t === '品詞') state.quizStats[i] = { lv: 0, next: todayKey(), seen: 5, ok: 1 }; });
    saveState();
    showTab('stats');
  });
  await page.waitForTimeout(150);
  const accList = await page.evaluate(() => document.getElementById('accuracy-list').textContent);
  check('#accuracy-listがリファクタ後も正しく描画される(品詞20%)', accList.includes('品詞') && accList.includes('20%'), accList.slice(0, 200));

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
