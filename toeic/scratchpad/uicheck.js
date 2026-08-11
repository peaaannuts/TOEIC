const { chromium } = require('playwright');
const URL = 'http://localhost:8099/index.html';

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

// セッション中の qdots の内訳と、結果画面の振り返りドットの内訳が一致するか
async function qdotBreakdown(p, sel) {
  return p.$$eval(`${sel} .qdot`, els => {
    const c = { hit: 0, miss: 0, soft: 0, upcoming: 0, total: els.length };
    els.forEach(e => { ['hit','miss','soft','upcoming'].forEach(k => { if (e.classList.contains(k)) c[k]++; }); });
    return c;
  });
}

async function assertResult(p, mode, label) {
  // リングが最終値に達しているか(rAF 700ms なので待つ)
  await p.waitForTimeout(900);
  const st = await p.evaluate((m) => {
    const ring = document.getElementById(`${m}-result-ring`);
    const stats = document.getElementById(`${m}-result-stats`);
    const xpTile = stats.querySelector('.result-tile.xp .result-tile-value');
    return {
      pct: parseFloat(ring.style.getPropertyValue('--pct')),
      ringColor: ring.style.getPropertyValue('--ring-c'),
      pctText: document.getElementById(`${m}-result-pct`).textContent,
      frac: document.getElementById(`${m}-result-frac`).textContent,
      emoji: document.getElementById(`${m}-result-emoji`).textContent,
      title: document.getElementById(`${m}-result-title`).textContent,
      tiles: stats.children.length,
      xpText: xpTile ? xpTile.textContent : null,
      perfect: document.getElementById(`${m}-result-card`).classList.contains('perfect'),
      // sessionXp はトップレベル let なので window には乗らないが、スコープチェーン経由で読める
      sessionXp: sessionXp,
    };
  }, mode);

  const shown = parseInt(st.pctText, 10);
  check(`${label}: リングが最終値に到達`, Math.abs(st.pct - shown) < 1.5 && !Number.isNaN(shown),
    `--pct=${st.pct} 表示=${st.pctText}`);
  check(`${label}: XPタイルがsessionXpと一致`, st.xpText === `+${st.sessionXp}`,
    `tile=${st.xpText} sessionXp=${st.sessionXp}`);
  check(`${label}: タイトル・絵文字が入っている`, st.title.length > 0 && st.emoji.length > 0,
    `${st.emoji} ${st.title}`);

  const session = await qdotBreakdown(p, `#${mode}-qdots`);
  const recap = await qdotBreakdown(p, `#${mode}-result-recap`);
  check(`${label}: 振り返りドットがセッションの記録と一致`,
    session.total === recap.total && session.hit === recap.hit &&
    session.miss === recap.miss && session.soft === recap.soft,
    `session=${JSON.stringify(session)} recap=${JSON.stringify(recap)}`);

  return st;
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
  await page.evaluate(() => {
    window.speechSynthesis.speak = (u) => { if (u && u.onend) setTimeout(() => u.onend(), 1); };
    window.speechSynthesis.cancel = () => {};
    window.speechSynthesis.getVoices = () => [];
  });

  // ---- 単語(自己採点。ティア/パーフェクトが付かないこと) ----
  await page.click('[data-tab="words"]'); await page.waitForTimeout(120);
  await page.click('#words-start-btn'); await page.waitForTimeout(200);
  for (let i = 0; i < 30; i++) {
    if (await page.evaluate(() => !document.getElementById('words-result').classList.contains('hidden'))) break;
    await page.click('#flashcard'); await page.waitForTimeout(20);
    await page.click(i % 4 === 0 ? '#fc-ng-btn' : '#fc-ok-btn').catch(() => {});
    await page.waitForTimeout(30);
  }
  const w = await assertResult(page, 'words', '単語');
  check('単語: ティア判定が適用されない(自己採点なので)',
    w.emoji === '🎉' && w.title === 'おつかれさま!' && w.perfect === false,
    `emoji=${w.emoji} title=${w.title} perfect=${w.perfect}`);
  check('単語: 「まだ」が .soft のまま(誤答扱いしない)',
    (await qdotBreakdown(page, '#words-result-recap')).miss === 0);

  // ---- 文法 ----
  await page.click('[data-tab="quiz"]'); await page.waitForTimeout(120);
  await page.click('#quiz-start-btn'); await page.waitForTimeout(200);
  for (let i = 0; i < 15; i++) {
    if (await page.evaluate(() => !document.getElementById('quiz-result').classList.contains('hidden'))) break;
    const bs = await page.$$('#quiz-choices .choice-btn:not([disabled])');
    if (bs.length) { await bs[0].click(); await page.waitForTimeout(50); await page.click('#quiz-next-btn').catch(() => {}); await page.waitForTimeout(50); }
    else await page.waitForTimeout(60);
  }
  await assertResult(page, 'quiz', '文法');

  // ---- リスニング Part1 ----
  await page.click('[data-tab="listen"]'); await page.waitForTimeout(120);
  await page.click('#part1-start-btn'); await page.waitForTimeout(250);
  for (let i = 0; i < 12; i++) {
    if (await page.evaluate(() => !document.getElementById('listen-result').classList.contains('hidden'))) break;
    const bs = await page.$$('#listen-choices .abc-btn:not([disabled])');
    if (bs.length) { await bs[0].click(); await page.waitForTimeout(50); await page.click('#listen-next-btn').catch(() => {}); await page.waitForTimeout(50); }
    else await page.waitForTimeout(80);
  }
  await assertResult(page, 'listen', 'Part1/2');

  // ---- リスニング Part3/4 ----
  await page.click('[data-tab="listen"]'); await page.waitForTimeout(120);
  await page.click('#part4-start-btn'); await page.waitForTimeout(350);
  for (let s = 0; s < 4; s++) {
    if (await page.evaluate(() => !document.getElementById('listen34-result').classList.contains('hidden'))) break;
    for (const bl of await page.$$('#listen34-questions .l34-qblock')) {
      const c = await bl.$('.choice-btn'); await c.click(); await page.waitForTimeout(20);
    }
    await page.click('#listen34-check-btn').catch(() => {});
    await page.waitForTimeout(600);
    await page.click('#listen34-next-btn').catch(() => {});
    await page.waitForTimeout(250);
  }
  await assertResult(page, 'listen34', 'Part3/4');

  // ---- 読解 Part7(タイルが3枚=時間/ペースが昇格しているか) ----
  await page.click('[data-tab="read"]'); await page.waitForTimeout(120);
  await page.click('#part7-start-btn'); await page.waitForTimeout(250);
  for (let i = 0; i < 60; i++) {
    if (await page.evaluate(() => !document.getElementById('read-result').classList.contains('hidden'))) break;
    const bs = await page.$$('#read-choices .choice-btn:not([disabled])');
    if (bs.length) { await bs[0].click(); await page.waitForTimeout(30); await page.click('#read-next-btn').catch(() => {}); await page.waitForTimeout(40); }
    else await page.waitForTimeout(60);
  }
  const r = await assertResult(page, 'read', '読解');
  check('読解: 所要時間/ペースのタイルが増えている(3枚)', r.tiles === 3, `tiles=${r.tiles}`);

  // ---- パーフェクト状態(直接呼び出しで確認) ----
  const perfect = await page.evaluate(() => {
    window.renderResult('quiz', {
      pct: 100, correct: 10, total: 10, xp: 130, perfect: true,
      emoji: '👑', title: 'パーフェクト!!', color: 'var(--gold)',
      note: 'test', tiles: [{ label: '獲得XP', value: '+130', cls: 'xp' }],
    });
    const card = document.getElementById('quiz-result-card');
    return {
      hasPerfect: card.classList.contains('perfect'),
      ringColor: document.getElementById('quiz-result-ring').style.getPropertyValue('--ring-c'),
      shadow: getComputedStyle(card).boxShadow,
    };
  });
  check('パーフェクト: .perfect と金のリングが付く',
    perfect.hasPerfect && perfect.ringColor.includes('gold'), `色=${perfect.ringColor}`);
  check('パーフェクト: 金の枠が算出される', perfect.shadow.includes('232, 161, 61'), perfect.shadow.slice(0, 70));

  // ---- prefers-reduced-motion では即座に最終値 ----
  const rm = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await rm.goto(URL);
  const immediate = await rm.evaluate(() => {
    window.renderResult('quiz', {
      pct: 87, correct: 8, total: 10, xp: 95, perfect: false,
      emoji: '🏆', title: 'すばらしい!', color: 'var(--ok)', note: '', tiles: [{ label: 'XP', value: '+95', cls: 'xp' }],
    });
    // rAFを1回も待たずに読む = アニメせず即座に最終値のはず
    return {
      pct: document.getElementById('quiz-result-ring').style.getPropertyValue('--pct'),
      xp: document.querySelector('#quiz-result-stats .result-tile.xp .result-tile-value').textContent,
    };
  });
  check('reduced-motion: リング/XPが即座に最終値', parseFloat(immediate.pct) === 87 && immediate.xp === '+95',
    `pct=${immediate.pct} xp=${immediate.xp}`);
  await rm.close();

  check('コンソールエラー0件', errors.length === 0, errors.slice(0, 6).join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
