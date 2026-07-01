/*
 * 学習データの保存・読み込み（ブラウザの localStorage を使用）
 * サーバー不要。同じ端末・同じブラウザなら続きから再開できます。
 */

const STORAGE_KEY = "minami_quiz_progress_v1";

// 受験日（固定）。横浜市立南高附属中の受験日に合わせている。
const EXAM_DATE = "2027-02-03";
// 1日の目標問題数の初期値
const DEFAULT_DAILY_GOAL = 30;

// 1日を表す文字列（例 "2026-06-18"）。連続日数の判定に使います。
function todayStr(d) {
  const t = d || new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const day = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(a, b) {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

function defaultState() {
  return {
    name: "",
    xp: 0,                 // 経験値
    coins: 0,              // ごほうびコイン
    streak: 0,             // 連続日数
    lastStudyDate: "",     // 最後に勉強した日
    studyDates: [],        // 勉強した日付の一覧（カレンダー用）
    totalAnswered: 0,
    totalCorrect: 0,
    badges: [],            // 取得バッジのid一覧
    // 分野ごとの成績
    cat: {},               // { kotoba: {seen, correct, ...}, ... }
    // 問題ごとの記憶（間隔をあけた復習＝かんたんなSRS用）
    items: {},             // { questionId: {box, due, seen, correct, wrong, lastDate} }
    dailyGoal: DEFAULT_DAILY_GOAL, // 1日の目標問題数
    todayCount: 0,         // 今日解いた数
    todayDate: "",         // todayCount を数えている日付
    dailyCounts: {},       // 1日ごとに実施した問題数 { "2026-06-19": 12, ... }
    dailyCorrect: {},      // 1日ごとに正解した数   { "2026-06-19": 9, ... }
    examDate: EXAM_DATE,   // 受験日（固定）。カウントダウンに使う
    challengeDone: {},     // 適性検査チャレンジで「できた」にした問題 { id: true }
    charmUsedMonth: "",    // ストリークおまもりを使った月（"2026-06"。月1回まで）
    comeback: false,       // お休みのあと戻ってきたことがある（おかえりバッジ用）
  };
}

function loadState() {
  let state;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = raw ? JSON.parse(raw) : defaultState();
  } catch (e) {
    state = defaultState();
  }
  // 不足キーをうめる（バージョン違い対策）
  const def = defaultState();
  for (const k in def) if (!(k in state)) state[k] = def[k];

  // 受験日は固定（既存データの値があっても上書きする）
  state.examDate = EXAM_DATE;
  // 目標問題数を30問へ引き上げる移行（一度だけ。以降は設定で変更可）
  if (!state.goalV2) {
    state.dailyGoal = DEFAULT_DAILY_GOAL;
    state.goalV2 = true;
  }

  // 分野・問題のレコードを初期化
  for (const id in CATEGORIES) {
    if (!state.cat[id]) state.cat[id] = { seen: 0, correct: 0, recent: [] };
  }
  // 今日のカウントを日付でリセット
  const today = todayStr();
  if (state.todayDate !== today) {
    state.todayDate = today;
    state.todayCount = 0;
  }
  return state;
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    /* 保存できなくても動作は続ける */
  }
}

function resetState() {
  localStorage.removeItem(STORAGE_KEY);
}

window.Store = { STORAGE_KEY, todayStr, daysBetween, defaultState, loadState, saveState, resetState };
