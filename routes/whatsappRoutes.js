// routes/whatsappRoutes.js
const express = require("express");
const router = express.Router();
const whatsappController = require("../controllers/whatsapp.controllers"); // ← Nota el nombre correcto
const { panelGet } = require("../controllers/panel.controllers.js");
router.post("/whatsapp", whatsappController.handleIncomingMessage);
router.get("/whatsapp", whatsappController.verifyWebhook);


router.get('/gastos',panelGet)

module.exports = router;