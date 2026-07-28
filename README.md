# 法那提歐的愛爾琳手札

《瑪奇 Mobile》台版全方位攻略網站。以台版實機截圖、法那提歐實測與經核對的玩家情報為核心。

## 專案特色

- 桌面固定側邊欄、平板精簡側欄、手機抽屜選單
- hash route 章節切換，不使用單一無限長首頁
- 生活技能、料理、掛機、職業與職業技能獨立章節
- 台版實機資料優先
- 正式名稱與搜尋別名分離
- 明確顯示情報提供者 ID
- 亮色／深色凱爾特奇幻主題
- 純 HTML / CSS / 原生 JavaScript
- GitHub Pages 直接部署

## 主要路由

```text
#/home
#/search
#/life
#/cooking
#/afk
#/professions
#/profession/swordsman
#/profession/warrior
#/updates
#/contribute
```

## 本機預覽

不要直接雙擊 `index.html`，瀏覽器會阻擋 JSON 載入。

```powershell
Set-Location -LiteralPath 'D:\workbench\mabinogi-mobile-tw-guide'
py -m http.server 8000
```

開啟：

```text
http://localhost:8000
```

## 資料檔案

```text
data/
  site.json
  life-skill-categories.json
  life-skills.json
  cooking.json
  afk-tips.json
  names.json
  professions.json
  profession-skills.json
  changelog.json
```

`names.json` 只用於搜尋舊稱與資料正規化，不直接建立公開名稱對照頁。

## 啟用情報投稿

建立 Google 表單後，在 `data/site.json` 填入：

```json
"submissionFormUrl": "https://docs.google.com/forms/d/e/.../viewform"
```

## 網站

```text
https://locksley1701.github.io/mabinogi-mobile-tw-guide/
```

## 非官方聲明

本站為玩家自發建立的非官方攻略網站，與遊戲開發商及營運商無關。
