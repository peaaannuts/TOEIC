
# TOEIC 600 学習アプリ — 引き継ぎメモ

TOEIC L&R 600点を1ヶ月で目指す、サーバー不要のPWA(単語・文法・リスニング・ゲーミフィケーション)。
別チャットでの続き作業用に、現状の構成と設計判断をまとめておく。

## 起動方法

このフォルダ(`C:\Users\japan\Desktop\toeic`)で `npx serve .` するか、`index.html` を直接開く。
プレビュー用の launch 設定は **家事分担アプリ側**の `C:\Users\japan\Desktop\家事分担\.claude\launch.json` に
`"toeic-app"` という名前で登録済み(このプロジェクト自体はgit管理なし、独立フォルダ)。

## ファイル構成

| ファイル                                            | 役割                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `index.html`                                      | 画面構造(6タブ: ホーム/単語/文法/聞く/読解/記録 + 設定ダイアログ)                                                   |
| `style.css`                                       | デザイン(モバイルファースト、CSS変数でテーマ管理)                                                                   |
| `data.js`                                         | 単語(WORDS)・発音記号(IPA)・文法(QUESTIONS)・Part1(PART1)・Part2(PART2)・Part6(PART6)・Part7読解(READING)の全データ |
| `app.js`                                          | ロジック全部(状態管理・出題・採点・演出・音声・ゲーミフィケーション)                                                |
| `manifest.webmanifest` / `icon.svg` / `sw.js` | PWA対応                                                                                                             |
| `README.md`                                       | ユーザー向け説明                                                                                                    |
| `../.github/workflows/deploy-pages.yml`           | GitHub Pages自動デプロイ(リポジトリ直下の.github/workflows)                                                         |

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
- **初回デプロイは Pages 未有効化で失敗する**(`Create Pages site failed: Resource not accessible by integration`)。Actionsの自動トークンはPagesを新規作成できないので、リポジトリ所有者が一度だけ
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

- 単語: WORDS 457語(2026-07-17に212→312語へ100語追加。ビジネス頻出の中級〜600点レベル語彙を追加。
  +発音記号IPA辞書が同数)。2026-07-28に+50語:TOEIC 700-900レベルの語彙
  (allocate/discrepancy/feasible/meticulous/ambiguous/rectify 等)を追加し、600点レベルに絞っていた
  既存プールに本番相当の難度を持つ語彙を混ぜた(既存312語との重複なしを確認済み)。
  2026-08-02にさらに+100語(accessible〜diverse、ビジネス頻出の中級〜600点レベル語彙、既存語彙との重複なしを確認済み)
- 文法(Part 5形式): QUESTIONS 350問(2026-07-17に200→300問へ100問追加。
  品詞/動詞の形/語彙/前置詞/接続詞/代名詞/関係詞/比較の内訳比率は元の200問と揃えてある)。
  2026-07-28に+50問:従来ゼロだった**仮定法(20問)・倒置(15問)・分詞構文(15問)**の3カテゴリを新設。
  ユーザーから「本試験より易しい問題を作っていないか」と聞かれ、単語・文法が意図的に600点レベルに
  絞られている旨を説明した上で「既存プールに混ぜる」形で難度を引き上げた経緯(下記参照)
- リスニング Part 1(写真描写): PART1 **36問**(16→36問、2026-08-11に+20問。イラストはSVGをdata.js内に
  インラインで直書き、写真は`img`フィールドでComfyUI生成のグレースケール写真を使用。内訳は単数写真20/
  複数人物7/モノ9で既存16問の比率を踏襲。詳細は下記「Part 1を20問追加」を参照)
- リスニング Part 2(応答問題): PART2 **124問**(60→74→124問)。2026-07-18に+50問。
  内訳: WH疑問文46 / Yes/No疑問文23 / 依頼・提案20 / 平叙文18 / 選択疑問文13 / **付加疑問文4**。
  - **付加疑問文(tag question)は+50問で新設したカテゴリ**("You've sent it, haven't you?")。本番頻出だが未収録だった。
    `t` は自由文字列で記録タブのタイプ別集計はデータ駆動のため、新カテゴリを足すだけで統計にも自動で出る。
  - **間接応答の比率**: 11/74(15%)→ **30/124(24%)** に引き上げ(本番は2〜3割)。正解が直接応答ばかりだと
    キーワード拾いの癖がつき本番で崩れるため、追加50問のうち20問を間接応答(「まだ決まっていない/〜に聞いて/
    確認します/どちらでも/担当は別部署」等)にした。
  - ひっかけは音類似(signature/sign, approved/improved, café/coffee, hiring/higher, fair/fare, mail/male,
    translation/transition, password/passed)・同語反復で意味をずらす・別のWH種類への応答、で構成。
  - 検証は `scratchpad/validate_p2.js`(構造・**設問文の重複検出**・カテゴリ集計・間接応答率)。
- リスニング Part 3(会話問題): PART3 20会話・計60問(8→16→20会話。うち末尾4件は図表参照問題)。各会話 `{ t, lines:[{s,text,jtext}], qs:[3] }`。
  `s`=話者(M/W、3人会話では M2/W2)。5件が3人会話。
- リスニング Part 4(説明文問題): PART4 15トーク・計45問(6→12→15トーク。うち末尾3件は図表参照問題)。各トーク `{ t, lines:[{s,text,jtext}], qs:[3] }`。
  1話者(全lineのsは同一)。
- 図表参照問題(2026-07-18追加): Part 3に4件・Part 4に3件。セットに `graphic:{ type:"table", title, headers:[], rows:[[]] }` を持ち、
  設問の1つに `g:true`(「Look at the graphic.」)。音声のヒント(時刻・条件・色など)と表を照合して答える本番形式。
  図表(スケジュール表/料金表/案内図/発車案内/割引表/部屋割り)はセット中ずっと画面表示。`renderL34Graphic()` が
  `graphic` を `<table class="l34-table">` に描画。SRS/採点は通常セットと同じ。
- 読解 Part 7: READING 19文書セット・計68設問(2026-07-17に10セット28問→2026-07-18に13セット38問へ
  +3セット10問追加:オンラインレビュー3問・日程表3問・ダブルパッセージ4問。さらに2026-07-18の本番監査を受けて
  同13セットに設問を+10問(38→48):**語彙言い換え問題6問**(`In the ..., the word "X" is closest in meaning to`)と
  **推測問題4問**(`What is suggested/implied/most likely...`)を追加。加えて**正解が本文丸写しだった12問を言い換えに修正**
  (例:seating area→sit down inside、fitness center→gym。単語一致で解ける癖を排除)。
  2026-07-27に+3セット10問追加(プレスリリース3問・請求書3問・ダブルパッセージ4問)。
  2026-07-29に+3セット10問追加(アンケート依頼3問・**オンラインチャット3問**・ダブルパッセージ4問)。
  オンラインチャットは3人のやり取りを時刻付きで並べた本番形式で、「意図問題」
  (`At 9:17 A.M., what does Ms. Kim most likely mean when she writes, "..."?`)を初収録。
  単一パッセージ+ダブルパッセージ。各セットは `{ t, passages:[{label,text,jtext}], qs:[{q,jq,c,a,x}] }`。cのa番目が正解で表示時にシャッフル)
- 読解 Part 6(長文穴埋め): PART6 12長文・計48問(2026-07-17追加。各長文4空所、うち1問は文挿入 `ins:true`)。
  2026-07-27に+3長文12問追加(図書館の利用案内・プレスリリース・ウェビナー登録案内)。
  2026-07-29に+3長文12問追加(保証案内・新入社員向け案内・ニュースレター)。
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
- **称号**: `TITLES` 配列でレベル閾値ごとに称号("みならい"→"600点スレイヤー"→…→"TOEICの神")。
  `titleForLevel()`。2026-07-29までは称号がレベル25「伝説の受験者」止まりで、以降レベル100まで
  ずっと同じ称号のままだった(ユーザーからレベル22到達時に「600点スレイヤーのまま」と指摘を受け発覚)。
  レベル30から100まで5レベル刻みで15称号を追加し、最終称号(レベル100「TOEICの神」)まで到達できるようにした
  (`scratchpad/titlecheck.js` で閾値の境界・重複無し・レベル100超も最終称号を維持することを検証)。
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

- **複数話者TTS**: `speakAs(text, speaker, rate)`。話者ごとに声を変える。`pickVoicesMW()` で男女に
  割り当てを試み、性別が名前から判定できない場合でも**せめて異なる声を2つ**確保する
  (2026-07-29の修正、詳細は下記「男女の声が両方とも同じに聞こえる問題」参照)。
  声が実質1種類しか確保できない場合のみピッチ差を大きく広げて区別する(`SPEAKER_PITCH`/`SPEAKER_PITCH_SAME_VOICE`)。
- **再生**: `playL34Audio()` が narrator の導入 → 各 `line` を話者音声で順に発話(`playToken` で割り込み/
  リプレイ制御、行間 320ms)。本番同様、会話/トークは**音声のみ**で画面に出さない。設問と選択肢は
  文字で表示(Part 3/4は設問・選択肢が問題冊子に印刷されている形式)。音声が使えない端末では
  `#listen34-transcript` にスクリプトを表示して読解形式にフォールバック。
- **エンジン**: `l34Section`(3/4)で `PART3`/`PART4`・`part3Stats`/`part4Stats` を切替。
  `buildL34Queue`/`renderL34Questions`/`gradeL34Set`/`finalizeL34Set`/`finishL34`。1セッション=2会話/2トーク(`L34_SET_SIZE`)。
- **出題フロー(2026-07-18に本番形式へ修正)**: 本番同様、**音声は1回だけ**流し、その会話/トークに対する
  **全設問(3問)を同時表示**する。1問ずつの即時採点はしない。ユーザーが全問を選んでから「答え合わせ」
  (`#listen34-check-btn`、全問未回答の間は disabled)を押すと `gradeL34Set()` がまとめて採点し、各設問に
  正誤・解説・スクリプトを表示する。選択状態は `l34Selections`/`l34Orders`/`l34Graded` で管理
  (以前の1問ずつ表示 `showL34Question`/`answerL34` は廃止)。
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

## セッション内演出層(手応え・緊張感・演出整理)(2026-07-19追加)

外側のゲーミフィケーション(ストリーク/ジェム/宝箱/週間クエスト等)は「明日も開かせる」ための層だが、
**解いている最中の手応えが薄い**という課題があった(選択肢ボタンが無反応、XPが見えない、コンボが
問題間で消える、進捗がテキストのみ、パーフェクトボーナスが懸かっていることが見えない、正解1問で
バナーが4〜5枚渋滞する等)。ユーザーが選んだ方向は「①手応えを厚く ②途中で途切れない緊張感を保つ
③演出の渋滞を整理する」の3点(意外性・ランダム性/即リトライは見送り)。**5モード(単語/文法/Part1-2/
Part3-4/Part6-7)で共通ヘルパー化**し、各ハンドラは1〜数行のフック呼び出しで済むようにしてある。

- **Phase 1: 手応え(juice)**: `:root` に `--ease-spring`(バネ曲線、バナーと同じ)/ `--dur-fast` /
  `--dur-base` を追加。`@keyframes` を5つ新設(`pop-correct`/`shake-wrong`/`xp-float`/`combo-bump`/
  `dot-pop`。以前はアプリ全体で `confetti-fall` の1つしかなかった)。`prefers-reduced-motion` ガードを
  アプリ全体に新設(以前は皆無)。`.choice-btn`/`.abc-btn` に `transition`+`:active` 縮小+正誤アニメを追加。
  共有ヘルパー `floatXp(anchorEl, amount, tone)`(押したボタン位置から `+NXP` が浮いて消える)と
  `renderComboChip(chipId, combo)`(常設コンボ表示、コンボが伸びるほど色が濃くなる)を新設し、
  `answerQuestion`/`answerListen`/`answerRead`/`answerCard`/`gradeL34Set` の全5箇所に配線。
  単語カードの「まだ」には新規 `seSoft()`(`seWrong()`の否定的な下降音ではなく、罰しない柔らかい音)を追加。
  Part 3/4は元々XP表示が皆無だったので、ここが一番の改善になっている。
- **Phase 2: 緊張感(結果ドット列)**: セッションヘッダに設問数分の `.qdots`(`● ● ○ ○ ...`)を追加。
  進捗バーの不在と「ノーミスが懸かっている」ことの不可視性を同時に解決する。共有ヘルパー
  `initQDots(containerId, total, trackPerfect)` / `markQDot(containerId, index, "hit"|"miss"|"soft")`。
  ノーミス継続中は `.qdots.perfect` でゴールドのグロー+「✨ノーミス継続中 +30XPボーナス」ラベルを表示
  (既存のパーフェクトボーナスを「懸かっているもの」として初めて可視化)。初ミスでグローが割れて消え、
  新規 `seBreak()`(`seWrong()`とは別の、一段低い「途切れた」音)が鳴る。単語モードは自己採点のため
  `trackPerfect=false` で「まだ」を `.soft`(中間色、ノーミス判定対象外)として扱い、正直な自己申告を
  罰しない。Part 3/4は `gradeL34Set()` のバッチ採点内で複数ドットを120msずつずらして順に確定させる。
- **Phase 3: 演出の渋滞を整理**: `sessionActive`(各`start*()`でtrue、各`finish*()`の冒頭でfalse)と
  `queueCelebration(fn)`/`flushCelebrations()` を新設。`sessionActive` が true の間は `showBanner()`/
  `confetti()`/`seLevelUp()` の呼び出しを `pendingCelebrations` に積むだけにして**セッション中は演出を
  出さない**(state変更=XP/ジェム/バッジ付与は従来通り即時)。`finish*()` で `flushCelebrations()` を呼び、
  溜まった演出を `300 + i*650` msずつずらして順番に再生する。ラップ対象は `celebrateLevelUp`/`checkBadges`/
  `checkDailyChallenges`のデイリー達成/`openChest`/`checkWeeklyQuests`/`checkMonthlyBadge`/
  `checkStreakMilestones`/`touchStreak`のお守り消費/`maybeCelebrateGoal` の9箇所。`sessionActive` が
  false のとき(ホームタブ等セッション外、および `smoke.js`/`testB.js` が `touchStreak()` 等を直接呼ぶ
  回帰テスト)は従来通り即時発火にフォールバックするため、**既存の挙動・既存テストは無変更**。
- 検証: `scratchpad/phase1check.js`/`phase1flow.js`(手応え)、`scratchpad/phase2check.js`/`phase2perfect.js`
  (ドット列)、`scratchpad/phase3check.js`(セッション中の演出抑制/`finish*`後の順次再生/セッション外の
  即時フォールバックの11ケース、全PASS)、`scratchpad/fullflow.js`(5モード通しでコンソールエラー0件を確認)。
  既存の `smoke.js`(11件)/`testB.js`(12件)も無変更で全PASSを再確認済み。
- `sw.js` の `CACHE_NAME` は `v37` にインクリメント済み。

## UIの質感(デザイントークン層)と結果画面(2026-07-27追加)

「もっとリッチなUIに」という要望を受けた見た目の作り込み。**ダークモードは見送り、配色は既存の
落ち着いた青系を維持**(既存ユーザーが違和感なく使えることを優先)。全ファイル監査で分かった問題は、
影が1種類(`0 1px 4px` の10%でほぼ見えない)・スケールが1つも無い(font-size 20種、border の灰色
約10種、角丸14種がハードコード)・**hover/focus/focus-visible が1129行に1つも無い**・主CTAの
`.big-btn` に影もグラデも transition も無い、というもの。唯一 `.streak-hero` だけがグラデ+色付き
シャドウを持ち、到達すべき品質の基準を示していた。

### Phase A: 土台の質感(全画面が底上げされる低リスクな層)

- **`:root` にトークンを追加**(既存22トークンは**一切消していない**)。影は ambient+direct の
  2枚重ねで段階化(`--shadow-sm/-md/-lg/-accent/-inset`)。`--shadow` は既存参照を壊さないよう
  **`--shadow-sm` のエイリアスとして残してある**。ほかに `--line`/`--line-soft`(従来ハードコード
  されていた約10種の灰色)、`--gold`/`--gold-deep`/`--gold-soft`、`--sp-1..6`、`--r-sm/-md/-lg/-pill`、
  `--fs-xs..-hero`、`--ease-out`、`--dur-slow`。
  - **既存117箇所の font-size は意図的に書き換えていない**。全置換は視覚差が小さい割にリグレッション面が
    広いため、新規コードと今回触った要素だけスケールに乗せた。残りは今後の漸進的な置換に回す方針。
- `.card` / `.flashcard` を `--shadow-md`、`dialog` を `--shadow-lg` に。
- **画面遷移のフェード** `@keyframes page-in` + `.tab-page:not(.hidden)` と5つの結果 div に適用。
  `showTab()` は `.hidden` を付け外しして `display:none→block` にするだけなので、**JS を一切変更せずに**
  切り替えのたびに再生される。3行で体感が最も変わった部分。
- `.big-btn` にグラデーション+`--shadow-accent`+`transition`、`:active` を「沈む」動き
  (`translateY(1px) scale(.985)`)に。`.fc-btn`/`.replay-btn`/`.word-speak-btn`/`.primary-btn` は
  **`:active` の縮小はあるのに transition が無くカクついていた**ので transition を補完。
- **`:focus-visible` を新設**(従来アプリ全体に focus 系の指定が皆無だった。アクセシビリティの穴の解消)。
- プログレスバー7種(`.goal-bar`/`.level-bar`/`.ta-timer`/`.coverage-bar`/`.acc-bar`/`.league-bar`/
  `.mini-bar`)にトラックの内側影とフィルの光沢を**共通で**付与。フィルは `background` を上書きすると
  グラデ指定のバーが潰れるため、`background-image` ではなく `inset` の白ハイライトで光沢を出している。
  `.acc-bar-fill` だけ他と違い `transition` が無かったのも合わせた。
- タブバーはヘアラインを上向きの淡い影に替え、色変化とアイコンにトランジション(構造・色分けは今回スコープ外)。

### Phase B: 結果画面を主役に

結果画面は5モードで markup が完全に同一だったため、**1コンポーネントの作り替えが5画面すべてに効く**。
従来は「絵文字+タイトル+3行テキスト」だけで画面の2/3が空白。しかも `flushCelebrations()` が全ての
祝賀を流し込む**アプリ最大の見せ場**として設計した場所で、pct・正誤数・ティア・XP・(読解は)所要時間と
ペースまで**すでに全部計算済み**なのに文字列連結に捨てられていた。

- **共有ビルダー `renderResult(mode, o)`** を新設し、5つの `finish*()` から呼ぶ。
  4箇所に重複していたティア判定は `resultTier(pct, lowTitle, lowEmoji)` に集約。
- **スコアリング**: `conic-gradient(var(--ring-c) calc(var(--pct) * 1%), ...)` のドーナツ。
  `--pct` は `@property` 無しでは transition できないので `animateValue()` が **rAF で 0→目標値を
  700ms かけて駆動**(全ブラウザ互換)。ティア色は 100%=金 / ≥80%=緑 / ≥60%=青 / それ未満=グレー。
- **XPカウントアップ**: 獲得XPタイルだけ同じカーブで `+0 → +N` を数え上げる。
- **振り返りドット**: `#<mode>-qdots .qdot` の `.hit/.miss/.soft` を読んで結果カードに再描画する。
  セッション中のドット列がそのまま記録として DOM に残っているので、**新しい状態管理はゼロ**。
  「どの問題を落としたか」が初めて可視化された。
- **スタットタイル**: 獲得XP(金)/正解数、読解のみ所要時間とペースを追加(文章に埋もれていた値の昇格)。
- **パーフェクト**: `.result-card.perfect` で金の枠と淡い光。既存の `confetti()` はそのまま。
- **`prefers-reduced-motion`**: CSS のガードは transition/animation しか止められず **rAF は止まらない**ため、
  `reduceMotion()` で判定して**アニメせず最終値を即セット**する分岐を JS 側に入れてある。
- **単語モードだけ意図的に別扱い**: 自己採点モードなので、これまでの設計判断(コンボを付けない・
  `trackPerfect=false`・「まだ」は `.miss` ではなく `.soft`)と揃え、**ティア判定もパーフェクト演出も
  適用しない**。リングは「覚えた 15/20」の中立的な進捗として出す(正直に「まだ」を押して損をする構造を
  作らないため)。これで単語だけ絵文字もタイトルも静的だった浮いた状態も解消された。
- 検証: `scratchpad/uicheck.js`(27件・5モードの結果描画/リング到達/XP一致/振り返りドットの内訳一致/
  パーフェクト/単語の中立扱い/reduced-motion、全PASS)。既存の `smoke.js`(11)・`testB.js`(12)・
  `phase3check.js`(11)・`fullflow.js`(6)も**無変更で全PASS**を再確認済み。
- `sw.js` の `CACHE_NAME` は `v38` にインクリメント済み。

## ユーザー提供デザインプロトタイプの実装(ホーム刷新+全体の質感統一)(2026-07-27追加)

ユーザーが Claude Design で作成した3案(現行UI再現・ホーム3方向のリッチ案1a/1b/1c・1cベースの
全画面インタラクティブプロトタイプ)を受け取り、「TOEIC600 プロトタイプ.dc.html」を実装した。
このプロトタイプは `WORDS`/`QUESTIONS`/`PART2`/`READQS` を数件だけ手書きしたデモ用データで動く
「見た目のリファレンス」であり、実アプリの機能(週間クエスト・月間バッジ・qdots・コンボチップ・
演出キュー・Part1/3/4/6・設定ダイアログ)を一切知らない。**プロトタイプの視覚言語を、既存の全機能を
保持したまま本物のデータ/ロジックの上に着せ替える**方針で進めた。既存のid/classは一切リネーム・
削除せず(回帰テスト67件が特定のidに依存しているため)、周囲の構造とCSSだけを差し替えている。

- **Manrope フォントは採用しなかった**: 当初 Google Fonts の `<link>` を追加する計画だったが、
  実装後に Playwright で計測したところ `page.goto()` の完了(load イベント)が**約13秒**かかる
  ようになった(通常は100〜150ms)。`font-display:swap` があってもブラウザは外部フォントの
  読み込み結果を待ってから `load` を発火するため、低速・不安定なネットワークでは体感の初回表示が
  悪化するリスクがあると判断し、**この場で方針を撤回**。数字の質感は `--font-display: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', ...` という
  **OS標準フォントのみのスタック**で表現することにした(ネットワーク依存ゼロを維持)。
  推定スコア・XP・レベル・連続日数などの数字要素に適用済み。
- **oklch() 色は使わず、既存のトークン体系に寄せた**: プロトタイプの淡色チップ類は
  `--gold-soft`/`--ok-light` 等の既存 `-light` トークンをそのまま流用し、無いものだけ
  `--quiz-light`/`--read-light` を新設。ブラウザ互換性の不確実性を避け、一貫性も保てる。
- **`.app-header`(TOEIC 600 + ⚙️)は構造そのまま維持**: プロトタイプには設定を開く手段が
  存在しないため、削除するとバックアップ機能へのアクセスも失われる。直下に新しい紺グラデの
  ヒーローカードを積む構成にした(以前の「青ヘッダー→オレンジのstreak-hero」と同じ積み重ね)。
- **ホームの刷新**: `.streak-hero`(オレンジ単色)→ 紺グラデの `.hero-card` に。試験日カウントダウン
  (`.countdown-card`)はヒーロー内に統合して単独カードを廃止。推定スコアカードに Phase B と同じ
  `.score-ring`(conic-gradient)コンポーネントを新規 `#home-score-ring` として追加し、`renderScore()`
  に `animateValue()` でのリング描画を数行追加(結果画面と同じヘルパーの再利用、新規ロジックなし)。
  「今日のノルマ」(4行リスト)とホーム下部の4連ボタンを、タップで各タブへ遷移する `.mode-grid`
  (4列ミニカード)+ 新規 `weakestGoal()` による動的CTAボタン(未達成のうち優先度が最も高い1つに
  絞って文言と遷移先を変える)に統合。ゴーストリーグは紺色の `.league-card`(`@keyframes shine` で
  光の帯が流れる)に独立。**週間クエスト(`#weekly-list`)と月間バッジミニ(`#monthly-mini`)は
  プロトタイプに存在しないが機能保持のため削除せず**、デイリーチャレンジの下にそのまま残した。
- **アイコン基盤**: `app.js` 冒頭に `ICONS`(プロトタイプの実際の `<path>` 座標をそのまま使った
  線画SVGの文字列マップ)と `svgIcon(name, size, extra)` ヘルパーを新設。タブバー6種の絵文字を
  インラインSVGに置き換え(`.tab-icon svg { }` + 既存の `.tab-btn.active{color}` の継承だけで
  アクティブ色と連動)。ホームの炎・フリーズ・ジェム・診断(的)・リーグ(トロフィー)アイコンにも適用。
  記録タブのバッジ絵文字・デイリーチャレンジの✅⬜等、上記以外の絵文字は今回のスコープ外で未着手
  (将来やるなら次はここ)。
- **選択肢ボタンに文字タグを追加**: 文法・読解・Part3/4の `.choice-btn` は従来
  `btn.textContent = "(A) 選択肢"` と1本の文字列だったが、`<span class="choice-tag">A</span>` +
  テキストの2要素に分割(`showQuestion()`/`showReadQuestion()`/`renderL34Questions()`の3箇所)。
  正誤判定・クリックハンドラは `btn.dataset.orig` にのみ依存しており textContent 構造とは無関係
  なので安全に変更できた。Part1/2 の `.abc-btn` は元々大きな文字だけのボタンで構造が一致するため
  変更不要。
- **カード形状の統一**: `--radius` を14px→18pxに、`.card`/`.flashcard` に `1px solid var(--line-soft)`
  の枠線を追加。プロトタイプの22-24px角丸+薄枠の質感に寄せた。
- 検証: `scratchpad/designcheck.js`(17件・ヒーロー/リング/ミニカード遷移/動的CTA/設定ダイアログ/
  ショップダイアログ/タブバーSVG、全PASS)。既存の `smoke.js`(11)・`testB.js`(12)・
  `phase3check.js`(11)・`fullflow.js`(6)・`uicheck.js`(27)も**無変更で全PASS**(計84件)。
- `sw.js` の `CACHE_NAME` は `v39` にインクリメント済み。

## 単語・文法を本試験レベルに近づける(既存プールに難度を混ぜる)(2026-07-28追加)

ユーザーから「600点目標だから本試験より簡易な問題を作っていないか」と質問され、調査の結果
`WORDS`(当時312語)・`QUESTIONS`(当時300問)は**意図的に**「中級〜600点レベル」に絞って作られており、
文法は仮定法・倒置・分詞構文などの上級カテゴリが**一切存在しない**ことが判明した。本番TOEICは
600点狙いでも自分のレベル以上の問題に必ず遭遇する一発勝負の試験のため、「本試験に近い設問も
作ってほしい」という依頼を受けた。

- **反映方法**: 学習フロー(タブ構成・SRSロジック)は一切変えず、既存のSRSプールに難しめの項目を
  混ぜる方式を選択(「応用」タブとして別管理する案もあったが、本番同様どのレベルの受験者も
  難しい問題に混ざって遭遇するのが実態に近いため)。難易度を表すための新フィールドは追加していない
  (既存データに無いフィールドを足すと全既存データの移行が必要になりリスクが高いため、内容そのもの
  =語彙の頻度帯・文法項目の高度さで難度を表現している)。
- **単語+50語**(`WORDS` 312→362): TOEIC 700-900レベルのビジネス頻出語彙
  (allocate/streamline/consolidate/discrepancy/feasible/indispensable/meticulous/plausible/
  notwithstanding 等)。既存312語との重複が無いことをプログラムで検証済み。
- **文法+50問**(`QUESTIONS` 300→350): 従来ゼロだった3カテゴリを新設。
  - `t:"仮定法"`(20問): If S were/had+過去分詞、if省略の倒置形(Were S to.../Had S+p.p./Should S...)、
    It is essential/important that S (should)+原形、suggest/demand/recommend等のmandative subjunctive、
    wish+仮定法過去/過去完了、混合仮定法
  - `t:"倒置"`(15問): Not only...but also、Rarely/Seldom/Never+倒置、Only when/after/by+倒置、
    So+形容詞+that倒置、Under no circumstances、No sooner...than
  - `t:"分詞構文"`(15問): Having+p.p.の完了分詞構文、Given that.../Concerned about...などの慣用表現、
    with+名詞+分詞の付帯状況構文、Weather permittingのような独立分詞構文
- 選択肢は`showQuestion()`で表示時に必ずシャッフルされる(既存の設計を再確認済み)ため、新規50問の
  `a`(正解インデックス)の位置は既存データと同様に厳密な分散を意識していない。
- 検証: `scratchpad/verify_words_grammar.js`(9件・件数確認/単語カード完走/文法クイズ完走/新規項目の
  出題キュー統合`buildWordQueue`/`buildQuizQueue`/新カテゴリの画面表示、全PASS)。既存回帰92件
  (smoke/testB/phase3check/fullflow/uicheck/designcheck/verify_p67)も**無変更で全PASS**(計101件)。
- `sw.js` の `CACHE_NAME` は `v41` にインクリメント済み。

## コンテンツ追加時の批判的再チェック(ルール化)(2026-07-29追加)

上記の単語・文法追加の直後、ユーザーから「問題作成は十分sonnetで対応できる範疇か」と問われ、
「件数・重複・スキーマ・実機での出題/表示という**構造面**は検証済みだが、英文の自然さ・和訳の正確さ・
解説の論理性・誤答選択肢の妥当性といった**内容面**は下書きAgentの自己申告と自分の目視チェック止まりで、
独立した批判的レビューは行っていない」と正直に回答した。ユーザーはこれを受け、今後コンテンツ
(単語・文法・リスニング・読解など)を追加する際は**生成後に別パスで内容を批判的に再チェックする**ことを
恒久的な運用ルールにするよう指示した。

**今後のコンテンツ追加は必ず以下の手順を踏む(既存の検証を置き換えるのではなく、その前段に追加する)**:

1. 下書き(Agentで生成、重複除外リストなど既存の指示パターンを踏襲)
2. 構造検証(件数・重複・スキーマ、既存踏襲)
3. **批判的再チェック(新規追加ステップ)**: 下書きを行ったAgentとは独立した視点で、項目を1件ずつ
   以下の観点でレビューし、疑わしい項目は具体的に指摘して修正する。
   - 英文として不自然でないか(文法的に正しいか、TOEICらしい文体か)
   - 和訳(`jq`/`m`)が正確か、解説(`x`)が論理的に正しいか
   - 誤答選択肢が本当に紛らわしく、かつ確実に不正解であるか(正解が一意に定まるか)
   - 単語・文法項目として事実誤認がないか、想定したレベル感(600点〜上級)に見合っているか
   - レビュー結果(指摘件数・修正した項目)を簡潔に報告する
4. `data.js` へ統合
5. 実機Playwright検証(出題キューに乗る・画面表示、既存踏襲)
6. 既存回帰スイート再実行(既存踏襲)
7. `sw.js` キャッシュバージョン更新・`CLAUDE.md`/`README.md` 更新・コミット(既存踏襲)

### 初回適用の実績: Part 6/7追加(2026-07-29)

このルールを最初に適用した回。**批判的再チェックで実際に5件の欠陥を発見・修正した**ので、
どんな欠陥が出やすいかの実例として残す(構造チェックだけでは1件も検出できなかった)。

| # | 箇所                        | 問題                                                                                                                       | 修正                                                                                             |
| - | --------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1 | Part6 保証案内 Q2           | 誤答の`that` が文法的に成立してしまう(`determine that ...` は正しい英語)。正解が一意でない                             | 誤答を`unless` に差し替え                                                                      |
| 2 | Part6 新入社員 Q4           | 正解`settling` に対し誤答 `settled` も成立(`be settled into a role` は自然な英語)                                    | 設問ごと差し替え(主語`your first weeks` の主述一致 `go`/`goes` を問う形へ)                 |
| 3 | Part6 ニュースレター Q2     | 誤答`accommodating` が分詞構文として成立しうる                                                                           | 節が続く形に本文を変え、`so that` / `in order to` / `because of` / `due to` の識別問題へ |
| 4 | Part7 ダブルパッセージ 本文 | 「受付は各回の**1週間前**に締切」と3月6日のメールが矛盾(3月11日回の受付は既に終了しているのに申し込みを相談している) | 締切を「2日前」に変更して整合させた                                                              |
| 5 | Part7 ダブルパッセージ Q3   | 「今週入会した」が3月6日時点では3月4日を含みうるため、非会員だったかが確定せず正解が一意でない                             | 「昨日入会した」に変更。誤答も本文から算出できる金額($105=4回一括割引後、$140=割引前)に差し替え  |

**教訓**: Part 5/6形式の文法問題では、**誤答が「文脈上不自然」なだけでは不十分で、
「文法的に成立しない」ところまで詰める**必要がある(#1〜#3はいずれもこのパターン)。
また複数文書問題では、**日付・締切・金額の整合性を必ず突き合わせる**(#4・#5)。

- 検証: `scratchpad/verify_p67_v2.js`(10件・件数/新規項目の出題キュー統合/Part6の空所ラベル置換/
  チャット形式の描画/ダブルパッセージ2文書の描画/セッション完走)。既存回帰142件も全PASS(計152件)。
  なお `verify_p67.js` の件数アサーション(9長文・16セット)はデータ規模の変更に伴い12長文・19セットへ更新した。
- `sw.js` の `CACHE_NAME` を `v46` にインクリメント済み。

## 音声(TTS)

`speechSynthesis`(ブラウザ内蔵、無料・オフライン)を使用。

- リスニング(Part1/Part2)の質問・選択肢読み上げ: `playListenAudio()`
- 単語カードの自動読み上げ+🔊ボタン: `speakWord()`(設定 `autoSpeak` でON/OFF)
- iOS Safari対策として、各モード開始ボタンの直下で空発話を1回鳴らして音声をアンロックしている
  (`audioStarted` フラグで、リスニング未使用ならTTSに一切触れないようにもしてある)

### 再生前後の待ち時間を短縮(2026-08-12追加)

ユーザーから「音声が始まるまでの間が長い」と指摘され、`playListenAudio()`(Part1/2)・
`playL34Audio()`(Part3/4)内に埋め込まれていた明示的な `wait()` を、自然な会話のポーズ
(発話ターン間は概ね200〜500msが目安)に近づける形で短縮した。名前付き定数化して今後の
再調整を容易にしてある(`SAFETY_WAIT=100`/`PRE_CHOICE_WAIT=450`/`BETWEEN_CHOICE_WAIT=350`/
`POST_NARRATOR_WAIT=400`/`BETWEEN_LINE_WAIT=300`、いずれもapp.js冒頭の`wait()`定義直後)。
再生順序・キャンセル制御・TTSフォールバックのロジックは変更していない。
併せて `sw.js` の `CACHE_NAME` を `v54` にインクリメント済み。

### Part 1の音声を事前生成ファイルに置き換え(2026-08-07、パイロット導入)

端末内蔵TTS任せだと、声質・アクセントが完全に端末依存という課題があった
(男女の声が同じに聞こえる問題の根本原因もこれ)。Part 1(写真描写、16問)は
選択肢の英文が固定コンテンツなので、**事前に音声ファイル化してリポジトリに同梱**する方式に
切り替えた(サーバー不要・静的ホスティングの設計方針は維持。音声ファイルもSVGアイコンと
同じ扱いの静的アセット)。

- **生成手段**: `edge-tts`(正確にはnpmの`msedge-tts`パッケージ)。Microsoft Edge/PowerPointが
  内部で使っている無料のオンラインTTSをAPIキー無しで叩けるOSSラッパー。**完全無料・クレジット制限なし**で、
  かつ声ごとにアクセントが明示されている(`en-US-GuyNeural`/`en-GB-RyanNeural`等)ため、
  Web Speech APIの端末依存な声選び(`pickVoicesMW()`の名前ヒューリスティック)と違い、
  米・英のアクセントを確実に作り分けられる。
  - 検討した他の手段: (1) クラウドTTS APIをアプリから直接呼ぶ→サーバー不要の設計方針と矛盾し課金も発生するため却下。
    (2) Higgsfield MCPの`generate_audio`→初期パイロットで64クリップ中43クリップまで生成したところで
    無料クレジットが尽きて中断(`Out of credits on free (null) plan`)。生成し直しが必要になったため、
    完全無料のedge-ttsに切り替えて全64クリップを生成し直した(Higgsfield生成分は破棄)。
- **生成スクリプト**: リポジトリには含めていない(一回限りの生成作業のため)。`npm install msedge-tts`した上で
  `MsEdgeTTS.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)` → `toFile()`で
  `toeic/audio/part1/q{問題番号}_{a|b|c|d}.mp3`として書き出した。声は4種を問題ごとにローテーション
  (Q1,5,9,13=`en-US-GuyNeural`、Q2,6,10,14=`en-US-JennyNeural`、Q3,7,11,15=`en-GB-RyanNeural`、
  Q4,8,12,16=`en-GB-SoniaNeural`)。1問内のA〜D選択肢は本番同様に同じ声。合計64ファイルで約1.1MB。
- **データ**: `data.js`の`PART1`各要素に`r`と対応する`audio: ["q1_a.mp3", ...]`を追加
  (`r`と同じ並び=シャッフル前の原順。表示時にシャッフルされる`listenOrder`はaudio参照時にも
  同じマッピングで使う)。
- **再生ロジック**: `playListenAudio()`(app.js)内、選択肢の読み上げ部分で`item.audio`があれば
  新設の`playAudioFile(src, token, rate, tokenGetter)`(`<audio>`要素で再生、`tokenGetter`で参照する
  トークンによる中断制御をspeak()と揃えている。`tokenGetter`省略時は割り込み無しの単発再生)
  を使い、無ければ従来通り`speak()`(TTS)にフォールバックする。当初は"Look at the picture."と
  A〜Dのラベル読みがスコープ外で従来通りTTSのままだったが、2026-08-08に
  `audio/common/look_at_the_picture.mp3`・`label_a〜d.mp3`(いずれも`en-US-GuyNeural`、
  Part1/2共通でラベル読み上げに使い回す)を追加生成し、Part1の音声を完全にTTS非依存にした。
- **PWAキャッシュ**: 導入当初は`sw.js`の`ASSETS`に`audio/part1/*.mp3`を全64件プリキャッシュしていたが、
  Part 2〜4展開(下記)に伴い**ランタイムキャッシュ方式に変更**したため、現在この個別列挙は無い。

### 再生速度調整+文単位リピート(2026-08-07追加、「聞き取れない/集中が続かない」対策)

ユーザーから「リスニングの苦手意識が解消されない」と相談された。掘り下げると
①そもそも聞き取れない(音の分解ができていない)、②集中が続かない(受け身で聞くだけで疲れる)
の2つが根っこで、両方に効く共通の打ち手として以下を実装した(ディクテーション機能は見送り)。

- **再生速度設定**(`state.settings.speedMultiplier`、既定1.0、設定ダイアログの`#speed-input`
  レンジスライダー 0.7〜1.15倍): 全ての読み上げ・音声ファイル再生で
  「実際のレート = そのコンテキストの基準レート × speedMultiplier」で統一。新設の`spd(rate)`ヘルパーが
  この掛け算を担う。`speak()`/`speakAs()`の`u.rate`、`playAudioFile()`の`audio.playbackRate`に適用。
  `playListenAudio()`/`playL34Audio()`など呼び出し側は変更不要(関数内部で自動的に反映される)。
- **文単位リピート**: 答え合わせ後のスクリプト表示に「🔁」ボタンを追加
  (`makeReplayBtn()`で生成、Part1/2は`answerListen()`内の`.script-line`、Part3/4は
  `renderL34Script()`内の各`line`)。押すと`replayScriptLine()`が固定0.75倍速(`REPLAY_RATE`、
  これも`speedMultiplier`とさらに掛け合わさる)でその1文だけを再生し直す。音声ファイルがあれば
  それを、無ければTTS(Part3/4は`speakAs(text, speaker, 0.75)`で話者の声も維持)にフォールバックする
  (当初はPart1のみ音声ファイルがあったが、下記の通りPart2〜4にも展開済み)。
  セッション中の`playToken`とは独立した`reviewPlayToken`で連打時の割り込みを制御している。
- `speakAs()`に`rate`が明示指定された場合は、話者を聞き分けるための`SPEAKER_RATE_SAME_VOICE`
  テーブルより優先されるよう変更(1文だけの復習再生では聞き分けより指定速度を優先すべきため)。

### Part 2〜4への音声ファイル展開(2026-08-08追加)

Part 1パイロットの効果を確認できたため、残るPart 2(応答問題)・Part 3(会話)・Part 4(トーク)にも
同じ方式(事前生成mp3を同梱、端末TTSはフォールバックのみ)を展開した。

- **生成規模**: 合計710クリップ(Part2: 124問×(質問1+応答3)=496、Part3: 20会話・137発話+
  ナレーター1、Part4: 15トーク・75発話+ナレーター1)。Part1の64クリップと合わせて`audio/`配下は
  約19MB。
- **声の割り当て**(Part1と同じ4声で統一、`en-US-GuyNeural`/`en-US-JennyNeural`/
  `en-GB-RyanNeural`/`en-GB-SoniaNeural`):
  - **Part2**: 問題ごとに「質問の声」と「応答3つの声」のペアをローテーション
    (Guy⇄Jenny、Ryan⇄Sonia の組み合わせを4問周期で入れ替え)。本番同様、質問と応答で
    話者が変わる体裁にした。
  - **Part3/4**: 既存の話者コード`s`(M/W/M2/W2)をそのまま声にマッピング
    (M→Guy、W→Jenny、M2→Ryan、W2→Sonia)。Part4は`s`がM/Wのみなので実質Guy/Jennyの
    交互になるが、既存のピッチ差ロジック(`SPEAKER_PITCH`等)と役割が食い合わないよう
    音声ファイル優先・TTSはフォールバックのみに留めている。
  - ナレーターの導入文("Listen to the following conversation."/"...talk.")もそれぞれ
    `audio/part3/narrator.mp3`・`audio/part4/narrator.mp3`として1つずつ事前生成。
- **データ**: `PART2`各要素に`qAudio`(質問1件)と`audio`(応答3件、`r`と同じ並び)を追加。
  `PART3`/`PART4`の各`lines[i]`に`audio`を追加(会話n・行iなら`c{n}_l{i}.mp3`、
  トークは`t{n}_l{i}.mp3`)。挿入は正規表現による機械的なテキスト差し込みで行った
  (`data.js`がCRLF改行のため、`$`アンカーを使う正規表現は`\r?$`にしないと1件もマッチしない
  落とし穴があった。原因究明にやや時間を要したので次回同種の作業をする際の教訓として残す)。
- **再生ロジック**: `playListenAudio()`は`listenMode`から`audio/part${listenMode}/`を導出し、
  Part2では`item.qAudio`を質問読み上げに使うよう拡張(Part1は`qAudio`を持たないため
  従来通り"Look at the picture."のTTSのまま)。`playL34Audio()`は`l34Section`から
  `audio/part${l34Section}/`を導出し、ナレーター・各`line`とも音声ファイルを優先、
  無ければ`speakAs()`にフォールバックする。
- **文単位リピートへの反映**: `answerListen()`は質問行(`.script-q`)にも🔁ボタンを追加した
  (Part2のみ`item.jq`があるため実質Part2向け)。`renderL34Script()`も`line.audio`を
  `makeReplayBtn()`に渡すよう変更済み。
- **PWAキャッシュ戦略の変更**: 700件超をsw.jsの`ASSETS`に列挙すると
  インストール時に一括フェッチされ初回起動が重くなる(十数MBを一度に取得)ため、
  **音声ファイルだけランタイムキャッシュ方式に変更**した。`fetch`イベントで
  URLに`/audio/`を含む場合だけ「キャッシュになければ取得してキャッシュに保存」という
  遅延キャッシュにし、`ASSETS`からは音声の個別列挙を全て削除(Part1の64件も含めて)。
  初回再生時に多少ネットワークが必要になる代わりに、sw.js自体は簡潔なまま保てる。
  2回目以降の再生・オフライン再生は自動的にキャッシュから返るようになる。
- **生成スクリプト**: Part1同様リポジトリには含めていない(一回限りの生成作業のため)。

### 男女の声が両方とも同じに聞こえる問題(2026-07-29修正)

ユーザーから「Part 3/4でMとWの声が両方とも女性の声に聞こえる」と報告された。

- **原因**: `pickVoicesMW()` は端末の音声一覧を名前(`zira`/`samantha`/`male`等)でマッチして男女に
  割り当てていたが、**名前から性別が判定できない環境では男女とも同一のフォールバック音声**
  (`pickVoice()`)を使い、ピッチ差(旧: M=0.82x/W=1.28x)だけで区別していた。この程度のピッチ差は
  同一音声の声質そのものを変えるほどではなく、「両方とも同じ声(=既定でよくある女性寄りの声)」に
  聞こえてしまっていた。代表例: Chromeで「Google US English」(性別名なし)しか入っておらず
  「Google UK English Male」が使えない環境、Android等で音声名が汎用的("English (America)"等)な環境。
- **修正**: `pickVoicesMW()` に、性別を名前から判定できない場合の**フォールバックとして
  「せめて異なる声を2つ確保する」**処理を追加(`m`/`w`が同一 or 見つからない場合、一覧から
  お互いに異なる音声を探して割り当てる)。返り値に `distinct`(実際に異なる音声を確保できたか)を
  追加。`speakAs()` は `distinct` に応じてピッチテーブルを切り替える:
  - 異なる声を確保できた場合(`SPEAKER_PITCH`): 声質自体が違うので控えめな差(W=1.22/W2=1.4/M=0.85/M2=0.72)
  - 声が実質1種類しか無い場合(`SPEAKER_PITCH_SAME_VOICE`): ピッチだけが頼りなので大きく広げる
    (W=1.55/W2=1.75/M=0.55/M2=0.4)
- 女性名マッチ(`aria`/`jenny`/`michelle`等)・男性名マッチ(`ryan`/`davis`/`andrew`等)のパターンも
  Microsoft/Google系の音声名を追加してカバー範囲を広げた。
- **検証の限界**: このサンドボックス環境の Playwright(Chromium)は `speechSynthesis.getVoices()` が
  常に空配列を返すため、実音声での聞き比べは検証できない。`scratchpad/voicegender.js` で
  `speechSynthesis.getVoices` を差し替えて複数シナリオを模擬し、`pickVoicesMW()` のロジック
  (distinct判定・フォールバック割り当て)とピッチテーブルの選択が正しいことを確認している。

#### 追記: 上記修正直後、iPhoneで「男性の声がブツブツ潰れた音に聞こえる」と報告(2026-07-29)

上の修正で入れた同一音声フォールバック用ピッチ(M=0.55/M2=0.4)が**極端すぎた**ことが原因と判明。
iOSのcompact品質ボイス(Samantha等)はピッチを大きく下げるとエンジンが追従できず、音質が
崩れる(「ブツブツ」というクラックル/ロボット風のノイズが乗る)。また、旧来の性別マッチ用
正規表現に含めていた`fred`は、実はAppleの**ノベルティ(わざと壊れた音質にしたジョーク)ボイス**の
名前で、これが「異なる声」として選ばれてしまうと常時ブツブツした声になる。

- ピッチの再調整: `SPEAKER_PITCH_SAME_VOICE` を `W:1.55/W2:1.75/M:0.55/M2:0.4` → `W:1.35/W2:1.5/M:0.78/M2:0.68`
  に緩和(iOSのcompactボイスで歪みが出ない範囲に収める)。ピッチだけに頼らず、同一音声フォールバック時は
  **レートにも差**をつけて聞き分けを補う(`SPEAKER_RATE_SAME_VOICE`: W=1.05/W2=1.1/M=0.85/M2=0.78)。
- `NOVELTY_VOICE_RE`(`fred`/`albert`/`bahh`/`zarvox`等、Appleのノベルティボイス名の一覧)を新設し、
  `pickVoicesMW()` の音声候補一覧から**性別マッチ・フォールバック双方について完全に除外**する
  (「違う声ではあるが壊れた音質」を選んでしまわないように)。
- `scratchpad/voicegender.js` にケースを追加(計10件): Fredが男性候補として選ばれないこと、
  同一音声フォールバックのピッチが歪みの出にくい範囲(M/M2 >= 0.6、W/W2 <= 1.6)に収まっていること、
  レート差が併用されていることを確認。既存回帰101件も無変更で全PASS(計109件)。
- `sw.js` の `CACHE_NAME` を `v43` にインクリメント済み。

#### 真の原因: 性別判定の正規表現の部分文字列マッチ(2026-07-29に確定)

さらにその後「男性の声が女性に戻った」と報告され、ようやく**3回の症状すべてに共通する根本原因**が判明した。
性別判定の正規表現に単語境界(`\b`)が無く、**部分文字列でマッチしていた**:

| 音声名         | 誤マッチしたトークン | 結果                                     |
| -------------- | -------------------- | ---------------------------------------- |
| `Sa(man)tha` | `man`              | 女性ボイスが**男性**として選ばれる |
| `fe(male)`   | `male`             | 同上                                     |
| `wo(man)`    | `man`              | 同上                                     |

iOSは**同じ声を品質違いで複数返す**(`Samantha` が2つ以上並ぶ)ため、
`w` = 1つ目のSamantha、`m` = 2つ目のSamantha(`man`でマッチ)という割り当てが成立してしまい、
これが3つの症状すべてを一貫して説明する:

1. 「男女とも女性の声」→ mもwも実体はSamantha
2. 「男性がブツブツ潰れる」→ `m.name === w.name` なので `distinct=false` と判定され、
   同一音声用の極端なピッチ(当時 M=0.55)が適用されて音質が破綻
3. 「男性の声が女性に戻った」→ ピッチを0.78に緩めたので歪みは消えたが、
   中身は依然Samantha(女性)のまま

**修正**:

- `FEMALE_VOICE_RE`/`MALE_VOICE_RE` を新設し、**全トークンに `\b` を付与**。
  `\bman\b` は "Samantha" にマッチせず、`\bmale\b` は "female" にマッチしない。
- `isMaleVoiceName()` は「女性名に一致するものは男性候補にしない」という二重防止を入れている。
- `pickVoicesMW()` で**音声名の重複を除去**(iOSの品質違い重複対策)。
- **設定に手動の声選択を追加**(`state.settings.voiceM`/`voiceW`、`renderVoicePickers()`/`testVoice()`)。
  端末ごとの当たり外れを利用者自身が直せるようにした。自動判定より優先され、
  存在しない声を指定した場合は自動判定へフォールバックする。保存時に `voiceMW = null` でキャッシュ破棄。
- 検証: `scratchpad/voicegender.js`(17件・部分一致バグの回帰、iOS想定の声一覧、手動指定の優先)と
  `scratchpad/voiceui.js`(11件・プルダウンの生成/重複除去/ノベルティ除外/保存/永続化)。
  既存回帰114件も無変更で全PASS(計142件)。
- `sw.js` の `CACHE_NAME` を `v45` にインクリメント済み。
- **教訓**: 音声名・カテゴリ名など「短い英単語を含む文字列」をパターンマッチする箇所では、
  必ず `\b` を付けること。この1文字の欠落で3回の修正を空振りさせた。

### Part 1のイラストをComfyUI生成のリアルな写真に置き換え(2026-08-08追加)

従来Part 1(写真描写、16問)のイラストは`data.js`にインライン直書きした簡易SVG(幾何学図形)
だった。本番のTOEIC Part 1は実際の写真なので、より本番に近いリアルな画像にしたいという要望を受けた。

- **生成手段**: ローカルのComfyUI(Desktop版、`C:\Users\<user>\AppData\Local\Comfy-Desktop\ ComfyUI-Installs\<workspace>\ComfyUI`に導入済みだったが未起動)。Higgsfield MCP(有料クレジット)
  ではなく無料でできないか相談を受け、ComfyUI MCPで起動→GPU(RTX 3070, VRAM 8GB)を検出→
  画像生成用チェックポイントが1つも無かったため`download_model`でSDXL Base
  (`sd_xl_base_1.0.safetensors`、約6.5GB、HuggingFaceから)を導入。以降は完全無料・
  ローカルGPUで生成できる。
  - Desktop版ComfyUIは`restart_comfyui(action:"start")`では起動できず(直後にexit code 0で
    終了)、`main.py --listen 127.0.0.1 --port 8188`を`.venv`のPythonで直接バックグラウンド
    起動する必要があった。プロセスはこのエージェントセッションに紐づくため、セッションが
    切れると一緒に落ちる(再開時は同じ手順で再起動が必要)。
- **生成条件**: `generate_image(action:"image", checkpoint:"sd_xl_base_1.0.safetensors")`、
  1024×640(既存SVGのviewBox 320×200と同じ8:5に近い比率)、30ステップ。プロンプトは
  「Documentary-style realistic photograph, TOEIC listening test photo style」を接頭辞に、
  各問題の正解文(`r[0]`)から場面を英語で記述する形で統一。ネガティブプロンプトで
  イラスト調・崩れた手・透かし文字などを除外。1枚あたり約10〜20秒。
- **データ**: `data.js`の`PART1`各要素に`img: "q{番号}.jpg"`を追加(既存の`svg`は
  フォールバック用にそのまま残している)。
- **再生ロジック**: `showListenQuestion()`(app.js)で`item.img`があれば
  `<img src="images/part1/${item.img}">`を、無ければ従来の`item.svg`をそのまま使う
  (音声ファイル対応と同じ「ファイル優先・フォールバックあり」のパターン)。
  `style.css`の`.listen-photo`に`img`用のルールを追加(`svg`と共通のwidth:100%)。
- **PWAキャッシュ**: `sw.js`の音声用ランタイムキャッシュ条件に`/images/`も追加し、
  同じ遅延キャッシュ方式(初回表示時にキャッシュへ保存)を流用。`CACHE_NAME`を`v51`に。
- **白黒化(2026-08-08追加)**: 本番のTOEIC L&R公式問題冊子はPart 1の写真を含め白黒印刷のため、
  生成した16枚(当初はカラー)をComfyUI Desktopの`.venv`にあるPillowで`convert("L")`により
  グレースケール化(同じ`toeic/images/part1/q{n}.jpg`を上書き、quality=85)。再生成はせず
  既存画像の色変換のみで対応。ファイルサイズも合計1.5MB→約1.0MBに縮小。
- **今後**: 画質・本番との近さで気になるものがあれば、プロンプト調整して一部だけ再生成、
  またはSVGへ差し戻しが可能。

### Part 1を20問追加(2026-08-11、16問→36問)

ユーザーから「Part1の問題を20問増やしたい」と依頼され、上記のComfyUI写真+edge-tts音声の方式を
維持したまま新規20問(q17〜q36、配列インデックス16〜35)を追加した。「コンテンツ追加時の批判的
再チェック」ルールに沿って作業した。

- **内容**: 場面・正解動詞が既存16問と重複しないよう構成(皿洗い/トラック積み込み/駐輪ラック/
  ネクタイ直し/書類確認/写真撮影/橋の風景/芝刈り/搭乗/絵掛け/陳列棚/水道修理/花生け/設計図確認/
  フェンス塗装/植木鉢/ジョギング/食料品降ろし/店内物色/椅子片付け)。内訳は単数写真11・複数4・
  モノ5で既存の比率(9:3:4)を踏襲(累計では1人20・複数7・モノ9)。
  批判的再チェックとして正解の一意性(誤答が文法的に成立しないか)・和訳・解説を1件ずつ見直し、
  修正が必要な欠陥は無かった(構造チェック・内容チェックいずれも0件指摘)。
- **画像生成**: 既存と同じComfyUI Desktop(`sd_xl_base_1.0.safetensors`、1024×640、30ステップ、
  同一プロンプト接頭辞・ネガティブプロンプト)で20枚を連続生成し、`.venv`のPillowで
  `convert("L")`によりグレースケール化して`toeic/images/part1/q17.jpg`〜`q36.jpg`として保存。
  セッション跨ぎでComfyUIプロセスが落ちていたため、`main.py --listen 127.0.0.1 --port 8188`を
  `.venv`のPythonで再起動する必要があった(既知の制約、上記参照)。
- **音声生成**: 既存と同じ`msedge-tts`で4声ローテーションを継続
  (Q17,21,25,29,33→`en-US-GuyNeural`、Q18,22,26,30,34→`en-US-JennyNeural`、
  Q19,23,27,31,35→`en-GB-RyanNeural`、Q20,24,28,32,36→`en-GB-SoniaNeural`)、80クリップを生成。
  `msedge-tts`の`toFile(dirPath, text)`は**ディレクトリパスを受け取り内部で`audio.mp3`という
  固定名で書き出す**仕様(ファイルパスを直接渡すと `ENOENT` になる)。一時ディレクトリに書き出してから
  目的のファイル名へコピー/削除する形で対応した。次回同種の作業をする際の落とし穴として残す。
- **検証**: `scratchpad/verify_part1_add20.js`(新規、10件: 件数36問/新規20問のフィールド構造/
  出題キューへの統合/新規画像の表示/画像・音声ファイルの404無し/解答フローの完走/コンソールエラー無し、
  全PASS)。既存回帰スイート16本(smoke/testB/phase1〜3check/l34check/fullflow/uicheck/designcheck/
  validate_p2/verify_p67/verify_p67_v2/verify_words_grammar/voicegender/voiceui/titlecheck)も
  再実行し全PASS(`verify_words_grammar`のWORDS/IPA件数アサーション2件のみ、単語追加の別作業で
  データが362→700語に増えたのに数値が更新されていなかった**既存の**staleさで、今回のPart1変更とは
  無関係と確認済み)。
  併せて`scratchpad/README.md`が前提とする一部スクリプト(`testB.js`/`phase1check.js`/
  `phase2check.js`/`l34check.js`)にサンドボックス固有の`executablePath`ハードコードが残っており
  ローカル実行時にエラーになる問題と、`validate_p2.js`の`data.js`絶対パスがサンドボックス
  (`/home/user/TOEIC/...`)決め打ちだった問題を発見したため、通常インストール先の自動検出・
  相対パスに直して合わせて修正した。
- `sw.js`の`CACHE_NAME`を`v52`→`v53`にインクリメント済み。

## 文法の苦手分野をより丁寧に解説する仕組み(2026-08-12追加)

ユーザーから「文法問題で弱点のある箇所について、より丁寧に解説する仕組みを設けることは難しいか」
と相談された。既に`QUESTIONS`の各問題にはカテゴリタグ(`t`: 品詞/動詞の形/語彙/前置詞/接続詞/
代名詞/仮定法/分詞構文/倒置/関係詞/比較の11種)があり、記録タブでカテゴリ別正答率も集計済み
だったため(`grammarTypeStats()`)、これを土台に「カテゴリ単位の弱点検出」+「そのカテゴリの
一般ルールを解説する詳しい説明」を追加した。単語の「苦手単語」カードと同じ考え方をカテゴリ単位に
拡張した形。**新しい永続状態・スキーマ移行は無し**(既存の`state.quizStats`から都度導出)。
「苦手分野を集中復習する」専用モード(弱点カテゴリだけを出題するキュー)はユーザーの意向で
今回のスコープ外とした(記録タブでの弱点表示と、答え合わせ時の詳しい解説パネルのみ)。

- **`GRAMMAR_TIPS`**(`data.js`、`QUESTIONS`の直後): 11カテゴリそれぞれの一般ルール解説
  (個々の問題の`x`より一段抽象化した「そのカテゴリ全体に共通する考え方」、2〜4文+例パターン)。
  キーは`QUESTIONS`の`t`と完全一致(スクリプトで抽出して確認済み)。
- **`weakGrammarTypes()`**(`app.js`): `grammarTypeStats()`(`renderStats()`内にあった集計ループを
  共通関数として切り出したもの)の結果から、出題数`WEAK_TYPE_MIN_SEEN=5`以上かつ
  正答率`WEAK_TYPE_ACC_THRESHOLD=0.7`未満のカテゴリを、正答率の低い順に返す。
  サンプル不足による誤判定を避けるため最低出題数の閾値を設けている。
- **記録タブ**: 「苦手な単語」カードの直後に「苦手な文法分野」カード(`#weak-grammar`)を追加。
  弱点カテゴリごとに正答率と`GRAMMAR_TIPS`の冒頭60文字を表示。0件時は「苦手な文法分野は
  まだありません」。
- **クイズ答え合わせ画面**: `answerQuestion()`で、その問題のカテゴリが(今回の解答結果を
  `state.quizStats`へ反映する**前**の時点で)弱点カテゴリだった場合のみ、既存の解説(`q.x`)の
  下に折りたたみパネル(`#quiz-weak-tip`、既存の`.l34-script-details`パターンを流用)で
  `GRAMMAR_TIPS`の全文を表示する。1問の結果だけで表示がぶれないよう、判定タイミングを
  SRS更新前に固定している。強いカテゴリでは何も表示されないため、余計な情報でクイズ画面が
  埋まらない。
- 新規id(`#weak-grammar`, `#quiz-weak-tip`, `#quiz-weak-tip-body`)のみ追加し、既存id/クラスは
  一切変更していない(回帰テストが依存する`#quiz-explanation`/`#accuracy-list`/`#weak-words`等)。
- 検証: `scratchpad/grammar_tips_check.js`(新規、15件: `GRAMMAR_TIPS`の11カテゴリ完全一致/
  `weakGrammarTypes()`の閾値・サンプル不足除外・ソート順/記録タブの`#weak-grammar`描画/
  弱点・非弱点それぞれでの解説パネルの表示切替/`<details>`の開閉/リファクタ後の`#accuracy-list`が
  従来通り描画されることの確認、全PASS)。既存回帰スイート17本
  (smoke/testB/phase1〜3check/l34check/fullflow/uicheck/designcheck/validate_p2/verify_p67/
  verify_p67_v2/verify_words_grammar/voicegender/voiceui/titlecheck/verify_part1_add20)も
  再実行し全PASS(`verify_words_grammar`のWORDS/IPA件数アサーション2件のみ、既存のstaleさで
  今回の変更とは無関係と確認済み)。
- `sw.js`の`CACHE_NAME`を`v54`→`v55`にインクリメント済み。

## 文法問題(Part 5形式)を100問追加(2026-08-17、350→450問)

ユーザーから「文法問題を100題増やしてほしい」と依頼された。「コンテンツ追加時の批判的再チェック」
ルールに沿って作業した。

- **カテゴリ内訳は既存比率に比例配分**(過去の+50問追加と同じ方針、ユーザー確認済み):
  品詞+21(74→95)、動詞の形+16(57→73)、語彙+16(54→70)、前置詞+11(39→50)、接続詞+10(36→46)、
  代名詞+7(24→31)、仮定法+6(20→26)、分詞構文+4(15→19)、倒置+4(15→19)、関係詞+3(9→12)、
  比較+2(7→9)。新カテゴリの追加は無し。難易度も既存プールと同様(600点〜上級混在)。
- **下書き**: Agentに既存350問(カテゴリ別に整理した参考ファイル`scratchpad/existing_questions_by_category.md`
  を提示)を踏まえて100問を生成させた。
- **批判的再チェック**: 下書きとは独立したAgentが1件ずつレビューし、**11件の欠陥を検出・修正した**
  (下記「教訓」参照)。過去のPart6/7追加時と同様、構造チェックだけでは1件も検出できない種類の欠陥。
  代表例:
  - 誤答選択肢がその文脈で実は文法的に成立してしまうケース(品詞1件、動詞の形3件、語彙2件、
    接続詞2件、仮定法3件)。例: `applies uniformity to all departments`(誤答choiceでも他動詞の
    目的語として成立)→ 動詞を受動態`is applied`に変更し名詞が入れない構造にした。
    `mixed conditional`(仮定法の型2条件+型3帰結)が文法的に正当な構文であるため、
    誤答として使うと実は成立してしまうケースが2件あった → 数の不一致(単数/複数)や
    時制の組み合わせが認識されない形に差し替えて対応。
  - 語彙問題で近義語クラスタ(minimize/shrink/narrow/shorten等)から誤答を選んだ結果、
    文脈次第で正解と紛らわしくなっていたケース(2件)→ より明確に不適切な語へ差し替え。
- **統合**: `data.js`の`QUESTIONS`配列末尾(既存350問の直後)に100問を追記して450問に。
  既存の`GRAMMAR_TIPS`(11カテゴリの一般解説)はカテゴリ自体が増えないため変更不要
  (全450問のカテゴリが11種のいずれかに収まることを確認済み)。
- 検証: `scratchpad/verify_grammar_add100.js`(新規、8件: 件数450/カテゴリ内訳/新規100問の
  スキーマ/出題キューへの統合/新規問題を含むセッション完走/カテゴリ別正答率・苦手分野カードの
  回帰、全PASS)。`scratchpad/verify_words_grammar.js`の件数アサーションもこの機会に
  現状の規模(WORDS/IPA 700語、QUESTIONS 450問)に合わせて更新した(従来362語/350問のまま
  stale化していたのを解消)。既存回帰スイート18本
  (smoke/testB/phase1〜3check/l34check/fullflow/uicheck/designcheck/validate_p2/verify_p67/
  verify_p67_v2/verify_words_grammar/voicegender/voiceui/titlecheck/verify_part1_add20/
  grammar_tips_check)も再実行し全PASS。
- `sw.js`の`CACHE_NAME`を`v55`→`v56`にインクリメント済み。
- **教訓の再確認**: Part5形式では「誤答が文脈上不自然なだけでは不十分、文法的に成立しない
  ところまで詰める」(2026-07-29に確立した教訓)が今回も繰り返し当てはまった。特に仮定法の
  mixed conditional(混合仮定法)は正当な英文法パターンなので、誤答候補として安易に使うと
  「実は正しい」問題になりやすい、という新しい具体例が得られた。

## プレビュー検証で踏んだ地雷(次回も起きうる)

- **Service Workerキャッシュ**: `data.js`/`app.js` を編集したら `sw.js` の `CACHE_NAME` を必ずインクリメント
  (現在 `toeic600-v41`。2026-07-18: `MASTERED_LEVEL` を 3→4 に変更。「習得」を最上位lv4=14日間隔到達に統一し、
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
