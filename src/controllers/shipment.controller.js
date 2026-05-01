const db = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');
const { isValidTransition } = require('../utils/stateMachine');
const { logAction } = require('../utils/logger');
const { generateLabel } = require('../utils/labelGenerator');

exports.createShipment = async (req, res, next) => {
  try {
    const {
      sender_name, sender_phone, sender_address,
      receiver_name, receiver_phone, receiver_address,
      weight, parcel_type, payment_type, cod_amount,
      origin_branch_id, destination_branch_id
    } = req.body;

    const tracking_id = 'TRK' + Date.now().toString().slice(-10);
    const customer_id = req.user.role === 'customer' ? req.user.id : req.body.customer_id;

    const query = `
      INSERT INTO shipments (
        tracking_id, customer_id, sender_name, sender_phone, sender_address,
        receiver_name, receiver_phone, receiver_address, weight, parcel_type,
        payment_type, cod_amount, origin_branch_id, destination_branch_id, current_branch_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *;
    `;

    const { rows } = await db.query(query, [
      tracking_id, customer_id, sender_name, sender_phone, sender_address,
      receiver_name, receiver_phone, receiver_address, weight, parcel_type,
      payment_type, cod_amount, origin_branch_id || null, destination_branch_id || null, origin_branch_id || null, 'BOOKED'
    ]);

    // Log status update
    await db.query(
      'INSERT INTO shipment_updates (shipment_id, status, updated_by, remarks) VALUES ($1, $2, $3, $4)',
      [rows[0].id, 'BOOKED', req.user.id, 'Shipment booked successfully']
    );

    await logAction(req.user.id, 'CREATE_SHIPMENT', 'shipments', rows[0].id, null, rows[0]);

    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.getAllShipments = async (req, res, next) => {
  try {
    const { status, customer_id, branch_id } = req.query;
    let query = 'SELECT * FROM shipments WHERE 1=1';
    const values = [];

    if (req.user.role === 'customer') {
      query += ` AND customer_id = $${values.length + 1}`;
      values.push(req.user.id);
    } else if (customer_id) {
      query += ` AND customer_id = $${values.length + 1}`;
      values.push(customer_id);
    }

    if (status) {
      query += ` AND status = $${values.length + 1}`;
      values.push(status);
    }

    if (branch_id) {
      query += ` AND current_branch_id = $${values.length + 1}`;
      values.push(branch_id);
    }

    query += ' ORDER BY created_at DESC';
    const { rows } = await db.query(query, values);
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

exports.getShipmentByTrackingId = async (req, res, next) => {
  try {
    const { trackingId } = req.params;
    const shipmentQuery = 'SELECT * FROM shipments WHERE tracking_id = $1';
    const { rows: shipmentRows } = await db.query(shipmentQuery, [trackingId]);

    if (shipmentRows.length === 0) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    const historyQuery = 'SELECT * FROM shipment_updates WHERE shipment_id = $1 ORDER BY created_at DESC';
    const { rows: historyRows } = await db.query(historyQuery, [shipmentRows[0].id]);

    res.json({
      shipment: shipmentRows[0],
      history: historyRows
    });
  } catch (error) {
    next(error);
  }
};

exports.updateShipmentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, remarks, location } = req.body;

    // Fetch current status for validation
    const { rows: currentRows } = await db.query('SELECT status FROM shipments WHERE id = $1', [id]);
    if (currentRows.length === 0) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    const currentStatus = currentRows[0].status;

    // State Machine Validation
    if (!isValidTransition(currentStatus, status)) {
      return res.status(400).json({ 
        message: `Invalid status transition from ${currentStatus} to ${status}` 
      });
    }

    const query = `
      UPDATE shipments 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const { rows } = await db.query(query, [status, id]);

    // Log status update
    await db.query(
      'INSERT INTO shipment_updates (shipment_id, status, location, updated_by, remarks) VALUES ($1, $2, $3, $4, $5)',
      [id, status, location, req.user.id, remarks]
    );

    await logAction(req.user.id, 'UPDATE_STATUS', 'shipments', id, { status: currentStatus }, { status });

    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.updateServiceCharge = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { service_charges } = req.body;
    
    const query = `
      UPDATE shipments 
      SET service_charges = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const { rows } = await db.query(query, [service_charges, id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    await logAction(req.user.id, 'UPDATE_SERVICE_CHARGE', 'shipments', id, null, { service_charges });
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.generateLabelFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query('SELECT * FROM shipments WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Shipment not found' });

    const fileName = await generateLabel(rows[0]);
    
    // Save to DB
    await db.query(
      'INSERT INTO shipment_labels (shipment_id, label_url) VALUES ($1, $2) ON CONFLICT (shipment_id) DO UPDATE SET label_url = $2',
      [id, fileName]
    );

    res.json({ message: 'Label generated successfully', fileName });
  } catch (error) {
    next(error);
  }
};

exports.bulkUploadShipments = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Please upload a CSV file' });
  }

  const results = [];
  const customer_id = req.user.role === 'customer' ? req.user.id : req.body.customer_id;
  
  // Create bulk record
  const { rows: bulkRows } = await db.query(
    'INSERT INTO bulk_shipments (customer_id, file_name, status) VALUES ($1, $2, $3) RETURNING id',
    [customer_id, req.file.filename, 'PROCESSING']
  );
  const bulk_id = bulkRows[0].id;

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      let processed = 0;
      let failed = 0;

      for (const [index, row] of results.entries()) {
        try {
          const tracking_id = 'TRK' + Date.now().toString().slice(-10) + index;
          
          await db.query(
            `INSERT INTO shipments (
              tracking_id, customer_id, sender_name, sender_phone, sender_address,
              receiver_name, receiver_phone, receiver_address, weight, parcel_type,
              payment_type, cod_amount, origin_branch_id, destination_branch_id, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
              tracking_id, customer_id, row.sender_name, row.sender_phone, row.sender_address,
              row.receiver_name, row.receiver_phone, row.receiver_address, 
              parseFloat(row.weight || 0), row.parcel_type,
              row.payment_type || 'COD', parseFloat(row.cod_amount || 0),
              row.origin_branch_id || null, row.destination_branch_id || null, 'BOOKED'
            ]
          );
          processed++;
        } catch (err) {
          failed++;
          await db.query(
            'INSERT INTO bulk_shipment_errors (bulk_id, row_number, error_message, row_data) VALUES ($1, $2, $3, $4)',
            [bulk_id, index + 1, err.message, JSON.stringify(row)]
          );
        }
      }

      await db.query(
        'UPDATE bulk_shipments SET total_rows = $1, processed_rows = $2, failed_rows = $3, status = $4 WHERE id = $5',
        [results.length, processed, failed, 'COMPLETED', bulk_id]
      );

      res.json({ message: 'Bulk upload completed', bulk_id, total: results.length, processed, failed });
    });
};
