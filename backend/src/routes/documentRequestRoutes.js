const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireIdParam } = require("../middleware/validateId");
const { listRequests, createRequest, processRequest, completeRequest } = require("../controllers/documentRequestController");

const router = express.Router();
router.use(authMiddleware);
router.get("/", listRequests);
router.post("/", createRequest);
router.patch("/:id/process", requireIdParam("id"), processRequest);
router.patch("/:id/complete", requireIdParam("id"), completeRequest);

module.exports = router;