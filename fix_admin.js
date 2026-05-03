const db = require('./src/config/db');
const bcrypt = require('bcryptjs');

const fix = async () => {
  try {
    // Step 1: Add missing columns to users table
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS company_name TEXT,
      ADD COLUMN IF NOT EXISTS pickup_address TEXT,
      ADD COLUMN IF NOT EXISTS cnic TEXT,
      ADD COLUMN IF NOT EXISTS bank_account_no TEXT,
      ADD COLUMN IF NOT EXISTS account_title TEXT,
      ADD COLUMN IF NOT EXISTS bank_branch_name TEXT,
      ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false
    `);
    console.log('✅ Missing columns added to users table');

    // Step 2: Create tariffs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS tariffs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
        tariff_type VARCHAR(50) DEFAULT 'STANDARD',
        start_weight DECIMAL(10,2) NOT NULL,
        end_weight DECIMAL(10,2) NOT NULL,
        additional_factor DECIMAL(10,2) DEFAULT 0,
        rate DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tariffs table created');

    // Step 3: Seed admin with is_approved = true
    const adminPass = await bcrypt.hash('admin123', 10);
    await db.query(`
      INSERT INTO users (name, email, password_hash, role, is_approved, status)
      VALUES ($1, $2, $3, $4, true, true)
      ON CONFLICT (email) DO UPDATE SET is_approved = true
    `, ['Super Admin', 'admin@courier.com', adminPass, 'admin']);
    console.log('✅ Admin user seeded with is_approved = true');

    // Step 4: Approve all existing admins/ops
    await db.query("UPDATE users SET is_approved = true WHERE role = 'admin' OR role = 'ops'");
    console.log('✅ All admin/ops users approved');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

fix();
