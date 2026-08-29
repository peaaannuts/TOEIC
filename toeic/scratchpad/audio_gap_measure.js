// リスニング音声のターン間の「間」を実測するツール。
// playAudioFile() が使う window.Audio をラップし、各クリップの
//   created (new Audio(src) 呼び出し) / playing (実際に再生が始まった瞬間) / ended
// のタイムスタンプを記録する。「体感の間」= 前のクリップの ended → 次のクリップの playing。
// これを意図した wait() 定数と比較し、フェッチ/デコード待ちがどれだけ上乗せされているかを見る。
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push('PE:' + e.message));

  // app.js より前に window.Audio を計測用ラッパーに差し替える
  await p.addInitScript(() => {
    window.__audioLog = [];
    const RealAudio = window.Audio;
    window.Audio = function (src) {
      const a = new RealAudio(src);
      const rec = { src, created: performance.now(), playing: null, ended: null };
      window.__audioLog.push(rec);
      a.addEventListener('playing', () => { if (rec.playing === null) rec.playing = performance.now(); });
      a.addEventListener('ended', () => { rec.ended = performance.now(); });
      a.addEventListener('error', () => { rec.ended = rec.ended ?? performance.now(); rec.error = true; });
      return a;
    };
    window.Audio.prototype = RealAudio.prototype;
  });

  await p.goto('http://localhost:8099/index.html');
  // speechSynthesisはフォールバック用なので、万一audioファイルが404した場合に
  // ハングしないようにスタブしておく(音声ファイルが揃っていれば呼ばれないはず)
  await p.evaluate(() => {
    window.speechSynthesis.speak = (u) => { if (u && u.onend) setTimeout(() => u.onend(), 1); };
    window.speechSynthesis.cancel = () => {};
    window.speechSynthesis.getVoices = () => [];
  });

  function summarize(log) {
    // created順にソートし、隣接クリップ間の「体感ギャップ」(前のended→次のplaying)を計算
    const sorted = log.slice().sort((x, y) => x.created - y.created);
    const rows = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (prev.ended == null || cur.playing == null) continue;
      const gap = cur.playing - prev.ended;
      const fetchDelay = cur.playing - cur.created; // created→playingの内訳(フェッチ+デコード+バッファ)
      rows.push({ from: prev.src, to: cur.src, gapMs: Math.round(gap), fetchDecodeMs: Math.round(fetchDelay) });
    }
    return rows;
  }

  // --- Part 2(応答問題)---
  await p.click('[data-tab="listen"]');
  await p.waitForTimeout(150);
  await p.click('#listen-start-btn');
  // 質問1文+選択肢4つ(質問読み上げ→間→A/B/C/D、各間にwait)が一巡するまで待つ
  await p.waitForTimeout(16000);
  const part2Log = await p.evaluate(() => window.__audioLog.splice(0, window.__audioLog.length));
  const part2Rows = summarize(part2Log);
  console.log('=== Part 2(質問→選択肢)実測ギャップ ===');
  console.log('意図値: PRE_CHOICE_WAIT=450ms(質問後) / BETWEEN_CHOICE_WAIT=350ms(選択肢間)');
  part2Rows.forEach((r) => console.log(`${r.from} -> ${r.to} : gap=${r.gapMs}ms (fetch+decode=${r.fetchDecodeMs}ms)`));

  // 一旦ホームへ戻ってからPart3を開始(playToken発行のリセットのため)
  await p.click('[data-tab="home"]').catch(() => {});
  await p.waitForTimeout(150);
  await p.click('[data-tab="listen"]');
  await p.waitForTimeout(150);

  // --- Part 3(会話)---
  await p.click('#part3-start-btn');
  // ナレーター導入 + 会話の全セリフ(6行前後)が一巡するまで待つ
  await p.waitForTimeout(22000);
  const part3Log = await p.evaluate(() => window.__audioLog.splice(0, window.__audioLog.length));
  const part3Rows = summarize(part3Log);
  console.log('\n=== Part 3(ナレーター→セリフ)実測ギャップ ===');
  console.log('意図値: POST_NARRATOR_WAIT=400ms(導入後) / BETWEEN_LINE_WAIT=300ms(セリフ間)');
  part3Rows.forEach((r) => console.log(`${r.from} -> ${r.to} : gap=${r.gapMs}ms (fetch+decode=${r.fetchDecodeMs}ms)`));

  const allRows = [...part2Rows, ...part3Rows];
  if (allRows.length) {
    const avgGap = allRows.reduce((s, r) => s + r.gapMs, 0) / allRows.length;
    const avgFetch = allRows.reduce((s, r) => s + r.fetchDecodeMs, 0) / allRows.length;
    console.log(`\n平均ギャップ: ${Math.round(avgGap)}ms / うちフェッチ+デコード平均: ${Math.round(avgFetch)}ms`);
  } else {
    console.log('\n計測できたギャップが0件でした(セレクタやタイミングを見直してください)');
  }

  console.log('\nconsole errors:', errors.length, errors.slice(0, 5).join(' | '));
  await b.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
