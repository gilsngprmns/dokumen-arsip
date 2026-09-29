const buckets = new Map();

const rateLimit = ({ windowMs, max, message }) => (req, res, next) => {
  const key = `${req.ip}:${req.path}`;
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now - entry.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
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
