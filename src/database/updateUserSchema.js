const { Client } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE
});

const alterTable = async () => {
  try {
    await client.connect();
    console.log('Connected to Database');

    const query = `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS company_name TEXT,
      ADD COLUMN IF NOT EXISTS pickup_address TEXT,
      ADD COLUMN IF NOT EXISTS cnic TEXT,
      ADD COLUMN IF NOT EXISTS bank_account_no TEXT,
      ADD COLUMN IF NOT EXISTS account_title TEXT,
      ADD COLUMN IF NOT EXISTS bank_branch_name TEXT,
      ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;
    `;

    await client.query(query);
    console.log('Users table altered successfully');

    // For existing users (especially admin), we might want to set is_approved to true
    await client.query("UPDATE users SET is_approved = true WHERE role = 'admin' OR role = 'ops'");
    console.log('Existing admins and ops marked as approved');

  } catch (err) {
    console.error('Error altering table:', err);
  } finally {
    await client.end();
  }
};

alterTable();
