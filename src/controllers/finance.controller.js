const db = require('../config/db');

exports.getCODCollections = async (req, res, next) => {
  try {
    const { branch_id, status, start_date, end_date } = req.query;
    let query = `
      SELECT cc.*, u.name as rider_name, b.name as branch_name, rs.date as run_sheet_date
      FROM cod_collections cc
      JOIN users u ON cc.rider_id = u.id
      JOIN branches b ON cc.branch_id = b.id
      JOIN run_sheets rs ON cc.run_sheet_id = rs.id
      WHERE 1=1
    `;
    const values = [];

    if (branch_id) {
      query += ` AND cc.branch_id = $${values.length + 1}`;
      values.push(branch_id);
    }
    if (status) {
      query += ` AND cc.status = $${values.length + 1}`;
      values.push(status);
    }
    if (start_date && end_date) {
      query += ` AND cc.created_at BETWEEN $${values.length + 1} AND $${values.length + 2}`;
      values.push(start_date, end_date);
    }

    const { rows } = await db.query(query + ' ORDER BY cc.created_at DESC', values);
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

exports.getFinancialSummary = async (req, res, next) => {
  try {
    const { rows: stats } = await db.query(`
      SELECT 
        SUM(expected_amount) as total_expected,
        SUM(collected_amount) as total_collected,
        SUM(expected_amount - collected_amount) as total_mismatch,
        COUNT(*) as total_sheets
      FROM cod_collections
    `);
    
    res.json(stats[0]);
  } catch (error) {
    next(error);
  }
};
