require("dotenv").config();

const fs = require("fs");
const path = require("path");
const pool = require("../src/config/database");

async function runMigrations() {
  const migrationsDirectory = path.resolve(__dirname, "../database/migrations");
  const migrationFiles = fs.readdirSync(migrationsDirectory)
    .filter((file) => /^\d+_.*\.sql$/.test(file))
    .sort();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const filename of migrationFiles) {
    const applied = await pool.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [filename]);
    if (applied.rowCount > 0) continue;

    const sql = fs.readFileSync(path.join(migrationsDirectory, filename), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
      await client.query("COMMIT");
      console.log(`Migration applied: ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

runMigrations()
  .then(() => pool.end())
  .catch((error) => {
    console.error("Migration failed:", error.message);
    pool.end(() => process.exit(1));
  });
