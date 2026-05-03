const db = require('../config/db');
const bcrypt = require('bcryptjs');

exports.getAllUsers = async (req, res, next) => {
  try {
    const { role, approved } = req.query;
    let query = `
      SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.is_approved, u.company_name, 
             u.pickup_address, u.cnic, u.bank_account_no, u.account_title, u.bank_branch_name,
             u.created_at, b.name as branch_name 
      FROM users u
      LEFT JOIN user_branch_map ubm ON u.id = ubm.user_id
      LEFT JOIN branches b ON ubm.branch_id = b.id
      WHERE 1=1
    `;
    const values = [];
    
    if (role) {
      query += ` AND u.role = $${values.length + 1}`;
      values.push(role);
    }

    if (approved !== undefined) {
      query += ` AND u.is_approved = $${values.length + 1}`;
      values.push(approved === 'true');
    }

    if (req.query.branch_id) {
      query += ` AND ubm.branch_id = $${values.length + 1}`;
      values.push(req.query.branch_id);
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
    const { 
      name, email, phone, password, role, branch_id,
      company_name, pickup_address, cnic, bank_account_no, account_title, bank_branch_name
    } = req.body;
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
    const is_approved = role === 'admin' || role === 'ops'; // Auto-approve admin and ops
    const { rows } = await client.query(query, [
      name, email, phone, passwordHash, role,
      company_name, pickup_address, cnic, bank_account_no, account_title, bank_branch_name,
      is_approved
    ]);
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
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    // Delete associated data that might not have ON DELETE CASCADE
    await client.query('DELETE FROM ho_payments WHERE verified_by = $1', [id]);
    await client.query('DELETE FROM cod_collections WHERE rider_id = $1 OR verified_by = $1', [id]);
    await client.query('DELETE FROM customer_payouts WHERE customer_id = $1 OR created_by = $1', [id]);
    await client.query('DELETE FROM invoices WHERE customer_id = $1', [id]);
    await client.query('DELETE FROM bulk_shipments WHERE customer_id = $1', [id]);
    await client.query('DELETE FROM shipments WHERE customer_id = $1', [id]);
    await client.query('DELETE FROM audit_logs WHERE user_id = $1', [id]);
    await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);
    await client.query('DELETE FROM user_branch_map WHERE user_id = $1', [id]);

    const { rows } = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found' });
    }
    
    await client.query('COMMIT');
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete User Error:', error);
    // If it still fails due to foreign keys (e.g. shipments exists)
    if (error.code === '23503') {
      return res.status(400).json({ 
        message: `Cannot delete user: This account has active records in database (Error: ${error.detail}) and cannot be removed for audit integrity.` 
      });
    }
    next(error);
  } finally {
    client.release();
  }
};
exports.approveUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = `
      UPDATE users 
      SET is_approved = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name, email, is_approved;
    `;
    const { rows } = await db.query(query, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
};
