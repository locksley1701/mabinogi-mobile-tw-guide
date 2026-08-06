# 官方圖標資產契約

本文件定義《法那提歐的愛爾琳手札》公開網站使用台版《瑪奇 Mobile》圖標時的來源、加工、命名、資料綁定、無障礙與驗收規則。

本契約適用於：

- 生活技能圖標
- 職業圖標
- 職業技能圖標
- 料理與物品圖標

## 1. 基本原則

1. 網站只使用已完成來源核對與人工驗收的網站輸出資產。
2. 官方核心圖形優先使用台版客戶端中可驗證的原始資源。
3. 台版實機截圖用於名稱、實裝狀態、外框、鎖定、強化與畫面呈現核對。
4. 不以 AI 重畫、補畫或生成近似官方圖形。
5. 公開 repository 不得包含原始遊戲封裝、完整遊戲截圖、私人工作日誌、投稿者帳號資料或全量解析中間檔。
6. 客戶端資源存在不等於台版現行實裝；資料狀態仍依網站既有契約標示。

## 2. 資產層級

### Master

- 原始核准尺寸：256×256 PNG，或來源本身提供的最高可驗證尺寸。
- 保留透明背景與原始色彩。
- 不燒入網站底盤、陰影、狀態徽章或文字。
- Master 不直接公開原始解析來源與中間檔。

### Web

第一階段可直接使用核准的 256×256 PNG，由瀏覽器依元件尺寸縮放。

試點通過後，若載入量需要最佳化，可另外產生 128×128 Web 版本，但必須：

- 使用相同穩定 ID。
- 不改變構圖與透明邊界。
- 保留 Master SHA256 與 Web SHA256 對照。

## 3. Repository 路徑

```text
assets/
  icons/
    life-skills/
    profession-series/
    professions/
    profession-skills/
    cooking/
```

不得將原始遊戲套件、解析報告或完整截圖放入上述路徑。

## 4. 命名規則

- 檔名使用網站穩定英文 ID。
- 全部小寫，單字以連字號分隔。
- 不以中文名稱作檔名。
- 不以顯示順序、目前等級或臨時 UI 狀態作檔名。
- 同一資料項目更正中文名稱時，不應迫使資產改名。

範例：

```text
assets/icons/life-skills/daily-gathering.png
assets/icons/profession-series/warrior.png
assets/icons/professions/swordsman.png
assets/icons/profession-skills/swordmaster-steel-wedge.png
assets/icons/cooking/fried-egg.png
```

## 5. 圖形與外框

- 官方核心圖形與網站裝飾底盤分離。
- 會隨技能等級、稀有度、鎖定、不可用或強化狀態改變的遊戲外環，不得燒入通用核心圖形。
- 網站底盤、邊框、選取、鎖定與狀態提示由 CSS 統一提供。
- 不得裁切官方核心構圖的重要部分。
- 不得為了填滿圓形或方形底盤而拉伸圖片。

## 6. 建議顯示尺寸

| 情境 | 顯示尺寸 |
| --- | --- |
| 側邊欄／小型列表 | 24～32px |
| 一般列表 | 40～48px |
| 職業卡片 | 56～72px |
| 詳情區 | 80～96px |

CSS 必須維持 `object-fit: contain`，並保留安全邊界。

## 7. 資料綁定

JSON 以穩定英文 ID 綁定圖標：

```json
{
  "id": "daily-gathering",
  "name": "日常採集",
  "icon": "assets/icons/life-skills/daily-gathering.png"
}
```

規則：

- `icon` 為相對於網站根目錄的公開資產路徑。
- 圖標缺少時，元件必須能安全退回既有文字／符號呈現。
- 不得因圖標載入失敗而隱藏名稱或阻擋導覽。
- 組合技能、子技能與不可用狀態需使用各自明確的穩定 ID，不得共用一張圖片後假裝完成配對。

## 8. HTML 與無障礙

### 資料圖標

當圖標協助辨認資料項目，但同一元件已顯示完整名稱時：

```html
<img src="..." alt="" aria-hidden="true">
```

避免螢幕閱讀器重複朗讀名稱。

### 圖示按鈕

純圖示按鈕必須有可理解的 `aria-label`，且不可只靠圖片內容傳達用途。

### 狀態

- 鎖定、待補、台版確認與選取狀態不可只靠圖標或顏色。
- 高對比主題下須保留文字、邊框或形狀提示。

## 9. 主題與響應式驗收

每枚試點圖標至少驗收：

- 跟隨系統、亮色、暗色外觀。
- 愛爾琳森林、月光石板、赤紅爐火、紫晶秘典與柔和高對比配色。
- 桌面、平板與 iPhone 寬度。
- 24px、32px、48px、72px 與 96px 顯示。
- 無裁切、無拉伸、無明顯模糊、無文字擠壓。

## 10. 來源與驗證紀錄

公開 repository 只保留必要的網站資產與簡化來源紀錄。每枚資產至少應能回溯：

- 網站穩定 ID
- 台版顯示名稱
- 客戶端邏輯路徑或來源分類
- Master SHA256
- 驗收狀態

原始解析索引與完整工作表保留於私人工作線，不提交公開 repository。

## 11. Issue #7 試點清單

### 生活技能

- `daily-gathering`：日常採集
- `logging`：伐木
- `mining`：採礦
- `herbalism`：採集藥草

### 職業

- `swordsman`：劍術士
- `warrior`：戰士
- `greatsword-warrior`：大劍戰士
- `archer`：弓手

### 職業技能

- `swordmaster-steel-wedge`：鋼楔
- `swordmaster-detection`：看破
- `expert-warrior-battle-cry`：戰場怒吼
- `expert-warrior-blade-smash`：劍刃重擊
- `greatsword-warrior-blockade-front`：跺腳
- `expert-archer-magnum-shot`：強力射擊

### 料理

- `fried-egg`：煎蛋
- `boiled-egg`：水煮蛋
- `roasted-potato`：烤整顆馬鈴薯
- `apple-juice`：蘋果汁

## 12. Issue #9 盜賊系完整圖標清單

### 職業

- `thief`：盜賊
- `fighter`：格鬥家
- `dual-blades`：雙刀客

### 職業技能

- `thief-back-stab`：奇襲
- `thief-hide`：隱身
- `thief-poison-trap`：毒陷阱
- `thief-screw-dagger`：螺旋匕首
- `thief-throwing-bomb`：投擲炸彈
- `fighter-back-step`：後退步
- `fighter-burst-punch-1`：爆裂拳第 1 擊
- `fighter-charging-fist`：蓄力拳
- `fighter-somersault-1`：空翻踢第 1 擊
- `fighter-impact-kick`：衝擊踢
- `dual-blades-double-crescent`：雙重新月
- `dual-blades-gliding-fury`：滑行狂怒
- `dual-blades-howling-gale`：怒號疾風
- `dual-blades-hurricane-dance`：旋轉突襲
- `dual-blades-outer-slash`：分裂斬

本批 18 枚圖標均使用既有本機核准的台版客戶端 PNG 輸出，不下載、不重新抽取，也不在公開 manifest 記錄私人素材路徑或內部別名。

## 13. Issue #10 與 Issue #52 長弓兵與弩手完整圖標清單

### 職業

- `longbowman`：長弓兵
- `crossbowman`：弩手

### 職業技能

- `longbowman-crash-shot`：震盪射擊
- `longbowman-flame-barrage`：烈焰箭
- `longbowman-heart-seeker`：尋心者
- `longbowman-shell-breaker`：破殼者
- `longbowman-wing-skewer`：翼之穿刺
- `crossbowman-buster-shot`：爆裂射擊
- `crossbowman-gusting-bolt`：狂風弩箭
- `crossbowman-shock-explosion`：震撼爆裂
- `crossbowman-sliding-step`：滑步
- `crossbowman-spreading-bolt`：擴散弩箭
- `longbowman-dragon-hunter`：獵龍人
- `longbowman-sniping`：狙擊術
- `longbowman-hunting`：狩獵術
- `longbowman-combat-mastery-heroism`：戰鬥熟練：霸氣
- `longbowman-keen-arrow`：敏銳之箭
- `longbowman-fighting-spirit`：鬥志高昂
- `crossbowman-hellfire`：地獄火
- `crossbowman-extra-action`：額外行動
- `crossbowman-driving-force`：驅動力
- `crossbowman-combat-mastery-threat`：戰鬥熟練：威脅
- `crossbowman-rapid-attack`：快速攻擊
- `crossbowman-expanded-magazine`：擴充彈匣

Issue #10 的 12 枚與 Issue #52 的 12 枚圖標均使用既有本機核准的台版客戶端 PNG 輸出，不下載、不重新抽取，也不在公開 manifest 記錄私人素材路徑或內部別名。

### 見習職業系列

- `series-warrior`：見習戰士系
- `series-archer`：見習弓手系
- `series-thief`：見習盜賊系

四枚系列圖標為側邊欄收合 summary 資產，不計入 documented professions。`series-mage` 以 `sharedWith: "mage"` 明確宣告與魔法師共用同一路徑及 SHA256；其餘系列圖標均為獨立資產。公開 manifest 僅保留穩定 ID、台版系列名稱、公開路徑、SHA256 與核准來源分類。

## 14. Issue #10 魔法師、火焰術士與冰霜術士圖標清單

### 職業

- `mage`：魔法師
- `flame-mage`：火焰術士
- `frost-mage`：冰霜術士

### 職業技能

- `mage-ice-dagger`：冰晶匕首
- `mage-lightning`：雷電
- `mage-mana-storm`：魔力風暴
- `mage-meteor-strike`：流星打擊
- `mage-telekinesis`：念動力
- `flame-mage-fire-storm`：火焰風暴
- `flame-mage-flame-cannon`：烈焰火炮
- `flame-mage-flash-over`：閃燃
- `flame-mage-ignite`：爆炸
- `flame-mage-rapid-fire`：疾火連彈
- `frost-mage-crystal-edge`：水晶之刃
- `frost-mage-freezing-field`：冰封領域
- `frost-mage-frozen-orb`：霜凍法球
- `frost-mage-ice-spike`：冰棘
- `frost-mage-split-slash`：冰川裂刃

本批 18 枚職業與技能圖標使用既有本機核准的台版客戶端 PNG 輸出，不下載、不重新抽取。公開資料、穩定檔名與 runtime 不記錄內部素材變體或拼法。

## 15. Issue #55 盜賊、雙刀客與格鬥家完整圖標清單

新增三職各一枚絕招與五枚被動技能圖標，共 18 筆 manifest records。`fighter-impact-kick` 為既有正確 PNG 的 Git 搬遷，取代 `fighter-stomp-kick`，不新增圖標位元組。

- 盜賊：`thief-blitz-rush`、`thief-adrenaline`、`thief-sneak-attack`、`thief-combat-mastery-swiftness`、`thief-poison-attack`、`thief-poison-explosion`
- 雙刀客：`dual-blades-final-hit`、`dual-blades-rising-aspirations`、`dual-blades-recharge`、`dual-blades-combat-mastery-destruction`、`dual-blades-vigor`、`dual-blades-wind-blade`
- 格鬥家：`fighter-power-max`、`fighter-combo-damage`、`fighter-finish-attack`、`fighter-combat-mastery-destruction`、`fighter-first-aid`、`fighter-shock-wave`

`fighter-combat-mastery-destruction` 明確以 `sharedWith: "dual-blades-combat-mastery-destruction"` 共用同一路徑與 SHA256；連同 `series-mage → mage`，公開 manifest 恰有兩組宣告共用。

## 16. 自動驗證最低要求

- JSON 內每個非空 `icon` 路徑都必須存在。
- 試點 PNG 必須可讀取且具有透明通道。
- 不允許提交原始封裝格式、完整截圖或私人資料夾內容。
- 不允許兩個不同穩定 ID 意外綁定同一檔案，除非資料契約明確宣告共用。
- 公開圖標 manifest 固定為生活技能 20、見習職業系列 4、職業 12、職業技能 76、料理 4，共 116 筆紀錄與 114 枚唯一 SHA256 資產；允許的共用為 `series-mage → mage` 與 `fighter-combat-mastery-destruction → dual-blades-combat-mastery-destruction`。
- Issue #9 與 Issue #10 職業及技能必須維持正式 ID、正式名稱與 `professionId` 一對一綁定。
- 公開圖標 manifest 不得包含內部別名、Windows 絕對路徑或私人素材庫識別字。
- changelog 必須記錄試點導入。

## 17. 完成定義

Issue #7 僅在下列條件全部成立時完成：

- 本契約已合併。
- 四種類別均有實際試點資產與頁面呈現。
- 多主題、手機與鍵盤／輔助科技驗收通過。
- 自動驗證通過。
- 未核准素材未進入公開 repository。
- changelog 已更新。
