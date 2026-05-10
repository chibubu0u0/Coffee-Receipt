# Coffee Origin Card — Firebase Version

這是 Firebase Firestore 版咖啡豆資料卡。

- `/`：前台，讀取 Firestore `coffee_beans` 裡 `published = true` 的資料
- `/admin`：後台，使用 Firebase Authentication 登入後新增 / 編輯 / 刪除咖啡豆
- 不需要 Supabase
- 不需要每次更新資料都 redeploy

## 1. Firebase 必要設定

### Authentication

到 Firebase Console：

`Build → Authentication → Sign-in method`

啟用：

`Email/Password`

然後到：

`Users → Add user`

新增管理者帳號：

`your-admin-email@example.com`

### Firestore Rules

到：

`Firestore Database → Rules`

貼上：

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

按 Publish。

## 2. Vercel 部署設定

這版是純靜態網站，不是 Vite。

| Vercel 欄位 | 填法 |
|---|---|
| Framework Preset | Other |
| Root Directory | 看得到 `index.html` 的那一層 |
| Build Command | 留空 |
| Output Directory | `.` |
| Install Command | 留空 |
| Environment Variables | 不用填 |

## 3. Firebase Config

Firebase 設定放在：

`firebase-config.js`

這些 Web App config 不是 service role key。真正的安全性由 Firestore Rules 控制。

不要把 Firebase Auth 密碼、Google 帳號密碼、service account、private key 放進專案。

## 4. CSV 匯入

登入 `/admin` 後，可下載 CSV 範本。

重要欄位：

```csv
name,slug,country,region,farm,producer,variety,process,altitude,roastLevel,officialFlavor,flavorNotes,cuppingScore,latitude,longitude,mapAccuracy,published,sourceOfficial
```

`flavorNotes` 可用 `|` 分隔，例如：

```txt
jasmine|bergamot|honey
```

## 5. 建議資料原則

- 官方資料、品飲筆記、AI 推導內容要分開標示
- 沒有精確莊園座標時，不要假裝成莊園級定位
- 地圖精準度可填：`country`、`region`、`subregion`、`farm`

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

`FIREBASE_MEASUREMENT_ID` 可留空。
