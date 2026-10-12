// Validasi environment variable saat startup.
// Mencegah aplikasi berjalan dengan konfigurasi setengah jadi atau secret
// lemah yang baru akan ketahuan saat terjadi error di production.

const REQUIRED_KEYS = ["DB_HOST", "DB_PORT", "DB_USER", "DB_NAME", "JWT_SECRET"];
const PLACEHOLDER_SECRETS = new Set([
  "ganti-dengan-secret-acak-yang-panjang",
  "changeme",
  "secret",
]);

const validateEnv = () => {
  const isProduction = process.env.NODE_ENV === "production";

  const missing = REQUIRED_KEYS.filter((key) => !process.env[key] || !String(process.env[key]).trim());
  if (missing.length > 0) {
    throw new Error(`Environment wajib belum diatur: ${missing.join(", ")}`);
  }

  const dbPort = Number(process.env.DB_PORT);
  if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) {
    throw new Error("DB_PORT harus berupa angka port yang valid (1-65535)");
  }

  const jwtSecret = String(process.env.JWT_SECRET);
  const minSecretLength = isProduction ? 32 : 16;
  if (jwtSecret.length < minSecretLength) {
    throw new Error(
      `JWT_SECRET terlalu pendek: minimal ${minSecretLength} karakter${isProduction ? " di production" : ""}`
    );
  }
  if (isProduction && PLACEHOLDER_SECRETS.has(jwtSecret)) {
    throw new Error("JWT_SECRET masih menggunakan nilai contoh; ganti dengan secret acak yang panjang");
  }

  return true;
};

module.exports = validateEnv;
