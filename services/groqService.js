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
        content: `Analizá si el mensaje habla de una compra, gasto o precio.

Ejemplos que SÍ son compras:
- "compré pan por 2500"
- "gasté 1200 en aceite"
- "la cadena me costó 4500"
- "compre 2 gaseosas a 800 cada una"
- "pan 2500, leche 900"

CATEGORÍAS PERMITIDAS:
- supermercado
- transporte
- comida_fuera
- gastos_fijos
- ocio
- otros

Asigná la categoría más adecuada según el producto:
- alimentos, bebidas, vegetales, productos de limpieza, productos de higiene personal → supermercado
- taxi, colectivo, nafta, uber, didi → transporte
- restaurante, bar → comida_fuera
- luz, agua, internet, gas, alquiler, expensas → gastos_fijos
- cine, juegos → ocio
- si no sabés → otros

Si encontrás una compra, respondé SOLO con este JSON:
{
  "esCompra": true,
  "items": [
    {
      "producto": "nombre",
      "precio": 1234,
      "cantidad": 1,
      "categoria": "una de las categorías permitidas"
    }
  ]
}

Si NO es una compra:
{"esCompra": false}

IMPORTANTE:
- Solo JSON
- No texto extra
- No markdown
- No backticks`,
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

const consultarGastos = (mensaje) => {
  const keywords = [
    "gasto",
    "gastos",
    "cuánto gasté",
    "cuanto gasté",
    "total gastado",
    "total gasto",
    "últimos gastos",
    "ultimos gastos",
    "mis gastos",
    "ver gastos",
    "total"
  ];
  const mensajeNormalizado = mensaje.toLowerCase().trim();
  return keywords.some((keyword) => mensajeNormalizado.includes(keyword));
};

// ← ACTUALIZADO: Usar DATE_FORMAT y renombrar a fecha_formateada
const obtenerUltimosGastos = async () => {
  try {
    const [rows] = await pool.execute(
      `SELECT 
        producto, 
        cantidad, 
        precio, 
        DATE_FORMAT(fecha, '%d/%m') as fecha_formateada
       FROM gastos 
       ORDER BY fecha DESC 
       LIMIT 5`
    );

    if (rows.length === 0) {
      return null;
    }
    return rows;
  } catch (error) {
    console.error("❌ Error al obtener últimos gastos:", error);
    return null;
  }
};

const generarRespuesta = async (numeroCliente, mensaje) => {
  if (!conversaciones[numeroCliente]) {
    conversaciones[numeroCliente] = [];
  }

  // Verificar si pide ver gastos
  if (consultarGastos(mensaje)) {
    const gastos = await obtenerUltimosGastos();

    if (!gastos) {
      return {
        respuesta: "No tenés gastos registrados todavía.",
        tokens: 0,
        compra: null
      };
    }

    let respuesta = "📋 *Tus últimos 5 gastos:*\n\n";
   
    // ← ACTUALIZADO: Usar gasto.fecha_formateada en lugar de fecha_creacion
    gastos.forEach((gasto, index) => {
      const precioFormateado = parseFloat(gasto.precio).toFixed(0);
      
      respuesta += `${index + 1}. ${gasto.producto}`;
      if (gasto.cantidad > 1) {
        respuesta += ` (x${gasto.cantidad})`;
      }
      respuesta += ` - $${precioFormateado} - ${gasto.fecha_formateada}\n`;
    });

    return {
      respuesta,
      tokens: 0,
      compra: null
    };
  }

  // Detectar y guardar compras
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
          "INSERT INTO gastos (producto, cantidad, precio, categoria) VALUES (?, ?, ?, ?)",
          [item.producto, item.cantidad, item.precio, item.categoria]
        );
      }
      
      console.log("✅ Compra guardada en base de datos");

      contextoCompra = `El usuario registró una compra. Confirmale brevemente que se guardó:
${compra.items.map((i) => `- ${i.producto}: $${i.precio} x${i.cantidad} (${i.categoria})`).join("\n")}
Total: $${total}
Respondé solo con una confirmación corta y amigable, sin hacer preguntas.`;
    }
  } catch (e) {
    console.log("❌ No se pudo parsear como compra:", e.message);
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
    temperature: 0.4,
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