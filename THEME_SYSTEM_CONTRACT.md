# 法那提歐的愛爾琳手札｜主題系統契約

版本：1.0  
適用範圍：全站版面、主題設定面板、localStorage、GitHub Actions 與後續無障礙施工。

## 1. 雙層狀態模型

主題由兩個彼此獨立的選項組成：

### 明暗外觀 `appearance`

- `system`：跟隨裝置 `prefers-color-scheme`
- `light`：固定亮色
- `dark`：固定暗色

### 配色主題 `palette`

- `forest`：愛爾琳森林
- `moonlight`：月光石板
- `hearth`：赤紅爐火
- `amethyst`：紫晶秘典
- `contrast`：高對比

所有組合共用相同 HTML、route 與資料，不建立重複頁面。

## 2. HTML 屬性

`<html>` 同時保存三個屬性：

```html
<html data-appearance="system" data-theme="dark" data-palette="moonlight">
```

| 屬性 | 語意 |
|---|---|
| `data-appearance` | 使用者選擇的外觀模式 |
| `data-theme` | 當下解析後實際套用的 `light` 或 `dark` |
| `data-palette` | 使用者選擇的配色主題 |

`data-theme` 保留給既有亮暗 CSS 與人物素質色使用；當 `data-appearance="system"` 時，系統外觀變更會即時更新 `data-theme`。

## 3. 儲存鍵與舊版遷移

| localStorage 鍵 | 內容 |
|---|---|
| `fanatio-appearance` | `system`／`light`／`dark` |
| `fanatio-palette` | 五種 palette ID |
| `fanatio-theme` | 相容舊版的已解析 `light`／`dark` |

遷移規則：

1. 已有 `fanatio-appearance` 時優先使用。
2. 沒有新鍵但有舊 `fanatio-theme` 時，將舊值視為固定亮色或暗色。
3. 完全沒有偏好時，預設 `system`＋`forest`。
4. `theme-boot.js` 必須在 CSS 前執行，避免重新整理時出現錯誤主題閃爍。

## 4. 語意色變數

配色主題只覆寫既有語意變數，不修改資料或版面結構：

- `--page`
- `--surface`
- `--surface-solid`
- `--surface-muted`
- `--ink-900`
- `--ink-700`
- `--ink-500`
- `--line`
- `--sidebar`
- `--sidebar-text`
- `--sidebar-muted`
- `--forest-*`
- `--gold-*`
- `--parchment-*`
- 主題裝飾與側邊欄狀態變數

禁止為每套配色複製元件 CSS 或 HTML。

## 5. 五大人物素質色

下列遊戲語意色不因配色主題改變：

- 力量：紅橘
- 技巧：金黃
- 智力：青藍
- 意志：紫色
- 幸運：綠色

亮暗模式可調整明度，但不得改變屬性對應。即使顏色保留，畫面仍必須同時顯示屬性文字；更完整的非色彩辨識由 Issue #5 驗收。

## 6. 設定面板行為

- 頂部與側邊欄的主題按鈕都開啟同一個設定面板。
- 面板使用 `role="dialog"` 與 `aria-modal="true"`。
- 每個選項使用文字標題、說明、視覺預覽與 `aria-pressed`。
- 選擇立即套用並保存，不需要另外提交。
- `Escape`、關閉按鈕、背景遮罩與「完成」按鈕均可關閉。
- 關閉後焦點回到原本觸發按鈕。
- 手機使用底部面板，桌面和平板使用置中面板。

## 7. 高對比配色邊界

本 Issue 的高對比配色提供：

- 黑白為主的頁面與側邊欄
- 強邊框
- 減少陰影與背景紋理
- 明確的選取狀態

完整鍵盤焦點、ARIA、對比量測與非色彩狀態仍由 Issue #5 完成；Issue #4 不宣稱已完成全部無障礙驗收。

## 8. 驗收門檻

- 3 種 appearance 與 5 種 palette 均可操作。
- 15 種組合不產生水平捲動。
- 偏好重新整理後仍保存。
- `system` 會回應系統亮暗變更。
- 所有主要 route 在五套配色下可載入。
- 側邊欄、卡片、搜尋、料理與職業技能保持可讀。
- 人物五大素質色仍維持遊戲對應。
- GitHub Actions 與 Playwright 回歸全綠。
- changelog 已更新。
