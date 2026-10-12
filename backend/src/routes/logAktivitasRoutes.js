const express = require("express");

const { getAllLogs } = require("../controllers/logAktivitasController");
const adminOnly = require("../middleware/adminOnly");

const router = express.Router();

router.get("/", ...adminOnly, getAllLogs);

module.exports = router;