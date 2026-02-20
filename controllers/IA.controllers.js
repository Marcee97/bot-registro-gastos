// services/groqService.js
const Groq = require("groq-sdk");
const dotenv = require("dotenv");
dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const conversaciones = {};

/**
 * Extrae información de compra del mensaje usando IA
 */
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

/**
 * Genera respuesta usando IA con contexto de conversación
 */
const generarRespuesta = async (numeroCliente, mensaje) => {
  // Inicializar conversación si no existe
  if (!conversaciones[numeroCliente]) {
    conversaciones[numeroCliente] = [];
  }

  // Intentar extraer compra
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

      contextoCompra = `El usuario registró una compra. Confirmale brevemente que se guardó:
${compra.items.map((i) => `- ${i.producto}: $${i.precio} x${i.cantidad}`).join("\n")}
Total: $${total}
Respondé solo con una confirmación corta y amigable, sin hacer preguntas.`;
    }
  } catch (e) {
    console.log("❌ No se pudo parsear como compra");
  }

  // Agregar mensaje del usuario al historial
  conversaciones[numeroCliente].push({
    role: "user",
    content: mensaje,
  });

  // Limitar historial a últimos 10 mensajes
  if (conversaciones[numeroCliente].length > 10) {
    conversaciones[numeroCliente] = conversaciones[numeroCliente].slice(-10);
  }

  // Determinar prompt del sistema
  const systemPrompt = contextoCompra
    ? contextoCompra
    : "Sos un asistente, contestá claro y corto";

  // Generar respuesta
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

  // Guardar respuesta en historial
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

/**
 * Limpiar conversación de un cliente
 */
const limpiarConversacion = (numeroCliente) => {
  delete conversaciones[numeroCliente];
};

module.exports = {
  extraerCompra,
  generarRespuesta,
  limpiarConversacion,
};