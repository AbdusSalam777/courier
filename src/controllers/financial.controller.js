const db = require('../config/db');
const { logAction } = require('../utils/logger');

exports.submitHOTransfer = async (req, res, next) => {
  try {
    const { branch_id, amount, reference_no } = req.body;
    const query = `
      INSERT INTO ho_payments (branch_id, amount, reference_no)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [branch_id, amount, reference_no]);
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.verifyHOPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = `
      UPDATE ho_payments 
      SET verified = true, verified_by = $1
      WHERE id = $2
      RETURNING *;
    `;
    const { rows } = await db.query(query, [req.user.id, id]);
    await logAction(req.user.id, 'VERIFY_HO_PAYMENT', 'ho_payments', id, { verified: false }, { verified: true });
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.generateCustomerInvoice = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, shipment_ids } = req.body;

    // Calculate totals
    const { rows: shipmentData } = await client.query(
      'SELECT SUM(service_charges) as total_charges, SUM(cod_amount) as total_cod FROM shipments WHERE id = ANY($1)',
      [shipment_ids]
    );

    const total_charges = Math.abs(shipmentData[0].total_charges || 0);
    const total_cod = Math.abs(shipmentData[0].total_cod || 0);
    const net_payable = total_cod - total_charges;

    // Create invoice
    const invQuery = `
      INSERT INTO invoices (customer_id, total_service_charges, total_cod_collected, net_payable)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const { rows: invRows } = await client.query(invQuery, [customer_id, total_charges, total_cod, net_payable]);

    // Mark shipments as invoiced
    await client.query(
      'UPDATE shipments SET invoice_id = $1 WHERE id = ANY($2)',
      [invRows[0].id, shipment_ids]
    );
    
    await client.query('COMMIT');
    await logAction(req.user.id, 'GENERATE_INVOICE', 'invoices', invRows[0].id, null, invRows[0]);
    res.status(201).json(invRows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

exports.processPayout = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, invoice_id, amount, payment_method, reference_no } = req.body;

    // Create payout record
    const payoutQuery = `
      INSERT INTO customer_payouts (customer_id, invoice_id, amount, payment_method, reference_no, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const { rows: payoutRows } = await client.query(payoutQuery, [customer_id, invoice_id, amount, payment_method, reference_no, req.user.id]);

    // Update invoice status
    await client.query(
      "UPDATE invoices SET status = 'PAID' WHERE id = $1",
      [invoice_id]
    );

    await client.query('COMMIT');
    res.status(201).json(payoutRows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

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
        COALESCE(SUM(expected_amount), 0) as total_expected,
        COALESCE(SUM(collected_amount), 0) as total_collected,
        COALESCE(SUM(expected_amount - collected_amount), 0) as total_mismatch,
        COUNT(*) as total_sheets
      FROM cod_collections
    `);
    
    res.json(stats[0]);
  } catch (error) {
    next(error);
  }
};

exports.getMyInvoices = async (req, res, next) => {
  try {
    const query = `
      SELECT * FROM invoices 
      WHERE customer_id = $1 
      ORDER BY created_at DESC
    `;
    const { rows } = await db.query(query, [req.user.id]);
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

exports.getUninvoicedShipments = async (req, res, next) => {
  try {
    const query = `
      SELECT s.*, u.name as customer_name
      FROM shipments s
      JOIN users u ON s.customer_id = u.id
      WHERE s.status = 'DELIVERED' AND s.invoice_id IS NULL
      ORDER BY s.created_at ASC
    `;
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

exports.markInvoiceAsPaid = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const receipt_url = req.file ? req.file.filename : null;

    // Get invoice details first
    const { rows: invRows } = await client.query('SELECT * FROM invoices WHERE id = $1', [id]);
    if (invRows.length === 0) throw new Error('Invoice not found');
    const inv = invRows[0];

    // Update Invoice
    await client.query(
      "UPDATE invoices SET status = 'PAID', receipt_url = $1 WHERE id = $2",
      [receipt_url, id]
    );

    // Create Payout Record
    await client.query(
      `INSERT INTO customer_payouts (customer_id, invoice_id, amount, payment_method, reference_no, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [inv.customer_id, id, inv.net_payable, 'BANK_TRANSFER', receipt_url, req.user.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Invoice marked as paid', receipt_url });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

exports.getAllInvoices = async (req, res, next) => {
  try {
    const query = `
      SELECT i.*, u.name as customer_name
      FROM invoices i
      JOIN users u ON i.customer_id = u.id
      ORDER BY i.created_at DESC
    `;
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (error) {
    next(error);
  }
};
