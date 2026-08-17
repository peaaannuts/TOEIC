# 検証用スクリプト(Playwright)

`CLAUDE.md`の各節で「検証: `scratchpad/xxx.js`」として参照しているPlaywrightの回帰テスト一式。
アプリ本体の動作には不要(GitHub Pagesにはデプロイされない)。

## ローカルでの実行方法

1. Playwrightをインストール(このディレクトリか適当な場所で一度だけ):
   ```
   npm install -D playwright
   npx playwright install chromium
   ```
2. 各スクリプトの `executablePath: '/opt/pw-browsers/chromium'` は元々の開発環境(サンドボックス)固有のパスです。
   ローカルで実行する際は、その行を削除するか(通常のインストール先を自動で使う)、
   お使いの環境のChromiumパスに書き換えてください。`args: ['--no-sandbox']` はそのままで問題ありません。
3. `toeic/` をルートにローカルサーバーを起動(スクリプトは `http://localhost:8099` を前提にしています):
   ```
   cd toeic && python3 -m http.server 8099
   ```
4. 別ターミナルでスクリプトを実行:
   ```
   node scratchpad/smoke.js
   ```

## 一覧

新しい機能追加のたびに1本ずつ増えてきた経緯があるため、`CLAUDE.md`の各節を見れば
どのスクリプトが何を検証しているか分かります。まとめて回す場合は次の順で:

```
for f in smoke testB phase1check phase2check phase3check l34check fullflow uicheck \
         designcheck validate_p2 verify_p67 verify_p67_v2 verify_words_grammar \
         voicegender voiceui titlecheck verify_part1_add20 grammar_tips_check \
         verify_grammar_add100; do
  echo "=== $f ==="; node "$f.js"
done
```
