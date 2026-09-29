require("dotenv").config();

const app = require("./app");
const pool = require("./config/database");
const ensureRoles = require("./config/ensureRoles");
const ensureDocumentRequests = require("./config/ensureDocumentRequests");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    const result = await pool.query("SELECT NOW()");
    await ensureRoles();
    await ensureDocumentRequests();

    console.log("Database PostgreSQL berhasil terhubung");
    console.log("Role admin dan staff siap digunakan");
    console.log("Database time:", result.rows[0].now);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server berjalan di http://localhost:${PORT}`);
      console.log(`Server juga dapat diakses dari jaringan lokal di http://YOUR_LOCAL_IP:${PORT}`);
    });
  } catch (error) {
    console.error("Gagal terhubung ke PostgreSQL");
    console.error(error.message);
    process.exit(1);
  }
}

startServer();