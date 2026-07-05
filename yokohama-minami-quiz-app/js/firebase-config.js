/*
 * Firebase設定（クラウド同期用）
 *
 * SETUP_FIREBASE.md の手順でFirebaseプロジェクトを作り、
 * 発行された2つの値をここに貼り付けてください。
 *
 * 空のままでもアプリは今まで通り動きます（クラウド同期だけオフ）。
 * この2つの値は「公開してよい」種類のものです（読み書きの制限は
 * Firestoreのセキュリティルール側で行います）。
 */
window.FIREBASE_CONFIG = {
  apiKey: "",     // 例 "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  projectId: "",  // 例 "minami-quiz-12345"
};
