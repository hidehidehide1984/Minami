/*
 * バックアップ＆クラウド同期
 *
 * 1) バックアップ（ネット不要）
 *    学習記録をJSONファイルに書き出し／読み込みできる。
 *    読み込みは「上書き」ではなく mergeStates で合成するので、
 *    どちらの端末でがんばった記録も消えない。
 *
 * 2) クラウド同期（Firebase Firestore の REST API を直接使用。SDK不要）
 *    「同期コード」（例 minami-K7F3-QX9A-M2Td）をドキュメントIDにして、
 *    記録JSONを1ドキュメントに保存する。コードを知っている端末だけが
 *    読み書きできる（コードが実質のパスワード。氏名・メールは送らない）。
 *
 *    設定は js/firebase-config.js（apiKey / projectId）。
 *    未設定のままでもアプリは今まで通り動く（同期だけオフ）。
 *    セットアップ手順は SETUP_FIREBASE.md を参照。
 */

(function () {
  const SYNC_CODE_KEY = "minami_sync_code"; // 端末ごとの設定なので state には入れない

  /* ========== 2つの学習記録を合成（どちらの努力も消さない） ========== */
  function mergeStates(sa, sb) {
    if (!sa) return sb;
    if (!sb) return sa;
    const a = JSON.parse(JSON.stringify(sa));
    const b = JSON.parse(JSON.stringify(sb));
    // aをベースに、項目ごとに「良いほう」を採用していく
    // （mを別オブジェクトにするのは、m.cat={} 等の初期化で参照元aを壊さないため）
    const m = Object.assign({}, a);
    const laterStr = (x, y) => (String(x || "") >= String(y || "") ? x : y);

    // 積み上げ系は大きいほう
    for (const k of ["xp", "coins", "totalAnswered", "totalCorrect", "streak"]) {
      m[k] = Math.max(a[k] || 0, b[k] || 0);
    }
    m.lastStudyDate = laterStr(a.lastStudyDate, b.lastStudyDate);
    m.studyDates = [...new Set([...(a.studyDates || []), ...(b.studyDates || [])])].sort();
    m.badges = [...new Set([...(a.badges || []), ...(b.badges || [])])];

    // 日別の記録は日付ごとに大きいほう
    for (const src of ["dailyCounts", "dailyCorrect"]) {
      m[src] = {};
      const keys = new Set([...Object.keys(a[src] || {}), ...Object.keys(b[src] || {})]);
      for (const k of keys) m[src][k] = Math.max((a[src] || {})[k] || 0, (b[src] || {})[k] || 0);
    }

    // 分野別成績は「多く解いているほう」を採用
    m.cat = {};
    {
      const keys = new Set([...Object.keys(a.cat || {}), ...Object.keys(b.cat || {})]);
      for (const k of keys) {
        const ca = (a.cat || {})[k], cb = (b.cat || {})[k];
        m.cat[k] = !ca ? cb : !cb ? ca : ((cb.seen || 0) > (ca.seen || 0) ? cb : ca);
      }
    }

    // 問題ごとの復習記録は「最後に解いた日が新しいほう」（同日なら回数が多いほう）
    m.items = {};
    {
      const keys = new Set([...Object.keys(a.items || {}), ...Object.keys(b.items || {})]);
      for (const k of keys) {
        const ia = (a.items || {})[k], ib = (b.items || {})[k];
        if (!ia) { m.items[k] = ib; continue; }
        if (!ib) { m.items[k] = ia; continue; }
        const da = String(ia.lastDate || ""), db = String(ib.lastDate || "");
        if (da === db) m.items[k] = (ib.seen || 0) > (ia.seen || 0) ? ib : ia;
        else m.items[k] = db > da ? ib : ia;
      }
    }

    m.challengeDone = Object.assign({}, b.challengeDone || {}, a.challengeDone || {});
    m.charmUsedMonth = laterStr(a.charmUsedMonth, b.charmUsedMonth);
    m.comeback = !!(a.comeback || b.comeback);
    m.goalV2 = !!(a.goalV2 || b.goalV2);
    m.name = a.name || b.name || "";
    m.dailyGoal = a.dailyGoal || b.dailyGoal || 30;
    m.examDate = a.examDate || b.examDate;

    // 「今日のカウント」は同じ日なら大きいほう、違う日なら新しい日のもの
    if ((a.todayDate || "") === (b.todayDate || "")) {
      m.todayCount = Math.max(a.todayCount || 0, b.todayCount || 0);
    } else if (String(b.todayDate || "") > String(a.todayDate || "")) {
      m.todayDate = b.todayDate;
      m.todayCount = b.todayCount || 0;
    }
    return m;
  }

  /* ========== バックアップ（ファイル書き出し／読み込み） ========== */
  function exportBackup(state) {
    const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = `minami-kiroku-${Store.todayStr()}.json`;
    document.body.appendChild(el);
    el.click();
    el.remove();
    URL.revokeObjectURL(url);
  }

  function importBackupFile(file, onOk, onErr) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const obj = JSON.parse(r.result);
        if (!obj || typeof obj !== "object" || !("totalAnswered" in obj || "xp" in obj)) throw new Error("bad file");
        onOk(obj);
      } catch (e) { if (onErr) onErr(); }
    };
    r.onerror = () => { if (onErr) onErr(); };
    r.readAsText(file);
  }

  /* ========== クラウド同期（Firestore REST） ========== */
  let hooks = null;      // app.js から渡される { getState, setState, onUpdated }
  let pushTimer = null;
  let lastSyncAt = 0;
  let lastError = "";

  function isConfigured() {
    const c = window.FIREBASE_CONFIG;
    return !!(c && c.apiKey && c.projectId);
  }
  function getSyncCode() {
    try { return localStorage.getItem(SYNC_CODE_KEY) || ""; } catch (e) { return ""; }
  }
  function setSyncCode(code) {
    try {
      if (code) localStorage.setItem(SYNC_CODE_KEY, code);
      else localStorage.removeItem(SYNC_CODE_KEY);
    } catch (e) { /* 保存できなくても続行 */ }
  }
  // 紛らわしい文字（I・L・O・0・1）をのぞいたランダムコード
  function newSyncCode() {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const buf = new Uint8Array(12);
    crypto.getRandomValues(buf);
    let s = "";
    for (const v of buf) s += chars[v % chars.length];
    return `minami-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
  }
  function docUrl(code) {
    const c = window.FIREBASE_CONFIG;
    return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(c.projectId)}` +
      `/databases/(default)/documents/progress/${encodeURIComponent(code)}` +
      `?key=${encodeURIComponent(c.apiKey)}`;
  }

  async function pullRemote(code) {
    const res = await fetch(docUrl(code));
    if (res.status === 404) return null; // まだ何も保存されていない
    if (!res.ok) throw new Error("pull " + res.status);
    const j = await res.json();
    const raw = j.fields && j.fields.data && j.fields.data.stringValue;
    return raw ? JSON.parse(raw) : null;
  }

  async function pushRemote(code, state) {
    const body = {
      fields: {
        data: { stringValue: JSON.stringify(state) },
        updatedAt: { integerValue: String(Date.now()) },
      },
    };
    const res = await fetch(docUrl(code), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("push " + res.status);
    lastSyncAt = Date.now();
    lastError = "";
  }

  // 保存のたびに呼ばれ、3秒待ってからまとめてクラウドへ（連打対策）
  function schedulePush() {
    if (!hooks || !isConfigured() || !getSyncCode()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushRemote(getSyncCode(), hooks.getState())
        .catch((e) => { lastError = String((e && e.message) || e); });
    }, 3000);
  }

  // クラウドの記録を取得→手元と合成→両方を最新にする
  async function syncNow() {
    if (!hooks || !isConfigured() || !getSyncCode()) return false;
    const code = getSyncCode();
    const remote = await pullRemote(code);
    let local = hooks.getState();
    if (remote) {
      const merged = mergeStates(local, remote);
      hooks.setState(merged);
      local = merged;
      if (hooks.onUpdated) hooks.onUpdated();
    }
    await pushRemote(code, local);
    return true;
  }

  function initCloudSync(h) {
    hooks = h;
    // どこかで Store.saveState が呼ばれるたび、自動でクラウドにも送る
    const orig = Store.saveState;
    Store.saveState = function (s) { orig(s); schedulePush(); };
    // 起動時の自動同期（失敗しても静かに続行。オフラインでも今まで通り動く）
    if (isConfigured() && getSyncCode()) {
      syncNow().catch((e) => { lastError = String((e && e.message) || e); });
    }
  }

  window.CloudSync = {
    mergeStates, exportBackup, importBackupFile,
    isConfigured, getSyncCode, setSyncCode, newSyncCode,
    syncNow, init: initCloudSync,
    status: () => ({ lastSyncAt, lastError }),
  };
})();
