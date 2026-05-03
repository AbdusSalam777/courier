const db = require('../config/db');
const bcrypt = require('bcryptjs');

const User = {
  async create({ 
    name, email, phone, password, role = 'customer',
    company_name, pickup_address, cnic, bank_account_no, account_title, bank_branch_name
  }) {
    const passwordHash = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO users (
        name, email, phone, password_hash, role,
        company_name, pickup_address, cnic, bank_account_no, account_title, bank_branch_name,
        is_approved
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, name, email, phone, role, status, is_approved, created_at;
    `;
    const values = [
      name, email, phone, passwordHash, role,
      company_name, pickup_address, cnic, bank_account_no, account_title, bank_branch_name,
      role === 'admin' || role === 'ops' // Auto-approve admin and ops if created through some admin panel, but here we'll assume false for customer
    ];
    const { rows } = await db.query(query, values);
    return rows[0];
  },

  async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const { rows } = await db.query(query, [email]);
    return rows[0];
  },

  async findById(id) {
    const query = 'SELECT id, name, email, phone, role, status, is_approved, company_name, pickup_address, cnic, bank_account_no, account_title, bank_branch_name, created_at FROM users WHERE id = $1';
    const { rows } = await db.query(query, [id]);
    return rows[0];
  }
};

module.exports = User;
