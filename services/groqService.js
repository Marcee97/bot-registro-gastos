// services/groqService.js
const Groq = require("groq-sdk");
const dotenv = require("dotenv");
const { pool } = require("../database/config.js");
dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const conversaciones = {};

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

IMPORTANTE: solo JSON, sin texto extra, sin markdown, sin backticks.


otra cosa si te pide ver los `,
      },
      { role: "user", content: mensaje },
    ],
    temperature: 0,
    max_tokens: 150,
  });

  

  const texto = response.choices[0].message.content
    .trim()
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(texto);
};

const generarRespuesta = async (numeroCliente, mensaje) => {
  if (!conversaciones[numeroCliente]) {
    conversaciones[numeroCliente] = [];
  }

  let contextoCompra = "";
  let compraDetectada = null;

  try {
    const compra = await extraerCompra(mensaje);
    if (compra.esCompra && compra.items?.length > 0) {
      compraDetectada = compra;
      
      const total = compra.items.reduce(
        (sum, i) => sum + i.precio * i.cantidad,
        0
      );
for (const item of compra.items) {
  await pool.execute(
    "INSERT INTO gastos (producto, cantidad, precio) VALUES (?, ?, ?)",
    [item.producto, item.cantidad, item.precio]
  );
}
      console.log("aca deberia guardar en base de datos")

      contextoCompra = `El usuario registró una compra. Confirmale brevemente que se guardó:
${compra.items.map((i) => `- ${i.producto}: $${i.precio} x${i.cantidad}`).join("\n")}
Total: $${total}
Respondé solo con una confirmación corta y amigable, sin hacer preguntas.`;
    }
  } catch (e) {
    console.log("❌ No se pudo parsear como compra", e.message);
  }

  conversaciones[numeroCliente].push({
    role: "user",
    content: mensaje,
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

  return {
    respuesta: respuestaIA,
    tokens: response.usage.total_tokens,
    compra: compraDetectada,
  };
};

const limpiarConversacion = (numeroCliente) => {
  delete conversaciones[numeroCliente];
};

module.exports = {
  extraerCompra,
  generarRespuesta,
  limpiarConversacion,
};