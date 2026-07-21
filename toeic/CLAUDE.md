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
| `../.github/workflows/deploy-pages.yml` | GitHub Pages自動デプロイ(リポジトリ直下の.github/workflows) |

## 公開・デプロイ(2026-07-18〜 GitHub Pages自動化)

- `main` **または開発ブランチ `claude/toeic-app-dev-st2txs`** の `toeic/` 配下が更新されると
  GitHub Actions が `toeic/` フォルダを**サイトのルート**として GitHub Pages に自動デプロイする
  (`.github/workflows/deploy-pages.yml`)。**開発ブランチへのpushだけで公開URLに反映される**(mergeは不要)。
  ※pushイベントのワークフロー定義は push されたコミットのものが使われるため、開発ブランチを triggers に
  追加した本ファイルを開発ブランチに push すれば、その push 自体からデプロイが走る。
  ※`github-pages` 環境に「Deployment branches」制限があると開発ブランチのデプロイが弾かれる。その場合は
  リポジトリ Settings → Environments → github-pages → Deployment branches で当該ブランチを許可(または無制限)にする。
- 公開URL: `https://peaaannuts.github.io/TOEIC/`(プロジェクトPagesなので `/TOEIC/` 配下)。
  toeic/内のパス・SW登録(`register("sw.js")`)・manifest(`start_url:"."`)はすべて相対なので
  サブパス配下でも正しく動く。**アセットを絶対パス(先頭 `/`)にしないこと**。
- 初回のみリポジトリ Settings → Pages → Source を「GitHub Actions」にする必要がある
  (workflowの `actions/configure-pages@v5` に `enablement: true` を付けており自動有効化を試みる)。
- キャッシュ更新はこれまで通り `sw.js` の `CACHE_NAME` インクリメントで行う。ユーザーには
  「アプリを2回開き直す」と新版に更新される旨を案内(SWの都合)。以前のNetlify Drop運用の代替。
- **初回デプロイは Pages 未有効化で失敗する**(`Create Pages site failed: Resource not accessible by
  integration`)。Actionsの自動トークンはPagesを新規作成できないので、リポジトリ所有者が一度だけ
  Settings→Pages→Source=「GitHub Actions」に設定する必要がある。設定後にワークフローを再実行すれば成功する
  (2026-07-18に有効化→再実行で成功済み)。

## 記録のバックアップ(書き出し/復元)(2026-07-18追加)

localStorageの記録は**URLごと**に保存され、URLが変わると引き継がれない(GitHub Pagesへの移行で顕在化)。
そのため設定ダイアログに「学習記録のバックアップ」を追加。

- `exportBackup()`: `state` 全体をJSON化し `toeic600-backup-YYYY-MM-DD.json` としてダウンロード
  (対応端末ではクリップボードにもコピー)。
- `importBackup(text)`: JSONを検証(words/settings/logのいずれかを持つか)→ confirm後に
  `localStorage` へ書き込み `state = loadState()`(移行処理も通る)で反映。
- アプリ更新(デプロイ・SWキャッシュ更新)ではlocalStorageは消えない。バックアップは主に別URL/機種変更用。

## データ規模(2026-07-17時点)

- 単語: WORDS 312語(2026-07-17に212→312語へ100語追加。ビジネス頻出の中級〜600点レベル語彙を追加。
  +発音記号IPA辞書が同数)
- 文法(Part 5形式): QUESTIONS 300問(2026-07-17に200→300問へ100問追加。
  品詞/動詞の形/語彙/前置詞/接続詞/代名詞/関係詞/比較の内訳比率は元の200問と揃えてある)
- リスニング Part 1(写真描写): PART1 16問(イラストはSVGをdata.js内にインラインで直書き)
- リスニング Part 2(応答問題): PART2 74問(2026-07-18に60→74問へ+14。本番監査を受けて**間接応答**が
  正解の問題を追加。従来は正解が直接応答ばかりでキーワード拾いで解けていたため、「まだ決まっていない/
  〜に聞いて/確認します」等の間接応答を正解にした14問を末尾の「間接応答」ブロックに追加)
- リスニング Part 3(会話問題): PART3 20会話・計60問(8→16→20会話。うち末尾4件は図表参照問題)。各会話 `{ t, lines:[{s,text,jtext}], qs:[3] }`。
  `s`=話者(M/W、3人会話では M2/W2)。5件が3人会話。
- リスニング Part 4(説明文問題): PART4 15トーク・計45問(6→12→15トーク。うち末尾3件は図表参照問題)。各トーク `{ t, lines:[{s,text,jtext}], qs:[3] }`。
  1話者(全lineのsは同一)。
- 図表参照問題(2026-07-18追加): Part 3に4件・Part 4に3件。セットに `graphic:{ type:"table", title, headers:[], rows:[[]] }` を持ち、
  設問の1つに `g:true`(「Look at the graphic.」)。音声のヒント(時刻・条件・色など)と表を照合して答える本番形式。
  図表(スケジュール表/料金表/案内図/発車案内/割引表/部屋割り)はセット中ずっと画面表示。`renderL34Graphic()` が
  `graphic` を `<table class="l34-table">` に描画。SRS/採点は通常セットと同じ。
- 読解 Part 7: READING 13文書セット・計48設問(2026-07-17に10セット28問→2026-07-18に13セット38問へ
  +3セット10問追加:オンラインレビュー3問・日程表3問・ダブルパッセージ4問。さらに2026-07-18の本番監査を受けて
  同13セットに設問を+10問(38→48):**語彙言い換え問題6問**(`In the ..., the word "X" is closest in meaning to`)と
  **推測問題4問**(`What is suggested/implied/most likely...`)を追加。加えて**正解が本文丸写しだった12問を言い換えに修正**
  (例:seating area→sit down inside、fitness center→gym。単語一致で解ける癖を排除)。
  単一パッセージ+ダブルパッセージ。各セットは `{ t, passages:[{label,text,jtext}], qs:[{q,jq,c,a,x}] }`。cのa番目が正解で表示時にシャッフル)
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

## 継続の仕組み(ストリーク/ジェム/フリーズ/宝箱)(2026-07-18追加)

Duolingoのリサーチを踏まえ、「明日も開かせる」外殻を強化した層。学習エンジン(SRS)は据え置き。

- **ストリーク(連続学習日)を主役化**: ホーム最上部に炎ヒーローカード(`#streak-hero`、`renderStreakHero()`)。
  今日未学習なら炎を `.dim`(グレースケール)にして行動を促す。`todayActive()` で判定。
- **ストリークは永続モデルで維持**: 従来はログから毎回算出していたが、フリーズ対応のため
  `state.streak = { count, lastActive, best }` を永続化。学習アクションのたびに `touchStreak()` を
  `checkDailyChallenges()` 冒頭で呼んで更新する(冪等・同日2回目以降は何もしない)。
  導入前ユーザーは `loadState()` で `calcStreakFromLog()` により既存ログから連続日数をシードして引き継ぐ。
  `calcStreak()` は表示用に `state.streak.count` を返すだけになった(バッジ条件もこれを参照)。
- **フリーズ(お守り、`state.freezes`、最大 `FREEZE_MAX=2`)**: `touchStreak()` で間が空いた日
  (gap-1日)を在庫があれば自動で埋めて連続維持。足りなければ `count=1` にリセット。
  埋めた日は `freezeLog` に記録(直近30件)。カウントには加算しない(Duolingo方式)。
- **ジェム(`state.gems`)と宝箱**: デイリーチャレンジ達成時に `openChest(challengeXp)` を呼び、
  XP帯でグレード(bronze/silver/gold)を決めてランダムなジェムを付与(変動報酬)。金の宝箱は40%で+15XP。
  XP(学習報酬)はそのまま、ジェムはメタ通貨として別立て。
- **ストリーク節目**: `STREAK_MILESTONES`(3/7/14/30/50/100日)到達で `checkStreakMilestones()` が
  ボーナスジェム+紙吹雪。7の倍数の節目では ❄️フリーズも1個無料付与(課金なしでも継続を守れる)。
  祝福済みは `state.streakMilestones` に記録し二度祝わない。
- **ショップ**(`#shop-dialog`、`renderShop()`): 炎ヒーローのカードをタップで開く。フリーズを
  `FREEZE_COST=200`💎 で購入(`buyFreeze()`)。在庫最大 or ジェム不足でボタンを無効化。
- **意図的に入れていないもの**: ハート制(ライフ制限)。課金誘導色が強く、試験直前に演習量を
  制限するのは学習目的と矛盾するため見送り(リサーチでの批判点)。通知はサーバー無し(GitHub Pages)
  では打てないため未実装 → 将来サーバーを持つなら最優先。
- 検証: `scratchpad/smoke.js`(Playwright)で連続/フリーズ消費/リセット/節目/購入/宝箱/移行の
  11ケースを実機ブラウザで自動テスト済み(全PASS)。

## 継続の仕組み・第2弾(週間クエスト/月間バッジ/ゴーストリーグ)(2026-07-18追加)

デイリー(日)より長い目標線を張り、「1日達成したら今日はもう用がない」状態を無くす層。

- **週間クエスト**(`WEEKLY_POOL`・`weeklyQuests()`): 週(月〜日)で3つを `weekKey()` シードで
  決定的に選ぶ。進捗は `weekAggregate()`(今週7日分のログ集計)で判定。達成で XP+ジェム、
  `checkWeeklyQuests()` は `checkDailyChallenges()` の最後に呼ぶ。`state.weekly={week,claimed}`。
- **月間バッジ**(`MONTHLY_THEMES`・`monthlyBadgeFor()`): デイリー/週間クエストの達成ごとに
  `addMonthlyPoints(1)` を加算。今月の合計が `MONTHLY_TARGET`(40)に達すると季節モチーフの
  限定バッジを獲得(`checkMonthlyBadge()`)。`state.monthly={ym,points}`(月替わりでリセット)、
  獲得済みは `state.monthlyBadges=[{ym,icon,name}]`。記録タブに進捗バー+額縁コレクションを表示。
- **ゴーストリーグ**(`state.league={week,xp,prevXp,pendingResult}`): 本物のリーグはサーバーが要るので
  「先週の自分のXP合計(ghost=prevXp)を今週のXP(xp)で超えられるか」に置換。`addXp()` 内で
  今週のXPを加算。週が変わると `ensureLeagueWeek()` が先週分を ghost に確定し、`pendingResult` を立てる
  → `renderLeague()` が週明けに1回だけ勝敗を演出(勝ちで+50💎)。ホーム「今週」カードに
  ゴースト位置(👤マーク)付きの対戦バーを表示。
- ホームは「🗓️ 今週」1枚のカードにゴーストリーグ+週間クエスト+月間ミニ進捗をまとめた
  (`renderLeague()`/`renderWeekly()`/`renderMonthlyMini()`、いずれも `renderHome()` から呼ぶ)。
- **意図的に入れていないもの**(第1弾から継続): ハート制。通知(サーバー無しのため)。
- 検証: `scratchpad/testB.js`(Playwright)で週間クエスト達成/冪等/月間バッジ獲得/ゴースト勝敗/
  週替わり繰り越し/XP加算/描画の12ケースを実機ブラウザで自動テスト済み(全PASS)。第1弾の
  `smoke.js` 11ケースも回帰確認済み。

## リスニング Part 3(会話)/ Part 4(トーク)(2026-07-18追加)

本番リスニング100問中69問を占める最大の未対応領域だったPart 3/4を実装。構造は**読解セットと同型**
(音声=会話/トーク+複数設問を1単位)にして、TTSで音声を鳴らす点だけが読解と異なる。

- **複数話者TTS**: `speakAs(text, speaker, rate)`。話者ごとに声を変える。別の英語音声が2つ以上取れれば
  `pickVoicesMW()` で男女に割り当て、無ければ同じ声の**ピッチをずらして**区別(`SPEAKER_PITCH`:
  W=1.28/W2=1.45/M=0.82/M2=0.68/N=1.0)。どの端末でも話者が聞き分けられるようにピッチ差は常に適用。
- **再生**: `playL34Audio()` が narrator の導入 → 各 `line` を話者音声で順に発話(`playToken` で割り込み/
  リプレイ制御、行間 320ms)。本番同様、会話/トークは**音声のみ**で画面に出さない。設問と選択肢は
  文字で表示(Part 3/4は設問・選択肢が問題冊子に印刷されている形式)。音声が使えない端末では
  `#listen34-transcript` にスクリプトを表示して読解形式にフォールバック。
- **エンジン**: `l34Section`(3/4)で `PART3`/`PART4`・`part3Stats`/`part4Stats` を切替。
  `buildL34Queue`/`showL34Question`/`answerL34`/`finalizeL34Set`/`finishL34` は読解の対応関数のミラー。
  1セッション=2会話/2トーク(`L34_SET_SIZE`)。
- **SRS**: 会話/トーク単位(読解と同じ)。全問正解でレベルUP、1問でも誤りでレベル0。
  `state.part3Stats`/`part4Stats` の `{lv,next,seen,ok}` で、**seen/okは設問数の累計**を持たせている
  (`finalizeL34Set` で `seen += qs.length; ok += 正解数`)。これで `pairSum` による正答率算出に使える。
- **統合**: 採点ごとに `log.listen`/`listenOk` に加算(ノルマ・週間クエスト・実績に反映)。
  `estimateScore` のListeningに `pairSum(part3Stats)+pairSum(part4Stats)` を加算。記録タブのリスニング
  定着度バー・正答率(タイプ別に「Part 3 会話」「Part 4 トーク」の集計行)・予測グラフにも合算。
- **UI**: リスニングタブの開始画面に Part 3/Part 4 のカード(`part3-start-btn`/`part4-start-btn`)、
  出題画面 `#listen34-session`、結果 `#listen34-result` を追加。`renderListenStart` が4パート分の
  復習/新規数と定着度バーを描画。
- **今後**: 会話数/トーク数の拡充(現状は本番より少なめの初期セット)。グラフィック問題(図表参照)は未対応。
- 検証: `scratchpad/l34check.js`(Playwright)で会話再生→6問解答→結果、推定スコアへの反映、
  コンソールエラー無しを実機確認。既存のsmoke.js(11)/testB.js(12)も回帰PASS。

## 音声(TTS)

`speechSynthesis`(ブラウザ内蔵、無料・オフライン)を使用。音声ファイルは一切使っていない。

- リスニング(Part1/Part2)の質問・選択肢読み上げ: `playListenAudio()`
- 単語カードの自動読み上げ+🔊ボタン: `speakWord()`(設定 `autoSpeak` でON/OFF)
- iOS Safari対策として、各モード開始ボタンの直下で空発話を1回鳴らして音声をアンロックしている
  (`audioStarted` フラグで、リスニング未使用ならTTSに一切触れないようにもしてある)

## プレビュー検証で踏んだ地雷(次回も起きうる)

- **Service Workerキャッシュ**: `data.js`/`app.js` を編集したら `sw.js` の `CACHE_NAME` を必ずインクリメント
  (現在 `toeic600-v34`。2026-07-18: `MASTERED_LEVEL` を 3→4 に変更。「習得」を最上位lv4=14日間隔到達に統一し、
  ホームの「習得した単語」カウンター・実績(単語コレクター50/単語マスター150)の基準を記録タブの
  「習得済み(間隔14日)」と一致させた。実績がゆるすぎた問題の修正。獲得済みバッジは剥奪されない)。プレビューで検証する際は `navigator.serviceWorker.getRegistrations()` から
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
- スマホでの実機確認はしていない(プレビューブラウザでのみ検証)。公開は GitHub Pages 自動デプロイに
  移行済み(上の「公開・デプロイ」節)。更新は main にプッシュ→数分でPagesに反映→アプリを2回開き直す
- ユーザーの試験日は設定で自由に変えられる(デフォルトは翌月第1日曜)

## ユーザーとのやりとりの傾向

- 機能追加は「〜できる?」という一言リクエストが多い。都度、設計方針を1〜2行で示してから実装に入っている。
- 実装のたびにプレビューブラウザで動作検証してから完了報告する運用が定着している(スクショが撮れない時は
  DOM検査で代替)。
- キャッシュバージョンの更新とREADME.mdの追記は機能追加のたびに必ず行っている。
