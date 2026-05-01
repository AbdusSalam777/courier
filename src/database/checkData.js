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
  .then(async () => {
    const branches = await client.query('SELECT name FROM branches');
    const ops = await client.query("SELECT name FROM users WHERE role = 'ops'");
    console.log('Branches:', branches.rows);
    console.log('Ops Users (Riders):', ops.rows);
  })
  .catch(err => console.error(err))
  .finally(() => client.end());
