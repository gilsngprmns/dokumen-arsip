const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const pool = require("../config/database");
const { uploadDirectory } = require("../middleware/uploadMiddleware");
const logActivity = require("../services/activityLogService");
const validators = require("../utils/validators");

const documentSelect = `
  SELECT
    d.id,
    d.nomor_dokumen,
    d.qr_token,
    d.judul,
    d.seksi_id,
    s.nama_seksi,
    d.kategori_id,
    k.nama_kategori,
    d.rak_id,
    r.kode_rak,
    r.nama_rak,
    r.lokasi AS lokasi_rak,
    d.tanggal_dokumen,
    d.tahun,
    d.deskripsi,
    d.nama_file,
    d.file_path,
    d.tipe_file,
    d.ukuran_file,
    d.uploaded_by,
    u.nama AS nama_uploader,
    d.status,
    d.deleted_at,
    d.deleted_by,
    d.deleted_reason,
    deleted_user.nama AS nama_deleted_by,
    d.created_at,
    d.updated_at
  FROM dokumen d
  JOIN seksi s ON s.id = d.seksi_id
  JOIN kategori k ON k.id = d.kategori_id
  JOIN users u ON u.id = d.uploaded_by
  LEFT JOIN rak r ON r.id = d.rak_id
  LEFT JOIN users deleted_user ON deleted_user.id = d.deleted_by
`;

// Satu sumber untuk pemeriksaan akses berbasis seksi (sebelumnya ada dua
// fungsi yang hampir identik: canAccessSection & canViewDocument).
const canAccessSection = (user, seksiId) =>
  !user || user.role === "admin" || String(user.seksi_id) === String(seksiId);

// Bersihkan nama file asli dari path dan karakter kontrol sebelum disimpan/
// ditampilkan (mencegah path traversal pada header download & XSS).
const sanitizeOriginalName = (name) => {
  const base = path.basename(String(name || "file"));
  // eslint-disable-next-line no-control-regex
  return base.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255) || "file";
};

// Hapus field internal (file_path) dari data yang dikirim ke client agar
// struktur penyimpanan di server tidak bocor lewat respons API.
const serializeDokumen = (row) => {
  if (Array.isArray(row)) return row.map(serializeDokumen);
  if (!row) return row;
  const { file_path, ...safe } = row;
  return safe;
};

const removeUploadedFile = async (file) => {
  if (file) {
    await fs.unlink(file.path).catch(() => {});
  }
};

const getUserName = async (userId) => {
  const result = await pool.query("SELECT nama FROM users WHERE id = $1", [userId]);
  return result.rows[0]?.nama || "User";
};

const getAllDokumen = async (req, res) => {
  try {
    const { seksi_id, kategori_id, tahun, tanggal_dokumen, bulan, status, search } = req.query;
    const paginated = req.query.page !== undefined || req.query.limit !== undefined;
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 100);
    const values = [];
    const conditions = ["d.deleted_at IS NULL"];

    if (req.user.role !== "admin") {
      values.push(req.user.seksi_id);
      conditions.push(`d.seksi_id = $${values.length}`);
    }

    if (seksi_id) {
      const check = validators.validateIntegerId(seksi_id, "Seksi");
      if (check.error) return validators.badRequest(res, check.error);
      values.push(check.value);
      conditions.push(`d.seksi_id = $${values.length}`);
    }

    if (kategori_id) {
      const check = validators.validateIntegerId(kategori_id, "Kategori");
      if (check.error) return validators.badRequest(res, check.error);
      values.push(check.value);
      conditions.push(`d.kategori_id = $${values.length}`);
    }
    if (tahun) {
      const check = validators.validateOptionalYear(tahun, "Tahun");
      if (check.error) return validators.badRequest(res, check.error);
      values.push(check.value);
      conditions.push(`d.tahun = $${values.length}`);
    }
    if (tanggal_dokumen) {
      const check = validators.validateOptionalIsoDate(tanggal_dokumen, "Tanggal dokumen");
      if (check.error) return validators.badRequest(res, check.error);
      values.push(check.value);
      conditions.push(`d.tanggal_dokumen = $${values.length}`);
    }
    if (bulan && /^\d{4}-\d{2}$/.test(bulan)) {
      values.push(`${bulan}-01`);
      conditions.push(`d.tanggal_dokumen >= $${values.length}::date`);
      values.push(`${bulan}-01`);
      conditions.push(`d.tanggal_dokumen < ($${values.length}::date + INTERVAL '1 month')`);
    }
    if (status) {
      const check = validators.validateEnum(status, "Status", ["aktif", "arsip"]);
      if (check.error) return validators.badRequest(res, check.error);
      values.push(check.value);
      conditions.push(`d.status = $${values.length}`);
    }
    if (search) {
      const check = validators.validateOptionalString(search, "Kata kunci", { max: validators.MAX_LENGTH.search });
      if (check.error) return validators.badRequest(res, check.error);
      values.push(`%${check.value}%`);
      conditions.push(
        `(d.nomor_dokumen ILIKE $${values.length} OR d.judul ILIKE $${values.length} OR d.nama_file ILIKE $${values.length})`
      );
    }

    const where = ` WHERE ${conditions.join(" AND ")}`;
    const countResult = paginated
      ? await pool.query(`SELECT COUNT(*)::int AS total FROM dokumen d${where}`, values)
      : null;
    // Hanya tambahkan placeholder LIMIT/OFFSET (dan nilainya) ketika paginasi
    // diminta. Menambah nilai ekstra tanpa placeholder membuat PostgreSQL
    // menolak query ("bind message supplies too many parameters") -> error 500.
    const queryValues = [...values];
    const pagination = paginated
      ? ` LIMIT $${queryValues.push(limit)} OFFSET $${queryValues.push((page - 1) * limit)}`
      : "";
    const result = await pool.query(`${documentSelect}${where} ORDER BY d.created_at DESC${pagination}`, queryValues);

    return res.status(200).json({
      success: true,
      message: "Data dokumen berhasil diambil",
      data: serializeDokumen(result.rows),
      ...(paginated && { pagination: { page, limit, total: countResult.rows[0].total, pages: Math.max(Math.ceil(countResult.rows[0].total / limit), 1) } }),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data dokumen",
    });
  }
};

const getTrashDokumen = async (req, res) => {
  try {
    const { seksi_id, kategori_id, tahun, tanggal_dokumen, search } = req.query;
    const values = [];
    const conditions = ["d.deleted_at IS NOT NULL"];

    if (req.user.role !== "admin") {
      values.push(req.user.seksi_id);
      conditions.push(`d.seksi_id = $${values.length}`);
    }

    if (seksi_id) {
      const check = validators.validateIntegerId(seksi_id, "Seksi");
      if (check.error) return validators.badRequest(res, check.error);
      values.push(check.value);
      conditions.push(`d.seksi_id = $${values.length}`);
    }
    if (kategori_id) {
      const check = validators.validateIntegerId(kategori_id, "Kategori");
      if (check.error) return validators.badRequest(res, check.error);
      values.push(check.value);
      conditions.push(`d.kategori_id = $${values.length}`);
    }
    if (tahun) {
      const check = validators.validateOptionalYear(tahun, "Tahun");
      if (check.error) return validators.badRequest(res, check.error);
      values.push(check.value);
      conditions.push(`d.tahun = $${values.length}`);
    }
    if (tanggal_dokumen) {
      const check = validators.validateOptionalIsoDate(tanggal_dokumen, "Tanggal dokumen");
      if (check.error) return validators.badRequest(res, check.error);
      values.push(check.value);
      conditions.push(`d.tanggal_dokumen = $${values.length}`);
    }
    if (search) {
      const check = validators.validateOptionalString(search, "Kata kunci", { max: validators.MAX_LENGTH.search });
      if (check.error) return validators.badRequest(res, check.error);
      values.push(`%${check.value}%`);
      conditions.push(
        `(d.nomor_dokumen ILIKE $${values.length} OR d.judul ILIKE $${values.length} OR d.nama_file ILIKE $${values.length})`
      );
    }

    const result = await pool.query(
      `${documentSelect} WHERE ${conditions.join(" AND ")} ORDER BY d.deleted_at DESC`,
      values
    );

    return res.status(200).json({
      success: true,
      message: "Dokumen di Tempat Sampah berhasil diambil",
      data: serializeDokumen(result.rows),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil dokumen di Tempat Sampah",
    });
  }
};

const getDokumenById = async (req, res) => {
  try {
    const result = await pool.query(
      `${documentSelect} WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Dokumen tidak ditemukan",
      });
    }

    if (!canAccessSection(req.user, result.rows[0].seksi_id)) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses ke dokumen ini",
      });
    }

    return res.status(200).json({
      success: true,
      data: serializeDokumen(result.rows[0]),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil dokumen",
    });
  }
};

const createDokumen = async (req, res) => {
  try {
    const {
      nomor_dokumen,
      judul,
      seksi_id: seksiId,
      kategori_id: kategoriId,
      tanggal_dokumen,
      tahun,
      deskripsi,
      rak_id: rakId,
    } = req.body;

    if (!req.file) {
      await removeUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: "File wajib diupload",
      });
    }

    const nomorCheck = validators.validateString(nomor_dokumen, "Nomor dokumen", { max: validators.MAX_LENGTH.nomor_dokumen });
    if (nomorCheck.error) {
      await removeUploadedFile(req.file);
      return validators.badRequest(res, nomorCheck.error);
    }

    const judulCheck = validators.validateString(judul, "Judul", { max: validators.MAX_LENGTH.judul });
    if (judulCheck.error) {
      await removeUploadedFile(req.file);
      return validators.badRequest(res, judulCheck.error);
    }

    const seksiCheck = validators.validateIntegerId(seksiId, "Seksi");
    if (seksiCheck.error) {
      await removeUploadedFile(req.file);
      return validators.badRequest(res, seksiCheck.error);
    }

    const kategoriCheck = validators.validateIntegerId(kategoriId, "Kategori");
    if (kategoriCheck.error) {
      await removeUploadedFile(req.file);
      return validators.badRequest(res, kategoriCheck.error);
    }

    const tanggalCheck = validators.validateOptionalIsoDate(tanggal_dokumen, "Tanggal dokumen");
    if (tanggalCheck.error) {
      await removeUploadedFile(req.file);
      return validators.badRequest(res, tanggalCheck.error);
    }

    const tahunCheck = validators.validateOptionalYear(tahun, "Tahun");
    if (tahunCheck.error) {
      await removeUploadedFile(req.file);
      return validators.badRequest(res, tahunCheck.error);
    }

    const deskripsiCheck = validators.validateOptionalString(deskripsi, "Deskripsi", { max: validators.MAX_LENGTH.deskripsi });
    if (deskripsiCheck.error) {
      await removeUploadedFile(req.file);
      return validators.badRequest(res, deskripsiCheck.error);
    }

    const rakCheck = validators.validateOptionalIntegerId(rakId, "Rak");
    if (rakCheck.error) {
      await removeUploadedFile(req.file);
      return validators.badRequest(res, rakCheck.error);
    }

    if (!canAccessSection(req.user, seksiCheck.value)) {
      await removeUploadedFile(req.file);
      return res.status(403).json({
        success: false,
        message: "Staff hanya dapat mengupload dokumen ke seksinya",
      });
    }

    if (rakCheck.value) {
      const rack = await pool.query("SELECT id, seksi_id FROM rak WHERE id = $1", [rakCheck.value]);
      if (rack.rows.length === 0 || (rack.rows[0].seksi_id && String(rack.rows[0].seksi_id) !== String(seksiCheck.value))) {
        await removeUploadedFile(req.file);
        return res.status(400).json({ success: false, message: "Rak tidak sesuai dengan seksi dokumen" });
      }
    }

    const category = await pool.query(
      "SELECT id FROM kategori WHERE id = $1 AND seksi_id = $2",
      [kategoriCheck.value, seksiCheck.value]
    );

    if (category.rows.length === 0) {
      await removeUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: "Kategori tidak sesuai dengan seksi yang dipilih",
      });
    }

    const originalName = sanitizeOriginalName(req.file.originalname);
    const savedDoc = await pool.query(
      `
      INSERT INTO dokumen (
        nomor_dokumen, qr_token, judul, seksi_id, kategori_id, tanggal_dokumen,
        tahun, deskripsi, nama_file, file_path, tipe_file, ukuran_file,
        uploaded_by, status, rak_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'aktif', $14)
      RETURNING id, judul
      `,
      [
        nomorCheck.value,
        crypto.randomBytes(32).toString("hex"),
        judulCheck.value,
        seksiCheck.value,
        kategoriCheck.value,
        tanggalCheck.value,
        tahunCheck.value,
        deskripsiCheck.value,
        originalName,
        req.file.filename,
        req.file.mimetype,
        req.file.size,
        req.user.id,
        rakCheck.value,
      ]
    );

    await pool.query(
      `
      INSERT INTO dokumen_versions (
        dokumen_id, version_number, nama_file, file_path, tipe_file, ukuran_file,
        uploaded_by, catatan_perubahan
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        savedDoc.rows[0].id,
        1,
        originalName,
        req.file.filename,
        req.file.mimetype,
        req.file.size,
        req.user.id,
        "Dokumen awal",
      ]
    );

    await logActivity({
      userId: req.user.id,
      documentId: savedDoc.rows[0].id,
      activity: "UPLOAD_DOKUMEN",
      description: `Upload dokumen ${nomorCheck.value}`,
    });

    return res.status(201).json({
      success: true,
      message: "Dokumen berhasil diupload",
      data: { id: savedDoc.rows[0].id },
    });
  } catch (error) {
    await removeUploadedFile(req.file);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Nomor dokumen sudah digunakan",
      });
    }

    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengupload dokumen",
    });
  }
};

const updateDokumen = async (req, res) => {
  try {
    const { seksi_id: seksiId, kategori_id: kategoriId, judul, deskripsi, rak_id: rakId } = req.body;

    // Validasi field opsional yang dikirim (nilai kosong berarti "tidak diubah").
    const judulCheck = validators.validateOptionalString(judul, "Judul", { max: validators.MAX_LENGTH.judul });
    if (judulCheck.error) return validators.badRequest(res, judulCheck.error);

    const seksiCheck = validators.validateOptionalIntegerId(seksiId, "Seksi");
    if (seksiCheck.error) return validators.badRequest(res, seksiCheck.error);

    const kategoriCheck = validators.validateOptionalIntegerId(kategoriId, "Kategori");
    if (kategoriCheck.error) return validators.badRequest(res, kategoriCheck.error);

    const deskripsiCheck = validators.validateOptionalString(deskripsi, "Deskripsi", { max: validators.MAX_LENGTH.deskripsi });
    if (deskripsiCheck.error) return validators.badRequest(res, deskripsiCheck.error);

    const rakCheck = validators.validateOptionalIntegerId(rakId, "Rak");
    if (rakCheck.error) return validators.badRequest(res, rakCheck.error);

    const existing = await pool.query(
      "SELECT seksi_id, deleted_at FROM dokumen WHERE id = $1",
      [req.params.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Dokumen tidak ditemukan",
      });
    }

    if (existing.rows[0].deleted_at) {
      return res.status(400).json({
        success: false,
        message: "Dokumen sudah berada di Tempat Sampah",
      });
    }

    if (!canAccessSection(req.user, existing.rows[0].seksi_id)) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses ke dokumen ini",
      });
    }

    const targetSection = seksiCheck.value || existing.rows[0].seksi_id;
    if (!canAccessSection(req.user, targetSection)) {
      return res.status(403).json({
        success: false,
        message: "Staff hanya dapat memindahkan dokumen di seksinya",
      });
    }

    if (rakCheck.value) {
      const rack = await pool.query("SELECT id, seksi_id FROM rak WHERE id = $1", [rakCheck.value]);
      if (rack.rows.length === 0 || (rack.rows[0].seksi_id && String(rack.rows[0].seksi_id) !== String(targetSection))) {
        return res.status(400).json({ success: false, message: "Rak tidak sesuai dengan seksi dokumen" });
      }
    }

    if (kategoriCheck.value) {
      const category = await pool.query(
        "SELECT id FROM kategori WHERE id = $1 AND seksi_id = $2",
        [kategoriCheck.value, targetSection]
      );
      if (category.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Kategori tidak sesuai dengan seksi yang dipilih",
        });
      }
    }

    const result = await pool.query(
      `
      UPDATE dokumen
      SET
        judul = COALESCE($1, judul),
        seksi_id = COALESCE($2, seksi_id),
        kategori_id = COALESCE($3, kategori_id),
        deskripsi = COALESCE($4, deskripsi),
        rak_id = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING id
      `,
      [judulCheck.value, seksiCheck.value, kategoriCheck.value, deskripsiCheck.value, rakCheck.value, req.params.id]
    );
    await logActivity({
      userId: req.user.id,
      documentId: req.params.id,
      activity: "EDIT_DOKUMEN",
      description: "Metadata dokumen diperbarui",
    });

    return res.status(200).json({
      success: true,
      message: "Metadata dokumen berhasil diperbarui",
      data: { id: result.rows[0].id },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui metadata dokumen",
    });
  }
};

const archiveDokumen = async (req, res) => {
  try {
    const result = await pool.query(
      `
      UPDATE dokumen d
      SET status = 'arsip', updated_at = CURRENT_TIMESTAMP
      WHERE d.id = $1
        AND d.deleted_at IS NULL
        AND ($2 = 'admin' OR d.seksi_id = $3)
      RETURNING d.id
      `,
      [req.params.id, req.user.role, req.user.seksi_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Dokumen tidak ditemukan atau tidak dapat diakses",
      });
    }
    await logActivity({
      userId: req.user.id,
      documentId: req.params.id,
      activity: "ARSIP_DOKUMEN",
      description: "Dokumen diarsipkan",
    });

    return res.status(200).json({
      success: true,
      message: "Dokumen berhasil diarsipkan",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengarsipkan dokumen",
    });
  }
};

const moveDokumenToTrash = async (req, res) => {
  try {
    const existing = await pool.query(
      `${documentSelect} WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [req.params.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Dokumen tidak ditemukan atau sudah di Tempat Sampah",
      });
    }

    if (!canAccessSection(req.user, existing.rows[0].seksi_id)) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk menghapus dokumen ini",
      });
    }

    const actorName = await getUserName(req.user.id);
    const document = existing.rows[0];
    const result = await pool.query(
      `
      UPDATE dokumen
      SET deleted_at = CURRENT_TIMESTAMP,
          deleted_by = $1,
          deleted_reason = $2,
          status = 'arsip',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND deleted_at IS NULL
      RETURNING id
      `,
      [req.user.id, `Dihapus oleh ${actorName}`, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        success: false,
        message: "Dokumen sedang diproses atau sudah dihapus",
      });
    }

    await logActivity({
      userId: req.user.id,
      documentId: document.id,
      activity: "DELETE_DOKUMEN",
      description: `${actorName} memindahkan dokumen "${document.judul}" ke Tempat Sampah.`,
    });

    return res.status(200).json({
      success: true,
      message: "Dokumen berhasil dipindahkan ke Tempat Sampah",
      data: { id: document.id },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Gagal memindahkan dokumen ke Tempat Sampah",
    });
  }
};

const restoreDokumen = async (req, res) => {
  try {
    const existing = await pool.query(
      `${documentSelect} WHERE d.id = $1 AND d.deleted_at IS NOT NULL`,
      [req.params.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Dokumen tidak ditemukan di Tempat Sampah",
      });
    }

    if (!canAccessSection(req.user, existing.rows[0].seksi_id)) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk memulihkan dokumen ini",
      });
    }

    const actorName = await getUserName(req.user.id);
    const document = existing.rows[0];
    await pool.query(
      `
      UPDATE dokumen
      SET deleted_at = NULL,
          deleted_by = NULL,
          deleted_reason = NULL,
          status = 'aktif',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [req.params.id]
    );

    await logActivity({
      userId: req.user.id,
      documentId: document.id,
      activity: "RESTORE_DOKUMEN",
      description: `${actorName} memulihkan dokumen "${document.judul}" dari Tempat Sampah.`,
    });

    return res.status(200).json({
      success: true,
      message: "Dokumen berhasil dipulihkan",
      data: { id: document.id },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Gagal memulihkan dokumen",
    });
  }
};

const deleteFileIfExists = async (filePathValue) => {
  if (!filePathValue) return;
  const fullPath = path.join(uploadDirectory, path.basename(filePathValue));
  await fs.unlink(fullPath).catch(() => {});
};

const permanentDeleteDokumen = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Hanya admin yang dapat menghapus dokumen secara permanen",
      });
    }

    const documentResult = await pool.query(
      `${documentSelect} WHERE d.id = $1`,
      [req.params.id]
    );

    if (documentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Dokumen tidak ditemukan",
      });
    }

    const document = documentResult.rows[0];
    const versionsResult = await pool.query(
      `SELECT id, file_path, nama_file FROM dokumen_versions WHERE dokumen_id = $1 ORDER BY version_number ASC`,
      [req.params.id]
    );

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM dokumen_versions WHERE dokumen_id = $1", [req.params.id]);
      await client.query("DELETE FROM dokumen WHERE id = $1", [req.params.id]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    await deleteFileIfExists(document.file_path);
    for (const version of versionsResult.rows) {
      await deleteFileIfExists(version.file_path);
    }

    const actorName = await getUserName(req.user.id);
    await logActivity({
      userId: req.user.id,
      documentId: document.id,
      activity: "PERMANENT_DELETE_DOKUMEN",
      description: `${actorName} menghapus dokumen "${document.judul}" secara permanen.`,
    });

    return res.status(200).json({
      success: true,
      message: "Dokumen berhasil dihapus secara permanen",
      data: { id: document.id },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Gagal menghapus dokumen secara permanen",
    });
  }
};

const getDokumenVersions = async (req, res) => {
  try {
    const document = await pool.query(
      "SELECT id, seksi_id, deleted_at FROM dokumen WHERE id = $1",
      [req.params.id]
    );

    if (document.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Dokumen tidak ditemukan",
      });
    }

    if (!canAccessSection(req.user, document.rows[0].seksi_id)) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses ke dokumen ini",
      });
    }

    const result = await pool.query(
      `
      SELECT
        dv.id,
        dv.version_number,
        dv.nama_file,
        dv.tipe_file,
        dv.ukuran_file,
        dv.catatan_perubahan,
        dv.created_at,
        u.nama AS uploaded_by_name
      FROM dokumen_versions dv
      JOIN users u ON u.id = dv.uploaded_by
      WHERE dv.dokumen_id = $1
      ORDER BY dv.version_number DESC
      `,
      [req.params.id]
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil riwayat versi dokumen",
    });
  }
};

const createDocumentVersion = async (req, res) => {
  try {
    const { catatan_perubahan } = req.body;
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File revisi wajib diupload",
      });
    }

    const catatanCheck = validators.validateOptionalString(catatan_perubahan, "Catatan perubahan", { max: validators.MAX_LENGTH.catatan_perubahan });
    if (catatanCheck.error) {
      await removeUploadedFile(req.file);
      return validators.badRequest(res, catatanCheck.error);
    }

    const document = await pool.query(
      "SELECT id, judul, seksi_id, file_path, nama_file, tipe_file, ukuran_file FROM dokumen WHERE id = $1 AND deleted_at IS NULL",
      [req.params.id]
    );

    if (document.rows.length === 0) {
      await removeUploadedFile(req.file);
      return res.status(404).json({
        success: false,
        message: "Dokumen tidak ditemukan",
      });
    }

    if (!canAccessSection(req.user, document.rows[0].seksi_id)) {
      await removeUploadedFile(req.file);
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk mengubah dokumen ini",
      });
    }

    const lastVersion = await pool.query(
      "SELECT version_number FROM dokumen_versions WHERE dokumen_id = $1 ORDER BY version_number DESC LIMIT 1",
      [req.params.id]
    );
    const versionNumber = (lastVersion.rows[0]?.version_number || 0) + 1;
    const actorName = await getUserName(req.user.id);
    const originalName = sanitizeOriginalName(req.file.originalname);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `
        INSERT INTO dokumen_versions (
          dokumen_id, version_number, nama_file, file_path, tipe_file, ukuran_file,
          uploaded_by, catatan_perubahan
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          req.params.id,
          versionNumber,
          originalName,
          req.file.filename,
          req.file.mimetype,
          req.file.size,
          req.user.id,
          catatanCheck.value,
        ]
      );

      await client.query(
        `
        UPDATE dokumen
        SET file_path = $1,
            nama_file = $2,
            tipe_file = $3,
            ukuran_file = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        `,
        [req.file.filename, originalName, req.file.mimetype, req.file.size, req.params.id]
      );

      await client.query(
        `
        INSERT INTO log_aktivitas (user_id, dokumen_id, aktivitas, deskripsi)
        VALUES ($1, $2, $3, $4)
        `,
        [
          req.user.id,
          req.params.id,
          "UPLOAD_NEW_VERSION",
          `${actorName} mengupload versi ${versionNumber} untuk dokumen "${document.rows[0].judul}".`,
        ]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return res.status(201).json({
      success: true,
      message: "Versi baru dokumen berhasil diupload",
      data: { version_number: versionNumber },
    });
  } catch (error) {
    await removeUploadedFile(req.file);
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengupload versi baru dokumen",
    });
  }
};

const downloadDokumenVersion = async (req, res) => {
  try {
    const document = await pool.query(
      "SELECT id, seksi_id FROM dokumen WHERE id = $1",
      [req.params.id]
    );

    if (document.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Dokumen tidak ditemukan",
      });
    }

    if (!canAccessSection(req.user, document.rows[0].seksi_id)) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses ke dokumen ini",
      });
    }

    const version = await pool.query(
      `
      SELECT dv.id, dv.dokumen_id, dv.nama_file, dv.file_path, dv.version_number, dv.uploaded_by
      FROM dokumen_versions dv
      WHERE dv.dokumen_id = $1 AND dv.id = $2
      `,
      [req.params.id, req.params.versionId]
    );

    if (version.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Versi dokumen tidak ditemukan",
      });
    }

    const filePath = path.join(uploadDirectory, path.basename(version.rows[0].file_path));
    await fs.access(filePath);

    return res.download(filePath, version.rows[0].nama_file, async (downloadError) => {
      if (!downloadError) {
        await logActivity({
          userId: req.user.id,
          documentId: req.params.id,
          activity: "DOWNLOAD_DOKUMEN",
          description: `Download versi ${version.rows[0].version_number} dokumen`,
        });
      }
    });
  } catch (error) {
    console.error(error);
    if (error.code === "ENOENT") {
      return res.status(404).json({
        success: false,
        message: "File versi dokumen tidak ditemukan",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Gagal mendownload versi dokumen",
    });
  }
};

const downloadDokumen = async (req, res) => {
  try {
    const result = await pool.query(
      `${documentSelect} WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Dokumen tidak ditemukan",
      });
    }

    const document = result.rows[0];
    if (!canAccessSection(req.user, document.seksi_id)) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses ke dokumen ini",
      });
    }

    const filePath = path.join(uploadDirectory, path.basename(document.file_path));
    await fs.access(filePath);

    return res.download(filePath, document.nama_file, async (downloadError) => {
      if (!downloadError) {
        await logActivity({
          userId: req.user.id,
          documentId: document.id,
          activity: "DOWNLOAD_DOKUMEN",
          description: `Download ${document.nama_file}`,
        });
      }

      if (downloadError && !res.headersSent) {
        res.status(404).json({
          success: false,
          message: "File dokumen tidak ditemukan",
        });
      }
    });
  } catch (error) {
    console.error(error);

    if (error.code === "ENOENT") {
      return res.status(404).json({
        success: false,
        message: "File dokumen tidak ditemukan",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Gagal mendownload dokumen",
    });
  }
};

const getPublicDokumenByQrToken = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT d.nomor_dokumen, d.judul, d.tanggal_dokumen, d.tahun,
        d.deskripsi, d.status, d.nama_file, d.tipe_file, d.ukuran_file,
        d.created_at, d.updated_at, u.nama AS nama_uploader,
        s.nama_seksi, k.nama_kategori,
        r.kode_rak, r.nama_rak, r.lokasi AS lokasi_rak
      FROM dokumen d
      JOIN users u ON u.id = d.uploaded_by
      JOIN seksi s ON s.id = d.seksi_id
      JOIN kategori k ON k.id = d.kategori_id
      LEFT JOIN rak r ON r.id = d.rak_id
      WHERE d.qr_token = $1 AND d.deleted_at IS NULL
      `,
      [req.params.token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "QR dokumen tidak ditemukan" });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Gagal membaca informasi QR dokumen" });
  }
};

module.exports = {
  getAllDokumen,
  getTrashDokumen,
  getDokumenById,
  createDokumen,
  updateDokumen,
  archiveDokumen,
  moveDokumenToTrash,
  restoreDokumen,
  permanentDeleteDokumen,
  getDokumenVersions,
  createDocumentVersion,
  downloadDokumenVersion,
  downloadDokumen,
  getPublicDokumenByQrToken,
};