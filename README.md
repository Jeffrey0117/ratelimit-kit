<p align="center">
  <img src="logo.svg" width="96" height="96" alt="ratelimit-kit logo">
</p>

# ratelimit-kit 🚦

**每 key（通常是 IP）滑動視窗限流。** 零依賴、in-memory。
擋「公開端點 / 公開 token 被拿去狂打灌爆機器」。

## 安裝

```bash
npm i github:Jeffrey0117/ratelimit-kit   # 或直接複製 index.js
```

## 用法

```js
const createRateLimiter = require('ratelimit-kit');
const limiter = createRateLimiter({ windowMs: 60000 }); // 60 秒視窗

// 在要保護的端點：
const ip = createRateLimiter.clientIp(req);              // cloudflared/反代後面也拿得到真實 IP
if (!limiter.check('capture:' + ip, 60).allowed) {       // 每 IP 每分鐘 60 次
  res.writeHead(429, { 'Retry-After': '60' });
  return res.end('Too many requests');
}
// 不同端點用不同 limit：key 加前綴分桶
if (!limiter.check('upload:' + ip, 600).allowed) { ...620... }
```

## API

`createRateLimiter({ windowMs? })` → `{ check, peek, stop, buckets, windowMs }`

| 方法 | 說明 |
|---|---|
| `check(key, limit)` | 記一次並判斷，回 `{ allowed, count, limit, retryAfterMs }`。超過 `limit` → `allowed:false`。 |
| `peek(key, limit)` | 只看不記。 |
| `stop()` | 停掉背景清理 timer（測試/關機用）。 |
| `createRateLimiter.clientIp(req)` | 取真實 client IP（`cf-connecting-ip` → `x-forwarded-for` → socket）。 |

## 設計重點

- **per-key**：通常用 IP。同一個 limiter 用 **key 前綴**分桶（`capture:` / `upload:`），各端點各自 limit。
- **滑動視窗**：比固定視窗更平順（不會在整點瞬間清零被鑽）。
- **自動清過期桶**（每視窗一次、`unref` 不卡 process），Map 不會無限長大。
- **公開 token 的正確防線是 per-IP**：token 是共享的，per-token 限流沒用；per-IP 才能擋單一濫用來源。

## License

MIT © Jeffrey0117
