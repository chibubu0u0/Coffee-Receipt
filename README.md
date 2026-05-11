# Coffee Receipt Studio — Firebase v11 Pure Data Receipt

這版是「純資料收據模式」：

- 前台仍保留 receipt 視覺，但不再照 Song Receipt 的情緒分組。
- 只顯示 Firestore / 後台欄位裡實際存在的資料。
- 不自動產生風味百分比、色彩語言、人格、情緒、故事或主觀分析。
- AI 功能只作為「來源欄位抽取」，不做咖啡數據判斷。
- 若來源沒有提供欄位，前台就不顯示該區塊。

## Vercel 設定

Framework Preset：Other  
Build Command：留空  
Output Directory：`.`  
Install Command：留空

## 必填環境變數

請在 Vercel → Project → Settings → Environment Variables 設定：

```txt
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
FIREBASE_MEASUREMENT_ID
```

## 可選：OpenAI 欄位抽取

如果要使用 `/admin/` 的 AI 抽取功能，另外設定：

```txt
OPENAI_API_KEY
OPENAI_MODEL=gpt-4.1-mini
AI_PARSE_MAX_CHARS=12000
```

OpenAI key 只放在 Vercel Environment Variables，不要放 GitHub。

## Firestore Collection

預設 collection：

```txt
coffee_beans
```

前台只讀取：

```txt
published == true
```

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

## 使用方式

1. 打開 `/admin/`
2. 登入 Firebase Authentication 管理員帳號
3. 貼上來源文字或 CSV
4. 使用「AI 抽取」或「規則抽取」產生草稿
5. 人工確認欄位
6. 勾選 Published
7. 儲存到 Firestore
8. 前台重新整理後顯示資料

## v11 重要差異

- 前台 receipt 版面改成「依資料欄位動態顯示」。
- 移除色彩語言、情緒標籤、人格描述、百分比長條圖。
- 「官方風味描述」只呈現來源或後台填寫的 tasting notes。
- 「杯測 / 感官數據」只顯示明確填入的數值，不轉換成百分比。
- AI schema 不包含酸質、甜感、香氣、醇厚度等主觀評分欄位。
- URL fallback 不再塞入估算地圖座標。


## v11 更新

- 前台收據移除「來源總分」提示；杯測總分只保留在收據右上角與實際拍賣欄位，不再放進感官數據表。
- 新增「下載圖片」按鈕，可將目前資料收據輸出成 PNG。
- 官方風味描述以實際 tasting notes 產生簡約圖示 chip；只做視覺呈現，不產生百分比或主觀分數。
