---
name: extract-quiz-questions
description: >-
  南中チャレンジ（yokohama-minami-quiz-app）の問題バンクに、適性検査の問題・答え・
  解説を「画像やPDFの教材から抽出」して4択問題として登録するワークフロー。
  ユーザーが試験問題・過去問・問題集の画像/PDF/写真を添付して「問題を抽出して」
  「問題に登録して」「答えと解説を付けて」などと依頼したときに使う。
  Use when extracting questions/answers/explanations from exam material
  (images, PDFs, scans) into this repo's quiz question bank (questions.js).
---

# 教材から問題・答え・解説を抽出して問題バンクに登録する

適性検査の教材（画像・PDF・写真）から問題を読み取り、**4択の練習問題**に整形して
`yokohama-minami-quiz-app/js/questions.js` に登録するための手順。
答えと解説（`exp`）は、教材に付いている解説解答があればそれを根拠にする。

## 対象ファイルと形式

登録先: `yokohama-minami-quiz-app/js/questions.js`
配列 `QUESTIONS` の各要素は次の形（**すべて `type:"choice"` の4択**）:

```js
{ id: "y2024_01", category: "shakai", level: 2, type: "choice",
  q: "問題文（小6にわかる言葉で）",
  choices: ["正解", "誤り1", "誤り2", "誤り3"], answer: "正解",
  hint: "考え方のヒント（答えは言わない）",
  exp: "解説。教材の解説解答があればそれを根拠に。" }
```

制約（登録前に必ず守る）:
- `choices` は必ず **4つ**、重複なし、`answer` は必ず `choices` の中の文字列と**完全一致**。
- `id` は**未使用のユニーク値**。年度ごとに `yYYYY_NN`（例 `y2024_01`, `y2023_15`）を推奨。
- `category` は次の8種のいずれか（`js/questions.js` 冒頭の `CATEGORIES` と一致）:
  `kotoba`（ことば・漢字） / `dokkai`（読み取り） / `kazu`（数と規則） /
  `zukei`（図形） / `wariai`（割合・速さ） / `rika`（理科） / `shakai`（社会） /
  `shikou`（思考力）
- `level` は 1〜3（1=やさしい, 3=難しい）。

## 手順

### 1. 入力を用意する
- **画像/写真**: そのまま Read で読む。ページが回転していることがあるので向きに注意。
- **PDF**: `pdftoppm` が無い環境が多い。Python の `pymupdf` で画像化する:
  ```bash
  pip3 install --quiet pymupdf
  python3 - <<'PY'
  import fitz
  d = fitz.open("<PDFパス>")
  out = "<出力ディレクトリ(scratchpad)>"
  for i in range(d.page_count):
      d[i].get_pixmap(matrix=fitz.Matrix(2.0, 2.0)).save(f"{out}/p{i+1:02d}.png")
  print("rendered", d.page_count)
  PY
  ```
  出力先はセッションの scratchpad ディレクトリを使う。生成したPNGを Read で読む。
- 埋め込みテキスト（`page.get_text()`）は日本語スキャンだと文字化けしやすい。**画像を読む**方を優先。

### 2. 問題・答え・解説を読み取る
- 問題ページと**解説解答ページの両方**を読む。答えは学校発表・解説の値を正とする。
- 解説解答があれば、その**解き方**を `exp` に要約して入れる（数値や理由の根拠に使う）。

### 3. 4択に整形する（変換ルール）
- **図版依存の設問**（地図・地球儀・グラフ・作図から選ぶ等）は、文字だけで答えられる
  形に**再構成**する（例: 「地図の1〜4から選べ」→「◯◯な地域はどこか」を語句4択に）。
- **記述式・作文・作図・複雑な計算過程**は4択に向かないので**除外**する。
- 誤りの選択肢（ダミー）は、資料・解説から作れるもっともらしい値にする。
- 過去問そのものの丸写しにせず、**内容ベースの練習問題**として書く
  （既存バンクは「オリジナル練習問題（過去問ではない）」という方針）。

### 4. まずリストで提示し、確認を取る（登録前）
- 登録する前に、**問題・選択肢・答え・解説（注釈）の一覧**をチャットに出して
  ユーザーに確認してもらう。修正・削除の要望を受けてから登録する。

### 5. questions.js に追記する
- 配列末尾の閉じ `];` の直前に挿入する（`window.CATEGORIES = ...` より前）。
- 出所がわかるコメント見出しを付ける:
  ```js
  /* ===== 2024年度 南附属中 適性検査Ⅰ から抽出 ===== */
  ```

### 6. 検証する（必須）
同梱スクリプトで整合性チェック。エラーが出たら直す。
```bash
node .claude/skills/extract-quiz-questions/scripts/validate.js
```
確認内容: 総数 / ID重複 / `answer` が `choices` に含まれるか / 4択か /
選択肢重複 / カテゴリが正当か。

### 7. コミット & push
- 作業ブランチ（このセッションの指定ブランチ）にコミットして push。
  `git push -u origin <branch>`、ネットワークエラー時のみ指数バックオフで最大4回。
- コミットメッセージは何を・どこから抽出したかを書く。
- **公開サイトへの反映は別**: GitHub Pages のデプロイは
  `.github/workflows/deploy-pages.yml` の `on.push.branches` に列挙された
  ブランチへの push でのみ発火する。作業ブランチがそこに無い場合、実サイトには
  反映されない。反映が必要なら、その発火ブランチにも同じ変更を反映してよいか
  ユーザーに確認してから行う。

## 注意
- 答えは思い込みで決めず、**教材の解説解答**を根拠にする。歴史・地理・理科の
  一般知識で補う場合も、資料の記述と矛盾しないか確認する。
- 小6が読める語彙・漢字に整える（難しい語にはふりがな相当の言い換えを）。
