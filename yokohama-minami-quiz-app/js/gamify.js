/*
 * 続けたくなる仕組み（小6むけ）
 *  - レベル／経験値：正解するとXPがたまり、レベルが上がる
 *  - 連続日数（ストリーク）：毎日少しでもやると数字がのびる
 *  - デイリーミッション：今日の目標問題数
 *  - バッジ：がんばりの記念。集める楽しさ
 */

// レベルの計算（XP 100ごとに1レベル）
function levelFromXp(xp) {
  return Math.floor(xp / 100) + 1;
}
function xpInLevel(xp) {
  return xp % 100; // 今のレベルでためたXP（0〜99）
}
function xpToNext() {
  return 100;
}

// 連続日数を更新する（その日初めての学習で呼ぶ）
function updateStreak(state) {
  const today = Store.todayStr();
  if (state.lastStudyDate === today) return; // 今日はもう数えた

  if (state.lastStudyDate) {
    const gap = Store.daysBetween(state.lastStudyDate, today);
    if (gap === 1) state.streak += 1;        // 昨日もやっていた → のびる
    else if (gap > 1) state.streak = 1;      // 間があいた → 1からやり直し
  } else {
    state.streak = 1;                        // はじめての学習
  }
  state.lastStudyDate = today;
  if (!state.studyDates.includes(today)) state.studyDates.push(today);
}

// バッジの定義
const BADGES = [
  { id: "first",    name: "はじめの一歩", emoji: "🌱", desc: "最初の1問にちょうせん",     check: (s) => s.totalAnswered >= 1 },
  { id: "correct10",name: "10問正解",     emoji: "⭐", desc: "正解を10問ためる",          check: (s) => s.totalCorrect >= 10 },
  { id: "correct50",name: "50問正解",     emoji: "🌟", desc: "正解を50問ためる",          check: (s) => s.totalCorrect >= 50 },
  { id: "correct100",name: "100問マスター",emoji: "🏆", desc: "正解を100問ためる",        check: (s) => s.totalCorrect >= 100 },
  { id: "streak3",  name: "3日れんぞく",   emoji: "🔥", desc: "3日つづけて勉強",          check: (s) => s.streak >= 3 },
  { id: "streak7",  name: "1週間れんぞく", emoji: "💥", desc: "7日つづけて勉強",          check: (s) => s.streak >= 7 },
  { id: "streak30", name: "1か月れんぞく", emoji: "👑", desc: "30日つづけて勉強",         check: (s) => s.streak >= 30 },
  { id: "goal",     name: "今日の目標達成", emoji: "🎯", desc: "1日の目標問題数をクリア",  check: (s) => s.todayCount >= s.dailyGoal },
  { id: "level5",   name: "レベル5",       emoji: "🚀", desc: "レベル5に到達",            check: (s) => levelFromXp(s.xp) >= 5 },
  { id: "explorer", name: "ぜんぶ体験",     emoji: "🧭", desc: "8つの分野すべてに挑戦",     check: (s) => Object.keys(CATEGORIES).every((id) => s.cat[id] && s.cat[id].seen > 0) },
  { id: "writer",   name: "記述デビュー",   emoji: "✍️", desc: "適性検査チャレンジに初挑戦",   check: (s) => Object.keys(s.challengeDone || {}).length >= 1 },
];

// 取得していないバッジで、条件を満たしたものを返す（新しく取れたバッジ）
function checkNewBadges(state) {
  const newly = [];
  for (const b of BADGES) {
    if (!state.badges.includes(b.id) && b.check(state)) {
      state.badges.push(b.id);
      newly.push(b);
    }
  }
  return newly;
}

/*
 * 合格めやすメーター（受験準備度）
 *
 * ⚠️ これは「本番の合格率」ではありません。
 * このアプリでの練習だけをもとにした、がんばりの“めやす”です。
 *
 * 5つの要素を合わせて 0〜100 で表します。
 *   ・正答率     … 全体でどれだけ正解できているか        (30%)
 *   ・バランス   … いちばん苦手な分野の正答率（弱点）     (25%)
 *   ・分野の網羅 … 8分野をどれだけ練習したか              (20%)
 *   ・学習量     … これまでに解いた問題数                 (15%)
 *   ・継続       … 直近2週間で勉強した日数                (10%)
 */
const READINESS_STAGES = [
  { min: 0,  label: "スタート",         emoji: "🌱" },
  { min: 20, label: "きほんづくり",     emoji: "📗" },
  { min: 40, label: "のびざかり",       emoji: "📈" },
  { min: 60, label: "じっせん力アップ", emoji: "🔥" },
  { min: 75, label: "合格圏が見えた",   emoji: "🌟" },
  { min: 90, label: "合格まであと一歩", emoji: "👑" },
];

function readiness(state) {
  const ids = Object.keys(CATEGORIES);
  const SEEN_OK = 5; // 「練習した分野」とみなす問題数

  // 1) 全体の正答率
  const acc = state.totalAnswered > 0 ? state.totalCorrect / state.totalAnswered : 0;

  // 2) 十分に練習した分野
  const practiced = ids.filter((id) => state.cat[id] && state.cat[id].seen >= SEEN_OK);
  const coverage = practiced.length / ids.length;

  // 3) 学習量（200問で満点）
  const volume = Math.min(state.totalAnswered / 200, 1);

  // 4) バランス＝練習した分野の中で最も低い正答率（弱点）。全分野やってこそ満点
  let weakest = 0;
  if (practiced.length) {
    const minAcc = Math.min(...practiced.map((id) => state.cat[id].correct / state.cat[id].seen));
    weakest = minAcc * (practiced.length / ids.length);
  }

  // 5) 継続（直近14日で勉強した日数。10日で満点）
  const counts = state.dailyCounts || {};
  let activeDays = 0;
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if ((counts[Store.todayStr(d)] || 0) > 0) activeDays++;
  }
  const consistency = Math.min(activeDays / 10, 1);

  const score = Math.round(
    (acc * 0.30 + weakest * 0.25 + coverage * 0.20 + volume * 0.15 + consistency * 0.10) * 100
  );

  // ステージ
  let stage = READINESS_STAGES[0];
  for (const s of READINESS_STAGES) if (score >= s.min) stage = s;

  // つぎの一手（アドバイス）
  let advice;
  if (state.totalAnswered < 10) {
    advice = "まずは色々な分野を試して、自分の得意・苦手を見つけよう！";
  } else if (coverage < 1) {
    const notYet = ids.filter((id) => !practiced.includes(id));
    const c = CATEGORIES[notYet[0]];
    advice = `まだ練習が少ない「${c.emoji}${c.name}」をやってみよう。全分野そろえると点が伸びるよ！`;
  } else {
    let worst = practiced[0], worstAcc = 2;
    for (const id of practiced) {
      const a = state.cat[id].correct / state.cat[id].seen;
      if (a < worstAcc) { worstAcc = a; worst = id; }
    }
    const c = CATEGORIES[worst];
    advice = score >= 90
      ? "仕上げの時期！まちがえた問題の復習を中心にしよう。"
      : `いまの伸ばしどころは「${c.emoji}${c.name}」。重点的に練習しよう！`;
  }

  return { score, stage, advice, parts: { acc, weakest, coverage, volume, consistency } };
}

window.Gamify = { levelFromXp, xpInLevel, xpToNext, updateStreak, BADGES, checkNewBadges, readiness, READINESS_STAGES };
