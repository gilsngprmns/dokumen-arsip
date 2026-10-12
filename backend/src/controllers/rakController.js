const pool = require("../config/database");
const validators = require("../utils/validators");

const validateSeksiAccess = (req, seksiId) => {
  if (req.user.role === "admin") return true;
  return String(req.user.seksi_id) === String(seksiId);
};

const getAllRak = async (req, res) => {
  try {
    const { seksi_id } = req.query;
    const values = [];
    const conditions = [];

    let query = `
      SELECT r.id, r.kode_rak, r.nama_rak, r.lokasi, r.seksi_id,
        s.nama_seksi, COUNT(d.id)::int AS jumlah_dokumen
      FROM rak r
      LEFT JOIN seksi s ON s.id = r.seksi_id
      LEFT JOIN dokumen d ON d.rak_id = r.id
    `;

    if (req.user.role !== "admin") {
      values.push(req.user.seksi_id);
      conditions.push(`r.seksi_id = $${values.length}`);
    } else if (seksi_id) {
      const seksiCheck = validators.validateIntegerId(seksi_id, "Seksi");
      if (seksiCheck.error) return validators.badRequest(res, seksiCheck.error);
      values.push(seksiCheck.value);
      conditions.push(`r.seksi_id = $${values.length}`);
    }

    if (conditions.length) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` GROUP BY r.id, s.nama_seksi ORDER BY r.kode_rak ASC`;

    const result = await pool.query(query, values);
    return res.status(200).json({ success: true, message: "Data rak berhasil diambil", data: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Gagal mengambil data rak" });
  }
};

const createRak = async (req, res) => {
  try {
    const { kode_rak, nama_rak, lokasi, seksi_id } = req.body;

    const kodeCheck = validators.validateString(kode_rak, "Kode rak", { max: validators.MAX_LENGTH.kode_rak });
    if (kodeCheck.error) return validators.badRequest(res, kodeCheck.error);

    const namaCheck = validators.validateString(nama_rak, "Nama rak", { max: validators.MAX_LENGTH.nama_rak });
    if (namaCheck.error) return validators.badRequest(res, namaCheck.error);

    const lokasiCheck = validators.validateOptionalString(lokasi, "Lokasi", { max: validators.MAX_LENGTH.lokasi });
    if (lokasiCheck.error) return validators.badRequest(res, lokasiCheck.error);

    let finalSeksiId = req.user.role === "admin" ? (seksi_id || null) : req.user.seksi_id;
    if (finalSeksiId) {
      const seksiCheck = validators.validateIntegerId(finalSeksiId, "Seksi");
      if (seksiCheck.error) return validators.badRequest(res, seksiCheck.error);
      finalSeksiId = seksiCheck.value;
    }

    if (finalSeksiId && !validateSeksiAccess(req, finalSeksiId)) {
      return res.status(403).json({ success: false, message: "Anda tidak memiliki akses ke seksi ini" });
    }

    const result = await pool.query(
      `INSERT INTO rak (kode_rak, nama_rak, lokasi, seksi_id)
       VALUES ($1, $2, $3, $4) RETURNING id, kode_rak, nama_rak, lokasi, seksi_id`,
      [kodeCheck.value, namaCheck.value, lokasiCheck.value, finalSeksiId]
    );

    return res.status(201).json({ success: true, message: "Rak berhasil ditambahkan", data: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "Kode rak sudah digunakan" });
    }
    if (error.code === "23503") {
      return res.status(400).json({ success: false, message: "Seksi tidak valid" });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Gagal menambahkan rak" });
  }
};

const updateRak = async (req, res) => {
  try {
    const { kode_rak, nama_rak, lokasi, seksi_id } = req.body;

    const kodeCheck = validators.validateString(kode_rak, "Kode rak", { max: validators.MAX_LENGTH.kode_rak });
    if (kodeCheck.error) return validators.badRequest(res, kodeCheck.error);

    const namaCheck = validators.validateString(nama_rak, "Nama rak", { max: validators.MAX_LENGTH.nama_rak });
    if (namaCheck.error) return validators.badRequest(res, namaCheck.error);

    const lokasiCheck = validators.validateOptionalString(lokasi, "Lokasi", { max: validators.MAX_LENGTH.lokasi });
    if (lokasiCheck.error) return validators.badRequest(res, lokasiCheck.error);

    const existingResult = await pool.query("SELECT id, seksi_id FROM rak WHERE id = $1", [req.params.id]);
    if (!existingResult.rows.length) {
      return res.status(404).json({ success: false, message: "Rak tidak ditemukan" });
    }

    if (req.user.role !== "admin" && !validateSeksiAccess(req, existingResult.rows[0].seksi_id)) {
      return res.status(403).json({ success: false, message: "Anda tidak memiliki akses ke rak ini" });
    }

    let finalSeksiId = req.user.role === "admin" ? (seksi_id ?? existingResult.rows[0].seksi_id) : req.user.seksi_id;
    if (finalSeksiId) {
      const seksiCheck = validators.validateIntegerId(finalSeksiId, "Seksi");
      if (seksiCheck.error) return validators.badRequest(res, seksiCheck.error);
      finalSeksiId = seksiCheck.value;
    }

    if (finalSeksiId && !validateSeksiAccess(req, finalSeksiId)) {
      return res.status(403).json({ success: false, message: "Anda tidak memiliki akses ke seksi ini" });
    }

    const result = await pool.query(
      `UPDATE rak SET kode_rak = $1, nama_rak = $2, lokasi = $3, seksi_id = $4,
        updated_at = CURRENT_TIMESTAMP WHERE id = $5
       RETURNING id, kode_rak, nama_rak, lokasi, seksi_id`,
      [kodeCheck.value, namaCheck.value, lokasiCheck.value, finalSeksiId, req.params.id]
    );

    return res.json({ success: true, message: "Rak berhasil diperbarui", data: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "Kode rak sudah digunakan" });
    }
    if (error.code === "23503") {
      return res.status(400).json({ success: false, message: "Seksi tidak valid" });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Gagal memperbarui rak" });
  }
};

const deleteRak = async (req, res) => {
  try {
    const existingResult = await pool.query("SELECT r.id, r.seksi_id FROM rak r WHERE r.id = $1", [req.params.id]);

    if (!existingResult.rows.length) {
      return res.status(404).json({ success: false, message: "Rak tidak ditemukan" });
    }

    if (req.user.role !== "admin" && !validateSeksiAccess(req, existingResult.rows[0].seksi_id)) {
      return res.status(403).json({ success: false, message: "Anda tidak memiliki akses ke rak ini" });
    }

    const result = await pool.query(
      `DELETE FROM rak r WHERE r.id = $1
       AND NOT EXISTS (SELECT 1 FROM dokumen d WHERE d.rak_id = r.id)
       RETURNING r.id`,
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(409).json({ success: false, message: "Rak tidak ditemukan atau masih dipakai dokumen" });
    }

    return res.json({ success: true, message: "Rak berhasil dihapus" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Gagal menghapus rak" });
  }
};

module.exports = { getAllRak, createRak, updateRak, deleteRak };