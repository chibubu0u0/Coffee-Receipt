# Coffee Origin Card — GitHub Admin Version

這是一個免 Supabase / 免資料庫的咖啡豆資料卡網站。

- 前台：`/`
- 後台：`/admin`
- 資料庫：`data/beans.json`
- 部署：GitHub + Vercel

> 注意：這個 `/admin` 是「瀏覽器內編輯器」，不會直接寫回 GitHub。你需要匯出 `beans.json` 後，手動覆蓋 GitHub 裡的 `data/beans.json`。

---

## 1. 上傳到 GitHub

請確認 repository 第一層可以直接看到：

```txt
index.html
styles.css
app.js
admin/
data/
vercel.json
package.json
README.md
```

不要讓檔案變成：

```txt
coffee-origin-card-github-admin/index.html
coffee-origin-card-github-admin/styles.css
```

如果真的多包一層資料夾，Vercel 的 Root Directory 就要選到看得到 `index.html` 的那層。

---

## 2. Vercel 設定

這版是純靜態網站，不需要 build。

| Vercel 欄位 | 填法 |
|---|---|
| Framework Preset | Other |
| Root Directory | 看得到 `index.html` 的那層，通常不用改 |
| Build Command | 留空 |
| Output Directory | 留空，或填 `.` |
| Install Command | 留空 |
| Environment Variables | 不用填 |

---

## 3. 如何更新咖啡豆資料

1. 打開你的網站 `/admin`
2. 新增或編輯咖啡豆資料
3. 按「儲存到暫存資料」
4. 按「匯出 beans.json」
5. 到 GitHub repository 打開 `data/beans.json`
6. 上傳或貼上新的 JSON 內容
7. Commit changes
8. Vercel 會自動重新部署

---

## 4. 重要欄位說明

### 地圖精準度 `origin.mapAccuracy`

| 值 | 意思 |
|---|---|
| country | 只確認到國家 |
| region | 確認到產區 |
| subregion | 確認到子產區 |
| farm | 確認到莊園 / 合作社 |
| unknown | 未確認 |

建議不要硬填精確座標。若資料只到產區，就標產區層級即可。

### 風味分數 `flavor.scores`

目前使用 0–5 分：

- acidity 酸質
- sweetness 甜感
- bitterness 苦感
- body 醇厚度
- aroma 香氣強度
- aftertaste 餘韻長度
- fermentation 發酵感
- cleanCup 乾淨度

### 資料來源 `sources`

建議每筆資料都填來源，避免變成無中生有：

- `officialSourceName`
- `officialSourceUrl`
- `cuppingSource`
- `personalTasting`
- `aiDerivedContent`
- `lastUpdated`

---

## 5. 本機預覽

可以直接打開 `index.html`，但因為瀏覽器可能擋掉本機 JSON 讀取，建議用簡單 server：

```bash
python3 -m http.server 5173
```

然後開：

```txt
http://localhost:5173
http://localhost:5173/admin
```

---

## 6. 未來升級方向

如果之後想要真正「按儲存就更新網站」，可以升級成：

- Decap CMS：用 GitHub 登入後台，儲存後自動 commit
- Google Sheets：用試算表當資料庫
- Notion API：用 Notion database 當後台
- Cloudflare D1：低成本 SQL 資料庫

目前這版先以免費、穩定、好部署為主。
