/*
 * みまもり画面（保護者むけ・閲覧専用）
 *
 * ブックマークしたURL（例 mimamori.html?code=minami-XXXX-XXXX-XXXX）を開くと、
 * その同期コードの学習記録をFirestoreから読み取って表示する。
 * 書き込みは一切しない（お子さんの記録を誤って変えない）。
 */

// 分野の表示情報（本体の questions.js と同じ。読み取り専用なので小さく持つ）
window.CATEGORIES = {
  kotoba: { name: "ことば・漢字", emoji: "📝", color: "#ef6c9b" },
  dokkai: { name: "読み取り", emoji: "📖", color: "#8e7cff" },
  kazu:   { name: "数と規則", emoji: "🔢", color: "#2d9cdb" },
  zukei:  { name: "図形",     emoji: "📐", color: "#27ae60" },
  wariai: { name: "割合・速さ", emoji: "⚖️", color: "#f2994a" },
  rika:   { name: "理科",     emoji: "🔬", color: "#16a085" },
  shakai: { name: "社会",     emoji: "🗾", color: "#c0392b" },
  shikou: { name: "思考力",   emoji: "🧩", color: "#9b59b6" },
};
const CATEGORIES = window.CATEGORIES;

let currentCode = "";
let autoTimer = null;

/* ---------- 画面の出し分け ---------- */
function show(which) {
  document.getElementById("mm-input-view").style.display = which === "input" ? "block" : "none";
  document.getElementById("mm-dash-view").style.display = which === "dash" ? "block" : "none";
  const msg = document.getElementById("mm-msg");
  msg.style.display = which === "msg" ? "block" : "none";
}
function showMsg(text) { document.getElementById("mm-msg").innerHTML = text; show("msg"); }

function codeFromUrl() {
  const p = new URLSearchParams(location.search);
  return (p.get("code") || "").trim();
}

/* ---------- 読み込み ---------- */
async function load(code) {
  if (!CloudSync.isConfigured()) {
    document.getElementById("mm-input-note").innerHTML =
      "⚠️ クラウド同期がまだ設定されていません。<b>SETUP_FIREBASE.md</b> の手順で設定すると使えます。";
    show("input");
    return;
  }
  showMsg("よみこみ中… ☁️");
  let state;
  try {
    state = await CloudSync.pull(code);
  } catch (e) {
    showMsg("つながりませんでした。<br>コードやインターネット接続をかくにんしてください。<br><button class='link-btn' onclick='goInput()'>コードを入れなおす</button>");
    return;
  }
  if (!state) {
    showMsg("まだ記録がありません。<br>お子さんがアプリで問題を解くと、ここに表示されます。<br><button class='link-btn' onclick='location.reload()'>🔄 もう一度みる</button>　<button class='link-btn' onclick='goInput()'>コードを入れなおす</button>");
    return;
  }
  currentCode = code;
  render(state);
  show("dash");
  // 1分ごとに自動更新（開きっぱなしでも最新に）
  clearInterval(autoTimer);
  autoTimer = setInterval(() => { CloudSync.pull(code).then((s) => { if (s) render(s); }).catch(() => {}); }, 60000);
}

/* ---------- 描画 ---------- */
function render(state) {
  const name = state.name ? state.name + "さん" : "お子さん";
  document.getElementById("mm-title").textContent = `📊 ${name}の学習のようす`;

  // 受験カウントダウン
  let examTxt = "";
  if (state.examDate) {
    const d = Store.daysBetween(Store.todayStr(), state.examDate);
    if (d > 0) examTxt = `受験まで あと${d}日`;
    else if (d === 0) examTxt = "受験本番！";
  }
  document.getElementById("mm-exam").textContent = examTxt;
  document.getElementById("mm-exam2").textContent = examTxt;

  // 合格めやす
  const r = Gamify.readiness(state);
  document.getElementById("mm-score").textContent = r.score;
  document.getElementById("mm-score-fill").style.width = r.score + "%";
  document.getElementById("mm-stage").textContent = `${r.stage.emoji} ${r.stage.label}`;

  // 今週（直近7日）
  const counts = state.dailyCounts || {};
  let weekDays = 0, weekQ = 0;
  for (let i = 0; i < 7; i++) {
    const dd = new Date(); dd.setDate(dd.getDate() - i);
    const n = counts[Store.todayStr(dd)] || 0;
    if (n > 0) weekDays++;
    weekQ += n;
  }
  document.getElementById("mm-week-days").textContent = weekDays + "日";
  document.getElementById("mm-week-q").textContent = weekQ + "問";
  const rate = state.totalAnswered ? Math.round(state.totalCorrect / state.totalAnswered * 100) : 0;
  document.getElementById("mm-rate").textContent = rate + "%";

  // 2週間カレンダー
  const cal = document.getElementById("mm-cal");
  cal.innerHTML = "";
  for (let i = 13; i >= 0; i--) {
    const dd = new Date(); dd.setDate(dd.getDate() - i);
    const n = counts[Store.todayStr(dd)] || 0;
    const cell = document.createElement("div");
    cell.className = "cal-cell" + (n > 0 ? " done" : "");
    cell.title = n > 0 ? `${Store.todayStr(dd)}：${n}問` : `${Store.todayStr(dd)}：おやすみ`;
    cell.innerHTML = n > 0
      ? `<span class="cal-count">${n}</span><span class="cal-date">${dd.getMonth() + 1}/${dd.getDate()}</span>`
      : `<span class="cal-date">${dd.getMonth() + 1}/${dd.getDate()}</span>`;
    cal.appendChild(cell);
  }

  // 分野ごとの正答率
  const cwrap = document.getElementById("mm-cats");
  cwrap.innerHTML = "";
  for (const id in CATEGORIES) {
    const c = CATEGORIES[id];
    const cs = (state.cat || {})[id] || { seen: 0, correct: 0 };
    const acc = cs.seen > 0 ? Math.round(cs.correct / cs.seen * 100) : 0;
    const row = document.createElement("div");
    row.className = "stat-row";
    const label = cs.seen > 0 ? `${acc}%（${cs.correct}/${cs.seen}）` : "まだ";
    row.innerHTML =
      `<div class="stat-name">${c.emoji} ${c.name}</div>` +
      `<div class="bar"><div class="bar-fill" style="width:${acc}%;background:${c.color}"></div></div>` +
      `<div class="stat-val">${label}</div>`;
    cwrap.appendChild(row);
  }

  // おうちの方へ
  renderPoints(state, weekDays);

  const upd = new Date();
  document.getElementById("mm-updated").textContent =
    `最終更新：${upd.toLocaleString("ja-JP")}（1分ごとに自動更新）`;
}

function renderPoints(state, weekDays) {
  const wrap = document.getElementById("mm-points");
  const pts = [];
  if (weekDays > 0) pts.push(`今週は <b>${weekDays}日</b> 学習できました${weekDays >= 4 ? "（よく続いています！）" : ""}。`);
  if ((state.streak || 0) >= 2) pts.push(`連続 <b>${state.streak}日</b> 継続中。正解数よりも、続けていることをほめてあげてください。`);
  let best = null, bestAcc = -1, worst = null, worstAcc = 2;
  for (const id in CATEGORIES) {
    const c = (state.cat || {})[id]; if (!c || c.seen < 5) continue;
    const acc = c.correct / c.seen;
    if (acc > bestAcc) { bestAcc = acc; best = id; }
    if (acc < worstAcc) { worstAcc = acc; worst = id; }
  }
  if (best) pts.push(`<b>${CATEGORIES[best].name}</b> の正答率が高めです（${Math.round(bestAcc * 100)}%）。`);
  if (worst && worst !== best) pts.push(`<b>${CATEGORIES[worst].name}</b> をもう少し練習するとバランスが良くなります。`);
  const total = state.totalAnswered || 0;
  pts.push(`これまでの合計：<b>${total}問</b>（うち正解 ${state.totalCorrect || 0}問）。`);
  if (pts.length === 0) pts.push("まだデータが少なめです。毎日少しずつ、続けられたらぜひほめてあげてください。");
  wrap.innerHTML = pts.map((p) => `<li>${p}</li>`).join("");
}

/* ---------- 操作 ---------- */
function goInput() { location.href = "mimamori.html"; }
window.goInput = goInput;

function init() {
  document.getElementById("mm-refresh").onclick = () => { if (currentCode) load(currentCode); };
  document.getElementById("mm-change").onclick = goInput;
  document.getElementById("mm-code-go").onclick = () => {
    const c = document.getElementById("mm-code-input").value.trim();
    if (!c) return;
    if (!/^minami-/i.test(c)) { showToast("コードは minami- ではじまります"); return; }
    // URLにコードを入れて開き直す（ブックマークできる）
    location.href = "mimamori.html?code=" + encodeURIComponent(c);
  };
  document.getElementById("mm-code-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("mm-code-go").click();
  });

  const code = codeFromUrl();
  if (code) load(code);
  else show("input");
}

/* かんたんなトースト */
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2500);
}

document.addEventListener("DOMContentLoaded", init);
