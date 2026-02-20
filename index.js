// index.js
const express = require("express");
const dotenv = require("dotenv");
dotenv.config();

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Importar rutas
const whatsappRoutes = require("./routes/whatsappRoutes.js");

// Usar rutas
app.use("/", whatsappRoutes);

// Ruta de chequeo de servidor
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Servidor de WhatsApp Bot funcionando" 
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error("Error global:", err);
  res.status(500).json({ 
    error: "Error interno del servidor" 
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📱 Webhook WhatsApp: http://localhost:${PORT}/whatsapp`);
});

module.exports = app;