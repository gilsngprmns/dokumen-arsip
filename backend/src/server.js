require("dotenv").config();

const app = require("./app");
const pool = require("./config/database");
const ensureRoles = require("./config/ensureRoles");
const ensureDocumentRequests = require("./config/ensureDocumentRequests");
const validateEnv = require("./config/validateEnv");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Pastikan konfigurasi environment lengkap & aman sebelum koneksi apa pun.
    validateEnv();

    const result = await pool.query("SELECT NOW()");
    await ensureRoles();
    await ensureDocumentRequests();

    console.log("Database PostgreSQL berhasil terhubung");
    console.log("Role admin dan staff siap digunakan");
    console.log("Database time:", result.rows[0].now);

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server berjalan di http://localhost:${PORT}`);
      console.log(`Server juga dapat diakses dari jaringan lokal di http://YOUR_LOCAL_IP:${PORT}`);
    });

    // Graceful shutdown: tutup server, berhenti menerima koneksi baru, lalu
    // tutup pool DB. Diperlukan agar container/orchestrator restart dengan rapi.
    const shutdown = (signal) => {
      console.log(`\nMenerima ${signal}, menutup server dengan aman...`);
      server.close(async () => {
        try {
          await pool.end();
          console.log("Koneksi database ditutup.");
          process.exit(0);
        } catch (err) {
          console.error("Gagal menutup koneksi database:", err.message);
          process.exit(1);
        }
      });

      // Paksa keluar bila koneksi menggantung melewati batas waktu.
      setTimeout(() => {
        console.error("Paksa keluar karena koneksi menggantung.");
        process.exit(1);
      }, 10000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("Gagal menjalankan server");
    console.error(error.message);
    process.exit(1);
  }
}

startServer();