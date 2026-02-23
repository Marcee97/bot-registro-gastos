const { pool } = require("../database/config.js");

const panelGet = async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM gastos ORDER BY fecha DESC");

    res.json(rows);
  } catch (error) {
    console.error("Error al obtener gastos:", error);
    res.status(500).json({ error: "Error al obtener gastos" });
  }
};

module.exports = {
  panelGet
};