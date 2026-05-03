const db = require('../config/db');

exports.createLoadingSheet = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { from_branch_id, to_branch_id, vehicle_no, shipment_ids } = req.body;

    // Create loading sheet
    const lsQuery = `
      INSERT INTO loading_sheets (from_branch_id, to_branch_id, vehicle_no, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const { rows: lsRows } = await client.query(lsQuery, [from_branch_id, to_branch_id, vehicle_no, req.user.id]);
    const loading_sheet_id = lsRows[0].id;

    // Add items and update shipment status
    for (const shipment_id of shipment_ids) {
      await client.query(
        'INSERT INTO loading_sheet_items (loading_sheet_id, shipment_id) VALUES ($1, $2)',
        [loading_sheet_id, shipment_id]
      );

      await client.query(
        "UPDATE shipments SET status = 'IN_TRANSIT', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [shipment_id]
      );

      await client.query(
        'INSERT INTO shipment_updates (shipment_id, status, updated_by, remarks) VALUES ($1, $2, $3, $4)',
        [shipment_id, 'IN_TRANSIT', req.user.id, `Loaded on vehicle ${vehicle_no} for transit to ${to_branch_id}`]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(lsRows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

exports.getLoadingSheets = async (req, res, next) => {
  try {
    const query = `
      SELECT ls.*, b1.name as from_branch_name, b2.name as to_branch_name 
      FROM loading_sheets ls
      JOIN branches b1 ON ls.from_branch_id = b1.id
      JOIN branches b2 ON ls.to_branch_id = b2.id
      ORDER BY ls.created_at DESC
    `;
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

exports.getLoadingSheetById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT ls.*, b1.name as from_branch_name, b2.name as to_branch_name 
      FROM loading_sheets ls
      JOIN branches b1 ON ls.from_branch_id = b1.id
      JOIN branches b2 ON ls.to_branch_id = b2.id
      WHERE ls.id = $1
    `;
    const { rows } = await db.query(query, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Loading sheet not found' });
    }

    const sheet = rows[0];

    const itemsQuery = `
      SELECT s.*
      FROM loading_sheet_items lsi
      JOIN shipments s ON lsi.shipment_id = s.id
      WHERE lsi.loading_sheet_id = $1
    `;
    const { rows: items } = await db.query(itemsQuery, [id]);
    sheet.items = items;

    res.json(sheet);
  } catch (error) {
    next(error);
  }
};

exports.updateLoadingSheetStatus = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { status } = req.body;

    const { rows: lsRows } = await client.query(
      'UPDATE loading_sheets SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (status === 'RECEIVED') {
      const { rows: items } = await client.query('SELECT shipment_id FROM loading_sheet_items WHERE loading_sheet_id = $1', [id]);
      const to_branch_id = lsRows[0].to_branch_id;

      for (const item of items) {
        await client.query(
          "UPDATE shipments SET status = 'IN_WAREHOUSE', current_branch_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
          [to_branch_id, item.shipment_id]
        );

        await client.query(
          'INSERT INTO shipment_updates (shipment_id, status, location, updated_by, remarks) VALUES ($1, $2, $3, $4, $5)',
          [item.shipment_id, 'IN_WAREHOUSE', `Branch ID: ${to_branch_id}`, req.user.id, 'Received from transit loading sheet']
        );
      }
    }

    await client.query('COMMIT');
    res.json(lsRows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};
