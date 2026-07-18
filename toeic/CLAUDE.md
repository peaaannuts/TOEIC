# TOEIC 600 学習アプリ — 引き継ぎメモ

TOEIC L&R 600点を1ヶ月で目指す、サーバー不要のPWA(単語・文法・リスニング・ゲーミフィケーション)。
別チャットでの続き作業用に、現状の構成と設計判断をまとめておく。

## 起動方法

このフォルダ(`C:\Users\japan\Desktop\toeic`)で `npx serve .` するか、`index.html` を直接開く。
プレビュー用の launch 設定は **家事分担アプリ側**の `C:\Users\japan\Desktop\家事分担\.claude\launch.json` に
`"toeic-app"` という名前で登録済み(このプロジェクト自体はgit管理なし、独立フォルダ)。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | 画面構造(6タブ: ホーム/単語/文法/聞く/読解/記録 + 設定ダイアログ) |
| `style.css` | デザイン(モバイルファースト、CSS変数でテーマ管理) |
| `data.js` | 単語(WORDS)・発音記号(IPA)・文法(QUESTIONS)・Part1(PART1)・Part2(PART2)・Part6(PART6)・Part7読解(READING)の全データ |
| `app.js` | ロジック全部(状態管理・出題・採点・演出・音声・ゲーミフィケーション) |
| `manifest.webmanifest` / `icon.svg` / `sw.js` | PWA対応 |
| `README.md` | ユーザー向け説明 |

## データ規模(2026-07-17時点)

- 単語: WORDS 312語(2026-07-17に212→312語へ100語追加。ビジネス頻出の中級〜600点レベル語彙を追加。
  +発音記号IPA辞書が同数)
- 文法(Part 5形式): QUESTIONS 300問(2026-07-17に200→300問へ100問追加。
  品詞/動詞の形/語彙/前置詞/接続詞/代名詞/関係詞/比較の内訳比率は元の200問と揃えてある)
- リスニング Part 1(写真描写): PART1 16問(イラストはSVGをdata.js内にインラインで直書き)
- リスニング Part 2(応答問題): PART2 60問
- 読解 Part 7: READING 10文書セット・計28設問(2026-07-17追加。単一パッセージ8+ダブルパッセージ2。
  各セットは `{ t, passages:[{label,text,jtext}], qs:[{q,jq,c,a,x}] }`。cのa番目が正解で表示時にシャッフル)
- 読解 Part 6(長文穴埋め): PART6 6長文・計24問(2026-07-17追加。各長文4空所、うち1問は文挿入 `ins:true`)。
  各長文は `{ t, text, qs:[{c,a,ins,x,jq}] }`。text内の `{1}..{4}` が空所位置(表示時に (1)〜(4) のラベルへ置換)

## 核となる設計: 忘却曲線ベースの間隔反復(SRS)

単語・文法・リスニング(Part1/Part2)**全セクション共通**で同じ方式:

- `INTERVALS = [0, 1, 3, 7, 14]`(日)。正解のたびにレベルが上がり次回出題が延びる。不正解でレベル0に戻る。
- 各問題の記録は `{ lv, next(YYYY-MM-DD), seen, ok }` の形で `state.words` / `state.quizStats` /
  `state.listenStats`(Part2) / `state.part1Stats` に保存。
- 出題キュー生成(`buildWordQueue` / `buildQuizQueue` / `buildListenQueue`)は共通ロジック:
  「復習期日が来た問題(レベル低い順)→ 未出題 → (それでも足りなければ)復習予定を前倒し」で1セット分を組む。
- `loadState()` 内で **旧形式(lv/nextなし)の記録を自動移行**する処理がある。今後スキーマを変える時も
  ここに移行コードを足す運用。
- 定着度表示(Anki風 Mature/Young/Learning/New)は `srsRetentionCounts()` / `renderRetentionBar()` /
  `renderForecast()`(今後7日間の復習予定グラフ)で共通化されている。記録タブとセクション開始画面の両方に出す。

## ゲーミフィケーション層

- **XP&レベル**: `state.xp` に加算、`levelInfo(xp)` でレベル算出(Lv1→2は100XP、以降+50ずつ)。
  `addXp(n)` を呼ぶとレベルアップ判定も自動で行われる。
- **称号**: `TITLES` 配列でレベル閾値ごとに称号("みならい"→"600点スレイヤー"等)。`titleForLevel()`。
- **コンボ&ピッチ変化**: 連続正解で `seCorrect(combo)` の音のピッチが半音ずつ上がる(最大7半音)。
  3連続以上でXPが1.5倍。
- **実績バッジ**: `BADGES` 配列(15種)、`checkBadges()` が学習アクションのたびに判定。
  解除時は紙吹雪+バナー+ボーナス50XP。`aggregates()` が累計データ集計。
- **デイリーチャレンジ**: `DAILY_POOL`(9種)から日付シードで毎日3つ決定的に選出(`dailyChallenges()`)。
  達成で `checkDailyChallenges()` がボーナスXP+バナー。
- **タイムアタックモード**: 文法クイズのみ、1問20秒(`TA_SECONDS`)。時間切れは不正解扱い、
  速答でスピードボーナス+5XP。
- **効果音**: Web Audio APIでその場合成(音声ファイル不要)。`popNote()` がDuolingo風「ポピンッ」の
  正解音を作る基礎関数。設定でON/OFF可(`state.settings.sound`)。
- **紙吹雪・バナー演出**: `confetti()` / `showBanner()`。バナーは複数同時発生時に縦に並ぶ。

## 音声(TTS)

`speechSynthesis`(ブラウザ内蔵、無料・オフライン)を使用。音声ファイルは一切使っていない。

- リスニング(Part1/Part2)の質問・選択肢読み上げ: `playListenAudio()`
- 単語カードの自動読み上げ+🔊ボタン: `speakWord()`(設定 `autoSpeak` でON/OFF)
- iOS Safari対策として、各モード開始ボタンの直下で空発話を1回鳴らして音声をアンロックしている
  (`audioStarted` フラグで、リスニング未使用ならTTSに一切触れないようにもしてある)

## プレビュー検証で踏んだ地雷(次回も起きうる)

- **Service Workerキャッシュ**: `data.js`/`app.js` を編集したら `sw.js` の `CACHE_NAME` を必ずインクリメント
  (現在 `toeic600-v17`)。プレビューで検証する際は `navigator.serviceWorker.getRegistrations()` から
  `update()` を呼んで反映を待つ必要がある(でないと古いコードのまま)。
- **プレビューのscreenshotツールがしばしばタイムアウトする**(このセッション中に複数回発生)。
  そのときは `preview_inspect` / `javascript_tool` でDOM状態や算出スタイルを直接検査する方が確実。
- 音声合成をテストする時は `window.speechSynthesis.speak` をスタブ化してテストしないと、
  ヘッドレス環境で発話が終わらずセッションが進まないことがある。

## 修正済みの既知バグ

- **新出問題が永久に出題されなくなるバグ(2026-07-17修正)**: `buildWordQueue` / `buildQuizQueue` /
  `buildListenQueue` は「復習期日が来た問題(due)を先にセット枠いっぱいまで詰め、余った枠だけ新出問題(fresh)
  で埋める」実装だった。復習の蓄積がセットサイズ(文法/リスニングPart2は10, Part1は6, 単語は`goalWords`)
  以上になる日が続くと新出問題の枠が0のまま固定され、未出題の問題が永遠に増え続けない状態になっていた
  (シミュレーションで正答率90%・400日経過でも200問中115問しか出題されず、残り85問が固定されたままと確認。
  ユーザー報告の「文法の残り89問が出題されない」と一致)。
  修正: 各キュー生成関数で `newSlots = Math.min(fresh.length, Math.max(1, Math.round(size * 0.3)))` を
  必ず確保し、復習が多い日でも新出問題が毎回一定数(セットサイズの約3割)は混ざるようにした。
  `sw.js` の `CACHE_NAME` は `v18` にインクリメント済み。

## 文法問題への和訳表示(2026-07-17追加)

文法(QUESTIONS)には元々 `x`(解説)しかなく英文の和訳がなかったが、リスニング(PART2)の
`jq` フィールドと同じ命名で QUESTIONS の全300問に `jq`(空所を正解で埋めた完成文の和訳)を追加した。
表示は `answerQuestion()` 内で `q.q.replace("-------", q.c[q.a])` により正解を埋めた英文を組み立て、
リスニングの `.script-q` / `.listen-script` と同じCSSクラスを流用して
「英文(太字)+ 和訳(小さいグレー文字)」を解説の直前に表示する(`index.html` の `#quiz-script`)。
新しく文法問題を追加する際は `jq` フィールドを忘れずに入れること。

## 読解(Part 7)タブ(2026-07-17追加)

TOEIC本番との比較でリスニングPart3/4・読解Part6/7が丸ごと未対応だったため、まず最大の穴である
**Part 7(読解)**を追加した。設計:

- データ `READING`(data.js末尾)。文書セット単位。単一パッセージとダブルパッセージ(2文書照合)を混在。
- SRSは**文書セット単位**(`state.readStats`)。セット内の全設問に正解でレベルUP、1問でも間違えるとレベル0。
  `readSetOk` フラグで判定し、セット最終問の「次へ」時に `finalizeReadSet()` で確定する。
- 1セッション = `READ_SET_SIZE`(=2)文書セット。文書を上部の `.read-passages`(スクロール可)に表示したまま、
  設問を1問ずつ解く。設問の選択肢は文法と同様シャッフルし `q.a` が正解。
- **読解タイマー**(`startReadTimer`/`updateReadTimer`、setInterval)。結果画面で所要時間と「問/分」ペースを表示し、
  本番の時間配分(約1問/分)と比較させる。タブを離れると `stopReadTimer()` で止める(showTab内)。
- log に `read`/`readOk` を追加。`logTotal`(連続日数)・`aggregates`(実績)・ホームのノルマ・記録タブの
  2週間チャート(紫 `--read-color` の `chart-seg-read`)・デイリーチャレンジ(`read6`/`allfour`)・
  実績バッジ(`r30` 速読の入り口)にも読解を統合済み。
- ホーム/設定に読解ノルマ(`goalRead`、デフォルト6問)、記録タブに読解の定着度カードを追加。
- **次にやるならPart 3/4(リスニング)とPart 6、模試モード・推定スコア換算**(会話は当初のユーザー相談参照)。

## 推定スコア(2026-07-17追加)

ホーム上部(試験カウントダウンの直下)に演習成績ベースの推定TOEICスコアカードを表示。

- `estimateScore()`: Listening=Part1+Part2の正答率、Reading=文法(Part5)+読解(Part7、log由来のreadOk/read)
  +単語(語彙は基礎指標として `pairSum(state.words, 0.5)` の0.5倍重み)の正答率。
- `sectionScoreFromAcc(acc)`: `5 + 490 * acc^1.3` を5点刻みに丸め、5〜495にクランプ。
  練習問題は本番より易しくSRSで正答率が上がりやすいため acc^1.3 のやや保守的な曲線にしている。
- 各セクション `seen >= 10` で推定表示、未満は「もう少し解くと〜」の案内。両方揃えば合計と診断
  (目標`settings.targetScore`(既定600)までの残り、L/Rどちらを重点にすべきか)を出す。
- `renderScore()` は `renderHome()` の先頭で呼ぶ。目標スコアは設定ダイアログで変更可。
- あくまで目安である旨を画面に明記(本番スコアとは異なる)。

## Part 6(長文穴埋め)= 読解タブの2セクション化(2026-07-17追加)

読解タブを Part 6・Part 7 の2セクション構成にした(リスニングタブが Part 1/2 を持つのと同じ形)。

- `readSection`(6 or 7)が現在のセクション。`readSets()`/`readStatsStore()`/`readSetSize()` で切り替え、
  読解の出題・SRSロジックは Part 6/7 で完全共通化(`buildReadQueue` など)。SRSストアは
  `state.part6Stats` / `state.readStats` に分離。
- Part 6の本文は単一 `text`。`renderReadPassages()` が `{n}` を `<span class="p6-blank">(n)</span>` に置換し、
  `showReadQuestion()` から毎問呼んで現在の空所(readQPos+1)を `.active` で強調。本文はapp内蔵の
  信頼データだが `escapeHtml()` を通してから置換している。
- Part 6も本番Readingなので `log.read`/`readOk` に加算。ノルマ・推定Readingスコア・実績・デイリー・
  2週間チャート・記録タブの読解定着度(Part6+Part7合算表示)にすべて反映される。
- 開始画面 `#read-start` は Part 6 / Part 7 の2カード(`#part6-start-btn` / `#part7-start-btn`)。
- **次にやるならリスニングPart 3/4(会話・トーク)**。TTSで連続音声を作る工夫が要る。

## まだやっていない / 声が出れば良さそうな拡張案

- 実績バッジ・デイリーチャレンジの一覧は記録タブに表示済みだが、通知(ScheduleWakeup的な仕組み)は未実装
- スマホでの実機確認はしていない(プレビューブラウザでのみ検証)。ユーザーには毎回
  「フォルダ再アップロード→アプリを2回開く」で反映されると案内している(Netlify Drop想定)
- ユーザーの試験日は設定で自由に変えられる(デフォルトは翌月第1日曜)

## ユーザーとのやりとりの傾向

- 機能追加は「〜できる?」という一言リクエストが多い。都度、設計方針を1〜2行で示してから実装に入っている。
- 実装のたびにプレビューブラウザで動作検証してから完了報告する運用が定着している(スクショが撮れない時は
  DOM検査で代替)。
- キャッシュバージョンの更新とREADME.mdの追記は機能追加のたびに必ず行っている。
