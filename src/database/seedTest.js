const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE
});

async function seedTestData() {
  await client.connect();
  try {
    // 1. Create a Branch
    const branchRes = await client.query(`
      INSERT INTO branches (name, city, address) 
      VALUES ('Main Headquarters', 'Karachi', 'DHA Phase 6') 
      ON CONFLICT DO NOTHING 
      RETURNING id
    `);
    const branchId = branchRes.rows[0]?.id || (await client.query("SELECT id FROM branches WHERE name = 'Main Headquarters'")).rows[0].id;
    console.log('Branch created/found:', branchId);

    // 2. Create an Ops User (Rider)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('rider123', salt);
    
    await client.query(`
      INSERT INTO users (name, email, password_hash, role) 
      VALUES ('Default Rider', 'rider@courier.com', $1, 'ops') 
      ON CONFLICT (email) DO NOTHING
    `, [passwordHash]);
    console.log('Rider created: rider@courier.com / rider123');

    console.log('Test data seeded successfully!');
  } catch (err) {
    console.error('Error seeding data:', err);
  } finally {
    await client.end();
  }
}

seedTestData();
