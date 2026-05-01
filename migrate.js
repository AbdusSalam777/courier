const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function migrate() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Add rider to enum (PostgreSQL doesn't support adding enum values in a transaction)
    try {
      await client.query("ALTER TYPE user_role ADD VALUE 'rider'");
      console.log("Added 'rider' to user_role enum");
    } catch (e) {
      if (e.code === '42710') {
        console.log("'rider' already exists in enum");
      } else {
        throw e;
      }
    }

    // Add id_card_number to users
    try {
      await client.query("ALTER TABLE users ADD COLUMN id_card_number TEXT");
      console.log("Added id_card_number column to users table");
    } catch (e) {
      if (e.code === '42701') {
        console.log("id_card_number column already exists");
      } else {
        throw e;
      }
    }

    console.log('Migration completed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

migrate();
