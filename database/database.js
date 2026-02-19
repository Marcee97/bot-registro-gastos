const Database = require('better-sqlite3');
const path = require('path');
const { app } = require("electron");

const dbPath = path.join(app.getPath("userData"), 'contador.db'); 

// const dbPath = path.join(__dirname, 'contador.db');

const db = new Database(dbPath);

db.exec(`
    CREATE TABLE IF NOT EXISTS contador (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        precio INTEGER NOT NULL,
        producto TEXT NOT NULL)
    `)

    module.exports = db;