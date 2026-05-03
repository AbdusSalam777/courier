const db = require('../config/db');

exports.receiveShipment = async (req, res, next) => {
  try {
    const { tracking_id, branch_id, remarks } = req.body;

    // Find shipment by tracking_id
    const { rows: shipmentRows } = await db.query('SELECT id FROM shipments WHERE tracking_id = $1', [tracking_id]);
    if (shipmentRows.length === 0) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    const shipment_id = shipmentRows[0].id;

    // Create warehouse entry
    await db.query(
      'INSERT INTO warehouse_entries (shipment_id, branch_id, received_by) VALUES ($1, $2, $3)',
      [shipment_id, branch_id, req.user.id]
    );

    // Update shipment status and current location
    const updateQuery = `
      UPDATE shipments 
      SET status = 'IN_WAREHOUSE', current_branch_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const { rows } = await db.query(updateQuery, [branch_id, shipment_id]);

    // Log update
    await db.query(
      'INSERT INTO shipment_updates (shipment_id, status, location, updated_by, remarks) VALUES ($1, $2, $3, $4, $5)',
      [shipment_id, 'IN_WAREHOUSE', `Branch ID: ${branch_id}`, req.user.id, remarks || 'Received at warehouse']
    );

    res.json({ message: 'Shipment received at warehouse', shipment: rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.getWarehouseShipments = async (req, res, next) => {
  try {
    const { branchId } = req.params;
    const { rows } = await db.query(
      "SELECT * FROM shipments WHERE current_branch_id = $1 AND status IN ('IN_WAREHOUSE', 'FAILED', 'RETURNED')",
      [branchId]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
};
