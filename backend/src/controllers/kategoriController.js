const pool = require("../config/database");
const validators = require("../utils/validators");

// GET semua kategori
const getAllKategori = async (req, res) => {
  try {
    const { seksi_id } = req.query;

    let query = `
      SELECT
        k.id,
        k.seksi_id,
        s.nama_seksi,
        k.nama_kategori,
        k.deskripsi,
        k.created_at,
        k.updated_at
      FROM kategori k
      JOIN seksi s ON s.id = k.seksi_id
    `;

    const values = [];

    const requestedSection =
      req.user.role === "admin" ? seksi_id : req.user.seksi_id;

    if (requestedSection) {
      const seksiCheck = validators.validateIntegerId(requestedSection, "Seksi");
      if (seksiCheck.error) return validators.badRequest(res, seksiCheck.error);
      query += ` WHERE k.seksi_id = $1`;
      values.push(seksiCheck.value);
    }

    query += ` ORDER BY s.id ASC, k.id ASC`;

    const result = await pool.query(query, values);

    res.status(200).json({
      success: true,
      message: "Data kategori berhasil diambil",
      data: result.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Gagal mengambil data kategori",
    });
  }
};

// GET kategori berdasarkan ID
const getKategoriById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        k.id,
        k.seksi_id,
        s.nama_seksi,
        k.nama_kategori,
        k.deskripsi,
        k.created_at,
        k.updated_at
      FROM kategori k
      JOIN seksi s ON s.id = k.seksi_id
      WHERE k.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Kategori tidak ditemukan",
      });
    }

    if (
      req.user.role !== "admin" &&
      String(result.rows[0].seksi_id) !== String(req.user.seksi_id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses ke kategori ini",
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
      message: "Gagal mengambil kategori",
    });
  }
};

// POST kategori
const createKategori = async (req, res) => {
  try {
    const { seksi_id, nama_kategori, deskripsi } = req.body;

    const seksiCheck = validators.validateIntegerId(seksi_id, "Seksi");
    if (seksiCheck.error) return validators.badRequest(res, seksiCheck.error);

    const namaCheck = validators.validateString(nama_kategori, "Nama kategori", { max: validators.MAX_LENGTH.nama_kategori });
    if (namaCheck.error) return validators.badRequest(res, namaCheck.error);

    const deskripsiCheck = validators.validateOptionalString(deskripsi, "Deskripsi", { max: validators.MAX_LENGTH.deskripsi });
    if (deskripsiCheck.error) return validators.badRequest(res, deskripsiCheck.error);

    const seksi = await pool.query(
      "SELECT id FROM seksi WHERE id = $1",
      [seksiCheck.value]
    );

    if (seksi.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Seksi tidak ditemukan",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO kategori (
        seksi_id,
        nama_kategori,
        deskripsi
      )
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [
        seksiCheck.value,
        namaCheck.value,
        deskripsiCheck.value,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Kategori berhasil ditambahkan",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Kategori tersebut sudah ada pada seksi ini",
      });
    }

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Gagal menambahkan kategori",
    });
  }
};

// PUT kategori
const updateKategori = async (req, res) => {
  try {
    const { id } = req.params;
    const { seksi_id, nama_kategori, deskripsi } = req.body;

    const seksiCheck = validators.validateIntegerId(seksi_id, "Seksi");
    if (seksiCheck.error) return validators.badRequest(res, seksiCheck.error);

    const namaCheck = validators.validateString(nama_kategori, "Nama kategori", { max: validators.MAX_LENGTH.nama_kategori });
    if (namaCheck.error) return validators.badRequest(res, namaCheck.error);

    const deskripsiCheck = validators.validateOptionalString(deskripsi, "Deskripsi", { max: validators.MAX_LENGTH.deskripsi });
    if (deskripsiCheck.error) return validators.badRequest(res, deskripsiCheck.error);

    const result = await pool.query(
      `
      UPDATE kategori
      SET
        seksi_id = $1,
        nama_kategori = $2,
        deskripsi = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
      `,
      [
        seksiCheck.value,
        namaCheck.value,
        deskripsiCheck.value,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Kategori tidak ditemukan",
      });
    }

    res.status(200).json({
      success: true,
      message: "Kategori berhasil diperbarui",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Kategori tersebut sudah ada pada seksi ini",
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Seksi tidak valid",
      });
    }

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Gagal memperbarui kategori",
    });
  }
};

// DELETE kategori
const deleteKategori = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM kategori
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Kategori tidak ditemukan",
      });
    }

    res.status(200).json({
      success: true,
      message: "Kategori berhasil dihapus",
    });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(409).json({
        success: false,
        message:
          "Kategori tidak dapat dihapus karena sudah digunakan oleh dokumen",
      });
    }

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Gagal menghapus kategori",
    });
  }
};

module.exports = {
  getAllKategori,
  getKategoriById,
  createKategori,
  updateKategori,
  deleteKategori,
};