/*
 * アプリ本体：画面の切りかえ、出題、答え合わせ、ごほうび表示
 */

let state = Store.loadState();
let currentQ = null;
let lastQId = null;     // 同じ問題が連続しないように
let recentCats = [];    // 直近に出した分野（インターリーブ用、最大4件）
let answered = false;   // 今の問題に答えたか
let forcedCategory = null; // 「この分野だけ練習」モード（nullなら適応出題）
let lastSubmitAt = 0;   // 直前に答え合わせした時刻（Enterの二重発火を防ぐ）
let currentChallenge = null; // いま取り組んでいる適性検査チャレンジ

/* ---------- 答えの正規化（全角→半角・空白除去など） ---------- */
function normalize(str) {
  if (str == null) return "";
  let s = String(str).trim();
  // 全角英数字を半角へ
  s = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  s = s.replace(/\s+/g, "");           // 空白を消す
  s = s.replace(/[、。．，]/g, "");      // 句読点を消す
  // 数字の直後にある末尾の単位（cm・円・度・個 など）は無視する。
  // 「数字のあと」に限定するので、「本」などの語句の答えは消えません。
  s = s.replace(/([0-9])(cm2|cm²|cm3|cm³|cm|km|kg|mm|m|g|円|度|°|℃|個|本|通り|とおり|人|名|匹|ひき|才|歳|秒|分|時間|%|％)+$/i, "$1");
  s = s.toLowerCase();
  return s;
}

function isAnswerCorrect(q, userInput) {
  if (q.type === "choice") {
    return userInput === q.answer;
  }
  const u = normalize(userInput);
  if (!u) return false;
  const candidates = [q.answer].concat(q.accept || []);
  return candidates.some((c) => normalize(c) === u);
}

/* ---------- 画面切りかえ ---------- */
function showView(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  window.scrollTo(0, 0);
}

/* ---------- ヘッダー（レベル・ストリーク・コイン） ---------- */
function renderHeader() {
  const lv = Gamify.levelFromXp(state.xp);
  document.getElementById("hdr-level").textContent = "Lv." + lv;
  document.getElementById("hdr-streak").textContent = "🔥" + state.streak;
  document.getElementById("hdr-coin").textContent = "🪙" + state.coins;
  const pct = Gamify.xpInLevel(state.xp);
  document.getElementById("xp-fill").style.width = pct + "%";
  document.getElementById("xp-text").textContent = `あと ${100 - pct} XP で Lv.${lv + 1}`;
}

/* ---------- ホーム画面 ---------- */
function renderHome() {
  // あいさつ
  const name = state.name ? state.name + "さん" : "きみ";
  const hour = new Date().getHours();
  let greet = "こんにちは";
  if (hour < 11) greet = "おはよう";
  else if (hour >= 17) greet = "こんばんは";
  document.getElementById("greeting").textContent = `${greet}、${name}！`;

  // デイリーミッション
  const done = Math.min(state.todayCount, state.dailyGoal);
  document.getElementById("daily-progress").textContent = `${done} / ${state.dailyGoal} 問`;
  document.getElementById("daily-fill").style.width = (done / state.dailyGoal * 100) + "%";
  const dailyMsg = document.getElementById("daily-msg");
  if (state.todayCount >= state.dailyGoal) {
    dailyMsg.textContent = "今日の目標たっせい！すごい！🎉";
  } else {
    dailyMsg.textContent = `今日の目標まで あと ${state.dailyGoal - state.todayCount} 問！`;
  }

  // 苦手アドバイス
  const weak = Adaptive.weakestCategory(state);
  const adviceEl = document.getElementById("advice");
  if (weak) {
    const c = CATEGORIES[weak];
    adviceEl.innerHTML = `いまの苦手は <b>${c.emoji} ${c.name}</b> みたい。少しずつ出していくね。`;
  } else if (state.totalAnswered === 0) {
    adviceEl.textContent = "まずは「今日の問題」をはじめてみよう！";
  } else {
    adviceEl.textContent = "いいちょうし！このまま続けよう。";
  }

  renderReadiness();
  updateChallengeProgress();
  renderCategoryButtons();
  renderBadgesPreview();
  renderStreakCalendar();
}

function updateChallengeProgress() {
  const el = document.getElementById("challenge-progress");
  if (!el) return;
  const total = (window.CHALLENGES || []).length;
  const done = Object.keys(state.challengeDone || {}).length;
  el.textContent = `✍️ ${done} / ${total} 問`;
}

// 合格めやすメーター＋受験日カウントダウン（ホーム）
function renderReadiness() {
  const r = Gamify.readiness(state);
  document.getElementById("readiness-num").textContent = r.score;
  document.getElementById("readiness-fill").style.width = r.score + "%";
  document.getElementById("readiness-stage").textContent = `${r.stage.emoji} ${r.stage.label}`;
  document.getElementById("readiness-advice").textContent = "🧭 " + r.advice;

  // 受験日カウントダウン
  const el = document.getElementById("exam-countdown");
  if (state.examDate) {
    const days = Store.daysBetween(Store.todayStr(), state.examDate);
    if (days > 0) el.textContent = `受験まで あと ${days}日`;
    else if (days === 0) el.textContent = "いよいよ受験本番！";
    else el.textContent = "";
  } else {
    el.textContent = "";
  }
}

function renderCategoryButtons() {
  const wrap = document.getElementById("cat-buttons");
  wrap.innerHTML = "";
  for (const id in CATEGORIES) {
    const c = CATEGORIES[id];
    const acc = state.cat[id].seen > 0 ? Math.round(state.cat[id].correct / state.cat[id].seen * 100) : null;
    const btn = document.createElement("button");
    btn.className = "cat-chip";
    btn.style.borderColor = c.color;
    btn.innerHTML = `<span class="cat-emoji">${c.emoji}</span><span>${c.name}</span>` +
      (acc !== null ? `<span class="cat-acc">${acc}%</span>` : `<span class="cat-acc new">NEW</span>`);
    btn.onclick = () => startQuiz(id);
    wrap.appendChild(btn);
  }
}

function renderBadgesPreview() {
  const wrap = document.getElementById("badge-preview");
  wrap.innerHTML = "";
  Gamify.BADGES.forEach((b) => {
    const got = state.badges.includes(b.id);
    const el = document.createElement("div");
    el.className = "badge" + (got ? " got" : "");
    el.title = b.name + "：" + b.desc;
    el.innerHTML = `<span class="badge-emoji">${got ? b.emoji : "🔒"}</span>`;
    wrap.appendChild(el);
  });
  const got = state.badges.length;
  document.getElementById("badge-count").textContent = `${got} / ${Gamify.BADGES.length}`;
}

// ここ2週間のストリークをカレンダー風に表示（その日の実施問題数つき）
function renderStreakCalendar() {
  const wrap = document.getElementById("streak-cal");
  wrap.innerHTML = "";
  const counts = state.dailyCounts || {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = Store.todayStr(d);
    const n = counts[key] || 0;
    const cell = document.createElement("div");
    cell.className = "cal-cell" + (n > 0 ? " done" : "");
    cell.title = n > 0 ? `${key}：${n}問` : `${key}：おやすみ`;
    // 勉強した日はその日の問題数、していない日は日付を薄く表示
    cell.innerHTML = n > 0
      ? `<span class="cal-count">${n}</span><span class="cal-date">${d.getMonth() + 1}/${d.getDate()}</span>`
      : `<span class="cal-date">${d.getMonth() + 1}/${d.getDate()}</span>`;
    wrap.appendChild(cell);
  }
}

/* ---------- クイズ ---------- */
function startQuiz(categoryId) {
  forcedCategory = categoryId || null;
  nextQuestion();
  showView("view-quiz");
}

function nextQuestion() {
  answered = false;
  let q;
  if (forcedCategory) {
    // その分野の中から、適応ロジックの考え方で1問選ぶ
    const pool = QUESTIONS.filter((x) => x.category === forcedCategory && x.id !== lastQId);
    const list = pool.length ? pool : QUESTIONS.filter((x) => x.category === forcedCategory);
    q = chooseFromPool(list);
  } else {
    q = Adaptive.pickNextQuestion(state, { avoidId: lastQId, recentCats });
  }
  currentQ = q;
  lastQId = q.id;
  recentCats = recentCats.concat(q.category).slice(-4);
  renderQuestion(q);
}

// 分野しぼりこみ時の選び方（復習タイミング＋苦手度を加味）
function chooseFromPool(list) {
  const today = Store.todayStr();
  let best = null, bestScore = -Infinity;
  for (const q of list) {
    const item = state.items[q.id];
    let score = Math.random() * 10;
    if (item) {
      const overdue = item.due ? Store.daysBetween(item.due, today) : 0;
      score += overdue >= 0 ? 20 + overdue * 3 : -20;
      score += (5 - (item.box || 0)) * 4;
    } else {
      score += 25;
    }
    if (score > bestScore) { bestScore = score; best = q; }
  }
  return best;
}

function renderQuestion(q) {
  const c = CATEGORIES[q.category];
  document.getElementById("q-category").textContent = `${c.emoji} ${c.name}`;
  document.getElementById("q-category").style.background = c.color;
  document.getElementById("q-level").textContent = "★".repeat(q.level) + "☆".repeat(3 - q.level);
  document.getElementById("q-text").textContent = q.q;

  const ansArea = document.getElementById("answer-area");
  ansArea.innerHTML = "";
  const feedback = document.getElementById("feedback");
  feedback.className = "feedback";
  feedback.innerHTML = "";
  document.getElementById("hint-box").classList.add("hidden");
  document.getElementById("hint-box").textContent = "";

  if (q.type === "choice") {
    const grid = document.createElement("div");
    grid.className = "choice-grid";
    q.choices.forEach((ch) => {
      const b = document.createElement("button");
      b.className = "choice-btn";
      b.textContent = ch;
      b.onclick = () => submitAnswer(ch, b);
      grid.appendChild(b);
    });
    ansArea.appendChild(grid);
    document.getElementById("submit-btn").classList.add("hidden");
  } else {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.id = "answer-input";
    inp.className = "answer-input";
    inp.placeholder = "答えを入力（数字や言葉）";
    inp.autocomplete = "off";
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !answered) {
        // 既定の動作を止め、このEnterが「つぎの問題」ボタンまで届かないようにする
        e.preventDefault();
        submitAnswer(inp.value, null);
      }
    });
    ansArea.appendChild(inp);
    document.getElementById("submit-btn").classList.remove("hidden");
    setTimeout(() => inp.focus(), 50);
  }
  document.getElementById("next-btn").classList.add("hidden");
}

function submitAnswer(value, btnEl) {
  if (answered) return;
  if (currentQ.type === "input" && !normalize(value)) return; // 空っぽは無視
  answered = true;

  const correct = isAnswerCorrect(currentQ, value);

  // 選択肢ボタンの見た目
  if (currentQ.type === "choice") {
    document.querySelectorAll(".choice-btn").forEach((b) => {
      b.disabled = true;
      if (b.textContent === currentQ.answer) b.classList.add("correct");
      else if (b === btnEl) b.classList.add("wrong");
    });
  } else {
    const inp = document.getElementById("answer-input");
    if (inp) inp.disabled = true;
    document.getElementById("submit-btn").classList.add("hidden");
  }

  // 成績に反映
  Adaptive.recordAnswer(state, currentQ, correct);

  // ごほうび
  let gained = 0;
  if (correct) {
    gained = 10 + (currentQ.level - 1) * 5; // むずかしいほど多い
    state.xp += gained;
    state.coins += currentQ.level;
  } else {
    state.xp += 2; // まちがえても、ちょうせんしたXPは少し入る
  }

  // 今日のカウント・ストリーク
  state.todayCount += 1;
  // 1日ごとの実施問題数・正答数を記録（カレンダー・学習履歴で使う）
  const todayKey = Store.todayStr();
  state.dailyCounts[todayKey] = (state.dailyCounts[todayKey] || 0) + 1;
  if (correct) state.dailyCorrect[todayKey] = (state.dailyCorrect[todayKey] || 0) + 1;
  const beforeStreak = state.streak;
  Gamify.updateStreak(state);

  // バッジ判定
  const newBadges = Gamify.checkNewBadges(state);

  Store.saveState(state);

  // フィードバック表示
  const feedback = document.getElementById("feedback");
  feedback.className = "feedback show " + (correct ? "ok" : "ng");
  let html = "";
  if (correct) {
    const cheers = ["せいかい！🎉", "やったね！✨", "すごい！👏", "その調子！💪", "ナイス！🌟"];
    html += `<div class="fb-title">${cheers[Math.floor(Math.random() * cheers.length)]}</div>`;
    html += `<div class="fb-xp">+${gained} XP　🪙+${currentQ.level}</div>`;
  } else {
    html += `<div class="fb-title">おしい！正解は <b>${currentQ.answer}</b></div>`;
  }
  html += `<div class="fb-exp"><b>かいせつ：</b>${currentQ.exp}</div>`;
  feedback.innerHTML = html;

  if (newBadges.length) showBadgePopup(newBadges);
  if (state.streak > beforeStreak && state.streak >= 2) {
    toast(`🔥 ${state.streak}日れんぞく達成！`);
  }
  if (state.todayCount === state.dailyGoal) {
    toast("🎯 今日の目標たっせい！えらい！");
  }

  lastSubmitAt = Date.now();
  document.getElementById("next-btn").classList.remove("hidden");
  document.getElementById("next-btn").focus();
  renderHeader();
}

/* ---------- ヒント ---------- */
function showHint() {
  if (!currentQ) return;
  const box = document.getElementById("hint-box");
  box.textContent = "💡 ヒント：" + (currentQ.hint || "よく問題を読んでみよう。");
  box.classList.remove("hidden");
}

/* ---------- バッジ獲得ポップアップ ---------- */
function showBadgePopup(badges) {
  const modal = document.getElementById("badge-modal");
  const body = document.getElementById("badge-modal-body");
  body.innerHTML = "";
  badges.forEach((b) => {
    const el = document.createElement("div");
    el.className = "got-badge";
    el.innerHTML = `<div class="got-emoji">${b.emoji}</div><div class="got-name">${b.name}</div><div class="got-desc">${b.desc}</div>`;
    body.appendChild(el);
  });
  modal.classList.remove("hidden");
}

/* ---------- トースト（短いお知らせ） ---------- */
let toastTimer = null;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2500);
}

/* ---------- せいせき画面 ---------- */
function renderStats() {
  const total = state.totalAnswered;
  const correct = state.totalCorrect;
  const rate = total ? Math.round(correct / total * 100) : 0;
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-correct").textContent = correct;
  document.getElementById("stat-rate").textContent = rate + "%";

  renderReadinessBreakdown();

  const wrap = document.getElementById("cat-stats");
  wrap.innerHTML = "";
  for (const id in CATEGORIES) {
    const c = CATEGORIES[id];
    const cs = state.cat[id];
    const acc = cs.seen > 0 ? Math.round(cs.correct / cs.seen * 100) : 0;
    const row = document.createElement("div");
    row.className = "stat-row";
    const label = cs.seen > 0 ? `${acc}%（${cs.correct}/${cs.seen}）` : "まだ";
    row.innerHTML =
      `<div class="stat-name">${c.emoji} ${c.name}</div>` +
      `<div class="bar"><div class="bar-fill" style="width:${acc}%;background:${c.color}"></div></div>` +
      `<div class="stat-val">${label}</div>`;
    wrap.appendChild(row);
  }

  renderDailyHistory();

  // 全バッジ一覧
  const bwrap = document.getElementById("all-badges");
  bwrap.innerHTML = "";
  Gamify.BADGES.forEach((b) => {
    const got = state.badges.includes(b.id);
    const el = document.createElement("div");
    el.className = "badge-full" + (got ? " got" : "");
    el.innerHTML = `<span class="badge-emoji">${got ? b.emoji : "🔒"}</span><span class="badge-name">${b.name}</span><span class="badge-desc">${b.desc}</span>`;
    bwrap.appendChild(el);
  });
}

// 1日ごとの実施問題数（直近14日）を棒グラフで表示
function renderDailyHistory() {
  const wrap = document.getElementById("daily-history");
  if (!wrap) return;
  wrap.innerHTML = "";
  const counts = state.dailyCounts || {};
  const corrects = state.dailyCorrect || {};

  // 直近14日分の {日付, 問題数, 正答数} を新しい順でならべる
  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = Store.todayStr(d);
    days.push({ d, key, n: counts[key] || 0, c: corrects[key] || 0 });
  }
  const max = Math.max(state.dailyGoal, ...days.map((x) => x.n), 1);
  const today = Store.todayStr();
  const weekday = ["日", "月", "火", "水", "木", "金", "土"];

  // 直近14日の合計（実施数・正答数）と勉強した日数
  const sum = days.reduce((a, x) => a + x.n, 0);
  const sumC = days.reduce((a, x) => a + x.c, 0);
  const studied = days.filter((x) => x.n > 0).length;
  document.getElementById("history-summary").textContent =
    `この2週間で ${sum}問中 ${sumC}問 正解（勉強した日 ${studied}日）`;

  days.forEach((x) => {
    const reached = x.n >= state.dailyGoal && state.dailyGoal > 0;
    // バー全体＝実施数、その中の濃い部分＝正答数
    const barW = Math.round(x.n / max * 100);
    const correctW = x.n > 0 ? Math.round(x.c / x.n * 100) : 0;
    const row = document.createElement("div");
    row.className = "hist-row";
    const label = (x.key === today ? "今日" : `${x.d.getMonth() + 1}/${x.d.getDate()}`) +
      `（${weekday[x.d.getDay()]}）`;
    row.innerHTML =
      `<div class="hist-date">${label}</div>` +
      `<div class="bar"><div class="bar-fill hist-fill${reached ? " reached" : ""}" style="width:${barW}%">` +
        `<div class="hist-correct" style="width:${correctW}%"></div></div></div>` +
      `<div class="hist-num">${x.n > 0 ? `${x.c}/${x.n}問` : "—"}${reached ? " 🎯" : ""}</div>`;
    wrap.appendChild(row);
  });
}

// 合格めやすの内わけ（5要素）を棒グラフで表示
function renderReadinessBreakdown() {
  const wrap = document.getElementById("readiness-breakdown");
  if (!wrap) return;
  const r = Gamify.readiness(state);
  const rows = [
    { name: "正答率", v: r.parts.acc, color: "#2d9cdb" },
    { name: "弱点の少なさ", v: r.parts.weakest, color: "#9b59b6" },
    { name: "分野の網羅", v: r.parts.coverage, color: "#27ae60" },
    { name: "学習量", v: r.parts.volume, color: "#f2994a" },
    { name: "継続", v: r.parts.consistency, color: "#e05656" },
  ];
  wrap.innerHTML = "";
  rows.forEach((row) => {
    const pct = Math.round(row.v * 100);
    const el = document.createElement("div");
    el.className = "stat-row";
    el.innerHTML =
      `<div class="stat-name">${row.name}</div>` +
      `<div class="bar"><div class="bar-fill" style="width:${pct}%;background:${row.color}"></div></div>` +
      `<div class="stat-val">${pct}%</div>`;
    wrap.appendChild(el);
  });
}

/* ---------- 適性検査チャレンジ（長文・記述・自己採点） ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function renderChallengeList() {
  const wrap = document.getElementById("challenge-cards");
  wrap.innerHTML = "";
  (window.CHALLENGES || []).forEach((ch) => {
    const done = !!(state.challengeDone && state.challengeDone[ch.id]);
    const card = document.createElement("button");
    card.className = "ch-card" + (done ? " done" : "");
    card.innerHTML =
      `<span class="ch-kindtag kind-${ch.kind === "Ⅰ" ? "1" : "2"}">適性${ch.kind}</span>` +
      `<span class="ch-cardtitle">${escapeHtml(ch.title)}</span>` +
      `<span class="ch-cardmark">${done ? "✅" : "›"}</span>`;
    card.onclick = () => openChallenge(ch.id);
    wrap.appendChild(card);
  });
  updateChallengeProgress();
}

function openChallenge(id) {
  const ch = (window.CHALLENGES || []).find((c) => c.id === id);
  if (!ch) return;
  currentChallenge = ch;
  document.getElementById("ch-kind").textContent = `適性検査${ch.kind}`;
  document.getElementById("ch-title").textContent = ch.title;

  const pa = document.getElementById("ch-passage");
  pa.textContent = ch.passage || "";
  pa.style.display = ch.passage ? "block" : "none";

  const mat = document.getElementById("ch-material");
  if (ch.material) { mat.innerHTML = ch.material; mat.style.display = "block"; }
  else { mat.innerHTML = ""; mat.style.display = "none"; }

  document.getElementById("ch-question").textContent = ch.question;
  document.getElementById("ch-input").value = "";
  document.getElementById("ch-hint").classList.add("hidden");
  document.getElementById("ch-hint").textContent = "";
  const ans = document.getElementById("ch-answer");
  ans.classList.add("hidden");
  ans.innerHTML = "";
  document.getElementById("ch-reveal-btn").classList.remove("hidden");
  showView("view-challenge");
  window.scrollTo(0, 0);
}

function showChallengeHint() {
  if (!currentChallenge) return;
  const box = document.getElementById("ch-hint");
  box.textContent = "💡 ヒント：" + (currentChallenge.hint || "問題と資料をもう一度よく読んでみよう。");
  box.classList.remove("hidden");
}

function revealChallengeAnswer() {
  const ch = currentChallenge;
  if (!ch) return;
  const ans = document.getElementById("ch-answer");
  let html =
    `<div class="ch-ans-title">📝 模範解答（例）</div>` +
    `<div class="ch-model">${escapeHtml(ch.model)}</div>` +
    `<div class="ch-ans-title">✅ 採点ポイント（できたものにチェック）</div><ul class="ch-points">`;
  ch.points.forEach((p) => {
    html += `<li><label><input type="checkbox" class="ch-pt"> ${escapeHtml(p)}</label></li>`;
  });
  html += `</ul>` +
    `<div class="ch-grade">` +
    `<button class="primary-btn" id="ch-done">できた！記録する ✍️</button>` +
    `<button class="ghost-btn" id="ch-retry">もう一度</button></div>`;
  ans.innerHTML = html;
  ans.classList.remove("hidden");
  document.getElementById("ch-reveal-btn").classList.add("hidden");
  document.getElementById("ch-done").onclick = () => gradeChallenge(true);
  document.getElementById("ch-retry").onclick = () => gradeChallenge(false);
  ans.scrollIntoView({ behavior: "smooth", block: "start" });
}

function gradeChallenge(done) {
  const ch = currentChallenge;
  if (!ch) return;
  const today = Store.todayStr();

  // 学習の記録（チャレンジも1問として日々の記録に数える）
  state.todayCount += 1;
  state.dailyCounts[today] = (state.dailyCounts[today] || 0) + 1;
  if (done) {
    state.dailyCorrect[today] = (state.dailyCorrect[today] || 0) + 1;
    state.challengeDone[ch.id] = true;
    state.xp += 25;
    state.coins += 3;
  } else {
    state.xp += 8; // ちょうせんしたXP
  }

  const beforeStreak = state.streak;
  Gamify.updateStreak(state);
  const newBadges = Gamify.checkNewBadges(state);
  Store.saveState(state);

  if (newBadges.length) showBadgePopup(newBadges);
  if (state.streak > beforeStreak && state.streak >= 2) toast(`🔥 ${state.streak}日れんぞく達成！`);
  toast(done ? "よく書けたね！記録したよ ✍️" : "もう一度ちょうせんしてみよう！");

  renderHeader();
  renderChallengeList();
  showView("view-challenge-list");
  window.scrollTo(0, 0);
}

/* ---------- 設定（名前・目標・リセット） ---------- */
function openSettings() {
  document.getElementById("set-name").value = state.name || "";
  document.getElementById("set-goal").value = state.dailyGoal;
  const examNote = document.getElementById("exam-note");
  if (examNote && state.examDate) {
    const [y, m, d] = state.examDate.split("-");
    const days = Store.daysBetween(Store.todayStr(), state.examDate);
    examNote.textContent = `🎯 受験日：${y}年${+m}月${+d}日` + (days > 0 ? `（あと${days}日）` : "");
  }
  document.getElementById("settings-modal").classList.remove("hidden");
}
function saveSettings() {
  state.name = document.getElementById("set-name").value.trim().slice(0, 12);
  let g = parseInt(document.getElementById("set-goal").value, 10);
  if (isNaN(g) || g < 1) g = 5;
  if (g > 50) g = 50;
  state.dailyGoal = g;
  Store.saveState(state);
  document.getElementById("settings-modal").classList.add("hidden");
  renderHeader();
  renderHome();
}

/* ---------- 初期化・イベント ---------- */
function init() {
  renderHeader();
  renderHome();

  document.getElementById("start-today").onclick = () => startQuiz(null);
  document.getElementById("submit-btn").onclick = () => {
    const inp = document.getElementById("answer-input");
    if (inp) submitAnswer(inp.value, null);
  };
  document.getElementById("next-btn").onclick = () => {
    // 答え合わせ直後（同じEnterキーの押し下げ）で次に飛ばないようにする。
    // 解説を読まずにスキップするのを防ぎ、もう一度Enter/クリックで次へ進める。
    if (Date.now() - lastSubmitAt < 350) return;
    // 目標達成後はホームにもどるか聞かずに続ける（やめたいときは戻るボタン）
    nextQuestion();
  };
  document.getElementById("hint-btn").onclick = showHint;
  document.getElementById("quit-quiz").onclick = () => { renderHome(); renderHeader(); showView("view-home"); };

  // 適性検査チャレンジ
  document.getElementById("open-challenges").onclick = () => { renderChallengeList(); showView("view-challenge-list"); };
  document.getElementById("cl-back").onclick = () => { renderHome(); renderHeader(); showView("view-home"); };
  document.getElementById("ch-back").onclick = () => { renderChallengeList(); showView("view-challenge-list"); };
  document.getElementById("ch-reveal-btn").onclick = revealChallengeAnswer;
  document.getElementById("ch-hint-btn").onclick = showChallengeHint;

  document.getElementById("nav-home").onclick = () => { renderHome(); renderHeader(); showView("view-home"); };
  document.getElementById("nav-stats").onclick = () => { renderStats(); showView("view-stats"); };
  document.getElementById("stats-back").onclick = () => { renderHome(); showView("view-home"); };

  document.getElementById("badge-modal-close").onclick = () =>
    document.getElementById("badge-modal").classList.add("hidden");

  document.getElementById("settings-btn").onclick = openSettings;
  document.getElementById("settings-save").onclick = saveSettings;
  document.getElementById("settings-cancel").onclick = () =>
    document.getElementById("settings-modal").classList.add("hidden");
  document.getElementById("settings-reset").onclick = () => {
    if (confirm("学習データをぜんぶ消して、はじめからやり直しますか？")) {
      Store.resetState();
      state = Store.loadState();
      document.getElementById("settings-modal").classList.add("hidden");
      renderHeader(); renderHome(); showView("view-home");
    }
  };
}

document.addEventListener("DOMContentLoaded", init);
