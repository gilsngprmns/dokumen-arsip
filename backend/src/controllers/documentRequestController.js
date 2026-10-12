const pool = require("../config/database");
const logActivity = require("../services/activityLogService");
const validators = require("../utils/validators");

const requestSelect = `
  SELECT
    dr.id,
    dr.requested_by,
    requester.nama AS requester_name,
    dr.requester_seksi_id,
    requester_section.nama_seksi AS requester_section,
    dr.target_seksi_id,
    target_section.nama_seksi AS target_section,
    dr.judul_permintaan,
    dr.detail_permintaan,
    dr.dokumen_id,
    d.judul AS dokumen_judul,
    d.nomor_dokumen,
    dr.status,
    dr.processed_by,
    processor.nama AS processor_name,
    dr.response_note,
    dr.created_at,
    dr.processed_at,
    dr.completed_at,
    dr.updated_at
  FROM document_requests dr
  JOIN users requester ON requester.id = dr.requested_by
  JOIN seksi requester_section ON requester_section.id = dr.requester_seksi_id
  JOIN seksi target_section ON target_section.id = dr.target_seksi_id
  LEFT JOIN dokumen d ON d.id = dr.dokumen_id
  LEFT JOIN users processor ON processor.id = dr.processed_by
`;

const getRequest = async (id) => {
  const result = await pool.query(`${requestSelect} WHERE dr.id = $1`, [id]);
  return result.rows[0];
};

const canSeeRequest = (user, request) =>
  user.role === "admin" ||
  request.requested_by === user.id ||
  String(request.target_seksi_id) === String(user.seksi_id);

const listRequests = async (req, res) => {
  try {
    const values = [];
    let scope = "";
    if (req.user.role !== "admin") {
      values.push(req.user.id, req.user.seksi_id);
      scope = "WHERE dr.requested_by = $1 OR dr.target_seksi_id = $2";
    }

    const result = await pool.query(
      `${requestSelect} ${scope} ORDER BY dr.created_at DESC`,
      values,
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Permintaan dokumen belum dapat dimuat" });
  }
};

const createRequest = async (req, res) => {
  try {
    const { target_seksi_id: targetSectionId, judul_permintaan: title, detail_permintaan: detail } = req.body;
    const requesterSectionId = req.user.seksi_id;

    if (!requesterSectionId) {
      return res.status(400).json({ success: false, message: "Akun harus memiliki seksi untuk membuat permintaan" });
    }

    const targetCheck = validators.validateIntegerId(targetSectionId, "Seksi tujuan");
    if (targetCheck.error) return validators.badRequest(res, targetCheck.error);

    const titleCheck = validators.validateString(title, "Judul permintaan", { max: validators.MAX_LENGTH.judul_permintaan });
    if (titleCheck.error) return validators.badRequest(res, titleCheck.error);

    const detailCheck = validators.validateOptionalString(detail, "Detail permintaan", { max: validators.MAX_LENGTH.detail_permintaan });
    if (detailCheck.error) return validators.badRequest(res, detailCheck.error);

    if (String(requesterSectionId) === String(targetCheck.value)) {
      return res.status(400).json({ success: false, message: "Permintaan harus ditujukan ke seksi lain" });
    }

    const targetSection = await pool.query("SELECT id FROM seksi WHERE id = $1", [targetCheck.value]);
    if (targetSection.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Seksi tujuan tidak ditemukan" });
    }

    const result = await pool.query(
      `INSERT INTO document_requests
        (requested_by, requester_seksi_id, target_seksi_id, judul_permintaan, detail_permintaan)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [req.user.id, requesterSectionId, targetCheck.value, titleCheck.value, detailCheck.value],
    );
    const requestId = result.rows[0].id;
    await logActivity({ userId: req.user.id, requestId, activity: "REQUEST_DOCUMENT", description: `Meminta dokumen: ${titleCheck.value}` });

    return res.status(201).json({ success: true, message: "Permintaan dokumen berhasil dibuat", data: await getRequest(requestId) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Permintaan dokumen belum dapat dibuat" });
  }
};

const processRequest = async (req, res) => {
  try {
    const request = await getRequest(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: "Permintaan dokumen tidak ditemukan" });
    if (!canSeeRequest(req.user, request) || (req.user.role !== "admin" && String(request.target_seksi_id) !== String(req.user.seksi_id))) {
      return res.status(403).json({ success: false, message: "Anda tidak berwenang memproses permintaan ini" });
    }
    if (request.status !== "requested") {
      return res.status(409).json({ success: false, message: "Permintaan hanya dapat diproses dari status Requested" });
    }

    const { dokumen_id: documentId, response_note: responseNote } = req.body;

    const documentCheck = validators.validateOptionalIntegerId(documentId, "Dokumen");
    if (documentCheck.error) return validators.badRequest(res, documentCheck.error);

    const noteCheck = validators.validateOptionalString(responseNote, "Catatan respons", { max: validators.MAX_LENGTH.response_note });
    if (noteCheck.error) return validators.badRequest(res, noteCheck.error);

    if (documentCheck.value) {
      const document = await pool.query(
        "SELECT id FROM dokumen WHERE id = $1 AND seksi_id = $2 AND deleted_at IS NULL",
        [documentCheck.value, request.target_seksi_id],
      );
      if (document.rows.length === 0) return res.status(400).json({ success: false, message: "Dokumen tidak tersedia pada seksi tujuan" });
    }

    await pool.query(
      `UPDATE document_requests
       SET status = 'processed', dokumen_id = $1, processed_by = $2,
           response_note = $3, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [documentCheck.value || null, req.user.id, noteCheck.value, request.id],
    );
    await logActivity({ userId: req.user.id, requestId: request.id, documentId: documentCheck.value || null, activity: "PROCESS_DOCUMENT_REQUEST", description: `Memproses permintaan: ${request.judul_permintaan}` });

    return res.json({ success: true, message: "Permintaan berhasil diproses", data: await getRequest(request.id) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Permintaan belum dapat diproses" });
  }
};

const completeRequest = async (req, res) => {
  try {
    const request = await getRequest(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: "Permintaan dokumen tidak ditemukan" });
    if (req.user.role !== "admin" && request.requested_by !== req.user.id) {
      return res.status(403).json({ success: false, message: "Hanya peminta yang dapat menyelesaikan permintaan" });
    }
    if (request.status !== "processed") {
      return res.status(409).json({ success: false, message: "Permintaan hanya dapat diselesaikan dari status Processed" });
    }

    await pool.query(
      `UPDATE document_requests SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [request.id],
    );
    await logActivity({ userId: req.user.id, requestId: request.id, documentId: request.dokumen_id, activity: "COMPLETE_DOCUMENT_REQUEST", description: `Menyelesaikan permintaan: ${request.judul_permintaan}` });

    return res.json({ success: true, message: "Permintaan berhasil diselesaikan", data: await getRequest(request.id) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Permintaan belum dapat diselesaikan" });
  }
};

module.exports = { listRequests, createRequest, processRequest, completeRequest };