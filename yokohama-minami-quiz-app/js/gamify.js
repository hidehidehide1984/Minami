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

window.Gamify = { levelFromXp, xpInLevel, xpToNext, updateStreak, BADGES, checkNewBadges };
