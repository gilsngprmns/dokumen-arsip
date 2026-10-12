const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminOnly");
const { requireIdParam } = require("../middleware/validateId");
const { getAllRak, createRak, updateRak, deleteRak } = require("../controllers/rakController");

const router = express.Router();
router.get("/", authMiddleware, getAllRak);
router.post("/", ...adminOnly, createRak);
router.put("/:id", ...adminOnly, requireIdParam("id"), updateRak);
router.delete("/:id", ...adminOnly, requireIdParam("id"), deleteRak);

module.exports = router;