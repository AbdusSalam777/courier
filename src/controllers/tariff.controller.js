const db = require('../config/db');

exports.saveTariff = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id } = req.params;
    const { tariffs } = req.body; // Array of { start_weight, end_weight, additional_factor, rate }

    // First delete existing tariffs for this customer
    await client.query('DELETE FROM tariffs WHERE customer_id = $1', [customer_id]);

    // Insert new tariffs
    if (tariffs && tariffs.length > 0) {
      for (const t of tariffs) {
        await client.query(
          `INSERT INTO tariffs (customer_id, start_weight, end_weight, additional_factor, rate)
           VALUES ($1, $2, $3, $4, $5)`,
          [customer_id, t.start_weight, t.end_weight, t.additional_factor || 0, t.rate]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Tariffs saved successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

exports.getTariff = async (req, res, next) => {
  try {
    const { customer_id } = req.params;
    const { rows } = await db.query(
      'SELECT * FROM tariffs WHERE customer_id = $1 ORDER BY start_weight ASC',
      [customer_id]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

exports.calculateRate = async (req, res, next) => {
  try {
    const { customer_id, weight } = req.query;
    
    // Find matching tariff range
    const query = `
      SELECT * FROM tariffs 
      WHERE customer_id = $1 AND $2 >= start_weight AND $2 <= end_weight
      LIMIT 1
    `;
    const { rows } = await db.query(query, [customer_id, weight]);
    
    if (rows.length > 0) {
      res.json({ rate: rows[0].rate, additional_factor: rows[0].additional_factor });
    } else {
      // If no specific match, maybe fallback to standard rate or return 0
      res.json({ rate: 0, additional_factor: 0 });
    }
  } catch (error) {
    next(error);
  }
};
