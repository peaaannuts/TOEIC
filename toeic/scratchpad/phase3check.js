const { chromium } = require('playwright');

const URL = 'http://localhost:8099/index.html';
const KEY = 'toeic600-v1';

function dk(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

  // ============ A) セッション中はバナーが割り込まないこと ============
  // 種を仕込む: streak count=6, lastActive=昨日 -> 1枚目回答でtouchStreak()が7日節目に到達し
  // 通常なら即バナーが出るはずのケースを作る。badges/log は空にして「first」実績も2枚目で発火させる。
  const seed = {
    badges: [],
    log: {},
    streak: { count: 6, lastActive: dk(-1), best: 6 },
    freezes: 0,
    gems: 0,
    streakMilestones: [3],
    daily: { date: 'never', claimed: [] },
  };
  await page.goto(URL);
  await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [KEY, seed]);
  await page.reload();
  await page.evaluate(() => { window.speechSynthesis.speak = () => {}; window.speechSynthesis.cancel = () => {}; });

  await page.click('[data-tab="words"]');
  await page.waitForTimeout(120);
  await page.click('#words-start-btn');
  await page.waitForTimeout(150);

  const queueLen = await page.evaluate(() => window.wordQueue ? window.wordQueue.length : null);
  console.log('word queue length:', queueLen);

  // カードは表→クリックで裏返してから「覚えた/まだ」ボタンが現れる仕様
  async function answerNextCard() {
    await page.click('#flashcard');
    await page.waitForTimeout(30);
    await page.click('#fc-ok-btn');
  }

  // カード1: 覚えた -> touchStreak() で7日節目到達。即バナーが出ないことを確認。
  await answerNextCard();
  await page.waitForTimeout(150);
  let bannerCountAfter1 = await page.$$eval('.levelup-banner', els => els.length);
  check('A1: streak milestone reached but NO banner mid-session (after card 1)', bannerCountAfter1 === 0, `banners=${bannerCountAfter1}`);

  // カード2: 覚えた -> 「はじめの一歩」実績が発火するはずだが、これも即座には出ないことを確認。
  await answerNextCard();
  await page.waitForTimeout(150);
  let bannerCountAfter2 = await page.$$eval('.levelup-banner', els => els.length);
  check('A2: badge unlocked but NO banner mid-session (after card 2)', bannerCountAfter2 === 0, `banners=${bannerCountAfter2}`);

  // 残りのカードを最後まで進める(セッション終了まで)
  let clicks = 2;
  for (let i = 0; i < 40; i++) {
    const resultVisible = await page.evaluate(() => !document.getElementById('words-result').classList.contains('hidden'));
    if (resultVisible) break;
    await answerNextCard().catch(() => {});
    clicks++;
    await page.waitForTimeout(40);
  }
  const finishedVisible = await page.evaluate(() => !document.getElementById('words-result').classList.contains('hidden'));
  check('A3: session reached result screen', finishedVisible, `clicks=${clicks}`);

  const bannerCountAtFinish = await page.$$eval('.levelup-banner', els => els.length);
  check('A4: still no banner exactly at finish instant', bannerCountAtFinish === 0, `banners=${bannerCountAtFinish}`);

  // flushCelebrations は 300ms + i*650ms でずらして発火するはず。
  await page.waitForTimeout(500);
  const bannerAt500 = await page.$$eval('.levelup-banner', els => els.length);
  check('A5: ~500ms after finish, first queued banner appeared', bannerAt500 >= 1, `banners=${bannerAt500}`);

  await page.waitForTimeout(700); // 合計 ~1200ms経過、2つ目のバナーも出ているはず
  const bannerAt1200 = await page.$$eval('.levelup-banner', els => els.length);
  const bannerTexts = await page.$$eval('.levelup-banner', els => els.map(e => e.textContent));
  check('A6: second queued banner appeared with stagger', bannerAt1200 >= 2 || bannerTexts.some(t => t.includes('連続達成')),
    `banners=${bannerAt1200} texts=${JSON.stringify(bannerTexts)}`);

  // state自体は最初のクリックの時点で正しく更新されている(演出だけが遅延している)ことも確認
  const stAfterFinish = await page.evaluate(([k]) => JSON.parse(localStorage.getItem(k)), [KEY]);
  check('A7: streak state updated immediately (not deferred)', stAfterFinish.streak.count === 7, `count=${stAfterFinish.streak.count}`);
  check('A8: badge state updated immediately (not deferred)', stAfterFinish.badges.includes('first'), `badges=${JSON.stringify(stAfterFinish.badges)}`);

  // ============ B) セッション外(直接関数呼び出し)では従来どおり即時発火 ============
  await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [KEY, {
    badges: [], log: {}, streak: { count: 6, lastActive: dk(-1), best: 6 }, freezes: 0, gems: 0, streakMilestones: [3],
  }]);
  await page.reload();
  await page.waitForTimeout(100);
  const bannerBeforeDirectCall = await page.$$eval('.levelup-banner', els => els.length);
  await page.evaluate(() => window.touchStreak());
  await page.waitForTimeout(80); // sessionActive=false のフォールバックなので、ほぼ即座に出るはず
  const bannerAfterDirectCall = await page.$$eval('.levelup-banner', els => els.length);
  check('B1: outside-session direct call fires banner immediately (unchanged fallback)',
    bannerBeforeDirectCall === 0 && bannerAfterDirectCall >= 1, `before=${bannerBeforeDirectCall} after(80ms)=${bannerAfterDirectCall}`);

  // ============ C) 回帰: Part3/4のバッチ採点でも演出が破綻していないか ============
  await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [KEY, {}]);
  await page.reload();
  await page.evaluate(() => {
    window.speechSynthesis.speak = (u) => { if (u && u.onend) setTimeout(() => u.onend(), 1); };
    window.speechSynthesis.cancel = () => {};
    window.speechSynthesis.getVoices = () => [];
  });
  await page.click('[data-tab="listen"]');
  await page.waitForTimeout(120);
  await page.click('#part3-start-btn');
  await page.waitForTimeout(300);
  const blocks = await page.$$('#listen34-questions .l34-qblock');
  for (const bl of blocks) {
    const c = await bl.$('.choice-btn');
    await c.click();
    await page.waitForTimeout(30);
  }
  await page.click('#listen34-check-btn');
  await page.waitForTimeout(600);
  const l34XpFloats = await page.$$eval('.xp-float', els => els.length).catch(() => -1);
  console.log('l34 xp-float elements present right after grading (transient, may already be 0):', l34XpFloats);
  const l34Hit = await page.$$eval('#listen34-qdots .qdot.hit', els => els.length);
  const l34Miss = await page.$$eval('#listen34-qdots .qdot.miss', els => els.length);
  check('C1: part3/4 batch grading still marks dots correctly with Phase3 wiring', l34Hit + l34Miss === blocks.length, `hit+miss=${l34Hit + l34Miss} expect=${blocks.length}`);

  check('no console/page errors during run', errors.length === 0, errors.slice(0, 8).join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
