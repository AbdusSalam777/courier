const db = require('../config/db');

exports.getAdminDashboard = async (req, res, next) => {
  try {
    const stats = {};
    
    // Total Shipments
    const { rows: shipmentStats } = await db.query('SELECT COUNT(*) as total FROM shipments');
    stats.total_shipments = parseInt(shipmentStats[0].total) || 0;

    // Active Users
    const { rows: userStats } = await db.query('SELECT COUNT(*) as total FROM users WHERE status = true');
    stats.active_users = parseInt(userStats[0].total) || 0;

    // Active Branches
    const { rows: branchStats } = await db.query('SELECT COUNT(*) as total FROM branches WHERE status = true');
    stats.active_branches = parseInt(branchStats[0].total) || 0;

    // Active Run Sheets
    const { rows: rsStats } = await db.query("SELECT COUNT(*) as total FROM run_sheets WHERE status != 'COMPLETED'");
    stats.active_run_sheets = parseInt(rsStats[0].total) || 0;

    // Status-wise Breakdown
    const { rows: statusStats } = await db.query('SELECT status, COUNT(*) as count FROM shipments GROUP BY status');
    stats.status_breakdown = statusStats;

    // Revenue / COD
    const { rows: financialStats } = await db.query(
      'SELECT SUM(service_charges) as total_revenue, SUM(cod_amount) as total_cod_pending FROM shipments WHERE status != $1',
      ['DELIVERED']
    );
    stats.financials = {
      total_revenue: parseFloat(financialStats[0].total_revenue) || 0,
      total_cod_pending: parseFloat(financialStats[0].total_cod_pending) || 0
    };

    // Revenue Growth (dummy real data: get revenue by month, but if no shipments, it will be empty)
    const { rows: revenueData } = await db.query(`
      SELECT TO_CHAR(created_at, 'Mon') as name, SUM(service_charges) as revenue 
      FROM shipments 
      GROUP BY TO_CHAR(created_at, 'Mon'), EXTRACT(MONTH FROM created_at)
      ORDER BY EXTRACT(MONTH FROM created_at) LIMIT 6
    `);
    stats.revenue_growth = revenueData.map(r => ({ name: r.name, revenue: parseFloat(r.revenue) || 0 }));

    // Recent Activity (fetch 4 recent shipments or users)
    const { rows: recentShipments } = await db.query(`
      SELECT tracking_id, status, created_at FROM shipments ORDER BY created_at DESC LIMIT 4
    `);
    stats.recent_activity = recentShipments.map(s => ({
      type: 'SHIPMENT',
      msg: `Shipment ${s.tracking_id} is now ${s.status}`,
      time: new Date(s.created_at).toLocaleString(),
    }));

    res.json(stats);
  } catch (error) {
    next(error);
  }
};

exports.getOpsDashboard = async (req, res, next) => {
  try {
    const { branch_id } = req.query;
    if (!branch_id) return res.status(400).json({ message: 'Branch ID is required' });

    const stats = {};
    
    // In Warehouse
    const { rows: warehouseStats } = await db.query(
      "SELECT COUNT(*) as count FROM shipments WHERE current_branch_id = $1 AND status = 'IN_WAREHOUSE'",
      [branch_id]
    );
    stats.in_warehouse = warehouseStats[0].count;

    // Out for Delivery
    const { rows: ofdStats } = await db.query(
      "SELECT COUNT(*) as count FROM shipments WHERE current_branch_id = $1 AND status = 'OUT_FOR_DELIVERY'",
      [branch_id]
    );
    stats.out_for_delivery = ofdStats[0].count;

    res.json(stats);
  } catch (error) {
    next(error);
  }
};

exports.getCustomerDashboard = async (req, res, next) => {
  try {
    const stats = {};
    const customer_id = req.user.id;

    const { rows: shipmentStats } = await db.query(
      'SELECT status, COUNT(*) as count FROM shipments WHERE customer_id = $1 GROUP BY status',
      [customer_id]
    );
    stats.shipments = shipmentStats;

    res.json(stats);
  } catch (error) {
    next(error);
  }
};
