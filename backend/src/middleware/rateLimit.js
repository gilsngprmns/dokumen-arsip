// Rate limiter sederhana berbasis sliding window yang disimpan di memory.
// Catatan: cocok untuk single-instance. Jika aplikasi dijalankan pada banyak
// instance/replica, gunakan store bersama (misalnya Redis) agar limit konsisten.

const buckets = new Map();
const MAX_BUCKETS = 10000;
let lastSweep = Date.now();

// Hapus bucket yang sudah kedaluwarsa secara berkala agar Map tidak tumbuh
// tanpa batas (sebelumnya memori bocor setiap IP/path yang dilewati).
const sweepExpired = (now, windowMs) => {
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, entry] of buckets) {
    if (now - entry.startedAt >= windowMs) buckets.delete(key);
  }
  // Jaring pengaman tambahan bila jumlah bucket tetap membengkak.
  if (buckets.size > MAX_BUCKETS) {
    for (const [key, entry] of buckets) {
      if (now - entry.startedAt >= windowMs) buckets.delete(key);
      if (buckets.size <= MAX_BUCKETS) break;
    }
  }
};

const rateLimit = ({ windowMs, max, message }) => (req, res, next) => {
  const now = Date.now();
  const key = `${req.ip}:${req.path}`;
  const entry = buckets.get(key);

  if (!entry || now - entry.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
    sweepExpired(now, windowMs);
    return next();
  }

  entry.count += 1;
  if (entry.count > max) {
    const retryAfter = Math.ceil((windowMs - (now - entry.startedAt)) / 1000);
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({ success: false, message });
  }

  return next();
};

module.exports = rateLimit;

