const db = require('../config/db');

/**
 * Logs a system action to the audit_logs table.
 * @param {string} user_id 
 * @param {string} action 
 * @param {string} entity_name 
 * @param {string} entity_id 
 * @param {object} old_values 
 * @param {object} new_values 
 */
const logAction = async (user_id, action, entity_name = null, entity_id = null, old_values = null, new_values = null) => {
  try {
    const query = `
      INSERT INTO audit_logs (user_id, action, entity_name, entity_id, old_values, new_values)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await db.query(query, [
      user_id, 
      action, 
      entity_name, 
      entity_id, 
      old_values ? JSON.stringify(old_values) : null, 
      new_values ? JSON.stringify(new_values) : null
    ]);
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
};

module.exports = { logAction };
