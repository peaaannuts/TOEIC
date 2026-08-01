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

  // 端末に声がある状態を模擬してから設定を開く
  await page.evaluate(() => {
    voiceMW = null;
    const names = ['Samantha', 'Samantha', 'Aaron', 'Daniel', 'Fred', 'Nicky'];
    speechSynthesis.getVoices = () => names.map((n) => ({ name: n, lang: 'en-US' }));
  });
  await page.click('#settings-btn');
  await page.waitForTimeout(200);

  const open = await page.evaluate(() => document.getElementById('settings-dialog').open);
  check('設定ダイアログが開く(音声ピッカー追加後も既存動作を維持)', open);

  const opts = await page.evaluate(() => ({
    m: Array.from(document.getElementById('voice-m-input').options).map((o) => o.value),
    w: Array.from(document.getElementById('voice-w-input').options).map((o) => o.value),
    mLabel: document.getElementById('voice-m-input').options[0].textContent,
    emptyHidden: document.getElementById('voice-empty-note').classList.contains('hidden'),
  }));
  check('男性ボイスのプルダウンに端末の声が並ぶ(先頭は自動)', opts.m[0] === '' && opts.m.length > 1, JSON.stringify(opts.m));
  check('ノベルティボイス(Fred)はプルダウンに出ない', !opts.m.includes('Fred'), JSON.stringify(opts.m));
  check('同名の重複(Samantha×2)はプルダウンで1つにまとまる',
    opts.m.filter((n) => n === 'Samantha').length === 1, JSON.stringify(opts.m));
  check('「自動」の選択肢に自動判定された声名が表示される', /自動\(.+\)/.test(opts.mLabel), opts.mLabel);
  check('声が取得できている時は「一覧が読み込まれていません」の注記が隠れる', opts.emptyHidden);

  // 手動指定して保存 → state に反映され、次回の pickVoicesMW に効くこと
  await page.selectOption('#voice-m-input', 'Daniel');
  await page.selectOption('#voice-w-input', 'Nicky');
  await page.click('#settings-save-btn');
  await page.waitForTimeout(200);

  const saved = await page.evaluate(() => ({
    m: state.settings.voiceM,
    w: state.settings.voiceW,
    picked: (() => { const mw = pickVoicesMW(); return { m: mw.m && mw.m.name, w: mw.w && mw.w.name }; })(),
  }));
  check('選んだ声が state.settings に保存される', saved.m === 'Daniel' && saved.w === 'Nicky', JSON.stringify(saved));
  check('保存後のpickVoicesMWが手動指定の声を返す(キャッシュが破棄されている)',
    saved.picked.m === 'Daniel' && saved.picked.w === 'Nicky', JSON.stringify(saved.picked));

  // 保存内容がリロード後も残ること
  await page.reload();
  const persisted = await page.evaluate(() => ({ m: state.settings.voiceM, w: state.settings.voiceW }));
  check('リロード後も手動指定が保持される', persisted.m === 'Daniel' && persisted.w === 'Nicky', JSON.stringify(persisted));

  // 声が0個の環境(このサンドボックス実機状態)では注記が出ること
  await page.evaluate(() => { voiceMW = null; speechSynthesis.getVoices = () => []; });
  await page.click('#settings-btn');
  await page.waitForTimeout(150);
  const emptyShown = await page.evaluate(() => !document.getElementById('voice-empty-note').classList.contains('hidden'));
  check('声が0個の環境では案内文が表示される', emptyShown);

  check('コンソールエラー0件', errors.length === 0, errors.slice(0, 8).join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
