const express = require("express");
const twilio = require("twilio");
const Groq = require("groq-sdk");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: false }));

const groq = new Groq({
  apiKey:process.env.GROQ_API_KEY,
});
const conversaciones = {};

// ← extraerCompra va AFUERA del endpoint
const extraerCompra = async (mensaje) => {
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `Analizá si el mensaje habla de una compra, gasto o precio de algún producto o servicio.
Ejemplos que SÍ son compras:
- "compré pan por 2500"
- "gasté 1200 en aceite"
- "la cadena me costó 4500"
- "compre 2 gaseosas a 800 cada una"
- "pan 2500, leche 900"

Si encontrás una compra, respondé SOLO con este JSON:
{"esCompra": true, "items": [{"producto": "nombre del producto", "precio": 1234, "cantidad": 1}]}

Si el mensaje NO tiene nada que ver con una compra, respondé SOLO:
{"esCompra": false}

IMPORTANTE: solo JSON, sin texto extra, sin markdown, sin backticks.`,
      },
      { role: "user", content: mensaje },
    ],
    temperature: 0,
    max_tokens: 300,
  });

  const texto = response.choices[0].message.content
    .trim()
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(texto);
};

app.post("/whatsapp", async (req, res) => {
  const mensajeEntrante = req.body.Body;
  const numeroCliente = req.body.From;

  console.log(`\n Mensaje de ${numeroCliente}:`);
  console.log(`"${mensajeEntrante}"\n`);

  try {
    if (!conversaciones[numeroCliente]) {
      conversaciones[numeroCliente] = [];
      console.log(" Nueva conversación iniciada");
    }

    let contextoCompra = "";
    try {
      const compra = await extraerCompra(mensajeEntrante);
      if (compra.esCompra && compra.items?.length > 0) {
        console.log(" COMPRA DETECTADA:");
        compra.items.forEach((item) => { // forEach Solamente para mostrar por consola BORRABLE
          console.log(`Producto : ${item.producto}`);
          console.log(`Precio   : $${item.precio}`);
          console.log(`Cantidad : ${item.cantidad}`);
        });
        const total = compra.items.reduce(
          (sum, i) => sum + i.precio * i.cantidad,
          0,
        );
        console.log(`TOTAL: $${total}`);

        contextoCompra = `El usuario registró una compra. Confirmale brevemente que se guardó:
${compra.items.map((i) => `- ${i.producto}: $${i.precio} x${i.cantidad}`).join("\n")}
Total: $${total}
Respondé solo con una confirmación corta y amigable, sin hacer preguntas.`;
      }
    } catch (e) {
      console.log(" No se pudo parsear como compra");
    }

    conversaciones[numeroCliente].push({
      role: "user",
      content: mensajeEntrante,
    });

    if (conversaciones[numeroCliente].length > 10) {
      conversaciones[numeroCliente] = conversaciones[numeroCliente].slice(-10);
    }

    const systemPrompt = contextoCompra
      ? contextoCompra
      : "Sos un asistente, contestá claro y corto";

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        ...conversaciones[numeroCliente],
      ],
      temperature: 0.5,
      max_tokens: 150,
    });

    const respuestaIA = response.choices[0].message.content;

    conversaciones[numeroCliente].push({
      role: "assistant",
      content: respuestaIA,
    });

    console.log(` Respuesta: "${respuestaIA}"`);
    console.log(` Tokens: ${response.usage.total_tokens}\n`);

    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(respuestaIA);
    res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error(" Error:", error.message, "\n");
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(
      "Disculpá, tuve un problema técnico. Intentá de nuevo en un ratito.",
    );
    res.type("text/xml").send(twiml.toString());
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor inicia en http://localhost:${PORT}`);
});
