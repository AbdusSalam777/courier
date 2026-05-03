const db = require('./src/config/db');

const migrate = async () => {
  try {
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
      );
    `);
    console.log('Migration successful');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

migrate();
