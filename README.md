# Coffee Origin Card

一個可以放到 GitHub，並用 Vercel 部署的咖啡豆資料卡靜態網站。

核心功能：

- 咖啡豆資料卡
- 產地地圖標註
- 地圖精準度說明
- 風味分數視覺化
- 沖煮建議
- QR Code 分享
- 資料來源透明標示
- 可用 `data/beans.json` 管理多支豆子

---

## 1. 如何修改咖啡豆資料

打開：

```txt
data/beans.json
```

每一筆資料代表一張咖啡豆資料卡。

最重要的欄位：

```json
{
  "slug": "demo-yirgacheffe-washed",
  "name": "Demo Bean｜Yirgacheffe Washed",
  "roaster": "請替換成你的烘豆品牌",
  "process": "Washed / 水洗",
  "variety": "Heirloom / Landrace",
  "origin": {
    "country": "Ethiopia",
    "region": "Yirgacheffe",
    "subRegion": "Gedeb",
    "farm": "Worka Cooperative",
    "producer": "Producer name",
    "altitude": "1,900–2,100 m"
  },
  "map": {
    "label": "Yirgacheffe, Ethiopia",
    "lat": 6.1629,
    "lng": 38.2059,
    "accuracy": "region"
  }
}
```

---

## 2. 地圖精準度怎麼填

`accuracy` 可以使用：

| 值 | 意思 |
|---|---|
| `country` | 國家層級 |
| `region` | 產區層級 |
| `subregion` | 子產區層級 |
| `farm` | 莊園 / 合作社 / 處理廠層級 |
| `unknown` | 未確認 |

如果只有產區，不要硬填莊園座標。可以填產區附近位置，並把 `accuracy` 設為 `region`。

---

## 3. 如何加入更多咖啡豆

在 `beans.json` 陣列中複製一整筆物件，改掉：

- `slug`
- `name`
- `origin`
- `map`
- `flavor`
- `brew`
- `sources`

`slug` 建議用英文小寫與 dash，例如：

```txt
colombia-huila-washed-2026
```

網址會變成：

```txt
/?bean=colombia-huila-washed-2026
```

QR Code 也會使用這個網址。

---

## 4. 部署到 GitHub + Vercel

### 方法 A：直接上傳 GitHub

1. 解壓縮這個 zip
2. 建立一個 GitHub Repository
3. 把所有檔案上傳到 Repository 根目錄
4. 到 Vercel 新增專案
5. 選擇這個 GitHub Repository
6. Deploy

這是純靜態網站，不需要額外 build 指令。

---

## 5. 本機預覽

因為網站會讀取 `data/beans.json`，建議用本機伺服器預覽。

如果你有 Python：

```bash
python3 -m http.server 3000
```

然後打開：

```txt
http://localhost:3000
```

---

## 6. 注意資料可信度

建議把資料分成三種：

1. 官方資料：豆袋、烘豆商、官網、生豆商
2. 品飲資料：你自己喝到的筆記或杯測紀錄
3. 系統推導：人格分類、情境推薦、風味類型

不要把系統推導寫成官方資料。
