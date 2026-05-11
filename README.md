# Coffee Origin Card — Firebase + AI Quick Import

這是一個可以部署到 Vercel 的咖啡豆資料卡網站。

- `/`：前台咖啡豆資料卡，直接讀 Firebase Firestore
- `/admin/`：後台登入、新增、編輯、刪除咖啡豆
- Firebase Auth：後台登入
- Firestore：儲存 `coffee_beans`
- Quick Import：規則解析、CSV 匯入、AI 解析

## Vercel 設定

Framework Preset 選 `Other`。

| 欄位 | 值 |
|---|---|
| Build Command | 留空 |
| Output Directory | `.` |
| Install Command | 留空 |

## Firebase 環境變數

到 Vercel → Project → Settings → Environment Variables 新增：

```txt
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
FIREBASE_MEASUREMENT_ID
```

## AI 解析環境變數

若要使用 `/admin/` 裡的 AI 解析功能，另外新增：

```txt
OPENAI_API_KEY
```

可選：

```txt
OPENAI_MODEL=gpt-4.1-mini
AI_PARSE_MAX_CHARS=12000
```

`OPENAI_API_KEY` 只放在 Vercel Environment Variables，不要放進 GitHub。
AI 解析由 `/api/ai-parse-bean` 這個 Vercel serverless function 呼叫 OpenAI API，前端不會直接看到你的 API key。

## Firestore Rules 範例

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null
        && request.auth.token.email == "你的管理員Email@example.com";
    }

    match /coffee_beans/{beanId} {
      allow read: if resource.data.published == true || isAdmin();
      allow create, update, delete: if isAdmin();
    }
  }
}
```

## 使用流程

1. 登入 `/admin/`
2. 貼上商品頁文字或網址
3. 可選「規則解析」或「AI 解析」
4. 先看預覽
5. 套用到表單後人工確認
6. 勾選 Published 才會公開顯示在前台

AI 解析會盡量只根據你提供的來源文字整理資料；缺少的欄位會留空，不會自動公開。
