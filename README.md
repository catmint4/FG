# 遠雄房地產｜官網成效 BI 儀表板

## 這是什麼

一個純前端（HTML/CSS/JS）的BI儀表板，不需要伺服器、資料庫。所有資料透過瀏覽器直接讀取 `data/` 資料夾裡的CSV檔案。部署在GitHub Pages上即可，每月只要把新的CSV丟進對應資料夾、commit、push，網站就會自動抓到新資料，**不需要修改任何程式碼**。

---

## 第一次部署步驟

1. 在GitHub建立一個新repo（例如叫 `farglory-seo-bi`），設為Public（GitHub Pages免費方案需要Public repo，除非有GitHub Pro/Team）
2. 把這個資料夾裡的**所有檔案與資料夾結構**上傳到repo（拖曳上傳或用git push都可以，保持資料夾結構不變）
3. 進repo的 **Settings → Pages**，Source選擇 `Deploy from a branch`，Branch選 `main`／`/ (root)`，儲存
4. 等1-2分鐘，GitHub會給一個網址，格式類似 `https://你的帳號.github.io/farglory-seo-bi/`，打開就是儀表板

---

## ⚠️ 強烈建議：先做這一步，避免圖表顯示不出來

儀表板用 [Chart.js](https://www.chartjs.org/) 畫圖表，程式裡已經設定好4層備援（本機檔案 → cdnjs → unpkg → jsdelivr），但如果您所在的網路環境會擋掉這些外部CDN網域（先前就遇過一次），圖表區塊會顯示「圖表庫尚未載入，僅顯示表格數字」——資料本身還是看得到，只是沒有圖。

**一次性解決辦法**（5分鐘）：
1. 瀏覽器打開：`https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js`
2. 全選頁面內容、複製
3. 在repo的 `js/lib/` 資料夾裡新增檔案，命名為 `chart.umd.min.js`，貼上內容、儲存
4. 這樣網站會優先使用這個本機檔案，完全不必依賴外部網路，保證圖表一定畫得出來

---

## 資料夾結構與檔案格式

```
index.html              ← 網站首頁，不用修改
css/style.css           ← 樣式，不用修改
js/                     ← 程式邏輯，不用修改
data/
  pageview/YYYY-MM.csv        ← GA4到達頁面報表（含CTA欄位）
  traffic-source/YYYY-MM.csv  ← Looker到達頁面（來源/媒介）
  gsc-query/YYYY-MM.csv       ← GSC查詢字報表
  gsc-page/YYYY-MM.csv        ← GA4 Search自然搜尋到達頁面報表
  ai-assistant/YYYY-MM.csv    ← GA4 AI Assistant頻道報表
  gsc-aio/YYYY-MM-pages.csv   ← GSC生成式AI報告（網頁分頁）
  gsc-aio/YYYY-MM-daily.csv   ← GSC生成式AI報告（每日曝光分頁）
  utm-buttons/YYYY-MM.csv     ← 站內按鈕/內文廣告UTM報表
  classification/latest.csv   ← 文章大分類/中分類對照表（只有新增文章時更新，不用每月更新）
  social/YYYY-MM.csv          ← 自媒體人工填表（目前尚未使用，先建立佔位）
```

**目前已放入的範例資料**：2026年8月（8個資料夾都有），`gsc-page/` 額外放了2025年7月-2026年6月的歷史資料，讓「內容健康監控」分頁一開始就有趨勢可以看。

## 每月怎麼加新資料

1. 從GA4/GSC匯出當月報表，**欄位格式跟現有檔案保持一致**（開頭列/欄位名稱不要改）
2. 檔名存成 `YYYY-MM.csv`（例如 `2026-09.csv`），丟進對應資料夾（`gsc-aio` 要存成兩個檔案：`YYYY-MM-pages.csv` 和 `YYYY-MM-daily.csv`）
3. GSC生成式AI報告、分類表如果是Excel(.xlsx)，請先用Excel另存新檔為CSV格式再放進去（程式只解析CSV，不支援xlsx）
4. commit並push到GitHub
5. 重新整理網站，新月份會自動出現在所有趨勢圖裡，程式會自動偵測 `data/` 資料夾裡有哪些月份，**不需要额外設定或改程式碼**

---

## 分頁對照表

| 分頁 | 用途 | 需要的資料夾 |
|---|---|---|
| ①總覽 | 全站健康快照 | traffic-source, gsc-query, gsc-aio |
| ②流量與來源 | 各流量管道佔比 | traffic-source |
| ③進站關鍵字 | GSC查詢字10大分類 | gsc-query |
| ④SEO文章與排名成效 | TOP文章排行、官方大分類佔比 | gsc-page, classification |
| ④b內容分類貢獻度 | 大分類/中分類逐月趨勢＋熱門文章 | gsc-page（多月）, classification |
| ⑤內容健康監控 | 文章健康警示（🔴🟠🟡🟢） | gsc-page（至少2個月） |
| ⑥AIO引用監測 | AI流量與曝光 | ai-assistant, gsc-aio |
| ⑦內容→建案路徑 | 站內按鈕導流去向 | utm-buttons（漏斗數據待補） |
| ⑧轉換與留單 | 各類別轉換率、404清理 | pageview |
| ⑨建案獨立分析 | 單一建案篩選 | pageview |
| ⑩自媒體 | 待人工填表 | social（尚未使用） |
| 📋資料說明 | 自動列出目前偵測到的月份 | 全部 |

---

## 已知限制／待補項目

- **⑦內容→建案路徑**：站內按鈕UTM資料只能看「導去哪個類型的頁面」，因UTM「廣告活動」欄位記錄的是目的地代碼、不是來源文章，無法還原「哪篇文章導出去的」。GA4漏斗探索（看過生活提案→看過建案頁）的正式數據待補上後可以加入這個分頁。
- **⑧轉換與留單**：「第一次接觸到成交歷程」需要銷售系統成交名單反查造訪紀錄，目前純網站資料無法回答。
- **⑩自媒體**：FB/IG/YT/TikTok目前尚無自動化資料來源，建議先用Google試算表人工填寫（觸及/互動/完播率/受眾池新增/導站外數/廣告花費/廣告轉換），存成CSV放進 `data/social/`。
