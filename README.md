# Coffee Origin Card — Firebase v5 Quick Import

這是 Firebase Firestore 版咖啡豆資料卡，加入 `/admin` 快速導入功能。

## 功能

- `/`：前台咖啡豆資料卡，讀取 Firestore `coffee_beans` 裡 `published = true` 的資料
- `/admin`：登入前只顯示登入畫面；登入後才顯示完整後台
- 後台可新增 / 編輯 / 刪除咖啡豆
- 後台可 CSV 檔案批量匯入
- 新增「快速導入」：
  - 貼網址解析
  - 貼頁面文字解析
  - 貼 CSV 文字解析
  - 解析後先預覽，再套用到表單或儲存到 Firestore
- 新增 Vercel API：`/api/parse-bean-url`
- Firebase config 不放在 GitHub，改由 `/api/firebase-config` 讀取 Vercel Environment Variables

## Vercel 設定

此版本是純靜態網站 + Vercel API，不是 Vite。

| Vercel 欄位 | 填法 |
|---|---|
| Framework Preset | Other |
| Root Directory | 看得到 `index.html` 的那一層 |
| Build Command | 留空 |
| Output Directory | `.` |
| Install Command | 留空 |

## Vercel Environment Variables

請到 Vercel → Project Settings → Environment Variables 新增：

```txt
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
FIREBASE_MEASUREMENT_ID=
```

`FIREBASE_MEASUREMENT_ID` 可以留空。其他 6 個必填。

## Firebase 必要設定

### Authentication

Firebase Console → Build → Authentication → Sign-in method

啟用：

```txt
Email/Password
```

然後到 Users 新增管理者帳號。

### Firestore Rules

Firestore Database → Rules：

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null
        && request.auth.token.email == "your-admin-email@example.com";
    }

    match /coffee_beans/{beanId} {
      allow read: if resource.data.published == true || isAdmin();
      allow create, update, delete: if isAdmin();
    }
  }
}
```

把 `your-admin-email@example.com` 改成你的管理者 Email 後按 Publish。

## 快速導入說明

登入 `/admin` 後會看到「快速導入資料」區塊。

### 1. 貼網址解析

貼上 Best of Panama / 烘豆商商品頁 URL，按「解析網址」。

注意：有些網站是 JavaScript 動態渲染，API 不一定能讀到完整內容。這時可改用「貼頁面文字解析」。

### 2. 貼頁面文字解析

把商品頁上看得到的公開文字複製到文字框，按「解析文字」。系統會嘗試抓：

- 咖啡豆名稱
- Lot 編號
- 國家 / 產區 / 子產區
- 莊園 / 生產者
- 品種 / 處理法 / 海拔
- 杯測分數
- 得標價格 / 得標者
- 風味標籤
- 地圖精準度

### 3. 貼 CSV 解析

第一列是欄位名稱，例如：

```csv
name,slug,country,region,process,cuppingScore,published
Panama Geisha Demo,panama-geisha-demo,Panama,Boquete,Washed,90,true
```

解析後會進入預覽。你可以套用第一筆到表單，也可以直接儲存第一筆或全部儲存。

## 建議資料原則

- 官方資料、品飲筆記、AI / 系統推導內容要分開標示
- 沒有精確莊園座標時，不要假裝成莊園級定位
- `mapAccuracy` 可填：`country`、`region`、`subregion`、`farm`
- 從快速導入產生的資料建議先確認，再把 `published` 設為 true

