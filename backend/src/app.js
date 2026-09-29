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

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error("Origin tidak diizinkan"));
  },
  credentials: true,
}));
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "no-referrer");
  next();
});
app.use(express.json());

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

module.exports = app;