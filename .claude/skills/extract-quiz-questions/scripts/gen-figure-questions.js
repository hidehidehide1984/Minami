#!/usr/bin/env node
/*
 * 図（SVG）つき問題の自動生成器。
 * 答えが「作り方から必ず正しい」families だけを使う（角度和・面積・分数・割合・数列）。
 * 出力: yokohama-minami-quiz-app/js/questions-figures.js
 *   → window.QUESTIONS に concat される（index.html で questions.js の後に読み込む）。
 * 実行: node .claude/skills/extract-quiz-questions/scripts/gen-figure-questions.js
 */
const fs = require("fs");
const path = require("path");

const OUT = path.resolve(
  __dirname, "../../../..",
  "yokohama-minami-quiz-app/js/questions-figures.js"
);

const INK = "#333";
const SHADE = "#bcd6f0";
const S = (v) => String(v);
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function fracStr(a, b) { const g = gcd(a, b); return `${a / g}/${b / g}`; }
// 真分数（1未満・約分後）の誤答候補を作る。answer と重ならない、見た目の自然な分数のみ。
function fracDistractors(a, b, ans) {
  const raw = [[a, b], [b - a, b], [a, b + 1], [a + 1, b + 1], [a - 1, b], [a + 1, b],
    [a, b - 1], [a, b + 2], [a + 1, b + 2], [a + 2, b + 3], [1, b + 1], [a + 2, b + 4]];
  const out = [];
  for (const [p, q] of raw) {
    if (p < 1 || q < 2 || p >= q) continue; // 真分数のみ（0や1以上は除く）
    const s = fracStr(p, q);
    if (s !== ans && !out.includes(s)) out.push(s);
  }
  return out;
}

// 4択を作る。answer を必ず含め、distractors から重複なく3つ選び、位置を idx で回す。
function choices4(answer, distractors, idx) {
  const ans = S(answer);
  const seen = new Set([ans]);
  const out = [];
  for (const d of distractors) {
    const s = S(d);
    if (!seen.has(s)) { seen.add(s); out.push(s); }
    if (out.length >= 3) break;
  }
  let k = 2;
  while (out.length < 3) { const s = S(k); if (!seen.has(s)) { seen.add(s); out.push(s); } k++; }
  const arr = new Array(4);
  const pos = idx % 4;
  arr[pos] = ans;
  let j = 0;
  for (let i = 0; i < 4; i++) if (i !== pos) arr[i] = out[j++];
  return arr;
}

const svg = (vb, body) =>
  `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

const questions = [];
let counter = 0;
function add(cat, level, q, svgStr, answer, distractors, hint, exp, famKey) {
  const idx = counter++;
  const choices = choices4(answer, distractors, idx);
  questions.push({
    id: `fig_${famKey}_${String(idx).padStart(4, "0")}`,
    category: cat, level, type: "choice",
    q, svg: svgStr, choices, answer: S(answer), hint, exp,
  });
}

/* ---------- SVG builders ---------- */
function triAngle(a, b) {
  return svg("260 140",
    `<polygon points="30,120 230,120 95,25" fill="none" stroke="${INK}" stroke-width="2"/>` +
    `<g fill="${INK}" font-size="15" font-family="sans-serif">` +
    `<text x="40" y="112">${a}°</text><text x="192" y="112">${b}°</text>` +
    `<text x="88" y="52">？</text></g>`);
}
function lineAngle(a) {
  return svg("240 120",
    `<line x1="20" y1="92" x2="220" y2="92" stroke="${INK}" stroke-width="2"/>` +
    `<line x1="120" y1="92" x2="188" y2="26" stroke="${INK}" stroke-width="2"/>` +
    `<g fill="${INK}" font-size="14" font-family="sans-serif">` +
    `<text x="150" y="82">${a}°</text><text x="92" y="80">？</text></g>`);
}
function pointAngle(a, b) {
  return svg("200 190",
    `<g stroke="${INK}" stroke-width="2">` +
    `<line x1="100" y1="100" x2="188" y2="100"/>` +
    `<line x1="100" y1="100" x2="32" y2="52"/>` +
    `<line x1="100" y1="100" x2="82" y2="186"/></g>` +
    `<g fill="${INK}" font-size="14" font-family="sans-serif">` +
    `<text x="120" y="82">${a}°</text><text x="52" y="118">${b}°</text>` +
    `<text x="118" y="150">？</text></g>`);
}
function rectFig(w, h) {
  return svg("220 150",
    `<rect x="30" y="20" width="160" height="100" fill="none" stroke="${INK}" stroke-width="2"/>` +
    `<g fill="${INK}" font-size="14" font-family="sans-serif">` +
    `<text x="110" y="142" text-anchor="middle">よこ ${w}cm</text>` +
    `<text x="18" y="74" text-anchor="middle" transform="rotate(-90 18 74)">たて ${h}cm</text></g>`);
}
function rightTri(b, h) {
  return svg("220 160",
    `<polygon points="40,130 200,130 40,30" fill="none" stroke="${INK}" stroke-width="2"/>` +
    `<rect x="40" y="118" width="12" height="12" fill="none" stroke="${INK}"/>` +
    `<g fill="${INK}" font-size="14" font-family="sans-serif">` +
    `<text x="122" y="150" text-anchor="middle">底辺 ${b}cm</text>` +
    `<text x="22" y="82" text-anchor="middle" transform="rotate(-90 22 82)">高さ ${h}cm</text></g>`);
}
function parallelogram(b, h) {
  return svg("240 150",
    `<polygon points="50,120 200,120 170,40 20,40" fill="none" stroke="${INK}" stroke-width="2"/>` +
    `<line x1="50" y1="120" x2="50" y2="40" stroke="${INK}" stroke-dasharray="4 3"/>` +
    `<g fill="${INK}" font-size="14" font-family="sans-serif">` +
    `<text x="125" y="140" text-anchor="middle">底辺 ${b}cm</text>` +
    `<text x="58" y="86">高さ ${h}cm</text></g>`);
}
function pol(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}
function pie(b, a) {
  const cx = 78, cy = 78, r = 62;
  let body = "";
  for (let i = 0; i < b; i++) {
    const [x0, y0] = pol(cx, cy, r, i * 360 / b);
    const [x1, y1] = pol(cx, cy, r, (i + 1) * 360 / b);
    const large = 360 / b > 180 ? 1 : 0;
    const fill = i < a ? SHADE : "#fff";
    body += `<path d="M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z" fill="${fill}" stroke="${INK}" stroke-width="1.5"/>`;
  }
  return svg("156 156", body);
}
function fracBar(b, a) {
  const x0 = 10, y0 = 15, w = 200, h = 34, seg = w / b;
  let body = "";
  for (let i = 0; i < b; i++) {
    body += `<rect x="${(x0 + i * seg).toFixed(1)}" y="${y0}" width="${seg.toFixed(1)}" height="${h}" fill="${i < a ? SHADE : "#fff"}" stroke="${INK}" stroke-width="1.5"/>`;
  }
  return svg("220 64", body);
}
function tensBar(k) {
  const x0 = 10, y0 = 15, seg = 20, h = 34;
  let body = "";
  for (let i = 0; i < 10; i++) {
    body += `<rect x="${x0 + i * seg}" y="${y0}" width="${seg}" height="${h}" fill="${i < k ? SHADE : "#fff"}" stroke="${INK}" stroke-width="1.5"/>`;
  }
  return svg("220 64", body);
}
function squaresFig(cells) {
  const u = 24, ox = 12, oy = 12;
  let maxx = 0, maxy = 0;
  let body = "";
  for (const [x, y] of cells) {
    body += `<rect x="${ox + x * u}" y="${oy + y * u}" width="${u}" height="${u}" fill="${SHADE}" stroke="${INK}" stroke-width="1.5"/>`;
    maxx = Math.max(maxx, x); maxy = Math.max(maxy, y);
  }
  const vw = ox * 2 + (maxx + 1) * u, vh = oy * 2 + (maxy + 1) * u;
  return svg(`${vw} ${vh}`, body);
}
function rowsDots(counts) {
  let body = "";
  counts.forEach((n, gi) => {
    const cx = 45 + gi * 70;
    for (let d = 0; d < n; d++) {
      body += `<circle cx="${cx}" cy="${104 - d * 15}" r="6" fill="${INK}"/>`;
    }
    body += `<text x="${cx}" y="126" fill="${INK}" font-size="13" text-anchor="middle" font-family="sans-serif">${n}</text>`;
  });
  return svg(`${counts.length * 70 + 20} 140`, body);
}

/* ---------- generators ---------- */
// Z1 三角形の内角
(function () {
  let n = 0;
  for (let a = 25; a <= 140 && n < 285; a += 5)
    for (let b = a; b <= 150 && n < 285; b += 5) {
      const ans = 180 - a - b;
      if (ans < 25 || ans > 130) continue;
      add("zukei", 2,
        `図の三角形で、2つの角が${a}°と${b}°です。残りの角（？）は何度？`,
        triAngle(a, b), `${ans}°`,
        [`${ans + 10}°`, `${ans - 10}°`, `${180 - a}°`, `${180 - b}°`, `${ans + 20}°`],
        "三角形の3つの角をたすと180°です。",
        `三角形の内角の和は180°。180−${a}−${b}＝${ans}°。`, "triang");
      n++;
    }
})();
// Z2 直線上の角
(function () {
  let n = 0;
  for (let a = 20; a <= 160 && n < 130; a += 1) {
    const ans = 180 - a;
    add("zukei", 1,
      `一直線の上に角があります。片方が${a}°のとき、もう片方（？）は何度？`,
      lineAngle(a), `${ans}°`,
      [`${a}°`, `90°`, `${ans + 10}°`, `${ans - 10}°`, `${360 - a}°`],
      "一直線の角度は180°です。",
      `一直線は180°。180−${a}＝${ans}°。`, "linang");
    n++;
  }
})();
// Z3 一点のまわりの角
(function () {
  let n = 0;
  for (let a = 60; a <= 160 && n < 110; a += 10)
    for (let b = 60; b <= 200 && n < 110; b += 10) {
      const ans = 360 - a - b;
      if (ans < 40 || ans > 240) continue;
      add("zukei", 2,
        `1つの点のまわりに3つの角があります。2つが${a}°と${b}°のとき、残り（？）は何度？`,
        pointAngle(a, b), `${ans}°`,
        [`${ans + 10}°`, `${ans - 10}°`, `${180 - a}°`, `${ans + 20}°`, `${ans - 20}°`],
        "1つの点のまわりを1周すると360°です。",
        `1点のまわりは360°。360−${a}−${b}＝${ans}°。`, "ptang");
      n++;
    }
})();
// Z4 長方形の面積
(function () {
  let n = 0;
  for (let w = 2; w <= 13 && n < 170; w++)
    for (let h = 2; h <= 15 && n < 170; h++) {
      const ans = w * h;
      add("zukei", 2,
        `たて${h}cm、よこ${w}cmの長方形の面積は何cm²？`,
        rectFig(w, h), `${ans}cm²`,
        [`${2 * (w + h)}cm²`, `${w + h}cm²`, `${ans + w}cm²`, `${ans - h}cm²`, `${(w + 1) * h}cm²`],
        "たて×よこ で求めます。",
        `長方形の面積＝たて×よこ＝${h}×${w}＝${ans}cm²。`, "rect");
      n++;
    }
})();
// Z6 直角三角形の面積
(function () {
  let n = 0;
  for (let b = 4; b <= 14 && n < 110; b++)
    for (let h = 3; h <= 12 && n < 110; h++) {
      if ((b * h) % 2 !== 0) continue;
      const ans = b * h / 2;
      add("zukei", 3,
        `図の直角三角形の面積は何cm²？（底辺${b}cm、高さ${h}cm）`,
        rightTri(b, h), `${ans}cm²`,
        [`${b * h}cm²`, `${ans + b}cm²`, `${ans - h}cm²`, `${b + h}cm²`, `${ans + 2}cm²`],
        "三角形の面積は「底辺×高さ÷2」です。",
        `底辺×高さ÷2＝${b}×${h}÷2＝${ans}cm²。`, "rtri");
      n++;
    }
})();
// Z7 平行四辺形の面積
(function () {
  let n = 0;
  for (let b = 4; b <= 14 && n < 90; b++)
    for (let h = 3; h <= 11 && n < 90; h++) {
      const ans = b * h;
      add("zukei", 2,
        `図の平行四辺形の面積は何cm²？（底辺${b}cm、高さ${h}cm）`,
        parallelogram(b, h), `${ans}cm²`,
        [`${b * h / 2}cm²`, `${b + h}cm²`, `${2 * (b + h)}cm²`, `${ans + b}cm²`, `${ans - h}cm²`],
        "平行四辺形の面積は「底辺×高さ」です。",
        `底辺×高さ＝${b}×${h}＝${ans}cm²。`, "para");
      n++;
    }
})();
// W1 円の分数
(function () {
  let n = 0;
  for (let b = 2; b <= 10 && n < 60; b++)
    for (let a = 1; a < b && n < 60; a++) {
      const ans = fracStr(a, b);
      add("wariai", 2,
        `円を${b}等分し、そのうち${a}個分に色をぬりました。色をぬった部分は全体のどれだけ？（分数で）`,
        pie(b, a), ans,
        fracDistractors(a, b, ans),
        "（色をぬった数）／（全部の数）で表し、約分します。",
        `${a}/${b} を約分して ${ans}。`, "piefr");
      n++;
    }
})();
// W2 帯の分数
(function () {
  let n = 0;
  for (let b = 2; b <= 10 && n < 45; b++)
    for (let a = 1; a < b && n < 45; a++) {
      const ans = fracStr(a, b);
      add("wariai", 2,
        `棒を${b}等分し、そのうち${a}個分に色をぬりました。色をぬった部分は全体のどれだけ？（分数で）`,
        fracBar(b, a), ans,
        fracDistractors(a, b, ans),
        "（色をぬった数）／（全部の数）で表し、約分します。",
        `${a}/${b} を約分して ${ans}。`, "barfr");
      n++;
    }
})();
// W3 割合（％）
(function () {
  for (let k = 1; k <= 9; k++) {
    const ans = k * 10;
    add("wariai", 1,
      `10個に区切った棒の、${k}個分に色をぬりました。色をぬった部分は全体の何％？`,
      tensBar(k), `${ans}%`,
      [`${ans + 10}%`, `${ans - 10}%`, `${k}%`, `${ans + 20}%`, `${100 - ans}%`],
      "全部で10個なら、1個で10％です。",
      `1個＝10％。${k}個で ${ans}％。`, "pct");
  }
})();
// Z5 正方形を数える（長方形からかどを欠いた形）
(function () {
  let n = 0;
  for (let w = 3; w <= 6 && n < 40; w++)
    for (let h = 3; h <= 6 && n < 40; h++)
      for (let c = 1; c <= 2 && n < 40; c++)
        for (let d = 1; d <= 2 && n < 40; d++) {
          if (c >= w || d >= h) continue;
          const cells = [];
          for (let x = 0; x < w; x++)
            for (let y = 0; y < h; y++)
              if (!(x >= w - c && y >= h - d)) cells.push([x, y]);
          const ans = cells.length;
          add("zukei", 2,
            "同じ大きさの正方形をならべた図です。正方形は全部で何個？",
            squaresFig(cells), `${ans}個`,
            [`${ans + 1}個`, `${ans - 1}個`, `${w * h}個`, `${ans + 2}個`, `${ans - 2}個`],
            "たて・よこに分けて数えると数えやすいです。",
            `全部で ${ans} 個（${w}×${h} から欠けた ${c * d} 個をひく）。`, "cntsq");
          n++;
        }
})();
// K3 点の数のならびの規則（等差）
(function () {
  let n = 0;
  for (let s = 1; s <= 6 && n < 40; s++)
    for (let dd = 1; dd <= 6 && n < 40; dd++) {
      const t = [s, s + dd, s + 2 * dd];
      const ans = s + 3 * dd;
      add("kazu", 2,
        `点の数が ${t[0]}, ${t[1]}, ${t[2]} とならんでいます。次に来る数は？`,
        rowsDots(t), `${ans}`,
        [`${ans + dd}`, `${ans - dd}`, `${ans + 1}`, `${s + 4 * dd}`, `${ans - 1}`],
        `${dd} ずつ増えています。`,
        `${dd} ずつ増える。${t[2]}＋${dd}＝${ans}。`, "seq");
      n++;
    }
})();

/* ---------- write ---------- */
const header =
  "/* 自動生成: 図(SVG)つき問題。generator: .claude/skills/extract-quiz-questions/scripts/gen-figure-questions.js\n" +
  " * 手で編集しないこと（再生成される）。window.QUESTIONS に追加される。 */\n";
const out =
  header +
  "(function () {\n  var FIG = " + JSON.stringify(questions) + ";\n" +
  "  window.QUESTIONS = (window.QUESTIONS || []).concat(FIG);\n})();\n";
fs.writeFileSync(OUT, out);
console.log("generated", questions.length, "figure questions ->", OUT);
