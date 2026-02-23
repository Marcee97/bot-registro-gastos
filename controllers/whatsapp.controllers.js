// controllers/whatsapp.controllers.js
const twilio = require("twilio");
const groqService = require("../services/groqService");

const handleIncomingMessage = async (req, res) => {
  const mensajeEntrante = req.body.Body;
  const numeroCliente = req.body.From;

  console.log(`\n📱 Mensaje de ${numeroCliente}:`);
  console.log(`"${mensajeEntrante}"\n`);

  try {
    const resultado = await groqService.generarRespuesta(
      numeroCliente,
      mensajeEntrante
    );

    if (resultado.compra) {
      console.log("🛒 COMPRA DETECTADA:");
      resultado.compra.items.forEach((item) => {
        console.log(`  Producto: ${item.producto}`);
        console.log(`  Precio: $${item.precio}`);
        console.log(`  Cantidad: ${item.cantidad}`);
        console.log(`  Categoría: ${item.categoria}`);
      });
      const total = resultado.compra.items.reduce(
        (sum, i) => sum + i.precio * i.cantidad,
        0
      );
      console.log(`  TOTAL: $${total}\n`);
    }

    console.log(`🤖 Respuesta: "${resultado.respuesta}"`);
    console.log(`📊 Tokens: ${resultado.tokens}\n`);

    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(resultado.respuesta);
    res.type("text/xml").send(twiml.toString());

  } catch (error) {
    console.error("❌ Error:", error.message, "\n");
    
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(
      "Disculpá, tuve un problema técnico. Intentá de nuevo en un ratito."
    );
    res.type("text/xml").send(twiml.toString());
  }
};

const verifyWebhook = (req, res) => {
  res.status(200).send("Webhook verificado correctamente");
};

module.exports = {
  handleIncomingMessage,
  verifyWebhook,
};