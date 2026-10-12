const pool = require("../config/database");
const validators = require("../utils/validators");

// GET semua seksi
const getAllSeksi = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        nama_seksi,
        created_at,
        updated_at
      FROM seksi
      ORDER BY id ASC
    `);

    res.status(200).json({
      success: true,
      message: "Data seksi berhasil diambil",
      data: result.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Gagal mengambil data seksi",
    });
  }
};

// GET seksi berdasarkan ID
const getSeksiById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        id,
        nama_seksi,
        created_at,
        updated_at
      FROM seksi
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Seksi tidak ditemukan",
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Gagal mengambil data seksi",
    });
  }
};

// POST seksi
const createSeksi = async (req, res) => {
  try {
    const { nama_seksi } = req.body;

    const namaCheck = validators.validateString(nama_seksi, "Nama seksi", { max: validators.MAX_LENGTH.nama_seksi });
    if (namaCheck.error) return validators.badRequest(res, namaCheck.error);

    const result = await pool.query(
      `
      INSERT INTO seksi (nama_seksi)
      VALUES ($1)
      RETURNING *
      `,
      [namaCheck.value]
    );

    res.status(201).json({
      success: true,
      message: "Seksi berhasil ditambahkan",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Nama seksi sudah tersedia",
      });
    }

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Gagal menambahkan seksi",
    });
  }
};

// PUT seksi
const updateSeksi = async (req, res) => {
  try {
    const { id } = req.params;
    const { nama_seksi } = req.body;

    const namaCheck = validators.validateString(nama_seksi, "Nama seksi", { max: validators.MAX_LENGTH.nama_seksi });
    if (namaCheck.error) return validators.badRequest(res, namaCheck.error);

    const result = await pool.query(
      `
      UPDATE seksi
      SET
        nama_seksi = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
      `,
      [namaCheck.value, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Seksi tidak ditemukan",
      });
    }

    res.status(200).json({
      success: true,
      message: "Seksi berhasil diperbarui",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Nama seksi sudah tersedia",
      });
    }

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Gagal memperbarui seksi",
    });
  }
};

// DELETE seksi
const deleteSeksi = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM seksi
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Seksi tidak ditemukan",
      });
    }

    res.status(200).json({
      success: true,
      message: "Seksi berhasil dihapus",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Gagal menghapus seksi",
    });
  }
};

module.exports = {
  getAllSeksi,
  getSeksiById,
  createSeksi,
  updateSeksi,
  deleteSeksi,
};