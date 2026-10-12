const pool = require("../config/database");
const validators = require("../utils/validators");

const getAllLogs = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const values = [limit];
    let activityFilter = "";

    if (req.query.aktivitas) {
      const aktivitasCheck = validators.validateString(req.query.aktivitas, "Aktivitas", { max: validators.MAX_LENGTH.aktivitas });
      if (aktivitasCheck.error) return validators.badRequest(res, aktivitasCheck.error);
      values.unshift(aktivitasCheck.value);
      activityFilter = "WHERE l.aktivitas = $1";
    }

    const limitPlaceholder = `$${values.length}`;
    const result = await pool.query(
      `
      SELECT
        l.id,
        l.user_id,
        u.nama AS nama_user,
        l.dokumen_id,
        d.nomor_dokumen,
        l.aktivitas,
        l.deskripsi,
        l.created_at
      FROM log_aktivitas l
      LEFT JOIN users u ON u.id = l.user_id
      LEFT JOIN dokumen d ON d.id = l.dokumen_id
      ${activityFilter}
      ORDER BY l.created_at DESC
      LIMIT ${limitPlaceholder}
      `,
      values
    );

    return res.status(200).json({
      success: true,
      message: "Log aktivitas berhasil diambil",
      data: result.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil log aktivitas",
    });
  }
};

module.exports = { getAllLogs };