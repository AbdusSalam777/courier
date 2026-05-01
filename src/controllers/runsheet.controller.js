const db = require('../config/db');
const { logAction } = require('../utils/logger');

exports.createRunSheet = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { branch_id, rider_id, shipment_ids } = req.body;

    // Create run sheet
    const rsQuery = `
      INSERT INTO run_sheets (branch_id, rider_id, created_by)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows: rsRows } = await client.query(rsQuery, [branch_id, rider_id, req.user.id]);
    const run_sheet_id = rsRows[0].id;

    // Add items and update status
    for (const shipment_id of shipment_ids) {
      await client.query(
        'INSERT INTO run_sheet_items (run_sheet_id, shipment_id) VALUES ($1, $2)',
        [run_sheet_id, shipment_id]
      );

      await client.query(
        "UPDATE shipments SET status = 'OUT_FOR_DELIVERY', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [shipment_id]
      );

      await client.query(
        'INSERT INTO shipment_updates (shipment_id, status, updated_by, remarks) VALUES ($1, $2, $3, $4)',
        [shipment_id, 'OUT_FOR_DELIVERY', req.user.id, `Assigned to rider for delivery`]
      );
    }

    await client.query('COMMIT');
    
    await logAction(req.user.id, 'CREATE_RUNSHEET', 'run_sheets', run_sheet_id, null, { rider_id, shipment_ids });

    res.status(201).json(rsRows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

exports.submitDeliveryReport = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { run_sheet_id, updates } = req.body; 
    // updates = [{ shipment_id, status: 'DELIVERED'|'FAILED'|'RETURNED', remarks, cod_collected }]

    let total_cod = 0;
    let total_expected_cod = 0;
    let delivered = 0;
    let failed = 0;
    let returned = 0;

    for (const update of updates) {
      // Constraint check: must be OUT_FOR_DELIVERY
      const { rows: statusCheck } = await client.query('SELECT status, cod_amount FROM shipments WHERE id = $1', [update.shipment_id]);
      if (statusCheck[0].status !== 'OUT_FOR_DELIVERY') {
        throw new Error(`Shipment ${update.shipment_id} is not out for delivery`);
      }

      total_expected_cod += parseFloat(statusCheck[0].cod_amount || 0);

      // Update run sheet item
      await client.query(
        'UPDATE run_sheet_items SET delivery_status = $1, remarks = $2, updated_at = CURRENT_TIMESTAMP WHERE run_sheet_id = $3 AND shipment_id = $4',
        [update.status, update.remarks, run_sheet_id, update.shipment_id]
      );

      // Update shipment final status
      await client.query(
        'UPDATE shipments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [update.status, update.shipment_id]
      );

      // Log status update
      await client.query(
        'INSERT INTO shipment_updates (shipment_id, status, updated_by, remarks) VALUES ($1, $2, $3, $4)',
        [update.shipment_id, update.status, req.user.id, update.remarks]
      );

      if (update.status === 'DELIVERED') {
        delivered++;
        total_cod += (update.cod_collected || 0);
        
        // Task 6: Mismatch Detection
        if (update.cod_collected !== statusCheck[0].cod_amount) {
          await logAction(req.user.id, 'COD_MISMATCH', 'shipments', update.shipment_id, 
            { expected: statusCheck[0].cod_amount }, 
            { collected: update.cod_collected, remarks: 'Rider submitted different amount' }
          );
        }
      } else if (update.status === 'FAILED') {
        failed++;
      } else if (update.status === 'RETURNED') {
        returned++;
      }
    }

    // Update run sheet status to COMPLETED
    await client.query('UPDATE run_sheets SET status = $1 WHERE id = $2', ['COMPLETED', run_sheet_id]);

    // Create delivery summary record
    const { rows: riderRows } = await client.query('SELECT rider_id, branch_id FROM run_sheets WHERE id = $1', [run_sheet_id]);
    const { rider_id, branch_id } = riderRows[0];

    await client.query(
      `INSERT INTO delivery_updates (rider_id, run_sheet_id, delivered_count, failed_count, returned_count, remarks) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [rider_id, run_sheet_id, delivered, failed, returned, 'End of day report submitted and verified']
    );

    // Create COD collection record
    await client.query(
      `INSERT INTO cod_collections (rider_id, branch_id, run_sheet_id, expected_amount, collected_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [rider_id, branch_id, run_sheet_id, total_expected_cod, total_cod, 'VERIFIED']
    );

    await client.query('COMMIT');
    
    await logAction(req.user.id, 'SUBMIT_DELIVERY_REPORT', 'run_sheets', run_sheet_id, null, { delivered, failed, returned, total_cod });

    res.json({ message: 'Delivery report submitted and verified successfully', total_cod });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

exports.getRunSheets = async (req, res, next) => {
  try {
    const { branch_id, rider_id } = req.query;
    let query = `
      SELECT rs.*, u.name as rider_name, b.name as branch_name 
      FROM run_sheets rs
      JOIN users u ON rs.rider_id = u.id
      JOIN branches b ON rs.branch_id = b.id
      WHERE 1=1
    `;
    const values = [];

    if (branch_id) {
      query += ` AND rs.branch_id = $${values.length + 1}`;
      values.push(branch_id);
    }
    if (rider_id) {
      query += ` AND rs.rider_id = $${values.length + 1}`;
      values.push(rider_id);
    }

    const { rows } = await db.query(query + ' ORDER BY rs.created_at DESC', values);
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

exports.getRunSheetDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get Run Sheet
    const rsQuery = `
      SELECT rs.*, u.name as rider_name, b.name as branch_name 
      FROM run_sheets rs
      JOIN users u ON rs.rider_id = u.id
      JOIN branches b ON rs.branch_id = b.id
      WHERE rs.id = $1
    `;
    const { rows: rsRows } = await db.query(rsQuery, [id]);
    
    if (rsRows.length === 0) {
      return res.status(404).json({ message: 'Run sheet not found' });
    }

    // Get Items
    const itemsQuery = `
      SELECT rsi.*, s.tracking_id, s.receiver_name, s.receiver_phone, s.receiver_address, s.cod_amount, s.payment_type
      FROM run_sheet_items rsi
      JOIN shipments s ON rsi.shipment_id = s.id
      WHERE rsi.run_sheet_id = $1
    `;
    const { rows: itemRows } = await db.query(itemsQuery, [id]);

    res.json({
      ...rsRows[0],
      items: itemRows
    });
  } catch (error) {
    next(error);
  }
};
