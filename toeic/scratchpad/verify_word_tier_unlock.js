// 単語(WORDS)の難易度別Tier段階的アンロック機能の検証スクリプト
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

  // ---- 1. 全1100語にtierが付与されているか ----
  const tierInfo = await page.evaluate(() => {
    const counts = { 1: 0, 2: 0, 3: 0, invalid: 0 };
    WORDS.forEach((w) => {
      if (w.tier === 1 || w.tier === 2 || w.tier === 3) counts[w.tier]++;
      else counts.invalid++;
    });
    return { total: WORDS.length, counts };
  });
  check('WORDSが1100語', tierInfo.total === 1100, JSON.stringify(tierInfo));
  check('全語にtier(1/2/3)が付与されている(invalid=0)', tierInfo.counts.invalid === 0, JSON.stringify(tierInfo.counts));

  // ---- 2. 新規ユーザー状態でbuildWordQueueがTier2/3の未出語を含まない ----
  const freshQueueTiers = await page.evaluate(() => {
    state.words = {};
    state.wordTierUnlocked = { 2: false, 3: false };
    saveState();
    const queue = buildWordQueue();
    return queue.map((i) => WORDS[i].tier);
  });
  const hasNonTier1 = freshQueueTiers.some((t) => t !== 1);
  check('新規ユーザーの出題キューはTier1のみ', !hasNonTier1, `tiers=${JSON.stringify(freshQueueTiers)}`);

  // ---- 3. Tier1を80%習得させるとTier2が解放される ----
  const unlockTier2Result = await page.evaluate(() => {
    state.words = {};
    state.wordTierUnlocked = { 2: false, 3: false };
    const tier1Idxs = [];
    WORDS.forEach((w, i) => { if (w.tier === 1) tier1Idxs.push(i); });
    const masterCount = Math.ceil(tier1Idxs.length * 0.85);
    tier1Idxs.forEach((i, n) => {
      state.words[i] = n < masterCount
        ? { lv: 2, next: addDays(todayKey(), 30), seen: 2, ok: 2 }
        : { lv: 0, next: todayKey(), seen: 1, ok: 0 };
    });
    saveState();
    const maxTier = unlockedWordTierMax();
    return { maxTier, tier1Count: tier1Idxs.length, masterCount, unlocked: JSON.parse(JSON.stringify(state.wordTierUnlocked)) };
  });
  check('Tier1を85%習得するとTier2が解放される', unlockTier2Result.maxTier === 2, JSON.stringify(unlockTier2Result));

  // ---- 4. Tier2まで解放後、そのTier2を80%習得するとTier3が解放される ----
  const unlockTier3Result = await page.evaluate(() => {
    state.words = {};
    state.wordTierUnlocked = { 2: true, 3: false };
    const tier2Idxs = [];
    WORDS.forEach((w, i) => { if (w.tier === 2) tier2Idxs.push(i); });
    const masterCount = Math.ceil(tier2Idxs.length * 0.85);
    tier2Idxs.forEach((i, n) => {
      state.words[i] = n < masterCount
        ? { lv: 2, next: addDays(todayKey(), 30), seen: 2, ok: 2 }
        : { lv: 0, next: todayKey(), seen: 1, ok: 0 };
    });
    saveState();
    const maxTier = unlockedWordTierMax();
    return { maxTier, tier2Count: tier2Idxs.length, masterCount };
  });
  check('Tier2を85%習得するとTier3が解放される', unlockTier3Result.maxTier === 3, JSON.stringify(unlockTier3Result));

  // ---- 5. 一度解放したら忘却しても再ロックされない ----
  const noRelockResult = await page.evaluate(() => {
    state.wordTierUnlocked = { 2: true, 3: true };
    // tier1/2の記録を全部消して比率を0に落とす
    Object.keys(state.words).forEach((k) => delete state.words[k]);
    saveState();
    return unlockedWordTierMax();
  });
  check('一度解放したTierは比率が下がっても再ロックされない', noRelockResult === 3, `maxTier=${noRelockResult}`);

  // ---- 6. 既にTier3の語に復習記録がある場合、ロック前でもdueに含まれる ----
  const dueRespectsExisting = await page.evaluate(() => {
    state.words = {};
    state.wordTierUnlocked = { 2: false, 3: false };
    const tier3Idx = WORDS.findIndex((w) => w.tier === 3);
    state.words[tier3Idx] = { lv: 1, next: todayKey(), seen: 1, ok: 0 }; // 復習期日が今日
    saveState();
    const queue = buildWordQueue();
    return { tier3Idx, included: queue.includes(tier3Idx) };
  });
  check('既存の復習対象語(Tier3含む)はロックに関係なく出題される', dueRespectsExisting.included, JSON.stringify(dueRespectsExisting));

  // ---- 7. 単語開始画面にTier進捗表示が出る ----
  await page.evaluate(() => {
    state.words = {};
    state.wordTierUnlocked = { 2: false, 3: false };
    saveState();
  });
  await page.click('[data-tab="words"]');
  await page.waitForTimeout(150);
  const tierStatusText = await page.evaluate(() => document.getElementById('words-tier-status').textContent);
  check('単語開始画面にTier進捗テキストが表示される', tierStatusText && tierStatusText.length > 0, tierStatusText);

  // ---- 8. フラッシュカードにTierバッジが表示される ----
  await page.evaluate(() => {
    state.words = {};
    state.wordTierUnlocked = { 2: false, 3: false };
    saveState();
  });
  await page.reload();
  await page.click('[data-tab="words"]');
  await page.waitForTimeout(150);
  await page.click('#words-start-btn');
  await page.waitForTimeout(200);
  const badgeText = await page.evaluate(() => document.getElementById('fc-tier-badge').textContent);
  check('フラッシュカードにTierバッジが表示される', badgeText === '基礎', `badge=${badgeText}`);

  // ---- 9. 単語セッションが問題なく完走する(既存フロー無事) ----
  let clicks = 0;
  for (let i = 0; i < 25; i++) {
    const done = await page.evaluate(() => !document.getElementById('words-result').classList.contains('hidden'));
    if (done) break;
    await page.click('#flashcard'); await page.waitForTimeout(20);
    await page.click('#fc-ok-btn').catch(() => {});
    clicks++;
    await page.waitForTimeout(30);
  }
  const wordsDone = await page.evaluate(() => !document.getElementById('words-result').classList.contains('hidden'));
  check('単語セッションが完走する(Tierゲート導入後も既存フロー無事)', wordsDone, `clicks=${clicks}`);

  check('コンソール/ページエラーなし', errors.length === 0, JSON.stringify(errors));

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n合計 ${results.length}件 / 成功 ${results.length - failed.length}件 / 失敗 ${failed.length}件`);
  process.exit(failed.length > 0 ? 1 : 0);
})();
