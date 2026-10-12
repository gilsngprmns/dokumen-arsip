// Error handler terpusat. Express 5 secara otomatis meneruskan error dari
// handler async maupun middleware body-parser ke sini, sehingga semua error
// tak terduga direspons JSON yang aman (tanpa bocornya stack trace ke client).

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  // Error dengan status eksplisit (misalnya CORS origin ditolak).
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ success: false, message: error.message });
  }

  // Payload terlalu besar.
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "Ukuran data yang dikirim terlalu besar" });
  }

  // Body JSON tidak valid (body-parser melempar SyntaxError/entity.parse.failed).
  if (error?.type === "entity.parse.failed" || (error instanceof SyntaxError && "body" in error)) {
    return res.status(400).json({ success: false, message: "Format JSON tidak valid" });
  }

  if (process.env.NODE_ENV !== "test") {
    console.error(`[${req.method} ${req.originalUrl}]`, error);
  }

  return res.status(500).json({ success: false, message: "Terjadi kesalahan pada server" });
};

module.exports = errorHandler;
