---
name: ratelimit-kit
description: 公開端點、登入註冊、上傳、任何「拿共用 token 就能打」的 API 需要擋濫用時使用。使用者說「加限流」「防灌爆」「被刷」「429」時觸發。單機、零依賴、每個 key（通常是 IP）滑動視窗。
---

# ratelimit-kit — 打法

**每個 key 在一段時間內最多幾次，超過就擋。** 零依賴、資料放在記憶體裡。

## 何時觸發

- 不用登入就能打的端點：登入、註冊、忘記密碼、表單投稿、上傳、公開查詢
- 前端帶著一把大家共用的 token 在打的 API（token 是公開的，等於沒有身分）
- 看到專案自己用 `Map` 加 `setTimeout` 手寫計數 → 換成這個

**不適用**：多台機器或多個 process 要共用同一份額度（見地雷第一條）。

## 接線（照抄能跑）

```bash
npm i github:Jeffrey0117/ratelimit-kit
```

```js
const createRateLimiter = require('ratelimit-kit');
const limiter = createRateLimiter({ windowMs: 60_000 }); // 整個 process 建一個就好

function guard(req, res, bucket, limit) {
  const ip = createRateLimiter.clientIp(req);
  const r = limiter.check(`${bucket}:${ip}`, limit);
  if (r.allowed) return true;
  res.writeHead(429, { 'Retry-After': String(Math.ceil(r.retryAfterMs / 1000)) });
  res.end('Too many requests');
  return false;
}

// 每個端點自己的額度：key 加前綴分桶
if (!guard(req, res, 'login', 10)) return;
if (!guard(req, res, 'upload', 600)) return;
```

## 模式

- **一個 limiter、很多桶。** 不同端點用不同前綴（`login:`、`upload:`），不要每個端點各建一個 limiter。
- **共用 token 的 API 用 IP 當 key。** 用 token 當 key 等於所有人共用一份額度，一個人就能把大家擠掉。
- **登入後的 API 用使用者 id 當 key**，比 IP 準（同一個辦公室、同一個行動網路出口會共用 IP）。
- **額度抓「正常人的十倍」。** 太緊會擋到真的使用者，他們不會回報，只會離開。
- **`peek` 只看不記**，適合在畫面上顯示「還剩幾次」。注意它回答的是「下一次會不會過」。
- 測試結束或程式關閉前呼叫 `limiter.stop()`。

## 地雷

- **額度只存在這個 process 的記憶體裡。** 重啟就歸零；開 N 個 process（cluster、多台機器）就是 N 份額度，實際上限變成 N 倍。要跨 process 共用就得換成有外部儲存的做法，這個 kit 不處理。
- **被擋的請求也算一次。** `check` 是先記再判斷，所以一直狂打的人會一直被擋，要完全停手滿一個視窗才會解開。這通常是你要的，但別拿它當「每分鐘剛好放行 N 次」的節流器。
- **`retryAfterMs` 永遠等於整個視窗長度**，不是「再等幾秒就能過」的精確值。拿來填 `Retry-After` 可以，別拿來倒數計時。
- **`clientIp` 會相信 `cf-connecting-ip` 和 `x-forwarded-for`。** 只有在伺服器前面有會覆寫這些標頭的反向代理時才安全。如果伺服器能被直接連到，對方每次送不同的假標頭就能繞過限流；那種情況改用 `req.socket.remoteAddress`。
- **拿不到 IP 的請求全部共用 `unknown` 這個桶。** 看到大量 429 而且 key 是 `unknown`，先查代理有沒有把標頭帶進來。
- **每個請求存一筆時間戳。** 額度設很高（幾千以上）又有很多不同的 key 時，記憶體用量會跟著上去。
