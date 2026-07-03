// ============================================================================
// ratelimit-kit — 每 key（通常是 IP）滑動視窗限流
// ----------------------------------------------------------------------------
// 零依賴、in-memory。擋「公開端點/公開 token 被拿去狂打灌爆機器」。
// 不同端點可用不同 limit（同一個 limiter，key 加前綴即可分桶）。
//
// 用法：
//   const limiter = require('ratelimit-kit')({ windowMs: 60000 });
//   const ip = require('ratelimit-kit').clientIp(req);
//   if (!limiter.check('capture:' + ip, 60).allowed) return send429(res);
// ============================================================================

function createRateLimiter(opts = {}) {
  const windowMs = opts.windowMs || 60000; // 視窗長度，預設 60 秒
  const buckets = new Map();                // key -> [timestamps]

  // 記一次請求並判斷是否超限。回 { allowed, count, limit, retryAfterMs }。
  function check(key, limit) {
    const now = Date.now();
    const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    buckets.set(key, arr);
    return { allowed: arr.length <= limit, count: arr.length, limit, retryAfterMs: windowMs };
  }

  // 只看不記（peek）。
  function peek(key, limit) {
    const now = Date.now();
    const count = (buckets.get(key) || []).filter((t) => now - t < windowMs).length;
    return { allowed: count < limit, count, limit, retryAfterMs: windowMs };
  }

  // 定期清掉過期的桶，避免 Map 無限長大。
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, arr] of buckets) {
      if (!arr.some((t) => now - t < windowMs)) buckets.delete(k);
    }
  }, Math.max(windowMs, 60000));
  if (sweep.unref) sweep.unref(); // 別讓 timer 卡住 process 結束

  function stop() { clearInterval(sweep); }

  return { check, peek, stop, buckets, windowMs };
}

// 取真實 client IP（cloudflared / 反代後面）。
createRateLimiter.clientIp = function clientIp(req) {
  return (req.headers && (
    req.headers['cf-connecting-ip'] ||
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  )) || (req.socket && req.socket.remoteAddress) || 'unknown';
};

module.exports = createRateLimiter;
