#!/usr/bin/env node
/*
 * questions.js の整合性チェック。
 * 使い方: node .claude/skills/extract-quiz-questions/scripts/validate.js [questions.jsのパス]
 * 既定パス: yokohama-minami-quiz-app/js/questions.js
 * 追加分だけ見たいときは: node ... --prefix y2024_
 */
const path = require("path");

const args = process.argv.slice(2);
let file = "yokohama-minami-quiz-app/js/questions.js";
let prefix = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--prefix") prefix = args[++i];
  else file = args[i];
}
const abs = path.resolve(process.cwd(), file);

const VALID_CATEGORIES = [
  "kotoba", "dokkai", "kazu", "zukei", "wariai", "rika", "shakai", "shikou",
];

global.window = {};
try {
  require(abs);
} catch (e) {
  console.error("読み込み失敗:", e.message);
  process.exit(1);
}

const Q = global.window.QUESTIONS;
const CATS = global.window.CATEGORIES;
if (!Array.isArray(Q)) {
  console.error("window.QUESTIONS が配列ではありません");
  process.exit(1);
}

console.log("総問題数:", Q.length);

// ID重複（全体）
const ids = Q.map((q) => q.id);
const dup = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
console.log("ID重複:", dup.length ? dup : "なし");

const target = prefix ? Q.filter((q) => q.id && q.id.startsWith(prefix)) : Q;
if (prefix) console.log(`対象(${prefix}):`, target.length, "問");

const errors = [];
for (const q of target) {
  const tag = q.id || "(id無し)";
  if (!q.id) errors.push(`${tag}: id が無い`);
  if (!q.q) errors.push(`${tag}: q（問題文）が無い`);
  if (q.type !== "choice") errors.push(`${tag}: type が "choice" でない`);
  if (!Array.isArray(q.choices) || q.choices.length !== 4)
    errors.push(`${tag}: choices が4つでない`);
  else {
    if (new Set(q.choices).size !== q.choices.length)
      errors.push(`${tag}: choices に重複`);
    if (!q.choices.includes(q.answer))
      errors.push(`${tag}: answer が choices に無い（"${q.answer}"）`);
  }
  const cats = CATS ? Object.keys(CATS) : VALID_CATEGORIES;
  if (!cats.includes(q.category))
    errors.push(`${tag}: 未知カテゴリ "${q.category}"`);
  if (![1, 2, 3].includes(q.level))
    errors.push(`${tag}: level は1〜3であるべき（"${q.level}"）`);
}

if (errors.length) {
  console.log("整合性エラー:");
  for (const e of errors) console.log("  -", e);
  process.exit(1);
}
console.log("整合性: 全問OK");
