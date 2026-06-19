/*
 * 適応出題ロジック
 *
 * ねらい：
 *  1) 苦手な分野を多めに出す（分野ごとの正答率で重みづけ）
 *  2) まちがえた問題は、間をあけてまた出す（かんたんな間隔反復＝Leitnerの箱）
 *  3) 得意になってきたら難易度を上げる（やさしい→ふつう→チャレンジ）
 *
 * 「box」… 0〜5。正解で箱が上がり、次に出るまでの日数がのびる。
 *           まちがえると箱が0に戻り、すぐまた出る。
 */

// 箱ごとの「次に出すまでの日数」
const BOX_INTERVAL_DAYS = [0, 1, 2, 4, 7, 14];

// 分野の正答率（直近重視）。0〜1。データが少ないときは 0.5 とみなす。
function categoryAccuracy(state, catId) {
  const c = state.cat[catId];
  if (!c || c.seen === 0) return 0.5;
  // 直近の結果（最大10件）を重めに見る
  const recent = c.recent || [];
  if (recent.length >= 3) {
    const r = recent.reduce((a, b) => a + b, 0) / recent.length;
    // 全体の正答率と直近をブレンド
    const overall = c.correct / c.seen;
    return r * 0.7 + overall * 0.3;
  }
  return c.correct / c.seen;
}

// その分野で今ねらうべき難易度（習熟が上がるほど高い）
function targetLevel(state, catId) {
  const acc = categoryAccuracy(state, catId);
  const seen = state.cat[catId] ? state.cat[catId].seen : 0;
  if (seen < 3 || acc < 0.5) return 1;     // まだ慣れていない/苦手 → やさしく
  if (acc < 0.8) return 2;                  // ふつう
  return 3;                                 // 得意 → チャレンジ
}

// 各問題に「出したい度合い（スコア）」をつけ、いちばん高いものを選ぶ
function pickNextQuestion(state, opts) {
  const today = Store.todayStr();
  const options = opts || {};
  const avoidId = options.avoidId || null;
  // 直前に出した分野（新しいものほど後ろ）。同じ分野が続かないように使う。
  const recentCats = options.recentCats || [];

  let best = null;
  let bestScore = -Infinity;

  for (const q of QUESTIONS) {
    if (q.id === avoidId) continue;

    const item = state.items[q.id];
    const acc = categoryAccuracy(state, q.category);
    const tlevel = targetLevel(state, q.category);

    let score = 0;

    // (1) 苦手分野を優先：正答率が低いほど加点（ただし“多め”どまりにする）
    score += (1 - acc) * 35;

    if (item) {
      // (2) 今日もう解いた問題は、同じ日に連発しないよう大きく下げる
      if (item.lastDate === today) score -= 45;
      // (3) 復習タイミング：期限が来た問題を優先（来すぎても伸びすぎないよう上限）
      const overdue = item.due ? Store.daysBetween(item.due, today) : 0;
      if (overdue >= 0) score += 25 + Math.min(overdue, 7) * 4;
      else score -= 25;                               // まだ早い問題は下げる
      // まちがえやすい問題（箱が低い）を優先
      score += (5 - (item.box || 0)) * 3;
    } else {
      // (4) まだ一度も解いていない問題はほどよく優先（新しい学び）
      score += 28;
    }

    // (5) ねらいの難易度に近いほど加点
    score -= Math.abs(q.level - tlevel) * 9;

    // (6) インターリーブ：直前に出た分野は控えめにして、いろいろな分野をまぜる
    const ri = recentCats.lastIndexOf(q.category);
    if (ri >= 0) score -= (recentCats.length - ri) * 12;

    // (7) 少しランダム性を入れて、毎回同じ並びにならないように
    score += Math.random() * 14;

    if (score > bestScore) {
      bestScore = score;
      best = q;
    }
  }
  return best;
}

// 回答結果を成績に反映する
function recordAnswer(state, q, isCorrect) {
  const today = Store.todayStr();

  // 分野の成績
  const c = state.cat[q.category];
  c.seen += 1;
  if (isCorrect) c.correct += 1;
  c.recent = (c.recent || []).concat(isCorrect ? 1 : 0).slice(-10);

  // 問題ごとの記憶（Leitnerの箱）
  let item = state.items[q.id] || { box: 0, due: today, seen: 0, correct: 0, wrong: 0, lastDate: "" };
  item.seen += 1;
  item.lastDate = today;
  if (isCorrect) {
    item.correct += 1;
    item.box = Math.min(5, (item.box || 0) + 1);
  } else {
    item.wrong += 1;
    item.box = 0;
  }
  const interval = BOX_INTERVAL_DAYS[item.box] || 0;
  const due = new Date();
  due.setDate(due.getDate() + interval);
  item.due = Store.todayStr(due);
  state.items[q.id] = item;

  // 全体の集計
  state.totalAnswered += 1;
  if (isCorrect) state.totalCorrect += 1;
}

// 苦手な分野を1つ返す（ホーム画面のアドバイス用）。まだデータが少なければ null。
function weakestCategory(state) {
  let worst = null;
  let worstAcc = 1.1;
  for (const id in CATEGORIES) {
    const c = state.cat[id];
    if (!c || c.seen < 3) continue;
    const acc = c.correct / c.seen;
    if (acc < worstAcc) { worstAcc = acc; worst = id; }
  }
  return worst;
}

window.Adaptive = { categoryAccuracy, targetLevel, pickNextQuestion, recordAnswer, weakestCategory, BOX_INTERVAL_DAYS };
