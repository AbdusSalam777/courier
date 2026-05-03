const fs = require('fs');
const path = require('path');
const db = require('./src/config/db');
const bcrypt = require('bcryptjs');

const initDB = async () => {
  try {
    console.log('Reading schema.sql...');
    const schema = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');
    
    console.log('Executing schema...');
    await db.query(schema);
    console.log('Schema executed successfully.');

    // Seed Data
    console.log('Seeding database...');
    const adminPass = await bcrypt.hash('admin123', 10);
    await db.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING
    `, ['Super Admin', 'admin@courier.com', adminPass, 'admin']);

    await db.query(`
      INSERT INTO branches (name, city, address)
      VALUES 
        ($1, $2, $3),
        ($4, $5, $6)
      ON CONFLICT DO NOTHING
    `, ['Main Branch', 'London', '123 King St', 'North Branch', 'Manchester', '456 Queen Rd']);
    
    console.log('Seeding completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }
};

initDB();
