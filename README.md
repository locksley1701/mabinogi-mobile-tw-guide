# 法那提歐的愛爾琳手札

《瑪奇 Mobile》台版全方位攻略網站。第一階段以生活技能、料理 CP 候選、掛機技巧、台版名稱對照與玩家投稿流程為主。

## 專案特色

- 手機優先、純靜態網站
- HTML / CSS / 原生 JavaScript
- GitHub Pages 可直接部署
- 台版實機資料優先
- 所有未確認內容均保留資料狀態
- 首次造訪功能導覽
- 亮色／深色凱爾特奇幻主題
- 預留 Google 表單投稿入口

## 本機預覽

不要直接雙擊 `index.html`，瀏覽器會阻擋 JSON 載入。請在專案資料夾啟動本機伺服器：

```powershell
Set-Location -LiteralPath 'D:\workbench\mabinogi-mobile-tw-guide'
py -m http.server 8000
```

接著開啟：

```text
http://localhost:8000
```

## 啟用情報投稿

建立 Google 表單後，將表單公開網址填入：

```text
data/site.json
```

欄位：

```json
"submissionFormUrl": "https://docs.google.com/forms/d/e/.../viewform"
```

## GitHub Pages

Repository 建議名稱：`mabinogi-mobile-tw-guide`

推送後前往：

```text
Settings → Pages → Build and deployment → Deploy from a branch
```

選擇：

```text
Branch: main
Folder: /(root)
```

預期網址：

```text
https://locksley1701.github.io/mabinogi-mobile-tw-guide/
```

## 資料來源

- Google 試算表：《瑪奇Mobile｜生活技能快速升級查詢表》
- 使用者台版實機確認與截圖
- 韓國版資料僅作候選參考

## 非官方聲明

本站為玩家自發建立的非官方攻略網站，與遊戲開發商及營運商無關。
