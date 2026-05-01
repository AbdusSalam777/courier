const db = require('../config/db');
const bcrypt = require('bcryptjs');

const User = {
  async create({ name, email, phone, id_card_number, password, role = 'customer' }) {
    const passwordHash = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO users (name, email, phone, id_card_number, password_hash, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, email, phone, id_card_number, role, status, created_at;
    `;
    const values = [name, email, phone, id_card_number, passwordHash, role];
    const { rows } = await db.query(query, values);
    return rows[0];
  },

  async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const { rows } = await db.query(query, [email]);
    return rows[0];
  },

  async findById(id) {
    const query = 'SELECT id, name, email, phone, id_card_number, role, status, created_at FROM users WHERE id = $1';
    const { rows } = await db.query(query, [id]);
    return rows[0];
  }
};

module.exports = User;
