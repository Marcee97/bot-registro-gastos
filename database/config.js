const mysql = require('mysql2/promise')


const pool = mysql.createPool({
host: 'localhost',
user:'root',
password:'redondos86',
database:'bot_gastos'
})


module.exports = {pool}