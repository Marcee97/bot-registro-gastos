// routes/whatsappRoutes.js
const express = require("express");
const router = express.Router();
const whatsappController = require("../controllers/whatsapp.controllers"); // ← Nota el nombre correcto

router.post("/whatsapp", whatsappController.handleIncomingMessage);
router.get("/whatsapp", whatsappController.verifyWebhook);

module.exports = router;