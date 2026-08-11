const { chromium } = require('playwright');
const URL = 'http://localhost:8099/index.html';

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto(URL);

  async function scenario(voiceNames, prefs) {
    return await page.evaluate(([names, prefs]) => {
      voiceMW = null;
      state.settings.voiceM = (prefs && prefs.voiceM) || "";
      state.settings.voiceW = (prefs && prefs.voiceW) || "";
      const fakeVoices = names.map((n) => ({ name: n, lang: 'en-US' }));
      speechSynthesis.getVoices = () => fakeVoices;
      const mw = pickVoicesMW();
      return {
        m: mw.m ? mw.m.name : null,
        w: mw.w ? mw.w.name : null,
        distinct: mw.distinct,
      };
    }, [voiceNames, prefs || null]);
  }

  // 1. 明確な男女名ペア(Samantha/Daniel)
  let r = await scenario(['Samantha', 'Daniel']);
  check('明確な男女名: SamanthaがW、DanielがMに割り当てられる', r.w === 'Samantha' && r.m === 'Daniel' && r.distinct, JSON.stringify(r));

  // 2. Chromeでよくある「Google US English」(性別名無し)+「Google UK English Male」
  r = await scenario(['Google US English', 'Google UK English Male']);
  check('性別名なしの既定声+Maleのみ: 異なる声が男女に割り当てられる(distinct)', r.distinct && r.m === 'Google UK English Male', JSON.stringify(r));

  // 3. 声が1つしか無い(性別判定不能)→ 同一音声とみなしdistinct=false
  r = await scenario(['Google US English']);
  check('声が1つのみ: distinct=falseとなり同一音声フォールバックと判定される', r.distinct === false, JSON.stringify(r));

  // 4. 汎用名2つ(性別情報なし)→ せめて異なる声を2つ確保(distinct=true)
  r = await scenario(['English (America)', 'English (United Kingdom)']);
  check('性別情報のない汎用名が2つ: それでも異なる声を2つ確保しdistinctになる', r.distinct === true && r.m !== r.w, JSON.stringify(r));

  // 5. 声が0個(このサンドボックス環境の実際の状態)→ クラッシュしないこと
  r = await scenario([]);
  check('声が0個でもクラッシュしない(m/w共にnull, distinct=false)', r.m === null && r.w === null && r.distinct === false, JSON.stringify(r));

  // 6. 同一音声フォールバック時にピッチテーブルが切り替わることを確認(speakAsを直接呼ぶのは音声出力を伴うため、
  //    pitch算出ロジックのみをテーブル参照で確認)
  const pitchCheck = await page.evaluate(() => {
    const distinctSpread = SPEAKER_PITCH.W - SPEAKER_PITCH.M;
    const sameVoiceSpread = SPEAKER_PITCH_SAME_VOICE.W - SPEAKER_PITCH_SAME_VOICE.M;
    return { distinctSpread, sameVoiceSpread };
  });
  check('distinct=false用のピッチテーブルの方がM/Wの差が大きい(聞き分けやすい)',
    pitchCheck.sameVoiceSpread > pitchCheck.distinctSpread,
    JSON.stringify(pitchCheck));

  // 7. Fred(Appleのノベルティ/崩れた音質ボイス)は男性ボイス候補として選ばれないこと
  r = await scenario(['Samantha', 'Fred']);
  check('Fredはノベルティボイスのため男性候補から除外される(mが見つからずフォールバック選定になる)',
    r.m !== 'Fred', JSON.stringify(r));

  // 8. 同一音声フォールバック時のピッチが極端すぎない(iOSのcompactボイスで歪みが出ない範囲)ことを確認
  const safeRange = await page.evaluate(() => ({
    M: SPEAKER_PITCH_SAME_VOICE.M,
    M2: SPEAKER_PITCH_SAME_VOICE.M2,
    W: SPEAKER_PITCH_SAME_VOICE.W,
    W2: SPEAKER_PITCH_SAME_VOICE.W2,
  }));
  check('同一音声フォールバックのピッチが歪みの出にくい範囲(M/M2 >= 0.6, W/W2 <= 1.6)に収まっている',
    safeRange.M >= 0.6 && safeRange.M2 >= 0.6 && safeRange.W <= 1.6 && safeRange.W2 <= 1.6,
    JSON.stringify(safeRange));

  // 9. 同一音声フォールバック時はレート差も併用して聞き分けを補うこと
  const rateCheck = await page.evaluate(() => ({
    M: SPEAKER_RATE_SAME_VOICE.M,
    W: SPEAKER_RATE_SAME_VOICE.W,
  }));
  check('同一音声フォールバック時はM/Wでレートにも差がある', rateCheck.M !== rateCheck.W, JSON.stringify(rateCheck));

  // ---- 2026-07-29の根本原因(部分文字列マッチ)に対する回帰テスト ----

  // 10. iOS実機で起きていた本命ケース: Samantha が "Sa(man)tha" で男性判定されていた
  r = await scenario(['Samantha', 'Nicky']);
  check('【根本原因】Samanthaが男性ボイスとして選ばれない(man の部分一致バグの回帰)',
    r.m !== 'Samantha', JSON.stringify(r));

  // 11. iOSは同名ボイスを品質違いで複数返す。同名が男女に割り当てられないこと
  r = await scenario(['Samantha', 'Samantha', 'Aaron']);
  check('同名ボイスが重複して返ってもmとwが同じ名前にならない',
    !(r.m === r.w && r.m !== null), JSON.stringify(r));
  check('重複を除いた上で正しくAaronが男性に割り当てられる', r.m === 'Aaron' && r.w === 'Samantha', JSON.stringify(r));

  // 12. "female"/"woman" が male/man の部分一致で男性判定されないこと
  r = await scenario(['Google US English Female', 'Google UK English Male']);
  check('"Female"を含む名前が男性判定されない(male の部分一致バグの回帰)',
    r.w === 'Google US English Female' && r.m === 'Google UK English Male', JSON.stringify(r));

  // 13. iOS実機で想定される標準的な英語ボイス一覧での割り当て
  r = await scenario(['Aaron', 'Nicky', 'Samantha', 'Karen', 'Daniel', 'Martha', 'Arthur', 'Rishi', 'Moira', 'Tessa']);
  check('iOS想定の一覧で女性=Samantha系・男性=Aaron系が正しく割り当てられる',
    r.distinct && !['Samantha', 'Nicky', 'Karen', 'Martha', 'Moira', 'Tessa'].includes(r.m), JSON.stringify(r));

  // 14. 設定で手動指定した声が自動判定より優先されること
  r = await scenario(['Samantha', 'Aaron', 'Daniel'], { voiceM: 'Daniel', voiceW: 'Samantha' });
  check('設定の手動指定(voiceM/voiceW)が自動判定より優先される',
    r.m === 'Daniel' && r.w === 'Samantha' && r.distinct, JSON.stringify(r));

  // 15. 手動指定した声が端末に存在しない場合は自動判定にフォールバックすること
  r = await scenario(['Samantha', 'Aaron'], { voiceM: '存在しない声', voiceW: '' });
  check('存在しない手動指定は無視され自動判定にフォールバックする',
    r.m === 'Aaron' && r.w === 'Samantha', JSON.stringify(r));

  check('コンソールエラー0件', errors.length === 0, errors.slice(0, 8).join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
