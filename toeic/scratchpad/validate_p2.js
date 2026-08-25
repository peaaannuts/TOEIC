// PART2 追加分の構造・品質検証
const fs = require("fs");
let src = fs.readFileSync("" + __dirname + "/../data.js", "utf8");
eval(src.replace(/const (WORDS|IPA|QUESTIONS|PART2|PART1|READING|PART6|PART3|PART4)/g, "globalThis.$1"));

let bad = 0;
const VALID_T = new Set(["WH疑問文", "Yes/No疑問文", "依頼・提案", "選択疑問文", "平叙文", "付加疑問文"]);

PART2.forEach((q, i) => {
  if (!q.q || !q.jq || !q.x || !q.t) { bad++; console.log("missing field @", i, q.q); }
  if (!Array.isArray(q.r) || q.r.length !== 3) { bad++; console.log("r length != 3 @", i, q.q); }
  if (!Array.isArray(q.jr) || q.jr.length !== 3) { bad++; console.log("jr length != 3 @", i, q.q); }
  if (!VALID_T.has(q.t)) { bad++; console.log("invalid t:", q.t, "@", i, q.q); }
});

// 重複チェック(質問文の完全一致)
const seen = new Map();
PART2.forEach((q, i) => {
  const k = q.q.trim().toLowerCase();
  if (seen.has(k)) { bad++; console.log("DUPLICATE question:", q.q, "@", i, "and", seen.get(k)); }
  else seen.set(k, i);
});

// 正解の重複(r[0]がr[1]/r[2]と同一でないか)
PART2.forEach((q, i) => {
  if (!Array.isArray(q.r)) return;
  const s = new Set(q.r.map((x) => String(x).trim().toLowerCase()));
  if (s.size !== 3) { bad++; console.log("duplicate response text @", i, q.q); }
});

// 音声ファイルの実在チェック(qAudio/audioを持つ全問。2026-08-26にPart2の66問追加時に新設した観点)
const path = require("path");
const AUDIO_DIR = path.join(__dirname, "..", "audio", "part2");
PART2.forEach((q, i) => {
  if (q.qAudio && !fs.existsSync(path.join(AUDIO_DIR, q.qAudio))) { bad++; console.log("missing audio file @", i, q.qAudio); }
  if (Array.isArray(q.audio)) {
    q.audio.forEach((f) => { if (!fs.existsSync(path.join(AUDIO_DIR, f))) { bad++; console.log("missing audio file @", i, f); } });
  }
});

const t = {};
PART2.forEach((q) => { t[q.t] = (t[q.t] || 0) + 1; });

const ind = /(not sure|don.t know|check with|ask |haven.t|let me|i.ll have to|either|whichever|it depends|no idea|hasn.t been|didn.t you|isn.t it|wasn.t it|why don.t|already|out of the office|up to |posted|tied up|get back to you|finalized|decided|transferred|handling|double-check|look it up|same as)/i;
let n = 0;
PART2.forEach((q) => { if (Array.isArray(q.r) && ind.test(q.r[0])) n++; });

console.log("PART2 total:", PART2.length);
console.log("category:", t);
console.log("indirect-ish correct answers:", n, "/", PART2.length, "=", Math.round((n / PART2.length) * 100) + "%");
console.log("structural problems:", bad);
process.exit(bad ? 1 : 0);
