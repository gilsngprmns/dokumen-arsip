const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminOnly");
const { requireIdParam } = require("../middleware/validateId");

const {
  getAllSeksi,
  getSeksiById,
  createSeksi,
  updateSeksi,
  deleteSeksi,
} = require("../controllers/seksiController");

const router = express.Router();

router.get("/", authMiddleware, getAllSeksi);
router.get("/:id", authMiddleware, requireIdParam("id"), getSeksiById);
router.post("/", ...adminOnly, createSeksi);
router.put("/:id", ...adminOnly, requireIdParam("id"), updateSeksi);
router.delete("/:id", ...adminOnly, requireIdParam("id"), deleteSeksi);

module.exports = router;