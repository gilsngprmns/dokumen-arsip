// Helper validasi & sanitasi input untuk seluruh controller.
// Semua helper mengembalikan { error: string } ATAU { value: ... } agar controller
// bisa langsung merespons 400 dengan pesan yang jelas alih-alih menyerahkan
// nilai mentah ke PostgreSQL (yang akan menyebabkan error 500).

const MAX_LENGTH = {
  nomor_dokumen: 120,
  judul: 255,
  nama: 150,
  username: 80,
  email: 150,
  password: 72, // bcrypt hanya memproses 72 byte pertama
  nama_kategori: 150,
  nama_seksi: 120,
  kode_rak: 40,
  nama_rak: 120,
  lokasi: 180,
  deskripsi: 5000,
  judul_permintaan: 255,
  detail_permintaan: 2000,
  response_note: 2000,
  catatan_perubahan: 2000,
  search: 120,
  aktivitas: 60,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,80}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

const isEmpty = (value) =>
  value === undefined || value === null || (typeof value === "string" && value.trim() === "");

const badRequest = (res, message) => res.status(400).json({ success: false, message });

const validateString = (value, field, { max = 255, min = 1 } = {}) => {
  if (isEmpty(value)) return { error: `${field} wajib diisi` };
  if (typeof value !== "string") return { error: `${field} harus berupa teks` };
  const trimmed = value.trim();
  if (trimmed.length < min) return { error: `${field} wajib diisi` };
  if (trimmed.length > max) return { error: `${field} maksimal ${max} karakter` };
  return { value: trimmed };
};

const validateOptionalString = (value, field, { max = 255 } = {}) => {
  if (isEmpty(value)) return { value: null };
  if (typeof value !== "string") return { error: `${field} harus berupa teks` };
  const trimmed = value.trim();
  if (trimmed.length > max) return { error: `${field} maksimal ${max} karakter` };
  return { value: trimmed || null };
};

const validateIntegerId = (value, field) => {
  if (isEmpty(value)) return { error: `${field} wajib diisi` };
  const stringValue = String(value).trim();
  if (!/^\d{1,9}$/.test(stringValue)) return { error: `${field} tidak valid` };
  const numeric = Number(stringValue);
  if (!Number.isSafeInteger(numeric) || numeric < 1) return { error: `${field} tidak valid` };
  return { value: String(numeric) };
};

const validateOptionalIntegerId = (value, field) => {
  if (isEmpty(value)) return { value: null };
  return validateIntegerId(value, field);
};

const validateYear = (value, field) => {
  if (isEmpty(value)) return { error: `${field} wajib diisi` };
  const stringValue = String(value).trim();
  if (!/^\d{4}$/.test(stringValue)) return { error: `${field} harus berupa tahun 4 digit` };
  const numeric = Number(stringValue);
  if (numeric < YEAR_MIN || numeric > YEAR_MAX) {
    return { error: `${field} harus antara ${YEAR_MIN} dan ${YEAR_MAX}` };
  }
  return { value: numeric };
};

const validateOptionalYear = (value, field) => {
  if (isEmpty(value)) return { value: null };
  return validateYear(value, field);
};

const validateIsoDate = (value, field) => {
  if (isEmpty(value)) return { error: `${field} wajib diisi` };
  if (typeof value !== "string" || !DATE_PATTERN.test(value.trim())) {
    return { error: `${field} harus berformat YYYY-MM-DD` };
  }
  const parsed = new Date(`${value.trim()}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value.trim()) {
    return { error: `${field} bukan tanggal yang valid` };
  }
  return { value: value.trim() };
};

const validateOptionalIsoDate = (value, field) => {
  if (isEmpty(value)) return { value: null };
  return validateIsoDate(value, field);
};

const validateEnum = (value, field, allowedValues) => {
  if (isEmpty(value)) return { error: `${field} wajib diisi` };
  const stringValue = String(value).trim();
  if (!allowedValues.includes(stringValue)) {
    return { error: `${field} harus salah satu dari: ${allowedValues.join(", ")}` };
  }
  return { value: stringValue };
};

const validateEmail = (value, field, { allowNull = false } = {}) => {
  if (isEmpty(value)) {
    if (allowNull) return { value: null };
    return { error: `${field} wajib diisi` };
  }
  const trimmed = String(value).trim().toLowerCase();
  if (trimmed.length > MAX_LENGTH.email) {
    return { error: `${field} maksimal ${MAX_LENGTH.email} karakter` };
  }
  if (!EMAIL_PATTERN.test(trimmed)) return { error: `${field} tidak valid` };
  return { value: trimmed };
};

const validateUsername = (value, field) => {
  if (isEmpty(value)) return { error: `${field} wajib diisi` };
  const trimmed = String(value).trim();
  if (!USERNAME_PATTERN.test(trimmed)) {
    return {
      error: `${field} harus 3-80 karakter dan hanya boleh huruf, angka, titik, underscore, atau tanda hubung`,
    };
  }
  return { value: trimmed };
};

const validatePassword = (value, field) => {
  if (isEmpty(value)) return { error: `${field} wajib diisi` };
  if (typeof value !== "string") return { error: `${field} harus berupa teks` };
  if (value.length < 8) return { error: `${field} minimal 8 karakter` };
  if (value.length > MAX_LENGTH.password) {
    return { error: `${field} maksimal ${MAX_LENGTH.password} karakter` };
  }
  return { value };
};

module.exports = {
  MAX_LENGTH,
  EMAIL_PATTERN,
  USERNAME_PATTERN,
  badRequest,
  validateString,
  validateOptionalString,
  validateIntegerId,
  validateOptionalIntegerId,
  validateYear,
  validateOptionalYear,
  validateIsoDate,
  validateOptionalIsoDate,
  validateEnum,
  validateEmail,
  validateUsername,
  validatePassword,
};
