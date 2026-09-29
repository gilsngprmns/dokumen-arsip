const express = require("express");

const { login, getMe } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const rateLimit = require("../middleware/rateLimit");

const router = express.Router();

router.post("/login", rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: "Terlalu banyak percobaan login. Coba lagi beberapa menit." }), login);
router.get("/me", authMiddleware, getMe);

module.exports = router;