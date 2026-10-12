const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const dokumenRoutes = require("./routes/dokumenRoutes");
const userRoutes = require("./routes/userRoutes");
const seksiRoutes = require("./routes/seksiRoutes");
const kategoriRoutes = require("./routes/kategoriRoutes");
const logAktivitasRoutes = require("./routes/logAktivitasRoutes");
const rakRoutes = require("./routes/rakRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const documentRequestRoutes = require("./routes/documentRequestRoutes");
const errorHandler = require("./middleware/errorHandler");

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOriginPatterns = (process.env.CORS_ORIGIN_PATTERNS || "")
  .split(",")
  .map((pattern) => pattern.trim())
  .filter(Boolean)
  .map((pattern) => new RegExp(pattern));
if (!process.env.CORS_ORIGIN_PATTERNS) {
  allowedOriginPatterns.push(/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/);
}

const isAllowedOrigin = (origin) =>
  !origin || allowedOrigins.includes(origin) || allowedOriginPatterns.some((pattern) => pattern.test(origin));

const app = express();

// Percayai header proxy (Cloudflare Tunnel, nginx, dsb) agar req.ip dan
// pembatasan rate limit berdasarkan IP bekerja dengan benar.
app.set("trust proxy", 1);

// Middleware
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      // Beri status eksplisit agar error handler merespons 403 (bukan 500).
      const error = new Error("Origin tidak diizinkan");
      error.status = 403;
      return callback(error);
    },
    credentials: true,
  })
);
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "no-referrer");
  res.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  if (req.secure) res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});
// Batasi ukuran body JSON untuk mencegah payload besar yang dibebankan ke memory.
app.use(express.json({ limit: "1mb" }));

// Root
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "API Sistem Pengarsipan Dokumen berjalan",
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/dokumen", dokumenRoutes);
app.use("/api/users", userRoutes);
app.use("/api/seksi", seksiRoutes);
app.use("/api/kategori", kategoriRoutes);
app.use("/api/log-aktivitas", logAktivitasRoutes);
app.use("/api/rak", rakRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/document-requests", documentRequestRoutes);

// Route tidak ditemukan
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint tidak ditemukan",
  });
});

// Error handler terpusat (harus didaftarkan paling akhir).
app.use(errorHandler);

module.exports = app;