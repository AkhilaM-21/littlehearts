const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",          // Hostinger usually uses 'localhost'
  user: "root",               // Replace with your Hostinger DB Username
  password: "",               // Replace with your Hostinger DB Password
  database: "littlehearts_db" // Replace with your Database Name
});

db.connect(err => {
  if (err) throw err;
  console.log("MySQL Connected ✅");
});

module.exports = db;