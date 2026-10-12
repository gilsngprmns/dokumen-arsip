const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const { handleUpload } = require("../middleware/uploadMiddleware");
const { requireIdParam } = require("../middleware/validateId");
const {
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
} = require("../controllers/dokumenController");

const router = express.Router();

// ID numeric divalidasi di level route agar nilai non-numeric tidak sampai
// ke PostgreSQL (yang akan menghasilkan error 500 padahal seharusnya 400).
router.get("/public/:token", getPublicDokumenByQrToken);
router.use(authMiddleware);
router.get("/trash", getTrashDokumen);
router.get("/", getAllDokumen);
router.get("/:id", requireIdParam("id"), getDokumenById);
router.post("/", handleUpload, createDokumen);
router.put("/:id", requireIdParam("id"), updateDokumen);
router.patch("/:id/archive", requireIdParam("id"), archiveDokumen);
router.delete("/:id", requireIdParam("id"), moveDokumenToTrash);
router.put("/:id/restore", requireIdParam("id"), restoreDokumen);
router.delete("/:id/permanent", requireIdParam("id"), permanentDeleteDokumen);
router.get("/:id/versions", requireIdParam("id"), getDokumenVersions);
router.post("/:id/version", requireIdParam("id"), handleUpload, createDocumentVersion);
router.get("/:id/versions/:versionId/download", requireIdParam("id"), requireIdParam("versionId"), downloadDokumenVersion);
router.get("/:id/download", requireIdParam("id"), downloadDokumen);

module.exports = router;