const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE
});

client.connect()
  .then(() => client.query('SELECT name, email, role FROM users'))
  .then(res => console.log('Users in DB:', res.rows))
  .catch(err => console.error(err))
  .finally(() => client.end());
