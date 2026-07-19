// TOEIC 600 学習アプリ

const STORAGE_KEY = "toeic600-v1";

// 復習間隔(日): レベルが上がるほど間隔が延びる(単語・文法クイズ共通)
const INTERVALS = [0, 1, 3, 7, 14];
const MAX_LEVEL = INTERVALS.length - 1;
const MASTERED_LEVEL = 3; // このレベル以上を「習得」とみなす
const QUIZ_SET_SIZE = 10;

// ---- ストリーク & 通貨(継続の仕組み) ----
const FREEZE_MAX = 2;           // ❄️フリーズの最大ストック数
const FREEZE_COST = 200;        // ショップでのフリーズ購入価格(💎)
// ストリーク節目: 到達で紙吹雪+ボーナスジェム。7の倍数の節目ではフリーズも1個無料付与
const STREAK_MILESTONES = [
  { days: 3, gems: 20 }, { days: 7, gems: 40 }, { days: 14, gems: 60 },
  { days: 30, gems: 100 }, { days: 50, gems: 150 }, { days: 100, gems: 300 },
];

// 週間クエスト: 週替わりで3つ。日で完結しない目標線を張る(1週間=月曜〜日曜)
const WEEKLY_POOL = [
  { id: "w_words", label: "単語を120枚学習する", xp: 60, gems: 40, target: 120, progress: (a) => a.words },
  { id: "w_quiz", label: "文法を80問解く", xp: 60, gems: 40, target: 80, progress: (a) => a.quiz },
  { id: "w_listen", label: "リスニングを80問解く", xp: 60, gems: 40, target: 80, progress: (a) => a.listen },
  { id: "w_read", label: "読解を24問解く", xp: 60, gems: 40, target: 24, progress: (a) => a.read },
  { id: "w_correct", label: "文法で60問正解する", xp: 70, gems: 50, target: 60, progress: (a) => a.correct },
  { id: "w_listenok", label: "リスニングで50問正解する", xp: 70, gems: 50, target: 50, progress: (a) => a.listenOk },
  { id: "w_days5", label: "5日学習する", xp: 80, gems: 60, target: 5, progress: (a) => a.activeDays },
];
const WEEKLY_WIN_GEMS = 50;  // ゴーストリーグで先週の自分に勝ったときのボーナス💎

// 月間バッジ: その月にクエストポイント(デイリー/週間クエスト達成)を規定数ためると獲得
const MONTHLY_TARGET = 40;
const MONTHLY_BADGE_GEMS = 100;
// 月ごとの限定バッジ(季節モチーフ)。index=月(1..12)
const MONTHLY_THEMES = [
  null,
  { icon: "❄️", name: "雪の勲章" }, { icon: "💝", name: "ハートの勲章" }, { icon: "🌸", name: "桜の勲章" },
  { icon: "🌱", name: "新芽の勲章" }, { icon: "🎏", name: "こいのぼりの勲章" }, { icon: "☔", name: "あじさいの勲章" },
  { icon: "🎆", name: "花火の勲章" }, { icon: "🌻", name: "ひまわりの勲章" }, { icon: "🍁", name: "紅葉の勲章" },
  { icon: "🎃", name: "かぼちゃの勲章" }, { icon: "🍂", name: "落ち葉の勲章" }, { icon: "🎄", name: "聖夜の勲章" },
];

// ---- 状態 ----

function defaultState() {
  return {
    settings: { examDate: defaultExamDate(), goalWords: 20, goalQuiz: 10, goalListen: 10, goalRead: 6, targetScore: 600, sound: true, autoSpeak: true },
    words: {},       // wordIndex -> { lv, next, seen, ok }
    quizStats: {},   // questionIndex -> { lv, next, seen, ok }(単語と同じ間隔反復)
    listenStats: {}, // part2Index -> { lv, next, seen, ok }(同上)
    part1Stats: {},  // part1Index -> { lv, next, seen, ok }(同上)
    readStats: {},   // Part 7文書セットindex -> { lv, next, seen, ok }(セット全問正解でレベルUP)
    part6Stats: {},  // Part 6長文index -> { lv, next, seen, ok }(同上)
    part3Stats: {},  // Part 3会話index -> { lv, next, seen, ok }(会話単位・全問正解でレベルUP)
    part4Stats: {},  // Part 4トークindex -> { lv, next, seen, ok }(トーク単位・同上)
    xp: 0,           // 累計XP(レベルはここから算出)
    gems: 0,         // 💎ジェム(宿題ではなくメタ通貨。ショップでフリーズ等と交換)
    freezes: 0,      // ❄️ストリークフリーズの在庫(最大FREEZE_MAX)。休んだ日を自動で埋める
    streak: { count: 0, lastActive: "", best: 0 }, // 連続学習日(フリーズを考慮して維持)
    freezeLog: [],   // フリーズで埋めた日付(表示・重複防止用、直近のみ保持)
    streakMilestones: [], // 祝福済みのストリーク節目(重複祝福を防ぐ)
    weekly: { week: "", claimed: [] }, // 今週の週間クエスト達成記録(週替わり)
    monthly: { ym: "", points: 0 },    // 今月のクエストポイント(月間バッジ用、月替わり)
    monthlyBadges: [],                 // 獲得した月間バッジ [{ ym, icon, name }]
    league: { week: "", xp: 0, prevXp: 0, pendingResult: null }, // 先週の自分とのXP対戦
    goalDone: "",    // ノルマ全達成を祝った日(1日1回だけ祝う)
    daily: null,     // { date, claimed: [id...] } デイリーチャレンジの達成記録
    badges: [],      // 解除済み実績のid
    dailyDoneCount: 0, // デイリーチャレンジの累計達成数(実績用)
    taPerfect: false,  // タイムアタックでパーフェクトを取ったか(実績用)
    log: {},         // "YYYY-MM-DD" -> { words, quiz, correct, listen, listenOk }
  };
}

function defaultExamDate() {
  // 来月の第1日曜(TOEIC公開テストの定番)をデフォルトに
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  return dateKey(d);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    const merged = { ...defaultState(), ...s, settings: { ...defaultState().settings, ...s.settings } };
    // 旧形式(lv/nextなし)の文法・リスニング記録を間隔反復形式へ移行
    [merged.quizStats, merged.listenStats, merged.part1Stats, merged.readStats, merged.part6Stats, merged.part3Stats, merged.part4Stats].forEach((stats) => {
      Object.values(stats).forEach((st) => {
        if (st.lv === undefined) {
          st.lv = st.ok > 0 ? 1 : 0;
          st.next = todayKey();
        }
      });
    });
    // ストリーク機能の導入前ユーザー: これまでのログから連続日数を復元して引き継ぐ
    if (!merged.streak || merged.streak.lastActive === "") {
      const derived = calcStreakFromLog(merged.log);
      merged.streak = { count: derived.count, lastActive: derived.lastActive, best: derived.count };
    }
    return merged;
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

// ---- 日付ユーティリティ ----

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayKey() {
  return dateKey(new Date());
}

function addDays(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return dateKey(dt);
}

function daysUntil(key) {
  const [y, m, d] = key.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}

function todayLog() {
  const k = todayKey();
  if (!state.log[k]) state.log[k] = { words: 0, quiz: 0, correct: 0, listen: 0, listenOk: 0, read: 0, readOk: 0 };
  return state.log[k];
}

// 過去のログにはlisten/readが無い場合があるため合計はこの関数で取る
function logTotal(l) {
  return l ? l.words + l.quiz + (l.listen || 0) + (l.read || 0) : 0;
}

// ---- 効果音 (Web Audio APIで合成・音声ファイル不要) ----

let audioCtx = null;

function ensureAudioCtx() {
  if (!state.settings.sound) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTone(ctx, freq, start, dur, peak, type) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || "sine";
  osc.frequency.value = freq;
  const t = ctx.currentTime + start;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

// ポップ音: 低めの音程から一瞬でしゃくり上げる(Duolingo風の「ポッ」とした質感)
// オクターブ上の倍音を薄く重ねて、丸いのに明るい音にする
function popNote(ctx, freq, start, dur, peak) {
  const t = ctx.currentTime + start;
  [[1, peak], [2, peak * 0.25]].forEach(([mult, gainPeak]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * mult * 0.55, t);
    osc.frequency.exponentialRampToValueAtTime(freq * mult, t + 0.035);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(gainPeak, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  });
}

// 正解: Duolingo風「ポピンッ」(低→高の跳ねる2音、どちらもポップなしゃくり上げ付き)
// コンボが続くと半音ずつピッチが上がっていく(報酬系を刺激する上昇感)
function seCorrect(combo) {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const step = Math.min(Math.max(combo || 1, 1) - 1, 7); // 最大7半音まで上昇
  const k = Math.pow(2, step / 12);
  popNote(ctx, 587.33 * k, 0, 0.14, 0.2);  // ポッ(D5〜)
  popNote(ctx, 880 * k, 0.1, 0.34, 0.22);  // ピンッ(A5〜)
}

// レベルアップ: きらびやかな上昇アルペジオ
function seLevelUp() {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  playTone(ctx, 523.25, 0, 0.16, 0.14);     // C5
  playTone(ctx, 659.25, 0.08, 0.16, 0.14);  // E5
  playTone(ctx, 783.99, 0.16, 0.16, 0.15);  // G5
  playTone(ctx, 1046.5, 0.24, 0.22, 0.16);  // C6
  playTone(ctx, 1318.5, 0.34, 0.45, 0.16);  // E6
  playTone(ctx, 2093, 0.34, 0.45, 0.06);    // C7(きらめき)
}

// 不正解: 控えめな低音
function seWrong() {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  playTone(ctx, 220, 0, 0.18, 0.1, "triangle");
  playTone(ctx, 185, 0.1, 0.22, 0.08, "triangle");
}

// 単語「覚えた」: 短いポップなティック音(正解音のミニ版)
function seTick() {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  popNote(ctx, 880, 0, 0.12, 0.14);
}

// セット完了: 上昇アルペジオ
function seFinish() {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  playTone(ctx, 523.25, 0, 0.18, 0.14);      // C5
  playTone(ctx, 659.25, 0.1, 0.18, 0.14);    // E5
  playTone(ctx, 783.99, 0.2, 0.18, 0.14);    // G5
  playTone(ctx, 1046.5, 0.3, 0.4, 0.16);     // C6
}

// ---- XP・レベル・お祝い演出 ----

let sessionXp = 0; // 現在のセッションで獲得したXP(結果画面に表示)

// レベルアップに必要なXPは少しずつ増える(Lv1→2: 100XP, 以降+50ずつ)
function levelInfo(xp) {
  let level = 1;
  let need = 100;
  let rem = xp;
  while (rem >= need) {
    rem -= need;
    level++;
    need = 100 + (level - 1) * 50;
  }
  return { level, into: rem, need };
}

function addXp(n) {
  const before = levelInfo(state.xp).level;
  state.xp += n;
  sessionXp += n;
  ensureLeagueWeek();          // 週が変わっていたら繰り越し
  state.league.xp += n;        // 今週のXP(先週の自分との対戦用)
  const after = levelInfo(state.xp).level;
  if (after > before) celebrateLevelUp(after);
}

// 紙吹雪
function confetti() {
  const box = document.createElement("div");
  box.className = "confetti-box";
  const colors = ["#2b6e8f", "#e8a13d", "#2e9e6b", "#c96b5a", "#7e57c2", "#4a90c2"];
  for (let i = 0; i < 50; i++) {
    const p = document.createElement("div");
    p.className = "confetti-piece";
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${Math.random() * 0.5}s`;
    p.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3500);
}

// 画面上部にスライドインするバナー(同時に複数出たら縦に並べる)
function showBanner(text) {
  const b = document.createElement("div");
  b.className = "levelup-banner";
  b.textContent = text;
  const offset = 44 + document.querySelectorAll(".levelup-banner").length * 52;
  b.style.setProperty("--banner-y", `${offset}px`);
  document.body.appendChild(b);
  requestAnimationFrame(() => b.classList.add("show"));
  setTimeout(() => {
    b.classList.remove("show");
    setTimeout(() => b.remove(), 400);
  }, 2400);
}

function celebrateLevelUp(level) {
  seLevelUp();
  confetti();
  showBanner(`⬆️ レベル${level} にアップ!`);
}

function goalsMetToday() {
  const log = state.log[todayKey()];
  if (!log) return false;
  return log.words >= state.settings.goalWords &&
    log.quiz >= state.settings.goalQuiz &&
    (log.listen || 0) >= state.settings.goalListen &&
    (log.read || 0) >= state.settings.goalRead;
}

// 1日のノルマ全達成を1回だけ祝う(セット終了時にチェック)
function maybeCelebrateGoal() {
  if (!goalsMetToday() || state.goalDone === todayKey()) return;
  state.goalDone = todayKey();
  saveState();
  confetti();
  showBanner("🎉 今日のノルマ全達成!");
}

// ---- 称号(レベルに応じて進化) ----

const TITLES = [
  [1, "みならい"], [3, "かけだし受験生"], [5, "コツコツ勉強家"], [8, "問題ハンター"],
  [12, "勉強の鬼"], [16, "TOEICウォリアー"], [20, "600点スレイヤー"], [25, "伝説の受験者"],
];

function titleForLevel(level) {
  let title = TITLES[0][1];
  TITLES.forEach(([lv, name]) => { if (level >= lv) title = name; });
  return title;
}

// ---- 実績バッジ ----
// 解除条件は累計データから判定。解除時は紙吹雪+バナー+ボーナスXP(+50)

const BADGE_XP = 50;

function aggregates() {
  const a = { words: 0, quiz: 0, correct: 0, listen: 0, listenOk: 0, read: 0, readOk: 0, maxCombo: 0, perfects: 0, activeDays: 0 };
  Object.values(state.log).forEach((l) => {
    a.words += l.words;
    a.quiz += l.quiz;
    a.correct += l.correct;
    a.listen += l.listen || 0;
    a.listenOk += l.listenOk || 0;
    a.read += l.read || 0;
    a.readOk += l.readOk || 0;
    a.maxCombo = Math.max(a.maxCombo, l.maxCombo || 0);
    a.perfects += l.perfects || 0;
    if (logTotal(l) > 0) a.activeDays++;
  });
  return a;
}

const BADGES = [
  { id: "first", icon: "👣", name: "はじめの一歩", desc: "初めて学習する", cond: (a) => a.words + a.quiz + a.listen >= 1 },
  { id: "w50", icon: "📚", name: "単語コレクター", desc: "単語を50語習得する", cond: () => countMastered() >= 50 },
  { id: "w150", icon: "👑", name: "単語マスター", desc: "単語を150語習得する", cond: () => countMastered() >= 150 },
  { id: "q50", icon: "✏️", name: "文法の芽", desc: "文法で累計50問正解する", cond: (a) => a.correct >= 50 },
  { id: "q200", icon: "🎓", name: "文法の達人", desc: "文法で累計200問正解する", cond: (a) => a.correct >= 200 },
  { id: "l100", icon: "🎧", name: "英語耳", desc: "リスニングを累計100問解く", cond: (a) => a.listen >= 100 },
  { id: "r30", icon: "📖", name: "速読の入り口", desc: "読解を累計30問解く", cond: (a) => a.read >= 30 },
  { id: "combo10", icon: "🔥", name: "鬼コンボ", desc: "10連続正解を達成する", cond: (a) => a.maxCombo >= 10 },
  { id: "perfect5", icon: "💯", name: "パーフェクト主義", desc: "パーフェクトセットを5回達成する", cond: (a) => a.perfects >= 5 },
  { id: "streak3", icon: "📅", name: "三日坊主卒業", desc: "3日連続で学習する", cond: () => calcStreak() >= 3 },
  { id: "streak7", icon: "🗓️", name: "一週間戦士", desc: "7日連続で学習する", cond: () => calcStreak() >= 7 },
  { id: "streak14", icon: "🏆", name: "継続は力なり", desc: "14日連続で学習する", cond: () => calcStreak() >= 14 },
  { id: "lv10", icon: "⭐", name: "レベル10", desc: "レベル10に到達する", cond: () => levelInfo(state.xp).level >= 10 },
  { id: "challenge10", icon: "🏅", name: "チャレンジャー", desc: "デイリーチャレンジを累計10個達成する", cond: () => (state.dailyDoneCount || 0) >= 10 },
  { id: "speed", icon: "⚡", name: "スピードスター", desc: "タイムアタックでパーフェクトを達成する", cond: () => state.taPerfect === true },
];

function checkBadges() {
  const a = aggregates();
  BADGES.forEach((b) => {
    if (state.badges.includes(b.id)) return;
    if (b.cond(a)) {
      state.badges.push(b.id);
      addXp(BADGE_XP);
      confetti();
      showBanner(`🎖️ 実績解除「${b.name}」! +${BADGE_XP}XP`);
      saveState();
    }
  });
}

// ---- デイリーチャレンジ ----
// 毎日3つを日付から決定的に選ぶ(その日はずっと同じ、翌日は別の組み合わせ)

const DAILY_POOL = [
  { id: "words20", label: "単語を20枚学習する", xp: 30, target: 20, progress: (l) => l.words },
  { id: "quiz10", label: "文法を10問解く", xp: 30, target: 10, progress: (l) => l.quiz },
  { id: "listen10", label: "リスニングを10問解く", xp: 30, target: 10, progress: (l) => l.listen || 0 },
  { id: "correct8", label: "文法で8問正解する", xp: 35, target: 8, progress: (l) => l.correct },
  { id: "listenOk7", label: "リスニングで7問正解する", xp: 35, target: 7, progress: (l) => l.listenOk || 0 },
  { id: "read6", label: "読解を6問解く", xp: 30, target: 6, progress: (l) => l.read || 0 },
  { id: "combo5", label: "5連続正解を達成する", xp: 40, target: 5, progress: (l) => l.maxCombo || 0 },
  { id: "perfect", label: "パーフェクトセットを達成する", xp: 50, target: 1, progress: (l) => l.perfects || 0 },
  { id: "allfour", label: "単語・文法・リスニング・読解を全部やる", xp: 40, target: 4, progress: (l) => (l.words > 0 ? 1 : 0) + (l.quiz > 0 ? 1 : 0) + ((l.listen || 0) > 0 ? 1 : 0) + ((l.read || 0) > 0 ? 1 : 0) },
];

function dailyChallenges() {
  // 日付文字列をシードにした擬似乱数で3つ選ぶ
  let seed = 0;
  for (const ch of todayKey()) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = [...DAILY_POOL];
  const picks = [];
  for (let i = 0; i < 3; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    picks.push(pool.splice(seed % pool.length, 1)[0]);
  }
  return picks;
}

function ensureDaily() {
  if (!state.daily || state.daily.date !== todayKey()) {
    state.daily = { date: todayKey(), claimed: [] };
  }
  return state.daily;
}

// 達成した瞬間にボーナスXPとバナーで報酬を出す(学習アクションのたびに呼ぶ)
function checkDailyChallenges() {
  touchStreak(); // 学習アクション=今日活動した、として連続記録を更新
  const daily = ensureDaily();
  const log = state.log[todayKey()];
  if (!log) return;
  let changed = false;
  dailyChallenges().forEach((c) => {
    if (daily.claimed.includes(c.id)) return;
    if (c.progress(log) >= c.target) {
      daily.claimed.push(c.id);
      state.dailyDoneCount = (state.dailyDoneCount || 0) + 1;
      addXp(c.xp);
      showBanner(`🏅 チャレンジ達成! +${c.xp}XP`);
      openChest(c.xp); // 達成報酬は宝箱でジェムを獲得(変動報酬)
      addMonthlyPoints(1); // 月間バッジ用のポイント
      changed = true;
    }
  });
  if (changed) saveState();
  checkWeeklyQuests(); // 週間クエストの達成も判定する
  checkBadges(); // 学習アクションのたびに実績も判定する
}

// ---- 週間クエスト / 月間バッジ / ゴーストリーグ(週・月の長い目標線) ----

// その週の月曜日の日付キーを返す(1週間=月曜〜日曜)
function weekKey(baseKey) {
  const base = baseKey || todayKey();
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const offset = (dt.getDay() + 6) % 7; // 月曜=0 ... 日曜=6
  dt.setDate(dt.getDate() - offset);
  return dateKey(dt);
}

// 今週(月〜日)のログを集計して週間クエストの進捗に使う
function weekAggregate() {
  const start = weekKey();
  const a = { words: 0, quiz: 0, correct: 0, listen: 0, listenOk: 0, read: 0, readOk: 0, activeDays: 0 };
  for (let i = 0; i < 7; i++) {
    const l = state.log[addDays(start, i)];
    if (!l) continue;
    a.words += l.words; a.quiz += l.quiz; a.correct += l.correct;
    a.listen += l.listen || 0; a.listenOk += l.listenOk || 0;
    a.read += l.read || 0; a.readOk += l.readOk || 0;
    if (logTotal(l) > 0) a.activeDays++;
  }
  return a;
}

// 今週の週間クエスト3つを週から決定的に選ぶ(その週はずっと同じ)
function weeklyQuests() {
  let seed = 0;
  for (const ch of weekKey()) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = [...WEEKLY_POOL];
  const picks = [];
  for (let i = 0; i < 3; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    picks.push(pool.splice(seed % pool.length, 1)[0]);
  }
  return picks;
}

function ensureWeekly() {
  const wk = weekKey();
  if (!state.weekly || state.weekly.week !== wk) state.weekly = { week: wk, claimed: [] };
  return state.weekly;
}

function checkWeeklyQuests() {
  const wq = ensureWeekly();
  const agg = weekAggregate();
  let changed = false;
  weeklyQuests().forEach((q) => {
    if (wq.claimed.includes(q.id)) return;
    if (q.progress(agg) >= q.target) {
      wq.claimed.push(q.id);
      addXp(q.xp);
      addGems(q.gems);
      addMonthlyPoints(1);
      confetti();
      showBanner(`🗓️ 週間クエスト達成! +${q.xp}XP +${q.gems}💎`);
      changed = true;
    }
  });
  if (changed) saveState();
}

// ---- 月間バッジ ----

function ensureMonth() {
  const ym = todayKey().slice(0, 7);
  if (!state.monthly || state.monthly.ym !== ym) state.monthly = { ym, points: 0 };
  return state.monthly;
}

function addMonthlyPoints(n) {
  const m = ensureMonth();
  m.points += n;
  checkMonthlyBadge();
}

function monthlyBadgeFor(ym) {
  const mo = Number(ym.slice(5, 7));
  const t = MONTHLY_THEMES[mo] || { icon: "🏅", name: "月間の勲章" };
  return { ym, icon: t.icon, name: `${mo}月・${t.name}` };
}

function checkMonthlyBadge() {
  const m = ensureMonth();
  if (m.points < MONTHLY_TARGET) return;
  if (state.monthlyBadges.some((b) => b.ym === m.ym)) return;
  const badge = monthlyBadgeFor(m.ym);
  state.monthlyBadges.push(badge);
  addGems(MONTHLY_BADGE_GEMS);
  confetti();
  seLevelUp();
  showBanner(`🏆 ${badge.name} バッジ獲得! +${MONTHLY_BADGE_GEMS}💎`);
  saveState();
}

// ---- ゴーストリーグ(先週の自分とのXP対戦) ----

// 週が変わったら先週のXP合計を「先週の自分(ghost)」として確定し、今週分をリセットする
function ensureLeagueWeek() {
  const wk = weekKey();
  const lg = state.league;
  if (lg.week === wk) return;
  if (lg.week === "") {
    lg.week = wk; lg.xp = 0; lg.prevXp = 0; // 初週はゴーストなし
    return;
  }
  // 終わった週の結果を1回だけ祝うために保留しておく(renderで消費)
  lg.pendingResult = { xp: lg.xp, ghost: lg.prevXp };
  lg.prevXp = lg.xp;
  lg.xp = 0;
  lg.week = wk;
}

// ---- タブ切り替え ----

const TABS = ["home", "words", "quiz", "listen", "read", "stats"];

function showTab(name) {
  TABS.forEach((t) => {
    document.getElementById(`tab-${t}`).classList.toggle("hidden", t !== name);
  });
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === name);
  });
  if (name !== "listen") stopListenAudio();
  if (name !== "quiz") stopTaTimer(); // タブを離れたらタイマーを止める
  if (name !== "read") stopReadTimer(); // 読解タイマーも止める
  if (name === "home") renderHome();
  if (name === "words") renderWordsStart();
  if (name === "quiz") renderQuizStart();
  if (name === "listen") renderListenStart();
  if (name === "read") renderReadStart();
  if (name === "stats") renderStats();
  window.scrollTo(0, 0);
}

document.querySelectorAll(".tab-btn").forEach((b) => {
  b.addEventListener("click", () => showTab(b.dataset.tab));
});
document.querySelectorAll("[data-goto]").forEach((b) => {
  b.addEventListener("click", () => showTab(b.dataset.goto));
});

// ---- ホーム ----

// 2つの日付キー間の日数(b - a)
function daysBetween(a, b) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / 86400000);
}

// 今日すでに学習したか
function todayActive() {
  return logTotal(state.log[todayKey()]) > 0;
}

// ログのみから連続学習日を求める(ストリーク機能導入前の記録の移行・保険用)
function calcStreakFromLog(log) {
  let count = 0;
  let k = todayKey();
  if (logTotal(log[k]) === 0) k = addDays(k, -1); // 今日未学習でも昨日までの連続は保つ
  const lastActive = logTotal(log[k]) > 0 ? k : "";
  while (logTotal(log[k]) > 0) { count++; k = addDays(k, -1); }
  return { count, lastActive };
}

// 表示用: 維持しているストリーク値を返す
function calcStreak() {
  return (state.streak && state.streak.count) || 0;
}

// 学習アクションのたびに呼ぶ。今日を「活動日」として連続記録を更新する。
// 空いた日はフリーズ(お守り)で自動的に埋め、足りなければリセットする。
function touchStreak() {
  const today = todayKey();
  const s = state.streak;
  if (s.lastActive === today) return; // 今日はもう計上済み

  if (s.lastActive === "") {
    s.count = 1;
  } else {
    const gap = daysBetween(s.lastActive, today); // 1なら連続、2以上は間が空いた
    if (gap <= 1) {
      s.count += 1;
    } else {
      const missed = gap - 1; // 埋めるべき欠席日数
      if (state.freezes >= missed) {
        // フリーズで全部埋める → 連続維持(埋めた日はカウントには足さない=Duolingo方式)
        state.freezes -= missed;
        for (let i = 1; i <= missed; i++) state.freezeLog.push(addDays(s.lastActive, i));
        if (state.freezeLog.length > 30) state.freezeLog = state.freezeLog.slice(-30);
        s.count += 1;
        showBanner(`❄️ お守りで連続記録を守りました(${missed}日分)`);
      } else {
        s.count = 1; // 守りきれず途切れた
      }
    }
  }
  s.lastActive = today;
  s.best = Math.max(s.best || 0, s.count);
  checkStreakMilestones();
  saveState();
}

// ストリークの節目を祝う(到達済みは記録して二度は祝わない)
function checkStreakMilestones() {
  STREAK_MILESTONES.forEach((m) => {
    if (state.streak.count < m.days) return;
    if (state.streakMilestones.includes(m.days)) return;
    state.streakMilestones.push(m.days);
    addGems(m.gems);
    // 7日ごとの節目ではフリーズも1個プレゼント(課金なしでも継続を守れるように)
    let extra = "";
    if (m.days % 7 === 0 && state.freezes < FREEZE_MAX) {
      state.freezes = Math.min(FREEZE_MAX, state.freezes + 1);
      extra = " ・ ❄️お守り+1";
    }
    confetti();
    seLevelUp();
    showBanner(`🔥 ${m.days}日連続達成! +${m.gems}💎${extra}`);
  });
}

// ---- ジェム & 宝箱 & ショップ ----

function addGems(n) {
  state.gems = Math.max(0, (state.gems || 0) + n);
}

// デイリーチャレンジ達成時に開ける宝箱。ランダムなジェム量(変動報酬)。
// チャレンジのXP帯で宝箱のグレードが変わる。金の宝箱はたまにXPも上乗せ。
function openChest(challengeXp) {
  let tier, min, max, icon;
  if (challengeXp >= 45) { tier = "gold"; min = 30; max = 50; icon = "🎁"; }
  else if (challengeXp >= 35) { tier = "silver"; min = 20; max = 35; icon = "🎁"; }
  else { tier = "bronze"; min = 10; max = 20; icon = "🎁"; }
  const gems = min + Math.floor(Math.random() * (max - min + 1));
  addGems(gems);
  let bonusXp = 0;
  if (tier === "gold" && Math.random() < 0.4) {
    bonusXp = 15;
    addXp(bonusXp); // 金の宝箱の“当たり”
  }
  showBanner(`${icon} 宝箱! +${gems}💎${bonusXp ? ` +${bonusXp}XP` : ""}`);
}

// ショップ: フリーズを購入
function buyFreeze() {
  if (state.freezes >= FREEZE_MAX) { showBanner(`❄️ お守りは最大${FREEZE_MAX}個までです`); return; }
  if ((state.gems || 0) < FREEZE_COST) { showBanner(`💎が足りません(${FREEZE_COST}必要)`); return; }
  addGems(-FREEZE_COST);
  state.freezes = Math.min(FREEZE_MAX, state.freezes + 1);
  saveState();
  seLevelUp();
  showBanner(`❄️ お守りを購入しました(残り${state.gems}💎)`);
  renderShop();
  renderHome();
}

function countMastered() {
  return Object.values(state.words).filter((w) => w.lv >= MASTERED_LEVEL).length;
}

// 次に到達するストリーク節目を返す(なければnull)
function nextMilestone() {
  return STREAK_MILESTONES.find((m) => m.days > calcStreak()) || null;
}

// ホーム最上部の炎ヒーロー(継続の主役)。今日未達成なら炎をグレーにして行動を促す。
function renderStreakHero() {
  const active = todayActive();
  const count = calcStreak();
  const flame = document.getElementById("streak-flame");
  const hero = document.getElementById("streak-hero");
  flame.textContent = "🔥"; // 未達成時は .dim でグレーアウト(下のCSS)
  flame.classList.toggle("dim", !active);
  hero.classList.toggle("active", active);
  document.getElementById("streak-count").textContent = count;
  document.getElementById("gem-count").textContent = state.gems || 0;
  document.getElementById("freeze-count").textContent = state.freezes || 0;

  const msg = document.getElementById("streak-message");
  if (count === 0) {
    msg.textContent = "今日から学習して炎を灯そう🔥";
  } else if (!active) {
    msg.textContent = `連続${count}日! 今日学習しないと途切れます${state.freezes > 0 ? "(❄️お守りで自動で守られます)" : ""}`;
  } else {
    const nm = nextMilestone();
    msg.textContent = nm ? `連続${count}日! 次の節目まであと${nm.days - count}日で+${nm.gems}💎` : `連続${count}日! 自己ベスト更新中🏆`;
  }
}

// ---- ショップ ----

function renderShop() {
  const dlg = document.getElementById("shop-dialog");
  if (!dlg) return;
  document.getElementById("shop-gems").textContent = state.gems || 0;
  document.getElementById("shop-freeze-stock").textContent = `${state.freezes || 0} / ${FREEZE_MAX}`;
  const btn = document.getElementById("shop-buy-freeze");
  const full = state.freezes >= FREEZE_MAX;
  const poor = (state.gems || 0) < FREEZE_COST;
  btn.disabled = full || poor;
  btn.textContent = full ? "在庫が最大です" : `${FREEZE_COST}💎 で購入`;
}

// ---- ホーム「今週」カードの描画(ゴーストリーグ + 週間クエスト + 月間ミニ) ----

function renderLeague() {
  ensureLeagueWeek();
  const lg = state.league;
  // 週明けの結果を1回だけ祝う
  if (lg.pendingResult) {
    const r = lg.pendingResult;
    lg.pendingResult = null;
    if (r.ghost > 0 && r.xp >= r.ghost) {
      confetti();
      addGems(WEEKLY_WIN_GEMS);
      showBanner(`🏁 先週の自分に勝利! +${WEEKLY_WIN_GEMS}💎`);
    } else if (r.ghost > 0) {
      showBanner(`🏁 先週は ${r.ghost}XP。今週こそ超えよう!`);
    }
    saveState();
  }
  const cur = lg.xp || 0;
  const ghost = lg.prevXp || 0;
  const bar = document.getElementById("league-bar-fill");
  const ghostMark = document.getElementById("league-ghost-mark");
  const txt = document.getElementById("league-text");
  if (ghost <= 0) {
    bar.style.width = `${Math.min(100, cur === 0 ? 4 : 100)}%`;
    ghostMark.style.display = "none";
    txt.textContent = `今週 ${cur}XP ・ まずは1週間の記録を作ろう!`;
    return;
  }
  const maxV = Math.max(cur, ghost);
  bar.style.width = `${Math.max(4, (cur / maxV) * 100)}%`;
  ghostMark.style.display = "block";
  ghostMark.style.left = `${(ghost / maxV) * 100}%`;
  bar.classList.toggle("ahead", cur >= ghost);
  txt.textContent = cur >= ghost
    ? `今週 ${cur}XP / 先週 ${ghost}XP ・ 先週の自分を超えた!🎉`
    : `今週 ${cur}XP / 先週 ${ghost}XP ・ あと ${ghost - cur}XPで先週超え`;
}

function renderWeekly() {
  const wq = ensureWeekly();
  const agg = weekAggregate();
  const list = document.getElementById("weekly-list");
  list.innerHTML = "";
  weeklyQuests().forEach((q) => {
    const done = wq.claimed.includes(q.id);
    const prog = Math.min(q.progress(agg), q.target);
    const row = document.createElement("div");
    row.className = "daily-row" + (done ? " done" : "");
    row.innerHTML =
      `<span class="daily-check">${done ? "✅" : "⬜"}</span>` +
      `<span class="daily-label">${q.label}</span>` +
      `<span class="daily-prog">${done ? "達成!" : `${prog} / ${q.target}`}</span>` +
      `<span class="daily-xp">+${q.gems}💎</span>`;
    list.appendChild(row);
  });
}

function renderMonthlyMini() {
  const m = ensureMonth();
  const pts = Math.min(m.points, MONTHLY_TARGET);
  const mo = Number(m.ym.slice(5, 7));
  const owned = state.monthlyBadges.some((b) => b.ym === m.ym);
  const el = document.getElementById("monthly-mini");
  el.innerHTML =
    `<div class="monthly-mini-head"><span>🏆 ${mo}月のバッジ</span>` +
    `<span>${owned ? "獲得済み🎉" : `${pts} / ${MONTHLY_TARGET}`}</span></div>` +
    `<div class="mini-bar"><div class="mini-bar-fill" style="width:${(pts / MONTHLY_TARGET) * 100}%"></div></div>`;
}

// ---- 記録タブ: 月間バッジのコレクション ----

function renderMonthlyBadges() {
  const m = ensureMonth();
  const pts = Math.min(m.points, MONTHLY_TARGET);
  const owned = state.monthlyBadges.some((b) => b.ym === m.ym);
  document.getElementById("monthly-progress-text").textContent = owned
    ? `今月のバッジは獲得済み!(クエスト ${m.points} 達成)`
    : `今月のバッジまで クエスト ${pts} / ${MONTHLY_TARGET}(デイリー・週間クエストの達成で貯まります)`;
  document.getElementById("monthly-bar-fill").style.width = `${(pts / MONTHLY_TARGET) * 100}%`;

  const grid = document.getElementById("monthly-badge-grid");
  grid.innerHTML = "";
  const badges = [...state.monthlyBadges].sort((a, b) => a.ym.localeCompare(b.ym));
  if (badges.length === 0) {
    grid.innerHTML = `<p class="empty-note">まだ月間バッジはありません。今月クエストを${MONTHLY_TARGET}回達成すると最初のバッジがもらえます。</p>`;
    return;
  }
  badges.forEach((b) => {
    const item = document.createElement("div");
    item.className = "badge-item";
    item.innerHTML =
      `<div class="badge-icon">${b.icon}</div>` +
      `<div class="badge-name">${b.name}</div>` +
      `<div class="badge-desc">${b.ym}</div>`;
    grid.appendChild(item);
  });
}

// ---- 推定スコア ----
// アプリの演習成績(正答率)からTOEIC L&Rの目安スコアを推定する。
// リスニング=Part1+Part2、リーディング=文法(Part5)+読解(Part7)+単語(語彙は基礎として軽め重み)。
// 練習問題は本番より易しくSRSの反復で正答率が上がりやすいため、acc^1.3のやや保守的な曲線で換算する。

function pairSum(statsObj, weight) {
  const w = weight === undefined ? 1 : weight;
  let ok = 0, seen = 0;
  Object.values(statsObj).forEach((st) => { ok += (st.ok || 0) * w; seen += (st.seen || 0) * w; });
  return { ok, seen };
}

// 正答率(0..1)→ セクションスコア(5..495、5点刻み)
function sectionScoreFromAcc(acc) {
  const eff = Math.pow(Math.max(0, Math.min(1, acc)), 1.3);
  return Math.max(5, Math.min(495, Math.round((5 + eff * 490) / 5) * 5));
}

// 推定スコアの内訳を計算(データ不足のセクションは seen で判定)
function estimateScore() {
  const agg = aggregates();
  const p1 = pairSum(state.part1Stats);
  const p2 = pairSum(state.listenStats);
  const p3 = pairSum(state.part3Stats); // Part 3(会話): seen/okは設問数の累計
  const p4 = pairSum(state.part4Stats); // Part 4(トーク): 同上
  const listenSeen = p1.seen + p2.seen + p3.seen + p4.seen;
  const listenOk = p1.ok + p2.ok + p3.ok + p4.ok;
  // リーディング: 文法・読解は等倍、語彙(単語)は基礎指標として0.5倍で反映
  const gr = pairSum(state.quizStats);
  const vo = pairSum(state.words, 0.5);
  const readSeen = gr.seen + vo.seen + agg.read;
  const readOk = gr.ok + vo.ok + agg.readOk;
  return {
    listenSeen, readSeen,
    listen: listenSeen > 0 ? sectionScoreFromAcc(listenOk / listenSeen) : null,
    read: readSeen > 0 ? sectionScoreFromAcc(readOk / readSeen) : null,
  };
}

function renderScore() {
  const est = estimateScore();
  const totalEl = document.getElementById("score-total-num");
  const lEl = document.getElementById("score-listen");
  const rEl = document.getElementById("score-read");
  const diag = document.getElementById("score-diagnosis");

  const MIN_SEEN = 10; // これ未満のセクションは推定を控える
  const listenReady = est.listenSeen >= MIN_SEEN;
  const readReady = est.readSeen >= MIN_SEEN;

  lEl.textContent = listenReady ? est.listen : "--";
  rEl.textContent = readReady ? est.read : "--";

  if (!listenReady && !readReady) {
    totalEl.textContent = "--";
    diag.textContent = "各セクションを少し解くと推定スコアが表示されます。";
    return;
  }
  if (!listenReady || !readReady) {
    totalEl.textContent = "--";
    diag.textContent = listenReady
      ? "単語・文法・読解をもう少し解くとリーディングも推定できます。"
      : "リスニングをもう少し解くと推定できます。";
    return;
  }

  const total = est.listen + est.read;
  totalEl.textContent = total;
  const target = state.settings.targetScore || 600;
  const parts = [];
  parts.push(total < target ? `目標${target}まであと ${target - total} 点` : `目標${target}を突破!🎉`);
  parts.push(est.listen <= est.read ? "次はリスニング重点がおすすめ" : "次はリーディング重点がおすすめ");
  const conf = Math.min(est.listenSeen, est.readSeen);
  diag.textContent = parts.join(" ／ ") + (conf < 20 ? "(まだデータ少なめ・参考値)" : "");
}

function renderHome() {
  renderScore();
  const days = daysUntil(state.settings.examDate);
  document.getElementById("countdown-num").textContent = days >= 0 ? days : "--";
  const [y, m, d] = state.settings.examDate.split("-").map(Number);
  document.getElementById("countdown-date").textContent =
    days >= 0 ? `${y}年${m}月${d}日` : "試験日を設定してください(⚙️)";

  const log = state.log[todayKey()] || { words: 0, quiz: 0, correct: 0, listen: 0, read: 0 };
  const listen = log.listen || 0;
  const read = log.read || 0;
  const gw = state.settings.goalWords;
  const gq = state.settings.goalQuiz;
  const gl = state.settings.goalListen;
  const gr = state.settings.goalRead;
  document.getElementById("goal-bar-words").style.width = `${Math.min(100, (log.words / gw) * 100)}%`;
  document.getElementById("goal-bar-quiz").style.width = `${Math.min(100, (log.quiz / gq) * 100)}%`;
  document.getElementById("goal-bar-listen").style.width = `${Math.min(100, (listen / gl) * 100)}%`;
  document.getElementById("goal-bar-read").style.width = `${Math.min(100, (read / gr) * 100)}%`;
  document.getElementById("goal-count-words").textContent = `${log.words} / ${gw}枚`;
  document.getElementById("goal-count-quiz").textContent = `${log.quiz} / ${gq}問`;
  document.getElementById("goal-count-listen").textContent = `${listen} / ${gl}問`;
  document.getElementById("goal-count-read").textContent = `${read} / ${gr}問`;

  const msg = document.getElementById("goal-message");
  if (log.words >= gw && log.quiz >= gq && listen >= gl && read >= gr) {
    msg.textContent = "今日のノルマ達成!この調子!🎉";
  } else if (log.words + log.quiz + listen + read > 0) {
    msg.textContent = "いいペース!あと少し💪";
  } else {
    msg.textContent = "";
  }

  renderStreakHero();
  renderLeague();
  renderWeekly();
  renderMonthlyMini();
  document.getElementById("stat-streak").textContent = calcStreak();
  document.getElementById("stat-mastered").textContent = countMastered();

  // レベル・称号・XP
  const li = levelInfo(state.xp);
  document.getElementById("level-num").textContent = li.level;
  document.getElementById("level-title").textContent = titleForLevel(li.level);
  document.getElementById("level-bar-fill").style.width = `${(li.into / li.need) * 100}%`;
  document.getElementById("level-xp").textContent = `${li.into} / ${li.need} XP`;

  // デイリーチャレンジ
  const daily = ensureDaily();
  const dLog = state.log[todayKey()] || { words: 0, quiz: 0, correct: 0, listen: 0, listenOk: 0 };
  const list = document.getElementById("daily-list");
  list.innerHTML = "";
  dailyChallenges().forEach((c) => {
    const done = daily.claimed.includes(c.id);
    const prog = Math.min(c.progress(dLog), c.target);
    const row = document.createElement("div");
    row.className = "daily-row" + (done ? " done" : "");
    row.innerHTML =
      `<span class="daily-check">${done ? "✅" : "⬜"}</span>` +
      `<span class="daily-label">${c.label}</span>` +
      `<span class="daily-prog">${done ? "達成!" : `${prog} / ${c.target}`}</span>` +
      `<span class="daily-xp">+${c.xp}XP</span>`;
    list.appendChild(row);
  });
}

// ---- 単語学習 ----

let wordQueue = [];
let wordPos = 0;
let sessionOk = 0;

function dueAndNewCounts() {
  const today = todayKey();
  let due = 0;
  let seen = 0;
  WORDS.forEach((_, i) => {
    const st = state.words[i];
    if (st) {
      seen++;
      if (st.next <= today) due++;
    }
  });
  return { due, fresh: WORDS.length - seen };
}

function buildWordQueue() {
  const today = todayKey();
  const due = [];
  const fresh = [];
  WORDS.forEach((_, i) => {
    const st = state.words[i];
    if (st) {
      if (st.next <= today) due.push(i);
    } else {
      fresh.push(i);
    }
  });
  // 復習(レベルが低い順)を優先し、残りを新しい単語で埋める
  due.sort((a, b) => (state.words[a].lv - state.words[b].lv));
  const size = state.settings.goalWords;
  // 復習が多い日が続いても新しい単語が永遠に出なくならないよう、毎回一定数は新出枠として確保する
  const newSlots = Math.min(fresh.length, Math.max(1, Math.round(size * 0.3)));
  const queue = fresh.splice(0, newSlots);
  while (queue.length < size && due.length > 0) queue.push(due.shift());
  while (queue.length < size && fresh.length > 0) queue.push(fresh.shift());
  return queue;
}

// 定着度の分布(Ankiの Mature / Young / Learning / New に相当)
// 習得済み: lv4(14日間隔) / 定着中: lv2-3(3〜7日間隔) / 学習中: lv0-1(1日以下) / 未学習
// 単語・文法クイズ共通で使う
function srsRetentionCounts(totalLen, stats) {
  const c = { mature: 0, young: 0, learning: 0, fresh: 0 };
  for (let i = 0; i < totalLen; i++) {
    const st = stats[i];
    if (!st || st.seen === 0) c.fresh++;
    else if (st.lv >= 4) c.mature++;
    else if (st.lv >= 2) c.young++;
    else c.learning++;
  }
  return c;
}

function retentionCounts() {
  return srsRetentionCounts(WORDS.length, state.words);
}

function renderRetentionBar(barId, c, total) {
  const bar = document.getElementById(barId);
  bar.querySelector(".ret-mature").style.width = `${(c.mature / total) * 100}%`;
  bar.querySelector(".ret-young").style.width = `${(c.young / total) * 100}%`;
  bar.querySelector(".ret-learning").style.width = `${(c.learning / total) * 100}%`;
  bar.querySelector(".ret-new").style.width = `${(c.fresh / total) * 100}%`;
}

function retentionText(c) {
  return `習得済み ${c.mature} ／ 定着中 ${c.young} ／ 学習中 ${c.learning} ／ 未学習 ${c.fresh}`;
}

// 今後7日間の復習予定(単語・文法・リスニング共通。複数の記録をまとめて集計できる)
function renderForecast(containerId, statsList) {
  const all = statsList.flatMap((stats) => Object.values(stats));
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  const today = todayKey();
  const dueCounts = [];
  for (let d = 0; d < 7; d++) {
    const key = addDays(today, d);
    let n = 0;
    all.forEach((st) => {
      // 今日の列には期限切れ(過去日)も含める
      if (d === 0 ? st.next <= today : st.next === key) n++;
    });
    dueCounts.push({ key, n });
  }
  const max = Math.max(5, ...dueCounts.map((x) => x.n));
  dueCounts.forEach(({ key, n }, d) => {
    const col = document.createElement("div");
    col.className = "fore-col";
    const num = document.createElement("span");
    num.className = "fore-num";
    num.textContent = n > 0 ? n : "";
    const bar = document.createElement("div");
    bar.className = "fore-bar" + (n === 0 ? " empty" : "");
    bar.style.height = `${Math.max(3, (n / max) * 100)}%`;
    const day = document.createElement("span");
    day.className = "fore-day";
    day.textContent = d === 0 ? "今日" : d === 1 ? "明日" : `${Number(key.split("-")[1])}/${Number(key.split("-")[2])}`;
    col.appendChild(num);
    col.appendChild(bar);
    col.appendChild(day);
    container.appendChild(col);
  });
}

function renderWordsStart() {
  document.getElementById("words-start").classList.remove("hidden");
  document.getElementById("words-session").classList.add("hidden");
  document.getElementById("words-result").classList.add("hidden");
  const { due, fresh } = dueAndNewCounts();
  document.getElementById("words-summary").innerHTML =
    `復習する単語: <strong>${due}</strong> 枚<br>新しい単語: <strong>${fresh}</strong> 枚(全${WORDS.length}語)`;
  const c = retentionCounts();
  renderRetentionBar("words-retention-bar", c, WORDS.length);
  document.getElementById("words-retention-text").textContent = retentionText(c);
}

// 単語の読み上げ(リスニングと同じ音声合成を利用)
function speakWord(text) {
  if (!speechOk || !text) return;
  audioStarted = true;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  const v = pickVoice();
  if (v) u.voice = v;
  u.rate = 0.95;
  speechSynthesis.speak(u);
}

function currentWord() {
  return wordQueue.length > 0 ? WORDS[wordQueue[wordPos]] : null;
}

function startWordSession() {
  wordQueue = buildWordQueue();
  if (wordQueue.length === 0) {
    alert("今日学習する単語はありません。明日また復習しましょう!");
    return;
  }
  // iOS Safari向け: タップ直下で音声を有効化(リスニングと同じ対策)
  if (speechOk) {
    audioStarted = true;
    speechSynthesis.speak(new SpeechSynthesisUtterance(""));
  }
  wordPos = 0;
  sessionOk = 0;
  sessionXp = 0;
  document.getElementById("words-start").classList.add("hidden");
  document.getElementById("words-result").classList.add("hidden");
  document.getElementById("words-session").classList.remove("hidden");
  showCard();
}

function showCard() {
  const i = wordQueue[wordPos];
  const w = WORDS[i];
  document.getElementById("words-progress").textContent = `${wordPos + 1} / ${wordQueue.length}`;
  document.getElementById("fc-word").textContent = w.w;
  const ipa = typeof IPA !== "undefined" && IPA[w.w] ? `/${IPA[w.w]}/` : "";
  document.getElementById("fc-ipa").textContent = ipa;
  document.getElementById("fc-ipa-back").textContent = ipa;
  document.getElementById("fc-pos").textContent = `[${w.p}]`;
  document.getElementById("fc-word-back").textContent = w.w;
  document.getElementById("fc-meaning").textContent = w.m;
  document.getElementById("fc-example").textContent = w.e;
  document.getElementById("flashcard-front").classList.remove("hidden");
  document.getElementById("flashcard-back").classList.add("hidden");
  document.getElementById("fc-actions").classList.add("hidden");
  // 音声が使えない端末では🔊ボタンを隠す
  document.querySelectorAll(".word-speak-btn").forEach((b) => b.classList.toggle("hidden", !speechOk));
  if (state.settings.autoSpeak) speakWord(w.w);
}

function flipCard() {
  if (!document.getElementById("flashcard-back").classList.contains("hidden")) return;
  document.getElementById("flashcard-front").classList.add("hidden");
  document.getElementById("flashcard-back").classList.remove("hidden");
  document.getElementById("fc-actions").classList.remove("hidden");
}

function answerCard(remembered) {
  const i = wordQueue[wordPos];
  const st = state.words[i] || { lv: 0, next: todayKey(), seen: 0, ok: 0 };
  st.seen++;
  if (remembered) {
    seTick();
    st.ok++;
    sessionOk++;
    st.lv = Math.min(MAX_LEVEL, st.lv + 1);
  } else {
    st.lv = 0;
  }
  addXp(remembered ? 5 : 2); // 「まだ」でも取り組んだ分のXPが入る
  checkDailyChallenges();
  st.next = addDays(todayKey(), INTERVALS[st.lv]);
  state.words[i] = st;
  todayLog().words++;
  saveState();

  wordPos++;
  if (wordPos < wordQueue.length) {
    showCard();
  } else {
    finishWordSession();
  }
}

function finishWordSession() {
  seFinish();
  addXp(20); // セット完了ボーナス
  saveState();
  checkDailyChallenges();
  document.getElementById("words-session").classList.add("hidden");
  document.getElementById("words-result").classList.remove("hidden");
  document.getElementById("words-result-text").innerHTML =
    `${wordQueue.length}枚学習しました。<br>「覚えた」: <strong>${sessionOk}</strong> 枚 / 「まだ」: <strong>${wordQueue.length - sessionOk}</strong> 枚` +
    `<br>獲得XP: <strong>+${sessionXp}</strong> ✨`;
  maybeCelebrateGoal();
}

document.getElementById("words-start-btn").addEventListener("click", startWordSession);
document.getElementById("words-again-btn").addEventListener("click", startWordSession);
document.getElementById("flashcard").addEventListener("click", flipCard);
document.getElementById("fc-ok-btn").addEventListener("click", () => answerCard(true));
document.getElementById("fc-ng-btn").addEventListener("click", () => answerCard(false));

// 🔊ボタン(カードのタップ=めくり操作に伝播させない)
document.getElementById("fc-speak").addEventListener("click", (e) => {
  e.stopPropagation();
  const w = currentWord();
  if (w) speakWord(w.w);
});
document.getElementById("fc-speak-back").addEventListener("click", (e) => {
  e.stopPropagation();
  const w = currentWord();
  if (w) speakWord(w.w);
});
document.getElementById("fc-speak-example").addEventListener("click", (e) => {
  e.stopPropagation();
  const w = currentWord();
  // 例文の英語部分だけを読み上げる(和訳の括弧より前)
  if (w) speakWord(w.e.split("(")[0].trim());
});

// ---- 文法クイズ ----

let quizQueue = [];
let quizPos = 0;
let quizCorrect = 0;
let quizCombo = 0;

// タイムアタックモード(1問20秒・本番Part 5と同じペース)
const TA_SECONDS = 20;
let quizTimed = false;
let taTimer = null;
let taRemaining = 0;

function startTaTimer() {
  stopTaTimer();
  taRemaining = TA_SECONDS;
  const fill = document.getElementById("ta-timer-fill");
  fill.style.width = "100%";
  fill.classList.remove("low");
  taTimer = setInterval(() => {
    taRemaining -= 0.1;
    fill.style.width = `${Math.max(0, (taRemaining / TA_SECONDS) * 100)}%`;
    fill.classList.toggle("low", taRemaining <= 5);
    if (taRemaining <= 0) {
      stopTaTimer();
      answerQuestion(-1, null, true); // 時間切れ=不正解扱い
    }
  }, 100);
}

function stopTaTimer() {
  if (taTimer) {
    clearInterval(taTimer);
    taTimer = null;
  }
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 単語と同じ間隔反復: 復習期日が来た問題(レベルが低い順)→ 新規問題 の優先で10問。
// それでも足りなければ復習予定を前倒しして常に1セット組めるようにする。
function buildQuizQueue() {
  const today = todayKey();
  const due = [];
  const fresh = [];
  const future = [];
  QUESTIONS.forEach((_, i) => {
    const st = state.quizStats[i];
    if (!st || st.seen === 0) fresh.push(i);
    else if (st.next <= today) due.push(i);
    else future.push(i);
  });
  due.sort((a, b) => state.quizStats[a].lv - state.quizStats[b].lv);
  shuffleArray(fresh);
  // 復習が多い日が続いても新しい問題が永遠に出なくならないよう、毎回一定数は新出枠として確保する
  const newSlots = Math.min(fresh.length, Math.max(1, Math.round(QUIZ_SET_SIZE * 0.3)));
  const queue = fresh.splice(0, newSlots);
  while (queue.length < QUIZ_SET_SIZE && due.length > 0) queue.push(due.shift());
  while (queue.length < QUIZ_SET_SIZE && fresh.length > 0) queue.push(fresh.shift());
  if (queue.length < QUIZ_SET_SIZE) {
    future.sort((a, b) => (state.quizStats[a].next < state.quizStats[b].next ? -1 : 1));
    while (queue.length < QUIZ_SET_SIZE && future.length > 0) queue.push(future.shift());
  }
  return shuffleArray(queue);
}

function quizDueAndNewCounts() {
  const today = todayKey();
  let due = 0;
  let fresh = 0;
  QUESTIONS.forEach((_, i) => {
    const st = state.quizStats[i];
    if (!st || st.seen === 0) fresh++;
    else if (st.next <= today) due++;
  });
  return { due, fresh };
}

function renderQuizStart() {
  document.getElementById("quiz-start").classList.remove("hidden");
  document.getElementById("quiz-session").classList.add("hidden");
  document.getElementById("quiz-result").classList.add("hidden");
  const { due, fresh } = quizDueAndNewCounts();
  document.getElementById("quiz-summary").innerHTML =
    `復習する問題: <strong>${due}</strong> 問<br>新しい問題: <strong>${fresh}</strong> 問(全${QUESTIONS.length}問)`;
  const c = srsRetentionCounts(QUESTIONS.length, state.quizStats);
  renderRetentionBar("quiz-retention-bar", c, QUESTIONS.length);
  document.getElementById("quiz-retention-text").textContent = retentionText(c);
}

function startQuiz(timed) {
  quizTimed = timed === true;
  quizQueue = buildQuizQueue();
  quizPos = 0;
  quizCorrect = 0;
  quizCombo = 0;
  sessionXp = 0;
  document.getElementById("ta-timer").classList.toggle("hidden", !quizTimed);
  document.getElementById("quiz-start").classList.add("hidden");
  document.getElementById("quiz-result").classList.add("hidden");
  document.getElementById("quiz-session").classList.remove("hidden");
  showQuestion();
}

function showQuestion() {
  const qi = quizQueue[quizPos];
  const q = QUESTIONS[qi];
  document.getElementById("quiz-progress").textContent = `${quizPos + 1} / ${quizQueue.length}`;
  document.getElementById("quiz-type").textContent = q.t;
  document.getElementById("quiz-question").textContent = q.q;
  document.getElementById("quiz-feedback").classList.add("hidden");

  // 選択肢をシャッフルして表示(正解の位置を覚えてしまうのを防ぐ)
  const order = q.c.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const box = document.getElementById("quiz-choices");
  box.innerHTML = "";
  const labels = ["(A)", "(B)", "(C)", "(D)"];
  order.forEach((orig, pos) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.dataset.orig = orig;
    btn.textContent = `${labels[pos]} ${q.c[orig]}`;
    btn.addEventListener("click", () => answerQuestion(orig, btn));
    box.appendChild(btn);
  });

  if (quizTimed) startTaTimer();
}

function answerQuestion(chosen, btn, timedOut) {
  stopTaTimer();
  const qi = quizQueue[quizPos];
  const q = QUESTIONS[qi];
  const correct = chosen === q.a;
  if (correct) {
    quizCombo++;
    seCorrect(quizCombo);
  } else {
    quizCombo = 0;
    seWrong();
  }
  // タイムアタックで残り半分以上を残して正解するとスピードボーナス
  const speedBonus = quizTimed && correct && taRemaining >= TA_SECONDS / 2 ? 5 : 0;
  const gained = (correct ? (quizCombo >= 3 ? 15 : 10) : 2) + speedBonus;
  addXp(gained);

  document.querySelectorAll(".choice-btn").forEach((b) => {
    b.disabled = true;
    if (Number(b.dataset.orig) === q.a) b.classList.add("correct");
  });
  if (!correct && btn) btn.classList.add("wrong");

  // 単語と同じ間隔反復: 正解でレベルUP(間隔が延びる)、不正解でレベル0に戻す
  const st = state.quizStats[qi] || { lv: 0, next: todayKey(), seen: 0, ok: 0 };
  st.seen++;
  if (correct) {
    st.ok++;
    quizCorrect++;
    st.lv = Math.min(MAX_LEVEL, st.lv + 1);
  } else {
    st.lv = 0;
  }
  st.next = addDays(todayKey(), INTERVALS[st.lv]);
  state.quizStats[qi] = st;
  const log = todayLog();
  log.quiz++;
  if (correct) {
    log.correct++;
    log.maxCombo = Math.max(log.maxCombo || 0, quizCombo);
  }
  saveState();
  checkDailyChallenges();

  const verdict = document.getElementById("quiz-verdict");
  verdict.textContent = correct
    ? `正解! ⭕ +${gained}XP${speedBonus ? " ⚡" : ""}${quizCombo >= 2 ? ` 🔥${quizCombo}連続!` : ""}`
    : timedOut ? "時間切れ… ⏱️ +2XP" : "残念… ❌ +2XP";
  verdict.className = `quiz-verdict ${correct ? "good" : "bad"}`;

  const script = document.getElementById("quiz-script");
  script.innerHTML = "";
  if (q.jq) {
    const filled = q.q.replace("-------", q.c[q.a]);
    const qLine = document.createElement("p");
    qLine.className = "script-q";
    qLine.innerHTML = `<strong>${filled}</strong><br><span>${q.jq}</span>`;
    script.appendChild(qLine);
  }
  document.getElementById("quiz-explanation").textContent = q.x;
  const nextBtn = document.getElementById("quiz-next-btn");
  nextBtn.textContent = quizPos + 1 < quizQueue.length ? "次の問題へ" : "結果を見る";
  document.getElementById("quiz-feedback").classList.remove("hidden");
}

function nextQuestion() {
  quizPos++;
  if (quizPos < quizQueue.length) {
    showQuestion();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  seFinish();
  stopTaTimer();
  const pct = Math.round((quizCorrect / quizQueue.length) * 100);
  addXp(20 + (pct === 100 ? 30 : 0)); // 完了ボーナス+パーフェクトボーナス
  if (pct === 100) {
    const log = todayLog();
    log.perfects = (log.perfects || 0) + 1;
    if (quizTimed) state.taPerfect = true; // 実績「スピードスター」用
  }
  saveState();
  checkDailyChallenges();
  document.getElementById("quiz-session").classList.add("hidden");
  document.getElementById("quiz-result").classList.remove("hidden");
  const emoji = pct === 100 ? "👑" : pct >= 80 ? "🏆" : pct >= 60 ? "🎉" : "📖";
  const title = pct === 100 ? "パーフェクト!!" : pct >= 80 ? "すばらしい!" : pct >= 60 ? "その調子!" : "解説を復習しよう";
  document.getElementById("quiz-result-emoji").textContent = emoji;
  document.getElementById("quiz-result-title").textContent = title;
  document.getElementById("quiz-result-text").innerHTML =
    `${quizQueue.length}問中 <strong>${quizCorrect}</strong> 問正解(${pct}%)<br>間違えた問題は次のセットにも出やすくなります。` +
    `<br>獲得XP: <strong>+${sessionXp}</strong> ✨${pct === 100 ? "(パーフェクトボーナス +30 込み)" : ""}`;
  if (pct === 100) confetti();
  maybeCelebrateGoal();
}

document.getElementById("quiz-start-btn").addEventListener("click", () => startQuiz(false));
document.getElementById("quiz-ta-btn").addEventListener("click", () => startQuiz(true));
document.getElementById("quiz-again-btn").addEventListener("click", () => startQuiz(quizTimed));
document.getElementById("quiz-next-btn").addEventListener("click", nextQuestion);

// ---- リスニング (Part 1: 写真描写 / Part 2: 応答問題) ----
// 音声は端末内蔵の音声合成(Web Speech API)を使用。
// PART1/PART2データは r[0] が常に正解で、表示・読み上げ順を毎回シャッフルする。

const LISTEN_SET_SIZE = 10; // Part 2の1セット
const PART1_SET_SIZE = 6;   // Part 1の1セット(本番と同じ6問)
const speechOk = "speechSynthesis" in window;

let listenMode = 2; // 1 = Part 1, 2 = Part 2
let audioStarted = false; // 一度でも音声再生したらtrue(未使用時はTTSに触れない)
let listenQueue = [];
let listenPos = 0;
let listenCorrect = 0;
let listenCombo = 0;
let listenOrder = [0, 1, 2];

function listenData() {
  return listenMode === 1 ? PART1 : PART2;
}
function listenStatsStore() {
  return listenMode === 1 ? state.part1Stats : state.listenStats;
}
let playToken = 0; // 再生の割り込み制御(増えたら進行中の再生を中断)
let cachedVoice = null;

function pickVoice() {
  if (cachedVoice) return cachedVoice;
  const vs = speechSynthesis.getVoices();
  cachedVoice =
    vs.find((v) => v.lang === "en-US" && /Google/.test(v.name)) ||
    vs.find((v) => v.lang === "en-US") ||
    vs.find((v) => v.lang.startsWith("en")) ||
    null;
  return cachedVoice;
}
if (speechOk) {
  speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
    voiceMW = null;
    pickVoice();
  };
}

function speak(text, rate) {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = rate || 0.92;
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}

// 話者ごとに声を変える。別の英語音声が2つ以上あれば男女に割り当て、
// 無ければ同じ声のピッチをずらして区別する(どの端末でも話者が聞き分けられるように)。
let voiceMW = null; // { m, w } 男女の音声(取れれば)
function pickVoicesMW() {
  if (voiceMW) return voiceMW;
  const vs = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
  const w = vs.find((v) => /female|zira|samantha|susan|karen|moira|tessa|fiona|serena|catherine|hazel|linda|female|woman/i.test(v.name));
  const m = vs.find((v) => v !== w && /male|david|daniel|alex|fred|george|mark|rishi|guy|aaron|man/i.test(v.name));
  voiceMW = { m: m || null, w: w || null };
  return voiceMW;
}
// 話者→ピッチ(声の割り当てが無い端末でも聞き分けられるように)
const SPEAKER_PITCH = { W: 1.28, W2: 1.45, M: 0.82, M2: 0.68, N: 1.0 };

function speakAs(text, speaker, rate) {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    const mw = pickVoicesMW();
    const isW = speaker === "W" || speaker === "W2";
    const assigned = isW ? mw.w : (speaker === "M" || speaker === "M2") ? mw.m : null;
    u.voice = assigned || pickVoice() || null;
    u.rate = rate || 0.95;
    u.pitch = SPEAKER_PITCH[speaker] !== undefined ? SPEAKER_PITCH[speaker] : 1.0;
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function playListenAudio() {
  if (!speechOk) return;
  audioStarted = true;
  const token = ++playToken;
  speechSynthesis.cancel();
  await wait(200);
  if (token !== playToken) return;
  const item = listenData()[listenQueue[listenPos]];
  await speak(listenMode === 1 ? "Look at the picture." : item.q);
  if (token !== playToken) return;
  await wait(700);
  const labels = ["A", "B", "C", "D"];
  for (let i = 0; i < item.r.length; i++) {
    if (token !== playToken) return;
    await speak(labels[i] + ".", 1.0);
    if (token !== playToken) return;
    await speak(item.r[listenOrder[i]]);
    await wait(500);
  }
}

function stopListenAudio() {
  playToken++;
  // リスニング未使用ならTTSに触れない(不要な音声エンジン初期化を防ぐ)
  if (speechOk && audioStarted) speechSynthesis.cancel();
}

// 単語・文法と同じ間隔反復: 復習期日が来た問題 → 新規 → 復習の前倒し
function buildListenQueue() {
  const data = listenData();
  const stats = listenStatsStore();
  const size = listenMode === 1 ? PART1_SET_SIZE : LISTEN_SET_SIZE;
  const today = todayKey();
  const due = [];
  const fresh = [];
  const future = [];
  data.forEach((_, i) => {
    const st = stats[i];
    if (!st || st.seen === 0) fresh.push(i);
    else if (st.next <= today) due.push(i);
    else future.push(i);
  });
  due.sort((a, b) => stats[a].lv - stats[b].lv);
  shuffleArray(fresh);
  // 復習が多い日が続いても新しい問題が永遠に出なくならないよう、毎回一定数は新出枠として確保する
  const newSlots = Math.min(fresh.length, Math.max(1, Math.round(size * 0.3)));
  const queue = fresh.splice(0, newSlots);
  while (queue.length < size && due.length > 0) queue.push(due.shift());
  while (queue.length < size && fresh.length > 0) queue.push(fresh.shift());
  if (queue.length < size) {
    future.sort((a, b) => (stats[a].next < stats[b].next ? -1 : 1));
    while (queue.length < size && future.length > 0) queue.push(future.shift());
  }
  return shuffleArray(queue);
}

function listenDueNewCounts(data, stats) {
  const today = todayKey();
  let due = 0;
  let fresh = 0;
  data.forEach((_, i) => {
    const st = stats[i];
    if (!st || st.seen === 0) fresh++;
    else if (st.next <= today) due++;
  });
  return { due, fresh };
}

function renderListenStart() {
  document.getElementById("listen-start").classList.remove("hidden");
  document.getElementById("listen-session").classList.add("hidden");
  document.getElementById("listen-result").classList.add("hidden");
  document.getElementById("listen34-session").classList.add("hidden");
  document.getElementById("listen34-result").classList.add("hidden");
  document.getElementById("listen-warn").classList.toggle("hidden", speechOk);
  // Part 1 / Part 2 それぞれの復習・新規数と定着度バー
  const p1 = listenDueNewCounts(PART1, state.part1Stats);
  document.getElementById("part1-summary").innerHTML =
    `復習する問題: <strong>${p1.due}</strong> 問 ／ 新しい問題: <strong>${p1.fresh}</strong> 問(全${PART1.length}問)`;
  renderRetentionBar("part1-retention-bar", srsRetentionCounts(PART1.length, state.part1Stats), PART1.length);
  const p2 = listenDueNewCounts(PART2, state.listenStats);
  document.getElementById("part2-summary").innerHTML =
    `復習する問題: <strong>${p2.due}</strong> 問 ／ 新しい問題: <strong>${p2.fresh}</strong> 問(全${PART2.length}問)`;
  renderRetentionBar("part2-retention-bar", srsRetentionCounts(PART2.length, state.listenStats), PART2.length);
  // Part 3(会話)/ Part 4(トーク)は会話/トーク単位の復習・新規数と定着度バー
  const p3 = l34SectionCounts(PART3, state.part3Stats);
  document.getElementById("part3-summary").innerHTML =
    `復習する会話: <strong>${p3.due}</strong> 本 ／ 新しい会話: <strong>${p3.fresh}</strong> 本(全${PART3.length}本・${setsQCount(PART3)}問)`;
  renderRetentionBar("part3-retention-bar", srsRetentionCounts(PART3.length, state.part3Stats), PART3.length);
  const p4 = l34SectionCounts(PART4, state.part4Stats);
  document.getElementById("part4-summary").innerHTML =
    `復習するトーク: <strong>${p4.due}</strong> 本 ／ 新しいトーク: <strong>${p4.fresh}</strong> 本(全${PART4.length}本・${setsQCount(PART4)}問)`;
  renderRetentionBar("part4-retention-bar", srsRetentionCounts(PART4.length, state.part4Stats), PART4.length);
}

function startListen(mode) {
  listenMode = mode;
  // iOS Safariはユーザー操作の直下でしか初回再生を許可しないため、
  // ボタンタップと同期的に空の発話を流して音声を有効化しておく
  if (speechOk) {
    audioStarted = true;
    speechSynthesis.speak(new SpeechSynthesisUtterance(""));
  }
  listenQueue = buildListenQueue();
  listenPos = 0;
  listenCorrect = 0;
  listenCombo = 0;
  sessionXp = 0;
  document.getElementById("listen-start").classList.add("hidden");
  document.getElementById("listen-result").classList.add("hidden");
  document.getElementById("listen-session").classList.remove("hidden");
  showListenQuestion();
}

function showListenQuestion() {
  const item = listenData()[listenQueue[listenPos]];
  document.getElementById("listen-progress").textContent =
    `Part ${listenMode}　${listenPos + 1} / ${listenQueue.length}`;
  document.getElementById("listen-feedback").classList.add("hidden");

  // Part 1はイラストを表示、Part 2では非表示
  const photo = document.getElementById("listen-photo");
  if (listenMode === 1) {
    photo.innerHTML = item.svg;
    photo.classList.remove("hidden");
  } else {
    photo.innerHTML = "";
    photo.classList.add("hidden");
  }

  // 選択肢の表示・読み上げ順をシャッフル(正解r[0]の位置が毎回変わる)
  listenOrder = item.r.map((_, i) => i);
  for (let i = listenOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [listenOrder[i], listenOrder[j]] = [listenOrder[j], listenOrder[i]];
  }

  const box = document.getElementById("listen-choices");
  box.innerHTML = "";
  box.classList.toggle("text-mode", !speechOk);
  box.classList.toggle("four", item.r.length === 4);
  ["A", "B", "C", "D"].slice(0, item.r.length).forEach((label, pos) => {
    const orig = listenOrder[pos];
    const btn = document.createElement("button");
    btn.className = "abc-btn";
    btn.dataset.orig = orig;
    // 音声が使えない端末では英文を表示して読解形式にする
    btn.textContent = speechOk ? `(${label})` : `(${label}) ${item.r[orig]}`;
    btn.addEventListener("click", () => answerListen(orig, btn));
    box.appendChild(btn);
  });

  playListenAudio();
}

function answerListen(chosen, btn) {
  stopListenAudio();
  const qi = listenQueue[listenPos];
  const item = listenData()[qi];
  const correct = chosen === 0;
  if (correct) {
    listenCombo++;
    seCorrect(listenCombo);
  } else {
    listenCombo = 0;
    seWrong();
  }
  const gained = correct ? (listenCombo >= 3 ? 15 : 10) : 2;
  addXp(gained);

  document.querySelectorAll(".abc-btn").forEach((b) => {
    b.disabled = true;
    if (Number(b.dataset.orig) === 0) b.classList.add("correct");
  });
  if (!correct) btn.classList.add("wrong");

  // 間隔反復: 正解でレベルUP(間隔が延びる)、不正解でレベル0に戻す
  const stats = listenStatsStore();
  const st = stats[qi] || { lv: 0, next: todayKey(), seen: 0, ok: 0 };
  st.seen++;
  if (correct) {
    st.ok++;
    listenCorrect++;
    st.lv = Math.min(MAX_LEVEL, st.lv + 1);
  } else {
    st.lv = 0;
  }
  st.next = addDays(todayKey(), INTERVALS[st.lv]);
  stats[qi] = st;
  const log = todayLog();
  log.listen = (log.listen || 0) + 1;
  if (correct) {
    log.listenOk = (log.listenOk || 0) + 1;
    log.maxCombo = Math.max(log.maxCombo || 0, listenCombo);
  }
  saveState();
  checkDailyChallenges();

  const verdict = document.getElementById("listen-verdict");
  verdict.textContent = correct
    ? `正解! ⭕ +${gained}XP${listenCombo >= 2 ? ` 🔥${listenCombo}連続!` : ""}`
    : "残念… ❌ +2XP";
  verdict.className = `quiz-verdict ${correct ? "good" : "bad"}`;
  document.getElementById("listen-type").textContent = item.t;

  const script = document.getElementById("listen-script");
  script.innerHTML = "";
  if (item.jq) {
    const qLine = document.createElement("p");
    qLine.className = "script-q";
    qLine.innerHTML = `<strong>${item.q}</strong><br><span>${item.jq}</span>`;
    script.appendChild(qLine);
  }
  ["A", "B", "C", "D"].slice(0, item.r.length).forEach((label, pos) => {
    const orig = listenOrder[pos];
    const line = document.createElement("p");
    line.className =
      "script-line" +
      (orig === 0 ? " correct" : "") +
      (orig === chosen && orig !== 0 ? " wrong" : "");
    line.innerHTML = `(${label}) ${item.r[orig]}<br><span>${item.jr[orig]}</span>`;
    script.appendChild(line);
  });

  document.getElementById("listen-explanation").textContent = item.x;
  document.getElementById("listen-next-btn").textContent =
    listenPos + 1 < listenQueue.length ? "次の問題へ" : "結果を見る";
  document.getElementById("listen-feedback").classList.remove("hidden");
}

function nextListenQuestion() {
  listenPos++;
  if (listenPos < listenQueue.length) {
    showListenQuestion();
  } else {
    finishListen();
  }
}

function finishListen() {
  seFinish();
  const pct = Math.round((listenCorrect / listenQueue.length) * 100);
  addXp(20 + (pct === 100 ? 30 : 0)); // 完了ボーナス+パーフェクトボーナス
  if (pct === 100) {
    const log = todayLog();
    log.perfects = (log.perfects || 0) + 1;
  }
  saveState();
  checkDailyChallenges();
  document.getElementById("listen-session").classList.add("hidden");
  document.getElementById("listen-result").classList.remove("hidden");
  const emoji = pct === 100 ? "👑" : pct >= 80 ? "🏆" : pct >= 60 ? "🎉" : "🎧";
  const title = pct === 100 ? "パーフェクト!!" : pct >= 80 ? "すばらしい!" : pct >= 60 ? "その調子!" : "スクリプトを復習しよう";
  document.getElementById("listen-result-emoji").textContent = emoji;
  document.getElementById("listen-result-title").textContent = title;
  document.getElementById("listen-result-text").innerHTML =
    `${listenQueue.length}問中 <strong>${listenCorrect}</strong> 問正解(${pct}%)<br>間違えた問題は次のセットにも出やすくなります。` +
    `<br>獲得XP: <strong>+${sessionXp}</strong> ✨${pct === 100 ? "(パーフェクトボーナス +30 込み)" : ""}`;
  if (pct === 100) confetti();
  maybeCelebrateGoal();
}

document.getElementById("part1-start-btn").addEventListener("click", () => startListen(1));
document.getElementById("listen-start-btn").addEventListener("click", () => startListen(2));
document.getElementById("listen-again-btn").addEventListener("click", () => startListen(listenMode));
document.getElementById("listen-play-btn").addEventListener("click", playListenAudio);
document.getElementById("listen-next-btn").addEventListener("click", nextListenQuestion);

// ---- リスニング Part 3(会話)/ Part 4(トーク)----
// 構造は読解セットと同じ「音声(会話/トーク)+ 複数設問」を1単位に。
// 本番同様、会話/トークは音声のみ(画面に出さない)。設問と選択肢は文字で表示する
// (Part 3/4は設問・選択肢が問題冊子に印刷されている形式)。SRSは会話/トーク単位。
// log.listen / listenOk に加算し、ノルマ・推定Listeningスコア・週間クエストに反映。

const L34_SET_SIZE = 2; // 1セッションで扱う会話/トーク数
let l34Section = 3;     // 3 = Part 3(会話), 4 = Part 4(トーク)
let l34Queue = [], l34Pos = 0, l34QPos = 0;
let l34Correct = 0, l34Total = 0, l34Combo = 0, l34SetCorrect = 0, l34SetOk = true, l34Order = [];

function l34Sets() { return l34Section === 3 ? PART3 : PART4; }
function l34Stats() { return l34Section === 3 ? state.part3Stats : state.part4Stats; }
function currentL34Set() { return l34Sets()[l34Queue[l34Pos]]; }
function spkLabel(s) { return ({ M: "男性", W: "女性", M2: "男性2", W2: "女性2", N: "ナレーター" })[s] || s; }

function buildL34Queue() {
  const sets = l34Sets();
  const stats = l34Stats();
  const size = Math.min(L34_SET_SIZE, sets.length);
  const today = todayKey();
  const due = [], fresh = [], future = [];
  sets.forEach((_, i) => {
    const st = stats[i];
    if (!st || st.seen === 0) fresh.push(i);
    else if (st.next <= today) due.push(i);
    else future.push(i);
  });
  due.sort((a, b) => stats[a].lv - stats[b].lv);
  shuffleArray(fresh);
  const newSlots = Math.min(fresh.length, Math.max(1, Math.round(size * 0.5)));
  const queue = fresh.splice(0, newSlots);
  while (queue.length < size && due.length > 0) queue.push(due.shift());
  while (queue.length < size && fresh.length > 0) queue.push(fresh.shift());
  if (queue.length < size) {
    future.sort((a, b) => (stats[a].next < stats[b].next ? -1 : 1));
    while (queue.length < size && future.length > 0) queue.push(future.shift());
  }
  return shuffleArray(queue);
}

function l34SectionCounts(sets, stats) {
  const today = todayKey();
  let due = 0, fresh = 0;
  sets.forEach((_, i) => {
    const st = stats[i];
    if (!st || st.seen === 0) fresh++;
    else if (st.next <= today) due++;
  });
  return { due, fresh };
}

async function playL34Audio() {
  if (!speechOk) return;
  audioStarted = true;
  const token = ++playToken;
  speechSynthesis.cancel();
  await wait(200);
  if (token !== playToken) return;
  const set = currentL34Set();
  await speakAs(l34Section === 3 ? "Listen to the following conversation." : "Listen to the following talk.", "N", 1.0);
  if (token !== playToken) return;
  await wait(500);
  for (const line of set.lines) {
    if (token !== playToken) return;
    await speakAs(line.text, line.s);
    if (token !== playToken) return;
    await wait(320);
  }
}

function renderL34Transcript() {
  const set = currentL34Set();
  const box = document.getElementById("listen34-transcript");
  box.innerHTML = "";
  set.lines.forEach((line) => {
    const p = document.createElement("p");
    p.className = "l34-line";
    p.innerHTML = `<span class="l34-spk">${spkLabel(line.s)}:</span> ${escapeHtml(line.text)}`;
    box.appendChild(p);
  });
  // 音声が使える端末では非表示(聞いて解く)。使えない端末はスクリプトを表示して読解形式に。
  box.classList.toggle("hidden", speechOk);
  document.getElementById("listen34-listening").classList.toggle("hidden", !speechOk);
}

function startListen34(section) {
  l34Section = section;
  if (l34Sets().length === 0) return;
  // iOS Safari対策: タップ直下で空発話して音声を有効化
  if (speechOk) { audioStarted = true; speechSynthesis.speak(new SpeechSynthesisUtterance("")); }
  l34Queue = buildL34Queue();
  if (l34Queue.length === 0) return;
  l34Pos = 0; l34Correct = 0; l34Total = 0; l34Combo = 0; sessionXp = 0;
  document.getElementById("listen-start").classList.add("hidden");
  document.getElementById("listen34-result").classList.add("hidden");
  document.getElementById("listen34-session").classList.remove("hidden");
  startNewL34Set();
}

// 図表参照問題用の図表(スケジュール表・料金表・案内板など)を表示する。
// 本番同様、図表は画面に印刷される想定でセット中ずっと表示し、音声のヒントと照合して解く。
function renderL34Graphic() {
  const set = currentL34Set();
  const box = document.getElementById("listen34-graphic");
  const g = set.graphic;
  if (!g || !Array.isArray(g.rows)) { box.classList.add("hidden"); box.innerHTML = ""; return; }
  let html = "";
  if (g.title) html += `<p class="l34-graphic-title">${escapeHtml(g.title)}</p>`;
  html += "<table class=\"l34-table\">";
  if (Array.isArray(g.headers)) {
    html += "<thead><tr>";
    g.headers.forEach((h) => { html += `<th>${escapeHtml(h)}</th>`; });
    html += "</tr></thead>";
  }
  html += "<tbody>";
  g.rows.forEach((r) => {
    html += "<tr>";
    r.forEach((c) => { html += `<td>${escapeHtml(c)}</td>`; });
    html += "</tr>";
  });
  html += "</tbody></table>";
  box.innerHTML = html;
  box.classList.remove("hidden");
}

function startNewL34Set() {
  l34QPos = 0; l34SetOk = true; l34SetCorrect = 0;
  renderL34Transcript();
  renderL34Graphic();
  playL34Audio();
  showL34Question();
  window.scrollTo(0, 0);
}

function showL34Question() {
  const set = currentL34Set();
  const q = set.qs[l34QPos];
  document.getElementById("listen34-progress").textContent =
    `Part ${l34Section}　${l34Section === 3 ? "会話" : "トーク"} ${l34Pos + 1}/${l34Queue.length}　設問 ${l34QPos + 1}/${set.qs.length}`;
  document.getElementById("listen34-question").textContent = q.q;
  document.getElementById("listen34-feedback").classList.add("hidden");
  l34Order = q.c.map((_, i) => i);
  shuffleArray(l34Order);
  const box = document.getElementById("listen34-choices");
  box.innerHTML = "";
  const labels = ["(A)", "(B)", "(C)", "(D)"];
  l34Order.forEach((orig, pos) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.dataset.orig = orig;
    btn.textContent = `${labels[pos]} ${q.c[orig]}`;
    btn.addEventListener("click", () => answerL34(orig, btn));
    box.appendChild(btn);
  });
}

function answerL34(chosen, btn) {
  stopListenAudio(); // 会話/トークの再生を止める
  const set = currentL34Set();
  const q = set.qs[l34QPos];
  const correct = chosen === q.a;
  if (correct) { l34Combo++; seCorrect(l34Combo); }
  else { l34Combo = 0; l34SetOk = false; seWrong(); }
  const gained = correct ? (l34Combo >= 3 ? 15 : 10) : 2;
  addXp(gained);
  document.querySelectorAll("#listen34-choices .choice-btn").forEach((b) => {
    b.disabled = true;
    if (Number(b.dataset.orig) === q.a) b.classList.add("correct");
  });
  if (!correct) btn.classList.add("wrong");

  l34Total++;
  if (correct) { l34Correct++; l34SetCorrect++; }
  const log = todayLog();
  log.listen = (log.listen || 0) + 1;
  if (correct) {
    log.listenOk = (log.listenOk || 0) + 1;
    log.maxCombo = Math.max(log.maxCombo || 0, l34Combo);
  }
  saveState();
  checkDailyChallenges();

  const verdict = document.getElementById("listen34-verdict");
  verdict.textContent = correct
    ? `正解! ⭕ +${gained}XP${l34Combo >= 2 ? ` 🔥${l34Combo}連続!` : ""}`
    : "残念… ❌ +2XP";
  verdict.className = `quiz-verdict ${correct ? "good" : "bad"}`;
  document.getElementById("listen34-type").textContent = `Part ${l34Section} ・ ${set.t}`;

  const script = document.getElementById("listen34-script");
  script.innerHTML = "";
  set.lines.forEach((line) => {
    const p = document.createElement("p");
    p.className = "script-line";
    p.innerHTML = `<strong>${spkLabel(line.s)}:</strong> ${escapeHtml(line.text)}<br><span>${escapeHtml(line.jtext || "")}</span>`;
    script.appendChild(p);
  });
  const qLine = document.createElement("p");
  qLine.className = "script-q";
  qLine.innerHTML = `<strong>${escapeHtml(q.q)}</strong><br><span>${escapeHtml(q.jq || "")}</span><br>正解: ${escapeHtml(q.c[q.a])}`;
  script.appendChild(qLine);

  document.getElementById("listen34-explanation").textContent = q.x;
  const isLastQ = l34QPos + 1 >= set.qs.length;
  const isLastSet = l34Pos + 1 >= l34Queue.length;
  document.getElementById("listen34-next-btn").textContent =
    !isLastQ ? "次の設問へ" : (isLastSet ? "結果を見る" : (l34Section === 3 ? "次の会話へ" : "次のトークへ"));
  document.getElementById("listen34-feedback").classList.remove("hidden");
}

function finalizeL34Set() {
  const stats = l34Stats();
  const idx = l34Queue[l34Pos];
  const set = l34Sets()[idx];
  const st = stats[idx] || { lv: 0, next: todayKey(), seen: 0, ok: 0 };
  st.seen += set.qs.length;   // 設問数を加算(推定スコアの正答率算出に使用)
  st.ok += l34SetCorrect;
  if (l34SetOk) st.lv = Math.min(MAX_LEVEL, st.lv + 1); // 全問正解でレベルUP
  else st.lv = 0;
  st.next = addDays(todayKey(), INTERVALS[st.lv]);
  stats[idx] = st;
  saveState();
}

function nextL34Question() {
  const set = currentL34Set();
  if (l34QPos + 1 < set.qs.length) { l34QPos++; showL34Question(); return; }
  finalizeL34Set();
  if (l34Pos + 1 < l34Queue.length) { l34Pos++; startNewL34Set(); }
  else finishL34();
}

function finishL34() {
  stopListenAudio();
  seFinish();
  const pct = l34Total > 0 ? Math.round((l34Correct / l34Total) * 100) : 0;
  addXp(20 + (pct === 100 ? 30 : 0));
  if (pct === 100) { const log = todayLog(); log.perfects = (log.perfects || 0) + 1; }
  saveState();
  checkDailyChallenges();
  document.getElementById("listen34-session").classList.add("hidden");
  document.getElementById("listen34-result").classList.remove("hidden");
  const emoji = pct === 100 ? "👑" : pct >= 80 ? "🏆" : pct >= 60 ? "🎉" : "🎧";
  const title = pct === 100 ? "パーフェクト!!" : pct >= 80 ? "すばらしい!" : pct >= 60 ? "その調子!" : "スクリプトを復習しよう";
  document.getElementById("listen34-result-emoji").textContent = emoji;
  document.getElementById("listen34-result-title").textContent = title;
  document.getElementById("listen34-result-text").innerHTML =
    `${l34Total}問中 <strong>${l34Correct}</strong> 問正解(${pct}%)<br>間違えた${l34Section === 3 ? "会話" : "トーク"}は次のセットにも出やすくなります。` +
    `<br>獲得XP: <strong>+${sessionXp}</strong> ✨${pct === 100 ? "(パーフェクトボーナス +30 込み)" : ""}`;
  if (pct === 100) confetti();
  maybeCelebrateGoal();
}

const _p3btn = document.getElementById("part3-start-btn");
if (_p3btn) _p3btn.addEventListener("click", () => startListen34(3));
const _p4btn = document.getElementById("part4-start-btn");
if (_p4btn) _p4btn.addEventListener("click", () => startListen34(4));
const _l34again = document.getElementById("listen34-again-btn");
if (_l34again) _l34again.addEventListener("click", () => startListen34(l34Section));
const _l34play = document.getElementById("listen34-play-btn");
if (_l34play) _l34play.addEventListener("click", playL34Audio);
const _l34next = document.getElementById("listen34-next-btn");
if (_l34next) _l34next.addEventListener("click", nextL34Question);

// ---- 読解 (Part 6: 長文穴埋め / Part 7: 文書読解) ----
// 読解タブは2セクション。どちらも「文書(セット)+ 複数設問」を1単位として扱う。
//   Part 7: READING(passages[]+qs[])。設問は内容理解。
//   Part 6: PART6(text内の {1}..{4} が空所 + qs[])。設問は空所補充・文挿入。
// SRSは「文書セット単位」: セット内の全設問に正解するとレベルUP(間隔が延びる)、
// 1問でも間違えるとレベル0に戻る。狙いは「速く正確に読む」練習なのでタイマーを表示する。
// Part 6・Part 7 とも本番のReadingセクションなので log.read に加算(ノルマ・推定Readingスコアに反映)。

const READ7_SET_SIZE = 2; // Part 7の1セッションで扱う文書数
const READ6_SET_SIZE = 2; // Part 6の1セッションで扱う長文数

let readSection = 7;  // 6 = Part 6(長文穴埋め), 7 = Part 7(読解)
let readQueue = [];   // 出題する文書セットindexの配列
let readPos = 0;      // 現在の文書セット(readQueue内の位置)
let readQPos = 0;     // 現在の設問(セット内の位置)
let readCorrect = 0;  // セッション内の正解設問数
let readTotal = 0;    // セッション内の解答設問数
let readCombo = 0;
let readSetOk = true; // 現在の文書セットで全問正解しているか(SRS判定用)
let readOrder = [];   // 現在の設問の選択肢表示順
let readStartMs = 0;
let readTimerId = null;

function readSets() { return readSection === 6 ? PART6 : READING; }
function readStatsStore() { return readSection === 6 ? state.part6Stats : state.readStats; }
function readSetSize() { return readSection === 6 ? READ6_SET_SIZE : READ7_SET_SIZE; }
function setsQCount(sets) { return sets.reduce((n, s) => n + s.qs.length, 0); }

function buildReadQueue() {
  const sets = readSets();
  const stats = readStatsStore();
  const size = Math.min(readSetSize(), sets.length);
  const today = todayKey();
  const due = [], fresh = [], future = [];
  sets.forEach((_, i) => {
    const st = stats[i];
    if (!st || st.seen === 0) fresh.push(i);
    else if (st.next <= today) due.push(i);
    else future.push(i);
  });
  due.sort((a, b) => stats[a].lv - stats[b].lv);
  shuffleArray(fresh);
  // 復習が多くても新しい文書が出続けるよう、半分は新出枠として確保する
  const newSlots = Math.min(fresh.length, Math.max(1, Math.round(size * 0.5)));
  const queue = fresh.splice(0, newSlots);
  while (queue.length < size && due.length > 0) queue.push(due.shift());
  while (queue.length < size && fresh.length > 0) queue.push(fresh.shift());
  if (queue.length < size) {
    future.sort((a, b) => (stats[a].next < stats[b].next ? -1 : 1));
    while (queue.length < size && future.length > 0) queue.push(future.shift());
  }
  return shuffleArray(queue);
}

function readSectionCounts(sets, stats) {
  const today = todayKey();
  let due = 0, fresh = 0;
  sets.forEach((_, i) => {
    const st = stats[i];
    if (!st || st.seen === 0) fresh++;
    else if (st.next <= today) due++;
  });
  return { due, fresh };
}

function renderReadStart() {
  document.getElementById("read-start").classList.remove("hidden");
  document.getElementById("read-session").classList.add("hidden");
  document.getElementById("read-result").classList.add("hidden");
  const p6 = readSectionCounts(PART6, state.part6Stats);
  document.getElementById("part6-summary").innerHTML =
    `復習する長文: <strong>${p6.due}</strong> 件 ／ 新しい長文: <strong>${p6.fresh}</strong> 件(全${PART6.length}件・${setsQCount(PART6)}問)`;
  renderRetentionBar("part6-retention-bar", srsRetentionCounts(PART6.length, state.part6Stats), PART6.length);
  const p7 = readSectionCounts(READING, state.readStats);
  document.getElementById("part7-summary").innerHTML =
    `復習する文書: <strong>${p7.due}</strong> 件 ／ 新しい文書: <strong>${p7.fresh}</strong> 件(全${READING.length}件・${setsQCount(READING)}問)`;
  renderRetentionBar("part7-retention-bar", srsRetentionCounts(READING.length, state.readStats), READING.length);
}

function startRead(section) {
  readSection = section;
  readQueue = buildReadQueue();
  if (readQueue.length === 0) return;
  readPos = 0;
  readQPos = 0;
  readCorrect = 0;
  readTotal = 0;
  readCombo = 0;
  readSetOk = true;
  sessionXp = 0;
  document.getElementById("read-start").classList.add("hidden");
  document.getElementById("read-result").classList.add("hidden");
  document.getElementById("read-session").classList.remove("hidden");
  startReadTimer();
  renderReadPassages();
  showReadQuestion();
}

function startReadTimer() {
  readStartMs = Date.now();
  stopReadTimer();
  readTimerId = setInterval(updateReadTimer, 500);
  updateReadTimer();
}
function stopReadTimer() {
  if (readTimerId) { clearInterval(readTimerId); readTimerId = null; }
}
function updateReadTimer() {
  const sec = Math.floor((Date.now() - readStartMs) / 1000);
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, "0");
  const el = document.getElementById("read-timer");
  if (el) el.textContent = `⏱️ ${m}:${s}`;
}

function currentReadSet() {
  return readSets()[readQueue[readPos]];
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderReadPassages() {
  const set = currentReadSet();
  const box = document.getElementById("read-passages");
  box.innerHTML = "";
  if (readSection === 6) {
    // Part 6: 単一の長文。{1}..{4} を空所ラベルに置換し、現在解答中の空所を強調表示する
    const wrap = document.createElement("div");
    wrap.className = "read-doc";
    const label = document.createElement("p");
    label.className = "read-doc-label";
    label.textContent = set.t;
    const body = document.createElement("p");
    body.className = "read-doc-text";
    let html = escapeHtml(set.text);
    for (let n = 1; n <= set.qs.length; n++) {
      const active = n === readQPos + 1;
      html = html.replace("{" + n + "}", `<span class="p6-blank${active ? " active" : ""}">(${n})</span>`);
    }
    body.innerHTML = html.replace(/\n/g, "<br>");
    wrap.appendChild(label);
    wrap.appendChild(body);
    box.appendChild(wrap);
    return;
  }
  set.passages.forEach((p) => {
    const wrap = document.createElement("div");
    wrap.className = "read-doc";
    const label = document.createElement("p");
    label.className = "read-doc-label";
    label.textContent = p.label;
    const body = document.createElement("p");
    body.className = "read-doc-text";
    body.textContent = p.text;
    wrap.appendChild(label);
    wrap.appendChild(body);
    box.appendChild(wrap);
  });
}

function showReadQuestion() {
  const set = currentReadSet();
  const q = set.qs[readQPos];
  if (readSection === 6) {
    renderReadPassages(); // 現在の空所ハイライトを更新
    document.getElementById("read-progress").textContent =
      `長文 ${readPos + 1}/${readQueue.length}　空所 ${readQPos + 1}/${set.qs.length}`;
    document.getElementById("read-qtype").textContent = "Part 6 ・ " + set.t;
    document.getElementById("read-question").textContent =
      q.ins ? `空所 (${readQPos + 1}) に入る最も適切な一文は?` : `空所 (${readQPos + 1}) に入る最も適切な語句は?`;
  } else {
    document.getElementById("read-progress").textContent =
      `文書 ${readPos + 1}/${readQueue.length}　設問 ${readQPos + 1}/${set.qs.length}`;
    document.getElementById("read-qtype").textContent = "Part 7 ・ " + set.t;
    document.getElementById("read-question").textContent = q.q;
  }
  document.getElementById("read-feedback").classList.add("hidden");

  // 選択肢の表示順をシャッフル(正解位置を覚えてしまうのを防ぐ)
  readOrder = q.c.map((_, i) => i);
  for (let i = readOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [readOrder[i], readOrder[j]] = [readOrder[j], readOrder[i]];
  }
  const box = document.getElementById("read-choices");
  box.innerHTML = "";
  const labels = ["(A)", "(B)", "(C)", "(D)"];
  readOrder.forEach((orig, pos) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.dataset.orig = orig;
    btn.textContent = `${labels[pos]} ${q.c[orig]}`;
    btn.addEventListener("click", () => answerRead(orig, btn));
    box.appendChild(btn);
  });
}

function answerRead(chosen, btn) {
  const set = currentReadSet();
  const q = set.qs[readQPos];
  const correct = chosen === q.a;
  if (correct) { readCombo++; seCorrect(readCombo); }
  else { readCombo = 0; readSetOk = false; seWrong(); }
  const gained = correct ? (readCombo >= 3 ? 15 : 10) : 2;
  addXp(gained);

  document.querySelectorAll("#read-choices .choice-btn").forEach((b) => {
    b.disabled = true;
    if (Number(b.dataset.orig) === q.a) b.classList.add("correct");
  });
  if (!correct) btn.classList.add("wrong");

  readTotal++;
  const log = todayLog();
  log.read = (log.read || 0) + 1;
  if (correct) {
    readCorrect++;
    log.readOk = (log.readOk || 0) + 1;
    log.maxCombo = Math.max(log.maxCombo || 0, readCombo);
  }
  saveState();
  checkDailyChallenges();

  const verdict = document.getElementById("read-verdict");
  verdict.textContent = correct
    ? `正解! ⭕ +${gained}XP${readCombo >= 2 ? ` 🔥${readCombo}連続!` : ""}`
    : "残念… ❌ +2XP";
  verdict.className = `quiz-verdict ${correct ? "good" : "bad"}`;

  const script = document.getElementById("read-script");
  script.innerHTML = "";
  if (readSection === 6) {
    // Part 6: 空所の正解語句 + 完成文の和訳
    const line = document.createElement("p");
    line.className = "script-q";
    line.innerHTML = `<strong>空所 (${readQPos + 1}) の正解: ${escapeHtml(q.c[q.a])}</strong>` +
      (q.jq ? `<br><span>${escapeHtml(q.jq)}</span>` : "");
    script.appendChild(line);
  } else {
    // Part 7: 設問文 + 和訳 + 正解
    const qLine = document.createElement("p");
    qLine.className = "script-q";
    qLine.innerHTML = `<strong>${escapeHtml(q.q)}</strong><br><span>${escapeHtml(q.jq)}</span>`;
    script.appendChild(qLine);
    const aLine = document.createElement("p");
    aLine.className = "script-line correct";
    aLine.textContent = `正解: ${q.c[q.a]}`;
    script.appendChild(aLine);
  }

  document.getElementById("read-explanation").textContent = q.x;
  const isLastQ = readQPos + 1 >= set.qs.length;
  const isLastSet = readPos + 1 >= readQueue.length;
  const nextInSet = readSection === 6 ? "次の空所へ" : "次の設問へ";
  const nextSet = readSection === 6 ? "次の長文へ" : "次の文書へ";
  document.getElementById("read-next-btn").textContent =
    !isLastQ ? nextInSet : (isLastSet ? "結果を見る" : nextSet);
  document.getElementById("read-feedback").classList.remove("hidden");
}

function finalizeReadSet() {
  // 文書セット単位のSRS: 全問正解でレベルUP、1問でも間違えるとレベル0
  const stats = readStatsStore();
  const idx = readQueue[readPos];
  const st = stats[idx] || { lv: 0, next: todayKey(), seen: 0, ok: 0 };
  st.seen++;
  if (readSetOk) { st.ok++; st.lv = Math.min(MAX_LEVEL, st.lv + 1); }
  else { st.lv = 0; }
  st.next = addDays(todayKey(), INTERVALS[st.lv]);
  stats[idx] = st;
  saveState();
}

function nextReadQuestion() {
  const set = currentReadSet();
  if (readQPos + 1 < set.qs.length) {
    readQPos++;
    showReadQuestion();
    return;
  }
  // 文書セット終了 → SRSを確定
  finalizeReadSet();
  if (readPos + 1 < readQueue.length) {
    readPos++;
    readQPos = 0;
    readSetOk = true;
    renderReadPassages();
    showReadQuestion();
    window.scrollTo(0, 0);
  } else {
    finishRead();
  }
}

function finishRead() {
  stopReadTimer();
  seFinish();
  const pct = readTotal > 0 ? Math.round((readCorrect / readTotal) * 100) : 0;
  addXp(20 + (pct === 100 ? 30 : 0)); // 完了ボーナス+パーフェクトボーナス
  if (pct === 100) { const log = todayLog(); log.perfects = (log.perfects || 0) + 1; }
  saveState();
  checkDailyChallenges();
  const sec = Math.floor((Date.now() - readStartMs) / 1000);
  const min = sec / 60;
  const pace = min > 0 ? (readTotal / min).toFixed(1) : String(readTotal);
  const mm = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, "0");
  document.getElementById("read-session").classList.add("hidden");
  document.getElementById("read-result").classList.remove("hidden");
  const emoji = pct === 100 ? "👑" : pct >= 80 ? "🏆" : pct >= 60 ? "🎉" : "📖";
  const title = pct === 100 ? "パーフェクト!!" : pct >= 80 ? "すばらしい!" : pct >= 60 ? "その調子!" : "解説を読み返そう";
  document.getElementById("read-result-emoji").textContent = emoji;
  document.getElementById("read-result-title").textContent = title;
  const paceNote = readSection === 6
    ? "本番Part 6は約16問。文脈から空所を素早く埋める練習です。"
    : "本番Part 7は約54問を約55分で解きます(目安 約1問/分)。";
  document.getElementById("read-result-text").innerHTML =
    `${readTotal}問中 <strong>${readCorrect}</strong> 問正解(${pct}%)<br>` +
    `所要時間: <strong>${mm}:${ss}</strong> ／ ペース: <strong>${pace}</strong> 問/分<br>` +
    `${paceNote}<br>` +
    `獲得XP: <strong>+${sessionXp}</strong> ✨${pct === 100 ? "(パーフェクトボーナス +30 込み)" : ""}`;
  if (pct === 100) confetti();
  maybeCelebrateGoal();
}

document.getElementById("part6-start-btn").addEventListener("click", () => startRead(6));
document.getElementById("part7-start-btn").addEventListener("click", () => startRead(7));
document.getElementById("read-again-btn").addEventListener("click", () => startRead(readSection));
document.getElementById("read-next-btn").addEventListener("click", nextReadQuestion);

// ---- 記録 ----

function renderStats() {
  // 直近14日の棒グラフ
  const chart = document.getElementById("chart");
  chart.innerHTML = "";
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(addDays(todayKey(), -i));
  const max = Math.max(10, ...days.map((k) => logTotal(state.log[k])));
  days.forEach((k) => {
    const l = state.log[k] || { words: 0, quiz: 0, listen: 0, read: 0 };
    const col = document.createElement("div");
    col.className = "chart-col";
    const wrap = document.createElement("div");
    wrap.style.cssText = "flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:1px;";
    const segR = document.createElement("div");
    segR.className = "chart-seg-read";
    segR.style.height = `${((l.read || 0) / max) * 100}%`;
    const segL = document.createElement("div");
    segL.className = "chart-seg-listen";
    segL.style.height = `${((l.listen || 0) / max) * 100}%`;
    const segQ = document.createElement("div");
    segQ.className = "chart-seg-quiz";
    segQ.style.height = `${(l.quiz / max) * 100}%`;
    const segW = document.createElement("div");
    segW.className = "chart-seg-words";
    segW.style.height = `${(l.words / max) * 100}%`;
    wrap.appendChild(segR);
    wrap.appendChild(segL);
    wrap.appendChild(segQ);
    wrap.appendChild(segW);
    const label = document.createElement("div");
    label.className = "chart-day";
    label.textContent = Number(k.split("-")[2]);
    col.appendChild(wrap);
    col.appendChild(label);
    chart.appendChild(col);
  });

  // 正答率(全体・タイプ別)
  const byType = {};
  let totalSeen = 0;
  let totalOk = 0;
  QUESTIONS.forEach((q, i) => {
    const st = state.quizStats[i];
    if (!st || st.seen === 0) return;
    totalSeen += st.seen;
    totalOk += st.ok;
    if (!byType[q.t]) byType[q.t] = { seen: 0, ok: 0 };
    byType[q.t].seen += st.seen;
    byType[q.t].ok += st.ok;
  });
  document.getElementById("accuracy-total").textContent =
    totalSeen > 0 ? `全体: ${Math.round((totalOk / totalSeen) * 100)}%(${totalSeen}問解答)` : "まだクイズを解いていません";
  // 文法の定着度(単語と同じ忘却曲線ベース)
  const quizRet = srsRetentionCounts(QUESTIONS.length, state.quizStats);
  renderRetentionBar("stats-quiz-retention-bar", quizRet, QUESTIONS.length);
  document.getElementById("stats-quiz-retention-text").textContent = retentionText(quizRet);
  renderForecast("quiz-forecast-chart", [state.quizStats]);
  const accList = document.getElementById("accuracy-list");
  accList.innerHTML = "";
  Object.entries(byType)
    .sort((a, b) => (a[1].ok / a[1].seen) - (b[1].ok / b[1].seen))
    .forEach(([type, s]) => {
      const pct = Math.round((s.ok / s.seen) * 100);
      const row = document.createElement("div");
      row.className = "acc-row";
      row.innerHTML =
        `<span class="acc-name">${type}</span>` +
        `<div class="acc-bar"><div class="acc-bar-fill" style="width:${pct}%"></div></div>` +
        `<span class="acc-pct">${pct}%</span>`;
      accList.appendChild(row);
    });

  // 単語の定着度(忘却曲線)
  const ret = retentionCounts();
  renderRetentionBar("retention-bar", ret, WORDS.length);
  const legend = document.getElementById("retention-legend");
  legend.innerHTML = "";
  [
    ["#2e9e6b", "習得済み(間隔14日)", ret.mature],
    ["#4a90c2", "定着中(間隔3〜7日)", ret.young],
    ["#e8a13d", "学習中(間隔1日以下)", ret.learning],
    ["#cfd8dc", "未学習", ret.fresh],
  ].forEach(([color, label, n]) => {
    const row = document.createElement("div");
    row.className = "ret-row";
    row.innerHTML =
      `<span class="ret-dot" style="background:${color}"></span>` +
      `<span>${label}</span><span class="ret-count">${n}語</span>`;
    legend.appendChild(row);
  });

  // 今後7日間の復習予定(Ankiの「予測」グラフに相当)
  renderForecast("forecast-chart", [state.words]);

  // リスニングの正答率(Part 1 + Part 2、全体・タイプ別)
  const listenByType = {};
  let listenSeen = 0;
  let listenOk = 0;
  [[PART1, state.part1Stats], [PART2, state.listenStats]].forEach(([data, stats]) => {
    data.forEach((q, i) => {
      const st = stats[i];
      if (!st || st.seen === 0) return;
      listenSeen += st.seen;
      listenOk += st.ok;
      if (!listenByType[q.t]) listenByType[q.t] = { seen: 0, ok: 0 };
      listenByType[q.t].seen += st.seen;
      listenByType[q.t].ok += st.ok;
    });
  });
  // Part 3(会話)/ Part 4(トーク)の設問数累計をタイプ別集計と全体に加える
  [["Part 3 会話", state.part3Stats], ["Part 4 トーク", state.part4Stats]].forEach(([label, stats]) => {
    const s = pairSum(stats);
    if (s.seen > 0) {
      listenSeen += s.seen;
      listenOk += s.ok;
      listenByType[label] = { seen: s.seen, ok: s.ok };
    }
  });
  document.getElementById("accuracy-listen-total").textContent =
    listenSeen > 0 ? `全体: ${Math.round((listenOk / listenSeen) * 100)}%(${listenSeen}問解答)` : "まだリスニングを解いていません";
  // リスニングの定着度(Part 1〜4 合算、単語・文法と同じ忘却曲線ベース。Part 3/4は会話・トーク単位)
  const lretParts = [
    srsRetentionCounts(PART1.length, state.part1Stats),
    srsRetentionCounts(PART2.length, state.listenStats),
    srsRetentionCounts(PART3.length, state.part3Stats),
    srsRetentionCounts(PART4.length, state.part4Stats),
  ];
  const listenRet = lretParts.reduce(
    (a, c) => ({ mature: a.mature + c.mature, young: a.young + c.young, learning: a.learning + c.learning, fresh: a.fresh + c.fresh }),
    { mature: 0, young: 0, learning: 0, fresh: 0 });
  renderRetentionBar("stats-listen-retention-bar", listenRet, PART1.length + PART2.length + PART3.length + PART4.length);
  document.getElementById("stats-listen-retention-text").textContent = retentionText(listenRet) + "(Part 1〜4)";
  renderForecast("listen-forecast-chart", [state.part1Stats, state.listenStats, state.part3Stats, state.part4Stats]);
  const listenAccList = document.getElementById("accuracy-listen-list");
  listenAccList.innerHTML = "";
  Object.entries(listenByType)
    .sort((a, b) => (a[1].ok / a[1].seen) - (b[1].ok / b[1].seen))
    .forEach(([type, s]) => {
      const pct = Math.round((s.ok / s.seen) * 100);
      const row = document.createElement("div");
      row.className = "acc-row";
      row.innerHTML =
        `<span class="acc-name">${type}</span>` +
        `<div class="acc-bar"><div class="acc-bar-fill" style="width:${pct}%"></div></div>` +
        `<span class="acc-pct">${pct}%</span>`;
      listenAccList.appendChild(row);
    });

  // 読解(Part 6 + Part 7)の定着度(文書セット単位)+ 全体正答率(問題単位)+ 文書タイプ別の定着率
  const aggR = aggregates();
  document.getElementById("accuracy-read-total").textContent =
    aggR.read > 0 ? `全体: ${Math.round((aggR.readOk / aggR.read) * 100)}%(${aggR.read}問解答)` : "まだ読解を解いていません";
  const r6 = srsRetentionCounts(PART6.length, state.part6Stats);
  const r7 = srsRetentionCounts(READING.length, state.readStats);
  const readRet = { mature: r6.mature + r7.mature, young: r6.young + r7.young, learning: r6.learning + r7.learning, fresh: r6.fresh + r7.fresh };
  const readTotalSets = PART6.length + READING.length;
  renderRetentionBar("stats-read-retention-bar", readRet, readTotalSets);
  document.getElementById("stats-read-retention-text").textContent = retentionText(readRet) + "(Part 6・7 文書セット単位)";
  renderForecast("read-forecast-chart", [state.part6Stats, state.readStats]);
  const readByType = {};
  [[PART6, state.part6Stats], [READING, state.readStats]].forEach(([sets, stats]) => {
    sets.forEach((set, i) => {
      const st = stats[i];
      if (!st || st.seen === 0) return;
      if (!readByType[set.t]) readByType[set.t] = { seen: 0, ok: 0 };
      readByType[set.t].seen += st.seen;
      readByType[set.t].ok += st.ok;
    });
  });
  const readAccList = document.getElementById("accuracy-read-list");
  readAccList.innerHTML = "";
  Object.entries(readByType)
    .sort((a, b) => (a[1].ok / a[1].seen) - (b[1].ok / b[1].seen))
    .forEach(([type, s]) => {
      const pct = Math.round((s.ok / s.seen) * 100);
      const row = document.createElement("div");
      row.className = "acc-row";
      row.innerHTML =
        `<span class="acc-name">${type}</span>` +
        `<div class="acc-bar"><div class="acc-bar-fill" style="width:${pct}%"></div></div>` +
        `<span class="acc-pct">${pct}%</span>`;
      readAccList.appendChild(row);
    });

  renderMonthlyBadges(); // 月間バッジのコレクションと今月の進捗

  // 実績バッジ(解除済みはカラー、未解除はグレー+条件表示)
  const badgeGrid = document.getElementById("badge-grid");
  badgeGrid.innerHTML = "";
  BADGES.forEach((b) => {
    const unlocked = state.badges.includes(b.id);
    const item = document.createElement("div");
    item.className = "badge-item" + (unlocked ? "" : " locked");
    item.innerHTML =
      `<div class="badge-icon">${b.icon}</div>` +
      `<div class="badge-name">${b.name}</div>` +
      `<div class="badge-desc">${b.desc}</div>`;
    badgeGrid.appendChild(item);
  });

  // 苦手単語(「まだ」でレベル0に戻った単語)
  const weak = Object.entries(state.words)
    .filter(([, st]) => st.seen > 0 && st.lv <= 1 && st.seen > st.ok)
    .sort((a, b) => (b[1].seen - b[1].ok) - (a[1].seen - a[1].ok))
    .slice(0, 15);
  const weakBox = document.getElementById("weak-words");
  weakBox.innerHTML = "";
  if (weak.length === 0) {
    weakBox.innerHTML = `<p class="empty-note">苦手な単語はまだありません</p>`;
  } else {
    weak.forEach(([i]) => {
      const w = WORDS[i];
      const row = document.createElement("div");
      row.className = "weak-word-row";
      row.innerHTML = `<span class="weak-w">${w.w}</span><span class="weak-m">${w.m}</span>`;
      weakBox.appendChild(row);
    });
  }
}

// ---- 設定 ----

const settingsDialog = document.getElementById("settings-dialog");

document.getElementById("settings-btn").addEventListener("click", () => {
  document.getElementById("exam-date-input").value = state.settings.examDate;
  document.getElementById("goal-words-input").value = state.settings.goalWords;
  document.getElementById("goal-quiz-input").value = state.settings.goalQuiz;
  document.getElementById("goal-listen-input").value = state.settings.goalListen;
  document.getElementById("goal-read-input").value = state.settings.goalRead;
  document.getElementById("target-score-input").value = state.settings.targetScore;
  document.getElementById("sound-input").checked = state.settings.sound;
  document.getElementById("autospeak-input").checked = state.settings.autoSpeak;
  settingsDialog.showModal();
});

// ---- ショップ(炎ヒーローのカードから開く) ----
const shopDialog = document.getElementById("shop-dialog");
document.getElementById("streak-hero").addEventListener("click", () => {
  renderShop();
  shopDialog.showModal();
});
document.getElementById("shop-buy-freeze").addEventListener("click", buyFreeze);
document.getElementById("shop-close-btn").addEventListener("click", () => shopDialog.close());

document.getElementById("settings-save-btn").addEventListener("click", () => {
  const date = document.getElementById("exam-date-input").value;
  const gw = parseInt(document.getElementById("goal-words-input").value, 10);
  const gq = parseInt(document.getElementById("goal-quiz-input").value, 10);
  const gl = parseInt(document.getElementById("goal-listen-input").value, 10);
  const gr = parseInt(document.getElementById("goal-read-input").value, 10);
  const ts = parseInt(document.getElementById("target-score-input").value, 10);
  if (date) state.settings.examDate = date;
  if (gw >= 1) state.settings.goalWords = gw;
  if (gq >= 1) state.settings.goalQuiz = gq;
  if (gl >= 1) state.settings.goalListen = gl;
  if (gr >= 1) state.settings.goalRead = gr;
  if (ts >= 10 && ts <= 990) state.settings.targetScore = ts;
  state.settings.sound = document.getElementById("sound-input").checked;
  state.settings.autoSpeak = document.getElementById("autospeak-input").checked;
  saveState();
  // ONに切り替えた直後に確認音を鳴らす(タップ直下なので自動再生制限もクリア)
  if (state.settings.sound) seTick();
  renderHome();
});

document.getElementById("reset-btn").addEventListener("click", () => {
  if (!confirm("学習記録をすべて削除しますか?(設定は残ります)")) return;
  state.words = {};
  state.quizStats = {};
  state.listenStats = {};
  state.part1Stats = {};
  state.readStats = {};
  state.part6Stats = {};
  state.part3Stats = {};
  state.part4Stats = {};
  state.log = {};
  state.gems = 0;
  state.freezes = 0;
  state.streak = { count: 0, lastActive: "", best: 0 };
  state.freezeLog = [];
  state.streakMilestones = [];
  state.weekly = { week: "", claimed: [] };
  state.monthly = { ym: "", points: 0 };
  state.monthlyBadges = [];
  state.league = { week: "", xp: 0, prevXp: 0, pendingResult: null };
  saveState();
  settingsDialog.close();
  showTab("home");
});

// ---- 記録のバックアップ(書き出し / 復元) ----
// 記録は localStorage(このURLのブラウザ内)にしか無いので、機種変更・URL移行に備えて
// state全体をJSONで書き出し/読み込みできるようにする。アプリ更新では記録は消えないが、
// URLが変わると別の保存場所になるため、その引っ越し手段にもなる。

function exportBackup() {
  const text = JSON.stringify(state);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `toeic600-backup-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  // 対応端末ではクリップボードにもコピー(ファイルの扱いが難しい端末向けの保険)
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
  showBanner("📤 バックアップを書き出しました");
}

function importBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    alert("ファイルを読み込めませんでした(JSON形式ではありません)。");
    return;
  }
  // TOEICアプリの記録らしいか簡易チェック(誤ファイルで上書きしないため)
  if (!parsed || typeof parsed !== "object" || (!parsed.words && !parsed.settings && !parsed.log)) {
    alert("このファイルはTOEICアプリのバックアップではないようです。");
    return;
  }
  if (!confirm("現在の記録を、このバックアップの内容で上書きします。よろしいですか?")) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  state = loadState(); // 旧形式からの移行処理も通す
  saveState();
  settingsDialog.close();
  showTab("home");
  confetti();
  showBanner("📥 バックアップから復元しました");
}

document.getElementById("backup-export-btn").addEventListener("click", exportBackup);
document.getElementById("backup-import-btn").addEventListener("click", () => {
  document.getElementById("backup-file-input").click();
});
document.getElementById("backup-file-input").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => importBackup(String(reader.result));
  reader.onerror = () => alert("ファイルの読み込みに失敗しました。");
  reader.readAsText(file);
  e.target.value = ""; // 同じファイルを続けて選べるようにリセット
});
document.getElementById("backup-paste-btn").addEventListener("click", () => {
  const text = document.getElementById("backup-paste-input").value.trim();
  if (!text) { alert("テキストが空です。バックアップの文字列を貼り付けてください。"); return; }
  importBackup(text);
});

// ---- 起動 ----

renderHome();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
