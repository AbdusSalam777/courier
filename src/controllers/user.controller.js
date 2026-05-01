const db = require('../config/db');
const bcrypt = require('bcryptjs');

exports.getAllUsers = async (req, res, next) => {
  try {
    const { role } = req.query;
    let query = `
      SELECT u.id, u.name, u.email, u.phone, u.id_card_number, u.role, u.status, u.created_at, b.name as branch_name 
      FROM users u
      LEFT JOIN user_branch_map ubm ON u.id = ubm.user_id
      LEFT JOIN branches b ON ubm.branch_id = b.id
    `;
    const values = [];
    
    if (role) {
      query += ' WHERE u.role = $1';
      values.push(role);
    }
    
    query += ' ORDER BY u.created_at DESC';
    const { rows } = await db.query(query, values);
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

exports.createUser = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { name, email, phone, id_card_number, password, role, branch_id } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    
    const query = `
      INSERT INTO users (name, email, phone, id_card_number, password_hash, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, email, phone, id_card_number, role, status, created_at;
    `;
    const { rows } = await client.query(query, [name, email, phone, id_card_number, passwordHash, role]);
    const user = rows[0];

    if (branch_id) {
      await client.query(
        'INSERT INTO user_branch_map (user_id, branch_id) VALUES ($1, $2)',
        [user.id, branch_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(user);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

exports.getRidersByBranch = async (req, res, next) => {
  try {
    const { branch_id } = req.params;
    const query = `
      SELECT u.id, u.name, u.phone, u.id_card_number 
      FROM users u
      JOIN user_branch_map ubm ON u.id = ubm.user_id
      WHERE ubm.branch_id = $1 AND u.role = 'rider' AND u.status = true
    `;
    const { rows } = await db.query(query, [branch_id]);
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, status, role } = req.body;
    
    const query = `
      UPDATE users 
      SET name = COALESCE($1, name), 
          phone = COALESCE($2, phone), 
          status = COALESCE($3, status),
          role = COALESCE($4, role),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING id, name, email, phone, role, status, updated_at;
    `;
    const { rows } = await db.query(query, [name, phone, status, role, id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};
