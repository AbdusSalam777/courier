const db = require('../config/db');

exports.getAllBranches = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM branches ORDER BY name ASC');
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

exports.createBranch = async (req, res, next) => {
  try {
    const { name, city, address } = req.body;
    const query = `
      INSERT INTO branches (name, city, address)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [name, city, address]);
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.updateBranch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, city, address, status } = req.body;
    const query = `
      UPDATE branches 
      SET name = COALESCE($1, name), 
          city = COALESCE($2, city), 
          address = COALESCE($3, address),
          status = COALESCE($4, status)
      WHERE id = $5
      RETURNING *;
    `;
    const { rows } = await db.query(query, [name, city, address, status, id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Branch not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.assignUserToBranch = async (req, res, next) => {
  try {
    const { userId, branchId } = req.body;
    const query = `
      INSERT INTO user_branch_map (user_id, branch_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, branch_id) DO NOTHING
      RETURNING *;
    `;
    const { rows } = await db.query(query, [userId, branchId]);
    res.json({ message: 'User assigned to branch successfully' });
  } catch (error) {
    next(error);
  }
};

exports.deleteBranch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query('DELETE FROM branches WHERE id = $1 RETURNING *', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Branch not found' });
    }
    
    res.json({ message: 'Branch deleted successfully' });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({ 
        message: 'Cannot delete branch because it has associated records (shipments, users, or sheets). Please deactivate it instead.' 
      });
    }
    next(error);
  }
};
