# 🤝 引き継ぎ書：クラウド同期の有効化（別セッション用）

このドキュメントは、**別のセッション（新しいAI）** が、Firebaseクラウド同期の
「残りの作業」を最後まで実施できるようにまとめたものです。
あなた（利用者）がFirebaseプロジェクトを作成したあと、下の「コピペ用の依頼文」を
新セッションの最初のメッセージに貼ってください。

---

## 0. 全体像（役割分担）

| 誰が | 何を |
|---|---|
| **あなた** | Firebaseプロジェクト作成・Firestore作成・ルール公開・公開値2つの取得（`SETUP_FIREBASE.md` 手順1〜4） |
| **新セッションのAI** | `firebase-config.js` に値を設定 → コミット＆push → デプロイ確認 →（ネットがあれば）実通信で同期テスト＆URL確認 |

> クラウド同期・みまもり画面の**コードはすでに実装・デプロイ済み**です。
> 残っているのは「設定値2つを入れて配線する」ことと「動作確認」だけです。

---

## 1. あなたが先にやること（新セッションを始める前）

1. `SETUP_FIREBASE.md` の **手順1〜4** を実施
   - プロジェクト作成（Analyticsオフ）
   - Firestore Database 作成（ロケーション **`asia-northeast1`**）
   - **セキュリティルールを公開**（下記§4のルール）
   - ウェブアプリを登録して **`apiKey` と `projectId`** をコピー
2. 課金は **Sparkプラン（カード登録なし）** のままにする（費用リスクをゼロに）

この2つの値だけ手元に用意できれば準備OKです（秘密情報ではありません）。

---

## 2. 新セッションに貼る「コピペ用の依頼文」

> 下の `___` を、あなたが取得した実際の値に置き換えてから貼ってください。

```
このリポジトリ（hidehidehide1984/Minami）の学習アプリで、Firebaseクラウド同期を
有効化する残作業をお願いします。作業ブランチは
claude/yokohamaminami-materials-review-4h3g00 です（main ではありません）。

コード（クラウド同期・みまもり画面）は実装済みで、設定値を入れるだけの状態です。
詳細は yokohama-minami-quiz-app/HANDOFF_NEXT_SESSION.md を読んでください。

Firebaseの公開設定値は次のとおりです（私が作成済み。ルールも公開済み）：
- apiKey: ___ここにAIzaSy...を貼る___
- projectId: ___ここにプロジェクトIDを貼る___

やってほしいこと：
1. yokohama-minami-quiz-app/js/firebase-config.js にこの2値を設定
2. 上記ブランチにコミット＆push（Pagesが自動デプロイ。失敗したら空コミットで再push）
3. デプロイ成功を確認
4. ネットに出られるなら、実際のFirestoreに対して同期の疎通テストと、
   公開URL（/Minami/ と /mimamori.html）の表示確認まで実施し、結果を報告
   ネットに出られないなら、2〜3まで実施して、実機での確認手順を教えてください
```

---

## 3. 新セッションのAIへ：作業手順（詳細）

### 3-1. 設定値を入れる
`yokohama-minami-quiz-app/js/firebase-config.js` を編集し、`apiKey` と `projectId` を設定：
```js
window.FIREBASE_CONFIG = {
  apiKey: "（利用者から渡された値）",
  projectId: "（利用者から渡された値）",
};
```

### 3-2. コミット＆push（自動デプロイ）
- 作業ブランチ：**`claude/yokohamaminami-materials-review-4h3g00`**
- push すると `.github/workflows/deploy-pages.yml` が走り、GitHub Pages に自動デプロイ。
- push はネットワークエラー時に指数バックオフで最大4回リトライする運用。
- **既知の注意**：Pagesデプロイがまれに `Deployment failed, try again later.`（GitHub側の一時的エラー）で落ちる。
  その場合は **空コミットを push して再トリガー**する（`git commit --allow-empty` → push）。
- **MCPの `rerun_*` / `run_workflow` は 403（integration権限なし）で使えない**。再実行は必ず push で行う。

### 3-3. デプロイ確認
- `mcp__github__actions_list`（method=list_workflow_runs, resource_id="deploy-pages.yml", per_page=1）で最新runの
  head_sha が自分のコミットと一致し、conclusion=success を確認。
- レスポンスが大きいのでサブエージェントで要約させると安全。

### 3-4. 実通信テスト（ネットに出られる場合のみ）
公開値だけで実施可能（資格情報は不要）。`PROJECT_ID` と `API_KEY` を実値に置換。

**(a) Firestore 書き込み→読み取りの疎通確認**（ルールが正しいかの確認）
```bash
BASE="https://firestore.googleapis.com/v1/projects/PROJECT_ID/databases/(default)/documents/progress"
CODE="minami-TEST-TEST-0001"   # 動作確認用の捨てコード
# 書き込み（create/update が許可されるか）
curl -s -X PATCH "$BASE/$CODE?key=API_KEY" -H "Content-Type: application/json" \
  -d '{"fields":{"data":{"stringValue":"{\"xp\":123,\"totalAnswered\":1,\"totalCorrect\":1}"},"updatedAt":{"integerValue":"1"}}}'
# 読み取り（get が許可されるか）
curl -s "$BASE/$CODE?key=API_KEY"
```
- 期待：どちらも 200 で、2回目に `stringValue` が返る → ルール・接続OK。
- 403/PERMISSION_DENIED → §4のルールが未公開/誤り。400 → プロジェクト設定の確認。
- ※ルールで `delete` は禁止のため、この捨てコードのドキュメントは残るが無害
  （ランダムでない `minami-TEST-...` なので実運用と衝突しない）。

**(b) 実ブラウザでのE2E（Chromium+Playwrightがこの環境にある）**
- 実サイト `https://hidehidehide1984.github.io/Minami/` を開く
- ⚙️せってい → ☁️クラウド同期 → 「新しくはじめる」→ 表示された同期コードを取得
- 問題を数問解く（数秒後にFirestoreへ自動push）
- 別コンテキストで `https://hidehidehide1984.github.io/Minami/mimamori.html?code=＜そのコード＞` を開く
- ダッシュボードにさっきの学習が反映されていれば **同期成立**。
- 参考：過去に `/tmp/mm_dash.mjs`（モックfetch版）でみまもり描画をテスト済み。
  実通信版はfetchスタブを外し、実URL＋実configで同じ検証をすればよい。

**(c) 公開URLの表示確認**
```bash
curl -s -o /dev/null -w "%{http_code}\n" -L https://hidehidehide1984.github.io/Minami/
curl -s -o /dev/null -w "%{http_code}\n" -L https://hidehidehide1984.github.io/Minami/mimamori.html
```
- 200 ならOK。403 で `x-deny-reason: host_not_allowed` が返る場合は、
  **実行環境のネットワークポリシーが外部ホストを遮断**している（サイトの問題ではない）。
  その旨を利用者に伝え、実機での確認を案内する。

### 3-5. 報告
- デプロイ結果、（実施できたら）疎通テスト結果、公開URLのHTTPステータスを報告。
- 疎通できない場合は原因（ルール未公開／環境のネット遮断など）を切り分けて伝える。

---

## 4. セキュリティルール（参照用・利用者が公開済みのはず）

Firestore →「ルール」タブに貼って「公開」：
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /progress/{code} {
      allow get: if true;
      allow create, update: if request.resource.data.keys().hasOnly(['data', 'updatedAt'])
        && request.resource.data.data is string
        && request.resource.data.data.size() < 300000;
      allow list, delete: if false;
    }
  }
}
```

---

## 5. 関連ファイル（実装済み・変更不要）

| ファイル | 役割 |
|---|---|
| `js/firebase-config.js` | ← **ここだけ値を入れる** |
| `js/cloudsync.js` | バックアップ＆Firestore同期（`window.CloudSync`）。REST直叩き・SDK不使用 |
| `js/mimamori.js` + `mimamori.html` | 保護者むけ閲覧専用ダッシュボード |
| `js/app.js` | 設定画面の同期UI・「みまもりURLをコピー」ボタン |
| `SETUP_FIREBASE.md` | 利用者向けセットアップ手順 |
| `SPEC.md` §7.5〜7.6 | 同期・みまもりの仕様 |

## 6. セキュリティ最終チェック（利用者向け）
- ✅ Sparkプラン維持（カード登録しない）＝費用リスクゼロ
- ✅ Googleアカウントに2段階認証
- ✅ プロジェクト名は中立（例 `minami-quiz`）／ニックネームに本名を使わない
- 🔧（任意）APIキーにHTTPリファラー制限（`hidehidehide1984.github.io`）を付けると更に堅い
- `apiKey`/`projectId` は公開してよい値。防御はFirestoreルールが担う
