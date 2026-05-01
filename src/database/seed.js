const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');
    
    // Create Admin
    const adminPass = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING
    `, ['Super Admin', 'admin@courier.com', adminPass, 'admin']);

    // Create Branches
    await client.query(`
      INSERT INTO branches (name, city, address)
      VALUES 
        ($1, $2, $3),
        ($4, $5, $6)
      ON CONFLICT DO NOTHING
    `, ['Main Branch', 'London', '123 King St', 'North Branch', 'Manchester', '456 Queen Rd']);

    console.log('Seeding completed successfully');
    console.log('Admin Email: admin@courier.com');
    console.log('Admin Password: admin123');
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    client.release();
    process.exit();
  }
}

seed();
