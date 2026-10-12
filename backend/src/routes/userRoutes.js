const express = require("express");

const {
  getAllUsers,
  createUser,
  updateUser,
  updateStatus,
  resetPassword,
} = require("../controllers/userController");
const adminOnly = require("../middleware/adminOnly");
const { requireIdParam } = require("../middleware/validateId");

const router = express.Router();

router.get("/", ...adminOnly, getAllUsers);
router.post("/", ...adminOnly, createUser);
router.put("/:id", ...adminOnly, requireIdParam("id"), updateUser);
router.patch("/:id/status", ...adminOnly, requireIdParam("id"), updateStatus);
router.patch("/:id/password", ...adminOnly, requireIdParam("id"), resetPassword);

module.exports = router;