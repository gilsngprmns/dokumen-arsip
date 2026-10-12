const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminOnly");
const { requireIdParam } = require("../middleware/validateId");

const {
  getAllKategori,
  getKategoriById,
  createKategori,
  updateKategori,
  deleteKategori,
} = require("../controllers/kategoriController");

const router = express.Router();

router.get("/", authMiddleware, getAllKategori);
router.get("/:id", authMiddleware, requireIdParam("id"), getKategoriById);
router.post("/", ...adminOnly, createKategori);
router.put("/:id", ...adminOnly, requireIdParam("id"), updateKategori);
router.delete("/:id", ...adminOnly, requireIdParam("id"), deleteKategori);

module.exports = router;