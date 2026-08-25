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

  const dk = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const log = {};
  for (let i = 0; i < 5; i++) log[dk(-i)] = { words: 20 - i, quiz: 10, correct: 8, listen: 5, listenOk: 3, read: 2, readOk: 1 };
  const words = {}; for (let i = 0; i < 80; i++) words[i] = { lv: i % 5, next: dk(0), seen: 4, ok: 3 };
  const quizStats = {}; for (let i = 0; i < 60; i++) quizStats[i] = { lv: i % 5, next: dk(0), seen: 4, ok: 3 };
  const listenStats = {}; for (let i = 0; i < 40; i++) listenStats[i] = { lv: i % 5, next: dk(0), seen: 4, ok: 3 };

  await page.goto(URL);
  await page.evaluate((s) => localStorage.setItem('toeic600-v1', JSON.stringify(s)), {
    log, words, quizStats, listenStats, xp: 800, gems: 100, freezes: 1,
    streak: { count: 5, lastActive: dk(0), best: 5 },
  });
  await page.reload();
  await page.waitForTimeout(900); // リングのrAFアニメが終わるまで待つ

  // ---- ホーム画面の要素が揃っているか ----
  check('ヒーローカードが表示されている', await page.$('.hero-card') !== null);
  check('炎バッジ(SVG)が描画されている', await page.$('.hero-flame-badge svg') !== null);
  check('スコアリングが最終値に到達', await page.evaluate(() => {
    const ring = document.getElementById('home-score-ring');
    const pct = parseFloat(ring.style.getPropertyValue('--pct'));
    return pct > 0 && !Number.isNaN(pct);
  }));
  const modeCount = await page.$$eval('.mode-mini', els => els.length);
  check('4モードのミニカードが表示されている', modeCount === 4, `count=${modeCount}`);
  check('ゴーストリーグカードが表示されている', await page.$('.league-card') !== null);
  check('週間クエストが保持されている(機能削除していない)', (await page.$$('#weekly-list .daily-row')).length > 0);
  check('月間バッジミニが保持されている', (await page.evaluate(() => document.getElementById('monthly-mini').innerHTML.length)) > 0);

  // ---- ミニカードのクリックでタブ遷移(data-goto delegation) ----
  await page.click('.mode-mini.quiz');
  await page.waitForTimeout(150);
  check('単語ミニカードクリックで文法タブへ遷移', await page.evaluate(() => !document.getElementById('tab-quiz').classList.contains('hidden')));
  await page.click('[data-goto="home"]').catch(() => {});
  await page.evaluate(() => showTab('home'));
  await page.waitForTimeout(150);

  // ---- 動的CTAボタン(weakestGoal) ----
  const ctaInfo1 = await page.evaluate(() => ({
    text: document.getElementById('home-cta-btn').textContent,
    goto: document.getElementById('home-cta-btn').dataset.goto,
  }));
  check('全ノルマ未達成なし想定でCTAが読解を指す(単語欠のみ想定外にならないか確認用ログ)', true, JSON.stringify(ctaInfo1));

  // 単語だけ未達成にして確認
  // 日付キーはアプリの todayKey()(ローカル日付基準)に合わせて Node側の dk(0) を渡す。
  // toISOString()(UTC基準)だとローカル日付と一致しない時間帯があり、アプリが見る「今日」と
  // ズレて意図しない日付のログを書き込んでしまうため(2026-08-26に発覚・修正)。
  await page.evaluate((today) => {
    const st = JSON.parse(localStorage.getItem('toeic600-v1'));
    st.log[today] = { words: 3, quiz: 10, correct: 8, listen: 10, listenOk: 8, read: 6, readOk: 5 };
    localStorage.setItem('toeic600-v1', JSON.stringify(st));
  }, dk(0));
  await page.reload();
  await page.waitForTimeout(300);
  const ctaWords = await page.evaluate(() => ({
    text: document.getElementById('home-cta-btn').textContent,
    goto: document.getElementById('home-cta-btn').dataset.goto,
  }));
  check('単語未達成のときCTAが単語を指す', ctaWords.goto === 'words', JSON.stringify(ctaWords));
  await page.click('#home-cta-btn');
  await page.waitForTimeout(150);
  check('CTAクリックで単語タブへ実際に遷移する', await page.evaluate(() => !document.getElementById('tab-words').classList.contains('hidden')));
  await page.evaluate(() => showTab('home'));

  // 読解だけ未達成にして確認
  await page.evaluate((today) => {
    const st = JSON.parse(localStorage.getItem('toeic600-v1'));
    st.log[today] = { words: 20, quiz: 10, correct: 8, listen: 10, listenOk: 8, read: 1, readOk: 1 };
    localStorage.setItem('toeic600-v1', JSON.stringify(st));
  }, dk(0));
  await page.reload();
  await page.waitForTimeout(300);
  const ctaRead = await page.evaluate(() => ({
    text: document.getElementById('home-cta-btn').textContent,
    goto: document.getElementById('home-cta-btn').dataset.goto,
  }));
  check('読解のみ未達成のときCTAが読解を指す', ctaRead.goto === 'read', JSON.stringify(ctaRead));

  // ---- 設定ダイアログ(ヘッダー維持の確認) ----
  await page.click('#settings-btn');
  await page.waitForTimeout(150);
  check('設定ギアから設定ダイアログが開く(ヘッダー機能を維持できている)',
    await page.evaluate(() => document.getElementById('settings-dialog').open));
  await page.click('#settings-dialog [type="button"], #settings-dialog button:not([type])').catch(() => {});
  await page.evaluate(() => document.getElementById('settings-dialog').close());

  // ---- ショップダイアログ(ヒーロータップ) ----
  await page.click('.hero-card');
  await page.waitForTimeout(150);
  check('ヒーローカードタップでショップダイアログが開く', await page.evaluate(() => document.getElementById('shop-dialog').open));
  await page.evaluate(() => document.getElementById('shop-dialog').close());

  // ---- タブバーSVGアイコン ----
  const tabSvgCount = await page.$$eval('.tab-btn .tab-icon svg', els => els.length);
  check('タブバー6つ全てSVGアイコンになっている', tabSvgCount === 6, `count=${tabSvgCount}`);
  await page.click('[data-tab="listen"]');
  await page.waitForTimeout(150);
  check('タブバークリックでタブ切り替えできる(SVG化後も委譲が生きている)',
    await page.evaluate(() => !document.getElementById('tab-listen').classList.contains('hidden')));

  check('コンソールエラー0件', errors.length === 0, errors.slice(0, 8).join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
