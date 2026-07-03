// 最小範例：node example.js
const createRateLimiter = require('./index');
const limiter = createRateLimiter({ windowMs: 1000 });

console.log('IP 1.1.1.1，limit=3：');
for (let i = 1; i <= 5; i++) {
  const r = limiter.check('capture:1.1.1.1', 3);
  console.log(`  req ${i}: allowed=${r.allowed} (${r.count}/${r.limit})`);
}
console.log('不同 IP 2.2.2.2 是獨立的：', limiter.check('capture:2.2.2.2', 3).allowed); // true
limiter.stop();
