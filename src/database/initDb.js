const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const init = async () => {
  // Connect to default 'postgres' database to create our database
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL server');

    // Create Database
    try {
      await client.query(`CREATE DATABASE ${process.env.DB_DATABASE}`);
      console.log(`Database ${process.env.DB_DATABASE} created`);
    } catch (err) {
      if (err.code === '42P04') {
        console.log('Database already exists');
      } else {
        throw err;
      }
    }
    await client.end();

    // Now connect to the new database to run the schema
    const dbClient = new Client({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
      database: process.env.DB_DATABASE
    });

    await dbClient.connect();
    console.log(`Connected to ${process.env.DB_DATABASE}`);

    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    await dbClient.query(schema);
    console.log('Schema applied successfully');

    await dbClient.end();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

init();
